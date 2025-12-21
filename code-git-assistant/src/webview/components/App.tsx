import React, { useState, useEffect } from 'react';
import { CommitGraph } from './CommitGraph';
import { HeatmapAnalysis } from './HeatmapAnalysis';
import { BranchGraph } from './BranchGraph';
import { GitGraphView } from './GitGraphView';
import { TimelineView } from './TimelineView';
import { BranchTree } from './BranchTree';
import { TagManager } from './TagManager';
import { RemoteManager } from './RemoteManager';
import { ConflictEditor } from './ConflictEditor';
import { CommandHistory } from './CommandHistory';
import { GitCommandReference } from './GitCommandReference';
import './App.css';

/**
 * 主应用组件
 */
export const App: React.FC = () => {
    // 从持久化状态中恢复上次的标签页，如果没有则使用默认值
    const getInitialTab = (): 'graph' | 'heatmap' | 'branch-graph' | 'git-graph' | 'timeline' | 'branches' | 'tags' | 'remotes' | 'conflicts' | 'commands' | 'command-ref' => {
        const savedState = vscode.getState();
        if (savedState?.activeTab) {
            return savedState.activeTab;
        }
        return 'commands';
    };

    const [activeTab, setActiveTab] = useState<'graph' | 'heatmap' | 'branch-graph' | 'git-graph' | 'timeline' | 'branches' | 'tags' | 'remotes' | 'conflicts' | 'commands' | 'command-ref'>(getInitialTab());
    const [gitData, setGitData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // 保存标签页状态到持久化存储
    useEffect(() => {
        const currentState = vscode.getState() || {};
        vscode.setState({
            ...currentState,
            activeTab
        });
    }, [activeTab]);

    useEffect(() => {
        // 接收来自扩展的消息
        const handleMessage = (event: any) => {
            const message = event.data;
            if (message.type === 'gitData') {
                setGitData(message.data);
                setIsLoading(false);
            } else if (message.type === 'gitDataUpdate') {
                // 合并更新数据到现有数据
                setGitData((prevData: any) => {
                    if (!prevData) {
                        return message.data;
                    }
                    return {
                        ...prevData,
                        ...message.data
                    };
                });
            }
        };

        window.addEventListener('message', handleMessage);

        // 请求初始数据
        setIsLoading(true);
        vscode.postMessage({ command: 'getData' });

        // 清理函数
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleRefresh = () => {
        setIsLoading(true);
        vscode.postMessage({ command: 'getData' });
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="header-top">
                    <h1>Git Assistant 可视化面板</h1>
                    <button
                        className="refresh-button"
                        onClick={handleRefresh}
                        title="刷新面板信息"
                    >
                        <span className="refresh-icon">🔄</span>
                    </button>
                </div>
                <div className="tab-buttons">
                    <button
                        className={activeTab === 'commands' ? 'active' : ''}
                        onClick={() => setActiveTab('commands')}
                    >
                        📋 快捷指令
                    </button>
                    <button
                        className={activeTab === 'command-ref' ? 'active' : ''}
                        onClick={() => setActiveTab('command-ref')}
                    >
                        📚 Git 指令集
                    </button>
                    <button
                        className={activeTab === 'remotes' ? 'active' : ''}
                        onClick={() => setActiveTab('remotes')}
                    >
                        ☁️ 远程仓库
                    </button>
                    <button
                        className={activeTab === 'branches' ? 'active' : ''}
                        onClick={() => setActiveTab('branches')}
                    >
                        🌿 分支管理
                    </button>
                    <button
                        className={activeTab === 'tags' ? 'active' : ''}
                        onClick={() => setActiveTab('tags')}
                    >
                        🏷️ 标签管理
                    </button>
                    <button
                        className={activeTab === 'branch-graph' ? 'active' : ''}
                        onClick={() => setActiveTab('branch-graph')}
                    >
                        🌳 分支视图
                    </button>
                    <button
                        className={activeTab === 'git-graph' ? 'active' : ''}
                        onClick={() => setActiveTab('git-graph')}
                    >
                        📋 GitGraph
                    </button>
                    <button
                        className={activeTab === 'conflicts' ? 'active' : ''}
                        onClick={() => setActiveTab('conflicts')}
                    >
                        ⚠️ 冲突解决
                    </button>
                    <button
                        className={activeTab === 'graph' ? 'active' : ''}
                        onClick={() => setActiveTab('graph')}
                    >
                        📊 提交图
                    </button>
                    <button
                        className={activeTab === 'timeline' ? 'active' : ''}
                        onClick={() => setActiveTab('timeline')}
                    >
                        📅 时间线
                    </button>
                    <button
                        className={activeTab === 'heatmap' ? 'active' : ''}
                        onClick={() => setActiveTab('heatmap')}
                    >
                        🔥 热力图
                    </button>
                </div>
            </header>

            <main className="app-main">
                {isLoading ? (
                    <div className="loading-container">
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                        </div>
                        <p className="loading-text">正在加载数据...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'graph' && <CommitGraph data={gitData} />}
                        {activeTab === 'heatmap' && <HeatmapAnalysis data={gitData} />}
                        {activeTab === 'branch-graph' && <BranchGraph data={gitData} />}
                        {activeTab === 'git-graph' && <GitGraphView data={gitData} />}
                        {activeTab === 'timeline' && <TimelineView data={gitData} />}
                        {activeTab === 'branches' && <BranchTree data={gitData} />}
                        {activeTab === 'remotes' && <RemoteManager data={gitData} />}
                        {activeTab === 'tags' && <TagManager data={gitData} />}
                        {activeTab === 'conflicts' && <ConflictEditor data={gitData} />}
                        {activeTab === 'commands' && <CommandHistory data={gitData} />}
                        {activeTab === 'command-ref' && <GitCommandReference />}
                    </>
                )}
            </main>
        </div>
    );
};

