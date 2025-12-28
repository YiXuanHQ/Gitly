import * as vscode from 'vscode';

export interface AssistantCommandHistoryItem {
    readonly id: string;
    readonly command: string;
    readonly commandName: string;
    readonly timestamp: number;
    readonly success: boolean;
    readonly error?: string;
    readonly remote?: string;
    readonly repo?: string; // 添加仓库路径字段
}

export interface AssistantCommandInfo {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly icon: string;
    readonly category: string;
    readonly requires: 'none' | 'repository' | 'commits' | 'conflicts';
}

export interface AssistantCommandCategory {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly icon: string;
}

/**
 * 面向 Assistant 面板的命令历史与可用命令数据（适配code-git-assistant）?
 * 支持按仓库路径隔离历史记录
 */
export class AssistantCommandHistory {
	private static readonly MAX_HISTORY = 50;
	private static readonly STORAGE_KEY = 'gitly.assistant.commandHistory';
	// 按仓库路径存储历史：key = 仓库路径，value = 历史记录数组
	private static historyByRepo: Map<string, AssistantCommandHistoryItem[]> = new Map();
	private static context: vscode.ExtensionContext | null = null;

	public static initialize(context: vscode.ExtensionContext) {
		this.context = context;
		const stored = context.globalState.get<Record<string, AssistantCommandHistoryItem[]> | AssistantCommandHistoryItem[]>(this.STORAGE_KEY);
		if (stored) {
			// 迁移旧数据格式（如果存在）
			if (Array.isArray(stored)) {
				// 旧格式：直接是数组，迁移到新格式
				const oldHistory = stored as AssistantCommandHistoryItem[];
				if (oldHistory.length > 0) {
					// 将旧数据放入一个默认键中，或者丢弃（因为没有仓库信息）
					// 这里选择丢弃旧数据，因为无法确定属于哪个仓库
				}
			} else {
				// 新格式：按仓库路径存储的对象
				for (const [repo, history] of Object.entries(stored)) {
					this.historyByRepo.set(repo, history);
				}
			}
		}
	}

	public static add(repo: string | null, entry: Omit<AssistantCommandHistoryItem, 'id' | 'timestamp' | 'repo'>) {
		// 如果没有仓库路径，跳过记录（某些命令可能不需要仓库）
		if (!repo) {
			return;
		}

		const item: AssistantCommandHistoryItem = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
			repo,
			...entry
		};

		let history = this.historyByRepo.get(repo) || [];
		history.unshift(item);
		if (history.length > this.MAX_HISTORY) {
			history = history.slice(0, this.MAX_HISTORY);
		}
		this.historyByRepo.set(repo, history);
		this.save();
	}

	public static getHistory(repo: string | null, limit: number = 20): AssistantCommandHistoryItem[] {
		if (!repo) {
			return [];
		}
		const history = this.historyByRepo.get(repo) || [];
		return history.slice(0, limit);
	}

	public static clear(repo?: string) {
		if (repo) {
			// 清除指定仓库的历史
			this.historyByRepo.delete(repo);
		} else {
			// 清除所有仓库的历史
			this.historyByRepo.clear();
		}
		this.save();
	}

	private static async save() {
		if (this.context) {
			// 将 Map 转换为对象以便存储
			const data: Record<string, AssistantCommandHistoryItem[]> = {};
			for (const [repo, history] of this.historyByRepo.entries()) {
				data[repo] = history;
			}
			await this.context.globalState.update(this.STORAGE_KEY, data);
		}
	}

	/**
     * 提供给前端使用的「可用命令」数据
     * 这里保持命令 id 与扩展中的命令一致（git-assistant.*），方便前端根据仓库状态控制可用性
     */
	public static getAvailableCommands(): AssistantCommandInfo[] {
		return [
			// 开始使用 - 不需要已有仓库
			{
				id: 'git-assistant.initRepository',
				name: '初始化仓库',
				description: '在当前文件夹初始化一个新的 Git 仓库 (git init)',
				icon: '📦',
				category: 'init',
				requires: 'none'
			},
			{
				id: 'git-assistant.quickClone',
				name: '克隆远程仓库',
				description: '从远程地址克隆 Git 仓库 (git clone)',
				icon: '📥',
				category: 'init',
				requires: 'none'
			},

			// 仓库配置 - 需要已有仓库
			{
				id: 'git-assistant.addRemote',
				name: '添加远程仓库',
				description: '为当前仓库添加远程地址 (git remote add)',
				icon: '🌐',
				category: 'setup',
				requires: 'repository'
			},
			{
				id: 'git-assistant.editRemote',
				name: '编辑远程仓库',
				description: '重命名远程或修改远程 URL (git remote rename / set-url)',
				icon: '✏️',
				category: 'setup',
				requires: 'repository'
			},
			{
				id: 'git-assistant.deleteRemote',
				name: '删除远程仓库',
				description: '删除本地远程配置 (git remote remove)',
				icon: '🗑️',
				category: 'setup',
				requires: 'repository'
			},

			// 更改管理 - 需要仓库
			{
				id: 'git-assistant.addFiles',
				name: '暂存更改',
				description: '将文件加入暂存区 (git add)',
				icon: '➕',
				category: 'changes',
				requires: 'repository'
			},
			{
				id: 'git-assistant.unstageFiles',
				name: '取消暂存',
				description: '从暂存区移除文件 (git reset HEAD)',
				icon: '↩️',
				category: 'changes',
				requires: 'repository'
			},
			{
				id: 'git-assistant.discardChanges',
				name: '丢弃更改',
				description: '丢弃工作区中的本地更改 (git checkout -- <file>)',
				icon: '🗑️',
				category: 'changes',
				requires: 'repository'
			},

			// 提交操作
			{
				id: 'git-assistant.commitChanges',
				name: '提交暂存更改',
				description: '提交已经暂存的更改 (git commit)',
				icon: '✅',
				category: 'commit',
				requires: 'repository'
			},
			{
				id: 'git-assistant.commitAllChanges',
				name: '提交所有更改',
				description: '直接提交所有已修改文件 (git commit -a)',
				icon: '📝',
				category: 'commit',
				requires: 'repository'
			},
			{
				id: 'git-assistant.undoLastCommit',
				name: '撤销上一次提交',
				description: '保留更改，撤销最近一次提交 (git reset HEAD~1 --soft)',
				icon: '↩️',
				category: 'commit',
				requires: 'commits'
			},

			// 同步操作
			{
				id: 'git-assistant.quickPush',
				name: '快速推送',
				description: '将当前分支推送到远程仓库 (git push)',
				icon: '📤',
				category: 'sync',
				requires: 'commits'
			},
			{
				id: 'git-assistant.quickPull',
				name: '快速拉取',
				description: '从远程仓库拉取最新提交 (git pull)',
				icon: '📥',
				category: 'sync',
				requires: 'commits'
			},

			// 分支管理
			{
				id: 'git-assistant.createBranch',
				name: '创建分支',
				description: '基于当前 HEAD 创建新分支 (git branch)',
				icon: '🌿',
				category: 'branch',
				requires: 'commits'
			},
			{
				id: 'git-assistant.switchBranch',
				name: '切换分支',
				description: '切换到指定分支 (git checkout)',
				icon: '🔀',
				category: 'branch',
				requires: 'commits'
			},
			{
				id: 'git-assistant.mergeBranch',
				name: '合并分支',
				description: '将其它分支合并到当前分支 (git merge)',
				icon: '🔃',
				category: 'branch',
				requires: 'commits'
			},
			{
				id: 'git-assistant.renameBranch',
				name: '重命名分支',
				description: '重命名本地分支 (git branch -m)',
				icon: '✏️',
				category: 'branch',
				requires: 'commits'
			},
			{
				id: 'git-assistant.deleteBranch',
				name: '删除分支',
				description: '删除本地分支 (git branch -d)',
				icon: '🗑️',
				category: 'branch',
				requires: 'commits'
			},

			// 标签管理
			{
				id: 'git-assistant.createTag',
				name: '创建标签',
				description: '为当前提交创建标签 (git tag)',
				icon: '🏷️',
				category: 'tag',
				requires: 'commits'
			},
			{
				id: 'git-assistant.listTags',
				name: '查看标签列表',
				description: '查看所有标签 (git tag -l)',
				icon: '📋',
				category: 'tag',
				requires: 'commits'
			},
			{
				id: 'git-assistant.deleteTag',
				name: '删除标签',
				description: '删除本地或远程标签 (git tag -d)',
				icon: '🗑️',
				category: 'tag',
				requires: 'commits'
			},
			{
				id: 'git-assistant.pushTag',
				name: '推送标签',
				description: '将标签推送到远程仓库 (git push --tags)',
				icon: '📤',
				category: 'tag',
				requires: 'commits'
			},
			{
				id: 'git-assistant.pushAllTags',
				name: '推送所有标签',
				description: '推送所有本地标签到远程仓库 (git push --tags)',
				icon: '📤',
				category: 'tag',
				requires: 'commits'
			},

			// 视图 / 状态
			{
				id: 'git-assistant.refreshBranches',
				name: '刷新分支列表',
				description: '刷新 Git 分支列表 (git branch)',
				icon: '🔄',
				category: 'view',
				requires: 'repository'
			},

			// 冲突处理
			{
				id: 'git-assistant.resolveConflicts',
				name: '解决合并冲突',
				description: '终止合并并帮助解决冲突 (git merge --abort)',
				icon: '⚠️',
				category: 'conflict',
				requires: 'conflicts'
			},

			// 工具
			{
				id: 'git-assistant.openDashboard',
				name: '打开控制面板',
				description: '打开 Gitly 控制面板',
				icon: '📊',
				category: 'tools',
				requires: 'none'
			}
		];
	}

	/**
     * 命令分类信息，供前端渲染分类分组
     */
	public static getCommandCategories(): AssistantCommandCategory[] {
		return [
			{
				id: 'init',
				name: '开始使用',
				description: '初始化仓库或克隆已有仓库',
				icon: '🚀'
			},
			{
				id: 'setup',
				name: '仓库配置',
				description: '配置远程仓库和首次推送',
				icon: '⚙️'
			},
			{
				id: 'changes',
				name: '更改管理',
				description: '管理工作区和暂存区的文件',
				icon: '📝'
			},
			{
				id: 'commit',
				name: '提交操作',
				description: '提交更改和撤销最近提交',
				icon: '✅'
			},
			{
				id: 'sync',
				name: '同步操作',
				description: '与远程仓库进行推送和拉取',
				icon: '🔄'
			},
			{
				id: 'branch',
				name: '分支管理',
				description: '创建、切换和合并分支',
				icon: '🌿'
			},
			{
				id: 'tag',
				name: '标签管理',
				description: '创建、查看和推送标签',
				icon: '🏷️'
			},
			{
				id: 'view',
				name: '视图与状态',
				description: '查看分支和历史状态',
				icon: '👀'
			},
			{
				id: 'conflict',
				name: '冲突处理',
				description: '发现并解决合并冲突',
				icon: '⚠️'
			},
			{
				id: 'tools',
				name: '辅助工具',
				description: 'Gitly 提供的综合工具',
				icon: '🧰'
			}
		];
	}
}



