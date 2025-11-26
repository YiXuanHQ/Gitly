# 开发文档

本文档提供Git Assistant扩展的详细开发指南。

## 📋 目录

- [环境搭建](#环境搭建)
- [项目结构](#项目结构)
- [核心概念](#核心概念)
- [开发工作流](#开发工作流)
- [调试技巧](#调试技巧)
- [性能优化](#性能优化)
- [发布流程](#发布流程)

## 环境搭建

### 系统要求

- Node.js 16.x 或更高版本
- npm 8.x 或更高版本
- VS Code 1.80.0 或更高版本
- Git 2.0 或更高版本

### 初始化项目

```bash
# 克隆仓库
git clone https://github.com/yourusername/git-assistant.git
cd git-assistant

# 安装依赖
npm install

# 编译项目
npm run compile

# 启动开发监听
npm run watch
```

### VS Code配置

推荐安装以下扩展：
- ESLint
- TypeScript and JavaScript Language Features

## 项目结构

```
git-assistant/
├── src/                          # 源代码
│   ├── extension.ts             # 扩展入口
│   ├── commands/                # 命令处理
│   │   ├── index.ts            # 命令注册
│   │   ├── git-operations.ts   # Git操作命令
│   │   ├── branch-manager.ts   # 分支管理命令
│   │   ├── conflict-resolver.ts # 冲突解决命令
│   │   ├── repository-init.ts   # 初始化、远程与初始提交
│   │   └── tag-manager.ts       # 标签创建/查看/删除
│   ├── providers/              # 树视图提供者
│   │   ├── branch-provider.ts
│   │   ├── history-provider.ts
│   │   └── conflict-provider.ts
│   ├── services/               # 业务服务
│   │   └── git-service.ts      # Git服务封装
│   ├── webview/                # Webview界面
│   │   ├── index.tsx           # React入口
│   │   ├── dashboard-panel.ts  # 面板管理
│   │   └── components/         # React组件
│   │       ├── App.tsx                     # 8个标签页控制
│   │       ├── CommandHistory.tsx          # 快捷指令历史
│   │       ├── GitCommandReference.tsx     # Git 指令集
│   │       ├── BranchTree.tsx / BranchDependencyGraph.tsx
│   │       ├── CommitGraph.tsx / CommitGraph3D.tsx (实验)
│   │       ├── TimelineView.tsx / HeatmapAnalysis.tsx
│   │       └── ConflictEditor.tsx
│   ├── utils/                  # 工具函数
│   │   ├── git-utils.ts
│   │   ├── logger.ts
│   │   ├── notification.ts
│   │   ├── command-history.ts
│   │   └── constants.ts
│   └── types/                  # 类型定义
│       └── git.ts
├── resources/                   # 资源文件（扩展图标）
│   └── git-icon.svg
├── dist/                        # 编译输出
├── package.json                 # 包配置
├── tsconfig.json               # TypeScript配置
├── webpack.config.js           # Webpack配置
└── README.md                   # 说明文档
```

## 核心概念

### Extension激活

扩展在以下情况激活：
- 工作区包含`.git`目录
- 用户执行相关命令
- 打开Git Assistant视图

```typescript
export function activate(context: vscode.ExtensionContext) {
    // 初始化服务
    const gitService = new GitService();
    
    // 注册提供者
    const branchProvider = new BranchProvider(gitService);
    
    // 注册命令
    registerCommands(context, gitService, branchProvider);
}
```

### Git服务封装

所有Git操作通过`GitService`类封装：

```typescript
class GitService {
    private git: SimpleGit;
    
    async getBranches(): Promise<BranchSummary> {
        return await this.git.branch();
    }
    
    async push(remote: string, branch: string): Promise<void> {
        await this.git.push(remote, branch);
    }
}
```

### 树视图提供者

实现`TreeDataProvider`接口：

```typescript
class BranchProvider implements vscode.TreeDataProvider<BranchTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element: BranchTreeItem): vscode.TreeItem {
        return element;
    }
    
    async getChildren(): Promise<BranchTreeItem[]> {
        // 返回子节点
    }
}
```

### Webview面板

创建和管理Webview：

```typescript
class DashboardPanel {
    private readonly _panel: vscode.WebviewPanel;
    
    static createOrShow(extensionUri: vscode.Uri) {
        const panel = vscode.window.createWebviewPanel(
            'gitDashboard',
            'Git Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        
        panel.webview.html = getWebviewContent();
    }
}
```

## 开发工作流

### 1. 启动开发环境

```bash
# 终端1: 监听TypeScript编译
npm run watch

# 终端2: 运行扩展
# 在VS Code中按F5
```

### 2. 开发新功能

```bash
# 创建功能分支
git checkout -b feature/new-feature

# 开发代码
# ...

# 提交更改
git commit -m "feat: add new feature"
```

### 3. 测试

```bash
# 运行单元测试
npm test

# 代码检查
npm run lint

#（可选）仅重新编译测试
npm run compile-tests
```

### 4. 调试

- 设置断点
- 按F5启动调试
- 在Extension Host窗口中测试
- 查看调试控制台输出

## 调试技巧

### 扩展主机调试

```typescript
// 使用console.log调试
console.log('Debug info:', data);

// 使用Logger
Logger.debug('Debug message', { data });

// 使用VS Code输出通道
outputChannel.appendLine('Debug info');
```

### Webview调试

1. 在Webview中右键 -> "打开开发者工具"
2. 使用Chrome DevTools调试
3. 查看Console和Network面板

### 常见问题排查

**问题**: 扩展不激活
```typescript
// 检查activationEvents配置
"activationEvents": [
    "workspaceContains:.git"
]
```

**问题**: 命令不可用
```typescript
// 确保命令已注册
context.subscriptions.push(
    vscode.commands.registerCommand('your.command', handler)
);
```

**问题**: 树视图不更新
```typescript
// 手动触发刷新
this._onDidChangeTreeData.fire();
```

## 性能优化

### 1. 延迟加载

```typescript
// 按需导入大型模块
async function heavyOperation() {
    const module = await import('./heavy-module');
    return module.execute();
}
```

### 2. 缓存结果

```typescript
class GitService {
    private branchCache?: BranchSummary;
    private cacheTime = 0;
    
    async getBranches(): Promise<BranchSummary> {
        const now = Date.now();
        if (this.branchCache && now - this.cacheTime < 5000) {
            return this.branchCache;
        }
        
        this.branchCache = await this.git.branch();
        this.cacheTime = now;
        return this.branchCache;
    }
}
```

### 3. 防抖和节流

```typescript
import { debounce } from './utils';

class MyProvider {
    // 防抖刷新
    private debouncedRefresh = debounce(() => {
        this.refresh();
    }, 300);
}
```

### 4. 虚拟滚动

对于大量数据，使用虚拟滚动：

```typescript
// 只渲染可见区域的项
function renderVisibleItems(startIndex: number, endIndex: number) {
    return items.slice(startIndex, endIndex);
}
```

## 发布流程

### 1. 版本更新

```bash
# 更新版本号
npm version patch  # 0.1.0 -> 0.1.1
npm version minor  # 0.1.0 -> 0.2.0
npm version major  # 0.1.0 -> 1.0.0
```

### 2. 更新文档

- 更新`CHANGELOG.md`
- 更新`README.md`
- 检查所有文档链接

### 3. 构建和测试

```bash
# 确保依赖最新
npm install

# 完整构建（生成 dist/ & webview）
npm run compile

# 运行所有测试
npm test

# 代码检查
npm run lint
```

### 4. 打包

```bash
# 安装vsce
npm install -g @vscode/vsce

# 打包扩展
vsce package

# 生成 git-assistant-0.1.0.vsix
```

### 5. 发布

```bash
# 登录
vsce login your-publisher-name

# 发布到市场
vsce publish

# 或手动上传.vsix文件
```

### 6. GitHub Release

```bash
# 创建标签
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0

# 在GitHub上创建Release
# 上传.vsix文件作为附件
```

## 最佳实践

### 1. 错误处理

```typescript
try {
    await gitService.push();
    Notification.success('推送成功');
} catch (error) {
    Logger.error('推送失败', error);
    Notification.error('推送失败', error);
}
```

### 2. 进度提示

```typescript
await Notification.withProgress('正在推送...', async (progress) => {
    progress.report({ increment: 30 });
    await gitService.push();
    progress.report({ increment: 70 });
});
```

### 3. 用户确认

```typescript
const confirmed = await Notification.confirm(
    '确定要删除分支吗？',
    '删除',
    '取消'
);

if (confirmed) {
    await gitService.deleteBranch(branchName);
}
```

### 4. 配置读取

```typescript
const config = vscode.workspace.getConfiguration('git-assistant');
const autoFetch = config.get<boolean>('autoFetch', true);
```

## 参考资源

- [VS Code Extension API](https://code.visualstudio.com/api)
- [simple-git文档](https://github.com/steveukx/git-js)
- [TypeScript官方文档](https://www.typescriptlang.org/)
- [React官方文档](https://react.dev/)

---

如有疑问，请在 [GitHub Discussions](https://github.com/yourusername/git-assistant/discussions) 提问。

