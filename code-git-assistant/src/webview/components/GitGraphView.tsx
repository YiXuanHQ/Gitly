import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { GitData, CommitInfo, BranchGraphDag } from '../../types/git';

interface VSCodeAPI {
    postMessage: (message: { command: string;[key: string]: unknown }) => void;
}

declare const vscode: VSCodeAPI;

/**
 * 提交行高度（像素）- 与官方插件一致
 */
const ROW_HEIGHT = 24;
const GRAPH_COLUMN_WIDTH = 120;
const GRID_X = 16; // 每个轨道的宽度（像素）
const GRID_Y = ROW_HEIGHT; // 每行的高度
const GRID_OFFSET_X = 8; // 图形左侧偏移
const GRID_OFFSET_Y = GRID_Y / 2; // 图形顶部偏移
const VISIBLE_BUFFER = 5;

/**
 * 分支颜色调色板（与官方 Git Graph 插件一致）
 */
const BRANCH_COLORS = [
    '#0D6EFD', // 饱和蓝
    '#E91E63', // 品红
    '#00B894', // 祖母绿
    '#F39C12', // 橙黄
    '#9B59B6', // 紫罗兰
    '#E74C3C', // 番茄红
    '#1ABC9C', // 青绿
    '#34495E', // 石板蓝灰
    '#F1C40F', // 亮黄
    '#2ECC71', // 草绿
    '#FF9800', // 鲜橙
    '#2980B9', // 湖蓝
];

/**
 * 获取可用的颜色索引（基于分支结束位置的颜色回收机制）
 * 优化：参考 vscode-git-graph-develop 的实现，更高效且稳定
 * @param startAt 分支开始的索引位置
 * @param availableColors 可用颜色数组，存储每个颜色对应的分支结束位置
 * @returns 颜色索引
 */
const getAvailableColour = (startAt: number, availableColors: number[]): number => {
    // 查找可以回收的颜色（分支已经结束）
    for (let i = 0; i < availableColors.length; i++) {
        if (startAt > availableColors[i]) {
            // 该颜色对应的分支已经结束，可以回收使用
            return i;
        }
    }
    // 如果没有可回收的颜色，分配新颜色
    availableColors.push(0);
    return availableColors.length - 1;
};


/**
 * 格式化日期（类似官方插件）
 */
const formatDate = (dateString: string): string => {
    if (!dateString) {
        return '未知日期';
    }

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '无效日期';
        }

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return '刚刚';
        } else if (diffMins < 60) {
            return `${diffMins}分钟前`;
        } else if (diffHours < 24) {
            return `${diffHours}小时前`;
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else {
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    } catch (error) {
        return '无效日期';
    }
};

/**
 * 提交节点接口
 */
interface CommitNode {
    hash: string;
    message: string;
    date: string;
    author_name: string;
    author_email: string;
    branches?: string[];
    parents?: string[];
    isMerge?: boolean;
    // 图形布局信息（基于官方算法）
    x: number; // X坐标（轨道号）
    y: number; // Y坐标（索引）
    colorIndex: number; // 颜色索引
    branch?: Branch; // 所属分支
}

/**
 * 分支类（类似官方实现）
 * 优化：使用更严格的类型定义
 */
class Branch {
    private readonly colorIndex: number;
    private end: number = 0;
    private lines: Line[] = [];

    constructor(colorIndex: number) {
        this.colorIndex = colorIndex;
    }

    public addLine(p1: Point, p2: Point, isCommitted: boolean, lockedFirst: boolean = true) {
        this.lines.push({ p1, p2, isCommitted, lockedFirst });
    }

    public getColorIndex() {
        return this.colorIndex;
    }

    public getEnd() {
        return this.end;
    }

    public setEnd(end: number) {
        this.end = end;
    }

    public getLines() {
        return this.lines;
    }
}

/**
 * 点接口（用于图形坐标）
 */
interface Point {
    readonly x: number;
    readonly y: number;
}

/**
 * 线条接口（用于分支线条）
 */
interface Line {
    readonly p1: Point;
    readonly p2: Point;
    readonly isCommitted: boolean;
    readonly lockedFirst: boolean; // TRUE => 线条锁定到 p1, FALSE => 线条锁定到 p2
}

/**
 * 不可用点接口（用于跟踪连接）
 */
interface UnavailablePoint {
    readonly connectsTo: Vertex | null;
    readonly onBranch: Branch;
}

/**
 * 顶点类（类似官方实现）
 */
class Vertex {
    public readonly id: number;
    private x: number = 0;
    private children: Vertex[] = [];
    private parents: Vertex[] = [];
    private nextParent: number = 0;
    private onBranch: Branch | null = null;
    private isCommitted: boolean = true;
    private isCurrent: boolean = false;
    private nextX: number = 0;
    private connections: UnavailablePoint[] = [];

    constructor(id: number) {
        this.id = id;
    }

    public addChild(vertex: Vertex) {
        this.children.push(vertex);
    }

    public getChildren(): ReadonlyArray<Vertex> {
        return this.children;
    }

    public addParent(vertex: Vertex) {
        this.parents.push(vertex);
    }

    public getParents(): ReadonlyArray<Vertex> {
        return this.parents;
    }

    public hasParents() {
        return this.parents.length > 0;
    }

    public getNextParent(): Vertex | null {
        if (this.nextParent < this.parents.length) return this.parents[this.nextParent];
        return null;
    }

    public registerParentProcessed() {
        this.nextParent++;
    }

    public isMerge() {
        return this.parents.length > 1;
    }

    public addToBranch(branch: Branch, x: number) {
        if (this.onBranch === null) {
            this.onBranch = branch;
            this.x = x;
        }
    }

    public isNotOnBranch() {
        return this.onBranch === null;
    }

    public isOnThisBranch(branch: Branch) {
        return this.onBranch === branch;
    }

    public getBranch() {
        return this.onBranch;
    }

    public getPoint(): Point {
        return { x: this.x, y: this.id };
    }

    public getNextPoint(): Point {
        return { x: this.nextX, y: this.id };
    }

    /**
     * 获取连接到指定顶点的点（如果存在）
     * 优化：直接检查指定索引，因为 connections 是稀疏数组
     */
    public getPointConnectingTo(vertex: Vertex | null, onBranch: Branch): Point | null {
        // 由于 registerUnavailablePoint 只在 x === nextX 时设置，我们需要遍历所有可能的索引
        // 但可以优化：只检查已设置的索引（稀疏数组）
        for (let i = 0; i < this.connections.length; i++) {
            const conn = this.connections[i];
            if (conn && conn.connectsTo === vertex && conn.onBranch === onBranch) {
                return { x: i, y: this.id };
            }
        }
        return null;
    }

    /**
     * 注册不可用点（标记某个 X 坐标已被使用）
     * 优化：与官方实现一致，只在 x === nextX 时更新，避免不必要的数组扩展
     */
    public registerUnavailablePoint(x: number, connectsToVertex: Vertex | null, onBranch: Branch) {
        if (x === this.nextX) {
            this.nextX = x + 1;
            // 只在必要时扩展数组，使用稀疏数组避免内存浪费
            if (this.connections.length <= x) {
                // 扩展数组到所需大小，但只设置当前索引
                this.connections.length = x + 1;
            }
            this.connections[x] = { connectsTo: connectsToVertex, onBranch: onBranch };
        }
    }

    public setNextX(x: number) {
        if (x >= this.nextX) {
            this.nextX = x + 1;
        }
    }

    public getX() {
        return this.x;
    }

    public setNotCommitted() {
        this.isCommitted = false;
    }

    public getIsCommitted() {
        return this.isCommitted;
    }

    public setCurrent() {
        this.isCurrent = true;
    }

    public getIsCurrent() {
        return this.isCurrent;
    }
}

/**
 * Git Graph 表格视图组件（基于官方实现）
 */
export const GitGraphView: React.FC<{ data: GitData }> = ({ data }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLTableSectionElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(600);
    const [headerHeight, setHeaderHeight] = useState(ROW_HEIGHT);
    const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
    const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
    const detailCellRef = useRef<HTMLTableCellElement | null>(null);
    const [detailHeight, setDetailHeight] = useState(0);

    // 构建提交节点数据（使用官方算法）- 使用 useMemo 优化性能
    // 优化：缓存关键数据引用，减少不必要的重新计算
    const commitsRef = useRef<CommitInfo[]>([]);
    const dagRef = useRef<BranchGraphDag | null>(null);
    const currentBranchRef = useRef<string | null>(null);

    // 检查数据是否真的发生了变化
    const commitsChanged = data?.log?.all !== commitsRef.current;
    const dagChanged = data?.branchGraph?.dag !== dagRef.current;
    const branchChanged = (data?.branchGraph?.currentBranch || data?.branches?.current) !== currentBranchRef.current;

    if (commitsChanged) commitsRef.current = data?.log?.all || [];
    if (dagChanged) dagRef.current = data?.branchGraph?.dag || null;
    if (branchChanged) currentBranchRef.current = (data?.branchGraph?.currentBranch || data?.branches?.current || null);

    const graphData = useMemo<{ commitNodes: CommitNode[]; branches: Branch[] }>(() => {
        // 确保 log.all 和 dag 都存在且有效
        if (!commitsRef.current || !dagRef.current || !dagRef.current.nodes || dagRef.current.nodes.length === 0) {
            return { commitNodes: [], branches: [] };
        }

        const commits = commitsRef.current;
        const dag = dagRef.current;

        // 如果没有 dag 数据，构建基本节点（这种情况不应该发生，因为上面已经检查过）
        // 但保留此逻辑作为后备方案
        if (!dag || !dag.nodes || dag.nodes.length === 0) {
            const nodes: CommitNode[] = commits.map((commit, index) => ({
                hash: commit.hash,
                message: commit.message || '',
                date: commit.date || '',
                author_name: commit.author_name || '',
                author_email: commit.author_email || '',
                branches: [],
                parents: [],
                isMerge: false,
                x: 0,
                y: index,
                colorIndex: 0
            }));
            return { commitNodes: nodes, branches: [] };
        }

        // 构建提交信息映射
        const commitMap = new Map<string, {
            hash: string;
            message: string;
            date: string;
            author_name: string;
            author_email: string;
        }>();
        commits.forEach(commit => {
            commitMap.set(commit.hash, {
                hash: commit.hash,
                message: commit.message || '',
                date: commit.date || '',
                author_name: commit.author_name || '',
                author_email: commit.author_email || ''
            });
        });

        // 构建节点映射
        const nodeMap = new Map<string, {
            hash: string;
            branches?: string[];
            parents?: string[];
            timestamp?: number;
        }>();
        dag.nodes.forEach((node: {
            hash: string;
            branches?: string[];
            parents?: string[];
            timestamp?: number;
        }) => {
            nodeMap.set(node.hash, {
                hash: node.hash,
                branches: node.branches || [],
                parents: node.parents || [],
                timestamp: node.timestamp || 0
            });
        });

        // 按时间排序（新的在上）
        const sortedHashes = Array.from(nodeMap.entries())
            .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
            .map(([hash]) => hash);

        // 构建顶点和分支（类似官方实现）
        const vertices: Vertex[] = sortedHashes.map((_, i) => new Vertex(i));
        const commitLookup: { [hash: string]: number } = {};
        sortedHashes.forEach((hash, i) => {
            commitLookup[hash] = i;
        });

        // 构建父子关系
        const nullVertex = new Vertex(-1);
        sortedHashes.forEach((hash, i) => {
            const node = nodeMap.get(hash)!;
            if (node.parents) {
                node.parents.forEach(parentHash => {
                    const parentIndex = commitLookup[parentHash];
                    if (typeof parentIndex === 'number') {
                        vertices[i].addParent(vertices[parentIndex]);
                        vertices[parentIndex].addChild(vertices[i]);
                    } else {
                        vertices[i].addParent(nullVertex);
                    }
                });
            }
        });

        // 标记当前提交
        const currentBranch = currentBranchRef.current;
        if (currentBranch) {
            const currentHash = sortedHashes.find(hash => {
                const node = nodeMap.get(hash);
                return node?.branches?.includes(currentBranch);
            });
            if (currentHash && commitLookup[currentHash] !== undefined) {
                vertices[commitLookup[currentHash]].setCurrent();
            }
        }

        // 确定路径和分配分支（类似官方的 determinePath）
        const branches: Branch[] = [];
        // 优化：使用基于分支结束位置的颜色回收机制
        // availableColors[i] 存储颜色 i 对应的分支结束位置，-1 表示未使用
        const availableColors: number[] = [];

        const determinePath = (startAt: number) => {
            let i = startAt;
            let vertex = vertices[i];
            let parentVertex = vertex.getNextParent();
            let lastPoint = vertex.isNotOnBranch() ? vertex.getNextPoint() : vertex.getPoint();

            if (parentVertex !== null && parentVertex.id !== -1 && vertex.isMerge() && !vertex.isNotOnBranch() && !parentVertex.isNotOnBranch()) {
                // 合并分支
                const parentBranch = parentVertex.getBranch()!;
                let foundPointToParent = false;
                for (i = startAt + 1; i < vertices.length; i++) {
                    const curVertex = vertices[i];
                    let curPoint: Point;
                    // 检查是否已经有连接到父节点的点
                    const existingPoint = curVertex.getPointConnectingTo(parentVertex, parentBranch);
                    if (existingPoint !== null) {
                        curPoint = existingPoint;
                        foundPointToParent = true;
                    } else if (curVertex === parentVertex) {
                        curPoint = curVertex.getPoint();
                        foundPointToParent = true;
                    } else {
                        curPoint = curVertex.getNextPoint();
                    }
                    const lockedFirst = !foundPointToParent && curVertex !== parentVertex ? lastPoint.x < curPoint.x : true;
                    parentBranch.addLine(lastPoint, curPoint, vertex.getIsCommitted(), lockedFirst);
                    curVertex.registerUnavailablePoint(curPoint.x, parentVertex, parentBranch);
                    lastPoint = curPoint;

                    if (foundPointToParent) {
                        vertex.registerParentProcessed();
                        break;
                    }
                }
            } else {
                // 普通分支
                // 优化：使用基于分支结束位置的颜色回收机制
                const branchColorIndex = getAvailableColour(startAt, availableColors);
                const branch = new Branch(branchColorIndex);
                vertex.addToBranch(branch, lastPoint.x);
                vertex.registerUnavailablePoint(lastPoint.x, vertex, branch);
                for (i = startAt + 1; i < vertices.length; i++) {
                    const curVertex = vertices[i];
                    const curPoint = parentVertex === curVertex && !parentVertex.isNotOnBranch()
                        ? curVertex.getPoint()
                        : curVertex.getNextPoint();
                    const lockedFirst = lastPoint.x < curPoint.x;
                    branch.addLine(lastPoint, curPoint, vertex.getIsCommitted(), lockedFirst);
                    curVertex.registerUnavailablePoint(curPoint.x, parentVertex, branch);
                    lastPoint = curPoint;

                    if (parentVertex === curVertex) {
                        vertex.registerParentProcessed();
                        const parentVertexOnBranch = !parentVertex.isNotOnBranch();
                        parentVertex.addToBranch(branch, curPoint.x);
                        vertex = parentVertex;
                        parentVertex = vertex.getNextParent();
                        if (parentVertex === null || parentVertexOnBranch) {
                            break;
                        }
                    }
                }
                if (i === vertices.length && parentVertex !== null && parentVertex.id === -1) {
                    vertex.registerParentProcessed();
                }
                branch.setEnd(i);
                branches.push(branch);
                // 记录该颜色对应的分支结束位置，用于颜色回收
                availableColors[branch.getColorIndex()] = i;
            }
        };

        // 处理所有顶点
        let i = 0;
        while (i < vertices.length) {
            if (vertices[i].getNextParent() !== null || vertices[i].isNotOnBranch()) {
                determinePath(i);
            } else {
                i++;
            }
        }

        // 确保所有顶点都被分配到分支（处理可能遗漏的顶点）
        for (i = 0; i < vertices.length; i++) {
            if (vertices[i].isNotOnBranch()) {
                // 为未分配分支的顶点创建一个分支
                const vertex = vertices[i];
                // 优化：使用基于分支结束位置的颜色回收机制
                const branchColorIndex = getAvailableColour(i, availableColors);
                const branch = new Branch(branchColorIndex);
                const point = vertex.getNextPoint();
                vertex.addToBranch(branch, point.x);
                vertex.registerUnavailablePoint(point.x, vertex, branch);
                branch.setEnd(i + 1);
                branches.push(branch);
                // 记录该颜色对应的分支结束位置，用于颜色回收
                availableColors[branch.getColorIndex()] = i;
            }
        }

        // 构建提交节点数组
        // 确保所有 dag.nodes 中的提交都有对应的提交信息
        // 如果 commitMap 中没有，尝试从 commits 数组中查找
        const commitNodes: CommitNode[] = sortedHashes.map((hash, index) => {
            const vertex = vertices[index];
            const node = nodeMap.get(hash)!;

            // 优先从 commitMap 获取，如果没有则从 commits 数组中查找
            let commitInfo = commitMap.get(hash);
            if (!commitInfo) {
                // 如果 commitMap 中没有，从 commits 数组中查找
                const commitFromLog = commits.find(c => c.hash === hash);
                if (commitFromLog) {
                    commitInfo = {
                        hash: commitFromLog.hash,
                        message: commitFromLog.message || '',
                        date: commitFromLog.date || '',
                        author_name: commitFromLog.author_name || '',
                        author_email: commitFromLog.author_email || ''
                    };
                    // 添加到 commitMap 中，避免后续重复查找
                    commitMap.set(hash, commitInfo);
                } else {
                    // 如果还是找不到，使用默认值
                    commitInfo = {
                        hash,
                        message: '',
                        date: '',
                        author_name: '',
                        author_email: ''
                    };
                }
            }

            return {
                hash,
                message: commitInfo.message,
                date: commitInfo.date,
                author_name: commitInfo.author_name,
                author_email: commitInfo.author_email,
                branches: node.branches || [],
                parents: node.parents || [],
                isMerge: vertex.isMerge(),
                x: vertex.getX(),
                y: index,
                colorIndex: vertex.getBranch()?.getColorIndex() || 0,
                branch: vertex.getBranch() || undefined
            };
        });

        return { commitNodes, branches };
    }, [commitsChanged, dagChanged, branchChanged]); // 优化：只在数据真正变化时重新计算

    const { commitNodes, branches: graphBranches } = graphData;

    // 便捷映射：提交哈希 -> 完整提交信息（含 body 等）
    // 优化：使用 commitsRef 而不是直接依赖 data?.log?.all
    const commitInfoMap = useMemo(() => {
        const map = new Map<string, CommitInfo>();
        if (commitsRef.current) {
            commitsRef.current.forEach((c: CommitInfo) => map.set(c.hash, c));
        }
        return map;
    }, [commitsChanged]); // 只在提交数据变化时重新计算

    // 计算哪些提交应该显示为浅色（muted）
    // 参考 vscode-git-graph 的实现：
    // 1. 合并提交（merge commits）- 默认启用
    // 2. 非 HEAD 祖先的提交（commits not ancestors of HEAD）- 可选
    // 优化：缓存计算结果，减少重复计算
    const mutedCommits = useMemo(() => {
        const muted: boolean[] = new Array(commitNodes.length).fill(false);

        if (commitNodes.length === 0) return muted;

        const currentHash = currentBranchRef.current;
        // 优化：使用 Map 快速查找，而不是每次都 findIndex
        const commitHashToIndex = new Map<string, number>();
        commitNodes.forEach((c, idx) => commitHashToIndex.set(c.hash, idx));

        const currentCommitIndex = currentHash
            ? commitNodes.findIndex(c => {
                const node = dagRef.current?.nodes?.find((n: { hash: string; branches?: string[] }) => n.hash === c.hash);
                return node?.branches?.includes(currentHash);
            })
            : -1;

        // 1. 淡化合并提交（默认启用）
        const muteMergeCommits = true; // 可以从配置中读取
        if (muteMergeCommits) {
            commitNodes.forEach((commit, index) => {
                if (commit.isMerge) {
                    muted[index] = true;
                }
            });
        }

        // 2. 淡化非 HEAD 祖先的提交（可选，需要当前提交在图中）
        const muteCommitsNotAncestorsOfHead = false; // 可以从配置中读取，默认关闭
        if (muteCommitsNotAncestorsOfHead && currentCommitIndex >= 0) {
            // 构建提交索引映射
            const commitIndexMap = new Map<string, number>();
            commitNodes.forEach((commit, index) => {
                commitIndexMap.set(commit.hash, index);
            });

            // 递归标记所有祖先提交
            const ancestor: boolean[] = new Array(commitNodes.length).fill(false);
            const markAncestors = (commitIndex: number) => {
                if (commitIndex < 0 || commitIndex >= commitNodes.length || ancestor[commitIndex]) {
                    return;
                }
                ancestor[commitIndex] = true;

                // 标记所有父提交
                const commit = commitNodes[commitIndex];
                if (commit.parents) {
                    commit.parents.forEach(parentHash => {
                        const parentIndex = commitIndexMap.get(parentHash);
                        if (parentIndex !== undefined) {
                            markAncestors(parentIndex);
                        }
                    });
                }
            };

            // 从当前提交开始标记所有祖先
            markAncestors(currentCommitIndex);

            // 标记所有非祖先的提交为 muted
            commitNodes.forEach((commit, index) => {
                if (!ancestor[index]) {
                    muted[index] = true;
                }
            });
        }

        return muted;
    }, [commitNodes.length, branchChanged]); // 优化：只在提交数量或分支变化时重新计算

    // 展开后禁用虚拟滚动，避免变高行导致图形错位
    // 优化：使用 useRef 缓存上一次的可见范围，减少不必要的重新计算
    const prevVisibleRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
    const isExpanded = !!expandedCommit;
    const visibleRange = useMemo(() => {
        if (isExpanded) {
            const range = { start: 0, end: commitNodes.length };
            prevVisibleRangeRef.current = range;
            return range;
        }
        const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
        const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT);
        const end = Math.min(commitNodes.length, start + visibleCount + VISIBLE_BUFFER * 2);
        const range = { start, end };

        // 如果范围没有显著变化，使用缓存的值（减少重新渲染）
        const prev = prevVisibleRangeRef.current;
        if (Math.abs(range.start - prev.start) < 3 && Math.abs(range.end - prev.end) < 3) {
            return prev;
        }

        prevVisibleRangeRef.current = range;
        return range;
    }, [scrollTop, containerHeight, commitNodes.length, isExpanded]);

    const visibleCommits = useMemo(() => {
        return commitNodes.slice(visibleRange.start, visibleRange.end);
    }, [commitNodes, visibleRange]);

    // 处理滚动（使用防抖优化性能，参考 vscode-git-graph）
    const scrollTimeoutRef = useRef<number | null>(null);
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const newScrollTop = e.currentTarget.scrollTop;
        // 立即更新滚动位置用于虚拟滚动计算
        setScrollTop(newScrollTop);

        // 防抖延迟其他操作（如状态保存等）
        if (scrollTimeoutRef.current !== null) {
            clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = window.setTimeout(() => {
            scrollTimeoutRef.current = null;
            // 这里可以添加滚动后的其他操作，如保存状态等
        }, 250);
    }, []);

    // 清理所有定时器（组件卸载时）
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current !== null) {
                clearTimeout(scrollTimeoutRef.current);
            }
            if (renderTimeoutRef.current !== null) {
                clearTimeout(renderTimeoutRef.current);
            }
            if (renderFrameRef.current !== null) {
                cancelAnimationFrame(renderFrameRef.current);
            }
            if (detailHeightTimeoutRef.current !== null) {
                clearTimeout(detailHeightTimeoutRef.current);
            }
        };
    }, []);

    // 处理容器大小变化
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    // 记录表头高度，用于让 Graph SVG 与正文对齐
    useEffect(() => {
        const updateHeaderHeight = () => {
            if (headerRef.current) {
                setHeaderHeight(headerRef.current.getBoundingClientRect().height || ROW_HEIGHT);
            }
        };

        updateHeaderHeight();

        const resizeObserver = new ResizeObserver(updateHeaderHeight);
        if (headerRef.current) {
            resizeObserver.observe(headerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    // 右键菜单处理
    const handleContextMenu = useCallback((e: React.MouseEvent, commit: CommitNode) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCommit(commit.hash);

        vscode.postMessage({
            command: 'showCommitContextMenu',
            commitHash: commit.hash,
            x: e.clientX,
            y: e.clientY
        });
    }, []);

    // 点击提交行
    const handleCommitClick = useCallback((commit: CommitNode) => {
        const willExpand = expandedCommit !== commit.hash;
        setSelectedCommit(commit.hash);
        setExpandedCommit(prev => (prev === commit.hash ? null : commit.hash));

        // 如果关闭展开，清除选中状态，确保 muted 提交恢复浅色
        if (!willExpand) {
            // 使用 setTimeout 确保在下一个渲染周期清除，避免立即清除导致视觉闪烁
            setTimeout(() => {
                setSelectedCommit(null);
            }, 0);
        }
    }, [expandedCommit]);

    // 双击也仅做展开/收起，不再弹出右侧提交详情
    const handleCommitDoubleClick = useCallback((commit: CommitNode) => {
        const willExpand = expandedCommit !== commit.hash;
        setSelectedCommit(commit.hash);
        setExpandedCommit(prev => (prev === commit.hash ? null : commit.hash));

        // 如果关闭展开，清除选中状态，确保 muted 提交恢复浅色
        if (!willExpand) {
            setTimeout(() => {
                setSelectedCommit(null);
            }, 0);
        }
    }, [expandedCommit]);

    // 记录展开详情的高度，用于调整图形高度和 Y 坐标
    // 优化：使用防抖减少频繁的高度测量
    const detailHeightTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (!detailCellRef.current) {
            setDetailHeight(0);
            return;
        }

        const measure = () => {
            const h = detailCellRef.current?.getBoundingClientRect().height || 0;
            // 只在高度变化超过 1px 时才更新（减少不必要的重新渲染）
            setDetailHeight(prev => Math.abs(prev - h) > 1 ? h : prev);
        };

        // 使用防抖延迟测量，避免频繁更新
        if (detailHeightTimeoutRef.current !== null) {
            clearTimeout(detailHeightTimeoutRef.current);
        }
        detailHeightTimeoutRef.current = window.setTimeout(() => {
            measure();
            detailHeightTimeoutRef.current = null;
        }, 50);

        const ro = new ResizeObserver(() => {
            if (detailHeightTimeoutRef.current !== null) {
                clearTimeout(detailHeightTimeoutRef.current);
            }
            detailHeightTimeoutRef.current = window.setTimeout(() => {
                measure();
                detailHeightTimeoutRef.current = null;
            }, 50);
        });
        ro.observe(detailCellRef.current);
        return () => {
            ro.disconnect();
            if (detailHeightTimeoutRef.current !== null) {
                clearTimeout(detailHeightTimeoutRef.current);
            }
        };
    }, [expandedCommit]); // 优化：移除 visibleCommits 依赖，只在 expandedCommit 变化时重新测量

    // 处理分支标签单击（阻止事件冒泡，不执行操作）
    const handleBranchLabelClick = useCallback((e: React.MouseEvent, _branchName: string) => {
        e.stopPropagation();
        // 单击分支标签时不执行任何操作，只是阻止事件冒泡
    }, []);

    // 处理分支标签双击（执行 checkout）
    const handleBranchLabelDoubleClick = useCallback((e: React.MouseEvent, branchName: string, commitHash: string) => {
        e.stopPropagation();
        vscode.postMessage({
            command: 'checkoutBranch',
            branchName: branchName,
            commitHash: commitHash
        });
    }, []);

    // 处理分支标签右键（显示上下文菜单）
    const handleBranchLabelContextMenu = useCallback((e: React.MouseEvent, branchName: string, commitHash: string) => {
        e.preventDefault();
        e.stopPropagation();
        vscode.postMessage({
            command: 'showBranchContextMenu',
            branchName: branchName,
            commitHash: commitHash,
            x: e.clientX,
            y: e.clientY
        });
    }, []);

    // 渲染整个图形（基于官方实现 - 使用单个 SVG 覆盖整个图形列）
    const graphSvgRef = useRef<SVGSVGElement>(null);

    // 优化 SVG 渲染性能：只在数据变化时重新渲染，滚动时不重新渲染
    // 使用 useRef 跟踪渲染状态和上一次的数据，避免不必要的重新渲染
    const renderTimeoutRef = useRef<number | null>(null);
    const renderFrameRef = useRef<number | null>(null);
    const isRenderingRef = useRef(false);
    const lastRenderDataRef = useRef<{
        commitNodesLength: number;
        expandedCommit: string | null;
        detailHeight: number;
    }>({ commitNodesLength: 0, expandedCommit: null, detailHeight: 0 });

    useEffect(() => {
        if (!graphSvgRef.current) return;

        const svg = graphSvgRef.current;

        // 如果没有数据，确保 SVG 仍然可见（只是没有内容）
        if (commitNodes.length === 0 || !graphBranches) {
            svg.innerHTML = '';
            svg.style.opacity = '1';
            svg.style.visibility = 'visible';
            lastRenderDataRef.current = { commitNodesLength: 0, expandedCommit: null, detailHeight: 0 };
            return;
        }

        // 检查数据是否真的发生了变化（优化：避免不必要的重新渲染）
        const currentData = {
            commitNodesLength: commitNodes.length,
            expandedCommit: expandedCommit,
            detailHeight: detailHeight
        };
        const lastData = lastRenderDataRef.current;

        // 如果只是滚动位置变化（scrollTop），不重新渲染 SVG
        // 只有在数据真正变化时才重新渲染
        const dataChanged =
            currentData.commitNodesLength !== lastData.commitNodesLength ||
            currentData.expandedCommit !== lastData.expandedCommit ||
            Math.abs(currentData.detailHeight - lastData.detailHeight) > 1; // 允许 1px 的误差

        if (!dataChanged && lastData.commitNodesLength > 0) {
            // 数据没有变化，不需要重新渲染
            return;
        }

        // 如果正在渲染，取消之前的渲染请求
        if (renderTimeoutRef.current !== null) {
            clearTimeout(renderTimeoutRef.current);
        }

        // 使用防抖延迟渲染，避免快速连续的数据变化导致频繁重新渲染
        renderTimeoutRef.current = window.setTimeout(() => {
            if (isRenderingRef.current) return;
            isRenderingRef.current = true;

            // 使用 requestAnimationFrame 延迟渲染，避免阻塞主线程
            renderFrameRef.current = requestAnimationFrame(() => {
                // 使用双缓冲技术：先隐藏 SVG，渲染完成后再显示，避免闪烁
                // 获取当前透明度，如果没有设置则默认为 '1'
                const computedStyle = window.getComputedStyle(svg);
                const originalOpacity = computedStyle.opacity || '1';
                const originalVisibility = computedStyle.visibility || 'visible';

                // 只在有内容时才使用双缓冲技术，避免不必要的闪烁
                if (commitNodes.length > 0) {
                    svg.style.opacity = '0';
                    svg.style.visibility = 'hidden';
                }

                // 使用 requestAnimationFrame 确保样式更改生效后再清空和渲染
                requestAnimationFrame(() => {
                    try {
                        // 清空之前的内容
                        svg.innerHTML = '';

                        const expandedIndex = expandedCommit
                            ? commitNodes.findIndex(c => c.hash === expandedCommit)
                            : -1;
                        // 与表格保持一致，展开时至少补齐一行高度，避免 SVG 与行高不一致
                        const expandedGap = expandedIndex >= 0 ? Math.max(detailHeight, ROW_HEIGHT) : 0;
                        const totalHeight = commitNodes.length * GRID_Y + expandedGap;
                        svg.setAttribute('width', GRAPH_COLUMN_WIDTH.toString());
                        svg.setAttribute('height', totalHeight.toString());

                        // Y 坐标映射：考虑展开的提交
                        // 优化：SVG 使用 sticky 定位，top 为 headerHeight，内容从 0 开始
                        const mapY = (idx: number) => {
                            let baseY = idx * GRID_Y;  // 从 0 开始，因为 SVG 已经通过 top: headerHeight 偏移
                            if (expandedIndex >= 0 && idx > expandedIndex) {
                                baseY += expandedGap;
                            }
                            return baseY;
                        };

                        // 绘制所有分支的线条（按照官方实现逻辑）
                        // 使用 DocumentFragment 批量操作 DOM，提升性能
                        const branchFragment = document.createDocumentFragment();

                        graphBranches.forEach((branch: Branch) => {
                            const color = BRANCH_COLORS[branch.getColorIndex() % BRANCH_COLORS.length];
                            const lines = branch.getLines();

                            if (lines.length === 0) return;

                            // 第一步：转换线条坐标，处理展开区域（按照官方实现）
                            const placedLines: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number }; isCommitted: boolean; lockedFirst: boolean }> = [];

                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i];
                                const x1 = line.p1.x * GRID_X + GRID_OFFSET_X;
                                // 优化：SVG 使用 sticky 定位，top 为 headerHeight，内容从 0 开始
                                let y1 = line.p1.y * GRID_Y + GRID_OFFSET_Y;
                                const x2 = line.p2.x * GRID_X + GRID_OFFSET_X;
                                // 优化：SVG 使用 sticky 定位，top 为 headerHeight，内容从 0 开始
                                let y2 = line.p2.y * GRID_Y + GRID_OFFSET_Y;

                                // 处理展开区域（优化：简化逻辑，参考官方实现）
                                if (expandedIndex >= 0 && expandedGap > 0) {
                                    if (line.p1.y > expandedIndex) {
                                        // 如果线条在展开区域之后开始，整体向下移动
                                        y1 += expandedGap;
                                        y2 += expandedGap;
                                    } else if (line.p2.y > expandedIndex) {
                                        // 如果线条穿过展开区域
                                        if (x1 === x2) {
                                            // 垂直线：直接延伸端点
                                            y2 += expandedGap;
                                        } else if (line.lockedFirst) {
                                            // 锁定第一个点：过渡曲线保持在原位置，然后在目标轨道垂直延伸
                                            placedLines.push({
                                                p1: { x: x1, y: y1 },
                                                p2: { x: x2, y: y2 },
                                                isCommitted: line.isCommitted,
                                                lockedFirst: line.lockedFirst
                                            });
                                            // 添加垂直延伸线段：从过渡结束点到展开后的位置
                                            placedLines.push({
                                                p1: { x: x2, y: y1 + GRID_Y },
                                                p2: { x: x2, y: y2 + expandedGap },
                                                isCommitted: line.isCommitted,
                                                lockedFirst: line.lockedFirst
                                            });
                                            continue;
                                        } else {
                                            // 锁定第二个点：先垂直延伸，然后过渡曲线移到展开下方
                                            placedLines.push({
                                                p1: { x: x1, y: y1 },
                                                p2: { x: x1, y: y2 - GRID_Y + expandedGap },
                                                isCommitted: line.isCommitted,
                                                lockedFirst: line.lockedFirst
                                            });
                                            y1 += expandedGap;
                                            y2 += expandedGap;
                                        }
                                    }
                                }

                                placedLines.push({
                                    p1: { x: x1, y: y1 },
                                    p2: { x: x2, y: y2 },
                                    isCommitted: line.isCommitted,
                                    lockedFirst: line.lockedFirst
                                });
                            }

                            // 第二步：简化连续的垂直线（按照官方实现）
                            let i = 0;
                            while (i < placedLines.length - 1) {
                                const line = placedLines[i];
                                const nextLine = placedLines[i + 1];
                                if (line.p1.x === line.p2.x && line.p2.x === nextLine.p1.x && nextLine.p1.x === nextLine.p2.x &&
                                    line.p2.y === nextLine.p1.y && line.isCommitted === nextLine.isCommitted) {
                                    line.p2.y = nextLine.p2.y;
                                    placedLines.splice(i + 1, 1);
                                } else {
                                    i++;
                                }
                            }

                            // 第三步：构建 SVG path
                            let path = '';
                            for (i = 0; i < placedLines.length; i++) {
                                const line = placedLines[i];
                                const x1 = line.p1.x;
                                const y1 = line.p1.y;
                                const x2 = line.p2.x;
                                const y2 = line.p2.y;

                                // 如果路径未开始或新点属于不同路径，移动到 p1
                                if (path === '' || (i > 0 && (x1 !== placedLines[i - 1].p2.x || y1 !== placedLines[i - 1].p2.y))) {
                                    path += `M${x1.toFixed(0)},${y1.toFixed(1)}`;
                                }

                                if (x1 === x2) {
                                    // 垂直线
                                    path += `L${x2.toFixed(0)},${y2.toFixed(1)}`;
                                } else {
                                    // 对角线：使用贝塞尔曲线
                                    const dy = y2 - y1;
                                    const d = Math.min(Math.abs(dy) * 0.6, GRID_Y * 1.2);
                                    path += `C${x1.toFixed(0)},${(y1 + Math.sign(dy) * d).toFixed(1)} ${x2.toFixed(0)},${(y2 - Math.sign(dy) * d).toFixed(1)} ${x2.toFixed(0)},${y2.toFixed(1)}`;
                                }
                            }

                            // 使用 DocumentFragment 批量操作 DOM，提升性能
                            const fragment = document.createDocumentFragment();

                            // 绘制阴影（背景）
                            const shadowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            shadowPath.setAttribute('d', path);
                            shadowPath.setAttribute('stroke', 'var(--vscode-editor-background)');
                            shadowPath.setAttribute('stroke-width', '4');
                            shadowPath.setAttribute('stroke-opacity', '0.75');
                            shadowPath.setAttribute('fill', 'none');
                            fragment.appendChild(shadowPath);

                            // 绘制线条
                            const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            linePath.setAttribute('d', path);
                            linePath.setAttribute('stroke', color);
                            linePath.setAttribute('stroke-width', '2');
                            linePath.setAttribute('fill', 'none');
                            fragment.appendChild(linePath);

                            branchFragment.appendChild(fragment);
                        });

                        // 批量添加所有分支的线条
                        svg.appendChild(branchFragment);

                        // 绘制所有节点 - 使用 DocumentFragment 批量操作
                        const nodeFragment = document.createDocumentFragment();
                        const currentHash = data.branchGraph?.currentBranch || data.branches?.current;

                        commitNodes.forEach((commit: CommitNode, index: number) => {
                            const cx = commit.x * GRID_X + GRID_OFFSET_X;
                            const cy = mapY(index) + GRID_OFFSET_Y;
                            const color = BRANCH_COLORS[commit.colorIndex % BRANCH_COLORS.length];
                            const isCurrent = commit.hash === currentHash;

                            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                            circle.setAttribute('cx', cx.toString());
                            circle.setAttribute('cy', cy.toString());
                            circle.setAttribute('r', commit.isMerge ? '5' : '4');
                            circle.setAttribute('fill', isCurrent ? 'var(--vscode-editor-background)' : color);
                            circle.setAttribute('stroke', isCurrent ? color : 'var(--vscode-editor-background)');
                            circle.setAttribute('stroke-width', isCurrent ? '2' : '1');
                            circle.setAttribute('stroke-opacity', isCurrent ? '1' : '0.75');
                            circle.setAttribute('style', 'pointer-events: all; cursor: pointer;');
                            circle.setAttribute('data-hash', commit.hash);

                            // 鼠标悬停效果
                            circle.addEventListener('mouseenter', () => {
                                circle.setAttribute('r', '6');
                            });
                            circle.addEventListener('mouseleave', () => {
                                circle.setAttribute('r', commit.isMerge ? '5' : '4');
                            });

                            nodeFragment.appendChild(circle);
                        });

                        svg.appendChild(nodeFragment);

                        // 更新最后渲染的数据
                        lastRenderDataRef.current = currentData;

                        // 渲染完成后恢复可见性
                        if (commitNodes.length > 0) {
                            requestAnimationFrame(() => {
                                svg.style.opacity = originalOpacity;
                                svg.style.visibility = originalVisibility;
                                isRenderingRef.current = false;
                            });
                        } else {
                            isRenderingRef.current = false;
                        }
                    } catch (error) {
                        // 如果渲染出错，确保 SVG 仍然可见
                        console.error('SVG 渲染错误:', error);
                        svg.style.opacity = originalOpacity;
                        svg.style.visibility = originalVisibility;
                        isRenderingRef.current = false;
                    }
                });
            });
        }, 100); // 100ms 防抖延迟（增加延迟以减少渲染频率）

        return () => {
            if (renderTimeoutRef.current !== null) {
                clearTimeout(renderTimeoutRef.current);
                renderTimeoutRef.current = null;
            }
            if (renderFrameRef.current !== null) {
                cancelAnimationFrame(renderFrameRef.current);
                renderFrameRef.current = null;
            }
            isRenderingRef.current = false;
        };
    }, [commitNodes.length, graphBranches, expandedCommit, detailHeight]); // 优化：只依赖必要的数据，不依赖整个 commitNodes 数组

    if (!data?.log?.all || data.log.all.length === 0) {
        return (
            <div className="git-graph-view">
                <div className="section-header">
                    <h2>Git Graph 视图</h2>
                    <p className="section-description">表格形式的分支提交历史</p>
                </div>
                <div className="empty-state">
                    <p>📊 正在加载提交历史...</p>
                </div>
            </div>
        );
    }

    // 优化：缓存 expandedIndex 计算
    const expandedIndex = useMemo(() => {
        return expandedCommit ? commitNodes.findIndex(c => c.hash === expandedCommit) : -1;
    }, [expandedCommit, commitNodes.length]); // 只在 expandedCommit 或提交数量变化时重新计算

    const extraHeight = expandedIndex >= 0 ? Math.max(detailHeight, ROW_HEIGHT) : 0;
    const totalHeight = commitNodes.length * ROW_HEIGHT + extraHeight;
    // 列渲染占位偏移（虚拟滚动用）
    const offsetYRows = isExpanded ? 0 : visibleRange.start * ROW_HEIGHT;
    // 优化：使用 currentBranchRef 而不是每次都从 data 读取
    const currentBranchName = currentBranchRef.current;

    // 优化：缓存分支标签渲染函数，减少重新创建
    const renderBranchLabel = useCallback(
        (branch: string, colorIndex: number, commitHash: string) => {
            const isRemote = branch.startsWith('remotes/');
            const isBranchCurrent = branch === currentBranchName || (isRemote && branch.endsWith(`/${currentBranchName}`));
            const remoteTrimmed = isRemote ? branch.replace(/^remotes\//, '') : branch;
            const [remoteName, ...rest] = remoteTrimmed.split('/');
            const displayName = isRemote ? rest.join('/') || remoteTrimmed : branch;
            const branchColor = BRANCH_COLORS[colorIndex % BRANCH_COLORS.length];

            return (
                <span
                    key={branch}
                    className={`gitRef${isBranchCurrent ? ' active' : ''}${isRemote ? ' remote' : ' head'}`}
                    data-name={branch}
                    onClick={(e) => handleBranchLabelClick(e, branch)}
                    onDoubleClick={(e) => handleBranchLabelDoubleClick(e, branch, commitHash)}
                    onContextMenu={(e) => handleBranchLabelContextMenu(e, branch, commitHash)}
                    style={{
                        borderColor: isBranchCurrent ? branchColor : undefined,
                        color: isBranchCurrent ? branchColor : undefined
                    }}
                >
                    <span
                        className="gitRefIcon"
                        aria-hidden="true"
                        style={{
                            backgroundColor: branchColor,
                            color: '#ffffff'
                        }}
                    >
                        ⎇
                    </span>
                    <span className="gitRefName">{displayName}</span>
                    {isRemote && remoteName && (
                        <span className="gitRefHeadRemote" data-remote={remoteName} data-fullref={branch}>
                            {remoteName}
                        </span>
                    )}
                </span>
            );
        },
        [currentBranchName, handleBranchLabelClick, handleBranchLabelContextMenu, handleBranchLabelDoubleClick]
    );

    return (
        <div className="git-graph-view" style={{ height: '100%', display: 'flex', flexDirection: 'column', fontSize: '14px' }}>
            <div
                id="commitTable"
                className="autoLayout"
                style={{
                    position: 'relative',
                    flex: 1,
                    overflow: 'auto',
                    background: 'var(--vscode-editor-background)'
                }}
                ref={containerRef}
                onScroll={handleScroll}
            >
                {/* 图形 SVG - 绝对定位覆盖整个图形列 */}
                {/* 优化：SVG 使用绝对定位，top 为 headerHeight，确保与表格内容对齐 */}
                <svg
                    id="commitGraph"
                    ref={graphSvgRef}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: headerHeight,  // 从表头下方开始，与表格内容对齐
                        width: GRAPH_COLUMN_WIDTH,
                        height: totalHeight,  // 只包含表格内容高度
                        pointerEvents: 'none',
                        zIndex: 2,  // 显示在 Graph 列单元格之上，但低于其他列和表头
                        willChange: 'contents',  // 优化渲染性能
                        transform: 'translateZ(0)',  // 启用硬件加速
                        backfaceVisibility: 'hidden',  // 优化渲染性能
                        opacity: '1',  // 确保初始可见
                        visibility: 'visible'  // 确保初始可见
                    }}
                />
                <table
                    style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        position: 'relative',
                        zIndex: 3  // 高于 SVG，让 Description 列等其他列显示在 SVG 之上
                    }}
                >
                    <thead
                        ref={headerRef}
                        style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 20,  // 提高 z-index，确保表头始终在最上层
                            background: 'var(--vscode-sideBar-background)',
                            isolation: 'isolate'
                        }}
                    >
                        <tr>
                            <th id="tableHeaderGraphCol">Graph</th>
                            <th>Description</th>
                            <th className="dateCol">Date</th>
                            <th className="authorCol">Author</th>
                            <th>Commit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* 占位行 - 用于虚拟滚动 */}
                        <tr style={{ height: offsetYRows, visibility: 'hidden' }}>
                            <td colSpan={5} style={{ padding: 0, height: offsetYRows }} />
                        </tr>
                        {visibleCommits.map((commit: CommitNode) => {
                            // 优化：使用 currentBranchRef 而不是每次都从 data 读取
                            const isCurrent = commit.hash === currentBranchName;
                            const fullCommit = commitInfoMap.get(commit.hash);
                            // 优先使用 commitInfoMap 中的最新数据，如果没有则使用 commit 中的缓存数据
                            const commitMessage = fullCommit?.message || commit.message || '';
                            const parents = commit.parents || [];
                            const bodyText = fullCommit?.body?.trim();

                            // 优化：使用 Map 快速查找索引，而不是每次都 findIndex
                            // 注意：这里我们仍然需要 findIndex，因为 commitNodes 可能已经变化
                            // 但我们可以优化：只在 commitNodes 变化时重新构建索引映射
                            const commitIndex = commitNodes.findIndex(c => c.hash === commit.hash);
                            const isMuted = commitIndex >= 0 && mutedCommits[commitIndex];
                            const isExpanded = expandedCommit === commit.hash;

                            return (
                                <React.Fragment key={commit.hash}>
                                    <tr
                                        className={`commit${isCurrent ? ' current' : ''}${selectedCommit === commit.hash ? ' selected' : ''}${isMuted ? ' mute' : ''}${isExpanded ? ' commit-details-open' : ''}`}
                                        onClick={() => handleCommitClick(commit)}
                                        onDoubleClick={() => handleCommitDoubleClick(commit)}
                                        onContextMenu={(e) => handleContextMenu(e, commit)}
                                        style={{ height: ROW_HEIGHT }}
                                    >
                                        {/* Graph 列 - 占位符 */}
                                        <td
                                            className="graphCol"
                                            style={{
                                                width: GRAPH_COLUMN_WIDTH,
                                                padding: 0,
                                                margin: 0,
                                                position: 'relative',
                                                background: 'transparent',  // 背景透明，让 SVG 显示
                                                zIndex: 1  // 低于 SVG，让 SVG 显示在上面
                                            }}
                                        />

                                        {/* Description 列 */}
                                        <td className="text">
                                            <span className="description" style={{ display: 'flex', alignItems: 'center' }}>
                                                {/* 当前分支指示点 */}
                                                {isCurrent && (
                                                    <span
                                                        className="commitHeadDot"
                                                        style={{ borderColor: BRANCH_COLORS[commit.colorIndex % BRANCH_COLORS.length] }}
                                                        title="当前检出的提交"
                                                    />
                                                )}

                                                {/* 分支 / 远程标签（对齐 vscode-git-graph 展示） */}
                                                {commit.branches && commit.branches.length > 0 && commit.branches.slice(0, 6).map((branch: string) => renderBranchLabel(branch, commit.colorIndex, commit.hash))}

                                                {/* 提交消息 */}
                                                <span
                                                    className="text"
                                                    style={{
                                                        display: 'inline-block',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        flexGrow: 1,
                                                        minWidth: 0,
                                                        fontSize: '14px',
                                                        fontWeight: isCurrent ? 'bold' : 'normal',
                                                        color: 'var(--vscode-foreground)'
                                                    }}
                                                >
                                                    {commitMessage ? commitMessage.split('\n')[0] : '(无提交信息)'}
                                                </span>
                                            </span>
                                        </td>

                                        {/* Date 列 */}
                                        <td className="dateCol text" title={commit.date}>
                                            {formatDate(commit.date)}
                                        </td>

                                        {/* Author 列 */}
                                        <td className="authorCol text" title={`${commit.author_name} <${commit.author_email}>`}>
                                            {commit.author_name || '(未知作者)'}
                                        </td>

                                        {/* Commit 列 */}
                                        <td className="text" title={commit.hash}>
                                            {commit.hash.substring(0, 8)}
                                        </td>
                                    </tr>

                                    {/* 提交详情展开行 */}
                                    {expandedCommit === commit.hash && (
                                        <tr className="commit-details">
                                            {/* 保持 Graph 列占位，展开时不影响轨道宽度 */}
                                            <td
                                                className="graphCol"
                                                style={{
                                                    width: GRAPH_COLUMN_WIDTH,
                                                    padding: 0,
                                                    margin: 0,
                                                    borderTop: '1px solid var(--vscode-panel-border)',
                                                    background: 'transparent',  // 背景透明，让 SVG 显示
                                                    zIndex: 1  // 低于 SVG
                                                }}
                                            />
                                            <td
                                                colSpan={4}
                                                style={{
                                                    padding: '10px 12px',
                                                    background: 'var(--vscode-editor-background)',
                                                    borderTop: '1px solid var(--vscode-panel-border)'
                                                }}
                                                ref={detailCellRef}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 6,
                                                        fontSize: 14,
                                                        color: 'var(--vscode-foreground)'
                                                    }}
                                                >
                                                    <div>
                                                        <strong>提交哈希:</strong> <span style={{ fontFamily: 'monospace' }}>{commit.hash}</span>
                                                    </div>
                                                    {parents.length > 0 && (
                                                        <div>
                                                            <strong>父提交:</strong>{' '}
                                                            <span style={{ fontFamily: 'monospace' }}>{parents.join(', ')}</span>
                                                        </div>
                                                    )}
                                                    <div><strong>作者:</strong> {fullCommit?.author_name || commit.author_name} &lt;{fullCommit?.author_email || commit.author_email}&gt;</div>
                                                    <div><strong>日期:</strong> {fullCommit?.date || commit.date}</div>
                                                    <div>
                                                        <strong>提交信息:</strong>
                                                        <div
                                                            style={{
                                                                marginTop: 4,
                                                                whiteSpace: 'pre-wrap',
                                                                background: 'var(--vscode-textCodeBlock-background)',
                                                                borderRadius: 4,
                                                                padding: '6px 8px',
                                                                border: '1px solid var(--vscode-panel-border)'
                                                            }}
                                                        >
                                                            {fullCommit?.message || '(无提交信息)'}
                                                        </div>
                                                    </div>
                                                    {bodyText && bodyText.length > 0 && (
                                                        <div>
                                                            <strong>详细说明:</strong>
                                                            <div
                                                                style={{
                                                                    marginTop: 4,
                                                                    whiteSpace: 'pre-wrap',
                                                                    background: 'var(--vscode-textCodeBlock-background)',
                                                                    borderRadius: 4,
                                                                    padding: '6px 8px',
                                                                    border: '1px solid var(--vscode-panel-border)'
                                                                }}
                                                            >
                                                                {bodyText}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {/* 占位行 - 用于虚拟滚动 */}
                        <tr style={{ height: Math.max(0, totalHeight - offsetYRows - visibleCommits.length * ROW_HEIGHT), visibility: 'hidden' }}>
                            <td colSpan={5} style={{ padding: 0 }} />
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
