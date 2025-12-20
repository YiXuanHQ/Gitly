/**
 * 命令历史组件 - 显示已执行的快捷指令（分类显示）
 */

import { t, getCurrentLanguage } from '../i18n.js';

import { convertGitUrlToBrowserUrl } from '../utils/url.js';
import { escapeHtml } from '../utils/dom-utils.js';
import { GitData, CommandHistoryItem, Command, Category, RepositoryState } from '../types/git.js';

// 类型定义已移至 web/types/git.ts

export class CommandHistoryComponent {
    private container: HTMLElement;
    private data: GitData | null = null;
    private expandedCategories: Set<string> = new Set();
    private isClearingHistory: boolean = false;
    private previousHistoryLength: number = 0;

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }
        this.container = container;
    }

    remount(containerId: string, data: GitData | null) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }
        this.container = container;
        this.render(data);
    }

    render(data: GitData | null) {
        const previousHistoryLength = this.previousHistoryLength;
        this.data = data;
        if (!data) {
            this.container.innerHTML = `<div class="empty-state"><p>${t('common.loading')}</p></div>`;
            return;
        }

        // 检查历史是否已清空（在渲染前检查，确保状态正确恢复）
        const history = data?.commandHistory || [];
        if (history.length === 0 && previousHistoryLength > 0 && this.isClearingHistory) {
            this.isClearingHistory = false;
        }
        this.previousHistoryLength = history.length;

        this.container.innerHTML = this.getHtml();
        this.attachEventListeners();
    }

    private getHtml(): string {
        const history = this.data?.commandHistory || [];
        const commands = this.data?.availableCommands || [];
        const categories = this.data?.categories || [];
        const repositoryState = this.getRepositoryState();

        return `
            <div class="command-history">
                ${this.getSectionHeader()}
                ${this.getRepositoryStatusHtml(repositoryState)}
                ${this.getCommandsByCategoryHtml(categories, commands, repositoryState)}
                ${this.getHistoryHtml(history)}
            </div>
        `;
    }

    private formatCommandDescription(desc: string): string {
        const safe = escapeHtml(desc || '');
        return safe.replace(/\(([^)]+)\)\s*$/g, '<span class="command-cli">($1)</span>');
    }

    private getSectionHeader(): string {
        return `
            <div class="section-header">
                <div>
                    <h2>${t('commandHistory.title')}</h2>
                    <p class="section-description">
                        ${t('commandHistory.sectionDescription')}
                    </p>
                </div>
            </div>
        `;
    }

    private getRepositoryState(): RepositoryState {
        const data = this.data;
        if (!data) {
            return {
                isRepository: false,
                hasCommits: false,
                hasConflicts: false,
                hasRemote: false,
                hasUncommittedChanges: false,
                hasUnpushedCommits: false,
                currentBranch: null
            };
        }
        const isRepo = data.status !== undefined;
        const hasCommits = (data.log?.all?.length || 0) > 0;
        const hasConflicts = (data.status?.conflicted?.length || 0) > 0;
        const hasRemote = data?.remotes && data.remotes.length > 0;
        const hasUncommittedChanges = isRepo && data?.status && (
            (data.status.modified && data.status.modified.length > 0) ||
            (data.status.created && data.status.created.length > 0) ||
            (data.status.deleted && data.status.deleted.length > 0) ||
            (data.status.not_added && data.status.not_added.length > 0)
        );
        const hasUnpushedCommits = isRepo && data?.status && data.status.ahead > 0;
        const currentBranch = data?.currentBranch || data?.branches?.current || null;

        return {
            isRepository: isRepo || false,
            hasCommits: hasCommits || false,
            hasConflicts: hasConflicts || false,
            hasRemote: hasRemote || false,
            hasUncommittedChanges: hasUncommittedChanges || false,
            hasUnpushedCommits: hasUnpushedCommits || false,
            currentBranch: currentBranch || null
        };
    }

    private getRepositoryStatusHtml(state: RepositoryState): string {
        const data = this.data;
        const remotes = data?.remotes || [];
        const lang = getCurrentLanguage();

        return `
            <div class="repository-status ${state.isRepository ? 'active' : 'warning'}">
                <div class="status-header">
                    <strong>📌 ${t('commandHistory.repoStatusTitle')}</strong>
                </div>
                <div class="status-content">
                    ${!state.isRepository ? `
                        <div>${t('commandHistory.repoNotInitialized')}</div>
                    ` : `
                        <div class="status-item">
                            <span>${t('commandHistory.repoInitializedWithCommits')}</span>
                            ${state.currentBranch ? `<span>🌿 ${escapeHtml(state.currentBranch)}</span>` : ''}
                        </div>
                        ${!state.hasCommits ? `
                            <div>${t('commandHistory.repoInitializedNoCommits')}</div>
                        ` : `
                            <div>${t('commandHistory.repoInitializedWithCommits')}</div>
                        `}
                        ${!state.hasRemote ? `
                            <div>${t('commandHistory.noRemoteConfigured')}</div>
                        ` : `
                            <div>
                                <div>${t('commandHistory.hasRemote')}</div>
                                ${remotes.length > 0 ? `
                                    <div class="remote-list">
                                        ${remotes.map((remote: any) => {
            const remoteUrl = remote.refs?.fetch || remote.refs?.push || '';
            const browserUrl = convertGitUrlToBrowserUrl(remoteUrl);
            const isOrigin = remote.name === 'origin';
            return `
                                                <div class="remote-item ${browserUrl ? 'clickable' : ''} ${isOrigin ? 'active' : ''}" 
                                                     data-remote-url="${browserUrl || ''}"
                                                     title="${browserUrl ? `${t('commandHistory.openRemoteTooltipPrefix')}${browserUrl}` : t('commandHistory.openRemoteTooltipUnsupported')}">
                                                    <div class="remote-item-content">
                                                        <span class="remote-icon">🔗</span>
                                                        <span class="remote-label">${escapeHtml(remote.name)}: </span>
                                                        <span class="remote-url-text">${escapeHtml(remoteUrl)}</span>
                                                    </div>
                                                    ${browserUrl ? `<button class="remote-open-btn">${lang === 'zh-CN' ? '打开 →' : 'Open →'}</button>` : ''}
                                                </div>
                                            `;
        }).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `}
                        ${state.hasUncommittedChanges ? `<div>${t('commandHistory.uncommittedChanges')}</div>` : ''}
                        ${state.hasUnpushedCommits ? `<div>${t('commandHistory.unpushedCommits')}</div>` : ''}
                        ${state.hasConflicts ? `<div class="error-text">${t('commandHistory.hasConflicts')}</div>` : ''}
                        ${state.isRepository && state.hasCommits && state.hasRemote &&
                !state.hasUncommittedChanges && !state.hasUnpushedCommits && !state.hasConflicts ? `
                            <div class="success-text">${t('commandHistory.clean')}</div>
                        ` : ''}
                    `}
                </div>
            </div>
        `;
    }

    private getCommandsByCategoryHtml(categories: Category[], commands: Command[], state: RepositoryState): string {
        const lang = getCurrentLanguage();
        return `
            <div class="commands-section">
                <h3>${t('commandHistory.availableCommands')}</h3>
                ${categories.map(category => {
            const categoryCommands = commands.filter(cmd => cmd.category === category.id);
            const availableCommands = categoryCommands.filter(cmd => this.isCommandAvailable(cmd, state));

            if (availableCommands.length === 0) {
                return '';
            }

            const isExpanded = this.expandedCategories.has(category.id);

            const categoryNameKey = `category.${category.id}.name`;
            const categoryDescKey = `category.${category.id}.description`;
            const categoryName = t(categoryNameKey, category.name);
            const categoryDesc = t(categoryDescKey, category.description);

            return `
                        <div class="category-card">
                            <div class="category-header" data-category-id="${category.id}">
                                <div class="category-info">
                                    <span class="category-icon">${category.icon}</span>
                                    <div>
                                        <div class="category-name">${escapeHtml(categoryName)}</div>
                                        <div class="category-desc">${escapeHtml(categoryDesc)} ${lang === 'zh-CN' ? `（${availableCommands.length} 个可用）` : `(${availableCommands.length} available)`}</div>
                                    </div>
                                </div>
                                <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                            </div>
                            ${isExpanded ? `
                                <div class="category-content">
                                    <div class="commands-grid">
                                        ${categoryCommands.map(cmd => {
                const isAvailable = this.isCommandAvailable(cmd, state);
                const cmdNameKey = `command.${cmd.id}.name`;
                const cmdDescKey = `command.${cmd.id}.description`;
                const cmdName = t(cmdNameKey, cmd.name);
                const cmdDesc = t(cmdDescKey, cmd.description);
                const titleText = !isAvailable
                    ? t('commandHistory.unavailableCommandTooltip')
                    : escapeHtml(cmdDesc || '');
                return `
                                                <div class="command-card ${isAvailable ? 'available' : 'unavailable'}" 
                                                     data-command-id="${isAvailable ? cmd.id : ''}"
                                                     title="${titleText}">
                                                    <span class="command-icon">${cmd.icon}</span>
                                                    <div class="command-info">
                                                        <div class="command-name">
                                                            ${escapeHtml(cmdName)}
                                                            ${!isAvailable ? `<span class="unavailable-badge">${t('commandHistory.unavailableBadge')}</span>` : ''}
                                                        </div>
                                                        <div class="command-desc">${this.formatCommandDescription(cmdDesc)}</div>
                                                    </div>
                                                </div>
                                            `;
            }).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    private getHistoryHtml(history: CommandHistoryItem[]): string {
        return `
            <div class="history-section">
                <div class="history-header">
                    <h3>${t('commandHistory.historyTitle')}</h3>
                    <button class="primary-button" id="clear-history-btn" ${this.isClearingHistory ? 'disabled' : ''}>
                        ${this.isClearingHistory ? `<span class="mini-spinner"></span> ${t('commandHistory.clearingHistory')}` : t('commandHistory.clearHistory')}
                    </button>
                </div>
                ${history.length === 0 ? `
                    <div class="empty-state">
                        <p>${t('commandHistory.emptyHistoryTitle')}</p>
                        <p class="empty-hint">${t('commandHistory.emptyHistoryHint')}</p>
                    </div>
                ` : `
                    <div class="history-list">
                        ${history.map(item => `
                            <div class="history-item ${item.success ? 'success' : 'error'}">
                                <span class="history-icon">${item.success ? '✅' : '❌'}</span>
                                <div class="history-content">
                                    <div class="history-command ${item.success ? '' : 'error-text'}">
                                        ${escapeHtml(item.commandName)}
                                    </div>
                                    <div class="history-command-code">${escapeHtml(item.command)}</div>
                                    ${item.remote ? `
                                        <div class="history-remote">
                                            <span>☁️</span>
                                            <span>${t('commandHistory.remoteLabel')} ${escapeHtml(item.remote)}</span>
                                        </div>
                                    ` : ''}
                                    ${item.error ? `
                                        <div class="history-error">${t('commandHistory.errorPrefix')} ${escapeHtml(item.error)}</div>
                                    ` : ''}
                                </div>
                                <div class="history-time">${this.formatTime(item.timestamp)}</div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
    }

    private attachEventListeners() {
        // 分类折叠/展开
        this.container.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const categoryId = (e.currentTarget as HTMLElement).dataset.categoryId;
                if (categoryId) {
                    this.toggleCategory(categoryId);
                }
            });
        });

        // 命令执行
        this.container.querySelectorAll('.command-card.available').forEach(card => {
            card.addEventListener('click', (e) => {
                const commandId = (e.currentTarget as HTMLElement).dataset.commandId;
                if (commandId && window.vscode) {
                    window.vscode.postMessage({ command: 'executeCommand', commandId });
                }
            });
        });

        // 清空历史
        const clearBtn = this.container.querySelector('#clear-history-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (window.vscode && !this.isClearingHistory) {
                    this.isClearingHistory = true;
                    this.render(this.data);
                    window.vscode.postMessage({ command: 'clearHistory' });
                }
            });
        }

        // 远程仓库链接
        this.container.querySelectorAll('.remote-item.clickable').forEach(item => {
            item.addEventListener('click', (e) => {
                // 如果点击的是按钮，不阻止默认行为，让按钮处理
                if ((e.target as HTMLElement).closest('.remote-open-btn')) {
                    return;
                }
                const url = (e.currentTarget as HTMLElement).dataset.remoteUrl;
                if (url && window.vscode) {
                    window.vscode.postMessage({ command: 'openRemoteUrl', url });
                }
            });
        });

        // 远程仓库打开按钮
        this.container.querySelectorAll('.remote-open-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = (e.currentTarget as HTMLElement).closest('.remote-item');
                if (item) {
                    const url = item.getAttribute('data-remote-url');
                    if (url && window.vscode) {
                        window.vscode.postMessage({ command: 'openRemoteUrl', url });
                    }
                }
            });
        });

    }

    private toggleCategory(categoryId: string) {
        if (this.expandedCategories.has(categoryId)) {
            this.expandedCategories.delete(categoryId);
        } else {
            this.expandedCategories.add(categoryId);
        }
        this.render(this.data);
    }

    private isCommandAvailable(command: Command, state: RepositoryState): boolean {
        const { requires } = command;
        const { isRepository, hasCommits, hasConflicts } = state;

        switch (requires) {
            case 'none':
                return true;
            case 'repository':
                return isRepository;
            case 'commits':
                return isRepository && hasCommits;
            case 'conflicts':
                return isRepository && hasConflicts;
            default:
                return true;
        }
    }

    private formatTime(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        const lang = getCurrentLanguage();
        if (minutes < 1) return t('commandHistory.justNow');
        if (minutes < 60) return t('commandHistory.minutesAgo').replace('%s1', String(minutes));
        if (hours < 24) return t('commandHistory.hoursAgo').replace('%s1', String(hours));
        if (days < 7) return t('commandHistory.daysAgo').replace('%s1', String(days));
        const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
        return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
}
