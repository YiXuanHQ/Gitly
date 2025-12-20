import * as path from 'path';
import * as vscode from 'vscode';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { RepoManager } from './repoManager';
import { getConfig } from './config';
import { BooleanOverride, CommitOrdering, GitCommit, GitFileChange, GitFileStatus, GitRepoSet, RepoCommitOrdering } from './types';
import { getRepoName } from './utils';
import { AssistantCommandHistory } from './assistantCommandHistory';
import { ConflictHistory } from './conflictHistory';

interface GitStatusForWeb {
    current: string | null;
    tracking: string | null;
    ahead: number;
    behind: number;
    modified: string[];
    created: string[];
    deleted: string[];
    renamed: string[];
    conflicted: string[];
    staged: string[];
    not_added?: string[];
    files: Array<{ path: string; index: string; working_dir: string }>;
}

interface StatsCache {
    timeline: Array<{ date: string; count: number }>;
    fileStats: Array<{ path: string; count: number }>;
    contributorStats: Array<{ email: string; commits: number; files: number }>;
    commitsHash: string; // 用于验证缓存是否有效
    timestamp: number;
}

export class AssistantPanel {
    private panel: vscode.WebviewPanel | null = null;
    private currentRepo: string | null = null;
    // 统计数据缓存：key = repo路径，value = 缓存数据
    private statsCache: Map<string, StatsCache> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存有效期
    private readonly MAX_CONCURRENT_REQUESTS = 5; // 最大并发请求数

    constructor(
        private readonly extensionPath: string,
        private readonly repoManager: RepoManager,
        private readonly dataSource: DataSource,
        private readonly extensionState: ExtensionState
    ) { }

    public dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }

    public show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Active);
            this.sendInitialData();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'gitly-assistant',
            'Gitly',
            { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.extensionPath, 'media', 'assistant')),
                    vscode.Uri.file(path.join(this.extensionPath, 'media')),
                    vscode.Uri.file(path.join(this.extensionPath, 'resources'))
                ]
            }
        );

        // 设置面板图标
        this.panel.iconPath = {
            light: vscode.Uri.file(path.join(this.extensionPath, 'resources', 'webview-icon-light.svg')),
            dark: vscode.Uri.file(path.join(this.extensionPath, 'resources', 'webview-icon-dark.svg'))
        };

        this.panel.onDidDispose(() => {
            this.panel = null;
        });

        this.panel.webview.onDidReceiveMessage((msg) => {
            if (!msg || typeof msg !== 'object') return;
            switch (msg.command) {
                case 'getData':
                case 'refresh':
                    this.sendInitialData();
                    break;
                // 分支相关操作
                case 'createBranch':
                    void this.createBranchInteractive();
                    break;
                case 'switchBranch':
                    if (typeof msg.branch === 'string') {
                        void this.switchBranchInteractive(msg.branch);
                    }
                    break;
                case 'mergeBranch':
                    if (typeof msg.branch === 'string') {
                        void this.mergeBranchInteractive(msg.branch);
                    }
                    break;
                case 'renameBranch':
                    if (typeof msg.branch === 'string') {
                        void this.renameBranchInteractive(msg.branch);
                    }
                    break;
                case 'deleteBranch':
                    if (typeof msg.branch === 'string') {
                        void this.deleteBranchInteractive(msg.branch);
                    }
                    break;
                // 远程仓库相关操作
                case 'addRemote':
                    void this.addRemoteInteractive();
                    break;
                case 'editRemote':
                    if (typeof msg.remote === 'string') {
                        void this.editRemoteInteractive(msg.remote);
                    }
                    break;
                case 'deleteRemote':
                    if (typeof msg.remote === 'string') {
                        void this.deleteRemoteInteractive(msg.remote);
                    }
                    break;
                // 标签相关操作（TagManager 组件消息）
                case 'createTag':
                    void this.createTagInteractive();
                    break;
                case 'deleteTag':
                    if (typeof msg.tagName === 'string') {
                        void this.deleteTagInteractive(msg.tagName);
                    }
                    break;
                case 'pushTag':
                    if (typeof msg.tagName === 'string') {
                        void this.pushTagInteractive(msg.tagName);
                    }
                    break;
                case 'pushAllTags':
                    void this.pushAllTagsInteractive();
                    break;
                case 'executeCommand':
                    if (typeof msg.commandId === 'string') {
                        this.executeCommand(msg.commandId);
                    }
                    break;
                case 'clearHistory':
                    AssistantCommandHistory.clear();
                    this.sendInitialData();
                    break;
                case 'openRemoteUrl':
                    if (typeof msg.url === 'string') {
                        try {
                            void vscode.env.openExternal(vscode.Uri.parse(msg.url));
                        } catch {
                            // noop
                        }
                    }
                    break;
                case 'openFile':
                    if (typeof msg.file === 'string') {
                        this.openFileInWorkspace(msg.file);
                    }
                    break;
                case 'copyToClipboard':
                    if (typeof msg.text === 'string') {
                        void vscode.env.clipboard.writeText(msg.text);
                        void vscode.window.showInformationMessage('已复制到剪贴板');
                    }
                    break;
                case 'resolveConflict':
                    if (typeof msg.file === 'string' && typeof msg.action === 'string') {
                        void this.resolveConflict(msg.file, msg.action as 'current' | 'incoming' | 'both');
                    }
                    break;
                case 'initRepo':
                    void this.initRepository(msg.path || null);
                    break;
                case 'cloneRepo':
                    void this.cloneRepository(msg.url || '', msg.path || null);
                    break;
                case 'rescanForRepos':
                    void this.rescanForRepos();
                    break;
                default:
                    break;
            }
        });

        this.panel.webview.html = this.getHtml(this.panel.webview);
        this.sendInitialData();
    }

    private getHtml(webview: vscode.Webview): string {
        const scriptOnDisk = vscode.Uri.file(path.join(this.extensionPath, 'media', 'assistant', 'index.js'));
        // Webview 只能加载 localResourceRoots 允许的资源；样式文件在打包后位于 media/assistant/styles
        const styleOnDisk = vscode.Uri.file(path.join(this.extensionPath, 'media', 'assistant', 'styles', 'main.css'));
        const scriptUri = webview.asWebviewUri(scriptOnDisk);
        const styleUri = webview.asWebviewUri(styleOnDisk);
        const cspSource = webview.cspSource;
        const vscodeLanguage = vscode.env.language;
        const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

        return '' +
            '<!DOCTYPE html>' +
            '<html lang="' + normalisedLanguage + '">' +
            '<head>' +
            '<meta charset="UTF-8" />' +
            '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src ' + cspSource + ' https: data:; style-src ' + cspSource + ' \'unsafe-inline\'; script-src ' + cspSource + ';">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
            '<link rel="stylesheet" href="' + styleUri + '">' +
            '<title>Gitly</title>' +
            '</head>' +
            '<body>' +
            '<div id="root"></div>' +
            '<script>window.gitlyLanguage = "' + normalisedLanguage + '";</script>' +
            '<script type="module" src="' + scriptUri + '"></script>' +
            '</body>' +
            '</html>';
    }

    private getActiveRepo(repos: GitRepoSet): string | null {
        const repoPaths = Object.keys(repos);
        if (repoPaths.length === 0) return null;

        const lastActive = this.extensionState.getLastActiveRepo();
        if (lastActive && typeof repos[lastActive] !== 'undefined') {
            return lastActive;
        }

        return repoPaths[0];
    }

    private async sendInitialData() {
        if (!this.panel) return;

        const repos = this.repoManager.getRepos();
        const repo = this.getActiveRepo(repos);
        const vscodeLanguage = vscode.env.language;
        const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

        if (!repo) {
            this.currentRepo = null;
            this.panel.webview.postMessage({
                type: 'gitData',
                data: {
                    repositoryInfo: {
                        name: normalisedLanguage === 'zh-CN' ? '未检测到 Git 仓库' : 'No Git repository detected',
                        path: ''
                    },
                    language: normalisedLanguage,
                    // 即使没有检测到仓库，也向前端提供可用命令和分类，便于展示“初始化仓库”等操作
                    commandHistory: [],
                    availableCommands: AssistantCommandHistory.getAvailableCommands(),
                    categories: AssistantCommandHistory.getCommandCategories()
                }
            });
            return;
        }

        this.currentRepo = repo;
        const repoState = repos[repo];
        const globalConfig = getConfig();

        const includeCommitsMentionedByReflogs = this.resolveBooleanOverride(
            repoState.includeCommitsMentionedByReflogs,
            globalConfig.includeCommitsMentionedByReflogs
        );
        const onlyFollowFirstParent = this.resolveBooleanOverride(
            repoState.onlyFollowFirstParent,
            globalConfig.onlyFollowFirstParent
        );
        const showStashes = this.resolveBooleanOverride(
            repoState.showStashes,
            globalConfig.showStashes
        );

        const showRemoteBranches = repoState.showRemoteBranches;
        const hideRemotes = repoState.hideRemotes || [];

        try {
            const repoInfo = await this.dataSource.getRepoInfo(repo, showRemoteBranches, showStashes, hideRemotes);
            const commitOrdering = this.toCommitOrdering(repoState.commitOrdering, globalConfig.commitOrder);

            const commitData = await this.dataSource.getCommits(
                repo,
                null, // 所有分支
                globalConfig.initialLoadCommits,
                this.resolveBooleanOverride(repoState.showTags, globalConfig.showTags),
                showRemoteBranches,
                includeCommitsMentionedByReflogs,
                onlyFollowFirstParent,
                commitOrdering,
                repoInfo.remotes,
                hideRemotes,
                repoInfo.stashes
            );

            const statusAndConflicts = await this.buildStatus(repo, repoInfo.head);

            // 获取远程仓库的 URL 信息
            const configData = await this.dataSource.getConfig(repo, repoInfo.remotes || []);
            const remotesWithUrls = (repoInfo.remotes || []).map((name) => {
                const remoteConfig = configData.config?.remotes?.find(r => r.name === name);
                return {
                    name: name,
                    refs: {
                        fetch: remoteConfig?.url || undefined,
                        push: remoteConfig?.pushUrl || remoteConfig?.url || undefined
                    }
                };
            });

            // 生成提交列表的哈希用于缓存验证
            const commitsHash = this.generateCommitsHash(commitData.commits);

            // 尝试从缓存获取统计数据
            const cachedStats = this.getCachedStats(repo, commitsHash);

            // 计算时间线数据（按日期聚合提交）- 这个计算很快，不需要缓存
            const timeline = this.buildTimeline(commitData.commits);

            // 使用缓存的数据或先发送空数据
            const fileStats = cachedStats?.fileStats || [];
            const contributorStats = cachedStats?.contributorStats || this.buildContributorStats(commitData.commits);

            const gitData: any = {
                repositoryInfo: {
                    name: repoState.name || getRepoName(repo),
                    path: repo
                },
                currentBranch: repoInfo.head,
                currentCommitHash: commitData.head,
                status: statusAndConflicts.status,
                conflicts: statusAndConflicts.conflicts,
                branches: this.buildBranches(repoInfo.head, repoInfo.branches),
                log: this.buildLog(commitData.commits),
                tags: this.buildTags(commitData.commits),
                remotes: remotesWithUrls,
                branchGraph: this.buildBranchGraph(commitData.commits, repoInfo.head),
                // 时间线和热力图数据
                timeline: timeline,
                fileStats: fileStats,
                contributorStats: contributorStats,
                // 快捷指令面板所需的命令元素数据与历史
                commandHistory: AssistantCommandHistory.getHistory(50),
                availableCommands: AssistantCommandHistory.getAvailableCommands(),
                categories: AssistantCommandHistory.getCommandCategories(),
                // 冲突解决历史
                conflictHistory: ConflictHistory.getHistory(20)
            };

            this.panel.webview.postMessage({
                type: 'gitData',
                data: {
                    ...gitData,
                    language: normalisedLanguage
                }
            });

            // 如果缓存中没有文件统计，异步加载（不阻塞初始数据发送）
            if (!cachedStats || cachedStats.commitsHash !== commitsHash) {
                void this.loadFileAndContributorStatsAsync(repo, commitData.commits, commitsHash);
            }
        } catch (e) {
            this.panel.webview.postMessage({
                type: 'gitData',
                data: {
                    repositoryInfo: {
                        name: repoState.name || getRepoName(repo),
                        path: repo
                    },
                    // 确保前端始终收到冲突字段，避免冲突面板一直停留在“正在检测冲突...”状态
                    status: undefined,
                    conflicts: []
                }
            });
        }
    }

    /**
     * 执行来自 Webview 的命令，并记录到命令历史中。
     * 这里既支持本扩展提供的命令（如 gitly.view），也支持 VS Code 内置命令。
     */
    private async executeCommand(commandId: string) {
        const commands = AssistantCommandHistory.getAvailableCommands();
        const meta = commands.find(c => c.id === commandId);
        const commandName = meta ? meta.name : commandId;

        try {
            const allCommands = await vscode.commands.getCommands(true);
            if (!allCommands.includes(commandId)) {
                AssistantCommandHistory.add({
                    command: commandId,
                    commandName,
                    success: false,
                    error: '命令尚未在当前扩展中实现',
                    remote: undefined
                });
                this.sendInitialData();
                return;
            }

            await vscode.commands.executeCommand(commandId);

            AssistantCommandHistory.add({
                command: commandId,
                commandName,
                success: true,
                remote: undefined
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            AssistantCommandHistory.add({
                command: commandId,
                commandName,
                success: false,
                error: errorMessage,
                remote: undefined
            });
        }

        this.sendInitialData();
    }

    /**
     * 打开工作区中的文件（基于当前激活仓库路径）。
     */
    private async openFileInWorkspace(relativePath: string) {
        try {
            const repo = this.currentRepo;
            const absolute = path.isAbsolute(relativePath) || !repo
                ? relativePath
                : path.join(repo, relativePath);
            const uri = vscode.Uri.file(absolute);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: true });
        } catch (e) {
            vscode.window.showErrorMessage(`无法打开文件: ${relativePath}`);
        }
    }

    private resolveBooleanOverride(override: BooleanOverride, fallback: boolean): boolean {
        if (override === BooleanOverride.Enabled) return true;
        if (override === BooleanOverride.Disabled) return false;
        return fallback;
    }

    private toCommitOrdering(ordering: RepoCommitOrdering, defaultOrdering: CommitOrdering): CommitOrdering {
        if (ordering === RepoCommitOrdering.Date) return CommitOrdering.Date;
        if (ordering === RepoCommitOrdering.AuthorDate) return CommitOrdering.AuthorDate;
        if (ordering === RepoCommitOrdering.Topological) return CommitOrdering.Topological;
        return defaultOrdering;
    }

    private buildBranches(head: string | null, branches: ReadonlyArray<string> | undefined) {
        const all = branches || [];
        const detailMap: { [key: string]: { current: boolean; name: string; commit: string; label: string } } = {};

        for (let i = 0; i < all.length; i++) {
            const name = all[i];
            detailMap[name] = {
                current: name === head,
                name: name,
                commit: '',
                label: name
            };
        }

        return {
            current: head,
            all,
            branches: detailMap
        };
    }

    private buildLog(commits: ReadonlyArray<GitCommit> | undefined) {
        const all: any[] = [];
        if (!commits) {
            return { all, total: 0, latest: null };
        }

        for (let i = 0; i < commits.length; i++) {
            const c = commits[i];
            all.push({
                hash: c.hash,
                date: new Date(c.date * 1000).toISOString(),
                message: c.message,
                author_name: c.author,
                author_email: c.email,
                body: '',
                refs: '',
                branches: c.heads,
                parents: c.parents,
                timestamp: c.date * 1000
            });
        }

        return {
            all,
            total: all.length,
            latest: all.length > 0 ? all[0] : null
        };
    }

    private buildTags(commits: ReadonlyArray<GitCommit> | undefined) {
        const tags: Array<{ name: string; commit: string; message?: string; date?: string }> = [];
        if (!commits) return tags;

        for (let i = 0; i < commits.length; i++) {
            const c = commits[i];
            if (!c.tags || c.tags.length === 0) continue;
            for (let j = 0; j < c.tags.length; j++) {
                const t = c.tags[j];
                tags.push({
                    name: t.name,
                    commit: c.hash
                });
            }
        }

        return tags;
    }

    private buildBranchGraph(commits: ReadonlyArray<GitCommit> | undefined, currentBranch: string | null) {
        if (!commits) {
            return undefined;
        }

        const nodes: Array<{ hash: string; parents: ReadonlyArray<string>; branches: ReadonlyArray<string>; timestamp: number; isMerge?: boolean }> = [];
        const links: Array<{ source: string; target: string }> = [];
        const branchesSet = new Set<string>();

        for (let i = 0; i < commits.length; i++) {
            const c = commits[i];
            nodes.push({
                hash: c.hash,
                parents: c.parents,
                branches: c.heads,
                timestamp: c.date * 1000,
                isMerge: c.parents.length > 1
            });

            for (let j = 0; j < c.parents.length; j++) {
                links.push({ source: c.hash, target: c.parents[j] });
            }

            for (let j = 0; j < c.heads.length; j++) {
                branchesSet.add(c.heads[j]);
            }
        }

        return {
            branches: Array.from(branchesSet),
            merges: [],
            currentBranch: currentBranch || undefined,
            dag: {
                nodes,
                links
            }
        };
    }

    private async buildStatus(repo: string, headBranch: string | null): Promise<{ status?: GitStatusForWeb; conflicts?: string[] }> {
        // 无论是否有未提交更改 / 是否发生错误，都尽量返回一个完整的状态对象，
        // 以便前端根据 status !== undefined 判断“已初始化 Git 仓库”。
        const createEmptyStatus = (): GitStatusForWeb => ({
            current: headBranch,
            tracking: null,
            ahead: 0,
            behind: 0,
            modified: [],
            created: [],
            deleted: [],
            renamed: [],
            conflicted: [],
            staged: [],
            not_added: [],
            files: []
        });

        try {
            const uncommitted = await this.dataSource.getUncommittedDetails(repo);
            const details = uncommitted.commitDetails;
            if (!details) {
                return { status: createEmptyStatus(), conflicts: [] };
            }

            const files = details.fileChanges || [];
            const status: GitStatusForWeb = createEmptyStatus();

            const conflicts: string[] = [];

            for (let i = 0; i < files.length; i++) {
                const fc: GitFileChange = files[i];
                const filePath = fc.newFilePath || fc.oldFilePath;

                let indexCode = '';
                let workingCode = '';

                switch (fc.type) {
                    case GitFileStatus.Added:
                        status.created.push(filePath);
                        indexCode = 'A';
                        workingCode = 'A';
                        break;
                    case GitFileStatus.Modified:
                        status.modified.push(filePath);
                        indexCode = 'M';
                        workingCode = 'M';
                        break;
                    case GitFileStatus.Deleted:
                        status.deleted.push(filePath);
                        indexCode = 'D';
                        workingCode = 'D';
                        break;
                    case GitFileStatus.Renamed:
                        status.renamed.push(filePath);
                        indexCode = 'R';
                        workingCode = 'R';
                        break;
                    case GitFileStatus.Untracked:
                        if (!status.not_added) status.not_added = [];
                        status.not_added.push(filePath);
                        indexCode = '?';
                        workingCode = '?';
                        break;
                    default:
                        break;
                }

                status.files.push({
                    path: filePath,
                    index: indexCode,
                    working_dir: workingCode
                });
            }

            // 并行检测所有文件的冲突标记
            const conflictChecks = files.map(async (fc) => {
                const filePath = fc.newFilePath || fc.oldFilePath;
                try {
                    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(repo, filePath);
                    const fileUri = vscode.Uri.file(fullPath);
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const content = document.getText();

                    // 检查是否包含冲突标记
                    if (content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>')) {
                        return filePath;
                    }
                } catch {
                    // 如果无法读取文件（可能已删除），跳过冲突检测
                }
                return null;
            });

            const conflictResults = await Promise.all(conflictChecks);
            for (const result of conflictResults) {
                if (result) {
                    conflicts.push(result);
                    status.conflicted.push(result);
                }
            }

            return {
                status,
                conflicts // 总是返回数组，即使为空
            };
        } catch {
            // 出错时也返回一个空状态对象，表示仓库已初始化但当前无法获取详细状态
            return { status: createEmptyStatus(), conflicts: [] };
        }
    }

    /* ========= 交互式 Git 操作（分支/远程）========= */

    private async ensureRepo(): Promise<string | null> {
        if (!this.currentRepo) {
            vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
            return null;
        }
        return this.currentRepo;
    }

    private async createBranchInteractive() {
        const repo = await this.ensureRepo();
        if (!repo) return;

        const branchName = await vscode.window.showInputBox({
            title: '创建新分支',
            prompt: '请输入新分支名称（基于当前 HEAD 创建）',
            placeHolder: 'feature/my-new-branch'
        } as any);
        if (!branchName) return;

        try {
            // 使用 HEAD 作为起点创建分支并检出
            await this.dataSource.createBranch(repo, branchName, 'HEAD', true, false);
            vscode.window.showInformationMessage(`已创建并切换到分支 "${branchName}"`);

            AssistantCommandHistory.add({
                command: 'git-assistant.createBranch',
                commandName: `创建分支 ${branchName}`,
                success: true
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`创建分支失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.createBranch',
                commandName: `创建分支 ${branchName}`,
                success: false,
                error: msg
            });
        }

        this.sendInitialData();
    }

    private async switchBranchInteractive(branchName: string) {
        const repo = await this.ensureRepo();
        if (!repo) return;

        try {
            await this.dataSource.checkoutBranch(repo, branchName, null);
            vscode.window.showInformationMessage(`已切换到分支 "${branchName}"`);
            AssistantCommandHistory.add({
                command: 'git-assistant.switchBranch',
                commandName: `切换分支 ${branchName}`,
                success: true
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`切换分支失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.switchBranch',
                commandName: `切换分支 ${branchName}`,
                success: false,
                error: msg
            });
        }

        this.sendInitialData();
    }

    private async mergeBranchInteractive(branchName: string) {
        const repo = await this.ensureRepo();
        if (!repo) return;

        const confirm = await vscode.window.showWarningMessage(
            `确认要将分支 "${branchName}" 合并到当前分支吗？`,
            { modal: true },
            '确认合并'
        );
        if (confirm !== '确认合并') return;

        try {
            // 简单使用 fast-forward 优先的 merge
            await this.dataSource.merge(repo, branchName, 0 as any, false, false, false);
            vscode.window.showInformationMessage(`已发起合并分支 "${branchName}"，如有冲突请在编辑器中解决。`);
            AssistantCommandHistory.add({
                command: 'git-assistant.mergeBranch',
                commandName: `合并分支 ${branchName}`,
                success: true
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`合并分支失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.mergeBranch',
                commandName: `合并分支 ${branchName}`,
                success: false,
                error: msg
            });
        }

        this.sendInitialData();
    }

    private async renameBranchInteractive(oldName: string) {
        const repo = await this.ensureRepo();
        if (!repo) return;

        const newName = await vscode.window.showInputBox({
            title: '重命名分支',
            prompt: `请输入分支 "${oldName}" 的新名称`,
            value: oldName
        } as any);
        if (!newName || newName === oldName) return;

        try {
            await this.dataSource.renameBranch(repo, oldName, newName);
            vscode.window.showInformationMessage(`已将分支 "${oldName}" 重命名为 "${newName}"`);
            AssistantCommandHistory.add({
                command: 'git-assistant.renameBranch',
                commandName: `重命名分支 ${oldName} -> ${newName}`,
                success: true
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`重命名分支失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.renameBranch',
                commandName: `重命名分支 ${oldName} -> ${newName}`,
                success: false,
                error: msg
            });
        }

        this.sendInitialData();
    }

    private async deleteBranchInteractive(branchName: string) {
        const repo = await this.ensureRepo();
        if (!repo) return;

        const confirm = await vscode.window.showWarningMessage(
            `确认要删除本地分支 "${branchName}" 吗？该操作不可撤销。`,
            { modal: true },
            '删除分支'
        );
        if (confirm !== '删除分支') return;

        try {
            await this.dataSource.deleteBranch(repo, branchName, false);
            vscode.window.showInformationMessage(`已删除分支 "${branchName}"`);
            AssistantCommandHistory.add({
                command: 'git-assistant.deleteBranch',
                commandName: `删除分支 ${branchName}`,
                success: true
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`删除分支失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.deleteBranch',
                commandName: `删除分支 ${branchName}`,
                success: false,
                error: msg
            });
        }

        this.sendInitialData();
    }

    private async addRemoteInteractive() {
        const repo = await this.ensureRepo();
        if (!repo) return;

        const name = await vscode.window.showInputBox({
            title: '添加远程仓库',
            prompt: '请输入远程名称（例如 origin）',
            value: 'origin'
        } as any);
        if (!name) return;

        const url = await vscode.window.showInputBox({
            title: '添加远程仓库',
            prompt: '请输入远程仓库 URL（例如 https://github.com/user/repo.git）'
        } as any);
        if (!url) return;

        try {
            await this.dataSource.addRemote(repo, name, url, null, true);
            vscode.window.showInformationMessage(`已添加远程仓库 "${name}" 并执行 fetch`);
            AssistantCommandHistory.add({
                command: 'git-assistant.addRemote',
                commandName: `添加远程 ${name}`,
                success: true,
                remote: name
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`添加远程仓库失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.addRemote',
                commandName: `添加远程 ${name}`,
                success: false,
                error: msg,
                remote: name
            });
        }

        this.sendInitialData();
    }

    private async editRemoteInteractive(remoteName: string) {
        const repo = await this.ensureRepo();
        if (!repo) return;

        const newName = await vscode.window.showInputBox({
            title: '编辑远程仓库',
            prompt: `修改远程名称（当前：${remoteName}）。如果不想修改名称，请直接回车。`,
            value: remoteName
        } as any);
        if (!newName || newName === remoteName) {
            // 名称未改变，目前暂不支持直接修改 URL
            vscode.window.showInformationMessage('当前只支持修改远程名称，如需修改 URL 请使用 Gitly 配置界面。');
            return;
        }

        try {
            await this.dataSource.editRemote(repo, remoteName, newName, null, null, null, null);
            vscode.window.showInformationMessage(`已将远程 "${remoteName}" 重命名为 "${newName}"`);
            AssistantCommandHistory.add({
                command: 'git-assistant.editRemote',
                commandName: `重命名远程 ${remoteName} -> ${newName}`,
                success: true,
                remote: newName
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`编辑远程仓库失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.editRemote',
                commandName: `重命名远程 ${remoteName} -> ${newName}`,
                success: false,
                error: msg,
                remote: remoteName
            });
        }

        this.sendInitialData();
    }

    private async deleteRemoteInteractive(remoteName: string) {
        const repo = await this.ensureRepo();
        if (!repo) return;

        const confirm = await vscode.window.showWarningMessage(
            `确认要删除远程仓库 "${remoteName}" 吗？不会删除远程服务器上的仓库，但会移除本地配置。`,
            { modal: true },
            '删除远程'
        );
        if (confirm !== '删除远程') return;

        try {
            await this.dataSource.deleteRemote(repo, remoteName);
            vscode.window.showInformationMessage(`已删除远程仓库 "${remoteName}"`);
            AssistantCommandHistory.add({
                command: 'git-assistant.deleteRemote',
                commandName: `删除远程 ${remoteName}`,
                success: true,
                remote: remoteName
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`删除远程仓库失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.deleteRemote',
                commandName: `删除远程 ${remoteName}`,
                success: false,
                error: msg,
                remote: remoteName
            });
        }

        this.sendInitialData();
    }

    /* ========= 交互式 Git 操作（标签）========= */

    private async createTagInteractive() {
        // 直接复用已注册的快捷指令命令（会弹出输入框/选择框）
        try {
            await vscode.commands.executeCommand('git-assistant.createTag');
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`创建标签失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.createTag',
                commandName: '创建标签',
                success: false,
                error: msg
            });
            this.sendInitialData();
        }
    }

    private async deleteTagInteractive(tagName: string) {
        const repo = await this.ensureRepo();
        if (!repo) return;

        const confirm = await vscode.window.showWarningMessage(
            `确认要删除本地标签 "${tagName}" 吗？`,
            { modal: true },
            '删除标签'
        );
        if (confirm !== '删除标签') return;

        try {
            const err = await this.dataSource.deleteTag(repo, tagName, null);
            if (err !== null) {
                vscode.window.showErrorMessage(`删除标签失败: ${err}`);
                AssistantCommandHistory.add({
                    command: 'git-assistant.deleteTag',
                    commandName: `删除标签 ${tagName}`,
                    success: false,
                    error: err
                });
            } else {
                vscode.window.showInformationMessage(`已删除标签 "${tagName}"`);
                AssistantCommandHistory.add({
                    command: 'git-assistant.deleteTag',
                    commandName: `删除标签 ${tagName}`,
                    success: true
                });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`删除标签失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.deleteTag',
                commandName: `删除标签 ${tagName}`,
                success: false,
                error: msg
            });
        }

        this.sendInitialData();
    }

    private async pushTagInteractive(tagName: string) {
        const repo = await this.ensureRepo();
        if (!repo) return;

        try {
            const repoInfo = await this.dataSource.getRepoInfo(repo, true, false, []);
            const remotes = (repoInfo.remotes || []).slice();
            if (remotes.length === 0) {
                vscode.window.showErrorMessage('当前仓库未配置远程仓库，无法推送标签。');
                AssistantCommandHistory.add({
                    command: 'git-assistant.pushTag',
                    commandName: `推送标签 ${tagName}`,
                    success: false,
                    error: '未配置远程仓库'
                });
                this.sendInitialData();
                return;
            }

            const pickedRemote = await vscode.window.showQuickPick(remotes, { placeHolder: '选择要推送到的远程' });
            if (!pickedRemote) return;

            // 使用 HEAD 作为 commitHash 并跳过 remote check，避免额外解析 tag -> commit
            const results = await this.dataSource.pushTag(repo, tagName, [pickedRemote], 'HEAD', true);
            const err = results.find((x) => x !== null) || null;
            if (err !== null) {
                vscode.window.showErrorMessage(`推送标签失败: ${err}`);
                AssistantCommandHistory.add({
                    command: 'git-assistant.pushTag',
                    commandName: `推送标签 ${tagName}`,
                    success: false,
                    error: err,
                    remote: pickedRemote
                });
            } else {
                vscode.window.showInformationMessage(`已推送标签 "${tagName}" 到远程 "${pickedRemote}"`);
                AssistantCommandHistory.add({
                    command: 'git-assistant.pushTag',
                    commandName: `推送标签 ${tagName}`,
                    success: true,
                    remote: pickedRemote
                });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`推送标签失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.pushTag',
                commandName: `推送标签 ${tagName}`,
                success: false,
                error: msg
            });
        }

        this.sendInitialData();
    }

    private async pushAllTagsInteractive() {
        const repo = await this.ensureRepo();
        if (!repo) return;

        try {
            const repoInfo = await this.dataSource.getRepoInfo(repo, true, false, []);
            const remotes = (repoInfo.remotes || []).slice();
            if (remotes.length === 0) {
                vscode.window.showErrorMessage('当前仓库未配置远程仓库，无法推送标签。');
                AssistantCommandHistory.add({
                    command: 'git-assistant.pushAllTags',
                    commandName: '推送所有标签',
                    success: false,
                    error: '未配置远程仓库'
                });
                this.sendInitialData();
                return;
            }

            const pickedRemote = await vscode.window.showQuickPick(remotes, { placeHolder: '选择要推送到的远程' });
            if (!pickedRemote) return;

            const confirm = await vscode.window.showWarningMessage(
                `确认将所有本地标签推送到远程 "${pickedRemote}" 吗？（git push ${pickedRemote} --tags）`,
                { modal: true },
                '确认推送'
            );
            if (confirm !== '确认推送') return;

            const err = await this.dataSource.openGitTerminal(repo, `push ${pickedRemote} --tags`, `Push Tags (${pickedRemote})`);
            if (err !== null) {
                vscode.window.showErrorMessage(`推送所有标签失败: ${err}`);
                AssistantCommandHistory.add({
                    command: 'git-assistant.pushAllTags',
                    commandName: '推送所有标签',
                    success: false,
                    error: err,
                    remote: pickedRemote
                });
            } else {
                vscode.window.showInformationMessage(`已在终端执行推送所有标签到 "${pickedRemote}"`);
                AssistantCommandHistory.add({
                    command: 'git-assistant.pushAllTags',
                    commandName: '推送所有标签',
                    success: true,
                    remote: pickedRemote
                });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`推送所有标签失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.pushAllTags',
                commandName: '推送所有标签',
                success: false,
                error: msg
            });
        }

        this.sendInitialData();
    }

    /* ========= 冲突解决 ========= */

    private async resolveConflict(filePath: string, action: 'current' | 'incoming' | 'both') {
        const repo = await this.ensureRepo();
        if (!repo) return;

        try {
            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(repo, filePath);
            const fileUri = vscode.Uri.file(fullPath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            const text = document.getText();

            // 匹配冲突标记（兼容不同分支名和 CRLF/LF）
            // 形如：
            // <<<<<<< HEAD
            // ...当前更改...
            // =======
            // ...传入更改...
            // >>>>>>> main
            const conflictPattern = /<<<<<<<[^\n]*\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>>[^\n]*/g;

            let match;
            const edit = new vscode.WorkspaceEdit();
            const replacements: { range: vscode.Range; text: string }[] = [];

            while ((match = conflictPattern.exec(text)) !== null) {
                const fullMatch = match[0];
                const currentChanges = match[1];
                const incomingChanges = match[2];

                let resolvedText = '';
                switch (action) {
                    case 'current':
                        resolvedText = currentChanges;
                        break;
                    case 'incoming':
                        resolvedText = incomingChanges;
                        break;
                    case 'both':
                        resolvedText = currentChanges + '\n' + incomingChanges;
                        break;
                }

                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + fullMatch.length);
                replacements.push({
                    range: new vscode.Range(startPos, endPos),
                    text: resolvedText
                });
            }

            // 如果没有匹配到任何冲突块，给出提示
            if (replacements.length === 0) {
                vscode.window.showWarningMessage(
                    '未检测到标准 Git 冲突标记，请确认文件中仍包含 <<<<<<< / ======= / >>>>>>> 标记。'
                );
                return;
            }

            // 从后往前应用替换，避免位置偏移问题
            replacements.reverse();
            for (const replacement of replacements) {
                edit.replace(document.uri, replacement.range, replacement.text);
            }

            await vscode.workspace.applyEdit(edit);
            await document.save();

            const actionNames = {
                current: '接受当前更改',
                incoming: '接受传入更改',
                both: '接受所有更改'
            };

            vscode.window.showInformationMessage(
                `已${actionNames[action]}，解决了 ${replacements.length} 处冲突`
            );

            AssistantCommandHistory.add({
                command: 'git-assistant.resolveConflict',
                commandName: `${actionNames[action]} - ${filePath}`,
                success: true
            });

            // 记录到冲突历史
            ConflictHistory.recordResolved({
                file: filePath,
                action: action,
                conflictsCount: replacements.length
            });

            // 刷新数据，更新冲突列表
            this.sendInitialData();
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`解决冲突失败: ${msg}`);
            AssistantCommandHistory.add({
                command: 'git-assistant.resolveConflict',
                commandName: `解决冲突 - ${filePath}`,
                success: false,
                error: msg
            });
            this.sendInitialData();
        }
    }

    /* ========= 时间线和热力图数据计算 ========= */

    /**
     * 构建时间线数据（按日期聚合提交）
     */
    private buildTimeline(commits: ReadonlyArray<GitCommit> | undefined): Array<{ date: string; count: number }> {
        if (!commits || commits.length === 0) {
            return [];
        }

        const timelineMap = new Map<string, number>();

        for (let i = 0; i < commits.length; i++) {
            const commit = commits[i];
            // 将时间戳转换为日期字符串 YYYY-MM-DD
            const date = new Date(commit.date * 1000);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;

            const count = timelineMap.get(dateKey) || 0;
            timelineMap.set(dateKey, count + 1);
        }

        // 转换为数组并排序
        return Array.from(timelineMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * 生成提交列表的哈希用于缓存验证
     */
    private generateCommitsHash(commits: ReadonlyArray<GitCommit> | undefined): string {
        if (!commits || commits.length === 0) {
            return 'empty';
        }
        // 使用前10个和后10个提交的哈希生成缓存key
        const hashes = commits.slice(0, 10).map(c => c.hash).join(',') +
            (commits.length > 20 ? '...' : '') +
            commits.slice(-10).map(c => c.hash).join(',');
        return hashes;
    }

    /**
     * 获取缓存的统计数据
     */
    private getCachedStats(repo: string, commitsHash: string): StatsCache | null {
        const cached = this.statsCache.get(repo);
        if (!cached) {
            return null;
        }

        // 检查缓存是否过期
        const now = Date.now();
        if (now - cached.timestamp > this.CACHE_TTL) {
            this.statsCache.delete(repo);
            return null;
        }

        // 检查提交列表是否变化
        if (cached.commitsHash !== commitsHash) {
            return null;
        }

        return cached;
    }

    /**
     * 设置统计数据缓存
     */
    private setCachedStats(repo: string, commitsHash: string, stats: {
        fileStats: Array<{ path: string; count: number }>;
        contributorStats: Array<{ email: string; commits: number; files: number }>;
    }): void {
        const timeline = this.buildTimeline(undefined); // 时间线不需要缓存，每次都重新计算
        this.statsCache.set(repo, {
            timeline,
            fileStats: stats.fileStats,
            contributorStats: stats.contributorStats,
            commitsHash,
            timestamp: Date.now()
        });
    }

    /**
     * 异步加载文件统计和贡献者文件数（不阻塞初始数据发送）
     */
    private async loadFileAndContributorStatsAsync(
        repo: string,
        commits: ReadonlyArray<GitCommit> | undefined,
        commitsHash: string
    ): Promise<void> {
        if (!commits || commits.length === 0) {
            return;
        }

        try {
            // 限制处理的提交数量以提高性能（最多处理前100个提交）
            const commitsToProcess = commits.slice(0, 100);

            // 文件统计 Map
            const fileStatsMap = new Map<string, number>();

            // 贡献者统计 Map（包含文件集合）
            const contributorMap = new Map<string, { commits: number; files: Set<string> }>();

            // 初始化贡献者统计（先统计提交数）
            for (let i = 0; i < commitsToProcess.length; i++) {
                const commit = commitsToProcess[i];
                const email = commit.email || commit.author || 'unknown';

                const stats = contributorMap.get(email) || {
                    commits: 0,
                    files: new Set<string>()
                };

                stats.commits += 1;
                contributorMap.set(email, stats);
            }

            // 批量获取文件变更详情（限制并发数）
            const batchSize = this.MAX_CONCURRENT_REQUESTS;
            for (let i = 0; i < commitsToProcess.length; i += batchSize) {
                const batch = commitsToProcess.slice(i, i + batchSize);

                // 并行处理一批提交
                await Promise.all(batch.map(async (commit) => {
                    try {
                        const hasParents = commit.parents.length > 0;
                        const details = await this.dataSource.getCommitDetails(repo, commit.hash, hasParents);

                        if (details.commitDetails && details.commitDetails.fileChanges) {
                            const email = commit.email || commit.author || 'unknown';
                            const contributorStats = contributorMap.get(email);

                            // 统计文件修改次数
                            for (let j = 0; j < details.commitDetails.fileChanges.length; j++) {
                                const fileChange = details.commitDetails.fileChanges[j];
                                const filePath = fileChange.newFilePath || fileChange.oldFilePath || '';

                                if (filePath) {
                                    // 更新文件统计
                                    const count = fileStatsMap.get(filePath) || 0;
                                    fileStatsMap.set(filePath, count + 1);

                                    // 更新贡献者文件集合
                                    if (contributorStats) {
                                        contributorStats.files.add(filePath);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        // 忽略单个提交的获取失败，继续处理其他提交
                        // console.error(`Failed to get commit details for ${commit.hash}:`, error);
                    }
                }));
            }

            // 转换为数组格式
            const fileStats = Array.from(fileStatsMap.entries())
                .map(([path, count]) => ({ path, count }))
                .sort((a, b) => b.count - a.count);

            const contributorStats = Array.from(contributorMap.entries())
                .map(([email, stats]) => ({
                    email,
                    commits: stats.commits,
                    files: stats.files.size
                }))
                .sort((a, b) => b.commits - a.commits);

            // 更新缓存
            this.setCachedStats(repo, commitsHash, { fileStats, contributorStats });

            // 发送更新后的数据到 webview
            if (this.panel && this.currentRepo === repo) {
                this.panel.webview.postMessage({
                    type: 'gitData',
                    data: {
                        fileStats: fileStats,
                        contributorStats: contributorStats
                    }
                });
            }
        } catch (error) {
            // 静默处理错误，不影响主流程
            // console.error('Failed to load file and contributor stats:', error);
        }
    }

    /**
     * 构建文件统计（统计每个文件的修改次数）
     * 注意：由于 GitCommit 不包含文件变更信息，这里返回空数组
     * 实际数据通过异步方法 loadFileAndContributorStatsAsync 获取
     * @deprecated 此方法已不再使用，保留仅用于向后兼容
     */
    // @ts-ignore - 保留用于向后兼容
    private buildFileStats(_commits: ReadonlyArray<GitCommit> | undefined): Array<{ path: string; count: number }> {
        return [];
    }

    /**
     * 构建贡献者统计（基础版本，只统计提交数，文件数通过异步方法更新）
     */
    private buildContributorStats(commits: ReadonlyArray<GitCommit> | undefined): Array<{ email: string; commits: number; files: number }> {
        if (!commits || commits.length === 0) {
            return [];
        }

        const contributorMap = new Map<string, { commits: number; files: Set<string> }>();

        for (let i = 0; i < commits.length; i++) {
            const commit = commits[i];
            const email = commit.email || commit.author || 'unknown';

            const stats = contributorMap.get(email) || {
                commits: 0,
                files: new Set<string>()
            };

            stats.commits += 1;
            contributorMap.set(email, stats);
        }

        // 转换为数组格式
        return Array.from(contributorMap.entries())
            .map(([email, stats]) => ({
                email,
                commits: stats.commits,
                files: stats.files.size // 文件数通过异步方法更新
            }))
            .sort((a, b) => b.commits - a.commits);
    }

    /**
     * 清除指定仓库的缓存
     */
    public invalidateStatsCache(repo?: string): void {
        if (repo) {
            this.statsCache.delete(repo);
        } else {
            this.statsCache.clear();
        }
    }

    /**
     * 初始化 Git 仓库
     */
    private async initRepository(repoPath: string | null): Promise<void> {
        try {
            const vscodeLanguage = vscode.env.language;
            const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

            const targetPath = repoPath || (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : null);

            if (!targetPath) {
                const errorMsg = normalisedLanguage === 'zh-CN'
                    ? '没有打开工作区文件夹。请先打开一个工作区文件夹。'
                    : 'No workspace folder is open. Please open a workspace folder first.';
                vscode.window.showErrorMessage(errorMsg);
                return;
            }

            // Use VS Code's built-in git.init command
            await vscode.commands.executeCommand('git.init', vscode.Uri.file(targetPath));

            // Wait a bit for the repository to be initialized
            await new Promise(resolve => setTimeout(resolve, 500));

            // Rescan for repositories
            await this.repoManager.searchWorkspaceForRepos();

            // Refresh the panel
            this.sendInitialData();

            const successMsg = normalisedLanguage === 'zh-CN'
                ? 'Git 仓库初始化成功！'
                : 'Git repository initialized successfully!';
            vscode.window.showInformationMessage(successMsg);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const vscodeLanguage = vscode.env.language;
            const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
            const errorMsg = normalisedLanguage === 'zh-CN'
                ? '初始化 Git 仓库失败: ' + errorMessage
                : 'Failed to initialize Git repository: ' + errorMessage;
            vscode.window.showErrorMessage(errorMsg);
        }
    }

    /**
     * 克隆 Git 仓库
     */
    private async cloneRepository(url: string, targetPath: string | null): Promise<void> {
        try {
            const vscodeLanguage = vscode.env.language;
            const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

            if (!url || url.trim() === '') {
                // Prompt user for URL
                const promptText = normalisedLanguage === 'zh-CN'
                    ? '请输入远程仓库 URL（例如 https://github.com/user/repo.git）'
                    : 'Enter the remote repository URL (e.g., https://github.com/user/repo.git)';
                const placeHolderText = normalisedLanguage === 'zh-CN'
                    ? 'https://github.com/user/repo.git'
                    : 'https://github.com/user/repo.git';
                const validationError = normalisedLanguage === 'zh-CN'
                    ? 'URL 不能为空'
                    : 'URL cannot be empty';

                const inputUrl = await vscode.window.showInputBox({
                    prompt: promptText,
                    placeHolder: placeHolderText,
                    validateInput: (value) => {
                        if (!value || value.trim() === '') {
                            return validationError;
                        }
                        return null;
                    }
                });

                if (!inputUrl) {
                    return; // User cancelled
                }
                url = inputUrl;
            }

            let workspaceFolder: vscode.Uri | null = null;

            if (targetPath) {
                workspaceFolder = vscode.Uri.file(targetPath);
            } else {
                workspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
                    ? vscode.workspace.workspaceFolders[0].uri
                    : null;
            }

            if (!workspaceFolder) {
                const errorMsg = normalisedLanguage === 'zh-CN'
                    ? '没有打开工作区文件夹。请先打开一个工作区文件夹。'
                    : 'No workspace folder is open. Please open a workspace folder first.';
                vscode.window.showErrorMessage(errorMsg);
                return;
            }

            // Use VS Code's built-in git.clone command
            await vscode.commands.executeCommand('git.clone', url, workspaceFolder);

            // Wait a bit for the repository to be cloned
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Rescan for repositories
            await this.repoManager.searchWorkspaceForRepos();

            // Refresh the panel
            this.sendInitialData();

            const successMsg = normalisedLanguage === 'zh-CN'
                ? 'Git 仓库克隆成功！'
                : 'Git repository cloned successfully!';
            vscode.window.showInformationMessage(successMsg);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const vscodeLanguage = vscode.env.language;
            const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
            const errorMsg = normalisedLanguage === 'zh-CN'
                ? '克隆 Git 仓库失败: ' + errorMessage
                : 'Failed to clone Git repository: ' + errorMessage;
            vscode.window.showErrorMessage(errorMsg);
        }
    }

    /**
     * 重新扫描工作区中的仓库
     */
    private async rescanForRepos(): Promise<void> {
        const vscodeLanguage = vscode.env.language;
        const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

        const found = await this.repoManager.searchWorkspaceForRepos();
        if (!found) {
            const msg = normalisedLanguage === 'zh-CN'
                ? '未在工作区中找到 Git 仓库。'
                : 'No Git repositories were found in the current workspace.';
            vscode.window.showInformationMessage(msg);
        } else {
            // Refresh the panel
            this.sendInitialData();
        }
    }
}


