import * as path from 'path';
import * as vscode from 'vscode';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { RepoManager } from './repoManager';
import { getConfig } from './config';
import { BooleanOverride, CommitOrdering, GitCommit, GitFileChange, GitFileStatus, GitRepoSet, RepoCommitOrdering } from './types';
import { getRepoName } from './utils';
import { AssistantCommandHistory } from './assistantCommandHistory';

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

export class AssistantPanel {
    private panel: vscode.WebviewPanel | null = null;
    private currentRepo: string | null = null;
    private repoChangeDisposable: vscode.Disposable;
    private readonly language: 'en' | 'zh-CN';

    constructor(
        private readonly extensionPath: string,
        private readonly repoManager: RepoManager,
        private readonly dataSource: DataSource,
        private readonly extensionState: ExtensionState
    ) {
        this.language = this.getLanguage();

        // 当仓库列表变化（启动扫描完成或工作区变动）时，若面板已打开则自动刷新，避免初次进入时误判为未初始化
        this.repoChangeDisposable = this.repoManager.onDidChangeRepos(() => {
            if (this.panel) {
                void this.sendInitialData();
            }
        });
    }

    public show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Active);
            this.sendInitialData();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'git-graph-assistant',
            'Git Assistant',
            { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.extensionPath, 'media', 'assistant')),
                    vscode.Uri.file(path.join(this.extensionPath, 'media')),
                    vscode.Uri.file(path.join(this.extensionPath, 'code-git-assistant', 'web', 'styles'))
                ]
            }
        );

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
                default:
                    break;
            }
        });

        this.panel.webview.html = this.getHtml(this.panel.webview);
        this.sendInitialData();
    }

    public dispose() {
        this.repoChangeDisposable.dispose();
    }

    private getHtml(webview: vscode.Webview): string {
        const scriptOnDisk = vscode.Uri.file(path.join(this.extensionPath, 'media', 'assistant', 'index.js'));
        // 使用 Assistant 定制样式（打包后位于 media/assistant/styles）
        const styleOnDisk = vscode.Uri.file(path.join(this.extensionPath, 'media', 'assistant', 'styles', 'main.css'));
        const scriptUri = webview.asWebviewUri(scriptOnDisk);
        const styleUri = webview.asWebviewUri(styleOnDisk);
        const cspSource = webview.cspSource;
        const langAttr = this.language === 'zh-CN' ? 'zh-CN' : 'en';

        return '' +
            '<!DOCTYPE html>' +
            '<html lang="' + langAttr + '">' +
            '<head>' +
            '<meta charset="UTF-8" />' +
            '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src ' + cspSource + ' https: data:; style-src ' + cspSource + ' \'unsafe-inline\'; script-src ' + cspSource + ';">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
            '<link rel="stylesheet" href="' + styleUri + '">' +
            '<title>Git Assistant</title>' +
            '</head>' +
            '<body>' +
            '<div id="root"></div>' +
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

        if (!repo) {
            this.currentRepo = null;
            this.panel.webview.postMessage({
                type: 'gitData',
                data: {
                    language: this.language,
                    repositoryInfo: {
                        name: '未检测到 Git 仓库',
                        path: ''
                    }
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

            const gitData: any = {
                language: this.language,
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
                remotes: (repoInfo.remotes || []).map((name) => ({
                    name: name,
                    refs: { fetch: undefined, push: undefined }
                })),
                branchGraph: this.buildBranchGraph(commitData.commits, repoInfo.head),
                // 快捷指令面板所需的命令元素数据与历史
                commandHistory: AssistantCommandHistory.getHistory(50),
                availableCommands: AssistantCommandHistory.getAvailableCommands(),
                categories: AssistantCommandHistory.getCommandCategories()
            };

            this.panel.webview.postMessage({
                type: 'gitData',
                data: gitData
            });
        } catch (e) {
            this.panel.webview.postMessage({
                type: 'gitData',
                data: {
                    language: this.language,
                    repositoryInfo: {
                        name: repoState.name || getRepoName(repo),
                        path: repo
                    }
                }
            });
        }
    }

    /**
     * 执行来自 Webview 的命令，并记录到命令历史中。
     * 这里既支持本扩展提供的命令（如 git-graph.view），也支持 VS Code 内置命令。
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

    /**
     * 根据配置或 VS Code 语言环境确定 webview 语言
     */
    private getLanguage(): 'en' | 'zh-CN' {
        const langConfig = vscode.workspace.getConfiguration('gitly');
        const inspected = langConfig.inspect<string>('language');
        const userLang = inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;

        const source = typeof userLang === 'string' && userLang.trim() !== ''
            ? userLang
            : (vscode.env.language || '');

        const normalised = source.toLowerCase();
        return normalised.startsWith('zh') ? 'zh-CN' : 'en';
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
        try {
            const uncommitted = await this.dataSource.getUncommittedDetails(repo);
            const details = uncommitted.commitDetails;
            if (!details) {
                return { status: undefined, conflicts: undefined };
            }

            const files = details.fileChanges || [];
            const status: GitStatusForWeb = {
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
                files: []
            };

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

            return {
                status,
                // 返回空数组表示“已检测，无冲突”，避免前端一直停留在“Checking for conflicts...”
                conflicts
            };
        } catch {
            return { status: undefined, conflicts: [] };
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
            vscode.window.showInformationMessage('当前只支持修改远程名称，如需修改 URL 请使用 Git Graph 配置界面。');
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
}


