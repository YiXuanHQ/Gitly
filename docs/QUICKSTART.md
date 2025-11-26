# 快速开始指南

本指南将帮助您快速上手 Git Assistant 扩展的开发和使用。

## 🚀 5分钟快速开始

### 1. 安装和运行

```bash
# 克隆项目
git clone https://github.com/yourusername/git-assistant.git
cd git-assistant

# 安装依赖（约1-2分钟）
npm install

# 启动开发模式
npm run watch
```

### 2. 调试扩展

1. 在VS Code中打开项目文件夹
2. 按 `F5` 启动调试
3. 在新打开的Extension Development Host窗口中：
   - 打开一个包含Git仓库的项目
   - 点击侧边栏的Git Assistant图标
   - 尝试各种功能

### 3. 测试功能

#### 测试快捷操作
- 按 `Ctrl+Alt+P` 尝试快速推送
- 按 `Ctrl+Alt+L` 尝试快速拉取
- 按 `Ctrl+Alt+B` 尝试切换分支
- 在空文件夹按 `Ctrl+Shift+P` 执行 “Git Assistant: 初始化仓库 / 添加远程仓库 / 初始提交”

#### 测试可视化界面
- 按 `Ctrl+Shift+P` 打开命令面板
- 输入 "Git Assistant: 打开控制面板"
- 查看仓库状态和操作按钮
- 按固定顺序切换 8 个标签页体验功能：
  - 📋 快捷指令（命令历史与快速执行）
  - 📚 Git 指令集（常用命令速查）
  - 🌿 分支管理
  - 🌳 分支依赖
  - ⚠️ 冲突解决
  - 📊 提交图谱（2D，高DPI）
  - 📅 时间线（日历 + 趋势图）
  - 🔥 热力图（文件/贡献者分析）

## 📝 常用开发任务

### 添加新命令

1. 在 `src/commands/` 下创建或编辑文件
2. 实现命令处理函数
3. 在 `package.json` 的 `contributes.commands` 中注册
4. 在 `src/commands/index.ts` 中注册命令

示例：
```typescript
// src/commands/my-command.ts
export function registerMyCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('git-assistant.myCommand', async () => {
            vscode.window.showInformationMessage('Hello from my command!');
        })
    );
}
```

### 添加树视图

1. 在 `src/providers/` 下创建Provider类
2. 实现 `TreeDataProvider` 接口
3. 在 `package.json` 中注册视图
4. 在 `extension.ts` 中注册Provider

### 添加Webview组件

1. 在 `src/webview/components/` 下创建React组件
2. 在父组件中引入
3. 处理与扩展的消息通信

## 🧪 测试

### 运行测试
```bash
# 单元测试
npm test

# 代码检查
npm run lint

# 类型检查
npm run compile
```

### 手动测试清单

- [ ] 推送/拉取快捷键正常（Ctrl+Alt+P / Ctrl+Alt+L）
- [ ] 分支创建、切换、合并可用（含 Ctrl+Alt+B）
- [ ] 冲突检测与解决工具可打开
- [ ] 侧边栏的分支/历史/冲突视图均能加载
- [ ] 控制面板可打开且标签顺序正确
- [ ] 快捷指令历史记录新增命令并可重新执行
- [ ] Git 指令集内容加载、搜索功能可用
- [ ] "初始化仓库 → 添加远程 → 初始提交" 引导可完成
- [ ] 标签管理命令（创建/查看/删除标签）可执行
- [ ] 2D提交图谱渲染、缩放、hover正常
- [ ] 热力图、分支依赖图、时间线数据准确

## 🐛 调试技巧

### 查看日志
1. 打开"输出"面板（`Ctrl+Shift+U`）
2. 从下拉菜单选择"Git Assistant"
3. 查看详细日志

### 断点调试
1. 在代码中设置断点
2. 按 `F5` 启动调试
3. 在Extension Host中触发功能
4. 查看变量和调用栈

### Webview调试
1. 在Webview中右键
2. 选择"打开开发者工具"
3. 使用Chrome DevTools调试

## 📦 打包和发布

### 本地打包
```bash
# 安装vsce
npm install -g @vscode/vsce

# 打包
vsce package

# 生成 git-assistant-x.x.x.vsix
```

### 本地安装测试
1. 在VS Code中按 `Ctrl+Shift+P`
2. 输入 "Extensions: Install from VSIX..."
3. 选择生成的 `.vsix` 文件

### 发布到市场
```bash
# 登录
vsce login your-publisher-name

# 发布
vsce publish
```

## 📚 学习资源

### 官方文档
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)

### 项目文档
- [开发文档](DEVELOPMENT.md) - 详细的开发指南
- [贡献指南](../CONTRIBUTING.md) - 如何贡献代码
- [架构概览](../PROJECT_OVERVIEW.md) - 系统架构说明

### 示例代码
查看 `src/` 目录下的代码，特别是：
- `commands/git-operations.ts` - Git操作示例
- `commands/repository-init.ts` - 初始化/远程/初始提交流程
- `providers/branch-provider.ts` - 树视图示例
- `webview/dashboard-panel.ts` - Webview示例

## 🎯 下一步

现在您已经了解了基础知识，可以：

1. 📖 阅读[开发文档](DEVELOPMENT.md)了解更多细节
2. 🐛 在[Issues](https://github.com/yourusername/git-assistant/issues)中查找待解决的问题
3. 💡 在[Discussions](https://github.com/yourusername/git-assistant/discussions)中分享想法
4. 🤝 提交您的第一个Pull Request

## ❓ 遇到问题？

- 查看 [`GETTING_STARTED.md`](../GETTING_STARTED.md) 的常见问题章节
- 在 [Discussions](https://github.com/yourusername/git-assistant/discussions) 提问
- 提交 [Issue](https://github.com/yourusername/git-assistant/issues)

祝开发愉快！🎉

