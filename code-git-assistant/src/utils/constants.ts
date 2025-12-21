/**
 * 常量定义
 */

export const EXTENSION_ID = 'git-assistant';
export const EXTENSION_NAME = 'Git Assistant';

/**
 * 命令ID
 */
export const COMMANDS = {
    QUICK_PUSH: 'git-assistant.quickPush',
    QUICK_PULL: 'git-assistant.quickPull',
    QUICK_CLONE: 'git-assistant.quickClone',
    CREATE_BRANCH: 'git-assistant.createBranch',
    SWITCH_BRANCH: 'git-assistant.switchBranch',
    MERGE_BRANCH: 'git-assistant.mergeBranch',
    DELETE_BRANCH: 'git-assistant.deleteBranch',
    SHOW_HISTORY: 'git-assistant.showHistory',
    RESOLVE_CONFLICTS: 'git-assistant.resolveConflicts',
    MARK_RESOLVED: 'git-assistant.markResolved',
    REFRESH_BRANCHES: 'git-assistant.refreshBranches',
    OPEN_DASHBOARD: 'git-assistant.openDashboard',
    SHOW_COMMIT_DETAILS: 'git-assistant.showCommitDetails'
};

/**
 * 视图ID
 */
export const VIEWS = {
    BRANCH_VIEW: 'git-assistant.branchView',
    HISTORY_VIEW: 'git-assistant.historyView',
    CONFLICT_VIEW: 'git-assistant.conflictView'
};

/**
 * 配置键
 */
export const CONFIG = {
    AUTO_FETCH: 'git-assistant.autoFetch',
    CONFIRM_PUSH: 'git-assistant.confirmPush',
    MAX_HISTORY_COUNT: 'git-assistant.maxHistoryCount',
    CONFLICT_HIGHLIGHT: 'git-assistant.conflictHighlight',
    DEBUG: 'git-assistant.debug'
};

/**
 * 文件状态
 */
export const FILE_STATUS = {
    MODIFIED: 'M',
    ADDED: 'A',
    DELETED: 'D',
    RENAMED: 'R',
    COPIED: 'C',
    UNMERGED: 'U',
    UNTRACKED: '?',
    IGNORED: '!'
};

/**
 * Git操作超时时间（毫秒）
 */
export const TIMEOUT = {
    DEFAULT: 30000,      // 30秒
    CLONE: 300000,       // 5分钟
    PUSH: 60000,         // 1分钟
    PULL: 60000,         // 1分钟
    FETCH: 30000         // 30秒
};

/**
 * UI常量
 */
export const UI = {
    MAX_COMMIT_MESSAGE_LENGTH: 72,
    MAX_BRANCH_NAME_LENGTH: 255,
    DEFAULT_PAGE_SIZE: 20,
    MAX_HISTORY_COUNT: 100
};

/**
 * 错误消息
 */
export const ERROR_MESSAGES = {
    NO_GIT_REPO: '当前工作区不是Git仓库',
    NO_WORKSPACE: '请先打开一个工作区',
    GIT_NOT_INSTALLED: 'Git未安装或未添加到PATH',
    OPERATION_FAILED: 'Git操作失败',
    NETWORK_ERROR: '网络错误，请检查网络连接',
    AUTH_FAILED: '认证失败，请检查凭据',
    MERGE_CONFLICT: '合并冲突，请解决冲突后再继续',
    INVALID_BRANCH_NAME: '无效的分支名称',
    BRANCH_EXISTS: '分支已存在',
    BRANCH_NOT_FOUND: '分支不存在',
    UNCOMMITTED_CHANGES: '有未提交的更改'
};

/**
 * 成功消息
 */
export const SUCCESS_MESSAGES = {
    PUSH_SUCCESS: '推送成功',
    PULL_SUCCESS: '拉取成功',
    CLONE_SUCCESS: '克隆成功',
    BRANCH_CREATED: '分支创建成功',
    BRANCH_SWITCHED: '分支切换成功',
    BRANCH_MERGED: '分支合并成功',
    BRANCH_DELETED: '分支删除成功',
    CONFLICT_RESOLVED: '冲突已解决',
    COMMIT_SUCCESS: '提交成功'
};

/**
 * Git冲突标记
 */
export const CONFLICT_MARKERS = {
    START: '<<<<<<<',
    MIDDLE: '=======',
    END: '>>>>>>>'
};

/**
 * 默认远程仓库名称
 */
export const DEFAULT_REMOTE = 'origin';

/**
 * 默认分支名称
 */
export const DEFAULT_BRANCHES = ['main', 'master', 'develop'];

