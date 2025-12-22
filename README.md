# Gitly — 强大的 VS Code Git 可视化助手

<div align="center">
  <img src="resources/icon.png" alt="Gitly 图标" width="200" />
  <p>
    <a href="https://github.com/YIXUAN-oss/Gitly/releases/tag/v1.1.0">
      <img src="https://img.shields.io/badge/version-1.1.0-blue.svg" alt="Version" />
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
    </a>
    <a href="https://code.visualstudio.com/">
      <img src="https://img.shields.io/badge/VS%20Code-1.107%2B-007ACC.svg" alt="VS Code" />
    </a>
  </p>
</div>


> Gitly 是一款为 VS Code 打造的 Git 历史可视化 + 操作控制面板扩展。通过图谱视图、侧边栏树形列表和 Webview 控制台，Gitly 将所有 Git 流程数字化并提供中文 / 英文双语支撑。

## 🔍 项目速览

- **状态**：2025-12-19 发布 v1.1.0；活跃维护中
- **核心场景**：提交图视图、分支管理、冲突预警、快速命令与控制面板
- **技术栈**：TypeScript、VS Code Extension API、原生 DOM + SVG/Canvas、Node.js child_process
- **性能指标**：
  - 扩展激活 < 500ms
  - 面板基础数据刷新 < 400ms
  - 大仓库统计（热力图/时间线）刷新 < 1.5s
- **语种支持**：`en` / `zh-CN`（VS Code 设置 + Webview 文案）

## ✨ 核心能力

### 1. Git 提交图（Gitly View）

Gitly 的核心功能是提供交互式的 Git 提交历史可视化视图，帮助开发者直观理解代码演进过程。

**可视化特性：**
- **提交图谱渲染**：使用原生 SVG/Canvas 技术绘制分支图，支持圆角/直角两种样式
- **完整数据展示**：同时展现分支、标签、HEAD、stash、未暂存更改等所有 Git 状态
- **智能布局算法**：自定义的分支布局算法，自动计算提交节点位置，避免分支交叉
- **颜色系统**：每个分支使用不同颜色标识，支持自定义 12 色配色方案

**交互功能：**
- **丰富上下文菜单**：右键点击提交/分支/标签，可执行 checkout、merge、rebase、cherry-pick、push、pull、reset、delete、rename 等操作
- **双提交对比**：`Ctrl/Cmd + 点击` 选择两个提交进行比较，自动打开 VS Code Diff 视图
- **悬停提示**：鼠标悬停显示分支归属、提交详情、作者信息
- **Emoji 支持**：自动识别并渲染 gitmoji 表情符号，让提交信息更生动
- **文件评审**：标记已评审文件，支持代码审查工作流
- **快速导航**：快捷键快速定位到 HEAD、stash 位置

**提交详情视图：**
- **内联/底部停靠**：支持提交详情视图内联显示或底部停靠两种布局
- **文件树/列表视图**：可选择文件树或列表两种方式展示提交文件
- **Diff 预览**：点击文件直接查看变更内容，支持打开完整 Diff 编辑器
- **提交信息解析**：支持 Markdown 格式的提交信息渲染

### 2. 侧边栏视图（Activity Bar）

Gitly 在 VS Code 侧边栏提供四个专用视图，快速访问常用 Git 信息。

**分支视图（Branches）：**
- 树形结构展示所有本地和远程分支
- 高亮显示当前检出分支
- 右键菜单支持快速切换、删除、合并、重命名分支
- 支持远程分支检出为本地分支

**历史视图（History）：**
- 按时间顺序展示提交历史
- 显示提交哈希、作者、日期、提交信息
- 点击提交可查看详情或打开提交图
- 支持按作者、日期范围过滤

**暂存区视图（Staged）：**
- 实时显示已暂存的文件列表
- 集成 VS Code Git API，自动监听暂存区变化
- 支持取消暂存、查看文件变更
- 显示文件状态（新增、修改、删除）

**冲突视图（Conflicts）：**
- 自动检测合并冲突
- 列出所有冲突文件
- 快速跳转到冲突文件进行解决
- 显示冲突状态和解决进度

### 3. Git 助手面板（Assistant Webview）

Gitly 提供了一个功能丰富的可视化控制面板，通过 Webview 技术实现，包含 9 个功能标签页。

**📋 快捷指令（Quick Commands）：**
- **命令分组**：按仓库状态智能分组显示可用命令
  - 初始化阶段：初始化仓库、克隆仓库、添加远程
  - 远程配置：添加/编辑/删除远程、设置默认推送远程
  - 分支/标签管理：创建、切换、合并、删除分支和标签
  - 同步操作：推送、拉取、获取更新
  - 冲突解决：检测并解决合并冲突
- **命令历史**：记录所有执行过的命令，包括：
  - 命令名称和执行时间
  - 执行状态（成功/失败）
  - 执行耗时
  - 支持复制命令或重新执行
- **状态感知**：根据当前仓库状态动态显示/隐藏不可用命令
- **快捷操作**：一键执行常用 Git 操作，无需记忆命令

**📚 Git 指令集（Git Command Reference）：**
- 完整的 Git 命令参考手册
- 分类展示常用 Git 命令
- 每个命令包含说明、参数、示例
- 支持搜索和过滤

**☁️ 远程管理（Remote Manager）：**
- **远程列表**：表格形式展示所有远程仓库
- **远程操作**：
  - 添加新远程（支持 HTTPS/SSH）
  - 编辑远程 URL
  - 删除远程
  - 设置默认推送远程
- **快速访问**：点击远程 URL 在浏览器中打开
- **状态显示**：显示远程分支同步状态

**🌿 分支管理（Branch Manager）：**
- **分支树视图**：可视化展示分支关系树
- **分支操作**：
  - 创建新分支（支持从当前分支或指定提交创建）
  - 切换分支（支持远程分支检出）
  - 合并分支（支持多种合并策略）
  - 删除分支（本地/远程）
  - 重命名分支
- **分支信息**：显示分支最新提交、上游跟踪信息
- **分支状态**：标识当前分支、已合并分支、未推送分支

**🏷️ 标签管理（Tag Manager）：**
- **标签列表**：表格展示所有标签
- **标签操作**：
  - 创建标签（支持轻量标签和附注标签）
  - 删除标签（本地/远程）
  - 推送标签到远程
  - 批量推送所有标签
- **标签详情**：显示标签指向的提交、创建者、创建时间

**⚠️ 冲突解决器（Conflict Resolver）：**
- **三栏对比视图**：
  - 左侧：当前分支版本（ours）
  - 中间：合并结果预览
  - 右侧：合并分支版本（theirs）
- **解决策略**：
  - 接受当前版本
  - 接受合并版本
  - 接受两者（手动编辑）
  - 撤销解决
- **冲突历史**：记录已解决的冲突，支持查看和重新解决
- **批量操作**：支持批量接受策略

**📊 提交图（Commit Graph）：**
- 在控制面板中嵌入的简化版提交图
- Canvas 渲染，性能优化
- 支持点击提交查看详情
- 显示分支关系和合并点

**📅 时间线视图（Timeline View）：**
- **提交时间线**：按时间轴展示提交历史
- **贡献者活跃度**：统计每个贡献者的提交频率
- **提交峰值**：识别代码提交的高峰时段
- **可视化图表**：使用 Canvas 绘制时间线图表

**🔥 热力图分析（Heatmap Analysis）：**
- **文件修改热力图**：展示文件修改频率和热度
- **提交热力图**：按日期展示提交密度
- **贡献者热力图**：展示各贡献者的活跃度分布
- **颜色编码**：使用颜色深浅表示活跃程度

### 4. 智能体验

**命令历史追踪：**
- 所有 Git 操作都会记录到命令历史
- 记录命令名称、参数、执行时间、状态、耗时
- 支持查看历史、复制命令、重新执行
- 历史数据持久化存储

**安全检查机制：**
- 执行 push/pull 前检测未保存的文件
- 切换分支前提示未提交的更改
- 提供自动 stash 选项
- 危险操作（如 force push、hard reset）需要确认

**性能优化：**
- **并行数据刷新**：使用 `Promise.allSettled` 同时更新多个数据源
- **智能防抖**：Webview 通信和文件监听使用 300ms 防抖
- **增量加载**：Git 图初始只加载 300 个提交，滚动时自动加载更多
- **按需加载**：提交详情按需加载，减少初始加载时间
- **缓存机制**：缓存 Git 命令结果，避免重复执行

**文件监听优化：**
- 只监听关键文件：`.git/HEAD` 和 `refs/heads/**`
- 300ms 防抖，避免频繁刷新
- 智能判断变更，只刷新必要的数据

**容错机制：**
- 单个命令失败不影响其他功能
- 自动回退到默认数据
- 详细的错误信息提示
- 支持重试失败的操作

## 🚀 安装与快速上手

### 🎯 从 VS Code 市场安装

1. 打开 VS Code，按 `Ctrl+Shift+X`（Windows/Linux）或 `Cmd+Shift+X`（macOS）打开扩展视图
2. 在搜索框中输入 "Gitly"
3. 点击安装按钮
4. 安装完成后重启 VS Code（推荐）

> 💡 **提示**：如果已下载 `.vsix` 文件，可以在扩展视图右上角点击 "..." 菜单，选择 "从 VSIX 安装..." 进行安装。

### 💻 从源码编译

```bash
# 克隆仓库
git clone https://github.com/YIXUAN-oss/Gitly.git
cd Gitly

# 安装依赖
npm install

# 编译项目（编译后端 TypeScript 和 Webview）
npm run compile

# 打包为 VSIX 文件
npm run package
```

> 📦 编译完成后，会在项目根目录生成 `gitly-1.1.0.vsix` 文件，可通过 VS Code 命令 "扩展：从 VSIX 安装..." 进行安装。

### ⚙️ 快速体验

1. **打开 Git 仓库**
   - 在 VS Code 中打开一个包含 Git 仓库的文件夹
   - 如果没有仓库，可以执行命令 `Gitly: 初始化仓库` 创建一个新仓库

2. **查看侧边栏视图**
   - 在 Activity Bar（左侧活动栏）点击 Gitly 图标
   - 查看分支、历史、暂存区、冲突四个视图

3. **打开提交图**
   - 通过命令面板（`Ctrl+Shift+P`）运行 `Gitly: View Gitly (git log)`
   - 或点击侧边栏视图中的 "打开 Git Graph" 按钮

4. **使用控制面板**
   - 执行命令 `Gitly: 打开可视化面板` 或点击侧边栏的助手图标
   - 体验快捷命令、远程管理、分支管理等功能

5. **常用快捷键**
   - `Ctrl+Alt+P`（Windows/Linux）或 `Cmd+Alt+P`（macOS）：快速推送
   - `Ctrl+Alt+L`（Windows/Linux）或 `Cmd+Alt+L`（macOS）：快速拉取
   - `Ctrl+Alt+B`（Windows/Linux）或 `Cmd+Alt+B`（macOS）：快速切换分支

## 📚 命令速查

Gitly 提供了丰富的命令，涵盖 Git 操作的各个方面：

| 命令 | 快捷键 | 说明 |
| --- | --- | --- |
| **Gitly: View Gitly (git log)** | - | 打开 Git 提交图视图 |
| **Gitly: 打开可视化面板** | - | 打开 Assistant Webview 控制面板 |
| **Gitly: 快速推送** | `Ctrl+Alt+P` | 快速推送当前分支到远程 |
| **Gitly: 快速拉取** | `Ctrl+Alt+L` | 快速拉取远程更新 |
| **Gitly: 切换分支** | `Ctrl+Alt+B` | 快速切换分支 |
| **Gitly: 初始化仓库** | - | 初始化新的 Git 仓库 |
| **Gitly: 克隆仓库** | - | 克隆远程仓库到本地 |
| **Gitly: 添加远程仓库** | - | 添加新的远程仓库 |
| **Gitly: 编辑远程仓库** | - | 编辑现有远程仓库 URL |
| **Gitly: 删除远程仓库** | - | 删除远程仓库 |
| **Gitly: 暂存更改** | - | 将文件添加到暂存区 |
| **Gitly: 取消暂存** | - | 从暂存区移除文件 |
| **Gitly: 提交暂存更改** | - | 提交已暂存的文件 |
| **Gitly: 提交所有更改** | - | 提交所有更改（包括未暂存） |
| **Gitly: 撤销上一次提交** | - | 撤销最后一次提交 |
| **Gitly: 创建分支** | - | 创建新分支 |
| **Gitly: 合并分支** | - | 合并指定分支到当前分支 |
| **Gitly: 重命名分支** | - | 重命名分支 |
| **Gitly: 删除分支** | - | 删除分支 |
| **Gitly: 创建标签** | - | 创建新标签 |
| **Gitly: 删除标签** | - | 删除标签 |
| **Gitly: 推送标签** | - | 推送标签到远程 |
| **Gitly: 解决合并冲突** | - | 打开冲突解决器 |

## 🧰 技术栈与架构

### 核心技术栈

**后端（Extension Host）：**
- **TypeScript 5.9+**：严格的类型系统，确保代码质量和可维护性
- **VS Code Extension API 1.107+**：使用 VS Code 扩展 API 实现命令、视图、Webview 等功能
- **Node.js child_process**：直接通过 `spawn` 执行 Git CLI 命令，不依赖第三方 Git 库
- **iconv-lite**：处理 Git 输出的字符编码转换，支持多种编码格式

**前端（Webview）：**
- **原生 DOM API**：不使用任何前端框架，直接使用原生 DOM 操作，性能最优
- **TypeScript**：Webview 代码也使用 TypeScript 编写，保证类型安全
- **SVG/Canvas**：Git 图使用 SVG 绘制分支线条，Canvas 绘制提交节点，实现高性能渲染
- **CSS3**：使用现代 CSS 特性实现样式和动画

**构建工具：**
- **TypeScript Compiler**：直接使用 `tsc` 编译 TypeScript 代码
- **vsce**：VS Code 扩展打包工具，生成 `.vsix` 文件
- **Jest + ts-jest**：单元测试框架，覆盖核心业务逻辑

**开发工具：**
- **ESLint**：代码质量检查，使用 TypeScript ESLint 规则
- **Git**：版本控制（当然！）

### 架构设计

```
Gitly Extension Architecture
├── Extension Host (Node.js 后端)
│   ├── src/
│   │   ├── extension.ts              # 扩展入口，注册命令和视图
│   │   ├── dataSource.ts             # Git 命令执行层，封装所有 Git 操作
│   │   ├── repoManager.ts             # 仓库管理，监听文件变化
│   │   ├── gitGraphView.ts           # Git 图视图面板管理
│   │   ├── assistantPanel.ts         # Assistant Webview 面板管理
│   │   ├── commands.ts               # Git 图视图命令处理
│   │   ├── assistantCommands.ts      # Assistant 面板命令处理
│   │   ├── sidebarViews.ts           # 侧边栏 TreeDataProvider
│   │   ├── avatarManager.ts          # 头像管理（GitHub/GitLab/Gravatar）
│   │   ├── diffDocProvider.ts         # Diff 文档提供者
│   │   ├── statusBarItem.ts          # 状态栏项
│   │   ├── config.ts                 # 配置管理
│   │   ├── logger.ts                 # 日志系统
│   │   ├── extensionState.ts         # 扩展状态持久化
│   │   ├── assistantCommandHistory.ts # 命令历史管理
│   │   ├── conflictHistory.ts        # 冲突解决历史
│   │   ├── repoFileWatcher.ts        # 文件监听器
│   │   └── utils/                    # 工具函数
│   │       ├── event.ts              # 事件系统
│   │       ├── disposable.ts         # 资源清理
│   │       └── bufferedQueue.ts      # 缓冲队列
│   │
│   └── out/                          # 编译后的 JavaScript
│
├── Webview (浏览器环境)
│   ├── web/
│   │   ├── main.ts                   # Git 图视图主逻辑
│   │   ├── graph.ts                 # Git 图渲染引擎（SVG/Canvas）
│   │   ├── contextMenu.ts           # 上下文菜单
│   │   ├── dialog.ts                # 对话框组件
│   │   ├── dropdown.ts             # 下拉菜单组件
│   │   ├── findWidget.ts            # 搜索组件
│   │   ├── settingsWidget.ts        # 设置组件
│   │   ├── textFormatter.ts         # 文本格式化（Markdown、Emoji）
│   │   ├── utils.ts                # Webview 工具函数
│   │   │
│   │   └── assistant/               # Assistant 面板
│   │       ├── app.ts               # Assistant 应用主类
│   │       ├── i18n.ts              # 国际化
│   │       ├── types/               # 类型定义
│   │       ├── components/          # 功能组件
│   │       │   ├── command-history.ts      # 命令历史组件
│   │       │   ├── git-command-reference.ts # Git 命令参考组件
│   │       │   ├── remote-manager.ts        # 远程管理组件
│   │       │   ├── branch-tree.ts           # 分支树组件
│   │       │   ├── tag-manager.ts           # 标签管理组件
│   │       │   ├── conflict-editor.ts      # 冲突编辑器组件
│   │       │   ├── commit-graph.ts          # 提交图组件
│   │       │   ├── timeline-view.ts         # 时间线视图组件
│   │       │   └── heatmap-analysis.ts      # 热力图分析组件
│   │       ├── utils/               # Assistant 工具函数
│   │       └── styles/              # 样式文件
│   │
│   └── media/                       # 编译后的 Webview 资源
│
└── Tests
    └── tests/                       # Jest 测试文件
```

### 数据流与通信机制

**1. 命令执行流程：**
```
用户操作（命令/点击）
  ↓
VS Code Command API
  ↓
Extension Host (commands.ts / assistantCommands.ts)
  ↓
DataSource (dataSource.ts)
  ↓
child_process.spawn('git', [...args])
  ↓
解析 Git 输出
  ↓
返回结构化数据
  ↓
更新 UI（Webview / Sidebar）
```

**2. Webview 通信机制：**
```
Extension Host                    Webview
     │                               │
     │── postMessage(gitData) ──────>│
     │                               │ 渲染 UI
     │                               │
     │<── postMessage(command) ──────│
     │                               │
     │ 执行 Git 命令                  │
     │                               │
     │── postMessage(result) ───────>│
     │                               │ 更新 UI
```

**3. 文件监听机制：**
```
文件系统变化
  ↓
repoFileWatcher.ts (监听 .git/HEAD, refs/heads/**)
  ↓
300ms 防抖
  ↓
触发刷新事件
  ↓
repoManager.refresh()
  ↓
更新所有视图（Sidebar + Webview）
```

### Git 命令执行层（DataSource）

`DataSource` 类是 Gitly 的核心，负责所有 Git 命令的执行和结果解析：

**核心方法：**
- `spawnGit()`: 底层 Git 命令执行，使用 `child_process.spawn`
- `getCommits()`: 获取提交列表，解析 `git log` 输出
- `getCommitDetails()`: 获取提交详情，包括文件变更
- `getBranches()`: 获取分支列表（本地+远程）
- `getRemotes()`: 获取远程仓库列表
- `getTags()`: 获取标签列表
- `getStashes()`: 获取 stash 列表
- `checkoutBranch()`: 切换分支
- `mergeBranch()`: 合并分支
- `pushBranch()`: 推送分支
- `pullBranch()`: 拉取更新
- ... 等 100+ 个 Git 操作方法

**特性：**
- **错误处理**：统一的错误信息格式，便于 UI 展示
- **编码处理**：使用 `iconv-lite` 处理不同编码的 Git 输出
- **Askpass 支持**：集成 Git 凭证助手，支持 HTTPS 认证
- **命令缓存**：缓存部分命令结果，提升性能
- **日志记录**：所有 Git 命令都记录到日志，便于调试

### Git 图渲染引擎（Graph）

`Graph` 类负责 Git 提交图的可视化渲染：

**渲染流程：**
1. **数据准备**：接收提交列表，构建提交关系图
2. **布局计算**：使用自定义算法计算每个提交的 X/Y 坐标
3. **分支分配**：为每个分支分配颜色和位置
4. **路径计算**：计算分支之间的连接路径（支持圆角/直角）
5. **SVG 绘制**：使用 SVG `<path>` 绘制分支线条
6. **Canvas 绘制**：使用 Canvas 绘制提交节点（圆形）
7. **交互处理**：处理点击、悬停、选择等交互事件

**布局算法：**
- 基于拓扑排序的布局算法
- 自动避免分支交叉
- 支持展开提交详情时的动态调整
- 优化大仓库的性能（虚拟滚动）

### Assistant 面板架构

Assistant 面板采用组件化架构，每个功能模块都是独立的组件：

**组件通信：**
- 所有组件通过 `App` 类统一管理
- 组件之间通过事件或数据共享通信
- 使用 TypeScript 接口定义数据契约

**状态管理：**
- 使用 VS Code Webview State API 持久化状态
- 标签页切换状态、滚动位置等都会保存
- 支持恢复上次使用的标签页

**国际化：**
- 使用 `i18n.ts` 统一管理多语言
- 支持动态切换语言
- 根据 VS Code 语言设置自动选择

### 性能优化策略

**1. 数据加载优化：**
- **初始加载**：Git 图初始只加载 300 个提交（可配置）
- **增量加载**：滚动到底部自动加载更多提交
- **按需加载**：提交详情按需加载，不阻塞初始渲染
- **缓存机制**：缓存 Git 命令结果，避免重复执行

**2. 渲染优化：**
- **虚拟滚动**：只渲染可见区域的提交
- **Canvas 优化**：使用离屏 Canvas 预渲染
- **SVG 优化**：合并路径，减少 DOM 节点
- **防抖节流**：所有用户交互都使用防抖/节流

**3. 通信优化：**
- **批量更新**：合并多个数据更新为一次消息
- **增量更新**：只发送变化的数据
- **消息队列**：使用缓冲队列处理高频消息

**4. 文件监听优化：**
- **精确监听**：只监听关键文件（`.git/HEAD`, `refs/heads/**`）
- **防抖处理**：300ms 防抖，避免频繁刷新
- **智能判断**：只刷新变化的部分

### 可扩展性设计

**1. 配置驱动：**
- 所有行为都可通过 VS Code 配置项控制
- 支持工作区级别和用户级别配置
- 配置变更自动生效，无需重启

**2. 消息驱动架构：**
- Extension Host 和 Webview 通过 `postMessage` 通信
- 消息格式标准化，易于扩展
- 支持添加新的消息类型和命令

**3. 组件化设计：**
- Assistant 面板组件独立，易于添加新功能
- 每个组件都有清晰的接口定义
- 支持组件复用和组合

**4. 插件化支持：**
- 命令系统支持注册自定义命令
- 视图系统支持添加新的侧边栏视图
- Webview 支持添加新的标签页

## ⚙️ 推荐配置

Gitly 提供了丰富的配置选项，以下是一些推荐配置：

```json
{
  // Git 图视图配置
  "gitly.repository.commits.initialLoad": 300,
  "gitly.repository.commits.loadMore": 100,
  "gitly.repository.commits.loadMoreAutomatically": true,
  "gitly.repository.showRemoteBranches": true,
  "gitly.repository.showTags": true,
  "gitly.repository.showStashes": true,
  "gitly.repository.showUncommittedChanges": true,
  
  // 提交详情视图配置
  "gitly.commitDetailsView.location": "Inline",
  "gitly.commitDetailsView.fileView.type": "File Tree",
  "gitly.commitDetailsView.autoCenter": true,
  
  // 图形样式配置
  "gitly.graph.style": "rounded",
  "gitly.graph.colours": [
    "#0085d9", "#d9008f", "#00d90a", "#d98500",
    "#a300d9", "#ff0000", "#00d9cc", "#e138e8",
    "#85d900", "#dc5b23", "#6f24d6", "#ffcc00"
  ],
  
  // 日期格式配置
  "gitly.date.format": "Date & Time",
  "gitly.date.type": "Author Date",
  
  // 头像配置
  "gitly.repository.commits.fetchAvatars": false,
  
  // 其他配置
  "gitly.retainContextWhenHidden": true,
  "gitly.showStatusBarItem": true
}
```

## 🏗️ 开发与构建

### 开发环境搭建

```bash
# 1. 克隆仓库
git clone https://github.com/YIXUAN-oss/Gitly.git
cd Gitly

# 2. 安装依赖
npm install

# 3. 编译项目
npm run compile

# 4. 启动开发模式（监听文件变化）
npm run watch:src    # 监听后端代码
npm run watch:web    # 监听 Webview 代码
npm run watch:assistant  # 监听 Assistant 代码
```

### 构建命令

```bash
# 编译所有代码（后端 + Webview）
npm run compile

# 只编译后端代码
npm run compile-src

# 只编译 Webview 代码
npm run compile-web

# 打包为 VSIX 文件
npm run package

# 打包并自动安装
npm run package-and-install
```

### 测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test-and-report-coverage

# 编译测试代码
npm run compile-tests

# 监听模式运行测试
npm run watch-tests
```

### 代码质量

```bash
# 运行 ESLint 检查
npm run lint

# 生成 ESLint JSON 报告
npm run lint:json
```

### 调试

1. **调试 Extension Host：**
   - 在 VS Code 中打开项目
   - 按 `F5` 启动调试
   - 会打开一个新的 VS Code 窗口（Extension Development Host）
   - 在新窗口中测试扩展功能

2. **调试 Webview：**
   - 在 Extension Development Host 中打开 Webview
   - 右键点击 Webview，选择 "检查"
   - 使用浏览器开发者工具调试

## 🧩 文档与资源

- **`README_EN.md`**：英文版本文档
- **`CONTRIBUTING.md`**：贡献指南，包含开发流程、代码规范等
- **`CODE_OF_CONDUCT.md`**：行为准则
- **`CHANGELOG.md`**：详细的更新日志，记录每个版本的变更
- **`LICENSE`**：MIT 许可证

## 📌 路线图（规划）

### v1.2.0（计划中）
- AI 辅助冲突解决建议
- 协作模板和代码审查工作流
- 自定义快捷命令配置
- 增强的提交信息模板

### v1.3.0（规划中）
- 交互式 Rebase 助手
- 提交规范检查（Conventional Commits）
- 智能冲突预防提示
- 性能分析和优化建议

### v1.4.0（规划中）
- PR/MR 预览和创建
- 智能回滚建议
- Git 子模块管理
- 多仓库工作流支持

### v1.5.0+（未来）
- 多仓库统一管理界面
- 代码影响分析工具
- 性能报表导出
- 团队协作统计

## 📝 许可证与致谢

- **许可证**：MIT License（详见 `LICENSE` 文件）

- **致谢**：
  - **Git Graph**：Gitly 基于 [Git Graph](https://github.com/mhutchie/vscode-git-graph) 项目进行开发，感谢原项目作者和所有贡献者
  - **图标资源**：
    - [Octicons](https://primer.style/octicons/) - GitHub 官方图标库
    - [Icons8](https://icons8.com/) - 图标资源
  - **开源社区**：感谢所有提交 Issue、PR 和反馈的用户

## 📮 联系我们

- **Issues & Feature Requests**：<https://github.com/YIXUAN-oss/Gitly/issues>
- **Discussions**：<https://github.com/YIXUAN-oss/Gitly/discussions>
- **邮箱**：byyi.xuan@outlook.com

---

<div align="center">
  <p>如果 Gitly 对你有帮助，欢迎给个 ⭐ Star！</p>
  <p>Made with ❤️ by Gitly Team</p>
</div>
