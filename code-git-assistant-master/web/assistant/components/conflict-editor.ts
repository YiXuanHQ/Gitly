/**
 * 冲突编辑器组件
 */

import { escapeHtml } from '../utils/dom-utils.js';
import { t } from '../i18n.js';
import { GitData } from '../types/git.js';

export class ConflictEditorComponent {
    private container: HTMLElement;
    private data: GitData | null = null;
    private selectedFile: string | null = null;

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }
        this.container = container;
    }

    render(data: GitData | null) {
        this.data = data;
        if (!data) {
            this.container.innerHTML = '<div class="empty-state"><p>⚠️ 正在检测冲突...</p></div>';
            return;
        }
        this.container.innerHTML = this.getHtml();
        this.attachEventListeners();
    }

    private getHtml(): string {
        // 检查是否有仓库信息
        const hasRepo = this.data?.repositoryInfo?.path && 
            this.data.repositoryInfo.name !== '未检测到 Git 仓库' && 
            this.data.repositoryInfo.name !== 'No Git repository detected';
        
        // 如果没有仓库，显示提示信息
        if (!hasRepo) {
            return `<div class="empty-state"><p>${t('conflict.initRepoHint')}</p></div>`;
        }

        // 如果 conflicts 字段不存在（undefined），说明还在检测中
        if (this.data?.conflicts === undefined) {
            return `<div class="empty-state"><p>${t('conflict.checking')}</p></div>`;
        }

        const conflicts = this.data.conflicts || [];

        if (conflicts.length === 0) {
            const history = this.data.conflictHistory || [];
            return `
                <div class="empty-state success">
                    <div class="success-icon">✅</div>
                    <h2>${t('conflict.noConflictsTitle')}</h2>
                    <p>${t('conflict.noConflictsDesc')}</p>
                </div>
                ${history.length > 0 ? this.getHistoryHtml(history) : ''}
            `;
        }

        const history = this.data.conflictHistory || [];
        return `
            <div class="conflict-editor">
                ${this.getHeaderHtml(conflicts.length)}
                ${this.getConflictListHtml(conflicts)}
                ${this.getGuideHtml()}
                ${history.length > 0 ? this.getHistoryHtml(history) : ''}
            </div>
        `;
    }

    private getHeaderHtml(count: number): string {
        return `
            <div class="section-header">
                <div>
                    <h2>${t('conflict.title')}</h2>
                </div>
                <div class="conflict-count">
                    ${t('conflict.countLabel').replace('%s1', `<span class="count">${count}</span>`)}
                </div>
            </div>
        `;
    }

    private getConflictListHtml(conflicts: string[]): string {
        return `
            <div class="conflict-list">
                ${conflicts.map(file => {
            const isSelected = file === this.selectedFile;
            return `
                        <div class="conflict-item ${isSelected ? 'selected' : ''}" 
                             data-file="${escapeHtml(file)}">
                            <div class="conflict-header">
                                <span class="conflict-icon">⚠️</span>
                                <span class="file-path">${escapeHtml(file)}</span>
                                <button class="open-button" 
                                        data-file="${escapeHtml(file)}">
                                    ${t('conflict.openFile')}
                                </button>
                            </div>
                            ${isSelected ? this.getConflictActionsHtml(file) : ''}
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    private getConflictActionsHtml(file: string): string {
        return `
            <div class="conflict-actions">
                <h4>${t('conflict.chooseResolution')}</h4>
                <div class="action-buttons">
                    <button class="action-button current" 
                            data-action="current" 
                            data-file="${escapeHtml(file)}">
                        <div class="button-icon">←</div>
                        <div class="button-label">${t('conflict.action.current.title')}</div>
                        <div class="button-desc">${t('conflict.action.current.desc')}</div>
                    </button>
                    <button class="action-button incoming" 
                            data-action="incoming" 
                            data-file="${escapeHtml(file)}">
                        <div class="button-icon">→</div>
                        <div class="button-label">${t('conflict.action.incoming.title')}</div>
                        <div class="button-desc">${t('conflict.action.incoming.desc')}</div>
                    </button>
                    <button class="action-button both" 
                            data-action="both" 
                            data-file="${escapeHtml(file)}">
                        <div class="button-icon">↕</div>
                        <div class="button-label">${t('conflict.action.both.title')}</div>
                        <div class="button-desc">${t('conflict.action.both.desc')}</div>
                    </button>
                </div>
                <div class="manual-edit">
                    <p>${t('conflict.manualHint')}</p>
                </div>
            </div>
        `;
    }

    private getGuideHtml(): string {
        return `
            <div class="conflict-guide">
                <h3>${t('conflict.guide')}</h3>
                <ul>
                    <li>
                        <strong>接受当前更改</strong>：保留你本地的修改，放弃远程的修改
                    </li>
                    <li>
                        <strong>接受传入更改</strong>：使用远程的修改，放弃你本地的修改
                    </li>
                    <li>
                        <strong>接受所有更改</strong>：同时保留本地和远程的修改
                    </li>
                    <li>
                        <strong>手动编辑</strong>：打开文件手动编辑，适合需要精细控制的情况
                    </li>
                </ul>
            </div>
        `;
    }

    private getHistoryHtml(history: Array<{ id: string; timestamp: number; file: string; action: 'current' | 'incoming' | 'both'; conflictsCount: number }>): string {
        const actionNames = {
            current: '接受当前更改',
            incoming: '接受传入更改',
            both: '接受所有更改'
        };

        const formatTime = (timestamp: number): string => {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return '刚刚';
            if (minutes < 60) return `${minutes} 分钟前`;
            if (hours < 24) return `${hours} 小时前`;
            if (days < 7) return `${days} 天前`;
            return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        };

        return `
            <div class="conflict-history">
                <h3>📜 已解决的冲突历史</h3>
                <div class="history-list">
                    ${history.map(item => `
                        <div class="history-item">
                            <div class="history-icon">✅</div>
                            <div class="history-content">
                                <div class="history-file">${escapeHtml(item.file)}</div>
                                <div class="history-details">
                                    <span class="history-action">${actionNames[item.action]}</span>
                                    <span class="history-count">解决了 ${item.conflictsCount} 处冲突</span>
                                    <span class="history-time">${formatTime(item.timestamp)}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    private attachEventListeners() {
        // 冲突文件选择
        this.container.querySelectorAll('.conflict-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('.conflict-actions') ||
                    (e.target as HTMLElement).closest('.open-button')) {
                    return;
                }
                const file = (e.currentTarget as HTMLElement).dataset.file;
                if (file) {
                    this.selectedFile = this.selectedFile === file ? null : file;
                    this.render(this.data);
                }
            });
        });

        // 打开文件
        this.container.querySelectorAll('.open-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const file = (e.currentTarget as HTMLElement).dataset.file;
                if (file && window.vscode) {
                    window.vscode.postMessage({ command: 'openFile', file });
                }
            });
        });

        // 解决冲突
        this.container.querySelectorAll('.action-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = e.currentTarget as HTMLElement;
                const action = target.dataset.action as 'current' | 'incoming' | 'both';
                const file = target.dataset.file;

                if (file && action && window.vscode) {
                    window.vscode.postMessage({
                        command: 'resolveConflict',
                        file,
                        action
                    });
                }
            });
        });
    }
}

