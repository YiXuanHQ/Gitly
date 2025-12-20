export interface GitStatus {
    current: string | null;
    tracking: string | null;
    ahead: number;
    behind: number;
    modified: string[];
    created: string[];
    deleted: string[];
    renamed: string[];
    conflicted: string[];
    staged: string[];
    files: FileStatus[];
}

export interface FileStatus {
    path: string;
    index: string;
    working_dir: string;
}

export interface BranchInfo {
    current: string | null;
    all: string[];
    branches: {
        [key: string]: BranchDetail;
    };
}

export interface BranchDetail {
    current: boolean;
    name: string;
    commit: string;
    label: string;
}

export interface CommitInfo {
    hash: string;
    date: string;
    message: string;
    author_name: string;
    author_email: string;
    body: string;
    refs?: string;
    branches?: string[];
    parents?: string[];
    timestamp?: number;
}

export interface LogResult {
    all: CommitInfo[];
    total: number;
    latest: CommitInfo | null;
}

export interface RemoteInfo {
    name: string;
    refs?: {
        fetch?: string;
        push?: string;
    };
}

export interface TagInfo {
    name: string;
    commit: string;
    message?: string;
    date?: string;
}

export interface RepositoryInfo {
    path: string;
    name: string;
}

export interface GitData {
    status?: GitStatus;
    branches?: BranchInfo;
    log?: LogResult;
    remotes?: RemoteInfo[];
    conflicts?: string[];
    tags?: TagInfo[];
    remoteTags?: Array<{ name: string; commit: string }>;
    repositoryInfo?: RepositoryInfo;
    currentBranch?: string | null;
    currentCommitHash?: string | null;
    commandHistory?: any[];
    availableCommands?: any[];
    categories?: any[];
    commitFiles?: Record<string, any>;
    commitDetails?: Record<string, any>;
}






















