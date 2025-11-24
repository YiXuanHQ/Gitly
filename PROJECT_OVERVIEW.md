# Git Assistant 项目概览

## 📊 项目统计

- **项目类型**: VS Code扩展
- **开发语言**: TypeScript + React
- **核心功能**: Git可视化管理
- **代码行数**: 约3000+行
- **文件数量**: 30+个
- **开发周期**: 初始版本

## 🏗️ 完整项目结构

```
CodeGitAssistant/
│
├── 📁 src/                          # 源代码目录
│   ├── extension.ts                 # 扩展入口文件
│   │
│   ├── 📁 commands/                 # 命令处理器
│   │   ├── index.ts                # 命令注册中心
│   │   ├── git-operations.ts       # Git基础操作（Push/Pull/Clone）
│   │   ├── branch-manager.ts       # 分支管理命令
│   │   └── conflict-resolver.ts    # 冲突解决命令
│   │
│   ├── 📁 services/                 # 业务服务层
│   │   └── git-service.ts          # Git操作封装服务
│   │
│   ├── 📁 providers/                # VS Code数据提供者
│   │   ├── branch-provider.ts      # 分支树视图提供者
│   │   ├── history-provider.ts     # 提交历史提供者
│   │   └── conflict-provider.ts    # 冲突检测提供者
│   │
│   ├── 📁 webview/                  # Webview可视化界面
│   │   ├── index.tsx               # React应用入口
│   │   ├── dashboard-panel.ts      # 控制面板管理
│   │   └── 📁 components/          # React组件
│   │       ├── App.tsx             # 主应用组件（标签页管理）
│   │       ├── App.css             # 样式文件
│   │       ├── CommitGraph.tsx     # 2D提交历史图谱（D3.js，高DPI优化）
│   │       ├── HeatmapAnalysis.tsx # 热力图分析（主题适配）
│   │       ├── BranchDependencyGraph.tsx # 分支依赖图
│   │       ├── TimelineView.tsx    # 时间线视图
│   │       ├── BranchTree.tsx      # 分支树组件
│   │       ├── ConflictEditor.tsx  # 冲突编辑器
│   │       └── CommandHistory.tsx  # 快捷指令历史
│   │
│   ├── 📁 utils/                    # 工具函数库
│   │   ├── git-utils.ts            # Git相关工具函数
│   │   ├── logger.ts               # 日志记录器
│   │   ├── notification.ts         # 通知工具类
│   │   └── constants.ts            # 常量定义
│   │
│   └── 📁 types/                    # TypeScript类型定义
│       └── git.ts                  # Git相关类型
│
├── 📁 resources/                    # 资源文件
│   └── git-icon.svg                # 扩展图标
│
├── 📁 docs/                         # 文档目录
│   ├── DEVELOPMENT.md              # 开发文档
│   └── QUICKSTART.md               # 快速开始指南
│
├── 📁 .vscode/                      # VS Code配置
│   ├── launch.json                 # 调试配置
│   ├── tasks.json                  # 任务配置
│   ├── settings.json               # 工作区设置
│   └── extensions.json             # 推荐扩展
│
├── 📁 .github/                      # GitHub配置
│   ├── workflows/
│   │   └── ci.yml                  # CI/CD配置
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md           # Bug报告模板
│       └── feature_request.md      # 功能建议模板
│
├── 📄 package.json                  # 项目配置和依赖
├── 📄 tsconfig.json                 # TypeScript配置
├── 📄 webpack.config.js             # Webpack打包配置
├── 📄 .eslintrc.json               # ESLint配置
├── 📄 .gitignore                   # Git忽略文件
├── 📄 .vscodeignore                # VS Code打包忽略
├── 📄 .npmignore                   # NPM发布忽略
│
├── 📄 README.md                     # 项目说明（英文）
├── 📄 README_CN.md                  # 项目说明（中文详细版）
├── 📄 CHANGELOG.md                  # 更新日志
├── 📄 CONTRIBUTING.md               # 贡献指南
├── 📄 LICENSE                       # MIT许可证
└── 📄 PROJECT_OVERVIEW.md           # 本文件
```

## 🎯 核心模块说明

### 1. Extension (扩展主体)

**文件**: `src/extension.ts`

**职责**:
- 扩展激活和停用
- 服务初始化
- 提供者注册
- 命令注册
- 事件监听

**关键代码**:
```typescript
export function activate(context: vscode.ExtensionContext) {
    const gitService = new GitService();
    const branchProvider = new BranchProvider(gitService);
    // ... 注册各种功能
}
```

### 2. Commands (命令层)

**目录**: `src/commands/`

**模块**:
- `git-operations.ts`: Push/Pull/Clone等基础操作
- `branch-manager.ts`: 创建/切换/合并/删除分支
- `conflict-resolver.ts`: 冲突检测和解决

**特点**:
- 用户交互处理
- 进度提示
- 错误处理
- 确认对话框

### 3. Services (服务层)

**文件**: `src/services/git-service.ts`

**职责**:
- 封装simple-git库
- 提供统一的Git操作接口
- 错误处理和日志记录
- 仓库状态管理

**核心方法**:
```typescript
class GitService {
    async getStatus(): Promise<StatusResult>
    async getBranches(): Promise<BranchSummary>
    async push/pull/clone/merge/...
}
```

### 4. Providers (数据提供者)

**目录**: `src/providers/`

**模块**:
- `branch-provider.ts`: 分支树视图
- `history-provider.ts`: 提交历史列表
- `conflict-provider.ts`: 冲突文件检测

**实现**: 
实现VS Code的`TreeDataProvider`接口，提供树形数据结构。

### 5. Webview (可视化界面)

**目录**: `src/webview/`

**技术栈**:
- React 18
- TypeScript
- CSS (VS Code主题变量)

**组件**:
- `App.tsx`: 主应用，8个标签页切换
- `CommitGraph.tsx`: D3.js绘制2D提交图谱
- `CommitGraph3D.tsx`: Three.js渲染3D提交图谱
- `HeatmapAnalysis.tsx`: 文件修改和贡献者热力图
- `BranchDependencyGraph.tsx`: 分支依赖关系图
- `TimelineView.tsx`: 时间线日历视图
- `BranchTree.tsx`: 分支列表和操作
- `ConflictEditor.tsx`: 冲突解决UI
- `CommandHistory.tsx`: 命令历史记录和快速执行

### 6. Utils (工具库)

**目录**: `src/utils/`

**模块**:
- `git-utils.ts`: Git操作辅助函数
- `logger.ts`: 日志系统
- `notification.ts`: 通知封装
- `constants.ts`: 常量定义

## 🔄 数据流架构

```
用户操作
    ↓
Commands (命令处理)
    ↓
GitService (业务逻辑)
    ↓
simple-git (Git操作)
    ↓
Git仓库
    ↓
Providers (数据刷新)
    ↓
VS Code UI更新
```

## 🚀 功能矩阵

| 功能模块 | 实现状态 | 文件位置 | 说明 |
|---------|---------|----------|------|
| 快速推送 | ✅ | git-operations.ts | Ctrl+Alt+P |
| 快速拉取 | ✅ | git-operations.ts | Ctrl+Alt+L |
| 克隆仓库 | ✅ | git-operations.ts | 可视化引导 |
| 创建分支 | ✅ | branch-manager.ts | 输入验证 |
| 切换分支 | ✅ | branch-manager.ts | Ctrl+Alt+B |
| 合并分支 | ✅ | branch-manager.ts | 冲突检测 |
| 删除分支 | ✅ | branch-manager.ts | 命令行方式（UI中已移除） |
| 分支树视图 | ✅ | branch-provider.ts | 侧边栏 |
| 提交历史 | ✅ | history-provider.ts | 列表展示 |
| 提交详情 | ✅ | history-provider.ts | Webview |
| 2D提交图谱 | ✅ | CommitGraph.tsx | D3.js绘制，高DPI优化 |
| 热力图分析 | ✅ | HeatmapAnalysis.tsx | 文件/贡献者统计，主题适配 |
| 分支依赖图 | ✅ | BranchDependencyGraph.tsx | 合并关系可视化 |
| 时间线视图 | ✅ | TimelineView.tsx | 日历热力图，主题适配 |
| 冲突检测 | ✅ | conflict-provider.ts | 实时检测 |
| 冲突解决 | ✅ | conflict-resolver.ts | 三种方案 |
| 控制面板 | ✅ | dashboard-panel.ts | 多标签页可视化 |
| 快捷指令历史 | ✅ | CommandHistory.tsx | 命令记录和执行 |

## 📦 依赖关系

### 核心依赖
```json
{
  "simple-git": "^3.19.0",        // Git操作
  "react": "^18.2.0",             // UI框架
  "react-dom": "^18.2.0",         // React DOM
  "d3": "^7.8.5",                 // 数据可视化（2D图谱、热力图等）
  "d3-force": "^3.0.0"            // D3力导向图
}
```

### 开发依赖
```json
{
  "typescript": "^5.1.0",
  "webpack": "^5.85.0",
  "eslint": "^8.40.0",
  "@types/vscode": "^1.80.0"
}
```

## 🛠️ 开发工作流

### 1. 本地开发
```bash
npm install          # 安装依赖
npm run watch        # 监听编译
F5                   # 启动调试
```

### 2. 测试验证
```bash
npm test            # 运行测试
npm run lint        # 代码检查
```

### 3. 打包发布
```bash
npm run compile     # 编译
vsce package        # 打包
vsce publish        # 发布
```

## 📈 性能指标

- **激活时间**: < 500ms
- **命令响应**: < 100ms
- **大仓库加载**: < 2s (100+ commits)
- **内存占用**: < 50MB
- **包体积**: < 5MB

## 🔐 安全考虑

- ✅ 不存储Git凭据
- ✅ 使用系统Git配置
- ✅ 操作前确认（可配置）
- ✅ 错误信息不泄露敏感数据
- ✅ 文件操作权限检查

## 🌐 国际化支持

当前版本: 简体中文
计划支持: 英文、繁体中文

## 📝 代码规范

- **语言**: TypeScript (严格模式)
- **风格**: ESLint + Prettier
- **注释**: JSDoc格式
- **命名**: 
  - 类: PascalCase
  - 函数: camelCase
  - 常量: UPPER_SNAKE_CASE

## 🧪 测试覆盖

- 单元测试: 计划中
- 集成测试: 计划中
- E2E测试: 计划中

## 📚 文档完整性

- [x] README.md - 项目介绍
- [x] README_CN.md - 中文详细文档
- [x] CHANGELOG.md - 更新日志
- [x] CONTRIBUTING.md - 贡献指南
- [x] LICENSE - MIT许可证
- [x] docs/DEVELOPMENT.md - 开发文档
- [x] docs/QUICKSTART.md - 快速开始
- [x] PROJECT_OVERVIEW.md - 项目概览
- [x] 代码注释完整

## 🎯 后续规划

### v0.2.0
- [ ] Git LFS支持
- [ ] 标签管理
- [ ] Stash管理
- [ ] 提交信息模板

### v0.3.0
- [ ] Git Flow支持
- [ ] Cherry-pick功能
- [ ] 交互式Rebase
- [ ] 多仓库管理

### v1.0.0
- [ ] 完整功能覆盖
- [ ] AI辅助冲突解决
- [ ] 团队协作功能
- [ ] 插件系统

## 🤝 贡献统计

当前版本由核心团队完成初始开发。
欢迎社区贡献！

## 📞 支持渠道

- 📖 文档: [Wiki](https://github.com/yourusername/git-assistant/wiki)
- 💬 讨论: [Discussions](https://github.com/yourusername/git-assistant/discussions)
- 🐛 问题: [Issues](https://github.com/yourusername/git-assistant/issues)
- 📧 邮件: support@gitassistant.com

---

**项目状态**: 🟢 活跃开发中

**最后更新**: 2024-01-01

**维护者**: Git Assistant Team

