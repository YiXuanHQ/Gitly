import * as vscode from 'vscode';
import { GitService } from '../services/git-service';
import { DefaultLogFields } from 'simple-git';

/**
 * 提交历史树项
 */
export class CommitTreeItem extends vscode.TreeItem {
    constructor(
        public readonly commit: DefaultLogFields,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(commit.message.split('\n')[0], collapsibleState);

        this.description = `${commit.author_name} · ${this.formatDate(commit.date)}`;
        this.tooltip = this.createTooltip();
        this.contextValue = 'commit';
        this.iconPath = new vscode.ThemeIcon('git-commit');

        // 点击显示提交详情
        this.command = {
            command: 'git-assistant.showCommitDetails',
            title: '查看提交详情',
            arguments: [commit]
        };
    }

    private formatDate(date: string): string {
        const commitDate = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - commitDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return '刚刚';
        } else if (diffMins < 60) {
            return `${diffMins}分钟前`;
        } else if (diffHours < 24) {
            return `${diffHours}小时前`;
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else {
            return commitDate.toLocaleDateString('zh-CN');
        }
    }

    private createTooltip(): string {
        return [
            `提交: ${this.commit.hash.substring(0, 8)}`,
            `作者: ${this.commit.author_name} <${this.commit.author_email}>`,
            `日期: ${new Date(this.commit.date).toLocaleString('zh-CN')}`,
            ``,
            `${this.commit.message}`
        ].join('\n');
    }
}

/**
 * 提交历史数据提供者
 */
export class HistoryProvider implements vscode.TreeDataProvider<CommitTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommitTreeItem | undefined | null | void> =
        new vscode.EventEmitter<CommitTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CommitTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    constructor(private gitService: GitService) {
        // 注册查看提交详情命令
        vscode.commands.registerCommand('git-assistant.showCommitDetails', (commit: DefaultLogFields) => {
            this.showCommitDetails(commit);
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CommitTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CommitTreeItem): Promise<CommitTreeItem[]> {
        if (element) {
            return [];
        }

        try {
            const config = vscode.workspace.getConfiguration('git-assistant');
            const maxCount = config.get<number>('maxHistoryCount', 100);

            const log = await this.gitService.getLog(maxCount);

            return log.all.map(commit =>
                new CommitTreeItem(commit, vscode.TreeItemCollapsibleState.None)
            );
        } catch (error) {
            vscode.window.showErrorMessage(`获取提交历史失败: ${error}`);
            return [];
        }
    }

    /**
     * 显示提交详情
     */
    private async showCommitDetails(commit: DefaultLogFields) {
        const panel = vscode.window.createWebviewPanel(
            'commitDetails',
            `提交详情: ${commit.hash.substring(0, 8)}`,
            vscode.ViewColumn.One,
            {}
        );

        panel.webview.html = this.getCommitDetailsHtml(commit);
    }

    /**
     * 生成提交详情HTML
     */
    private getCommitDetailsHtml(commit: DefaultLogFields): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    .header {
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .hash {
                        font-family: monospace;
                        background: var(--vscode-textCodeBlock-background);
                        padding: 2px 6px;
                        border-radius: 3px;
                    }
                    .label {
                        color: var(--vscode-descriptionForeground);
                        font-weight: bold;
                        margin-top: 15px;
                    }
                    .message {
                        white-space: pre-wrap;
                        background: var(--vscode-textBlockQuote-background);
                        padding: 10px;
                        border-radius: 4px;
                        margin-top: 5px;
                    }
                    .files {
                        margin-top: 20px;
                    }
                    .file {
                        padding: 5px;
                        margin: 5px 0;
                        background: var(--vscode-list-hoverBackground);
                        border-radius: 3px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>提交详情</h2>
                    <div><span class="label">哈希:</span> <span class="hash">${commit.hash}</span></div>
                </div>
                <div class="label">作者:</div>
                <div>${commit.author_name} &lt;${commit.author_email}&gt;</div>
                <div class="label">日期:</div>
                <div>${new Date(commit.date).toLocaleString('zh-CN')}</div>
                <div class="label">提交信息:</div>
                <div class="message">${commit.message}</div>
                <div class="files">
                    <div class="label">提交哈希:</div>
                    <div class="file">${commit.hash}</div>
                </div>
            </body>
            </html>
        `;
    }
}

