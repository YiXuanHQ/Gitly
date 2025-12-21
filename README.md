# Gitly — 强大的 VS Code Git 可视化助手

<div align="center">
  <img src="resources/icon.png" alt="Gitly 图标" width="200" />
  <p>
    <a href="https://github.com/YIXUAN-oss/CodeGitAssistant/releases/tag/v1.0.1">
      <img src="https://img.shields.io/badge/version-1.0.1-blue.svg" alt="Version" />
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
    </a>
    <a href="https://code.visualstudio.com/">
      <img src="https://img.shields.io/badge/VS%20Code-1.80%2B-007ACC.svg" alt="VS Code" />
    </a>
  </p>
</div>

> Gitly 是一款为 VS Code 打造的 Git 历史可视化 + 操作控制面板扩展。通过图谱视图、侧边栏树形列表和 Webview 控制台，Gitly 将所有 Git 流程数字化并提供中文 / 英文双语支撑。

## 🔍 项目速览

- **状态**：2025-12-03 发布 v1.0.1；活跃维护中
- **核心场景**：提交图视图、分支管理、冲突预警、快速命令与控制面板
- **技术栈**：TypeScript、VS Code Extension API、原生 DOM + React Webview、D3.js、simple-git
- **性能指标**：
  - 激活 < 500ms
  - 面板基础数据刷新 < 400ms
  - 大仓库统计（热力图/时间线）刷新的时间 < 1.5s
- **语种支持**：`en` / `zh-CN`（VS Code 设置 + Webview 文案）

## ✨ 核心能力

1. **Git 提交图（Gitly View）**
   - 可视化提交图谱：分支、标签、HEAD、stash、未暂存等数据并行展现
   - 丰富上下文菜单：对提交 / 分支 / 标签执行 checkout、merge、rebase、cherry-pick、push、pull、reset、delete、rename
   - 交互细节：`Ctrl/Cmd + 点击` 比较任意两个提交、悬停显示分支归属、支持 emoji（gitmoji）渲染
   - 评审/文件链接：标记已评审文件、打开 VS Code Diff、复制提交哈希或代码链接

2. **侧边栏视图（Activity Bar）**
   - 分支树、历史、冲突三大视图同步仓库状态
   - 右键菜单直达切换、删除、合并、冲突跳转
   - 每个视图支持语言切换、过滤面板（按站点 / 作者 / 仓库）

3. **Git 助手面板（Assistant Webview）**
   - 10 个功能标签页：快捷指令、Git 指令集、分支管理、远程管理、标签、分支视图、冲突、提交图、时间线、热力图（按钮固定 120px，便于肌肉记忆）
   - 快捷命令分组：初始化 → 远程配置 → 分支/标签/同步 → 冲突与工具
   - Remote Manager：查看/编辑远程 URL、打开远程链接、配置默认 push 远程
   - 标签 / 分支表格：操作直达，包括新增、删除、推送、重命名
   - 冲突解决器：三栏对比、接受策略、撤销支持
   - 时间线 + 热力图：文件修改频率、贡献者活跃度、Commit Peak 一目了然

4. **智能体验**
   - 命令历史：记录命令/状态/耗时，支持复制或重试
   - 安全检查：执行 push/pull 前检测未保存内容、stash 提示
   - 并行刷新：`Promise.allSettled` 同时更新状态、分支、日志、远程
   - 容错回退：单个命令失败不阻塞 UI，自动回退默认数据
   - 文件监听：只观察 `.git/HEAD` 与 `refs/heads/**`，300ms 防抖，减少无谓刷新

## 🚀 安装与快速上手

### 🎯 从 VS Code 市场
1. 打开 VS Code，按 `Ctrl+Shift+X` 打开扩展视图
2. 搜索 “Gitly”
3. 点击安装并重启 VS Code（推荐）

> 已下载 `.vsix`？在扩展视图右上角执行 “从 VSIX 安装...” 即可。

### 💻 从源码编译
```bash
git clone https://github.com/YIXUAN-oss/Gitly.git
cd Gitly
npm install
npm run compile
npm run package
```

> 生成 `.vsix` 后通过 VS Code 命令 “扩展：从 VSIX 安装...” 安装。

### ⚙️ 快速体验
1. 打开一个 Git 仓库（或先执行 `Gitly: 初始化仓库` 命令）
2. 在 Activity Bar 选择 Gitly 图标 → 查看分支/历史/冲突
3. 通过命令面板运行 `Gitly: View Gitly (git log)` 打开提交图
4. 执行 `Gitly: 打开可视化面板` 体验快捷命令、Control Panel、热力图
5. 快捷键：
   - `Ctrl+Alt+P`：快速推送
   - `Ctrl+Alt+L`：快速拉取
   - `Ctrl+Alt+B`：快速切换分支

## 📚 命令速查

| 命令 | 快捷键 | 说明 |
| --- | --- | --- |
| Gitly: 快速推送 | `Ctrl+Alt+P` | 推送当前分支 |
| Gitly: 快速拉取 | `Ctrl+Alt+L` | 拉取上游更新 |
| Gitly: 克隆仓库 | - | 可视化输入地址 + 目录，显示进度 |
| Gitly: 初始化仓库 | - | `git init` → 添加远程 → 首次提交 → 推送 |
| Gitly: 远程管理 | - | 添加/重命名/删除远程，管理 URL |
| Gitly: 添加文件至暂存 | - | 一键或多选暂存 |
| Gitly: 提交更改 | - | 校验提交模板、提供取消 |
| Gitly: 创建分支 | - | 支持命名校验、可选stash |
| Gitly: 切换分支 | `Ctrl+Alt+B` | 快速 checkout |
| Gitly: 合并分支 | - | 支持策略选择与自动 stash |
| Gitly: 查看提交历史 | - | 打开提交图/Diff |
| Gitly: 解决冲突 | - | 启动三栏冲突编辑器 |
| Gitly: 打开控制面板 | - | 启动 Assistant Webview |

## 🧰 技术栈与架构

### 核心技术栈

- **TypeScript + VS Code Extension API**：严谨的类型系统 + 异步命令/视图注册，保证后端与 Webview 在同一语言下紧密协作。
- **simple-git（GitService）**：统一封装 `git` CLI，提供 retry、超时、错误归一化，并通过 `buildBranchGraphFromCommitMap` 等工具构建 DAG 数据。
- **原生 DOM + React (Assistant Webview)**：提交图与扩展面板分别由原生 SVG/Canvas 与 React 组件驱动，实现高性能渲染与用户交互。
- **D3.js / D3-force**：驱动 Git 提交图的力导向布局、线条路径与全局过渡动画，让分支关系更具可读性。
- **Jest + ts-jest**：覆盖核心逻辑（Git 服务、提交图状态转换、通知系统），保持扩展稳定。
- **Webpack 5 + ts-loader + vsce**：前端模块化、产物压缩与 VSIX 打包，兼顾开发/调试/发布场景。

### 高级架构概览

```
Gitly
├── src/                       # Extension 后端
│   ├── extension.ts           # 入口与命令/视图注册
│   ├── gitGraphView.ts        # 提交图面板生命周期、刷新与行交互
│   ├── assistantPanel.ts      # Webview 宿主 + VS Code 消息通信
│   ├── services/              # GitService、RepoManager、通知、历史日志等
│   ├── lifecycle/             # 激活、卸载、文件监听
│   └── sidebarViews.ts        # 分支/历史/冲突 Activity Bar TreeData
├── web/                       # Webview 及 Git 图逻辑
│   ├── graph.ts               # SVG/Canvas 提交图 + 事件处理
│   ├── contextMenu.ts         # 图上右键菜单 + 快捷命令
│   ├── dialog.ts / dropdown.ts# 通用 UI 组件
│   └── assistant/             # 快捷指令、远程、分支、冲突等卡片
│       ├── components/        # React 功能组合
│       └── styles/             # CSS 与主题变量
├── tests/                     # Jest 单元/集成测试
├── resources/                 # 图标、截图与 Webview 资产
└── scripts/                   # 构建辅助脚本（复制资源等）
```

### 数据与消息流

1. VS Code 命令 / 侧边栏事件触发 `GitlyCommand`。
2. `GitService` 通过 `simple-git` 执行 CLI，返回：分支、提交、stash、tags。
3. `repoManager`/`fileWatcher` 监听 `.git/HEAD` 与 `refs`，并通过 `assistantPanel.postMessage` 将数据推送到 Webview。
4. Webview 接收 `gitDataUpdate`、`commitDetails` 等事件，渲染提交图、热力图、时间线，并在用户交互时反向调用命令（如 checkout、diff）。
5. 所有操作结果写入 `CommandHistory`、通知中心与状态栏提示，确保用户可追踪。

### 性能保障

- **并行刷新**：多个 `Promise.allSettled` 分支/日志/远程数据同时更新，减少 UI 空白时间。
- **智能节流**：Webview 与后端通信 + 文件监听均有 300ms 防抖，避免高频触发。
- **渐进数据加载**：Git 图初次渲染只抓取 800 个提交，懒加载剩余数据（commit detail hydration）。

### 可扩展点

- **配置驱动**：通过 `gitly.*` 系列设置控制语言、图样式、自动 fetch、提交详情视图布局。
- **消息驱动**：`assistantPanel` 与 Webview 使用 `postMessage` + `WebviewPanel` 事件，可插入新的面板（如 Rebase 助手、AI 冲突建议）。
- **模块化数据**：Git 服务返回的 `BranchGraph`、`CommitInfo` 与 `GraphNode` 等结构可复用在未来热力图/PR 视图中。

## ⚙️ 推荐配置

```json
{
  "gitly.autoFetch": true,
  "gitly.confirmPush": true,
  "gitly.maxHistoryCount": 100,
  "gitly.conflictHighlight": true,
  "gitly.defaultRemote": "origin"
}
```

## 🏗️ 开发与构建

1. `npm install`
2. `npm run watch`（开发模式）
3. `npm run compile`（编译后端 + Webview）
4. `npm run test`
5. `npm run lint`
6. `npm run package`

测试辅助命令：
```bash
npm run compile-tests
npm run watch-tests
```

## 🧩 文档与资源

- `README_EN.md`：英文版本
- `CONTRIBUTING.md`：贡献指南
- `CHANGELOG.md`：更新日志（v1.0.1 记录至 2025-12-03）
- `PROJECT_OVERVIEW.md` / `PROJECT_DETAILS.md`：架构与技术深度讲解
- `docs/QUICKSTART.md`：5 分钟快速体验
- `docs/DEVELOPMENT.md` / `docs/TESTING.md`：开发与测试指引
- `QUICK_REFERENCE.md`：快捷键与速查卡

## 📌 路线图（规划）

- v1.1.0：AI 辅助冲突解决、协作模板、自定义指令
- v1.2.0：交互式 Rebase 助手、提交规范检查、智能冲突预防
- v1.3.0：PR/MR 预览、智能回滚、子模块管理
- v1.4.0+：多仓库管理、影响分析、性能报表导出

## 📝 许可证与致谢

- **许可证**：MIT（详见 `LICENSE`）
- **致谢**：
  - 原项目与贡献者：[Git Graph](https://github.com/mhutchie/vscode-git-graph)
  - 图标资源：Octicons、Icons8

## 📮 联系我们

- Issues & Feature Requests：<https://github.com/YIXUAN-oss/CodeGitAssistant/issues>
- Discussions：<https://github.com/YIXUAN-oss/CodeGitAssistant/discussions>
- 邮箱：byyi.xuan@outlook.com
