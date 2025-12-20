import * as vscode from 'vscode';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { RepoManager } from './repoManager';
import { GitRepoSet, GitResetMode, RepoCommitOrdering, CommitOrdering, BooleanOverride, TagType, GitPushBranchMode } from './types';
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

export function registerAssistantCommands(
    context: vscode.ExtensionContext,
    repoManager: RepoManager,
    dataSource: DataSource,
    extensionState: ExtensionState
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

            const status = repo.state;
            const workingChanges = status.workingTreeChanges || [];
            if (workingChanges.length === 0) {
                vscode.window.showInformationMessage('没有需要添加的文件');
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
            vscode.window.showInformationMessage(`✅ 已添加 ${selected.length} 个文件到暂存区`);
        } catch {
            // 发生错误时退回到内置命令
            await executeBuiltinGitCommand('git.stageAll');
        }
    });
    register('git-assistant.unstageFiles', async () => executeBuiltinGitCommand('git.unstageAll'));

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

    // 提交操作
    register('git-assistant.commitChanges', async () => executeBuiltinGitCommand('git.commit'));
    register('git-assistant.commitAllChanges', async () => executeBuiltinGitCommand('git.commitAll'));

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
        try {
            const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
            const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
            const repo = api?.repositories && api.repositories[0];
            if (!repo) {
                await executeBuiltinGitCommand('git.push');
                return;
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

            if (!hasUnpushedCommits && !tracking) {
                // HEAD 存在但未设置上游，认为可能有本地提交
                hasCommitsToPush = !!head.commit;
            }

            if (!hasUncommittedChanges && !hasCommitsToPush) {
                vscode.window.showInformationMessage('没有需要推送的更改或提交');
                return;
            }

            const config = vscode.workspace.getConfiguration('git-assistant');
            const needConfirm = config.get('confirmPush', true);
            let message = '';

            if (hasUncommittedChanges && hasCommitsToPush) {
                message = `有未提交的更改，并且分支 "${branch}" 有待推送的提交。推送只会上传已提交的内容。`;
            } else if (hasCommitsToPush) {
                message = tracking
                    ? `准备推送 ${ahead} 个提交到上游 ${tracking}`
                    : `准备推送本地提交到远程仓库（将设置上游分支）。`;
            } else {
                message = '有未提交的更改，请先提交后再推送。';
                vscode.window.showWarningMessage(message);
                return;
            }

            if (needConfirm && hasCommitsToPush) {
                const choice = await vscode.window.showWarningMessage(
                    message,
                    { modal: true },
                    '推送'
                );
                if (choice !== '推送') return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `正在推送分支 ${branch}...`,
                    cancellable: false
                },
                async () => {
                    await vscode.commands.executeCommand('git.push');
                }
            );

            vscode.window.showInformationMessage('✅ 推送完成');
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`推送失败：${msg}`);
            await executeBuiltinGitCommand('git.push');
        }
    });

    register('git-assistant.quickPull', async () => {
        let hasStashed = false;
        try {
            const gitExt = await vscode.extensions.getExtension<any>('vscode.git')?.activate();
            const api = gitExt?.getAPI ? gitExt.getAPI(1) : gitExt;
            const repo = api?.repositories && api.repositories[0];
            if (!repo) {
                await executeBuiltinGitCommand('git.pull');
                return;
            }

            const state = repo.state as any;
            const workingChanges = state.workingTreeChanges || [];

            if (workingChanges.length > 0) {
                const choice = await vscode.window.showWarningMessage(
                    '有未提交的更改，是否先暂存(stash)？',
                    '暂存并拉取',
                    '直接拉取',
                    '取消'
                );
                if (!choice || choice === '取消') return;
                if (choice === '暂存并拉取') {
                    await repo.createStash('Stash before quick pull');
                    hasStashed = true;
                }
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: '正在从远程拉取...',
                    cancellable: false
                },
                async () => {
                    await vscode.commands.executeCommand('git.pull');
                }
            );

            if (hasStashed) {
                try {
                    const stashes = repo.state.stashes || [];
                    if (stashes.length > 0) {
                        await repo.popStash();
                    }
                } catch {
                    await vscode.window.showWarningMessage(
                        '拉取成功，但恢复暂存时遇到问题，请手动运行 git stash pop 并处理可能的冲突。'
                    );
                }
            }

            vscode.window.showInformationMessage('✅ 拉取成功');
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            vscode.window.showErrorMessage(`拉取失败：${msg}`);
            if (hasStashed) {
                await vscode.window.showWarningMessage(
                    '拉取失败，但更改已被暂存，可以使用 git stash pop 手动恢复。'
                );
            }
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

        const tagName = await vscode.window.showInputBox({
            title: '创建标签',
            prompt: '请输入标签名称（例如 v1.0.0）',
            placeHolder: 'v1.0.0'
        } as any);
        if (!tagName) return;

        interface TagTypePickItem extends vscode.QuickPickItem { value: TagType }
        const typePick = await vscode.window.showQuickPick<TagTypePickItem>(
            [
                { label: '轻量标签', value: TagType.Lightweight },
                { label: '注释标签', value: TagType.Annotated }
            ] as any,
            { placeHolder: '选择要创建的标签类型' }
        );
        if (!typePick) return;

        let message = '';
        if (typePick.value === TagType.Annotated) {
            message = (await vscode.window.showInputBox({
                title: '注释标签信息',
                prompt: '请输入标签注释信息',
                placeHolder: 'release: v1.0.0'
            } as any)) || '';
        }

        const headHash = ctx.commitData.head || 'HEAD';
        const err = await dataSource.addTag(ctx.repo, tagName, headHash, typePick.value, message, false);
        if (err !== null) {
            vscode.window.showErrorMessage(`创建标签失败：${err}`);
        } else {
            vscode.window.showInformationMessage(`已创建标签 "${tagName}"`);
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

        const tags = getTagNamesFromCommits(ctx.commitData.commits);
        const picked = await vscode.window.showQuickPick(tags, { placeHolder: '选择要删除的标签' });
        if (!picked) return;

        const confirm = await vscode.window.showWarningMessage(
            `确认删除本地标签 "${picked}" 吗？`,
            { modal: true },
            '删除标签'
        );
        if (confirm !== '删除标签') return;

        const err = await dataSource.deleteTag(ctx.repo, picked, null);
        if (err !== null) {
            vscode.window.showErrorMessage(`删除标签失败：${err}`);
        } else {
            vscode.window.showInformationMessage(`已删除标签 "${picked}"`);
        }
    });

    register('git-assistant.pushTag', async () => {
        const ctx = await getRepoContext(repoManager, extensionState, dataSource);
        if (!ctx) {
            vscode.window.showWarningMessage('当前未检测到 Git 仓库，无法执行该操作。');
            return;
        }

        const tags = getTagNamesFromCommits(ctx.commitData.commits);
        const pickedTag = await vscode.window.showQuickPick(tags, { placeHolder: '选择要推送的标签' });
        if (!pickedTag) return;

        const remotes = (ctx.repoInfo.remotes || []).slice();
        if (remotes.length === 0) {
            vscode.window.showErrorMessage('当前仓库未配置远程仓库，无法推送标签。');
            return;
        }

        const pickedRemote = await vscode.window.showQuickPick(remotes, { placeHolder: '选择要推送到的远程' });
        if (!pickedRemote) return;

        const headHash = ctx.commitData.head || 'HEAD';
        const results = await dataSource.pushTag(ctx.repo, pickedTag, [pickedRemote], headHash, true);
        const err = results.find((x) => x !== null) || null;
        if (err !== null) {
            vscode.window.showErrorMessage(`推送标签失败：${err}`);
        } else {
            vscode.window.showInformationMessage(`已推送标签 "${pickedTag}" 到远程 "${pickedRemote}"`);
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


