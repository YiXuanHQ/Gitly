import * as vscode from 'vscode';
import * as path from 'path';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { RepoManager } from './repoManager';
import { GitCommit, GitFileChange, GitFileStatus, GitRepoSet } from './types';
import { getConfig } from './config';
import { getRepoName } from './utils';
import { t } from './i18n';

interface SidebarContext {
    readonly repo: string;
    readonly repoName: string;
}

type BranchGroup = 'local' | 'remote';
type BranchInfo = { branches: string[]; head: string | null };
type TreeItemData = {
    branchGroup?: BranchGroup;
    branchName?: string;
    commitHash?: string;
    filePath?: string;
    fileStatus?: GitFileStatus;
};

const BRANCH_CACHE_TTL = 3000;
const HISTORY_CACHE_TTL = 3000;

// 这些常量已不再使用，冲突侧边栏只显示冲突文件
// const FILE_STATUS_LABEL: Partial<Record<GitFileStatus, string>> = {
//     A: 'Added',
//     M: 'Modified',
//     D: 'Deleted',
//     R: 'Renamed',
//     U: 'Untracked'
// };

// const FILE_STATUS_ICON: Partial<Record<GitFileStatus, string>> = {
//     A: 'diff-added',
//     M: 'diff-modified',
//     D: 'diff-removed',
//     R: 'diff-renamed',
//     U: 'circle-large-outline'
// };

function formatRelativeTime(date: number): string {
    const diff = Date.now() - date;
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;

    if (diff < minute) return 'just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
    return new Date(date).toLocaleDateString();
}

class SimpleTreeItem extends vscode.TreeItem {
    public readonly repo: string;
    public readonly data?: TreeItemData;

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.None,
        repo: string = '',
        data?: TreeItemData
    ) {
        super(label, collapsibleState);
        this.repo = repo;
        this.data = data;
    }
}

function getActiveRepo(
    repos: GitRepoSet,
    extensionState: ExtensionState
): SidebarContext | null {
    const repoPaths = Object.keys(repos);
    if (repoPaths.length === 0) return null;

    const lastActive = extensionState.getLastActiveRepo();
    if (lastActive && typeof repos[lastActive] !== 'undefined') {
        return {
            repo: lastActive,
            repoName: repos[lastActive].name || getRepoName(lastActive)
        };
    }

    const first = repoPaths[0];
    return { repo: first, repoName: repos[first].name || getRepoName(first) };
}

export class BranchSidebarProvider implements vscode.TreeDataProvider<SimpleTreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<
        SimpleTreeItem | undefined | null
    >();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private branchCache: {
        repo: string;
        showRemoteBranches: boolean;
        hideRemotes: ReadonlyArray<string>;
        info: BranchInfo;
        timestamp: number;
    } | null = null;

    constructor(
        private readonly repoManager: RepoManager,
        private readonly dataSource: DataSource,
        private readonly extensionState: ExtensionState
    ) {
        this.repoManager.onDidChangeRepos(() => this.refresh());
    }

    public refresh(): void {
        this.branchCache = null;
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: SimpleTreeItem): vscode.TreeItem {
        return element;
    }

    public getChildren(
        element?: SimpleTreeItem
    ): vscode.ProviderResult<SimpleTreeItem[]> {
        const repos = this.repoManager.getRepos();
        const ctx = getActiveRepo(repos, this.extensionState);
        if (!ctx) {
            return [new SimpleTreeItem(t('sidebar.noRepos'))];
        }

        if (!element) {
            return this.buildBranchGroups(ctx, repos[ctx.repo]);
        }

        if (element.data?.branchGroup) {
            return this.buildBranchesForGroup(
                ctx,
                repos[ctx.repo],
                element.data.branchGroup
            );
        }

        return [];
    }

    private async loadBranchInfo(
        ctx: SidebarContext,
        repoState: any
    ): Promise<BranchInfo> {
        const hideRemotes = repoState.hideRemotes || [];
        const now = Date.now();
        const cacheValid =
            this.branchCache &&
            this.branchCache.repo === ctx.repo &&
            this.branchCache.showRemoteBranches ===
            repoState.showRemoteBranches &&
            this.branchCache.hideRemotes.join('|') === hideRemotes.join('|') &&
            now - this.branchCache.timestamp < BRANCH_CACHE_TTL;

        if (cacheValid) {
            return this.branchCache!.info;
        }

        const info = await this.dataSource
            .getRepoInfo(
                ctx.repo,
                repoState.showRemoteBranches,
                false,
                hideRemotes
            )
            .then(
                (res) =>
                    ({
                        branches: res.branches || [],
                        head: res.head || null
                    }) as BranchInfo
            )
            .catch(() => ({ branches: [], head: null }) as BranchInfo);

        this.branchCache = {
            repo: ctx.repo,
            showRemoteBranches: repoState.showRemoteBranches,
            hideRemotes,
            info,
            timestamp: now
        };

        return info;
    }

    private async buildBranchGroups(
        ctx: SidebarContext,
        repoState: any
    ): Promise<SimpleTreeItem[]> {
        const info = await this.loadBranchInfo(ctx, repoState);
        const localCount = info.branches.filter(
            (b) => !b.startsWith('remotes/')
        ).length;
        const remoteCount = info.branches.length - localCount;

        const localGroup = new SimpleTreeItem(
            `${ctx.repoName}: ${t('sidebar.branches.local')}`,
            vscode.TreeItemCollapsibleState.Expanded,
            ctx.repo,
            { branchGroup: 'local' }
        );
        localGroup.description = `${localCount}`;
        localGroup.contextValue = 'git-graph-branch-group-local';
        localGroup.iconPath = new (vscode as any).ThemeIcon('repo');

        const groups: SimpleTreeItem[] = [localGroup];

        if (repoState.showRemoteBranches) {
            const remoteGroup = new SimpleTreeItem(
                `${ctx.repoName}: ${t('sidebar.branches.remote')}`,
                vscode.TreeItemCollapsibleState.Collapsed,
                ctx.repo,
                { branchGroup: 'remote' }
            );
            remoteGroup.description = `${remoteCount}`;
            remoteGroup.contextValue = 'git-graph-branch-group-remote';
            remoteGroup.iconPath = new (vscode as any).ThemeIcon('cloud');
            groups.push(remoteGroup);
        }

        return groups;
    }

    private async buildBranchesForGroup(
        ctx: SidebarContext,
        repoState: any,
        group: BranchGroup
    ): Promise<SimpleTreeItem[]> {
        const info = await this.loadBranchInfo(ctx, repoState);
        const branches =
            group === 'local'
                ? info.branches.filter((b) => !b.startsWith('remotes/'))
                : info.branches.filter((b) => b.startsWith('remotes/'));

        if (branches.length === 0) {
            const label =
                group === 'local'
                    ? `${ctx.repoName}: ${t('sidebar.branches.noLocal')}`
                    : `${ctx.repoName}: ${t('sidebar.branches.noRemote')}`;
            return [
                new SimpleTreeItem(
                    label,
                    vscode.TreeItemCollapsibleState.None,
                    ctx.repo
                )
            ];
        }

        return branches.map((name) => {
            const displayName =
                group === 'remote' ? name.replace(/^remotes\//, '') : name;
            const item = new SimpleTreeItem(
                displayName,
                vscode.TreeItemCollapsibleState.None,
                ctx.repo,
                { branchName: name }
            );
            item.description = name === info.head ? t('sidebar.branches.current') : '';
            item.tooltip = name;
            item.contextValue =
                group === 'remote'
                    ? 'git-graph-branch-remote'
                    : 'git-graph-branch-local';
            item.iconPath =
                name === info.head
                    ? new (vscode as any).ThemeIcon(
                        'check',
                        new vscode.ThemeColor(
                            'gitDecoration.modifiedResourceForeground'
                        )
                    )
                    : group === 'remote'
                        ? new (vscode as any).ThemeIcon('cloud')
                        : new (vscode as any).ThemeIcon('git-branch');
            item.command = {
                title: t('sidebar.branches.checkout'),
                command: 'gitly.sidebar.checkoutBranch',
                arguments: [item]
            };
            return item;
        });
    }
}

export class HistorySidebarProvider implements vscode.TreeDataProvider<SimpleTreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<
        SimpleTreeItem | undefined | null
    >();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private historyCache: {
        repo: string;
        commits: GitCommit[];
        timestamp: number;
    } | null = null;

    constructor(
        private readonly repoManager: RepoManager,
        private readonly dataSource: DataSource,
        private readonly extensionState: ExtensionState
    ) {
        this.repoManager.onDidChangeRepos(() => this.refresh());
    }

    public refresh(): void {
        this.historyCache = null;
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: SimpleTreeItem): vscode.TreeItem {
        return element;
    }

    public getChildren(
        element?: SimpleTreeItem
    ): vscode.ProviderResult<SimpleTreeItem[]> {
        const repos = this.repoManager.getRepos();
        const ctx = getActiveRepo(repos, this.extensionState);
        if (!ctx) {
            return [new SimpleTreeItem(t('sidebar.noRepos'))];
        }

        if (element) {
            return [];
        }

        const repoState = repos[ctx.repo];
        const globalConfig = getConfig();

        return this.loadCommits(ctx, repoState, globalConfig).then(
            (commits) => {
                if (commits.length === 0) {
                    const empty = new SimpleTreeItem(
                        ctx.repoName + ': ' + t('sidebar.history.noCommits'),
                        vscode.TreeItemCollapsibleState.None,
                        ctx.repo
                    );
                    return [empty];
                }

                return commits.map((c: GitCommit) => {
                    const label = c.message || c.hash;
                    const item = new SimpleTreeItem(
                        label,
                        vscode.TreeItemCollapsibleState.None,
                        ctx.repo,
                        { commitHash: c.hash }
                    );
                    item.description = `${c.hash.substring(0, 7)} · ${c.author || ''
                        } · ${formatRelativeTime(c.date * 1000)}`;
                    item.tooltip = `${c.message}\n\n${new Date(
                        c.date * 1000
                    ).toLocaleString()} - ${c.hash}`;
                    item.contextValue = 'git-graph-history-commit';
                    item.iconPath = new (vscode as any).ThemeIcon('git-commit');
                    item.command = {
                        title: t('sidebar.history.openGraph'),
                        command: 'gitly.sidebar.openGitGraph',
                        arguments: []
                    };
                    return item;
                });
            },
            () => [
                new SimpleTreeItem(
                    t('sidebar.history.unableToLoad'),
                    vscode.TreeItemCollapsibleState.None,
                    ctx.repo
                )
            ]
        );
    }

    private async loadCommits(
        ctx: SidebarContext,
        repoState: any,
        globalConfig: ReturnType<typeof getConfig>
    ): Promise<GitCommit[]> {
        const includeCommitsMentionedByReflogs =
            repoState.includeCommitsMentionedByReflogs === 1
                ? true
                : repoState.includeCommitsMentionedByReflogs === 2
                    ? false
                    : globalConfig.includeCommitsMentionedByReflogs;

        const onlyFollowFirstParent =
            repoState.onlyFollowFirstParent === 1
                ? true
                : repoState.onlyFollowFirstParent === 2
                    ? false
                    : globalConfig.onlyFollowFirstParent;

        const showStashes =
            repoState.showStashes === 1
                ? true
                : repoState.showStashes === 2
                    ? false
                    : globalConfig.showStashes;

        const showRemoteBranches = repoState.showRemoteBranches;
        const hideRemotes = repoState.hideRemotes || [];

        const now = Date.now();
        if (
            this.historyCache &&
            this.historyCache.repo === ctx.repo &&
            now - this.historyCache.timestamp < HISTORY_CACHE_TTL
        ) {
            return this.historyCache.commits;
        }

        const info = await this.dataSource.getRepoInfo(
            ctx.repo,
            showRemoteBranches,
            showStashes,
            hideRemotes
        );
        const commitData = await this.dataSource.getCommits(
            ctx.repo,
            null,
            50,
            repoState.showTags === 1
                ? true
                : repoState.showTags === 2
                    ? false
                    : globalConfig.showTags,
            showRemoteBranches,
            includeCommitsMentionedByReflogs,
            onlyFollowFirstParent,
            globalConfig.commitOrder,
            info.remotes,
            hideRemotes,
            info.stashes
        );

        const commits = commitData.commits || [];
        this.historyCache = { repo: ctx.repo, commits, timestamp: now };
        return commits;
    }
}

export class ConflictSidebarProvider implements vscode.TreeDataProvider<SimpleTreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<
        SimpleTreeItem | undefined | null
    >();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private readonly repoManager: RepoManager,
        private readonly dataSource: DataSource,
        private readonly extensionState: ExtensionState
    ) {
        this.repoManager.onDidChangeRepos(() => this.refresh());
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: SimpleTreeItem): vscode.TreeItem {
        return element;
    }

    public getChildren(
        element?: SimpleTreeItem
    ): vscode.ProviderResult<SimpleTreeItem[]> {
        if (element) {
            return [];
        }

        const repos = this.repoManager.getRepos();
        const ctx = getActiveRepo(repos, this.extensionState);
        if (!ctx) {
            return [new SimpleTreeItem(t('sidebar.noRepos'))];
        }

        return this.dataSource.getUncommittedDetails(ctx.repo).then(
            async (details) => {
                const commitDetails = details.commitDetails;

                if (
                    !commitDetails ||
                    !commitDetails.fileChanges ||
                    commitDetails.fileChanges.length === 0
                ) {
                    const clean = new SimpleTreeItem(
                        ctx.repoName + ': ' + t('sidebar.conflicts.noConflicts'),
                        vscode.TreeItemCollapsibleState.None,
                        ctx.repo
                    );
                    clean.iconPath = new (vscode as any).ThemeIcon(
                        'check',
                        new vscode.ThemeColor('testing.iconPassed')
                    );
                    clean.contextValue = 'git-graph-conflict-clean';
                    return [clean];
                }

                // 检测冲突文件：检查文件内容中是否包含冲突标记
                const conflictFiles: Array<{ filePath: string; fc: GitFileChange }> = [];
                
                for (const fc of commitDetails.fileChanges) {
                    const filePath = fc.newFilePath || fc.oldFilePath;
                    try {
                        const fullPath = path.isAbsolute(filePath) 
                            ? filePath 
                            : path.join(ctx.repo, filePath);
                        const fileUri = vscode.Uri.file(fullPath);
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        const content = document.getText();
                        
                        // 检查是否包含冲突标记
                        if (content.includes('<<<<<<<') && 
                            content.includes('=======') && 
                            content.includes('>>>>>>>')) {
                            conflictFiles.push({ filePath, fc });
                        }
                    } catch {
                        // 如果无法读取文件（可能已删除），跳过冲突检测
                    }
                }

                // 如果没有冲突文件，显示"当前没有冲突"
                if (conflictFiles.length === 0) {
                    const clean = new SimpleTreeItem(
                        ctx.repoName + ': ' + t('sidebar.conflicts.noConflicts'),
                        vscode.TreeItemCollapsibleState.None,
                        ctx.repo
                    );
                    clean.iconPath = new (vscode as any).ThemeIcon(
                        'check',
                        new vscode.ThemeColor('testing.iconPassed')
                    );
                    clean.contextValue = 'git-graph-conflict-clean';
                    return [clean];
                }

                // 只显示有冲突的文件
                return conflictFiles.map(({ filePath, fc }) => {
                    const item = new SimpleTreeItem(
                        filePath,
                        vscode.TreeItemCollapsibleState.None,
                        ctx.repo,
                        { filePath, fileStatus: fc.type }
                    );

                    item.description = t('sidebar.conflicts.conflict');
                    item.tooltip = `${t('sidebar.conflicts.conflictFile')} · ${filePath}`;
                    item.iconPath = new (vscode as any).ThemeIcon('warning');
                    item.contextValue = 'git-graph-conflict-file';
                    // 点击打开文件
                    item.command = {
                        command: 'vscode.open',
                        title: t('sidebar.conflicts.openFile'),
                        arguments: [vscode.Uri.file(path.isAbsolute(filePath) ? filePath : path.join(ctx.repo, filePath))]
                    };
                    return item;
                });
            },
            () => [
                new SimpleTreeItem(
                    t('sidebar.conflicts.unableToLoad'),
                    vscode.TreeItemCollapsibleState.None,
                    ctx.repo
                )
            ]
        );
    }
}