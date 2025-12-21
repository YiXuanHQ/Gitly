/**
 * Git工具函数
 */

/**
 * 格式化分支名称
 */
export function formatBranchName(branch: string): string {
    return branch.replace('refs/heads/', '').replace('remotes/', '');
}

/**
 * 检查是否是远程分支
 */
export function isRemoteBranch(branch: string): boolean {
    return branch.startsWith('remotes/') || branch.startsWith('origin/');
}

/**
 * 获取分支简称
 */
export function getBranchShortName(branch: string): string {
    return branch.replace('remotes/origin/', '').replace('origin/', '');
}

/**
 * 格式化提交哈希（短格式）
 */
export function formatCommitHash(hash: string, length: number = 8): string {
    return hash.substring(0, length);
}

/**
 * 格式化日期（相对时间）
 */
export function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) {
        return '刚刚';
    } else if (diffMins < 60) {
        return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
        return `${diffHours}小时前`;
    } else if (diffDays < 7) {
        return `${diffDays}天前`;
    } else if (diffWeeks < 4) {
        return `${diffWeeks}周前`;
    } else if (diffMonths < 12) {
        return `${diffMonths}个月前`;
    } else {
        return `${diffYears}年前`;
    }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 解析冲突标记
 */
export function parseConflictMarkers(content: string): {
    hasConflict: boolean;
    conflicts: Array<{
        start: number;
        middle: number;
        end: number;
        current: string;
        incoming: string;
    }>;
} {
    const lines = content.split('\n');
    const conflicts: any[] = [];
    let inConflict = false;
    let conflictStart = -1;
    let conflictMiddle = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('<<<<<<<')) {
            inConflict = true;
            conflictStart = i;
        } else if (line.startsWith('=======') && inConflict) {
            conflictMiddle = i;
        } else if (line.startsWith('>>>>>>>') && inConflict) {
            if (conflictStart !== -1 && conflictMiddle !== -1) {
                conflicts.push({
                    start: conflictStart,
                    middle: conflictMiddle,
                    end: i,
                    current: lines.slice(conflictStart + 1, conflictMiddle).join('\n'),
                    incoming: lines.slice(conflictMiddle + 1, i).join('\n')
                });
            }
            inConflict = false;
            conflictStart = -1;
            conflictMiddle = -1;
        }
    }

    return {
        hasConflict: conflicts.length > 0,
        conflicts
    };
}

/**
 * 解决冲突（自动选择）
 */
export function resolveConflict(
    content: string,
    action: 'current' | 'incoming' | 'both'
): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inConflict = false;
    let conflictStart = -1;
    let conflictMiddle = -1;
    let currentLines: string[] = [];
    let incomingLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('<<<<<<<')) {
            inConflict = true;
            conflictStart = i;
            currentLines = [];
            incomingLines = [];
        } else if (line.startsWith('=======') && inConflict) {
            conflictMiddle = i;
        } else if (line.startsWith('>>>>>>>') && inConflict) {
            // 根据选择添加内容
            switch (action) {
                case 'current':
                    result.push(...currentLines);
                    break;
                case 'incoming':
                    result.push(...incomingLines);
                    break;
                case 'both':
                    result.push(...currentLines);
                    result.push(...incomingLines);
                    break;
            }

            inConflict = false;
            conflictStart = -1;
            conflictMiddle = -1;
        } else if (inConflict) {
            if (conflictMiddle === -1) {
                currentLines.push(line);
            } else {
                incomingLines.push(line);
            }
        } else {
            result.push(line);
        }
    }

    return result.join('\n');
}

/**
 * 验证分支名称
 */
export function validateBranchName(name: string): {
    valid: boolean;
    error?: string;
} {
    if (!name) {
        return { valid: false, error: '分支名称不能为空' };
    }

    if (name.length > 255) {
        return { valid: false, error: '分支名称过长' };
    }

    // Git分支名称规则
    const invalidChars = /[\s~^:?*\[\\]/;
    if (invalidChars.test(name)) {
        return { valid: false, error: '分支名称包含非法字符' };
    }

    if (name.startsWith('.') || name.endsWith('.')) {
        return { valid: false, error: '分支名称不能以点开始或结束' };
    }

    if (name.includes('..')) {
        return { valid: false, error: '分支名称不能包含连续的点' };
    }

    if (name.endsWith('.lock')) {
        return { valid: false, error: '分支名称不能以.lock结尾' };
    }

    return { valid: true };
}

/**
 * 获取文件状态图标
 */
export function getFileStatusIcon(status: string): string {
    const statusMap: { [key: string]: string } = {
        'M': '📝', // Modified
        'A': '➕', // Added
        'D': '❌', // Deleted
        'R': '🔄', // Renamed
        'C': '📋', // Copied
        'U': '⚠️', // Updated but unmerged (conflict)
        '?': '❓', // Untracked
        '!': '🚫'  // Ignored
    };

    return statusMap[status] || '📄';
}

/**
 * 获取文件状态文本
 */
export function getFileStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
        'M': '已修改',
        'A': '已添加',
        'D': '已删除',
        'R': '已重命名',
        'C': '已复制',
        'U': '冲突',
        '?': '未跟踪',
        '!': '已忽略'
    };

    return statusMap[status] || '未知';
}

/**
 * 截断提交消息
 */
export function truncateCommitMessage(message: string, maxLength: number = 50): string {
    const firstLine = message.split('\n')[0];
    if (firstLine.length <= maxLength) {
        return firstLine;
    }
    return firstLine.substring(0, maxLength - 3) + '...';
}

/**
 * 提取URL中的仓库名称
 */
export function extractRepoName(url: string): string {
    const match = url.match(/\/([^/]+?)(?:\.git)?$/);
    return match ? match[1] : 'repository';
}

/**
 * 检查是否是有效的Git URL
 */
export function isValidGitUrl(url: string): boolean {
    const gitUrlPattern = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/;
    return gitUrlPattern.test(url);
}

