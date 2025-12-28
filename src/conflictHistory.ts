import * as vscode from 'vscode';

export interface ConflictHistoryItem {
    id: string;
    timestamp: number;
    file: string;
    action: 'current' | 'incoming' | 'both';
    conflictsCount: number;
    repo?: string; // 添加仓库路径字段
}

/**
 * 冲突解决历史记录管理器（按仓库隔离）
 */
export class ConflictHistory {
	private static readonly STORAGE_KEY = 'gitly.conflictHistory';
	private static readonly MAX_HISTORY = 50;
	private static context: vscode.ExtensionContext | null = null;
	// 按仓库路径存储历史：key = 仓库路径，value = 历史记录数组
	private static historyByRepo: Map<string, ConflictHistoryItem[]> = new Map();

	public static initialize(context: vscode.ExtensionContext) {
		this.context = context;
		const stored = context.globalState.get<Record<string, ConflictHistoryItem[]>>(this.STORAGE_KEY);
		if (stored) {
			// 迁移旧数据格式（如果存在）
			if (Array.isArray(stored)) {
				// 旧格式：直接是数组，迁移到新格式
				const oldHistory = stored as unknown as ConflictHistoryItem[];
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

	public static recordResolved(repo: string, item: Omit<ConflictHistoryItem, 'id' | 'timestamp' | 'repo'>) {
		const entry: ConflictHistoryItem = {
			...item,
			repo,
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			timestamp: Date.now()
		};

		let history = this.historyByRepo.get(repo) || [];
		history.unshift(entry);
		if (history.length > this.MAX_HISTORY) {
			history = history.slice(0, this.MAX_HISTORY);
		}
		this.historyByRepo.set(repo, history);
		this.save();
	}

	public static getHistory(repo: string, limit?: number): ConflictHistoryItem[] {
		const history = this.historyByRepo.get(repo) || [];
		const result = [...history];
		return limit ? result.slice(0, limit) : result;
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
			const data: Record<string, ConflictHistoryItem[]> = {};
			for (const [repo, history] of this.historyByRepo.entries()) {
				data[repo] = history;
			}
			await this.context.globalState.update(this.STORAGE_KEY, data);
		}
	}
}

