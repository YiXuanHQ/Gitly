import * as vscode from 'vscode';

export interface ConflictHistoryItem {
    id: string;
    timestamp: number;
    file: string;
    action: 'current' | 'incoming' | 'both';
    conflictsCount: number;
}

/**
 * 冲突解决历史记录管理器
 */
export class ConflictHistory {
    private static readonly STORAGE_KEY = 'gitly.conflictHistory';
    private static readonly MAX_HISTORY = 50;
    private static context: vscode.ExtensionContext | null = null;
    private static history: ConflictHistoryItem[] = [];

    static initialize(context: vscode.ExtensionContext) {
        this.context = context;
        const stored = context.globalState.get<ConflictHistoryItem[]>(this.STORAGE_KEY);
        if (stored) {
            this.history = stored;
        }
    }

    static recordResolved(item: Omit<ConflictHistoryItem, 'id' | 'timestamp'>) {
        const entry: ConflictHistoryItem = {
            ...item,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now()
        };

        this.history.unshift(entry);
        if (this.history.length > this.MAX_HISTORY) {
            this.history = this.history.slice(0, this.MAX_HISTORY);
        }
        this.save();
    }

    static getHistory(limit?: number): ConflictHistoryItem[] {
        const history = [...this.history];
        return limit ? history.slice(0, limit) : history;
    }

    static clear() {
        this.history = [];
        this.save();
    }

    private static async save() {
        if (this.context) {
            await this.context.globalState.update(this.STORAGE_KEY, this.history);
        }
    }
}

