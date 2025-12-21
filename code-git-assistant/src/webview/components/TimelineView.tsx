import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface TimelineData {
    date: string;
    count: number;
}

/**
 * 检测是否为浅色主题
 */
const isLightTheme = (): boolean => {
    if (typeof window === 'undefined') return false;
    const body = document.body;
    const bgColor = window.getComputedStyle(body).backgroundColor;
    // 解析 RGB 值
    const rgb = bgColor.match(/\d+/g);
    if (!rgb || rgb.length < 3) return false;
    // 计算亮度 (0-255)
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
        gridLine: light ? '#e0e0e0' : '#333',
        emptyCell: light ? '#f5f5f5' : '#2d2d2d',
        labelText: light ? '#333' : '#fff',
        inactiveText: light ? '#999' : '#888'
    };
};

/**
 * 时间线视图组件 - 结合日历的提交时间线
 */
export const TimelineView: React.FC<{ data: any }> = ({ data }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const calendarRef = useRef<HTMLDivElement>(null);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

    useEffect(() => {
        // 确保 timeline 数据存在（可能是空数组）
        const timeline = data?.timeline;
        if (timeline === undefined || timeline === null) {
            // 如果数据还未加载，清空显示
            if (svgRef.current) {
                d3.select(svgRef.current).selectAll('*').remove();
            }
            if (calendarRef.current) {
                (calendarRef.current as any).innerHTML = '';
            }
            return;
        }

        if (svgRef.current) {
            drawTimelineChart(svgRef.current, timeline, selectedYear, selectedMonth);
        }

        if (calendarRef.current) {
            drawCalendar(calendarRef.current, timeline, selectedYear, selectedMonth);
        }
    }, [data, selectedYear, selectedMonth]);

    const drawTimelineChart = (container: SVGSVGElement, timeline: Map<string, number> | TimelineData[], year: number, month: number) => {
        d3.select(container).selectAll('*').remove();

        const width = (container as any).clientWidth || ((container as any).getBoundingClientRect?.()?.width) || 1000;
        const height = 300;
        const margin = { top: 20, right: 20, bottom: 50, left: 60 };
        const theme = getThemeColors();

        const svg = d3.select(container)
            .attr('width', width)
            .attr('height', height);

        // 转换数据
        const timelineArray: TimelineData[] = Array.isArray(timeline)
            ? timeline
            : Array.from(timeline.entries()).map(([date, count]) => ({ date, count }));

        if (timelineArray.length === 0) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .style('fill', theme.emptyText)
                .text('暂无时间线数据');
            return;
        }

        // 过滤出选中月份的数据
        const monthData = timelineArray.filter(d => {
            const date = new Date(d.date);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
        });

        // 获取该月的所有日期（包括没有提交的日期）
        const daysInMonth = new Date(year, month, 0).getDate();
        const allDays: TimelineData[] = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const existingData = monthData.find(d => d.date === dateKey);
            allDays.push(existingData || { date: dateKey, count: 0 });
        }

        if (allDays.length === 0) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .style('fill', theme.emptyText)
                .text(`暂无 ${year}年${month}月 的数据`);
            return;
        }

        // 创建比例尺 - 使用 scaleBand 用于柱状图
        const xScale = d3.scaleBand()
            .domain(allDays.map(d => d.date))
            .range([margin.left, width - margin.right])
            .padding(0.1);

        const maxCount = Math.max(...allDays.map(d => d.count), 1);
        const yScale = d3.scaleLinear()
            .domain([0, maxCount])
            .range([height - margin.bottom, margin.top]);

        // 绘制柱状图
        svg.selectAll('.bar')
            .data(allDays)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', (d: TimelineData) => xScale(d.date) || 0)
            .attr('y', (d: TimelineData) => yScale(d.count))
            .attr('width', xScale.bandwidth())
            .attr('height', (d: TimelineData) => height - margin.bottom - yScale(d.count))
            .attr('fill', (d: TimelineData) => d.count > 0 ? '#0e639c' : theme.emptyCell)
            .attr('rx', 2)
            .attr('ry', 2)
            .append('title')
            .text((d: TimelineData) => {
                const date = new Date(d.date);
                return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日\n${d.count} 次提交`;
            });

        // 添加数值标签（只在有提交的日期显示）
        svg.selectAll('.bar-label')
            .data(allDays.filter(d => d.count > 0))
            .enter()
            .append('text')
            .attr('class', 'bar-label')
            .attr('x', (d: TimelineData) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
            .attr('y', (d: TimelineData) => yScale(d.count) - 5)
            .attr('text-anchor', 'middle')
            .style('fill', theme.labelText)
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .text((d: TimelineData) => d.count.toString());

        // 添加X轴 - 显示日期
        const xAxis = d3.axisBottom(xScale)
            .tickFormat((d: string) => {
                const date = new Date(d);
                return `${date.getDate()}日`;
            })
            .ticks(Math.min(allDays.length, 31));

        svg.append('g')
            .attr('transform', `translate(0, ${height - margin.bottom})`)
            .call(xAxis)
            .selectAll('text')
            .style('fill', theme.axisText)
            .style('font-size', '10px')
            .style('text-anchor', 'middle');

        // 添加X轴标题
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .attr('text-anchor', 'middle')
            .style('fill', theme.emptyText)
            .style('font-size', '12px')
            .text('日期');

        // 添加Y轴
        const yAxis = d3.axisLeft(yScale)
            .ticks(Math.min(maxCount, 10));

        svg.append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(yAxis)
            .selectAll('text')
            .style('fill', theme.axisText)
            .style('font-size', '10px');

        // 添加Y轴标题
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .style('fill', theme.emptyText)
            .style('font-size', '12px')
            .text('提交次数');

        // 添加网格线
        svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(yScale)
                .ticks(Math.min(maxCount, 10))
                .tickSize(-width + margin.left + margin.right)
                .tickFormat(() => '') as any)
            .selectAll('line')
            .attr('stroke', theme.gridLine)
            .attr('stroke-dasharray', '3,3')
            .attr('opacity', 0.3);

        // 添加图表标题
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', theme.titleText)
            .text(`${year}年${month}月 每日提交统计`);
    };

    const drawCalendar = (container: HTMLDivElement, timeline: Map<string, number> | TimelineData[], year: number, month: number) => {
        const containerEl = container as any;
        containerEl.innerHTML = '';

        const theme = getThemeColors();
        const light = isLightTheme();

        // 转换数据
        const timelineMap = new Map<string, number>();
        if (Array.isArray(timeline)) {
            timeline.forEach(d => timelineMap.set(d.date, d.count));
        } else {
            timeline.forEach((count, date) => timelineMap.set(date, count));
        }

        // 创建日历容器
        const calendarDiv = document.createElement('div');
        calendarDiv.style.display = 'grid';
        calendarDiv.style.gridTemplateColumns = 'repeat(7, 1fr)';
        calendarDiv.style.gap = '3px';
        calendarDiv.style.padding = '12px';
        calendarDiv.style.background = 'var(--vscode-sideBar-background)';
        calendarDiv.style.borderRadius = '8px';
        calendarDiv.style.maxWidth = '600px';
        calendarDiv.style.margin = '0 auto';

        // 星期标题
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        weekdays.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.style.textAlign = 'center';
            dayHeader.style.fontWeight = 'bold';
            dayHeader.style.padding = '5px';
            dayHeader.style.fontSize = '11px';
            dayHeader.style.color = theme.inactiveText;
            dayHeader.textContent = day;
            calendarDiv.appendChild(dayHeader);
        });

        // 获取月份的第一天和最后一天
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // 生成42天的网格（6周）
        const maxCount = Math.max(...Array.from(timelineMap.values()), 1);
        const getColor = (count: number) => {
            if (count === 0) return theme.emptyCell;
            // 使用固定的 #0e639c 颜色，根据提交数量调整透明度
            const intensity = Math.min(count / maxCount, 1);
            const opacity = light ? 0.2 + intensity * 0.6 : 0.3 + intensity * 0.7;
            return `rgba(14, 99, 156, ${opacity})`;
        };

        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            const count = timelineMap.get(dateKey) || 0;
            const isCurrentMonth = currentDate.getMonth() + 1 === month;

            const dayCell = document.createElement('div');
            dayCell.style.aspectRatio = '1';
            dayCell.style.display = 'flex';
            dayCell.style.flexDirection = 'column';
            dayCell.style.alignItems = 'center';
            dayCell.style.justifyContent = 'center';
            dayCell.style.background = getColor(count);
            dayCell.style.borderRadius = '3px';
            dayCell.style.cursor = 'pointer';
            dayCell.style.opacity = isCurrentMonth ? '1' : '0.4';
            dayCell.style.transition = 'transform 0.2s';
            dayCell.style.border = count > 0 ? '1px solid rgba(14, 99, 156, 0.8)' : 'none';
            dayCell.title = `${dateKey}\n${count} 次提交`;

            dayCell.onmouseenter = () => {
                dayCell.style.transform = 'scale(1.1)';
            };
            dayCell.onmouseleave = () => {
                dayCell.style.transform = 'scale(1)';
            };

            const dayNumber = document.createElement('div');
            dayNumber.style.fontSize = '10px';
            // 有提交的日期使用对比度高的颜色，无提交的日期使用主题文本颜色
            dayNumber.style.color = count > 0
                ? (light ? '#fff' : '#fff')
                : theme.inactiveText;
            dayNumber.style.fontWeight = count > 0 ? 'bold' : 'normal';
            dayNumber.textContent = currentDate.getDate().toString();

            if (count > 0) {
                const countBadge = document.createElement('div');
                countBadge.style.fontSize = '9px';
                countBadge.style.color = '#fff';
                countBadge.style.marginTop = '1px';
                countBadge.textContent = count.toString();
                dayCell.appendChild(dayNumber);
                dayCell.appendChild(countBadge);
            } else {
                dayCell.appendChild(dayNumber);
            }

            calendarDiv.appendChild(dayCell);
        }

        containerEl.appendChild(calendarDiv);
    };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="timeline-view">
            <div className="section-header">
                <h2>时间线视图</h2>
                <p className="section-description">
                    结合日历的提交时间线，展示提交活动的时间分布
                </p>
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <label style={{ color: 'var(--vscode-foreground)' }}>选择年份：</label>
                <select
                    value={String(selectedYear)}
                    onChange={(e) => {
                        const target = e.target as HTMLSelectElement;
                        setSelectedYear(Number((target as any).value));
                    }}
                    style={{
                        padding: '8px 12px',
                        background: 'var(--vscode-input-background)',
                        color: 'var(--vscode-input-foreground)',
                        border: '1px solid var(--vscode-input-border)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {years.map((year: number) => (
                        <option key={year} value={String(year)}>{year}</option>
                    ))}
                </select>

                <label style={{ color: 'var(--vscode-foreground)', marginLeft: '20px' }}>选择月份：</label>
                <select
                    value={String(selectedMonth)}
                    onChange={(e) => {
                        const target = e.target as HTMLSelectElement;
                        setSelectedMonth(Number((target as any).value));
                    }}
                    style={{
                        padding: '8px 12px',
                        background: 'var(--vscode-input-background)',
                        color: 'var(--vscode-input-foreground)',
                        border: '1px solid var(--vscode-input-border)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {months.map((month: number) => (
                        <option key={month} value={String(month)}>{month}月</option>
                    ))}
                </select>
            </div>

            <div className="graph-container" style={{ marginBottom: '20px' }}>
                <svg ref={svgRef} style={{ width: '100%', height: '300px', background: 'var(--vscode-sideBar-background)' }} />
            </div>

            <div className="calendar-container">
                <div ref={calendarRef} />
            </div>

            {!data && (
                <div className="empty-state">
                    <p>📊 正在加载时间线数据...</p>
                </div>
            )}

            {data && (!data.timeline || (Array.isArray(data.timeline) && data.timeline.length === 0)) && (
                <div className="empty-state" style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: 'var(--vscode-descriptionForeground)'
                }}>
                    <p>📅 暂无时间线数据</p>
                    <p style={{ fontSize: '12px', marginTop: '10px' }}>
                        请确保您已经进行过 Git 提交，数据将在下次刷新时显示
                    </p>
                </div>
            )}
        </div>
    );
};

