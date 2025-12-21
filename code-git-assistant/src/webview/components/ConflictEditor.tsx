import React, { useState } from 'react';

/**
 * 冲突编辑器组件
 */
export const ConflictEditor: React.FC<{ data: any }> = ({ data }) => {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    const handleResolveConflict = (file: string, action: 'current' | 'incoming' | 'both') => {
        vscode.postMessage({
            command: 'resolveConflict',
            file,
            action
        });
    };

    const handleOpenFile = (file: string) => {
        vscode.postMessage({
            command: 'openFile',
            file
        });
    };

    if (!data?.conflicts) {
        return (
            <div className="empty-state">
                <p>⚠️ 正在检测冲突...</p>
            </div>
        );
    }

    const conflicts = data.conflicts || [];

    if (conflicts.length === 0) {
        return (
            <div className="empty-state success">
                <div className="success-icon">✅</div>
                <h2>没有冲突</h2>
                <p>当前工作区没有发现任何冲突文件</p>
            </div>
        );
    }

    return (
        <div className="conflict-editor">
            <div className="section-header">
                <h2>冲突解决</h2>
                <div className="conflict-count">
                    发现 <span className="count">{conflicts.length}</span> 个冲突文件
                </div>
            </div>

            <div className="conflict-list">
                {conflicts.map((file: string) => (
                    <div
                        key={file}
                        className={`conflict-item ${selectedFile === file ? 'selected' : ''}`}
                        onClick={() => setSelectedFile(file)}
                    >
                        <div className="conflict-header">
                            <span className="conflict-icon">⚠️</span>
                            <span className="file-path">{file}</span>
                            <button
                                className="open-button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenFile(file);
                                }}
                            >
                                📝 打开文件
                            </button>
                        </div>

                        {selectedFile === file && (
                            <div className="conflict-actions">
                                <h4>选择解决方式：</h4>
                                <div className="action-buttons">
                                    <button
                                        className="action-button current"
                                        onClick={() => handleResolveConflict(file, 'current')}
                                    >
                                        <div className="button-icon">←</div>
                                        <div className="button-label">接受当前更改</div>
                                        <div className="button-desc">保留本地修改</div>
                                    </button>

                                    <button
                                        className="action-button incoming"
                                        onClick={() => handleResolveConflict(file, 'incoming')}
                                    >
                                        <div className="button-icon">→</div>
                                        <div className="button-label">接受传入更改</div>
                                        <div className="button-desc">使用远程修改</div>
                                    </button>

                                    <button
                                        className="action-button both"
                                        onClick={() => handleResolveConflict(file, 'both')}
                                    >
                                        <div className="button-icon">↕</div>
                                        <div className="button-label">接受所有更改</div>
                                        <div className="button-desc">保留两边修改</div>
                                    </button>
                                </div>

                                <div className="manual-edit">
                                    <p>
                                        💡 提示：你也可以点击"打开文件"手动编辑解决冲突
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="conflict-guide">
                <h3>📖 冲突解决指南</h3>
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
        </div>
    );
};

declare const vscode: any;

