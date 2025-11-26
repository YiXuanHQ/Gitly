import React, { useState, useEffect, useRef } from 'react';

/**
 * 分支树组件
 */
export const BranchTree: React.FC<{ data: any }> = ({ data }) => {
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const [isCreatingBranch, setIsCreatingBranch] = useState<boolean>(false);
    const [createRequestTimestamp, setCreateRequestTimestamp] = useState<number | null>(null);
    const [creationResult, setCreationResult] = useState<'success' | 'error' | null>(null);

    // 切换分支状态
    const [isSwitchingBranch, setIsSwitchingBranch] = useState<boolean>(false);
    const [switchingBranchName, setSwitchingBranchName] = useState<string | null>(null);
    const [switchResult, setSwitchResult] = useState<'success' | 'error' | null>(null);
    const previousCurrentBranch = React.useRef<string | null>(null);

    // 合并分支状态
    const [isMergingBranch, setIsMergingBranch] = useState<boolean>(false);
    const [mergingBranchName, setMergingBranchName] = useState<string | null>(null);
    const [mergeResult, setMergeResult] = useState<'success' | 'error' | null>(null);
    const mergeRequestTimestamp = useRef<number | null>(null);
    const previousLogCount = useRef<number>(0);

    const handleBranchClick = (branchName: string) => {
        setSelectedBranch(branchName);
    };

    const handleSwitchBranch = (branchName: string) => {
        setIsSwitchingBranch(true);
        setSwitchingBranchName(branchName);
        setSwitchResult(null);
        previousCurrentBranch.current = data?.branches?.current || null;
        vscode.postMessage({
            command: 'switchBranch',
            branch: branchName
        });
    };

    const handleMergeBranch = (branchName: string) => {
        setIsMergingBranch(true);
        setMergingBranchName(branchName);
        setMergeResult(null);
        mergeRequestTimestamp.current = Date.now();
        previousLogCount.current = data?.log?.all?.length || 0;
        vscode.postMessage({
            command: 'mergeBranch',
            branch: branchName
        });
    };

    const handleCreateBranch = () => {
        setIsCreatingBranch(true);
        setCreateRequestTimestamp(Date.now());
        setCreationResult(null);
        vscode.postMessage({ command: 'createBranch' });
    };

    useEffect(() => {
        if (!isCreatingBranch || !createRequestTimestamp || !data?.commandHistory) {
            return;
        }

        const matchedEntry = data.commandHistory.find(
            (item: any) =>
                item.command === 'git-assistant.createBranch' &&
                item.timestamp >= createRequestTimestamp
        );

        if (matchedEntry) {
            setIsCreatingBranch(false);
            setCreateRequestTimestamp(null);
            setCreationResult(matchedEntry.success ? 'success' : 'error');
        }
    }, [data?.commandHistory, isCreatingBranch, createRequestTimestamp]);

    useEffect(() => {
        if (!creationResult) {
            return;
        }
        const timer = setTimeout(() => setCreationResult(null), 2500);
        return () => clearTimeout(timer);
    }, [creationResult]);

    // 监听切换分支操作完成
    useEffect(() => {
        if (!isSwitchingBranch || !switchingBranchName || !data?.branches) {
            return;
        }

        const currentBranch = data.branches.current;

        // 如果当前分支已经改变为目标分支，说明切换成功
        if (currentBranch === switchingBranchName && currentBranch !== previousCurrentBranch.current) {
            setIsSwitchingBranch(false);
            setSwitchResult('success');
            setSwitchingBranchName(null);
            previousCurrentBranch.current = currentBranch;
        }
    }, [data?.branches?.current, isSwitchingBranch, switchingBranchName]);

    // 清除切换分支结果提示
    useEffect(() => {
        if (!switchResult) {
            return;
        }
        const timer = setTimeout(() => {
            setSwitchResult(null);
        }, 2500);
        return () => clearTimeout(timer);
    }, [switchResult]);

    // 监听合并分支操作完成 - 通过检测数据刷新来判断
    useEffect(() => {
        if (!isMergingBranch || !mergingBranchName || !mergeRequestTimestamp.current) {
            return;
        }

        const currentLogCount = data?.log?.all?.length || 0;
        const currentTimestamp = Date.now();

        // 如果数据已经刷新（提交数量增加或数据更新时间在请求之后），认为合并操作完成
        // 给一个合理的延迟来等待数据刷新
        if (currentTimestamp - mergeRequestTimestamp.current > 500) {
            // 检查是否有新的提交（合并会产生新的提交）或者数据已经更新
            if (currentLogCount > previousLogCount.current || currentTimestamp - mergeRequestTimestamp.current > 2000) {
                setIsMergingBranch(false);
                setMergeResult('success');
                setMergingBranchName(null);
                mergeRequestTimestamp.current = null;
                previousLogCount.current = currentLogCount;
            }
        }
    }, [data?.log, isMergingBranch, mergingBranchName]);

    // 清除合并分支结果提示
    useEffect(() => {
        if (!mergeResult) {
            return;
        }
        const timer = setTimeout(() => {
            setMergeResult(null);
        }, 2500);
        return () => clearTimeout(timer);
    }, [mergeResult]);

    // 更新当前分支引用
    useEffect(() => {
        if (data?.branches?.current) {
            previousCurrentBranch.current = data.branches.current;
        }
    }, [data?.branches?.current]);

    if (!data?.branches) {
        return (
            <div className="empty-state">
                <p>🌿 正在加载分支信息...</p>
            </div>
        );
    }

    const localBranches = data.branches.all.filter((b: string) => !b.startsWith('remotes/'));
    const remoteBranches = data.branches.all.filter((b: string) => b.startsWith('remotes/'));
    const currentBranch = data.branches.current;

    return (
        <div className="branch-tree">
            <div className="section-header">
                <h2>分支管理</h2>
                <button
                    className={`primary-button ${isCreatingBranch ? 'loading' : ''}`}
                    onClick={handleCreateBranch}
                    disabled={isCreatingBranch}
                >
                    {isCreatingBranch ? '⏳ 正在创建...' : '➕ 创建新分支'}
                </button>
            </div>

            {((isCreatingBranch || creationResult) || (isSwitchingBranch || switchResult) || (isMergingBranch || mergeResult)) && (
                <div
                    className={`branch-creation-status ${creationResult || switchResult || mergeResult
                            ? (creationResult || switchResult || mergeResult)
                            : 'loading'
                        }`}
                >
                    {isCreatingBranch && (
                        <>
                            <span className="mini-spinner" />
                            <span>正在创建/刷新分支数据...</span>
                        </>
                    )}
                    {!isCreatingBranch && creationResult === 'success' && (
                        <>
                            <span className="status-icon">✅</span>
                            <span>新分支已创建并同步</span>
                        </>
                    )}
                    {!isCreatingBranch && creationResult === 'error' && (
                        <>
                            <span className="status-icon">⚠️</span>
                            <span>创建分支失败，请检查命令反馈</span>
                        </>
                    )}

                    {isSwitchingBranch && (
                        <>
                            <span className="mini-spinner" />
                            <span>正在切换到分支 "{switchingBranchName}"...</span>
                        </>
                    )}
                    {!isSwitchingBranch && switchResult === 'success' && (
                        <>
                            <span className="status-icon">✅</span>
                            <span>已成功切换到分支 "{switchingBranchName}"</span>
                        </>
                    )}

                    {isMergingBranch && (
                        <>
                            <span className="mini-spinner" />
                            <span>正在合并分支 "{mergingBranchName}"...</span>
                        </>
                    )}
                    {!isMergingBranch && mergeResult === 'success' && (
                        <>
                            <span className="status-icon">✅</span>
                            <span>分支 "{mergingBranchName}" 已成功合并</span>
                        </>
                    )}
                </div>
            )}

            <div className="branch-section">
                <h3>📁 本地分支 ({localBranches.length})</h3>
                <div className="branch-list">
                    {localBranches.map((branch: string) => (
                        <div
                            key={branch}
                            className={`branch-item ${branch === currentBranch ? 'current' : ''} ${branch === selectedBranch ? 'selected' : ''
                                }`}
                            onClick={() => handleBranchClick(branch)}
                        >
                            <div className="branch-info">
                                <span className="branch-icon">
                                    {branch === currentBranch ? '✓' : '○'}
                                </span>
                                <span className="branch-name">{branch}</span>
                                {branch === currentBranch && (
                                    <span className="branch-badge">当前</span>
                                )}
                            </div>
                            {branch !== currentBranch && (
                                <div className="branch-actions">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSwitchBranch(branch);
                                        }}
                                        title="切换到此分支"
                                    >
                                        🔀
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMergeBranch(branch);
                                        }}
                                        title="合并此分支"
                                    >
                                        🔗
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="branch-section">
                <h3>☁️ 远程分支 ({remoteBranches.length})</h3>
                <div className="branch-list">
                    {remoteBranches.map((branch: string) => (
                        <div
                            key={branch}
                            className="branch-item"
                            onClick={() => handleBranchClick(branch)}
                        >
                            <div className="branch-info">
                                <span className="branch-icon">☁️</span>
                                <span className="branch-name">
                                    {branch.replace('remotes/', '')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

