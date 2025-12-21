import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface FileStat {
    path: string;
    count: number;
}

interface ContributorStat {
    email: string;
    commits: number;
    files: number;
}

/**
 * 检测是否为浅色主题
 */
const isLightTheme = (): boolean => {
    if (typeof window === 'undefined') return false;
    const body = document.body;
    const bgColor = window.getComputedStyle(body).backgroundColor;
    const rgb = bgColor.match(/\d+/g);
    if (!rgb || rgb.length < 3) return false;
    const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
    return brightness > 128;
};

/**
 * 获取主题相关的颜色
 */
const getThemeColors = () => {
    const light = isLightTheme();
    return {
        emptyText: light ? '#666' : '#888',
        axisText: light ? '#666' : '#ccc',
        titleText: light ? '#333' : '#fff',
        labelText: light ? '#333' : '#fff'
    };
};

/**
 * 热力图分析组件 - 展示文件修改频率和贡献者活跃度
 */
export const HeatmapAnalysis: React.FC<{ data: any }> = ({ data }) => {
    const fileHeatmapRef = useRef<SVGSVGElement>(null);
    const contributorHeatmapRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'files' | 'contributors'>('files');

    useEffect(() => {
        if (!data) return;

        // 文件修改频率热力图
        if (activeTab === 'files' && fileHeatmapRef.current) {
            if (data.fileStats && (Array.isArray(data.fileStats) ? data.fileStats.length > 0 : data.fileStats.size > 0)) {
                drawFileHeatmap(fileHeatmapRef.current, data.fileStats);
            } else {
                // 如果没有数据，清空并显示提示
                const theme = getThemeColors();
                d3.select(fileHeatmapRef.current).selectAll('*').remove();
                const width = (fileHeatmapRef.current as any).clientWidth || 800;
                const height = 400;
                d3.select(fileHeatmapRef.current)
                    .attr('width', width)
                    .attr('height', height)
                    .append('text')
                    .attr('x', width / 2)
                    .attr('y', height / 2)
                    .attr('text-anchor', 'middle')
                    .style('fill', theme.emptyText)
                    .text('暂无文件修改数据');
            }
        }

        // 贡献者活跃度热力图
        if (activeTab === 'contributors' && contributorHeatmapRef.current) {
            if (data.contributorStats && (Array.isArray(data.contributorStats) ? data.contributorStats.length > 0 : data.contributorStats.size > 0)) {
                drawContributorHeatmap(contributorHeatmapRef.current, data.contributorStats);
            } else {
                // 如果没有数据，显示提示
                const theme = getThemeColors();
                const containerEl = contributorHeatmapRef.current as any;
                containerEl.innerHTML = '';
                containerEl.style.display = 'flex';
                containerEl.style.alignItems = 'center';
                containerEl.style.justifyContent = 'center';
                containerEl.style.height = '400px';
                containerEl.innerHTML = `<p style="text-align: center; color: ${theme.emptyText}; margin: 0;">暂无贡献者数据</p>`;
            }
        }
    }, [data, activeTab]);

    const drawFileHeatmap = (container: SVGSVGElement, fileStats: Map<string, number> | FileStat[]) => {
        d3.select(container).selectAll('*').remove();

        const width = (container as any).clientWidth || ((container as any).getBoundingClientRect?.()?.width) || 800;
        const height = 400;
        const margin = { top: 20, right: 20, bottom: 60, left: 200 };
        const theme = getThemeColors();

        const svg = d3.select(container)
            .attr('width', width)
            .attr('height', height);

        // 转换数据
        const statsArray: FileStat[] = Array.isArray(fileStats)
            ? fileStats
            : Array.from(fileStats.entries()).map(([path, count]) => ({ path, count }));

        // 按修改次数排序，取前20个
        const topFiles = statsArray
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        if (topFiles.length === 0) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .style('fill', theme.emptyText)
                .text('暂无文件修改数据');
            return;
        }

        // 创建颜色比例尺
        const maxCount = d3.max(topFiles, d => d.count) || 1;
        const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
            .domain([0, maxCount]);

        // 创建比例尺
        const xScale = d3.scaleBand()
            .domain(topFiles.map((_, i) => i.toString()))
            .range([margin.left, width - margin.right])
            .padding(0.1);

        const yScale = d3.scaleBand()
            .domain(topFiles.map(d => d.path))
            .range([margin.top, height - margin.bottom])
            .padding(0.1);

        // 绘制矩形
        svg.selectAll('.file-rect')
            .data(topFiles)
            .enter()
            .append('rect')
            .attr('class', 'file-rect')
            .attr('x', (_: any, i: number) => xScale(i.toString()) || 0)
            .attr('y', (d: FileStat) => yScale(d.path) || 0)
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('fill', (d: FileStat) => colorScale(d.count) as string)
            .attr('stroke', isLightTheme() ? '#e0e0e0' : '#333')
            .attr('stroke-width', 1)
            .append('title')
            .text((d: FileStat) => `${d.path}\n修改次数: ${d.count}`);

        // 添加数值标签
        svg.selectAll('.file-label')
            .data(topFiles)
            .enter()
            .append('text')
            .attr('class', 'file-label')
            .attr('x', (_: any, i: number) => (xScale(i.toString()) || 0) + xScale.bandwidth() / 2)
            .attr('y', (d: FileStat) => (yScale(d.path) || 0) + yScale.bandwidth() / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('fill', (d: FileStat) => d.count > maxCount / 2 ? theme.labelText : (isLightTheme() ? '#333' : '#fff'))
            .style('font-size', '10px')
            .text((d: FileStat) => d.count.toString());

        // 添加Y轴（文件路径）
        svg.append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(yScale))
            .selectAll('text')
            .style('font-size', '10px')
            .style('fill', theme.axisText)
            .call((text: any) => {
                text.each(function (this: SVGTextElement) {
                    const textEl = d3.select(this);
                    const words = textEl.text().split('/');
                    if (words.length > 2) {
                        textEl.text(words[words.length - 2] + '/' + words[words.length - 1]);
                    }
                });
            });

        // 添加标题
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', theme.titleText)
            .text('文件修改频率热力图（Top 20）');
    };

    const drawContributorHeatmap = (container: HTMLDivElement, contributorStats: Map<string, any> | ContributorStat[]) => {
        const containerEl = container as any;
        containerEl.innerHTML = '';
        // 重置样式
        containerEl.style.display = '';
        containerEl.style.alignItems = '';
        containerEl.style.justifyContent = '';
        containerEl.style.height = '';

        const theme = getThemeColors();

        // 转换数据
        const statsArray: ContributorStat[] = Array.isArray(contributorStats)
            ? contributorStats
            : Array.from(contributorStats.entries()).map(([email, stats]) => ({
                email,
                commits: stats.commits || 0,
                files: stats.files?.size || 0
            }));

        if (statsArray.length === 0) {
            containerEl.style.display = 'flex';
            containerEl.style.alignItems = 'center';
            containerEl.style.justifyContent = 'center';
            containerEl.style.height = '400px';
            containerEl.innerHTML = `<p style="text-align: center; color: ${theme.emptyText}; margin: 0;">暂无贡献者数据</p>`;
            return;
        }

        // 按提交数排序
        const sortedContributors = statsArray
            .sort((a, b) => b.commits - a.commits)
            .slice(0, 15);

        const maxCommits = Math.max(...sortedContributors.map(c => c.commits), 1);

        // 创建热力图容器
        const heatmapContainer = document.createElement('div');
        heatmapContainer.style.display = 'grid';
        heatmapContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        heatmapContainer.style.gap = '15px';
        heatmapContainer.style.padding = '20px';

        sortedContributors.forEach(contributor => {
            const card = document.createElement('div');
            card.style.background = `linear-gradient(135deg, ${getColorForCommits(contributor.commits, maxCommits)}, ${getColorForCommits(contributor.commits * 0.8, maxCommits)})`;
            card.style.borderRadius = '8px';
            card.style.padding = '20px';
            card.style.color = '#fff';
            card.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';

            const name = document.createElement('div');
            name.style.fontWeight = 'bold';
            name.style.fontSize = '16px';
            name.style.marginBottom = '10px';
            name.style.wordBreak = 'break-all';
            name.textContent = contributor.email.split('@')[0] || contributor.email;

            const commits = document.createElement('div');
            commits.style.fontSize = '32px';
            commits.style.fontWeight = 'bold';
            commits.style.marginBottom = '5px';
            commits.textContent = contributor.commits.toString();

            const commitsLabel = document.createElement('div');
            commitsLabel.style.fontSize = '12px';
            commitsLabel.style.opacity = '0.9';
            commitsLabel.textContent = '次提交';

            const files = document.createElement('div');
            files.style.marginTop = '10px';
            files.style.fontSize = '14px';
            files.style.opacity = '0.9';
            files.textContent = `涉及 ${contributor.files} 个文件`;

            card.appendChild(name);
            card.appendChild(commits);
            card.appendChild(commitsLabel);
            card.appendChild(files);

            heatmapContainer.appendChild(card);
        });

        containerEl.appendChild(heatmapContainer);
    };

    const getColorForCommits = (commits: number, maxCommits: number): string => {
        const ratio = commits / maxCommits;
        if (ratio > 0.8) return '#4a90e2';
        if (ratio > 0.6) return '#5ba3f5';
        if (ratio > 0.4) return '#6cb6ff';
        if (ratio > 0.2) return '#7dc9ff';
        return '#8edaff';
    };

    return (
        <div className="heatmap-analysis">
            <div className="section-header">
                <h2>热力图分析</h2>
                <p className="section-description">
                    展示文件修改频率和贡献者活跃度统计
                </p>
            </div>

            <div className="tab-buttons" style={{ marginBottom: '20px' }}>
                <button
                    className={activeTab === 'files' ? 'active' : ''}
                    onClick={() => setActiveTab('files')}
                    style={{
                        padding: '10px 20px',
                        border: '1px solid var(--vscode-panel-border)',
                        background: activeTab === 'files' ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
                        color: activeTab === 'files' ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginRight: '10px'
                    }}
                >
                    文件修改频率
                </button>
                <button
                    className={activeTab === 'contributors' ? 'active' : ''}
                    onClick={() => setActiveTab('contributors')}
                    style={{
                        padding: '10px 20px',
                        border: '1px solid var(--vscode-panel-border)',
                        background: activeTab === 'contributors' ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
                        color: activeTab === 'contributors' ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    贡献者活跃度
                </button>
            </div>

            <div className="graph-container">
                {activeTab === 'files' && (
                    <svg ref={fileHeatmapRef} style={{ width: '100%', height: '400px', background: 'var(--vscode-sideBar-background)' }} />
                )}
                {activeTab === 'contributors' && (
                    <div ref={contributorHeatmapRef} style={{ minHeight: '400px' }} />
                )}
            </div>

            {!data && (
                <div className="empty-state">
                    <p>📊 正在加载统计数据...</p>
                </div>
            )}
        </div>
    );
};

