import * as vscode from 'vscode';
import { GitService } from '../services/git-service';

/**
 * 分支树项
 */
export class BranchTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly branchName: string,
        public readonly isCurrent: boolean,
        public readonly isRemote: boolean,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);

        this.tooltip = branchName;
        this.contextValue = isRemote ? 'remoteBranch' : 'localBranch';

        if (isCurrent) {
            this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'));
            this.description = '当前';
        } else if (isRemote) {
            this.iconPath = new vscode.ThemeIcon('cloud');
        } else {
            this.iconPath = new vscode.ThemeIcon('git-branch');
        }
    }
}

/**
 * 分支数据提供者
 */
export class BranchProvider implements vscode.TreeDataProvider<BranchTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BranchTreeItem | undefined | null | void> =
        new vscode.EventEmitter<BranchTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BranchTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    // 内存缓存：缓存分支数据和树项，避免重复获取和创建
    private _cachedBranches: { data: any; timestamp: number } | null = null;
    private _cachedLocalItems: BranchTreeItem[] | null = null;
    private _cachedRemoteItems: BranchTreeItem[] | null = null;
    private readonly CACHE_TTL = 3000; // 缓存3秒

    constructor(private gitService: GitService) { }

    refresh(): void {
        // 清除缓存，确保下次获取最新数据
        this._cachedBranches = null;
        this._cachedLocalItems = null;
        this._cachedRemoteItems = null;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BranchTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * 获取分支数据（带缓存）
     */
    private async _getBranchesData(): Promise<{ branches: any; currentBranch: string | null }> {
        const now = Date.now();

        // 检查缓存是否有效
        if (this._cachedBranches && (now - this._cachedBranches.timestamp) < this.CACHE_TTL) {
            return this._cachedBranches.data;
        }

        // 从 GitService 获取（GitService 也有缓存）
        const branches = await this.gitService.getBranches();
        const currentBranch = branches.current;

        // 更新缓存
        this._cachedBranches = {
            data: { branches, currentBranch },
            timestamp: now
        };

        return { branches, currentBranch };
    }

    async getChildren(element?: BranchTreeItem): Promise<BranchTreeItem[]> {
        if (!element) {
            // 根节点：显示本地分支和远程分支分组
            return [
                new BranchTreeItem(
                    '本地分支',
                    'local',
                    false,
                    false,
                    vscode.TreeItemCollapsibleState.Expanded
                ),
                new BranchTreeItem(
                    '远程分支',
                    'remote',
                    false,
                    true,
                    vscode.TreeItemCollapsibleState.Collapsed
                )
            ];
        }

        try {
            // 使用缓存获取分支数据
            const { branches, currentBranch } = await this._getBranchesData();

            if (element.branchName === 'local') {
                // 检查本地分支缓存
                if (this._cachedLocalItems) {
                    return this._cachedLocalItems;
                }

                // 本地分支
                const localItems = branches.all
                    .filter((b: string) => !b.startsWith('remotes/'))
                    .map((branch: string) => {
                        const isCurrent = branch === currentBranch;
                        return new BranchTreeItem(
                            branch,
                            branch,
                            isCurrent,
                            false,
                            vscode.TreeItemCollapsibleState.None,
                            {
                                command: 'git-assistant.switchBranch',
                                title: '切换分支',
                                arguments: [branch]
                            }
                        );
                    });

                // 缓存本地分支项
                this._cachedLocalItems = localItems;
                return localItems;
            } else if (element.branchName === 'remote') {
                // 检查远程分支缓存
                if (this._cachedRemoteItems) {
                    return this._cachedRemoteItems;
                }

                // 远程分支
                const remoteItems = branches.all
                    .filter((b: string) => b.startsWith('remotes/'))
                    .map((branch: string) => {
                        const displayName = branch.replace('remotes/', '');
                        return new BranchTreeItem(
                            displayName,
                            branch,
                            false,
                            true,
                            vscode.TreeItemCollapsibleState.None
                        );
                    });

                // 缓存远程分支项
                this._cachedRemoteItems = remoteItems;
                return remoteItems;
            }

            return [];
        } catch (error) {
            vscode.window.showErrorMessage(`获取分支列表失败: ${error}`);
            return [];
        }
    }
}

