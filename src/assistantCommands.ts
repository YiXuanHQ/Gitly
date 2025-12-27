import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { RepoManager } from './repoManager';
import { BooleanOverride, CommitOrdering, GitPushBranchMode, GitRepoSet, GitResetMode, MergeActionOn, RepoCommitOrdering, TagType } from './types';
import { getRepoName } from './utils';

// VS Code Git 扩展 API 在此文件中通过 `any` 使用，避免引入额外类型依赖

function getTagNamesFromCommits(commits: ReadonlyArray<any> | undefined): string[] {
	if (!commits) return [];
	const set = new Set<string>();
	for (let i = 0; i < commits.length; i++) {
		const c = commits[i];
		const tags = c && c.tags ? c.tags : [];
		for (let j = 0; j < tags.length; j++) {
			const t = tags[j];
			if (t && typeof t.name === 'string') set.add(t.name);
		}
	}
	return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function resolveBooleanOverride(override: BooleanOverride, fallback: boolean): boolean {
	if (override === BooleanOverride.Enabled) return true;
	if (override === BooleanOverride.Disabled) return false;
	return fallback;
}

function toCommitOrdering(ordering: RepoCommitOrdering, defaultOrdering: CommitOrdering): CommitOrdering {
	if (ordering === RepoCommitOrdering.Date) return CommitOrdering.Date;
	if (ordering === RepoCommitOrdering.AuthorDate) return CommitOrdering.AuthorDate;
	if (ordering === RepoCommitOrdering.Topological) return CommitOrdering.Topological;
	return defaultOrdering;
}

function getActiveRepo(repos: GitRepoSet, extensionState: ExtensionState): string | null {
	const repoPaths = Object.keys(repos);
	if (repoPaths.length === 0) return null;

	const lastActive = extensionState.getLastActiveRepo();
	if (lastActive && typeof repos[lastActive] !== 'undefined') {
		return lastActive;
	}
	return repoPaths[0];
}

async function ensureRepo(repoManager: RepoManager, extensionState: ExtensionState): Promise<string | null> {
	const repos = repoManager.getRepos();
	const repo = getActiveRepo(repos, extensionState);
	if (!repo) {
		vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
		return null;
	}
	return repo;
}

async function getRepoContext(repoManager: RepoManager, extensionState: ExtensionState, dataSource: DataSource) {
	const repos = repoManager.getRepos();
	const repo = getActiveRepo(repos, extensionState);
	if (!repo) return null;

	const repoState = repos[repo];
	const config = getConfig();

	const includeCommitsMentionedByReflogs = resolveBooleanOverride(
		repoState.includeCommitsMentionedByReflogs,
		config.includeCommitsMentionedByReflogs
	);
	const onlyFollowFirstParent = resolveBooleanOverride(
		repoState.onlyFollowFirstParent,
		config.onlyFollowFirstParent
	);
	const showStashes = resolveBooleanOverride(repoState.showStashes, config.showStashes);
	const showRemoteBranches = repoState.showRemoteBranches;
	const hideRemotes = repoState.hideRemotes || [];

	const repoInfo = await dataSource.getRepoInfo(repo, showRemoteBranches, showStashes, hideRemotes);
	const commitOrdering = toCommitOrdering(repoState.commitOrdering, config.commitOrder);
	const commitData = await dataSource.getCommits(
		repo,
		null,
		Math.max(1, config.initialLoadCommits),
		resolveBooleanOverride(repoState.showTags, config.showTags),
		showRemoteBranches,
		includeCommitsMentionedByReflogs,
		onlyFollowFirstParent,
		commitOrdering,
		repoInfo.remotes,
		hideRemotes,
		repoInfo.stashes
	);

	return {
		repo,
		repoName: repoState.name || getRepoName(repo),
		repoInfo,
		commitData
	};
}

async function executeBuiltinGitCommand(commandId: string) {
	const all = await vscode.commands.getCommands(true);
	if (!all.includes(commandId)) {
		vscode.window.showErrorMessage(`未找到 VS Code 内置 Git 命令：${commandId}。请确认已启用内置 Git 扩展。`);
		return;
	}
	await vscode.commands.executeCommand(commandId);
}

async function pickRemote(repo: string, dataSource: DataSource, placeHolder: string): Promise<string | null> {
	const repoInfo = await dataSource.getRepoInfo(repo, true, false, []);
	const remotes = (repoInfo.remotes || []).slice();
	if (remotes.length === 0) {
		vscode.window.showErrorMessage('当前仓库未配置远程仓库。');
		return null;
	}
	const picked = await vscode.window.showQuickPick(remotes, { placeHolder });
	return picked || null;
}

async function checkUnmergedFiles(repoPath: string): Promise<string[]> {
	return new Promise<string[]>((resolve, reject) => {
		// 使用 git ls-files -u 检查未合并的文件
		// 然后检查这些文件是否已经在暂存区中
		// 只报告未暂存的冲突文件
		const git = cp.spawn('git', ['ls-files', '-u'], {
			cwd: repoPath,
			env: process.env
		});

		let stdout = '';
		git.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		git.on('close', (code) => {
			if (code === 0 && stdout.trim()) {
				// 解析未合并的文件列表（git ls-files -u 输出格式：stage mode hash path）
				const lines = stdout.trim().split('\n');
				const unmergedFilesSet = new Set<string>();
				
				for (const line of lines) {
					if (line.trim()) {
						const parts = line.trim().split(/\s+/);
						if (parts.length >= 4) {
							const filePath = parts.slice(3).join(' ');
							unmergedFilesSet.add(filePath);
						}
					}
				}
				
				// 检查这些文件是否已经在暂存区中
				// 如果文件已经在暂存区中，不应该报告为冲突
				const gitStatus = cp.spawn('git', ['diff', '--cached', '--name-only'], {
					cwd: repoPath,
					env: process.env
				});
				
				let stagedFiles = '';
				gitStatus.stdout.on('data', (data) => {
					stagedFiles += data.toString();
				});
				
				gitStatus.on('close', (statusCode) => {
					const stagedFilesSet = new Set<string>();
					if (statusCode === 0 && stagedFiles.trim()) {
						stagedFiles.trim().split('\n').forEach(file => {
							if (file.trim()) {
								stagedFilesSet.add(file.trim());
							}
						});
					}
					
					// 只返回未暂存的冲突文件
					const unmergedFiles = Array.from(unmergedFilesSet).filter(file => !stagedFilesSet.has(file));
					resolve(unmergedFiles);
				});
				
				gitStatus.on('error', () => {
					// 如果检查暂存区失败，返回所有未合并的文件
					resolve(Array.from(unmergedFilesSet));
				});
			} else {
				resolve([]);
			}
		});

		git.on('error', (error) => {
			reject(error);
		});
	});
}

async function checkStagedFiles(repoPath: string): Promise<boolean> {
	// 注意：在无初始提交的仓库，git diff --cached --name-only HEAD 会返回非 0
	// 因此这里只要 stdout 有内容就认为有暂存文件，忽略退出码。
	return new Promise<boolean>((resolve) => {
		const git = cp.spawn('git', ['diff', '--cached', '--name-only'], {
			cwd: repoPath,
			env: process.env
		});

		let stdout = '';
		git.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		git.on('close', () => {
			if (stdout.trim().length > 0) {
				resolve(true);
				return;
			}

			// 如果 diff 没有输出，再用 git status 兜底检查索引区
			const status = cp.spawn('git', ['status', '--porcelain'], {
				cwd: repoPath,
				env: process.env
			});

			let statusOut = '';
			status.stdout.on('data', (data) => {
				statusOut += data.toString();
			});

			status.on('close', () => {
				// porcelain 首列是索引区状态，第二列是工作区状态
				// 只要首列不是空格且不是 '?'（未跟踪），就表示有暂存
				const hasIndexed = statusOut
					.split('\n')
					.some(line => line.length >= 2 && line[0] !== ' ' && line[0] !== '?');
				resolve(hasIndexed);
			});

			status.on('error', () => resolve(false));
		});

		git.on('error', () => {
			// 出错时返回 false，调用方会回退到 VS Code Git API
			resolve(false);
		});
	});
}

async function isInMergeState(repoPath: string): Promise<boolean> {
	try {
		const mergeHeadPath = path.join(repoPath, '.git', 'MERGE_HEAD');
		return fs.existsSync(mergeHeadPath);
	} catch {
		return false;
	}
}

async function getFilesNeedingStagingInMerge(repoPath: string): Promise<string[]> {
	return new Promise<string[]>((resolve, reject) => {
		// 使用 git status --porcelain 来检查文件状态
		// 在合并状态中，已修改但未暂存的文件需要被添加到暂存区
		const git = cp.spawn('git', ['status', '--porcelain'], {
			cwd: repoPath,
			env: process.env
		});

		let stdout = '';
		git.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		git.on('close', (code) => {
			if (code === 0) {
				const lines = stdout.trim().split('\n').filter(line => line.trim());
				const filesToStage: string[] = [];
				
				for (const line of lines) {
					if (line.length < 3) continue;
					
					const indexStatus = line[0]; // 暂存区状态
					const workingTreeStatus = line[1]; // 工作区状态
					const filePath = line.substring(3).trim();
					
					// 如果文件在暂存区中没有更改（indexStatus 为空格），但在工作区中有更改（workingTreeStatus 不为空格）
					// 或者文件处于未合并状态（indexStatus 为 'U' 或 'A'/'D' 等）
					// 这些文件需要被添加到暂存区
					if (indexStatus === ' ' && workingTreeStatus !== ' ') {
						// 工作区有更改但暂存区没有
						filesToStage.push(filePath);
					} else if (indexStatus === 'U' || indexStatus === 'A' || indexStatus === 'D') {
						// 未合并状态的文件
						filesToStage.push(filePath);
					}
				}
				
				resolve(filesToStage);
			} else {
				resolve([]);
			}
		});

		git.on('error', (error) => {
			reject(error);
		});
	});
}

async function executeGitCommit(repoPath: string, message: string): Promise<string | null> {
	return new Promise<string | null>((resolve) => {
		const git = cp.spawn('git', ['commit', '-m', message], {
			cwd: repoPath,
			env: process.env
		});

		let stderr = '';
		git.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		git.on('close', (code) => {
			if (code === 0) {
				resolve(null);
			} else {
				resolve(stderr || `Git commit failed with exit code ${code}`);
			}
		});

		git.on('error', (error) => {
			resolve(error.message || 'Failed to execute git commit');
		});
	});
}

import { AssistantPanel } from './assistantPanel';

export function registerAssistantCommands(
	context: vscode.ExtensionContext,
	repoManager: RepoManager,
	dataSource: DataSource,
	extensionState: ExtensionState,
	assistantPanel: AssistantPanel
) {
	const register = (id: string, cb: (...args: any[]) => any) => {
		context.subscriptions.push(vscode.commands.registerCommand(id, cb));
	};

	// 工具
	register('git-assistant.openDashboard', async () => {
		await vscode.commands.executeCommand('gitly.openAssistant');
	});

	register('git-assistant.refreshBranches', async () => {
		await vscode.commands.executeCommand('gitly.sidebar.refreshBranches');
	});

	// 开始使用（优先走 VS Code 内置 Git 命令，交互一致）
	register('git-assistant.initRepository', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('请先打开一个工作区文件夹');
			return;
		}

		const targetPath = workspaceFolders[0].uri.fsPath;

		// 如果当前文件夹已经是 Git 仓库，则提示用户无需再次初始化
		const existingRepoRoot = await dataSource.repoRoot(targetPath);
		if (existingRepoRoot) {
			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
			const msg = normalisedLanguage === 'zh-CN'
				? '当前文件夹已经是一个 Git 仓库，无需再次初始化。'
				: 'The current folder is already a Git repository, no need to initialize again.';
			vscode.window.showInformationMessage(msg);
			return;
		}

		await executeBuiltinGitCommand('git.init');

		// 等待仓库初始化完成
		await new Promise(resolve => setTimeout(resolve, 1500));

		// 获取仓库根目录并注册
		const repoRoot = await dataSource.repoRoot(targetPath) || targetPath;
		const result = await repoManager.registerRepo(repoRoot || targetPath, false);
		if (result.error) {
			// 如果注册失败，尝试扫描
			await repoManager.searchWorkspaceForRepos();
		}
	});

	register('git-assistant.quickClone', async () => executeBuiltinGitCommand('git.clone'));

	// 更改管理（智能辅助）
	register('git-assistant.addFiles', async () => {
		try {
			const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
			const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
			const repo = api?.repositories && api.repositories[0];
			if (!repo) {
				await executeBuiltinGitCommand('git.stageAll');
				return;
			}

			// 获取仓库路径
			const repoPath = repo.rootUri?.fsPath || (await dataSource.repoRoot(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''));
			const status = repo.state;
			const workingChanges = status.workingTreeChanges || [];
			
			// 检查是否有已解决但未暂存的冲突文件
			let unmergedFiles: string[] = [];
			if (repoPath) {
				try {
					unmergedFiles = await checkUnmergedFiles(repoPath);
				} catch {
					// 忽略错误
				}
			}
			
			// 如果处于合并状态，检查是否有需要暂存的文件
			if (repoPath && unmergedFiles.length === 0) {
				try {
					const inMerge = await isInMergeState(repoPath);
					if (inMerge) {
						const filesNeedingStaging = await getFilesNeedingStagingInMerge(repoPath);
						if (filesNeedingStaging.length > 0) {
							unmergedFiles = filesNeedingStaging;
						}
					}
				} catch {
					// 忽略错误
				}
			}
			
			// 如果有未暂存的冲突文件或合并状态中需要暂存的文件，直接添加它们
			if (unmergedFiles.length > 0) {
				const vscodeLanguage = vscode.env.language;
				const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
				
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: normalisedLanguage === 'zh-CN' ? '正在添加已解决的冲突文件到暂存区...' : 'Staging resolved conflict files...',
						cancellable: false
					},
					async () => {
						// 使用 git 命令添加冲突文件
						const git = cp.spawn('git', ['add', ...unmergedFiles], {
							cwd: repoPath,
							env: process.env
						});
						
						await new Promise<void>((resolve, reject) => {
							let stderr = '';
							git.stderr.on('data', (data) => {
								stderr += data.toString();
							});
							
							git.on('close', (code) => {
								if (code === 0) {
									resolve();
								} else {
									reject(new Error(stderr || `Git add failed with exit code ${code}`));
								}
							});
							
							git.on('error', (error) => {
								reject(error);
							});
						});
					}
				);
				
				// 等待 VS Code Git API 更新状态
				await new Promise(resolve => setTimeout(resolve, 300));
				
				const msg = normalisedLanguage === 'zh-CN'
					? `✅ 已添加 ${unmergedFiles.length} 个已解决的冲突文件到暂存区`
					: `✅ Added ${unmergedFiles.length} resolved conflict file(s) to staging area`;
				vscode.window.showInformationMessage(msg);
				
				// 刷新 assistantPanel 数据
				if (assistantPanel) {
					await assistantPanel.sendInitialData();
				}
				return;
			}
			
			if (workingChanges.length === 0) {
				const vscodeLanguage = vscode.env.language;
				const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
				const msg = normalisedLanguage === 'zh-CN'
					? '没有需要添加的文件'
					: 'No files to add';
				vscode.window.showInformationMessage(msg);
				return;
			}

			const choice = await vscode.window.showQuickPick(
				[
					{ label: '添加所有文件', description: 'git add .', value: 'all' },
					{ label: '选择文件', description: '从列表中选择文件', value: 'select' }
				],
				{ placeHolder: '选择添加方式' }
			);
			if (!choice) return;

			if (choice.value === 'all') {
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: '正在添加文件到暂存区...',
						cancellable: false
					},
					async () => {
						await repo.add(workingChanges.map((c: any) => c.uri));
					}
				);
				// 等待 VS Code Git API 更新状态
				await new Promise(resolve => setTimeout(resolve, 300));
				vscode.window.showInformationMessage('✅ 所有文件已添加到暂存区');
				return;
			}

			const items = workingChanges.map((c: any) => {
				const rel = vscode.workspace.asRelativePath(c.uri);
				return { label: rel, description: '', change: c };
			});
			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: '选择要添加到暂存区的文件（可多选）',
				canPickMany: true
			});
			if (!selected || selected.length === 0) return;

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: '正在添加选中文件到暂存区...',
					cancellable: false
				},
				async () => {
					await repo.add(selected.map((s: any) => s.change.uri));
				}
			);
			// 等待 VS Code Git API 更新状态
			await new Promise(resolve => setTimeout(resolve, 300));
			vscode.window.showInformationMessage(`✅ 已添加 ${selected.length} 个文件到暂存区`);
		} catch {
			// 发生错误时退回到内置命令
			await executeBuiltinGitCommand('git.stageAll');
		}
	});
	register('git-assistant.unstageFiles', async () => {
		try {
			const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
			const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
			const repo = api?.repositories && api.repositories[0];
			if (!repo) {
				await executeBuiltinGitCommand('git.unstageAll');
				return;
			}

			const status = repo.state as any;
			const stagedChanges = status.indexChanges || [];
			const hasStagedFiles = stagedChanges.length > 0;

			if (!hasStagedFiles) {
				const vscodeLanguage = vscode.env.language;
				const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
				const msg = normalisedLanguage === 'zh-CN'
					? '暂无已暂存的文件。'
					: 'No staged files.';
				vscode.window.showInformationMessage(msg);
				return;
			}

			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
			const choice = await vscode.window.showQuickPick(
				[
					{ label: normalisedLanguage === 'zh-CN' ? '取消所有暂存' : 'Unstage all', description: 'git reset HEAD', value: 'all' },
					{ label: normalisedLanguage === 'zh-CN' ? '选择文件' : 'Select files', description: 'git reset HEAD <file>', value: 'select' }
				],
				{ placeHolder: normalisedLanguage === 'zh-CN' ? '选择取消暂存方式' : 'Select unstaging method' }
			);

			if (!choice) {
				return;
			}

			if (choice.value === 'all') {
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: normalisedLanguage === 'zh-CN' ? '正在取消所有暂存...' : 'Unstaging all files...',
						cancellable: false
					},
					async () => {
						await repo.revert(stagedChanges.map((c: any) => c.uri));
					}
				);

				const msg = normalisedLanguage === 'zh-CN' ? '✅ 已取消所有已暂存文件' : '✅ All staged files unstaged';
				vscode.window.showInformationMessage(msg);
			} else {
				const items = stagedChanges.map((c: any) => {
					const rel = vscode.workspace.asRelativePath(c.uri);
					return { label: rel, description: '', change: c };
				});
				const selected = await vscode.window.showQuickPick(items, {
					placeHolder: normalisedLanguage === 'zh-CN' ? '选择要取消暂存的文件（可多选）' : 'Select files to unstage (multiple selection)',
					canPickMany: true
				});

				if (!selected || selected.length === 0) {
					return;
				}

				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: normalisedLanguage === 'zh-CN' ? '正在取消选中文件的暂存...' : 'Unstaging selected files...',
						cancellable: false
					},
					async () => {
						await repo.revert(selected.map((s: any) => s.change.uri));
					}
				);

				const msg = normalisedLanguage === 'zh-CN'
					? `✅ 已取消 ${selected.length} 个文件的暂存`
					: `✅ Unstaged ${selected.length} files`;
				vscode.window.showInformationMessage(msg);
			}

			// 刷新数据
			await new Promise(resolve => setTimeout(resolve, 300));
			if (assistantPanel) {
				await assistantPanel.sendInitialData();
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
			const errorMsg = normalisedLanguage === 'zh-CN'
				? `取消暂存失败: ${errorMessage}`
				: `Unstage failed: ${errorMessage}`;
			vscode.window.showErrorMessage(errorMsg);
		}
	});

	register('git-assistant.discardChanges', async () => {
		try {
			const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
			const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
			const repo = api?.repositories && api.repositories[0];
			if (!repo) {
				vscode.window.showErrorMessage('当前未检测到 Git 仓库，无法放弃更改。');
				return;
			}

			const state = repo.state as any;
			const workingChanges = state.workingTreeChanges || [];
			if (workingChanges.length === 0) {
				vscode.window.showInformationMessage('没有可放弃的更改。');
				return;
			}

			const choice = await vscode.window.showQuickPick(
				[
					{ label: '放弃所有更改', description: 'git checkout -- .', value: 'all' },
					{ label: '选择文件', description: '只放弃选中文件的更改', value: 'select' }
				],
				{ placeHolder: '选择放弃方式' }
			);
			if (!choice) return;

			if (choice.value === 'all') {
				const discardAction = '放弃';
				const confirm = await vscode.window.showWarningMessage(
					'将放弃所有已跟踪文件的修改，且无法恢复。确定继续？',
					{ modal: true },
					discardAction
				);
				if (confirm !== discardAction) return;

				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: '正在放弃所有更改...',
						cancellable: false
					},
					async () => {
						await repo.revert(workingChanges.map((c: any) => c.uri));
					}
				);
				vscode.window.showInformationMessage('✅ 已放弃所有已跟踪文件的更改');
			} else {
				const items = workingChanges.map((c: any) => {
					const rel = vscode.workspace.asRelativePath(c.uri);
					return { label: rel, description: '', change: c };
				});
				const selected = await vscode.window.showQuickPick(items, {
					placeHolder: '选择要放弃更改的文件',
					canPickMany: true
				});
				if (!selected || selected.length === 0) return;

				const discardAction = '放弃';
				const confirm = await vscode.window.showWarningMessage(
					`将放弃 ${selected.length} 个文件的更改，且无法恢复。确定继续？`,
					{ modal: true },
					discardAction
				);
				if (confirm !== discardAction) return;

				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: '正在放弃选中文件的更改...',
						cancellable: false
					},
					async () => {
						await repo.revert(selected.map((s: any) => s.change.uri));
					}
				);
				vscode.window.showInformationMessage(`✅ 已放弃 ${selected.length} 个文件的更改`);
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			vscode.window.showErrorMessage(`放弃更改失败：${msg}`);
		}
	});

	// 提交操作（借鉴 code-git-assistant 的实现，不打开新页面）
	register('git-assistant.commitChanges', async () => {
		try {
			const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
			const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
			const repo = api?.repositories && api.repositories[0];

			if (!repo) {
				// 如果没有 Git API，退回到内置命令
				await executeBuiltinGitCommand('git.commit');
				return;
			}

			// 获取仓库路径
			const repoPath = repo.rootUri?.fsPath || (await dataSource.repoRoot(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''));
			if (!repoPath) {
				const vscodeLanguage = vscode.env.language;
				const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
				const errorMsg = normalisedLanguage === 'zh-CN'
					? '无法确定仓库路径'
					: 'Unable to determine repository path';
				vscode.window.showErrorMessage(errorMsg);
				return;
			}

			// 检查是否有未合并的文件（冲突）
			try {
				const unmergedFiles = await checkUnmergedFiles(repoPath);
				if (unmergedFiles.length > 0) {
					const vscodeLanguage = vscode.env.language;
					const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
					const fileList = unmergedFiles.slice(0, 5).join(', ') + (unmergedFiles.length > 5 ? '...' : '');
					const msg = normalisedLanguage === 'zh-CN'
						? `检测到 ${unmergedFiles.length} 个未合并的文件（冲突）：${fileList}。请先解决冲突，然后使用 'git add <file>' 标记为已解决，再提交。`
						: `Found ${unmergedFiles.length} unmerged file(s) (conflicts): ${fileList}. Please resolve conflicts first, then use 'git add <file>' to mark them as resolved before committing.`;
					vscode.window.showErrorMessage(msg);
					return;
				}
			} catch (error) {
				// 如果检查失败，继续执行（可能没有冲突）
			}

			// 检查是否有暂存的文件（使用 git 命令直接检查，而不是依赖可能过时的 VS Code Git API）
			let hasStagedFiles = false;
			try {
				hasStagedFiles = await checkStagedFiles(repoPath);
			} catch (error) {
				// 如果检查失败，尝试使用 VS Code Git API 作为后备
				const status = repo.state as any;
				const stagedChanges = status.indexChanges || [];
				hasStagedFiles = stagedChanges.length > 0;
			}

			if (!hasStagedFiles) {
				const vscodeLanguage = vscode.env.language;
				const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
				const msg = normalisedLanguage === 'zh-CN'
					? '没有已暂存的文件。请先使用"添加文件"命令将文件添加到暂存区。'
					: 'No staged files. Please use "Add Files" command to stage files first.';
				vscode.window.showWarningMessage(msg);
				return;
			}

			// 输入提交信息
			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
			const promptText = normalisedLanguage === 'zh-CN' ? '输入提交信息' : 'Enter commit message';
			const placeHolderText = normalisedLanguage === 'zh-CN' ? '例如: feat: 添加新功能' : 'e.g.: feat: add new feature';
			const validationError = normalisedLanguage === 'zh-CN'
				? '请输入提交信息'
				: 'Please enter a commit message';
			const lengthError = normalisedLanguage === 'zh-CN'
				? '提交信息不能超过200个字符'
				: 'Commit message cannot exceed 200 characters';

			const commitMessage = await vscode.window.showInputBox({
				prompt: promptText,
				placeHolder: placeHolderText,
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return validationError;
					}
					if (value.trim().length > 200) {
						return lengthError;
					}
					return null;
				}
			});

			if (!commitMessage) {
				return;
			}

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: normalisedLanguage === 'zh-CN' ? '正在提交更改...' : 'Committing changes...',
					cancellable: false
				},
				async (progress) => {
					progress.report({ increment: 50 });
					const error = await executeGitCommit(repoPath, commitMessage.trim());
					progress.report({ increment: 50 });
					if (error) {
						// 检查是否是冲突相关的错误
						if (error.includes('unmerged') || error.includes('unresolved conflict') || error.includes('未合并')) {
							const vscodeLanguage = vscode.env.language;
							const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
							const conflictMsg = normalisedLanguage === 'zh-CN'
								? '提交失败：检测到未合并的文件（冲突）。请先解决冲突，然后使用 "git add <file>" 标记为已解决，再提交。'
								: 'Commit failed: Unmerged files (conflicts) detected. Please resolve conflicts first, then use "git add <file>" to mark them as resolved before committing.';
							throw new Error(conflictMsg);
						}
						throw new Error(error);
					}
				}
			);

			const successMsg = normalisedLanguage === 'zh-CN' ? '✅ 提交成功！' : '✅ Commit successful!';
			vscode.window.showInformationMessage(successMsg);

			// 记录命令历史并刷新
			await repoManager.searchWorkspaceForRepos();
			// 等待一下让 Git 操作完成
			await new Promise(resolve => setTimeout(resolve, 300));
			// 刷新 assistantPanel 数据
			if (assistantPanel) {
				await assistantPanel.sendInitialData();
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
			const errorMsg = normalisedLanguage === 'zh-CN'
				? `提交失败: ${errorMessage}`
				: `Commit failed: ${errorMessage}`;
			vscode.window.showErrorMessage(errorMsg);
		}
	});

	register('git-assistant.commitAllChanges', async () => {
		try {
			const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
			const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
			const repo = api?.repositories && api.repositories[0];

			if (!repo) {
				// 如果没有 Git API，退回到内置命令
				await executeBuiltinGitCommand('git.commitAll');
				return;
			}

			// 获取仓库路径
			const repoPath = repo.rootUri?.fsPath || (await dataSource.repoRoot(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''));
			if (!repoPath) {
				const vscodeLanguage = vscode.env.language;
				const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
				const errorMsg = normalisedLanguage === 'zh-CN'
					? '无法确定仓库路径'
					: 'Unable to determine repository path';
				vscode.window.showErrorMessage(errorMsg);
				return;
			}

			// 检查是否有未合并的文件（冲突）
			try {
				const unmergedFiles = await checkUnmergedFiles(repoPath);
				if (unmergedFiles.length > 0) {
					const vscodeLanguage = vscode.env.language;
					const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
					const fileList = unmergedFiles.slice(0, 5).join(', ') + (unmergedFiles.length > 5 ? '...' : '');
					const msg = normalisedLanguage === 'zh-CN'
						? `检测到 ${unmergedFiles.length} 个未合并的文件（冲突）：${fileList}。请先解决冲突，然后使用 'git add <file>' 标记为已解决，再提交。`
						: `Found ${unmergedFiles.length} unmerged file(s) (conflicts): ${fileList}. Please resolve conflicts first, then use 'git add <file>' to mark them as resolved before committing.`;
					vscode.window.showErrorMessage(msg);
					return;
				}
			} catch (error) {
				// 如果检查失败，继续执行（可能没有冲突）
			}

			// 检查是否有已跟踪的更改
			const status = repo.state as any;
			const workingChanges = status.workingTreeChanges || [];
			const hasTrackedChanges = workingChanges.length > 0;

			if (!hasTrackedChanges) {
				const vscodeLanguage = vscode.env.language;
				const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
				const msg = normalisedLanguage === 'zh-CN'
					? '没有已跟踪的更改需要提交。'
					: 'No tracked changes to commit.';
				vscode.window.showInformationMessage(msg);
				return;
			}

			// 输入提交信息
			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
			const promptText = normalisedLanguage === 'zh-CN' ? '输入提交信息' : 'Enter commit message';
			const placeHolderText = normalisedLanguage === 'zh-CN' ? '例如: feat: 添加新功能' : 'e.g.: feat: add new feature';
			const validationError = normalisedLanguage === 'zh-CN'
				? '请输入提交信息'
				: 'Please enter a commit message';
			const lengthError = normalisedLanguage === 'zh-CN'
				? '提交信息不能超过200个字符'
				: 'Commit message cannot exceed 200 characters';

			const commitMessage = await vscode.window.showInputBox({
				prompt: promptText,
				placeHolder: placeHolderText,
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return validationError;
					}
					if (value.trim().length > 200) {
						return lengthError;
					}
					return null;
				}
			});

			if (!commitMessage) {
				return;
			}

			// 先暂存所有已跟踪的更改，然后提交（repoPath 已在前面定义）

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: normalisedLanguage === 'zh-CN' ? '正在提交所有更改...' : 'Committing all changes...',
					cancellable: false
				},
				async (progress) => {
					progress.report({ increment: 30, message: normalisedLanguage === 'zh-CN' ? '暂存所有更改...' : 'Staging all changes...' });
					// 暂存所有已跟踪的更改 - 使用 VS Code Git API 的 add 方法
					await repo.add(workingChanges.map((c: any) => c.uri));
					progress.report({ increment: 40, message: normalisedLanguage === 'zh-CN' ? '提交更改...' : 'Committing changes...' });
					// 提交 - 使用 git 命令而不是 repo.commit()
					const error = await executeGitCommit(repoPath, commitMessage.trim());
					progress.report({ increment: 30 });
					if (error) {
						// 检查是否是冲突相关的错误
						if (error.includes('unmerged') || error.includes('unresolved conflict') || error.includes('未合并')) {
							const vscodeLanguage = vscode.env.language;
							const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
							const conflictMsg = normalisedLanguage === 'zh-CN'
								? '提交失败：检测到未合并的文件（冲突）。请先解决冲突，然后使用 "git add <file>" 标记为已解决，再提交。'
								: 'Commit failed: Unmerged files (conflicts) detected. Please resolve conflicts first, then use "git add <file>" to mark them as resolved before committing.';
							throw new Error(conflictMsg);
						}
						throw new Error(error);
					}
				}
			);

			const successMsg = normalisedLanguage === 'zh-CN'
				? '✅ 已提交所有已跟踪的更改'
				: '✅ All tracked changes committed';
			vscode.window.showInformationMessage(successMsg);

			// 记录命令历史并刷新
			await repoManager.searchWorkspaceForRepos();
			// 等待一下让 Git 操作完成
			await new Promise(resolve => setTimeout(resolve, 300));
			// 刷新 assistantPanel 数据
			if (assistantPanel) {
				await assistantPanel.sendInitialData();
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
			const errorMsg = normalisedLanguage === 'zh-CN'
				? `提交失败: ${errorMessage}`
				: `Commit failed: ${errorMessage}`;
			vscode.window.showErrorMessage(errorMsg);
		}
	});

	register('git-assistant.undoLastCommit', async () => {
		const repo = await ensureRepo(repoManager, extensionState);
		if (!repo) return;

		const confirm = await vscode.window.showWarningMessage(
			'确认撤销最近一次提交吗？将使用 soft reset 保留更改到暂存区（等价 git reset --soft HEAD~1）。',
			{ modal: true },
			'确认撤销'
		);
		if (confirm !== '确认撤销') return;

		const err = await dataSource.resetToCommit(repo, 'HEAD~1', GitResetMode.Soft);
		if (err !== null) {
			vscode.window.showErrorMessage(`撤销提交失败：${err}`);
		} else {
			vscode.window.showInformationMessage('已撤销最近一次提交（soft reset）。');
		}
	});

		// 同步操作（智能辅助）
	register('git-assistant.quickPush', async () => {
		let selectedRemote = 'origin';
		try {
			const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
			const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
			const repo = api?.repositories && api.repositories[0];
			if (!repo) {
				await executeBuiltinGitCommand('git.push');
				return;
			}

			// 获取远程仓库列表 - 使用 dataSource 而不是 repo.getRemotes()
			const repoPath = repo.rootUri?.fsPath || (await dataSource.repoRoot(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''));
			let remotes: string[] = [];
			if (repoPath) {
				const repoInfo = await dataSource.getRepoInfo(repoPath, false, false, []);
				remotes = repoInfo.remotes || [];
			}
			
			if (remotes.length === 0) {
				const vscodeLanguage = vscode.env.language;
				const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
				const msg = normalisedLanguage === 'zh-CN'
					? '尚未配置远程仓库，无法推送。请先添加远程仓库。'
					: 'No remote repository configured. Please add a remote repository first.';
				vscode.window.showWarningMessage(msg);
				return;
			}

			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

			// 如果有多个远程仓库，让用户选择
			if (remotes.length > 1) {
				const picked = await vscode.window.showQuickPick(
					remotes.map((r: string) => ({ label: r, description: '' })),
					{ placeHolder: normalisedLanguage === 'zh-CN' ? '选择要推送到的远程仓库' : 'Select remote to push to' }
				);
				if (!picked) {
					return;
				}
				selectedRemote = (picked as unknown as { label: string }).label;
			} else {
				selectedRemote = remotes[0];
			}

			const state = repo.state as any;
			const head = state.HEAD || {};
			const branch = head.name || 'HEAD';
			const ahead = head.ahead || 0;
			const tracking = head.upstream || null;
			const workingChanges = state.workingTreeChanges || [];

			const hasUncommittedChanges = workingChanges.length > 0;
			const hasUnpushedCommits = ahead > 0;
			let hasCommitsToPush = hasUnpushedCommits;

			// 如果没有设置上游分支，检查是否有提交可以推送 - 使用 dataSource 而不是 repo.log()
			if (!hasUnpushedCommits && !tracking) {
				try {
					if (repoPath) {
						const commitData = await dataSource.getCommits(repoPath, null, 1, false, false, false, false, CommitOrdering.Date, [], [], []);
						hasCommitsToPush = commitData.commits && commitData.commits.length > 0;
					} else {
						hasCommitsToPush = false;
					}
				} catch {
					hasCommitsToPush = false;
				}
			}

			// 如果既没有未提交的更改，也没有待推送的提交，则提示
			if (!hasUncommittedChanges && !hasCommitsToPush) {
				const msg = normalisedLanguage === 'zh-CN'
					? '没有需要推送的更改或提交'
					: 'No changes or commits to push';
				vscode.window.showInformationMessage(msg);
				return;
			}

			// 构建推送信息
			let message = '';
			const needsUpstream = !tracking && hasCommitsToPush;

			if (hasUncommittedChanges && hasCommitsToPush) {
				const commitCount = hasUnpushedCommits ? ahead.toString() : (normalisedLanguage === 'zh-CN' ? '本地' : 'local');
				message = normalisedLanguage === 'zh-CN'
					? `有未提交的更改和 ${commitCount} 个待推送的提交。推送只会上传已提交的内容。`
					: `There are uncommitted changes and ${commitCount} commits to push. Push will only upload committed content.`;
			} else if (hasCommitsToPush) {
				if (hasUnpushedCommits) {
					message = normalisedLanguage === 'zh-CN'
						? `准备推送 ${ahead} 个提交到远程仓库`
						: `Ready to push ${ahead} commits to remote repository`;
				} else {
					message = normalisedLanguage === 'zh-CN'
						? `准备推送本地提交到远程仓库${needsUpstream ? '（将设置上游分支）' : ''}`
						: `Ready to push local commits to remote repository${needsUpstream ? ' (will set upstream branch)' : ''}`;
				}
			} else {
				message = normalisedLanguage === 'zh-CN'
					? '有未提交的更改，请先提交后再推送。'
					: 'There are uncommitted changes. Please commit first before pushing.';
				vscode.window.showWarningMessage(message);
				return;
			}

			const config = vscode.workspace.getConfiguration('git-assistant');
			const needConfirm = config.get('confirmPush', true);

			if (needConfirm && hasCommitsToPush) {
				const pushAction = normalisedLanguage === 'zh-CN' ? '推送' : 'Push';
				const choice = await vscode.window.showWarningMessage(
					message,
					{ modal: true },
					pushAction
				);
				if (choice !== pushAction) {
					return;
				}
			}

			// 执行推送
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: normalisedLanguage === 'zh-CN' ? `正在推送到 ${selectedRemote}...` : `Pushing to ${selectedRemote}...`,
					cancellable: false
				},
				async (progress) => {
					progress.report({ increment: 30 });
					// 使用 dataSource.pushBranch 而不是 repo.push()
					if (repoPath) {
						const error = await dataSource.pushBranch(repoPath, branch, selectedRemote, needsUpstream, GitPushBranchMode.Normal);
						progress.report({ increment: 70 });
						if (error) {
							throw new Error(error);
						}
					} else {
						throw new Error('无法确定仓库路径');
					}
				}
			);

			// 获取推送后的最新状态并提示上游信息
			const finalTracking = head.upstream || null;

			if (needsUpstream) {
				const upstream = finalTracking || `${selectedRemote}/${branch}`;
				const msg = normalisedLanguage === 'zh-CN'
					? `✅ 已推送到 ${selectedRemote}，并设置上游 ${upstream}`
					: `✅ Pushed to ${selectedRemote} and set upstream ${upstream}`;
				vscode.window.showInformationMessage(msg);
			} else if (finalTracking) {
				const msg = normalisedLanguage === 'zh-CN'
					? `✅ 已推送到 ${selectedRemote}（当前上游：${finalTracking}）`
					: `✅ Pushed to ${selectedRemote} (current upstream: ${finalTracking})`;
				vscode.window.showInformationMessage(msg);
			} else {
				const msg = normalisedLanguage === 'zh-CN'
					? `✅ 已推送到 ${selectedRemote}`
					: `✅ Pushed to ${selectedRemote}`;
				vscode.window.showInformationMessage(msg);
			}

			// 刷新数据
			await new Promise(resolve => setTimeout(resolve, 300));
			if (assistantPanel) {
				await assistantPanel.sendInitialData();
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
			const errorMsg = normalisedLanguage === 'zh-CN'
				? `推送失败: ${errorMessage}`
				: `Push failed: ${errorMessage}`;
			vscode.window.showErrorMessage(errorMsg);
		}
	});

	register('git-assistant.quickPull', async () => {
		let hasStashed = false;
		let selectedRemote = 'origin';
		try {
			const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
			const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
			const repo = api?.repositories && api.repositories[0];
			if (!repo) {
				await executeBuiltinGitCommand('git.pull');
				return;
			}

			// 获取远程仓库列表 - 使用 dataSource 而不是 repo.getRemotes()
			const repoPath = repo.rootUri?.fsPath || (await dataSource.repoRoot(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''));
			let remotes: string[] = [];
			if (repoPath) {
				const repoInfo = await dataSource.getRepoInfo(repoPath, false, false, []);
				remotes = repoInfo.remotes || [];
			}
			
			if (remotes.length === 0) {
				const vscodeLanguage = vscode.env.language;
				const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
				const msg = normalisedLanguage === 'zh-CN'
					? '尚未配置远程仓库，无法拉取。请先添加远程仓库。'
					: 'No remote repository configured. Please add a remote repository first.';
				vscode.window.showWarningMessage(msg);
				return;
			}

			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

			// 如果有多个远程仓库，让用户选择
			if (remotes.length > 1) {
				const picked = await vscode.window.showQuickPick(
					remotes.map((r: string) => ({ label: r, description: '' })),
					{ placeHolder: normalisedLanguage === 'zh-CN' ? '选择要从哪个远程拉取' : 'Select remote to pull from' }
				);
				if (!picked) {
					return;
				}
				selectedRemote = (picked as unknown as { label: string }).label;
			} else {
				selectedRemote = remotes[0];
			}

			const state = repo.state as any;
			const workingChanges = state.workingTreeChanges || [];
			const head = state.HEAD || {};
			const currentBranch = head.name || 'HEAD';

			// 检查是否有未提交的更改
			if (workingChanges.length > 0) {
				const stashAction = normalisedLanguage === 'zh-CN' ? '暂存并拉取' : 'Stash and pull';
				const pullAction = normalisedLanguage === 'zh-CN' ? '直接拉取' : 'Pull directly';
				const cancelAction = normalisedLanguage === 'zh-CN' ? '取消' : 'Cancel';
				const choice = await vscode.window.showWarningMessage(
					normalisedLanguage === 'zh-CN'
						? '有未提交的更改，是否先暂存(stash)？'
						: 'There are uncommitted changes. Stash them first?',
					stashAction,
					pullAction,
					cancelAction
				);

				if (!choice || choice === cancelAction) {
					return;
				}

				if (choice === stashAction) {
					// 使用 dataSource.pushStash 而不是 repo.createStash()
					if (repoPath) {
						const error = await dataSource.pushStash(repoPath, normalisedLanguage === 'zh-CN' ? '拉取前暂存' : 'Stash before pull', false);
						if (error) {
							vscode.window.showErrorMessage(`暂存失败: ${error}`);
							return;
						}
						hasStashed = true;
					}
				}
			}

			// 执行拉取 - 使用 dataSource.pullBranch 而不是 repo.pull()
			
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: normalisedLanguage === 'zh-CN' ? `正在从 ${selectedRemote} 拉取...` : `Pulling from ${selectedRemote}...`,
					cancellable: false
				},
				async (progress) => {
					progress.report({ increment: 30 });
					if (repoPath && currentBranch !== 'HEAD') {
						const error = await dataSource.pullBranch(repoPath, currentBranch, selectedRemote, false, false);
						progress.report({ increment: 70 });
						if (error) {
							throw new Error(error);
						}
					} else {
						throw new Error('无法确定仓库路径或当前分支');
					}
				}
			);

			// 拉取成功后，如果有暂存则自动恢复 - 使用 dataSource.popStash 而不是 repo.popStash()
			if (hasStashed) {
				try {
					if (repoPath) {
						// 获取最新的 stash (stash@{0})
						const error = await dataSource.popStash(repoPath, 'stash@{0}', false);
						if (error) {
							throw new Error(error);
						}
					}
				} catch (stashError) {
					// 如果恢复失败，可能是冲突或其他原因，提示用户
					const viewLogAction = normalisedLanguage === 'zh-CN' ? '查看日志' : 'View log';
					const ignoreAction = normalisedLanguage === 'zh-CN' ? '忽略' : 'Ignore';
					await vscode.window.showWarningMessage(
						normalisedLanguage === 'zh-CN'
							? '拉取成功，但恢复暂存时遇到问题。请手动处理冲突。'
							: 'Pull succeeded, but encountered an issue while restoring stash. Please handle conflicts manually.',
						viewLogAction,
						ignoreAction
					);
					// 可以在这里打开日志面板
				}
			}

			const msg = normalisedLanguage === 'zh-CN' ? '✅ 拉取成功！' : '✅ Pull successful!';
			vscode.window.showInformationMessage(msg);

			// 刷新数据
			await new Promise(resolve => setTimeout(resolve, 300));
			if (assistantPanel) {
				await assistantPanel.sendInitialData();
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

			// 如果拉取失败但已暂存，提示用户需要手动恢复
			if (hasStashed) {
				const msg = normalisedLanguage === 'zh-CN'
					? '拉取失败。您的更改已被暂存，可以使用 \'git stash pop\' 手动恢复。'
					: 'Pull failed. Your changes have been stashed. You can manually restore them using \'git stash pop\'.';
				await vscode.window.showWarningMessage(msg);
			}

			const errorMsg = normalisedLanguage === 'zh-CN'
				? `拉取失败: ${errorMessage}`
				: `Pull failed: ${errorMessage}`;
			vscode.window.showErrorMessage(errorMsg);
		}
	});

	// 分支管理（复用 dataSource，保证在没有内置 Git 命令时仍可用）
	register('git-assistant.createBranch', async () => {
		const ctx = await getRepoContext(repoManager, extensionState, dataSource);
		if (!ctx) {
			vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
			return;
		}

		const branchName = await vscode.window.showInputBox({
			title: '创建新分支',
			prompt: '请输入新分支名称（基于当前 HEAD 创建并切换）',
			placeHolder: 'feature/my-new-branch'
		} as any);
		if (!branchName) return;

		const statuses = await dataSource.createBranch(ctx.repo, branchName, 'HEAD', true, false);
		const err = statuses.find((x) => x !== null) || null;
		if (err !== null) {
			vscode.window.showErrorMessage(`创建分支失败：${err}`);
		} else {
			vscode.window.showInformationMessage(`已创建并切换到分支 "${branchName}"`);
			// 等待一小段时间确保 Git 操作完成后再刷新
			await new Promise(resolve => setTimeout(resolve, 300));
			if (assistantPanel) {
				await assistantPanel.sendInitialData();
			}
		}
	});

	register('git-assistant.switchBranch', async () => {
		const ctx = await getRepoContext(repoManager, extensionState, dataSource);
		if (!ctx) {
			vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
			return;
		}

		const branches = (ctx.repoInfo.branches || []).slice();
		const picked = await vscode.window.showQuickPick(branches, { placeHolder: '选择要切换到的分支' });
		if (!picked) return;

		const err = await dataSource.checkoutBranch(ctx.repo, picked, null);
		if (err !== null) {
			vscode.window.showErrorMessage(`切换分支失败：${err}`);
		} else {
			vscode.window.showInformationMessage(`已切换到分支 "${picked}"`);
		}
	});

	register('git-assistant.mergeBranch', async () => {
		try {
			const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
			const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
			const repo = api?.repositories && api.repositories[0];

			if (!repo) {
				// 如果没有 Git API，使用 dataSource
				const ctx = await getRepoContext(repoManager, extensionState, dataSource);
				if (!ctx) {
					vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
					return;
				}

				const candidates = (ctx.repoInfo.branches || []).filter((b) => b && b !== ctx.repoInfo.head);
				const picked = await vscode.window.showQuickPick(candidates, { placeHolder: '选择要合并到当前分支的分支' });
				if (!picked) return;

				const confirm = await vscode.window.showWarningMessage(
					`确认要将分支 "${picked}" 合并到当前分支吗？`,
					{ modal: true },
					'确认合并'
				);
				if (confirm !== '确认合并') return;

				const err = await dataSource.merge(ctx.repo, picked, 0 as any, false, false, false);
				if (err !== null) {
					vscode.window.showErrorMessage(`合并分支失败：${err}`);
				} else {
					vscode.window.showInformationMessage(`已发起合并分支 "${picked}"，如有冲突请在编辑器中解决。`);
				}
				return;
			}

			// 使用 VS Code Git API
			const state = repo.state as any;
			const head = state.HEAD || {};
			const currentBranch = head.name || 'HEAD';
			const workingChanges = state.workingTreeChanges || [];

			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

			// 获取所有分支 - 使用 dataSource.getRepoInfo 而不是 repo.getBranches()
			const repoPath = repo.rootUri?.fsPath || (await dataSource.repoRoot(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''));
			if (!repoPath) {
				const errorMsg = normalisedLanguage === 'zh-CN'
					? '无法确定仓库路径'
					: 'Unable to determine repository path';
				vscode.window.showErrorMessage(errorMsg);
				return;
			}
			
			const repoInfo = await dataSource.getRepoInfo(repoPath, false, false, []);
			const localBranches = (repoInfo.branches || [])
				.filter((b: string) => b && b !== currentBranch && !b.startsWith('remotes/'));

			if (localBranches.length === 0) {
				const msg = normalisedLanguage === 'zh-CN'
					? '没有可合并的本地分支'
					: 'No local branches to merge';
				vscode.window.showInformationMessage(msg);
				return;
			}

			// 选择要合并的分支
			const items = localBranches.map((b: string) => ({
				label: `$(git-branch) ${b}`,
				description: '',
				branch: b
			}));

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: normalisedLanguage === 'zh-CN' ? `选择要合并到 "${currentBranch}" 的分支` : `Select branch to merge into "${currentBranch}"`
			});

			if (!selected) {
				return;
			}

			const selectedBranch = (selected as unknown as { branch: string }).branch;

			// 检查未提交的更改
			if (workingChanges.length > 0) {
				const changeCount = workingChanges.length;
				const stashAction = normalisedLanguage === 'zh-CN' ? '暂存后继续' : 'Stash and continue';
				const commitAction = normalisedLanguage === 'zh-CN' ? '提交后继续' : 'Commit and continue';
				const mergeAction = normalisedLanguage === 'zh-CN' ? '直接合并' : 'Merge directly';
				const cancelAction = normalisedLanguage === 'zh-CN' ? '取消' : 'Cancel';

				const choice = await vscode.window.showWarningMessage(
					normalisedLanguage === 'zh-CN'
						? `合并前检测到 ${changeCount} 个未提交的更改。建议先提交或暂存这些更改。`
						: `Detected ${changeCount} uncommitted changes before merge. It's recommended to commit or stash these changes first.`,
					{ modal: true },
					stashAction,
					commitAction,
					mergeAction,
					cancelAction
				);

				if (!choice || choice === cancelAction) {
					return;
				}

				if (choice === stashAction) {
					// 使用 dataSource.pushStash 而不是 repo.createStash()
					if (repoPath) {
						const error = await dataSource.pushStash(repoPath, normalisedLanguage === 'zh-CN' ? `合并 ${selectedBranch} 前暂存` : `Stash before merging ${selectedBranch}`, false);
						if (error) {
							vscode.window.showErrorMessage(`暂存失败: ${error}`);
							return;
						}
						vscode.window.showInformationMessage(normalisedLanguage === 'zh-CN' ? '✅ 更改已暂存' : '✅ Changes stashed');
					}
				} else if (choice === commitAction) {
					const msg = normalisedLanguage === 'zh-CN'
						? '请先使用 "Git: 提交所有更改" 命令提交更改，然后再进行合并操作。'
						: 'Please use "Git: Commit All Changes" command to commit changes first, then perform the merge operation.';
					vscode.window.showWarningMessage(msg);
					return;
				}
				// '直接合并' 继续执行合并流程
			}

			// 确认合并
			const mergeAction = normalisedLanguage === 'zh-CN' ? '合并' : 'Merge';
			const cancelAction = normalisedLanguage === 'zh-CN' ? '取消' : 'Cancel';
			const confirm = await vscode.window.showWarningMessage(
				normalisedLanguage === 'zh-CN'
					? `确定要将分支 "${selectedBranch}" 合并到 "${currentBranch}" 吗？`
					: `Are you sure you want to merge branch "${selectedBranch}" into "${currentBranch}"?`,
				{ modal: true },
				mergeAction,
				cancelAction
			);

			if (confirm !== mergeAction) {
				return;
			}

			// 执行合并
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: normalisedLanguage === 'zh-CN' ? `正在合并分支 ${selectedBranch}...` : `Merging branch ${selectedBranch}...`,
					cancellable: false
				},
				async (progress) => {
					progress.report({ increment: 50 });
					// 使用 dataSource.merge 而不是 repo.merge()
					if (repoPath) {
						const error = await dataSource.merge(repoPath, selectedBranch, MergeActionOn.Branch, false, false, false);
						progress.report({ increment: 50 });
						if (error) {
							throw new Error(error);
						}
					} else {
						throw new Error('无法确定仓库路径');
					}
				}
			);

			const msg = normalisedLanguage === 'zh-CN'
				? `✅ 分支 "${selectedBranch}" 已合并到 "${currentBranch}"`
				: `✅ Branch "${selectedBranch}" merged into "${currentBranch}"`;
			vscode.window.showInformationMessage(msg);

			// 刷新数据
			await new Promise(resolve => setTimeout(resolve, 300));
			if (assistantPanel) {
				await assistantPanel.sendInitialData();
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const vscodeLanguage = vscode.env.language;
			const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
			const errorMsg = normalisedLanguage === 'zh-CN'
				? `合并失败: ${errorMessage}`
				: `Merge failed: ${errorMessage}`;

			if (errorMessage.includes('CONFLICT') || errorMessage.includes('冲突')) {
				const resolveAction = normalisedLanguage === 'zh-CN' ? '解决冲突' : 'Resolve conflicts';
				vscode.window.showErrorMessage(
					normalisedLanguage === 'zh-CN'
						? '合并冲突！请使用 "Git Assistant: 解决冲突" 命令处理'
						: 'Merge conflict! Please use "Git Assistant: Resolve Conflicts" command to handle it',
					resolveAction
				);
			} else {
				vscode.window.showErrorMessage(errorMsg);
			}
		}
	});

	register('git-assistant.renameBranch', async () => {
		const ctx = await getRepoContext(repoManager, extensionState, dataSource);
		if (!ctx) {
			vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
			return;
		}

		const branches = (ctx.repoInfo.branches || []).slice();
		const picked = await vscode.window.showQuickPick(branches, { placeHolder: '选择要重命名的分支' });
		if (!picked) return;

		const newName = await vscode.window.showInputBox({
			title: '重命名分支',
			prompt: `请输入分支 "${picked}" 的新名称`,
			value: picked
		} as any);
		if (!newName || newName === picked) return;

		const err = await dataSource.renameBranch(ctx.repo, picked, newName);
		if (err !== null) {
			vscode.window.showErrorMessage(`重命名分支失败：${err}`);
		} else {
			vscode.window.showInformationMessage(`已将分支 "${picked}" 重命名为 "${newName}"`);
		}
	});

	register('git-assistant.deleteBranch', async () => {
		const ctx = await getRepoContext(repoManager, extensionState, dataSource);
		if (!ctx) {
			vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
			return;
		}

		const candidates = (ctx.repoInfo.branches || []).filter((b) => b && b !== ctx.repoInfo.head);
		const picked = await vscode.window.showQuickPick(candidates, { placeHolder: '选择要删除的本地分支' });
		if (!picked) return;

		const confirm = await vscode.window.showWarningMessage(
			`确认要删除本地分支 "${picked}" 吗？该操作不可撤销。`,
			{ modal: true },
			'删除分支'
		);
		if (confirm !== '删除分支') return;

		const err = await dataSource.deleteBranch(ctx.repo, picked, false);
		if (err !== null) {
			vscode.window.showErrorMessage(`删除分支失败：${err}`);
		} else {
			vscode.window.showInformationMessage(`已删除分支 "${picked}"`);
		}
	});

	// 远程仓库（与 AssistantPanel 行为对齐）
	register('git-assistant.addRemote', async () => {
		const repo = await ensureRepo(repoManager, extensionState);
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

		const err = await dataSource.addRemote(repo, name, url, null, true);
		if (err !== null) {
			vscode.window.showErrorMessage(`添加远程仓库失败：${err}`);
		} else {
			vscode.window.showInformationMessage(`已添加远程仓库 "${name}" 并执行 fetch`);
		}
	});

	register('git-assistant.editRemote', async () => {
		const repo = await ensureRepo(repoManager, extensionState);
		if (!repo) return;

		const repoInfo = await dataSource.getRepoInfo(repo, true, false, []);
		const remotes = (repoInfo.remotes || []).slice();
		if (remotes.length === 0) {
			vscode.window.showErrorMessage('当前仓库未配置远程仓库，无法编辑。');
			return;
		}

		const remoteName = await vscode.window.showQuickPick(remotes, { placeHolder: '选择要编辑的远程仓库' });
		if (!remoteName) return;

		const newName = await vscode.window.showInputBox({
			title: '编辑远程仓库',
			prompt: `修改远程名称（当前：${remoteName}）。如果不想修改名称，请直接回车。`,
			value: remoteName
		} as any);

		// 与 AssistantPanel 保持一致：只支持重命名
		if (!newName || newName === remoteName) {
			vscode.window.showInformationMessage('当前只支持修改远程名称，如需修改 URL 请使用 Gitly 配置界面。');
			return;
		}

		const err = await dataSource.editRemote(repo, remoteName, newName, null, null, null, null);
		if (err !== null) {
			vscode.window.showErrorMessage(`编辑远程仓库失败：${err}`);
		} else {
			vscode.window.showInformationMessage(`已将远程 "${remoteName}" 重命名为 "${newName}"`);
		}
	});

	register('git-assistant.deleteRemote', async () => {
		const repo = await ensureRepo(repoManager, extensionState);
		if (!repo) return;

		const repoInfo = await dataSource.getRepoInfo(repo, true, false, []);
		const remotes = (repoInfo.remotes || []).slice();
		if (remotes.length === 0) {
			vscode.window.showErrorMessage('当前仓库未配置远程仓库，无法删除。');
			return;
		}

		const remoteName = await vscode.window.showQuickPick(remotes, { placeHolder: '选择要删除的远程仓库' });
		if (!remoteName) return;

		const confirm = await vscode.window.showWarningMessage(
			`确认要删除远程仓库 "${remoteName}" 吗？不会删除远程服务器上的仓库，但会移除本地配置。`,
			{ modal: true },
			'删除远程'
		);
		if (confirm !== '删除远程') return;

		const err = await dataSource.deleteRemote(repo, remoteName);
		if (err !== null) {
			vscode.window.showErrorMessage(`删除远程仓库失败：${err}`);
		} else {
			vscode.window.showInformationMessage(`已删除远程仓库 "${remoteName}"`);
		}
	});

	// 标签管理
	register('git-assistant.createTag', async () => {
		const ctx = await getRepoContext(repoManager, extensionState, dataSource);
		if (!ctx) {
			vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
			return;
		}

		const vscodeLanguage = vscode.env.language;
		const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

		const tagName = await vscode.window.showInputBox({
			title: normalisedLanguage === 'zh-CN' ? '创建标签' : 'Create Tag',
			prompt: normalisedLanguage === 'zh-CN' ? '请输入标签名称（例如 v1.0.0）' : 'Enter tag name (e.g., v1.0.0)',
			placeHolder: 'v1.0.0',
			validateInput: (value: string) => {
				if (!value) {
					return normalisedLanguage === 'zh-CN' ? '标签名称不能为空' : 'Tag name cannot be empty';
				}
				if (!/^[a-zA-Z0-9/._-]+$/.test(value)) {
					return normalisedLanguage === 'zh-CN'
						? '标签名称只能包含字母、数字、下划线、横线、点和斜线'
						: 'Tag name can only contain letters, numbers, underscores, hyphens, dots, and slashes';
				}
				return null;
			}
		} as any);
		if (!tagName) return;

        interface TagTypePickItem extends vscode.QuickPickItem { value: TagType }
        const typePick = await vscode.window.showQuickPick<TagTypePickItem>(
            [
            	{
            		label: normalisedLanguage === 'zh-CN' ? '$(tag) 带注释的标签' : '$(tag) Annotated Tag',
            		description: normalisedLanguage === 'zh-CN' ? '推荐：包含版本说明' : 'Recommended: includes version description',
            		value: TagType.Annotated
            	},
            	{
            		label: normalisedLanguage === 'zh-CN' ? '$(tag) 轻量级标签' : '$(tag) Lightweight Tag',
            		description: normalisedLanguage === 'zh-CN' ? '简单引用' : 'Simple reference',
            		value: TagType.Lightweight
            	}
            ] as any,
            { placeHolder: normalisedLanguage === 'zh-CN' ? '选择标签类型' : 'Select tag type' }
        );
        if (!typePick) return;

        let message = '';
        if (typePick.value === TagType.Annotated) {
        	message = (await vscode.window.showInputBox({
        		title: normalisedLanguage === 'zh-CN' ? '注释标签信息' : 'Annotated Tag Message',
        		prompt: normalisedLanguage === 'zh-CN' ? '请输入标签注释信息（可选）' : 'Enter tag annotation (optional)',
        		placeHolder: normalisedLanguage === 'zh-CN' ? '版本 1.0.0 发布' : 'Release version 1.0.0'
        	} as any)) || '';
        	if (!message) {
        		message = `Tag ${tagName}`;
        	}
        }

        // 询问是否指向特定提交
        const commitChoice = await vscode.window.showQuickPick(
        	[
        		{ label: normalisedLanguage === 'zh-CN' ? '$(circle-filled) 当前提交' : '$(circle-filled) Current commit', value: 'current' },
        		{ label: normalisedLanguage === 'zh-CN' ? '$(git-commit) 指定提交' : '$(git-commit) Specific commit', value: 'specific' }
        	],
        	{ placeHolder: normalisedLanguage === 'zh-CN' ? '选择标签指向的提交' : 'Select commit for tag' }
        );

        if (!commitChoice) {
        	return;
        }

        let commitHash: string | undefined;
        if (commitChoice.value === 'specific') {
        	// 获取最近的提交列表
        	const commits = ctx.commitData.commits || [];
        	const items = commits.slice(0, 20).map(commit => ({
        		label: `$(git-commit) ${commit.hash.substring(0, 8)}`,
        		description: commit.message.split('\n')[0],
        		commit: commit.hash
        	}));

        	const selected = await vscode.window.showQuickPick(items, {
        		placeHolder: normalisedLanguage === 'zh-CN' ? '选择要打标签的提交' : 'Select commit to tag'
        	});

        	if (!selected) {
        		return;
        	}

        	commitHash = (selected as unknown as { commit: string }).commit;
        } else {
        	commitHash = ctx.commitData.head || 'HEAD';
        }

        const err = await dataSource.addTag(ctx.repo, tagName, commitHash, typePick.value, message, false);
        if (err !== null) {
        	vscode.window.showErrorMessage(`创建标签失败：${err}`);
        } else {
        	const tagInfo = message ? `标签 "${tagName}" (${message})` : `标签 "${tagName}"`;
        	const msg = normalisedLanguage === 'zh-CN'
        		? `✅ ${tagInfo} 创建成功`
        		: `✅ ${tagInfo} created successfully`;
        	vscode.window.showInformationMessage(msg);
        	// 等待一小段时间确保 Git 操作完成后再刷新
        	await new Promise(resolve => setTimeout(resolve, 300));
        	if (assistantPanel) {
        		await assistantPanel.sendInitialData();
        	}
        }
	});

	register('git-assistant.listTags', async () => {
		const ctx = await getRepoContext(repoManager, extensionState, dataSource);
		if (!ctx) {
			vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
			return;
		}

		const tags = getTagNamesFromCommits(ctx.commitData.commits);
		if (tags.length === 0) {
			vscode.window.showInformationMessage('当前仓库暂无标签。');
			return;
		}

		await vscode.window.showQuickPick(tags, { placeHolder: '当前仓库标签' });
	});

	register('git-assistant.deleteTag', async () => {
		const ctx = await getRepoContext(repoManager, extensionState, dataSource);
		if (!ctx) {
			vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
			return;
		}

		const vscodeLanguage = vscode.env.language;
		const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

		const tags = getTagNamesFromCommits(ctx.commitData.commits);
		if (tags.length === 0) {
			const msg = normalisedLanguage === 'zh-CN'
				? '当前仓库没有标签'
				: 'Current repository has no tags';
			vscode.window.showInformationMessage(msg);
			return;
		}

		const items = tags.map(tag => ({
			label: `$(tag) ${tag}`,
			description: '',
			tag: tag
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: normalisedLanguage === 'zh-CN' ? '选择要删除的标签' : 'Select tag to delete'
		});

		if (!selected) {
			return;
		}

		const selectedTag = (selected as unknown as { tag: string }).tag;

		// 确认删除
		const deleteAction = normalisedLanguage === 'zh-CN' ? '删除' : 'Delete';
		const confirmed = await vscode.window.showWarningMessage(
			normalisedLanguage === 'zh-CN'
				? `确定要删除标签 "${selectedTag}" 吗？此操作无法撤销。`
				: `Are you sure you want to delete tag "${selectedTag}"? This operation cannot be undone.`,
			{ modal: true },
			deleteAction
		);

		if (confirmed !== deleteAction) {
			return;
		}

		// 询问是否同时删除远程标签
		const repoInfo = await dataSource.getRepoInfo(ctx.repo, true, false, []);
		const remotes = (repoInfo.remotes || []).slice();

		if (remotes.length > 0) {
			const deleteRemote = await vscode.window.showQuickPick(
				[
					{ label: normalisedLanguage === 'zh-CN' ? '$(check) 仅删除本地标签' : '$(check) Delete local tag only', value: 'local' },
					{ label: normalisedLanguage === 'zh-CN' ? '$(cloud) 同时删除远程标签' : '$(cloud) Delete both local and remote tags', value: 'both' }
				],
				{ placeHolder: normalisedLanguage === 'zh-CN' ? '选择删除范围' : 'Select deletion scope' }
			);

			if (!deleteRemote) {
				return;
			}

			// 删除本地标签
			const err = await dataSource.deleteTag(ctx.repo, selectedTag, null);
			if (err !== null) {
				vscode.window.showErrorMessage(`删除标签失败：${err}`);
				return;
			}

			// 如果需要，删除远程标签
			if ((deleteRemote as unknown as { value: string }).value === 'both') {
				try {
					const remote = remotes[0]; // 使用第一个远程
					// 使用终端执行删除远程标签的命令
					const err2 = await dataSource.openGitTerminal(
						ctx.repo,
						`push ${remote} :refs/tags/${selectedTag}`,
						normalisedLanguage === 'zh-CN' ? `删除远程标签 ${selectedTag}` : `Delete remote tag ${selectedTag}`
					);
					if (err2 !== null) {
						vscode.window.showWarningMessage(
							normalisedLanguage === 'zh-CN'
								? `本地标签已删除，但删除远程标签失败: ${err2}`
								: `Local tag deleted, but failed to delete remote tag: ${err2}`
						);
					} else {
						const msg = normalisedLanguage === 'zh-CN'
							? `✅ 标签 "${selectedTag}" 已从本地和远程删除`
							: `✅ Tag "${selectedTag}" deleted from both local and remote`;
						vscode.window.showInformationMessage(msg);
					}
				} catch (remoteError) {
					vscode.window.showWarningMessage(
						normalisedLanguage === 'zh-CN'
							? `本地标签已删除，但删除远程标签失败: ${remoteError}`
							: `Local tag deleted, but failed to delete remote tag: ${remoteError}`
					);
				}
			} else {
				const msg = normalisedLanguage === 'zh-CN'
					? `✅ 本地标签 "${selectedTag}" 已删除`
					: `✅ Local tag "${selectedTag}" deleted`;
				vscode.window.showInformationMessage(msg);
			}
		} else {
			// 没有远程仓库，只删除本地标签
			const err = await dataSource.deleteTag(ctx.repo, selectedTag, null);
			if (err !== null) {
				vscode.window.showErrorMessage(`删除标签失败：${err}`);
			} else {
				const msg = normalisedLanguage === 'zh-CN'
					? `✅ 本地标签 "${selectedTag}" 已删除`
					: `✅ Local tag "${selectedTag}" deleted`;
				vscode.window.showInformationMessage(msg);
			}
		}
	});

	register('git-assistant.pushTag', async () => {
		const ctx = await getRepoContext(repoManager, extensionState, dataSource);
		if (!ctx) {
			vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
			return;
		}

		const vscodeLanguage = vscode.env.language;
		const normalisedLanguage = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

		const remotes = (ctx.repoInfo.remotes || []).slice();
		if (remotes.length === 0) {
			const msg = normalisedLanguage === 'zh-CN'
				? '当前仓库没有配置远程仓库'
				: 'Current repository has no remote configured';
			vscode.window.showWarningMessage(msg);
			return;
		}

		const remote = remotes[0]; // 使用第一个远程

		// 询问推送方式
		const pushType = await vscode.window.showQuickPick(
			[
				{ label: normalisedLanguage === 'zh-CN' ? '$(tag) 推送单个标签' : '$(tag) Push single tag', value: 'single' },
				{ label: normalisedLanguage === 'zh-CN' ? '$(tags) 推送所有标签' : '$(tags) Push all tags', value: 'all' }
			],
			{ placeHolder: normalisedLanguage === 'zh-CN' ? '选择推送方式' : 'Select push method' }
		);

		if (!pushType) {
			return;
		}

		if ((pushType as unknown as { value: string }).value === 'all') {
			// 推送所有标签
			const pushAction = normalisedLanguage === 'zh-CN' ? '推送' : 'Push';
			const confirmed = await vscode.window.showWarningMessage(
				normalisedLanguage === 'zh-CN'
					? `确定要推送所有标签到远程仓库 "${remote}" 吗？`
					: `Are you sure you want to push all tags to remote "${remote}"?`,
				{ modal: true },
				pushAction
			);

			if (confirmed !== pushAction) {
				return;
			}

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: normalisedLanguage === 'zh-CN' ? `正在推送所有标签到 ${remote}...` : `Pushing all tags to ${remote}...`,
					cancellable: false
				},
				async (progress) => {
					progress.report({ increment: 30 });
					const err = await dataSource.openGitTerminal(
						ctx.repo,
						`push ${remote} --tags`,
						normalisedLanguage === 'zh-CN' ? `推送所有标签 (${remote})` : `Push all tags (${remote})`
					);
					progress.report({ increment: 70 });
					if (err !== null) {
						throw new Error(err);
					}
				}
			);

			const msg = normalisedLanguage === 'zh-CN'
				? `✅ 所有标签已推送到 ${remote}`
				: `✅ All tags pushed to ${remote}`;
			vscode.window.showInformationMessage(msg);
		} else {
			// 推送单个标签
			const tags = getTagNamesFromCommits(ctx.commitData.commits);
			if (tags.length === 0) {
				const msg = normalisedLanguage === 'zh-CN'
					? '当前仓库没有标签'
					: 'Current repository has no tags';
				vscode.window.showInformationMessage(msg);
				return;
			}

			const items = tags.map(tag => ({
				label: `$(tag) ${tag}`,
				description: '',
				tag: tag
			}));

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: normalisedLanguage === 'zh-CN' ? '选择要推送的标签' : 'Select tag to push'
			});

			if (!selected) {
				return;
			}

			const selectedTag = (selected as unknown as { tag: string }).tag;

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: normalisedLanguage === 'zh-CN' ? `正在推送标签 "${selectedTag}" 到 ${remote}...` : `Pushing tag "${selectedTag}" to ${remote}...`,
					cancellable: false
				},
				async (progress) => {
					progress.report({ increment: 30 });
					const headHash = ctx.commitData.head || 'HEAD';
					const results = await dataSource.pushTag(ctx.repo, selectedTag, [remote], headHash, true);
					const err = results.find((x) => x !== null) || null;
					progress.report({ increment: 70 });
					if (err !== null) {
						throw new Error(err);
					}
				}
			);

			const msg = normalisedLanguage === 'zh-CN'
				? `✅ 标签 "${selectedTag}" 已推送到 ${remote}`
				: `✅ Tag "${selectedTag}" pushed to ${remote}`;
			vscode.window.showInformationMessage(msg);
		}
	});

	register('git-assistant.pushAllTags', async () => {
		const repo = await ensureRepo(repoManager, extensionState);
		if (!repo) return;

		const pickedRemote = await pickRemote(repo, dataSource, '选择要推送到的远程');
		if (!pickedRemote) return;

		const confirm = await vscode.window.showWarningMessage(
			`确认将所有本地标签推送到远程 "${pickedRemote}" 吗？（git push ${pickedRemote} --tags）`,
			{ modal: true },
			'确认推送'
		);
		if (confirm !== '确认推送') return;

		const err = await dataSource.openGitTerminal(repo, `push ${pickedRemote} --tags`, `Push Tags (${pickedRemote})`);
		if (err !== null) {
			vscode.window.showErrorMessage(`推送所有标签失败：${err}`);
		} else {
			vscode.window.showInformationMessage(`已在终端执行推送所有标签到 "${pickedRemote}"`);
		}
	});

	// 冲突处理（最小可用：提供 merge --abort）
	register('git-assistant.resolveConflicts', async () => {
		const repo = await ensureRepo(repoManager, extensionState);
		if (!repo) return;

		const confirm = await vscode.window.showWarningMessage(
			'将执行 git merge --abort 以终止合并并退出冲突状态（如果当前正在合并）。确认继续？',
			{ modal: true },
			'确认执行'
		);
		if (confirm !== '确认执行') return;

		// dataSource 没有暴露 merge --abort，使用内置 Git 命令（若无则提示）
		await executeBuiltinGitCommand('git.mergeAbort');
	});

	// 兼容：部分前端/历史可能会调用这个 id
	register('git-assistant.quickPushToOrigin', async () => {
		const ctx = await getRepoContext(repoManager, extensionState, dataSource);
		if (!ctx) return;
		if (!ctx.repoInfo.head) {
			vscode.window.showErrorMessage('无法识别当前分支，无法推送。');
			return;
		}
		const err = await dataSource.pushBranch(ctx.repo, ctx.repoInfo.head, 'origin', false, GitPushBranchMode.Normal);
		if (err !== null) vscode.window.showErrorMessage(`推送失败：${err}`);
	});
}



