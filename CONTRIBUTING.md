# 如何为 Gitly 做出贡献

感谢你抽出时间为 Gitly 做出贡献！

本文档介绍在参与 Gitly 开发、提建议或报告问题时的一些约定和流程，方便大家协作。

---

## 行为准则

本项目及所有参与者都遵守仓库中的 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)（行为准则）。  
参与本项目即表示你同意遵守该行为准则。

---

## 我可以如何贡献？

### 报告 Bug

发现问题欢迎反馈，这将帮助我们不断改进 Gitly。

1. 先查看 [已有 Issues](https://github.com/YiXuanHQ/Gitly/issues)，确认是否已经有人报告过。
2. 若没有，请使用合适的模板（Bug / Feature / Improvement）创建新的 Issue，并尽可能提供完整信息，例如：
   - VS Code 版本
   - Git 版本
   - 操作系统
   - 复现步骤
   - 截图 / 日志（如果有）

我们会在精力允许的情况下尽快响应，并尝试复现和修复问题。

### 功能需求（Feature Requests）

欢迎为 Gitly 提出新的功能需求，我们希望把 Gitly 打造成更好用的 VS Code Git 工具。

- 首先在 [Issues](https://github.com/YiXuanHQ/Gitly/issues) 中搜索，确认是否已有类似想法。
- 如果没有，创建一个 **Feature Request** 类型的 Issue，并说明：
  - 你的使用场景和遇到的问题
  - 你期望的行为 / 解决方案
  - （可选）相关截图 / 原型图等

### 改进建议（Improvements）

对现有功能的小改进或体验优化同样非常欢迎。

- 对于小建议，可以直接在现有 Issue 下评论，或者新建 **Improvement** 类型 Issue。
- 对于较大的 UI / UX / 架构改动，请先开一个 Issue 讨论方案，**先对齐设计再动手实现**，可以减少返工。

---

## 参与开发

如果你希望直接参与开发，可以通过以下方式：

- 在现有 Issue 中选择你感兴趣的任务，在评论里说明你愿意尝试；  
  当就实现方案达成一致后，会将该 Issue 分配给你。
- 或者新建 Issue，详细描述你想做的功能 / 改进，并说明你计划自己实现。

> 建议：在开始写代码前，先和维护者确认实现思路，以免大改后方向不一致。

---

## 开发环境搭建

### 第一步：准备环境

1. 安装 [Node.js](https://nodejs.org/en/)。
2. 克隆仓库：`git clone https://github.com/YiXuanHQ/Gitly.git`
3. 在 Visual Studio Code 中打开仓库。
4. 在 VS Code 终端执行 `npm install` 安装所有依赖。
5. （推荐）安装 [ESLint 扩展](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)，保证代码风格一致。
6. 为你要开发的 Issue 新建并检出一个功能分支（feature branch）。

### 第二步：熟悉代码结构

整体结构与上游 Git Graph 项目类似：

- `src/` – 扩展后端（Extension backend）
- `web/` – Gitly 主视图 Webview 前端
- `web/assistant/` – 助手 / 仪表盘 Webview 前端
- `tests/` – Jest 单元测试

建议从与你要改动的功能最相关的目录开始阅读。

### 第三步：构建

在 VS Code 终端中运行合适的 npm 脚本：

- `npm run compile` – 同时编译后端与前端（推荐）
- `npm run compile-src` – 仅编译后端
- `npm run compile-web` – 编译前端（包括 assistant），并进行压缩
- `npm run compile-web-debug` – 编译前端但不压缩，更便于调试

> 通常首次打开代码库时，需要先运行一次 `npm run compile-src`，  
> 以便在 `out/` 目录生成后端类型信息，供前端引用。

### 第四步：本地快速验证

- 在 VS Code 中按 **F5** 启动一个 *Extension Development Host*（扩展开发宿主）窗口：
  - 在该窗口中像普通用户一样使用 Gitly，手动验证你的改动。
  - 通过命令 `Developer: Open Webview Developer Tools` 打开 Webview DevTools 调试前端。
  - 如果使用 `npm run compile-web-debug` 构建，可以在编译后的 JS 中打断点。
- 在原 VS Code 窗口中：
  - 为后端 TypeScript 代码打断点
  - 按需重启 / 停止 Extension Development Host

### 第五步：完整测试与打包（可选）

1. 安装 VS Code 扩展打包工具：`npm install -g vsce`（如尚未安装）。
2. 临时在 `package.json` 中提升版本号（例如：`1.30.0-alpha.0`）。  
   **注意：请不要将该临时版本号提交到仓库。**
3. 运行 `npm run package-and-install` 构建并在本地安装 `.vsix`。
4. 重启 VS Code，确认安装的是预期的 alpha 版本。
5. 像普通用户一样使用 Gitly，做一次尽量全面的功能验证。

---

## 提交变更（Pull Request 流程）

1. 将你的分支推送到 fork（或主仓库，当你有权限时）。
2. 向 `main` 分支发起 Pull Request。
3. 在 PR 描述中：
   - 简要说明本次改动的目的和范围
   - 关联相关 Issue（例如：`Closes #123`）
   - 若涉及 UI 变化，附上截图 / GIF 便于评审
4. 在评审过程中：
   - 对于 reviewer 的问题或建议，逐条回复或修改
   - 如需较大范围的结构调整，建议先在 PR 讨论中达成一致

---

## 代码风格与建议

- 使用 VS Code 默认的 TypeScript / JSON 格式化（“Format Document”）。
- 在可能的情况下，保持改动 **小而聚焦**，便于代码审查，也便于回滚。
- 当你修改了已有的逻辑，且对应功能已有测试覆盖时，请一并更新 / 添加测试（位于 `tests/`）。
- 对用户可见行为的变化，尽量在 PR 描述或截图中说明清楚。

非常感谢你为 Gitly 付出的时间与贡献！  
无论是一个小 Bug 报告、一条建议，还是较大规模的功能开发，都是推动项目前进的重要力量。


