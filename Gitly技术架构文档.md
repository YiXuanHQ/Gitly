# Gitly 技术架构文档

## 一、目录
1. [项目概述](#项目概述)
2. [侧边栏（Sidebar）技术实现](#侧边栏sidebar技术实现)
3. [可视化面板（Assistant Panel）技术实现](#可视化面板assistant-panel技术实现)
4. [Git 视图表（Git Graph View）技术实现](#git-视图表git-graph-view技术实现)
5. [前后端通信机制](#前后端通信机制)
6. [技术栈总结](#技术栈总结)

---

## 二、项目概述

Gitly 是一个 VS Code 扩展，提供 Git 仓库的可视化管理和操作功能。项目采用前后端分离架构，后端运行在 VS Code Extension Host 进程中，前端运行在 Webview 或 Sidebar 中。

### 核心技术
- **后端语言**: TypeScript
- **前端框架**: 原生 JavaScript/TypeScript（Git Graph View）、原生 TypeScript + 自定义组件系统（Assistant Panel）
- **VS Code API**: vscode.window.createWebviewPanel、vscode.window.registerTreeDataProvider
- **通信协议**: postMessage API
- **图形渲染**: SVG（Git Graph View）、Canvas（Assistant Panel 的提交图谱组件）

---

## 三、侧边栏（Sidebar）技术实现

### 后端实现

#### 技术栈
- **API**: `vscode.TreeDataProvider<T>`
- **语言**: TypeScript
- **文件位置**: `src/sidebarViews.ts`

#### 实现类

##### 1. BranchSidebarProvider（分支侧边栏）

```typescript
export class BranchSidebarProvider implements vscode.TreeDataProvider<SimpleTreeItem>
```

**核心特性**：
- 实现 `vscode.TreeDataProvider` 接口
- 提供 `getTreeItem()` 和 `getChildren()` 方法
- 使用事件发射器 `EventEmitter` 通知数据变化
- 实现缓存机制（BRANCH_CACHE_TTL = 3000ms）

**数据流程**：
```
RepoManager.onDidChangeRepos()
  ↓
BranchSidebarProvider.refresh()
  ↓
_onDidChangeTreeData.fire(null)
  ↓
VS Code 调用 getChildren()
  ↓
loadBranchInfo() → DataSource.getRepoInfo()
  ↓
buildBranchGroups() / buildBranchesForGroup()
  ↓
返回 SimpleTreeItem[] 数组
```

**关键代码片段**：
```typescript:95:147:src/sidebarViews.ts
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
		this._onDidChangeTreeData.fire(null);
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
```

##### 2. HistorySidebarProvider（历史提交侧边栏）

**核心特性**：
- 显示最近 50 条提交记录
- 支持相对时间格式化（formatRelativeTime）
- 缓存机制（HISTORY_CACHE_TTL = 3000ms）
- 点击提交可打开 Git Graph View

**数据获取**：
```typescript:381:446:src/sidebarViews.ts
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
```

##### 3. ConflictSidebarProvider（冲突文件侧边栏）

**核心特性**：
- 实时检测冲突文件（通过文件内容扫描）
- 检测冲突标记：`<<<<<<<`、`=======`、`>>>>>>>`
- 点击文件可直接打开编辑器

**冲突检测逻辑**：
```typescript:615:637:src/sidebarViews.ts
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
```

#### 注册机制

在 `src/extension.ts` 中注册：

```typescript:172:184:src/extension.ts
		// 注册侧边栏 TreeDataProvider
		vscode.window.registerTreeDataProvider(
			'gitly.sidebar.branches',
			branchSidebarProvider
		),
		vscode.window.registerTreeDataProvider(
			'gitly.sidebar.history',
			historySidebarProvider
		),
		vscode.window.registerTreeDataProvider(
			'gitly.sidebar.conflicts',
			conflictSidebarProvider
		),
```

### 前端实现

#### 技术栈
- **UI 框架**: VS Code 原生 TreeView 组件
- **渲染引擎**: VS Code 内置（基于 DOM）
- **配置**: `package.json` 中的 `views` 配置

#### package.json 配置

```json:335:353:package.json
		"views": {
			"gitly-sidebar": [
				{
					"id": "gitly.sidebar.branches",
					"name": "%gitly.sidebar.branches%",
					"icon": "resources/icon.png"
				},
				{
					"id": "gitly.sidebar.history",
					"name": "%gitly.sidebar.history%",
					"icon": "resources/icon.png"
				},
				{
					"id": "gitly.sidebar.conflicts",
					"name": "%gitly.sidebar.conflicts%",
					"icon": "resources/icon.png"
				}
			]
		},
```

#### TreeItem 实现

```typescript:59:74:src/sidebarViews.ts
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
```

**TreeItem 属性设置示例**：
```typescript:257:289:src/sidebarViews.ts
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
```

---

## 四、可视化面板（Assistant Panel）技术实现

### 后端实现

#### 技术栈
- **API**: `vscode.window.createWebviewPanel`
- **语言**: TypeScript
- **文件位置**: `src/assistantPanel.ts`

#### 核心类：AssistantPanel

```typescript:35:85:src/assistantPanel.ts
export class AssistantPanel {
	private panel: vscode.WebviewPanel | null = null;
	private currentRepo: string | null = null;
	private isPanelVisible: boolean = true; // 跟踪面板可见性状态，借鉴 gitGraphView.ts 的策略
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
			// 如果面板已经可见，直接刷新数据；如果从隐藏变为可见，onDidChangeViewState 会处理
			if (this.isPanelVisible) {
				this.sendInitialData();
			}
			return;
		}

		const vscodeLanguage = vscode.env.language;
		const normalizedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
		const panelTitle = normalizedLanguage === 'zh-CN' ? 'Gitly 可视化页面' : 'Gitly Visual Panel';

		this.panel = vscode.window.createWebviewPanel(
			'gitly-assistant',
			panelTitle,
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
```

#### Webview HTML 生成

```typescript:258:284:src/assistantPanel.ts
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
            '<title>Gitly 可视化页面</title>' +
            '</head>' +
            '<body>' +
            '<div id="root"></div>' +
            '<script>window.gitlyLanguage = "' + normalisedLanguage + '";</script>' +
            '<script type="module" src="' + scriptUri + '"></script>' +
            '</body>' +
            '</html>';
	}
```

#### 消息处理机制

```typescript:112:253:src/assistantPanel.ts
		this.panel.webview.onDidReceiveMessage(async (msg) => {
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
				case 'clearConflictHistory':
					ConflictHistory.clear();
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
				case 'resolveConflicts':
					if (Array.isArray(msg.files) && typeof msg.action === 'string') {
						const files = msg.files.filter((x: unknown) => typeof x === 'string') as string[];
						void this.resolveConflicts(files, msg.action as 'current' | 'incoming' | 'both');
					}
					break;
				case 'initRepo':
					try {
						// 执行初始化命令（命令内部会记录命令历史）
						await this.initRepository(msg.path || null);
						// 等待一小段时间确保初始化完成
						await new Promise(resolve => setTimeout(resolve, 500));
						// 初始化成功后，强制刷新数据
						await this.sendInitialData();
					} catch (error) {
						// 如果初始化失败，刷新以显示错误状态
						const errorMessage = error instanceof Error ? error.message : String(error);
						vscode.window.showErrorMessage(`初始化失败: ${errorMessage}`);
						await this.sendInitialData();
					}
					break;
				case 'cloneRepo':
					try {
						await this.cloneRepository(msg.url || '', msg.path || null);
						// 等待一小段时间确保克隆完成
						await new Promise(resolve => setTimeout(resolve, 500));
						// 克隆成功后，强制刷新数据
						await this.sendInitialData();
					} catch (error) {
						// 如果克隆失败，刷新以显示错误状态
						const errorMessage = error instanceof Error ? error.message : String(error);
						vscode.window.showErrorMessage(`克隆失败: ${errorMessage}`);
						await this.sendInitialData();
					}
					break;
				case 'rescanForRepos':
					void this.rescanForRepos();
					break;
				default:
					break;
			}
		});
```

#### 数据发送机制

```typescript:298:545:src/assistantPanel.ts
	public async sendInitialData() {
		if (!this.panel) return;

		const vscodeLanguage = vscode.env.language;
		const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

		// 首先尝试获取仓库列表
		let repos = this.repoManager.getRepos();
		let repo = this.getActiveRepo(repos);

		// ... 仓库检测和验证逻辑 ...

		// 构建 Git 数据
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
	}
```

### 前端实现

#### 技术栈
- **框架**: 原生 TypeScript + 自定义组件系统（非 React）
- **DOM 操作**: 原生 DOM API（createElement、innerHTML 等）
- **构建工具**: TypeScript Compiler
- **文件位置**: `web/assistant/`

#### 目录结构

```
web/assistant/
├── app.ts              # 主应用入口
├── index.ts            # 模块入口
├── components/         # 自定义组件（原生 TS）
│   ├── branch-tree.ts
│   ├── command-history.ts
│   ├── commit-graph.ts
│   ├── conflict-editor.ts
│   ├── git-command-reference.ts
│   ├── heatmap-analysis.ts
│   ├── remote-manager.ts
│   ├── tag-manager.ts
│   └── timeline-view.ts
├── styles/
│   └── main.css        # 样式文件
├── types/
│   └── git.ts          # TypeScript 类型定义
└── utils/
    ├── dom-utils.ts
    ├── theme.ts
    └── url.ts
```

#### 消息监听

前端通过 `acquireVsCodeApi()` 获取 VS Code API，监听后端消息：

```typescript
const vscode = acquireVsCodeApi();

window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
        case 'gitData':
            // 更新 UI
            updateUI(message.data);
            break;
    }
});
```

---

## 五、Git 视图表（Git Graph View）技术实现

### 后端实现

#### 技术栈
- **API**: `vscode.window.createWebviewPanel`
- **语言**: TypeScript
- **文件位置**: `src/gitGraphView.ts`

#### 核心类：GitGraphView

```typescript:18:167:src/gitGraphView.ts
/**
 * Manages the Git Graph View.
 */
export class GitGraphView extends Disposable {
	public static currentPanel: GitGraphView | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly extensionPath: string;
	private readonly avatarManager: AvatarManager;
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly repoFileWatcher: RepoFileWatcher;
	private readonly repoManager: RepoManager;
	private readonly logger: Logger;
	private isGraphViewLoaded: boolean = false;
	private isPanelVisible: boolean = true;
	private currentRepo: string | null = null;
	private loadViewTo: LoadGitGraphViewTo = null; // Is used by the next call to getHtmlForWebview, and is then reset to null

	private loadRepoInfoRefreshId: number = 0;
	private loadCommitsRefreshId: number = 0;

	/**
	 * If a Git Graph View already exists, show and update it. Otherwise, create a Git Graph View.
	 * @param extensionPath The absolute file path of the directory containing the extension.
	 * @param dataSource The Git Graph DataSource instance.
	 * @param extensionState The Git Graph ExtensionState instance.
	 * @param avatarManger The Git Graph AvatarManager instance.
	 * @param repoManager The Git Graph RepoManager instance.
	 * @param logger The Git Graph Logger instance.
	 * @param loadViewTo What to load the view to.
	 */
	public static createOrShow(extensionPath: string, dataSource: DataSource, extensionState: ExtensionState, avatarManager: AvatarManager, repoManager: RepoManager, logger: Logger, loadViewTo: LoadGitGraphViewTo) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		if (GitGraphView.currentPanel) {
			// If Git Graph panel already exists
			if (GitGraphView.currentPanel.isPanelVisible) {
				// If the Git Graph panel is visible
				if (loadViewTo !== null) {
					GitGraphView.currentPanel.respondLoadRepos(repoManager.getRepos(), loadViewTo);
				}
			} else {
				// If the Git Graph panel is not visible
				GitGraphView.currentPanel.loadViewTo = loadViewTo;
			}
			GitGraphView.currentPanel.panel.reveal(column);
		} else {
			// If Git Graph panel doesn't already exist
			GitGraphView.currentPanel = new GitGraphView(extensionPath, dataSource, extensionState, avatarManager, repoManager, logger, loadViewTo, column);
		}
	}
```

#### Webview 创建

```typescript:79:166:src/gitGraphView.ts
	private constructor(extensionPath: string, dataSource: DataSource, extensionState: ExtensionState, avatarManager: AvatarManager, repoManager: RepoManager, logger: Logger, loadViewTo: LoadGitGraphViewTo, column: vscode.ViewColumn | undefined) {
		super();
		this.extensionPath = extensionPath;
		this.avatarManager = avatarManager;
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.repoManager = repoManager;
		this.logger = logger;
		this.loadViewTo = loadViewTo;

		const config = getConfig();
		const vscodeLanguage = vscode.env.language;
		const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
		this.panel = vscode.window.createWebviewPanel('git-graph', normalisedLanguage === 'zh-CN' ? 'Gitly 视图表页面' : 'Git Graph', column || vscode.ViewColumn.One, {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))],
			retainContextWhenHidden: config.retainContextWhenHidden
		});
		this.panel.iconPath = config.tabIconColourTheme === TabIconColourTheme.Colour
			? this.getResourcesUri('webview-icon.svg')
			: {
				light: this.getResourcesUri('webview-icon-light.svg'),
				dark: this.getResourcesUri('webview-icon-dark.svg')
			};


		this.registerDisposables(
			// Dispose Git Graph View resources when disposed
			toDisposable(() => {
				GitGraphView.currentPanel = undefined;
				this.repoFileWatcher.stop();
			}),

			// Dispose this Git Graph View when the Webview Panel is disposed
			this.panel.onDidDispose(() => this.dispose()),

			// Register a callback that is called when the view is shown or hidden
			this.panel.onDidChangeViewState(() => {
				if (this.panel.visible !== this.isPanelVisible) {
					if (this.panel.visible) {
						this.update();
					} else {
						this.currentRepo = null;
						this.repoFileWatcher.stop();
					}
					this.isPanelVisible = this.panel.visible;
				}
			}),

			// Subscribe to events triggered when a repository is added or deleted from Git Graph
			repoManager.onDidChangeRepos((event) => {
				if (!this.panel.visible) return;
				const loadViewTo = event.loadRepo !== null ? { repo: event.loadRepo } : null;
				if ((event.numRepos === 0 && this.isGraphViewLoaded) || (event.numRepos > 0 && !this.isGraphViewLoaded)) {
					this.loadViewTo = loadViewTo;
					this.update();
				} else {
					this.respondLoadRepos(event.repos, loadViewTo);
				}
			}),

			// Subscribe to events triggered when an avatar is available
			avatarManager.onAvatar((event) => {
				this.sendMessage({
					command: 'fetchAvatar',
					email: event.email,
					image: event.image
				});
			}),

			// Respond to messages sent from the Webview
			this.panel.webview.onDidReceiveMessage((msg) => this.respondToMessage(msg)),

			// Dispose the Webview Panel when disposed
			this.panel
		);

		// Instantiate a RepoFileWatcher that watches for file changes in the repository currently open in the Git Graph View
		this.repoFileWatcher = new RepoFileWatcher(logger, () => {
			if (this.panel.visible) {
				this.sendMessage({ command: 'refresh' });
			}
		});

		// Render the content of the Webview
		this.update();

		this.logger.log('Created Git Graph View' + (loadViewTo !== null ? ' (active repo: ' + loadViewTo.repo + ')' : ''));
	}
```

#### HTML 生成

```typescript:699:827:src/gitGraphView.ts
	private getHtmlForWebview() {
		const config = getConfig();
		const nonce = getNonce();
		const vscodeLanguage = vscode.env.language;
		const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
		const initialState: GitGraphViewInitialState = {
			config: {
				commitDetailsView: config.commitDetailsView,
				commitOrdering: config.commitOrder,
				contextMenuActionsVisibility: config.contextMenuActionsVisibility,
				customBranchGlobPatterns: config.customBranchGlobPatterns,
				customEmojiShortcodeMappings: config.customEmojiShortcodeMappings,
				customPullRequestProviders: config.customPullRequestProviders,
				dateFormat: config.dateFormat,
				defaultColumnVisibility: config.defaultColumnVisibility,
				dialogDefaults: config.dialogDefaults,
				enhancedAccessibility: config.enhancedAccessibility,
				fetchAndPrune: config.fetchAndPrune,
				fetchAndPruneTags: config.fetchAndPruneTags,
				fetchAvatars: config.fetchAvatars && this.extensionState.isAvatarStorageAvailable(),
				graph: config.graph,
				includeCommitsMentionedByReflogs: config.includeCommitsMentionedByReflogs,
				initialLoadCommits: config.initialLoadCommits,
				keybindings: config.keybindings,
				language: normalisedLanguage,
				loadMoreCommits: config.loadMoreCommits,
				loadMoreCommitsAutomatically: config.loadMoreCommitsAutomatically,
				markdown: config.markdown,
				mute: config.muteCommits,
				onlyFollowFirstParent: config.onlyFollowFirstParent,
				onRepoLoad: config.onRepoLoad,
				referenceLabels: config.referenceLabels,
				repoDropdownOrder: config.repoDropdownOrder,
				showRemoteBranches: config.showRemoteBranches,
				showStashes: config.showStashes,
				showTags: config.showTags
			},
			lastActiveRepo: this.extensionState.getLastActiveRepo(),
			loadViewTo: this.loadViewTo,
			repos: this.repoManager.getRepos(),
			loadRepoInfoRefreshId: this.loadRepoInfoRefreshId,
			loadCommitsRefreshId: this.loadCommitsRefreshId
		};
		const globalState = this.extensionState.getGlobalViewState();
		const workspaceState = this.extensionState.getWorkspaceViewState();
		const webT = getWebTranslations(normalisedLanguage);

		let body: string;
		let numRepos = Object.keys(initialState.repos).length;
		let colorVars = '';
		let colorParams = '';
		for (let i = 0; i < initialState.config.graph.colours.length; i++) {
			colorVars += '--git-graph-color' + i + ':' + initialState.config.graph.colours[i] + '; ';
			colorParams += '[data-color="' + i + '"]{--git-graph-color:var(--git-graph-color' + i + ');} ';
		}

		if (this.dataSource.isGitExecutableUnknown()) {
			body = `<body class="unableToLoad">
			<h2>${normalisedLanguage === 'zh-CN' ? '无法加载 Gitly 视图表页面' : 'Unable to load Git Graph'}</h2>
			<p class="unableToLoadMessage">${UNABLE_TO_FIND_GIT_MSG}</p>
			</body>`;
		} else if (numRepos > 0) {
			body = `<body>
			<div id="view" tabindex="-1">
				<div id="controls">
					<span id="repoControl"><span class="unselectable">${webT.labelRepo}</span><div id="repoDropdown" class="dropdown"></div></span>
					<span id="branchControl"><span class="unselectable">${webT.labelBranches}</span><div id="branchDropdown" class="dropdown"></div></span>
					<label id="showRemoteBranchesControl"><input type="checkbox" id="showRemoteBranchesCheckbox" tabindex="-1"><span class="customCheckbox"></span>${webT.checkboxShowRemoteBranches}</label>
					<div id="findBtn" title="${webT.buttonSearch}"></div>
					<div id="terminalBtn" title="${webT.buttonTerminal}"></div>
					<div id="settingsBtn" title="${webT.buttonSettings}"></div>
					<div id="fetchBtn" title="${webT.buttonFetch}"></div>
					<div id="refreshBtn" title="${webT.buttonRefresh}"></div>
				</div>
				<div id="content">
					<div id="commitGraph"></div>
					<div id="commitTable"></div>
				</div>
				<div id="footer"></div>
			</div>
			<div id="scrollShadow"></div>
			<script nonce="${nonce}">var initialState = ${JSON.stringify(initialState)}, globalState = ${JSON.stringify(globalState)}, workspaceState = ${JSON.stringify(workspaceState)};</script>
			<script nonce="${nonce}" src="${this.getMediaUri('out.min.js')}"></script>
			</body>`;
		} else {
			const initText = normalisedLanguage === 'zh-CN' ? '初始化 Git 仓库' : 'Initialize Git Repository';
			const cloneText = normalisedLanguage === 'zh-CN' ? '克隆远程仓库' : 'Clone Remote Repository';
			const messageText = normalisedLanguage === 'zh-CN'
				? '当前工作区未找到 Git 仓库。请选择以下操作之一来初始化仓库：'
				: 'No Git repositories were found in the current workspace. Please choose one of the following actions to initialize a repository:';
			body = `<body class="unableToLoad">
			<h2>${normalisedLanguage === 'zh-CN' ? 'Git 仓库未初始化' : 'Git Repository Not Initialized'}</h2>
			<p class="unableToLoadMessage">${messageText}</p>
			<div style="display: flex; gap: 12px; margin: 20px 0; justify-content: center;">
				<div id="initRepoBtn" class="roundedBtn" style="padding: 12px 24px; cursor: pointer; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px;">${initText}</div>
				<div id="cloneRepoBtn" class="roundedBtn" style="padding: 12px 24px; cursor: pointer; background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 2px;">${cloneText}</div>
			</div>
			<p style="margin-top: 20px;"><div id="rescanForReposBtn" class="roundedBtn">${normalisedLanguage === 'zh-CN' ? '重新扫描工作区' : 'Re-scan the current workspace for repositories'}</div></p>
			<script nonce="${nonce}">(function(){ 
				var api = acquireVsCodeApi(); 
				document.getElementById('initRepoBtn').addEventListener('click', function(){ 
					api.postMessage({command: 'initRepo', path: null}); 
				}); 
				document.getElementById('cloneRepoBtn').addEventListener('click', function(){ 
					api.postMessage({command: 'cloneRepo', url: '', path: null}); 
				}); 
				document.getElementById('rescanForReposBtn').addEventListener('click', function(){ 
					api.postMessage({command: 'rescanForRepos'}); 
				}); 
			})();</script>
			</body>`;
		}
		this.isGraphViewLoaded = numRepos > 0;
		this.loadViewTo = null;

		const htmlLang = normalisedLanguage === 'zh-CN' ? 'zh-CN' : 'en';
		return `<!DOCTYPE html>
			<html lang="${htmlLang}">
				<head>
					<meta charset="UTF-8">
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${standardiseCspSource(this.panel.webview.cspSource)} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:;">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<link rel="stylesheet" type="text/css" href="${this.getMediaUri('out.min.js')}">
					<title>Git Graph</title>
					<style>body{${colorVars}} ${colorParams}</style>
				</head>
				${body}
			</html>`;
	}
```

### 前端实现

#### 技术栈
- **语言**: TypeScript（编译为 JavaScript）
- **渲染**: 原生 DOM API
- **图形库**: SVG（graph.ts）
- **文件位置**: `web/main.ts`、`web/graph.ts`

#### 核心类：GitGraphView（前端）

```typescript:322:487:web/main.ts
class GitGraphView {
	private gitRepos: GG.GitRepoSet;
	private gitBranches: ReadonlyArray<string> = [];
	private gitBranchHead: string | null = null;
	private gitConfig: GG.GitRepoConfig | null = null;
	private gitRemotes: ReadonlyArray<string> = [];
	private gitStashes: ReadonlyArray<GG.GitStash> = [];
	private gitTags: ReadonlyArray<string> = [];
	private commits: GG.GitCommit[] = [];
	private commitHead: string | null = null;
	private commitLookup: { [hash: string]: number } = {};
	private onlyFollowFirstParent: boolean = false;
	private avatars: AvatarImageCollection = {};
	private currentBranches: string[] | null = null;

	private currentRepo!: string;
	private currentRepoLoading: boolean = true;
	private currentRepoRefreshState: {
		inProgress: boolean;
		hard: boolean;
		loadRepoInfoRefreshId: number;
		loadCommitsRefreshId: number;
		repoInfoChanges: boolean;
		configChanges: boolean;
		requestingRepoInfo: boolean;
		requestingConfig: boolean;
	};
	private loadViewTo: GG.LoadGitGraphViewTo = null;

	private readonly graph: Graph;
	private readonly config: Config;

	private moreCommitsAvailable: boolean = false;
	private expandedCommit: ExpandedCommit | null = null;
	private maxCommits: number;
	private scrollTop = 0;
	private renderedGitBranchHead: string | null = null;

	private lastScrollToStash: {
		time: number,
		hash: string | null
	} = { time: 0, hash: null };

	private readonly findWidget: FindWidget;
	private readonly settingsWidget: SettingsWidget;
	private readonly repoDropdown: Dropdown;
	private readonly branchDropdown: Dropdown;

	private readonly viewElem: HTMLElement;
	private readonly controlsElem: HTMLElement;
	private readonly tableElem: HTMLElement;
	private readonly footerElem: HTMLElement;
	private readonly showRemoteBranchesElem: HTMLInputElement;
	private readonly refreshBtnElem: HTMLElement;
	private readonly scrollShadowElem: HTMLElement;

	constructor(viewElem: HTMLElement, prevState: WebViewState | null) {
		this.gitRepos = initialState.repos;
		this.config = initialState.config;
		this.maxCommits = this.config.initialLoadCommits;
		// Expose language to assistant webview i18n via global variable
		(window as any).gitlyLanguage = this.config.language === 'zh-CN' ? 'zh-CN' : 'en';
		this.viewElem = viewElem;
		this.currentRepoRefreshState = {
			inProgress: false,
			hard: true,
			loadRepoInfoRefreshId: initialState.loadRepoInfoRefreshId,
			loadCommitsRefreshId: initialState.loadCommitsRefreshId,
			repoInfoChanges: false,
			configChanges: false,
			requestingRepoInfo: false,
			requestingConfig: false
		};

		this.controlsElem = document.getElementById('controls')!;
		this.tableElem = document.getElementById('commitTable')!;
		this.footerElem = document.getElementById('footer')!;
		this.scrollShadowElem = <HTMLInputElement>document.getElementById('scrollShadow')!;

		viewElem.focus();

		this.graph = new Graph('commitGraph', viewElem, this.config.graph, this.config.mute);

		this.repoDropdown = new Dropdown('repoDropdown', true, false, webT('dropdown.repos'), (values) => {
			this.loadRepo(values[0]);
		});

		this.branchDropdown = new Dropdown('branchDropdown', false, true, webT('dropdown.branches'), (values) => {
			this.currentBranches = values;
			this.maxCommits = this.config.initialLoadCommits;
			this.saveState();
			this.clearCommits();
			this.requestLoadRepoInfoAndCommits(true, true);
		});

		this.showRemoteBranchesElem = <HTMLInputElement>document.getElementById('showRemoteBranchesCheckbox')!;
		this.showRemoteBranchesElem.addEventListener('change', () => {
			this.saveRepoStateValue(this.currentRepo, 'showRemoteBranchesV2', this.showRemoteBranchesElem.checked ? GG.BooleanOverride.Enabled : GG.BooleanOverride.Disabled);
			this.refresh(true);
		});

		this.refreshBtnElem = document.getElementById('refreshBtn')!;
		this.refreshBtnElem.addEventListener('click', () => {
			if (!this.refreshBtnElem.classList.contains(CLASS_REFRESHING)) {
				this.refresh(true, true);
			}
		});
		this.renderRefreshButton();

		this.findWidget = new FindWidget(this);
		this.settingsWidget = new SettingsWidget(this);

		alterClass(document.body, CLASS_BRANCH_LABELS_ALIGNED_TO_GRAPH, this.config.referenceLabels.branchLabelsAlignedToGraph);
		alterClass(document.body, CLASS_TAG_LABELS_RIGHT_ALIGNED, this.config.referenceLabels.tagLabelsOnRight);

		this.observeWindowSizeChanges();
		this.observeWebviewStyleChanges();
		this.observeViewScroll();
		this.observeKeyboardEvents();
		this.observeUrls();
		this.observeTableEvents();

		if (prevState && !prevState.currentRepoLoading && typeof this.gitRepos[prevState.currentRepo] !== 'undefined') {
			this.currentRepo = prevState.currentRepo;
			this.currentBranches = prevState.currentBranches;
			this.maxCommits = prevState.maxCommits;
			this.expandedCommit = prevState.expandedCommit;
			this.avatars = prevState.avatars;
			this.gitConfig = prevState.gitConfig;
			this.loadRepoInfo(prevState.gitBranches, prevState.gitBranchHead, prevState.gitRemotes, prevState.gitStashes, true);
			this.loadCommits(prevState.commits, prevState.commitHead, prevState.gitTags, prevState.moreCommitsAvailable, prevState.onlyFollowFirstParent);
			this.findWidget.restoreState(prevState.findWidget);
			this.settingsWidget.restoreState(prevState.settingsWidget);
			this.showRemoteBranchesElem.checked = getShowRemoteBranches(this.gitRepos[prevState.currentRepo].showRemoteBranchesV2);
		}

		let loadViewTo = initialState.loadViewTo;
		if (loadViewTo === null && prevState && prevState.currentRepoLoading && typeof prevState.currentRepo !== 'undefined') {
			loadViewTo = { repo: prevState.currentRepo };
		}

		if (!this.loadRepos(this.gitRepos, initialState.lastActiveRepo, loadViewTo)) {
			if (prevState) {
				this.scrollTop = prevState.scrollTop;
				this.viewElem.scroll(0, this.scrollTop);
			}
			this.requestLoadRepoInfoAndCommits(false, false);
		}

		const fetchBtn = document.getElementById('fetchBtn')!, findBtn = document.getElementById('findBtn')!, settingsBtn = document.getElementById('settingsBtn')!, terminalBtn = document.getElementById('terminalBtn')!;
		fetchBtn.title = this.config.fetchAndPrune ? webT('button.fetchWithPrune') : webT('button.fetch');
		fetchBtn.innerHTML = SVG_ICONS.download;
		fetchBtn.addEventListener('click', () => this.fetchFromRemotesAction());
		findBtn.innerHTML = SVG_ICONS.search;
		findBtn.addEventListener('click', () => this.findWidget.show(true));
		settingsBtn.innerHTML = SVG_ICONS.gear;
		settingsBtn.addEventListener('click', () => this.settingsWidget.show(this.currentRepo));
		terminalBtn.innerHTML = SVG_ICONS.terminal;
		terminalBtn.addEventListener('click', () => {
			runAction({
				command: 'openTerminal',
				repo: this.currentRepo,
				name: this.gitRepos[this.currentRepo].name || getRepoName(this.currentRepo)
			}, 'Opening Terminal');
		});
	}
```

#### 图形渲染：Graph 类

```typescript:1:100:web/graph.ts
const CLASS_GRAPH_VERTEX_ACTIVE = 'graphVertexActive';
const NULL_VERTEX_ID = -1;


/* Types */

interface Point {
	readonly x: number;
	readonly y: number;
}
interface Line {
	readonly p1: Point;
	readonly p2: Point;
	readonly lockedFirst: boolean; // TRUE => The line is locked to p1, FALSE => The line is locked to p2
}

interface Pixel {
	x: number;
	y: number;
}
interface PlacedLine {
	readonly p1: Pixel;
	readonly p2: Pixel;
	readonly isCommitted: boolean;
	readonly lockedFirst: boolean; // TRUE => The line is locked to p1, FALSE => The line is locked to p2
}

interface UnavailablePoint {
	readonly connectsTo: VertexOrNull;
	readonly onBranch: Branch;
}

type VertexOrNull = Vertex | null;


/* Branch Class */

class Branch {
	private readonly colour: number;
	private end: number = 0;
	private lines: Line[] = [];
	private numUncommitted: number = 0;

	constructor(colour: number) {
		this.colour = colour;
	}

	public addLine(p1: Point, p2: Point, isCommitted: boolean, lockedFirst: boolean) {
		this.lines.push({ p1: p1, p2: p2, lockedFirst: lockedFirst });
		if (isCommitted) {
			if (p2.x === 0 && p2.y < this.numUncommitted) this.numUncommitted = p2.y;
		} else {
			this.numUncommitted++;
		}
	}


	/* Get / Set */

	public getColour() {
		return this.colour;
	}

	public getEnd() {
		return this.end;
	}

	public setEnd(end: number) {
		this.end = end;
	}


	/* Rendering */

	public draw(svg: SVGElement, config: GG.GraphConfig, expandAt: number) {
		let colour = config.colours[this.colour % config.colours.length], i, x1, y1, x2, y2, lines: PlacedLine[] = [], curPath = '', d = config.grid.y * (config.style === GG.GraphStyle.Angular ? 0.38 : 0.8), line, nextLine;

		// Convert branch lines into pixel coordinates, respecting expanded commit extensions
		for (i = 0; i < this.lines.length; i++) {
			line = this.lines[i];
			x1 = line.p1.x * config.grid.x + config.grid.offsetX; y1 = line.p1.y * config.grid.y + config.grid.offsetY;
			x2 = line.p2.x * config.grid.x + config.grid.offsetX; y2 = line.p2.y * config.grid.y + config.grid.offsetY;

			// If a commit is expanded, we need to stretch the graph for the height of the commit details view
			if (expandAt > -1) {
				if (line.p1.y > expandAt) { // If the line starts after the expansion, move the whole line lower
					y1 += config.grid.expandY;
					y2 += config.grid.expandY;
				} else if (line.p2.y > expandAt) { // If the line crosses the expansion
					if (x1 === x2) { // The line is vertical, extend the endpoint past the expansion
						y2 += config.grid.expandY;
					} else if (line.lockedFirst) { // If the line is locked to the first point, the transition stays in its normal position
						lines.push({ p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, isCommitted: i >= this.numUncommitted, lockedFirst: line.lockedFirst }); // Display the normal transition
						lines.push({ p1: { x: x2, y: y1 + config.grid.y }, p2: { x: x2, y: y2 + config.grid.expandY }, isCommitted: i >= this.numUncommitted, lockedFirst: line.lockedFirst }); // Extend the line over the expansion from the transition end point
						continue;
					} else { // If the line is locked to the second point, the transition moves to after the expansion
						lines.push({ p1: { x: x1, y: y1 }, p2: { x: x1, y: y2 - config.grid.y + config.grid.expandY }, isCommitted: i >= this.numUncommitted, lockedFirst: line.lockedFirst }); // Extend the line over the expansion to the new transition start point
						y1 += config.grid.expandY; y2 += config.grid.expandY;
					}
				}
```

**图形渲染特性**：
- 使用 SVG 路径（Path）绘制分支线
- 支持圆角（rounded）和直角（angular）两种样式
- 动态计算分支位置，避免重叠
- 支持提交详情展开时的图形拉伸

---

## 六、前后端通信机制

### 通信协议

#### 1. Webview → Extension Host（前端 → 后端）

使用 `webview.postMessage()`：

```typescript
// 前端
const vscode = acquireVsCodeApi();
vscode.postMessage({
    command: 'loadCommits',
    repo: 'path/to/repo',
    branches: ['main', 'develop'],
    maxCommits: 100
});
```

#### 2. Extension Host → Webview（后端 → 前端）

使用 `webview.onDidReceiveMessage()`：

```typescript
// 后端
this.panel.webview.onDidReceiveMessage((msg) => {
    switch (msg.command) {
        case 'loadCommits':
            // 处理请求
            const commits = await this.dataSource.getCommits(...);
            // 发送响应
            this.panel.webview.postMessage({
                command: 'loadCommits',
                commits: commits,
                refreshId: msg.refreshId
            });
            break;
    }
});
```

### 消息类型定义

#### RequestMessage（前端 → 后端）

```typescript
interface RequestMessage {
    command: string;
    repo?: string;
    [key: string]: any;
}
```

常见命令：
- `loadRepos`: 加载仓库列表
- `loadRepoInfo`: 加载仓库信息
- `loadCommits`: 加载提交列表
- `commitDetails`: 获取提交详情
- `checkoutBranch`: 切换分支
- `merge`: 合并分支
- `pushBranch`: 推送分支
- `fetch`: 获取远程更新
- `refresh`: 刷新视图

#### ResponseMessage（后端 → 前端）

```typescript
interface ResponseMessage {
    command: string;
    [key: string]: any;
}
```

常见响应：
- `loadRepos`: 返回仓库列表
- `loadRepoInfo`: 返回仓库信息（分支、远程、标签等）
- `loadCommits`: 返回提交列表
- `commitDetails`: 返回提交详情
- `error`: 错误信息

### 通信流程图

```
前端 Webview                    Extension Host
     │                                │
     │── postMessage(request) ──────>│
     │                                │ 处理请求
     │                                │ 执行 Git 命令
     │                                │ 查询数据
     │<── postMessage(response) ─────│
     │                                │
     │ 更新 UI                        │
```

### 状态同步机制

#### 1. 文件监听（RepoFileWatcher）

```typescript
// 监听 .git/HEAD 和 refs/heads/** 的变化
this.repoFileWatcher = new RepoFileWatcher(logger, () => {
    if (this.panel.visible) {
        this.sendMessage({ command: 'refresh' });
    }
});
```

#### 2. 事件驱动更新

```typescript
// 仓库变化事件
repoManager.onDidChangeRepos((event) => {
    if (!this.panel.visible) return;
    const loadViewTo = event.loadRepo !== null ? { repo: event.loadRepo } : null;
    if ((event.numRepos === 0 && this.isGraphViewLoaded) || (event.numRepos > 0 && !this.isGraphViewLoaded)) {
        this.loadViewTo = loadViewTo;
        this.update();
    } else {
        this.respondLoadRepos(event.repos, loadViewTo);
    }
});
```

---

## 七、技术栈总结

### 后端技术栈

| 技术 | 用途 | 文件位置 |
|------|------|----------|
| TypeScript | 主要开发语言 | `src/` |
| VS Code API | 扩展 API | `vscode` 模块 |
| TreeDataProvider | 侧边栏数据提供 | `src/sidebarViews.ts` |
| WebviewPanel | Webview 面板 | `src/gitGraphView.ts`, `src/assistantPanel.ts` |
| EventEmitter | 事件系统 | `src/utils/event.ts` |
| child_process | Git 命令执行 | `src/dataSource.ts` |
| iconv-lite | 字符编码转换 | `src/dataSource.ts` |

### 前端技术栈

#### Git Graph View

| 技术 | 用途 | 文件位置 |
|------|------|----------|
| TypeScript | 开发语言 | `web/main.ts` |
| 原生 DOM API | UI 操作 | `web/main.ts` |
| SVG | 图形渲染 | `web/graph.ts` |
| CSS | 样式 | `web/styles/` |

#### Assistant Panel

| 技术 | 用途 | 文件位置 |
|------|------|----------|
| TypeScript | 开发语言 | `web/assistant/` |
| 原生 DOM API | UI 操作 | `web/assistant/components/` |
| Canvas | 提交图谱渲染 | `web/assistant/components/commit-graph.ts` |
| CSS | 样式 | `web/assistant/styles/` |

### 构建工具

| 工具 | 用途 |
|------|------|
| TypeScript Compiler | 编译 TypeScript |
| VS Code Extension API | 扩展运行时环境 |
| Webpack（推测） | 前端资源打包 |

### 数据流

```
Git 仓库
  ↓
DataSource (执行 Git 命令)
  ↓
RepoManager (管理仓库状态)
  ↓
Extension Host (后端)
  ↓
postMessage API
  ↓
Webview / Sidebar (前端)
  ↓
用户界面
```

---

## 八、总结

Gitly 项目采用了典型的 VS Code 扩展架构：

1. **侧边栏**：使用 VS Code 原生 TreeView API，无需前端框架，性能优秀
2. **可视化面板**：使用 WebviewPanel + 原生 TypeScript + 自定义组件系统，提供丰富的交互功能（提交图谱使用 Canvas 渲染）
3. **Git 视图表**：使用 WebviewPanel + 原生 TypeScript + SVG，实现高性能的图形渲染

前后端通过 `postMessage` API 进行通信，实现了良好的解耦和扩展性。项目充分利用了 VS Code 的扩展 API，提供了完整的 Git 仓库管理和可视化功能。

