import React from 'react';
import { convertGitUrlToBrowserUrl } from '../utils/url';

interface RemoteInfo {
    name: string;
    refs?: {
        fetch?: string;
        push?: string;
    };
}

/**
 * 远程仓库管理组件
 */
export const RemoteManager: React.FC<{ data: any }> = ({ data }) => {
    const remotes: RemoteInfo[] = data?.remotes || [];
    const trackingInfo = data?.status?.tracking || '';
    let trackingRemote: string | null = null;
    let trackingBranch: string | null = null;
    if (trackingInfo && trackingInfo.includes('/')) {
        const separatorIndex = trackingInfo.indexOf('/');
        trackingRemote = trackingInfo.slice(0, separatorIndex);
        trackingBranch = trackingInfo.slice(separatorIndex + 1);
    } else if (trackingInfo) {
        trackingRemote = trackingInfo;
    }
    const defaultRemoteName = trackingRemote || (remotes[0]?.name ?? null);

    const handleAddRemote = () => {
        vscode.postMessage({ command: 'addRemote' });
    };

    const handleEditRemote = (remoteName: string) => {
        vscode.postMessage({ command: 'editRemote', remote: remoteName });
    };

    const handleDeleteRemote = (remoteName: string) => {
        vscode.postMessage({ command: 'deleteRemote', remote: remoteName });
    };

    const handleOpenRemote = (remoteUrl?: string) => {
        if (!remoteUrl) {
            return;
        }
        const browserUrl = convertGitUrlToBrowserUrl(remoteUrl);
        if (!browserUrl) {
            return;
        }
        vscode.postMessage({ command: 'openRemoteUrl', url: browserUrl });
    };

    if (!data) {
        return (
            <div className="empty-state">
                <p>☁️ 正在加载远程仓库信息...</p>
            </div>
        );
    }

    const hasRemotes = remotes.length > 0;

    return (
        <div className="remote-manager">
            <div className="section-header">
                <h2>远程仓库管理</h2>
                <button className="primary-button" onClick={handleAddRemote}>
                    ➕ 添加远程仓库
                </button>
            </div>

            <div className="remote-summary">
                {trackingRemote ? (
                    <div>
                        🌿 当前分支上游：<strong>{trackingRemote}/{trackingBranch || ''}</strong>
                    </div>
                ) : (
                    <div>⚠️ 当前分支尚未设置上游分支</div>
                )}
                {defaultRemoteName && (
                    <div className="remote-default">
                        📤 默认推送远程：<strong>{defaultRemoteName}</strong>
                    </div>
                )}
            </div>

            {!hasRemotes ? (
                <div className="empty-state">
                    <div className="empty-icon">☁️</div>
                    <p>当前仓库还没有任何远程仓库</p>
                    <p className="empty-hint">点击上方按钮添加远程仓库</p>
                </div>
            ) : (
                <div className="remote-list">
                    {remotes.map((remote) => {
                        const remoteUrl = remote.refs?.fetch || remote.refs?.push || '';
                        const browserUrl = convertGitUrlToBrowserUrl(remoteUrl);
                        return (
                            <div
                                key={remote.name}
                                className={`remote-item${remote.name === trackingRemote ? ' tracking' : ''}`}
                            >
                                <div className="remote-info">
                                    <div className="remote-title">
                                        <span className="remote-icon">☁️</span>
                                        <span className="remote-name">{remote.name}</span>
                                        {remote.name === trackingRemote && (
                                            <span className="remote-badge">当前分支跟踪</span>
                                        )}
                                    </div>
                                    <div className="remote-meta">
                                        <div className="remote-url">
                                            <span>fetch:</span>
                                            <span className="url-text">{remote.refs?.fetch || '—'}</span>
                                        </div>
                                        <div className="remote-url">
                                            <span>push:</span>
                                            <span className="url-text">{remote.refs?.push || remote.refs?.fetch || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="remote-actions">
                                    <button
                                        onClick={() => handleOpenRemote(remoteUrl)}
                                        title={browserUrl ? '在浏览器中打开' : '无法转换为浏览器链接'}
                                        disabled={!browserUrl}
                                    >
                                        🔗
                                    </button>
                                    <button
                                        onClick={() => handleEditRemote(remote.name)}
                                        title="编辑远程仓库"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="danger-button"
                                        onClick={() => handleDeleteRemote(remote.name)}
                                        title="删除远程仓库"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};


