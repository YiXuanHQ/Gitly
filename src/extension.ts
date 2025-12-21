import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { CommandManager } from './commands';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { DiffDocProvider } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { onStartUp } from './life-cycle/startup';
import { Logger } from './logger';
import { RepoManager } from './repoManager';
import { StatusBarItem } from './statusBarItem';
import {
	GitExecutable,
	UNABLE_TO_FIND_GIT_MSG,
	findGit,
	getGitExecutableFromPaths,
	showErrorMessage,
	showInformationMessage
} from './utils';
import { EventEmitter } from './utils/event';
import {
	BranchSidebarProvider,
	HistorySidebarProvider,
	ConflictSidebarProvider,
	StagedSidebarProvider
} from './sidebarViews';
import { AssistantPanel } from './assistantPanel';
import { AssistantCommandHistory } from './assistantCommandHistory';
import { ConflictHistory } from './conflictHistory';
import { registerAssistantCommands } from './assistantCommands';

/**
 * Activate Gitly.
 * @param context The context of the extension.
 */
export async function activate(context: vscode.ExtensionContext) {
	const logger = new Logger();
	logger.log('Starting Gitly ...');

	const gitExecutableEmitter = new EventEmitter<GitExecutable>();
	const onDidChangeGitExecutable = gitExecutableEmitter.subscribe;

	const extensionState = new ExtensionState(context, onDidChangeGitExecutable);

	// 初始化 Assistant 命令历史存储
	AssistantCommandHistory.initialize(context);
	// 初始化冲突解决历史存储
	ConflictHistory.initialize(context);

	let gitExecutable: GitExecutable | null;
	try {
		gitExecutable = await findGit(extensionState);
		gitExecutableEmitter.emit(gitExecutable);
		logger.log('Using ' + gitExecutable.path + ' (version: ' + gitExecutable.version + ')');
	} catch (_) {
		gitExecutable = null;
		showErrorMessage(UNABLE_TO_FIND_GIT_MSG);
		logger.logError(UNABLE_TO_FIND_GIT_MSG);
	}

	const configurationEmitter = new EventEmitter<vscode.ConfigurationChangeEvent>();
	const onDidChangeConfiguration = configurationEmitter.subscribe;

	const dataSource = new DataSource(
		gitExecutable,
		onDidChangeConfiguration,
		onDidChangeGitExecutable,
		logger
	);
	const avatarManager = new AvatarManager(dataSource, extensionState, logger);
	const repoManager = new RepoManager(
		dataSource,
		extensionState,
		onDidChangeConfiguration,
		logger
	);

	// 尝试获取 VS Code Git 扩展 API，用于监听暂存区变化
	let gitApi: any | null = null;
	try {
		const gitExt: any = vscode.extensions.getExtension('vscode.git');
		if (gitExt) {
			const gitExtension: any = gitExt.isActive ? gitExt.exports : await gitExt.activate();
			gitApi = gitExtension && typeof gitExtension.getAPI === 'function' ? gitExtension.getAPI(1) : gitExtension;
		}
	} catch {
		// 如果获取不到 Git API，不影响其他功能，暂存区视图将仅依赖手动刷新
		gitApi = null;
	}

	const statusBarItem = new StatusBarItem(
		repoManager.getNumRepos(),
		repoManager.onDidChangeRepos,
		onDidChangeConfiguration,
		logger
	);
	const commandManager = new CommandManager(
		context,
		avatarManager,
		dataSource,
		extensionState,
		repoManager,
		gitExecutable,
		onDidChangeGitExecutable,
		logger
	);
	const diffDocProvider = new DiffDocProvider(dataSource);

	// 侧边栏 TreeDataProvider
	const branchSidebarProvider = new BranchSidebarProvider(
		repoManager,
		dataSource,
		extensionState
	);
	const historySidebarProvider = new HistorySidebarProvider(
		repoManager,
		dataSource,
		extensionState
	);
	const stagedSidebarProvider = new StagedSidebarProvider(
		repoManager,
		dataSource,
		extensionState,
		gitApi
	);
	const conflictSidebarProvider = new ConflictSidebarProvider(
		repoManager,
		dataSource,
		extensionState
	);

	// Assistant 面板
	const assistantPanel = new AssistantPanel(
		context.extensionPath,
		repoManager,
		dataSource,
		extensionState
	);

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(
			DiffDocProvider.scheme,
			diffDocProvider
		),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('git-graph')) {
				configurationEmitter.emit(event);
			} else if (event.affectsConfiguration('git.path')) {
				const paths = getConfig().gitPaths;
				if (paths.length === 0) return;

				getGitExecutableFromPaths(paths).then(
					(gitExecutable) => {
						gitExecutableEmitter.emit(gitExecutable);
						const msg =
							'Git Graph is now using ' +
							gitExecutable.path +
							' (version: ' +
							gitExecutable.version +
							')';
						showInformationMessage(msg);
						logger.log(msg);
						repoManager.searchWorkspaceForRepos();
					},
					() => {
						const msg =
							'The new value of "git.path" ("' +
							paths.join('", "') +
							'") does not ' +
							(paths.length > 1
								? 'contain a string that matches'
								: 'match') +
							' the path and filename of a valid Git executable.';
						showErrorMessage(msg);
						logger.logError(msg);
					}
				);
			}
		}),
		diffDocProvider,
		commandManager,
		statusBarItem,
		repoManager,
		avatarManager,
		dataSource,
		configurationEmitter,
		extensionState,
		gitExecutableEmitter,
		logger,

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
			'gitly.sidebar.staged',
			stagedSidebarProvider
		),
		vscode.window.registerTreeDataProvider(
			'gitly.sidebar.conflicts',
			conflictSidebarProvider
		),

		// 侧边栏刷新命令
		vscode.commands.registerCommand('gitly.sidebar.refreshBranches', () => {
			branchSidebarProvider.refresh();
		}),
		vscode.commands.registerCommand('gitly.sidebar.refreshHistory', () => {
			historySidebarProvider.refresh();
		}),
		vscode.commands.registerCommand('gitly.sidebar.refreshStaged', () => {
			stagedSidebarProvider.refresh();
		}),
		vscode.commands.registerCommand('gitly.sidebar.refreshConflicts', () => {
			conflictSidebarProvider.refresh();
		}),

		// 从侧边栏打开 Git Graph 主视图
		vscode.commands.registerCommand('gitly.sidebar.openGitGraph', () => {
			void vscode.commands.executeCommand('gitly.view');
		}),

		// 从侧边栏切换分支
		vscode.commands.registerCommand(
			'gitly.sidebar.checkoutBranch',
			async (item: any) => {
				if (!item || typeof item !== 'object' || !item.repo) return;

				const repo: string = item.repo;
				const rawName: string | undefined =
					(item.data && item.data.branchName) || item.label;
				if (!rawName) return;

				let localBranch = rawName;
				let remoteBranch: string | null = null;
				let displayName = rawName;

				// 支持远程分支：remotes/origin/feature/xxx
				if (rawName.startsWith('remotes/')) {
					const withoutPrefix = rawName.replace(/^remotes\//, '');
					displayName = withoutPrefix;
					const parts = withoutPrefix.split('/');
					if (parts.length >= 2) {
						const remote = parts.shift()!; // origin
						const short = parts.join('/'); // feature/xxx
						localBranch = short;
						remoteBranch = `${remote}/${short}`;
					}
				}

				// 显示确认对话框
				const confirm = await vscode.window.showWarningMessage(
					`是否切换到分支 "${displayName}"？`,
					{ modal: true },
					'是',
					'否'
				);

				if (confirm !== '是') {
					return;
				}

				const error = await dataSource.checkoutBranch(repo, localBranch, remoteBranch);
				if (error !== null) {
					vscode.window.showErrorMessage(error);
				} else {
					vscode.window.showInformationMessage(
						`已切换到分支 "${displayName}"`
					);
					branchSidebarProvider.refresh();
					historySidebarProvider.refresh();
					conflictSidebarProvider.refresh();
				}
			}
		)
	);

	// 激活扩展后自动切换到 Gitly 侧边栏视图容器
	void vscode.commands.executeCommand('workbench.view.extension.gitly-sidebar');

	// Assistant 面板命令
	context.subscriptions.push(
		vscode.commands.registerCommand('gitly.openAssistant', () => {
			assistantPanel.show();
		})
	);

	// 确保 Assistant 面板相关资源在扩展卸载时释放
	context.subscriptions.push(assistantPanel);

	// Assistant 快捷指令（git-assistant.*）
	registerAssistantCommands(context, repoManager, dataSource, extensionState, assistantPanel);

	logger.log('Started Git Graph - Ready to use!');

	extensionState.expireOldCodeReviews();
	onStartUp(context).catch(() => { });
}

/**
 * Deactivate Git Graph.
 */
export function deactivate() { }