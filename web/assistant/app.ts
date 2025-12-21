/// <reference path="./globals.d.ts" />

/**
 * 主应用类 
 */

import { CommandHistoryComponent } from './components/command-history.js';
import { GitCommandReferenceComponent } from './components/git-command-reference.js';
import { RemoteManagerComponent } from './components/remote-manager.js';
import { BranchTreeComponent } from './components/branch-tree.js';
import { TagManagerComponent } from './components/tag-manager.js';
import { ConflictEditorComponent } from './components/conflict-editor.js';
import { CommitGraphComponent } from './components/commit-graph.js';
import { TimelineViewComponent } from './components/timeline-view.js';
import { HeatmapAnalysisComponent } from './components/heatmap-analysis.js';
import { GitData } from './types/git.js';
import { initI18n, t } from './i18n.js';

type TabType = 'graph' | 'heatmap' | 'timeline' | 'branches' | 'tags' | 'remotes' | 'conflicts' | 'commands' | 'command-ref';

// VSCodeAPI 类型定义已移至 web/globals.d.ts

export class App {
    private gitData: GitData | null = null;
    private activeTab: TabType = 'commands';
    private isLoading: boolean = true;
    private rootElement: HTMLElement | null = null;
    private commandHistoryComponent: CommandHistoryComponent | null = null;
    private timelineViewComponent: TimelineViewComponent | null = null;
    private heatmapAnalysisComponent: HeatmapAnalysisComponent | null = null;
    private gitCommandReferenceComponent: GitCommandReferenceComponent | null = null;
    private tabScrollPositions: Partial<Record<TabType, number>> = {};
    // 标记下一次响应允许接受“无仓库”结果（例如用户主动刷新后）
    private allowNoRepoOnce: boolean = false;

    constructor() {
        // 从持久化状态中恢复上次的标签页
        const savedState = window.vscode?.getState();
        if (savedState?.activeTab) {
            this.activeTab = savedState.activeTab as TabType;
        }
    }

    init() {
        initI18n();
        this.rootElement = document.getElementById('root');
        if (!this.rootElement) {
            return;
        }

        this.setupMessageListener();
        this.setupVisibilityListener();
        this.render();
        this.requestData();
    }

    private setupMessageListener() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'gitData') {
                // 完整刷新数据时，若未携带 commitFiles，则保留已有的文件缓存，避免已加载的文件列表丢失
                const incoming = message.data || {};
                if (!incoming.commitFiles && this.gitData?.commitFiles) {
                    incoming.commitFiles = this.gitData.commitFiles;
                }

                const hasRepoPath = !!incoming.repositoryInfo?.path;
                const alreadyHasRepo = !!this.gitData?.repositoryInfo?.path;

                if (!hasRepoPath) {
                    // 仅在允许接受“无仓库”结果时更新状态（手动刷新或显式请求），否则忽略以避免闪屏
                    if (this.allowNoRepoOnce || this.isLoading) {
                        if (incoming.language) {
                            initI18n(incoming.language as string);
                        }
                        this.gitData = incoming;
                        this.allowNoRepoOnce = false;
                        this.isLoading = false;
                        this.render();
                    }
                    return;
                }

                // 如果前面已经成功加载过仓库信息，且当前不在加载流程中，忽略后续“无仓库”占位数据，避免闪屏
                // 但允许在用户主动刷新或显式请求后接受一次“无仓库”结果（allowNoRepoOnce）
                if (!hasRepoPath && alreadyHasRepo && !this.isLoading && !this.allowNoRepoOnce) {
                    return;
                }

                // 如果后端传递了语言信息，更新当前语言
                if (incoming.language) {
                    initI18n(incoming.language as string);
                }
                this.gitData = incoming;
                this.allowNoRepoOnce = false;
                this.isLoading = false;
                this.render();
            } else if (message.type === 'gitDataUpdate') {
                // 合并更新数据到现有数据
                if (!this.gitData) {
                    this.gitData = message.data;
                } else {
                    this.gitData = {
                        ...this.gitData,
                        ...message.data
                    };
                }
                const updatedKeys = Object.keys(message.data || {});

                // 如果本次增量更新仅包含 Git Graph 详情相关的数据（commitDetails / commitFiles），
                // 且当前不在依赖这些数据的视图（timeline / heatmap），
                // 则避免触发整页重渲染，以减少在其他标签页上的卡顿。
                const onlyGraphDetailsUpdate =
                    updatedKeys.length > 0 &&
                    updatedKeys.every(k => k === 'commitDetails' || k === 'commitFiles');

                // 对于 timeline 和 heatmap 视图，避免重建整个页面导致滚动丢失或闪烁，直接局部更新
                if (this.activeTab === 'timeline' && this.timelineViewComponent) {
                    this.timelineViewComponent.render(this.gitData);
                } else if (this.activeTab === 'heatmap' && this.heatmapAnalysisComponent) {
                    this.heatmapAnalysisComponent.render(this.gitData);
                } else if (!onlyGraphDetailsUpdate) {
                    // 只有当更新包含与当前视图相关的数据时，才重建整个页面
                    this.render();
                }
            }
        });
    }

    private requestData() {
        if (window.vscode) {
            this.allowNoRepoOnce = true;
            window.vscode.postMessage({ command: 'getData' });
        }
    }

    private setupVisibilityListener() {
        // 监听页面可见性变化，当页面从隐藏变为可见时刷新数据
        // 这解决了从其他文件页面切换回可视化面板时状态不同步的问题
        let lastVisibilityChangeTime = 0;
        const visibilityChangeHandler = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                // 防抖：避免频繁刷新，至少间隔 500ms
                if (now - lastVisibilityChangeTime > 500) {
                    lastVisibilityChangeTime = now;
                    // 如果当前在快捷指令页面，刷新数据
                    if (this.activeTab === 'commands') {
                        this.requestData();
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', visibilityChangeHandler);

        // 也监听窗口焦点事件，作为补充
        let lastFocusTime = 0;
        window.addEventListener('focus', () => {
            const now = Date.now();
            if (now - lastFocusTime > 500) {
                lastFocusTime = now;
                if (this.activeTab === 'commands') {
                    this.requestData();
                }
            }
        });
    }

    private render() {
        if (!this.rootElement) return;

        let previousScrollTop = 0;
        const previousMain = this.rootElement.querySelector('.app-main') as HTMLElement | null;
        if (previousMain) {
            previousScrollTop = previousMain.scrollTop;
        }

        if (this.activeTab) {
            this.tabScrollPositions[this.activeTab] = previousScrollTop;
        }

        this.rootElement.innerHTML = this.getHtml();
        this.attachEventListeners();

        const newMain = this.rootElement.querySelector('.app-main') as HTMLElement | null;
        if (newMain && this.activeTab && typeof this.tabScrollPositions[this.activeTab] === 'number') {
            newMain.scrollTop = this.tabScrollPositions[this.activeTab] as number;
        }
    }

    private getHtml(): string {
        if (this.isLoading) {
            return this.getLoadingHtml();
        }

        return `
            <div class="app-container">
                ${this.getHeaderHtml()}
                <main class="app-main">
                    ${this.getContentHtml()}
                </main>
            </div>
        `;
    }

    private getLoadingHtml(): string {
        return `
            <div class="app-container">
                <div class="loading-container">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                    </div>
                    <p class="loading-text">${t('common.loading')}</p>
                </div>
            </div>
        `;
    }

    private getHeaderHtml(): string {
        const tabs: Array<{ id: TabType; label: string }> = [
            { id: 'commands', label: t('tab.commands') },
            { id: 'command-ref', label: t('tab.commandRef') },
            { id: 'remotes', label: t('tab.remotes') },
            { id: 'branches', label: t('tab.branches') },
            { id: 'tags', label: t('tab.tags') },
            { id: 'conflicts', label: t('tab.conflicts') },
            { id: 'graph', label: t('tab.graph') },
            { id: 'timeline', label: t('tab.timeline') },
            { id: 'heatmap', label: t('tab.heatmap') }
        ];

        return `
            <header class="app-header">
                <div class="header-top">
                    <h1>${t('header.title')}</h1>
                    <button class="refresh-button" id="refresh-btn" title="${t('header.refresh')}">
                        <span class="refresh-icon">🔄</span>
                    </button>
                </div>
                <div class="tab-buttons">
                    ${tabs.map(tab => `
                        <button
                            class="tab-btn ${this.activeTab === tab.id ? 'active' : ''}"
                            data-tab="${tab.id}"
                        >
                            ${tab.label}
                        </button>
                    `).join('')}
                </div>
            </header>
        `;
    }

    private getContentHtml(): string {
        // 根据当前标签页渲染对应内容
        // 这里先返回一个占位符，后续会逐步迁移各个组件
        switch (this.activeTab) {
            case 'commands':
                return this.renderCommandHistory();
            case 'command-ref':
                return '<div id="git-command-reference-container"></div>';
            case 'remotes':
                return '<div id="remote-manager-container"></div>';
            case 'branches':
                return '<div id="branch-tree-container"></div>';
            case 'tags':
                return '<div id="tag-manager-container"></div>';
            case 'conflicts':
                return '<div id="conflict-editor-container"></div>';
            case 'graph':
                return '<div id="commit-graph-container"></div>';
            case 'timeline':
                return '<div id="timeline-view-container"></div>';
            case 'heatmap':
                return '<div id="heatmap-analysis-container"></div>';
            default:
                return '<div class="empty-state">未知标签页</div>';
        }
    }

    private renderCommandHistory(): string {
        return '<div id="command-history-container"></div>';
    }

    private attachEventListeners() {
        // 标签切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const tabId = target.dataset.tab as TabType;
                if (tabId) {
                    const previousTab = this.activeTab;
                    this.activeTab = tabId;
                    // 保存选中标签
                    if (window.vscode) {
                        const currentState = window.vscode.getState() || {};
                        window.vscode.setState({
                            ...currentState,
                            activeTab: tabId
                        });
                    }
                    this.render();
                    
                    // 如果切换到快捷指令页面，刷新数据以确保状态同步
                    if (tabId === 'commands' && previousTab !== 'commands') {
                        this.requestData();
                    }
                }
            });
        });

        // 刷新按钮
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.isLoading = true;
                this.render();
                this.requestData();
            });
        }

        // 初始化组件
        this.initComponents();
    }

    private initComponents() {
        // 命令历史组件
        if (this.activeTab === 'commands') {
            const container = document.getElementById('command-history-container');
            if (container) {
                if (!this.commandHistoryComponent) {
                    this.commandHistoryComponent = new CommandHistoryComponent('command-history-container');
                    this.commandHistoryComponent.render(this.gitData);
                } else {
                    this.commandHistoryComponent.remount('command-history-container', this.gitData);
                }
            }
        }

        // Git 指令集组件
        if (this.activeTab === 'command-ref') {
            const container = document.getElementById('git-command-reference-container');
            if (container) {
                if (!this.gitCommandReferenceComponent) {
                    this.gitCommandReferenceComponent = new GitCommandReferenceComponent('git-command-reference-container');
                    this.gitCommandReferenceComponent.render(this.gitData);
                } else {
                    this.gitCommandReferenceComponent.remount('git-command-reference-container', this.gitData);
                }
            }
        }

        // 远程仓库管理组件
        if (this.activeTab === 'remotes') {
            const container = document.getElementById('remote-manager-container');
            if (container) {
                const component = new RemoteManagerComponent('remote-manager-container');
                component.render(this.gitData);
            }
        }

        // 分支管理组件
        if (this.activeTab === 'branches') {
            const container = document.getElementById('branch-tree-container');
            if (container) {
                const component = new BranchTreeComponent('branch-tree-container');
                component.render(this.gitData);
            }
        }

        // 标签管理组件
        if (this.activeTab === 'tags') {
            const container = document.getElementById('tag-manager-container');
            if (container) {
                const component = new TagManagerComponent('tag-manager-container');
                component.render(this.gitData);
            }
        }

        // 冲突解决组件
        if (this.activeTab === 'conflicts') {
            const container = document.getElementById('conflict-editor-container');
            if (container) {
                const component = new ConflictEditorComponent('conflict-editor-container');
                component.render(this.gitData);
            }
        }

        // 提交图组件
        if (this.activeTab === 'graph') {
            const container = document.getElementById('commit-graph-container');
            if (container) {
                const component = new CommitGraphComponent('commit-graph-container');
                component.render(this.gitData);
            }
        }

        // 时间线视图组件
        if (this.activeTab === 'timeline') {
            const container = document.getElementById('timeline-view-container');
            if (container) {
                if (!this.timelineViewComponent) {
                    this.timelineViewComponent = new TimelineViewComponent('timeline-view-container');
                    this.timelineViewComponent.render(this.gitData);
                } else {
                    // 复用实例，重新挂载到新容器并渲染，减少整页重建带来的闪烁
                    this.timelineViewComponent.remount('timeline-view-container', this.gitData);
                }
            }
        }

        // 热力图分析组件
        if (this.activeTab === 'heatmap') {
            const container = document.getElementById('heatmap-analysis-container');
            if (container) {
                if (!this.heatmapAnalysisComponent) {
                    this.heatmapAnalysisComponent = new HeatmapAnalysisComponent('heatmap-analysis-container');
                    this.heatmapAnalysisComponent.render(this.gitData);
                } else {
                    this.heatmapAnalysisComponent.remount('heatmap-analysis-container', this.gitData);
                }
            }
        }
    }

}

