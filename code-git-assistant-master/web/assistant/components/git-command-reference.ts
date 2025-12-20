/**
 * Git指令集组件 - 分类显示常用Git命令
 */

import { escapeHtml } from '../utils/dom-utils.js';
import { GitData } from '../types/git.js';
import { t, getCurrentLanguage } from '../i18n.js';

interface GitCommand {
    id: string;
    command: string;
    description: string;
    example?: string;
}

interface CommandCategory {
    id: string;
    name: string;
    icon: string;
    description: string;
    commands: GitCommand[];
}

export class GitCommandReferenceComponent {
    private container: HTMLElement;
    private expandedCategories: Set<string> = new Set(['init', 'basic']);
    private copiedCommand: string | null = null;
    private searchTerm: string = '';
    private searchDebounceTimer: number | null = null;
    private searchInputElement: HTMLInputElement | null = null;

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }
        this.container = container;
    }

    remount(containerId: string, data?: GitData | null) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }
        this.container = container;
        this.render(data);
    }

    render(_data?: GitData | null) {
        // 保存当前搜索框的值和焦点状态
        const wasFocused = this.searchInputElement === document.activeElement;
        const cursorPosition = this.searchInputElement?.selectionStart || 0;

        // 这个组件当前不依赖数据，但为了保持接口一致性接受参数
        this.container.innerHTML = this.getHtml();
        this.attachEventListeners();

        // 恢复搜索框焦点和光标位置
        if (wasFocused && this.searchInputElement) {
            this.searchInputElement.focus();
            this.searchInputElement.setSelectionRange(cursorPosition, cursorPosition);
        }
    }

    private getHtml(): string {
        const categories = this.getCategories();
        const filteredCategories = this.filterCategories(categories);

        return `
            <style>
                @media (max-width: 800px) {
                    .commands-grid-responsive {
                        grid-template-columns: 1fr !important;
                    }
                }
            </style>
            <div class="git-command-reference">
                ${this.getHeaderHtml()}
                ${this.getSearchHtml()}
                ${this.getCategoriesHtml(filteredCategories)}
            </div>
        `;
    }

    private getHeaderHtml(): string {
        return `
            <div class="section-header">
                <div>
                    <h2>${t('commandRef.title')}</h2>
                    <p class="section-description">
                        ${escapeHtml(t('commandRef.description'))}
                    </p>
                </div>
            </div>
        `;
    }

    private getSearchHtml(): string {
        const hasSearchTerm = this.searchTerm.trim().length > 0;
        return `
            <div style="margin-bottom: 20px; position: relative;">
                <input
                    type="text"
                    id="command-search"
                    placeholder="${escapeHtml(t('commandRef.searchPlaceholder'))}"
                    value="${escapeHtml(this.searchTerm)}"
                    autocomplete="off"
                    style="width: 100%; padding: 10px 16px; padding-right: ${hasSearchTerm ? '40px' : '16px'}; font-size: 14px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 6px; outline: none; box-sizing: border-box; transition: all 0.2s ease;"
                />
                ${hasSearchTerm ? `
                    <button
                        id="clear-search"
                        title="${escapeHtml(t('commandRef.clearSearch'))}"
                        style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; padding: 4px 8px; font-size: 16px; line-height: 1; border-radius: 4px; transition: all 0.2s ease;"
                        onmouseover="this.style.color='var(--vscode-foreground)'; this.style.background='var(--vscode-list-hoverBackground)'"
                        onmouseout="this.style.color='var(--vscode-descriptionForeground)'; this.style.background='transparent'"
                    >
                        ✕
                    </button>
                ` : ''}
            </div>
        `;
    }

    private getCategoriesHtml(categories: CommandCategory[]): string {
        if (categories.length === 0 && this.searchTerm.trim()) {
            return `
                <div style="padding: 40px; text-align: center; color: var(--vscode-descriptionForeground);">
                    <p>${escapeHtml(t('commandRef.searchNoResultTitle'))}</p>
                    <p style="font-size: 12px; margin-top: 8px;">${escapeHtml(t('commandRef.searchNoResultHint'))}</p>
                </div>
            `;
        }

        return `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${categories.map(category => {
            const isExpanded = this.expandedCategories.has(category.id);
            return `
                        <div style="border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-sideBar-background); overflow: hidden;">
                            <div class="category-header" data-category-id="${category.id}" 
                                 style="padding: 14px 18px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: var(--vscode-list-hoverBackground); transition: background 0.2s; user-select: none;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="font-size: 20px;">${category.icon}</span>
                                    <div>
                                        <div style="font-weight: 600; font-size: 15px; color: var(--vscode-foreground); margin-bottom: 2px;">
                                            ${escapeHtml(category.name)}
                                        </div>
                                        <div style="font-size: 12px; color: var(--vscode-descriptionForeground); line-height: 1.4;">
                                            ${escapeHtml(category.description)} (${escapeHtml(t('commandRef.commandCount').replace('%s1', category.commands.length.toString()))})
                                        </div>
                                    </div>
                                </div>
                                <span style="font-size: 14px; color: var(--vscode-descriptionForeground);">
                                    ${isExpanded ? '▼' : '▶'}
                                </span>
                            </div>
                            ${isExpanded ? `
                                <div style="padding: 18px; display: flex; flex-direction: column; gap: 12px; background: var(--vscode-editor-background);">
                                    <div class="commands-grid-responsive" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                                        ${category.commands.map(cmd => {
                const isCopied = this.copiedCommand === cmd.command;
                return `
                                                <div class="command-item" 
                                                     style="padding: 14px 16px; background: var(--vscode-textCodeBlock-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; display: flex; flex-direction: column; gap: 10px; min-height: 80px; transition: all 0.2s;">
                                                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                                                        <code style="flex: 1; font-size: 13px; font-family: var(--vscode-editor-font-family); color: var(--vscode-textLink-foreground); background: transparent; padding: 0; border-radius: 0; word-break: break-all; line-height: 1.4; font-weight: 500;">
                                                            ${escapeHtml(cmd.command)}
                                                        </code>
                                                        <button class="copy-button" 
                                                                data-command="${escapeHtml(cmd.command)}"
                                                                title="${escapeHtml(isCopied ? t('commandRef.copiedTooltip') : t('commandRef.copyTooltip'))}"
                                                                style="padding: 6px 12px; background: ${isCopied ? '#28a745' : '#007acc'}; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; transition: all 0.2s; flex-shrink: 0; white-space: nowrap;">
                                                            ${escapeHtml(isCopied ? t('commandRef.copied') : t('commandRef.copy'))}
                                                        </button>
                                                    </div>
                                                    <div style="font-size: 13px; color: var(--vscode-descriptionForeground); line-height: 1.5; margin-top: 4px;">
                                                        ${escapeHtml(cmd.description)}
                                                    </div>
                                                    ${cmd.example ? `
                                                        <div style="font-size: 12px; color: var(--vscode-textLink-foreground); font-style: normal; padding-top: 6px; margin-top: 6px; border-top: 1px solid var(--vscode-panel-border);">
                                                            ${escapeHtml(t('commandRef.example'))}: <code style="font-size: 12px; font-family: var(--vscode-editor-font-family); background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; color: #d7ba7d; font-style: italic;">${escapeHtml(cmd.example)}</code>
                                                        </div>
                                                    ` : ''}
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

    private attachEventListeners() {
        // 搜索
        this.searchInputElement = this.container.querySelector('#command-search') as HTMLInputElement;
        if (this.searchInputElement) {
            // 使用防抖处理搜索输入，避免频繁渲染
            this.searchInputElement.addEventListener('input', (e) => {
                const value = (e.target as HTMLInputElement).value;
                this.searchTerm = value;

                // 清除之前的定时器
                if (this.searchDebounceTimer !== null) {
                    window.clearTimeout(this.searchDebounceTimer);
                }

                // 设置新的防抖定时器（300ms延迟）
                this.searchDebounceTimer = window.setTimeout(() => {
                    // 如果搜索，自动展开匹配的分类
                    if (value.trim()) {
                        const categories = this.getCategories();
                        const filtered = this.filterCategories(categories);
                        filtered.forEach(cat => {
                            this.expandedCategories.add(cat.id);
                        });
                    } else {
                        // 清空搜索时，恢复默认展开的分类
                        this.expandedCategories = new Set(['init', 'basic']);
                    }
                    this.render();
                    this.searchDebounceTimer = null;
                }, 300);
            });

            // 搜索框聚焦样式
            this.searchInputElement.addEventListener('focus', (e) => {
                (e.target as HTMLElement).style.borderColor = 'var(--vscode-focusBorder)';
                (e.target as HTMLElement).style.boxShadow = '0 0 0 2px rgba(0, 122, 204, 0.2)';
            });
            this.searchInputElement.addEventListener('blur', (e) => {
                (e.target as HTMLElement).style.borderColor = 'var(--vscode-input-border)';
                (e.target as HTMLElement).style.boxShadow = 'none';
            });

            // 支持 Ctrl+F 或 Cmd+F 快速聚焦搜索框
            this.searchInputElement.addEventListener('keydown', (e) => {
                // 阻止默认行为，避免浏览器搜索
                if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                    e.preventDefault();
                    this.searchInputElement?.focus();
                }
                // ESC 键清空搜索
                if (e.key === 'Escape' && this.searchTerm && this.searchInputElement) {
                    this.searchTerm = '';
                    this.searchInputElement.value = '';
                    this.expandedCategories = new Set(['init', 'basic']);
                    this.render();
                }
            });
        }

        // 清空搜索按钮
        const clearButton = this.container.querySelector('#clear-search') as HTMLElement | null;
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.searchTerm = '';
                if (this.searchInputElement) {
                    this.searchInputElement.value = '';
                }
                this.expandedCategories = new Set(['init', 'basic']);
                this.render();
                if (this.searchInputElement) {
                    this.searchInputElement.focus();
                }
            });
        }

        // 分类折叠/展开
        this.container.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const categoryId = (e.currentTarget as HTMLElement).dataset.categoryId;
                if (categoryId) {
                    this.toggleCategory(categoryId);
                }
            });

            // 悬停效果
            header.addEventListener('mouseenter', (e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--vscode-list-activeSelectionBackground)';
            });
            header.addEventListener('mouseleave', (e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)';
            });
        });

        // 命令项悬停效果
        this.container.querySelectorAll('.command-item').forEach(item => {
            item.addEventListener('mouseenter', (e) => {
                const target = e.currentTarget as HTMLElement;
                target.style.borderColor = 'var(--vscode-focusBorder)';
                target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            });
            item.addEventListener('mouseleave', (e) => {
                const target = e.currentTarget as HTMLElement;
                target.style.borderColor = 'var(--vscode-panel-border)';
                target.style.boxShadow = 'none';
            });
        });

        // 复制命令
        this.container.querySelectorAll('.copy-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = (e.currentTarget as HTMLElement).dataset.command;
                if (command && window.vscode) {
                    window.vscode.postMessage({
                        command: 'copyToClipboard',
                        text: command
                    });
                    this.copiedCommand = command;
                    this.render();
                    setTimeout(() => {
                        this.copiedCommand = null;
                        this.render();
                    }, 2000);
                }
            });

            // 复制按钮悬停效果
            btn.addEventListener('mouseenter', (e) => {
                const target = e.currentTarget as HTMLElement;
                const isCopied = target.style.background === 'rgb(40, 167, 69)' || target.style.background === '#28a745';
                if (!isCopied) {
                    target.style.background = '#005a9e';
                }
            });
            btn.addEventListener('mouseleave', (e) => {
                const target = e.currentTarget as HTMLElement;
                const isCopied = target.style.background === 'rgb(40, 167, 69)' || target.style.background === '#28a745';
                if (!isCopied) {
                    target.style.background = '#007acc';
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
        this.render();
    }

    private filterCategories(categories: CommandCategory[]): CommandCategory[] {
        if (!this.searchTerm.trim()) {
            return categories;
        }

        const searchLower = this.searchTerm.toLowerCase().trim();
        const searchKeywords = searchLower.split(/\s+/).filter(k => k.length > 0);

        return categories.map(category => {
            const filteredCommands = category.commands.filter(cmd => {
                // 检查分类名称和描述
                const categoryMatch = category.name.toLowerCase().includes(searchLower) ||
                    category.description.toLowerCase().includes(searchLower);

                // 检查命令本身
                const commandLower = cmd.command.toLowerCase();
                const descriptionLower = cmd.description.toLowerCase();
                const exampleLower = cmd.example ? cmd.example.toLowerCase() : '';

                // 如果搜索词是单个词，使用简单包含匹配
                if (searchKeywords.length === 1) {
                    const keyword = searchKeywords[0];
                    return commandLower.includes(keyword) ||
                        descriptionLower.includes(keyword) ||
                        exampleLower.includes(keyword) ||
                        categoryMatch;
                }

                // 如果搜索词是多个词，使用更智能的匹配
                // 所有关键词都要在命令、描述或示例中找到
                const allKeywordsMatch = searchKeywords.every(keyword =>
                    commandLower.includes(keyword) ||
                    descriptionLower.includes(keyword) ||
                    exampleLower.includes(keyword)
                );

                return allKeywordsMatch || categoryMatch;
            });

            if (filteredCommands.length === 0) {
                return null;
            }

            return {
                ...category,
                commands: filteredCommands
            };
        }).filter((cat): cat is CommandCategory => cat !== null);
    }

    private getCategories(): CommandCategory[] {
        const lang = getCurrentLanguage();
        const isZh = lang === 'zh-CN';

        return [
            {
                id: 'init',
                name: isZh ? '初始化与克隆' : 'Init & Clone',
                icon: '🚀',
                description: isZh ? '仓库初始化、克隆等操作' : 'Initialize repositories and clone existing ones',
                commands: [
                    { id: 'init', command: 'git init', description: isZh ? '初始化当前目录为Git仓库' : 'Initialize current directory as a Git repository' },
                    { id: 'clone', command: 'git clone <url>', description: isZh ? '克隆远程仓库' : 'Clone a remote repository', example: 'git clone https://github.com/user/repo.git' },
                    { id: 'clone-branch', command: 'git clone -b <branch> <url>', description: isZh ? '克隆指定分支' : 'Clone a specific branch', example: 'git clone -b develop https://github.com/user/repo.git' },
                    { id: 'clone-depth', command: 'git clone --depth 1 <url>', description: isZh ? '浅克隆（只克隆最新提交）' : 'Shallow clone (latest commits only)', example: 'git clone --depth 1 https://github.com/user/repo.git' }
                ]
            },
            {
                id: 'basic',
                name: isZh ? '基础操作' : 'Basic Operations',
                icon: '📝',
                description: isZh ? '添加、提交、状态查看等基本操作' : 'Add, commit and view status',
                commands: [
                    { id: 'status', command: 'git status', description: isZh ? '查看工作区状态' : 'Show working tree status' },
                    { id: 'add', command: 'git add <file>', description: isZh ? '添加文件到暂存区' : 'Add file to staging area', example: 'git add index.html' },
                    { id: 'add-all', command: 'git add .', description: isZh ? '添加所有文件到暂存区' : 'Add all changed files to staging area' },
                    { id: 'commit', command: 'git commit -m "message"', description: isZh ? '提交更改' : 'Commit staged changes', example: 'git commit -m "feat: add new feature"' },
                    { id: 'commit-amend', command: 'git commit --amend', description: isZh ? '修改最后一次提交' : 'Amend the last commit' },
                    { id: 'commit-amend-message', command: 'git commit --amend -m "new message"', description: isZh ? '修改最后一次提交信息' : 'Amend last commit message' },
                    { id: 'log', command: 'git log', description: isZh ? '查看提交历史' : 'Show commit history' },
                    { id: 'log-oneline', command: 'git log --oneline', description: isZh ? '单行显示提交历史' : 'Compact one-line commit history' },
                    { id: 'log-graph', command: 'git log --graph --oneline --all', description: isZh ? '图形化显示所有分支历史' : 'Graph view of all branch history' },
                    { id: 'diff', command: 'git diff', description: isZh ? '查看工作区与暂存区的差异' : 'Show diff between working tree and index' },
                    { id: 'diff-staged', command: 'git diff --staged', description: isZh ? '查看暂存区与上次提交的差异' : 'Show diff between index and last commit' }
                ]
            },
            {
                id: 'branch',
                name: isZh ? '分支管理' : 'Branch Management',
                icon: '🌿',
                description: isZh ? '分支的创建、切换、合并等操作' : 'Create, switch and merge branches',
                commands: [
                    { id: 'branch-list', command: 'git branch', description: isZh ? '查看本地分支列表' : 'List local branches' },
                    { id: 'branch-remote', command: 'git branch -r', description: isZh ? '查看远程分支列表' : 'List remote branches' },
                    { id: 'branch-all', command: 'git branch -a', description: isZh ? '查看所有分支（本地+远程）' : 'List all branches (local + remote)' },
                    { id: 'branch-create', command: 'git branch <name>', description: isZh ? '创建新分支' : 'Create a new branch', example: 'git branch feature/new-feature' },
                    { id: 'checkout', command: 'git checkout <branch>', description: isZh ? '切换到指定分支' : 'Switch to a branch', example: 'git checkout main' },
                    { id: 'checkout-create', command: 'git checkout -b <name>', description: isZh ? '创建并切换到新分支' : 'Create and switch to a new branch', example: 'git checkout -b feature/new' },
                    { id: 'merge', command: 'git merge <branch>', description: isZh ? '合并指定分支到当前分支' : 'Merge a branch into current branch', example: 'git merge develop' },
                    { id: 'merge-no-ff', command: 'git merge --no-ff <branch>', description: isZh ? '合并分支（保留分支历史）' : 'Merge branch and keep history (no fast-forward)', example: 'git merge --no-ff feature/new' },
                    { id: 'branch-delete', command: 'git branch -d <name>', description: isZh ? '删除分支（安全删除）' : 'Delete a branch (safe, refuses unmerged)', example: 'git branch -d feature/old' },
                    { id: 'branch-delete-force', command: 'git branch -D <name>', description: isZh ? '强制删除分支' : 'Force delete a branch', example: 'git branch -D feature/old' },
                    { id: 'branch-rename', command: 'git branch -m <old> <new>', description: isZh ? '重命名分支' : 'Rename a branch', example: 'git branch -m old-name new-name' }
                ]
            },
            {
                id: 'remote',
                name: isZh ? '远程仓库' : 'Remotes',
                icon: '☁️',
                description: isZh ? '远程仓库的配置和管理' : 'Configure and manage remotes',
                commands: [
                    { id: 'remote-list', command: 'git remote', description: isZh ? '查看远程仓库列表' : 'List remotes' },
                    { id: 'remote-v', command: 'git remote -v', description: isZh ? '查看远程仓库详细信息' : 'Show remotes with URLs' },
                    { id: 'remote-add', command: 'git remote add <name> <url>', description: isZh ? '添加远程仓库' : 'Add a new remote', example: 'git remote add origin https://github.com/user/repo.git' },
                    { id: 'remote-remove', command: 'git remote remove <name>', description: isZh ? '删除远程仓库' : 'Remove a remote', example: 'git remote remove origin' },
                    { id: 'remote-rename', command: 'git remote rename <old> <new>', description: isZh ? '重命名远程仓库' : 'Rename a remote', example: 'git remote rename origin upstream' },
                    { id: 'fetch', command: 'git fetch', description: isZh ? '获取远程仓库更新（不合并）' : 'Fetch updates from remotes (no merge)' },
                    { id: 'fetch-remote', command: 'git fetch <remote>', description: isZh ? '从指定远程获取更新' : 'Fetch from a specific remote', example: 'git fetch origin' },
                    { id: 'pull', command: 'git pull', description: isZh ? '拉取并合并远程更改' : 'Fetch and merge from remote', example: 'git pull' },
                    { id: 'pull-rebase', command: 'git pull --rebase', description: isZh ? '使用rebase方式拉取' : 'Pull with rebase instead of merge' },
                    { id: 'push', command: 'git push', description: isZh ? '推送到远程仓库' : 'Push to remote', example: 'git push' },
                    { id: 'push-upstream', command: 'git push -u origin <branch>', description: isZh ? '推送并设置上游分支' : 'Push and set upstream tracking branch', example: 'git push -u origin main' },
                    { id: 'push-force', command: 'git push --force', description: isZh ? '强制推送（危险操作）' : 'Force push (dangerous)', example: 'git push --force' }
                ]
            },
            {
                id: 'tag',
                name: isZh ? '标签管理' : 'Tag Management',
                icon: '🏷️',
                description: isZh ? '标签的创建、删除和推送' : 'Create, delete and push tags',
                commands: [
                    { id: 'tag-list', command: 'git tag', description: isZh ? '查看所有标签' : 'List all tags' },
                    { id: 'tag-create', command: 'git tag <name>', description: isZh ? '创建轻量级标签' : 'Create a lightweight tag', example: 'git tag v1.0.0' },
                    { id: 'tag-annotated', command: 'git tag -a <name> -m "message"', description: isZh ? '创建带注释的标签' : 'Create an annotated tag', example: 'git tag -a v1.0.0 -m "version 1.0.0"' },
                    { id: 'tag-push', command: 'git push origin <tag>', description: isZh ? '推送单个标签' : 'Push a single tag', example: 'git push origin v1.0.0' },
                    { id: 'tag-push-all', command: 'git push --tags', description: isZh ? '推送所有标签到远程' : 'Push all tags to remote' },
                    { id: 'tag-delete', command: 'git tag -d <name>', description: isZh ? '删除本地标签' : 'Delete a local tag', example: 'git tag -d v1.0.0' },
                    { id: 'tag-delete-remote', command: 'git push origin --delete <tag>', description: isZh ? '删除远程标签' : 'Delete a remote tag', example: 'git push origin --delete v1.0.0' },
                    { id: 'tag-show', command: 'git show <tag>', description: isZh ? '查看标签详细信息' : 'Show tag details', example: 'git show v1.0.0' }
                ]
            },
            {
                id: 'stash',
                name: isZh ? '暂存管理' : 'Stash',
                icon: '📦',
                description: isZh ? '暂存区的保存和恢复' : 'Save and restore work-in-progress',
                commands: [
                    { id: 'stash', command: 'git stash', description: isZh ? '暂存当前更改' : 'Stash current changes' },
                    { id: 'stash-save', command: 'git stash save "message"', description: isZh ? '暂存更改并添加说明' : 'Stash with a message', example: 'git stash save "WIP"' },
                    { id: 'stash-list', command: 'git stash list', description: isZh ? '查看暂存列表' : 'List all stashes' },
                    { id: 'stash-pop', command: 'git stash pop', description: isZh ? '恢复最近的暂存' : 'Apply and drop latest stash' },
                    { id: 'stash-apply', command: 'git stash apply', description: isZh ? '应用暂存（不删除）' : 'Apply stash without dropping' },
                    { id: 'stash-drop', command: 'git stash drop', description: isZh ? '删除最近的暂存' : 'Drop latest stash' },
                    { id: 'stash-clear', command: 'git stash clear', description: isZh ? '清空所有暂存' : 'Clear all stashes' },
                    { id: 'stash-show', command: 'git stash show', description: isZh ? '查看暂存内容' : 'Show changes in a stash' }
                ]
            },
            {
                id: 'reset',
                name: isZh ? '撤销操作' : 'Undo & Reset',
                icon: '↩️',
                description: isZh ? '撤销、重置等操作' : 'Undo and reset operations',
                commands: [
                    { id: 'reset-soft', command: 'git reset --soft HEAD~1', description: isZh ? '软重置（保留更改到暂存区）' : 'Soft reset (keep changes staged)' },
                    { id: 'reset-mixed', command: 'git reset HEAD~1', description: isZh ? '混合重置（保留更改到工作区）' : 'Mixed reset (keep changes in working tree)' },
                    { id: 'reset-hard', command: 'git reset --hard HEAD~1', description: isZh ? '硬重置（丢弃所有更改，危险）' : 'Hard reset (discard all changes, dangerous)' },
                    { id: 'reset-file', command: 'git reset HEAD <file>', description: isZh ? '取消暂存文件' : 'Unstage file', example: 'git reset HEAD index.html' },
                    { id: 'checkout-file', command: 'git checkout -- <file>', description: isZh ? '撤销工作区文件更改' : 'Discard working tree changes to a file', example: 'git checkout -- index.html' },
                    { id: 'restore-staged', command: 'git restore --staged <file>', description: isZh ? '取消暂存文件（Git 2.23+）' : 'Unstage file (Git 2.23+)', example: 'git restore --staged index.html' },
                    { id: 'restore', command: 'git restore <file>', description: isZh ? '恢复工作区文件（Git 2.23+）' : 'Restore file in working tree (Git 2.23+)', example: 'git restore index.html' }
                ]
            },
            {
                id: 'rebase',
                name: isZh ? '变基操作' : 'Rebase',
                icon: '🔄',
                description: isZh ? '变基相关操作' : 'Rebase related operations',
                commands: [
                    { id: 'rebase', command: 'git rebase <branch>', description: isZh ? '变基到指定分支' : 'Rebase onto a branch', example: 'git rebase main' },
                    { id: 'rebase-interactive', command: 'git rebase -i HEAD~n', description: isZh ? '交互式变基' : 'Interactive rebase', example: 'git rebase -i HEAD~3' },
                    { id: 'rebase-continue', command: 'git rebase --continue', description: isZh ? '继续变基' : 'Continue rebase' },
                    { id: 'rebase-abort', command: 'git rebase --abort', description: isZh ? '中止变基' : 'Abort rebase' },
                    { id: 'rebase-skip', command: 'git rebase --skip', description: isZh ? '跳过当前提交' : 'Skip current commit' }
                ]
            },
            {
                id: 'cherry-pick',
                name: isZh ? '精选提交' : 'Cherry-pick',
                icon: '🍒',
                description: isZh ? '从其他分支选择提交' : 'Pick specific commits from other branches',
                commands: [
                    { id: 'cherry-pick', command: 'git cherry-pick <commit>', description: isZh ? '应用指定提交' : 'Apply a specific commit', example: 'git cherry-pick abc1234' },
                    { id: 'cherry-pick-range', command: 'git cherry-pick <start>..<end>', description: isZh ? '应用提交范围' : 'Apply a range of commits', example: 'git cherry-pick abc1234..def5678' },
                    { id: 'cherry-pick-continue', command: 'git cherry-pick --continue', description: isZh ? '继续精选' : 'Continue cherry-pick' },
                    { id: 'cherry-pick-abort', command: 'git cherry-pick --abort', description: isZh ? '中止精选' : 'Abort cherry-pick' }
                ]
            },
            {
                id: 'config',
                name: isZh ? '配置管理' : 'Configuration',
                icon: '⚙️',
                description: isZh ? 'Git配置相关' : 'Git configuration',
                commands: [
                    { id: 'config-list', command: 'git config --list', description: isZh ? '查看所有配置' : 'List all config entries' },
                    { id: 'config-get', command: 'git config <key>', description: isZh ? '查看指定配置' : 'Show a specific config value', example: 'git config user.name' },
                    { id: 'config-set', command: 'git config <key> <value>', description: isZh ? '设置配置' : 'Set a config value', example: 'git config user.name "Your Name"' },
                    { id: 'config-global', command: 'git config --global <key> <value>', description: isZh ? '设置全局配置' : 'Set a global config value', example: 'git config --global user.email "email@example.com"' },
                    { id: 'config-unset', command: 'git config --unset <key>', description: isZh ? '删除配置' : 'Remove a config entry', example: 'git config --unset user.name' }
                ]
            },
            {
                id: 'advanced',
                name: isZh ? '高级操作' : 'Advanced',
                icon: '🔧',
                description: isZh ? '高级功能和技巧' : 'Advanced features and tips',
                commands: [
                    { id: 'clean', command: 'git clean -n', description: isZh ? '预览要清理的文件' : 'Preview files to be removed' },
                    { id: 'clean-force', command: 'git clean -f', description: isZh ? '清理未跟踪的文件' : 'Remove untracked files' },
                    { id: 'clean-directory', command: 'git clean -fd', description: isZh ? '清理未跟踪的文件和目录' : 'Remove untracked files and directories' },
                    { id: 'reflog', command: 'git reflog', description: isZh ? '查看引用日志' : 'Show reference logs (reflog)' },
                    { id: 'gc', command: 'git gc', description: isZh ? '清理不必要的文件并优化仓库' : 'Cleanup unnecessary files and optimize repository' },
                    { id: 'submodule-add', command: 'git submodule add <url>', description: isZh ? '添加子模块' : 'Add a submodule', example: 'git submodule add https://github.com/user/repo.git' },
                    { id: 'submodule-update', command: 'git submodule update --init --recursive', description: isZh ? '更新子模块' : 'Initialize and update submodules' },
                    { id: 'worktree-add', command: 'git worktree add <path> <branch>', description: isZh ? '添加工作树' : 'Add an additional worktree', example: 'git worktree add ../repo-test test-branch' },
                    { id: 'worktree-list', command: 'git worktree list', description: isZh ? '查看工作树列表' : 'List all worktrees' }
                ]
            }
        ];
    }
}

