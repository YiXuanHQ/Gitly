# 🔍 Git Assistant 项目验证和调试完整指南

本指南帮助你快速验证 Git Assistant 扩展是否工作正常，并在出现问题时提供排查路径。

# 1. 前置检查

### 1.1 环境版本

在开始之前，确认以下工具版本满足要求：

- **Node.js 16+**

  ```powershell
  node --version
  ```

- **npm**

  ```powershell
  npm --version
  ```

- **Git**

  ```powershell
  git --version
  ```

- **VS Code 1.80+**

  ```powershell
  code --version
  ```

### 1.2 安装依赖

```powershell
cd E:\CodeGitAssistant
npm install
```

预期输出：`added XXX packages ...`

若安装失败，可尝试：

```powershell
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json -Force
npm install
```

### 1.3 编译项目

- **单次编译**

  ```powershell
  npm run compile
  ```

- **监听模式（推荐开发时使用）**

  ```powershell
  npm run watch
  ```

预期输出：

```
webpack 5.x.x compiled successfully in xxx ms
asset extension.js xxx KiB [emitted]
asset webview.js xxx KiB [emitted]
```

出现错误时可追加 `--display-error-details` 查看细节：

```powershell
npm run compile -- --display-error-details
```

### 1.4 启动调试

- **方法 A：VS Code（推荐）**

  1. 在 VS Code 中打开 `E:\CodeGitAssistant`
  2. 终端运行 `npm run watch`
  3. 按 `F5`（或菜单：运行 → 启动调试）
  4. 弹出 `[Extension Development Host]` 窗口

- **方法 B：使用 `launch.json`**

  `.vscode/launch.json` 已配置：

  ```json
  {
    "name": "运行扩展",
    "type": "extensionHost",
    "request": "launch",
    "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
  }
  ```

# 2. 功能验证

## 2.1 准备测试仓库

```powershell
mkdir E:\TestRepo
cd E:\TestRepo
git init
echo "# Test" > README.md
git add .
git commit -m "Initial commit"
code .
```

## 2.2 验证扩展激活

- `Ctrl+Shift+X` → 搜索 **Git Assistant** → 显示“已启用”
- `Ctrl+Shift+U` → 选择 **Git Assistant** 输出通道 → 日志显示“扩展已激活”

## 2.3 验证侧边栏

- 分支管理
- 提交历史
- 冲突检测

## 2.4 测试快捷键

| 快捷键       | 功能     | 预期结果               |
| ------------ | -------- | ---------------------- |
| `Ctrl+Alt+P` | 快速推送 | 弹出推送确认对话框     |
| `Ctrl+Alt+L` | 快速拉取 | 开始拉取操作           |
| `Ctrl+Alt+B` | 切换分支 | 显示分支列表并进行切换 |

**场景化验证**

1. **快速推送（Ctrl+Alt+P）**
   - 在当前分支制造一次提交：`git commit -am "shortcut push"`
   - 按下快捷键后确认弹窗中显示目标远程与分支信息
   - 在弹窗中选择“确认推送”，查看输出面板应出现“开始推送/推送成功”日志，并在侧边栏提交历史中看到该提交被标记为已同步

2. **快速拉取（Ctrl+Alt+L）**
   - 在远程仓库制造一条新提交（可在另一终端 `git commit && git push`）
   - 回到 VS Code，确保当前分支有对应远程追踪
   - 按下快捷键，观察通知提示“正在拉取”，完成后刷新提交历史/时间线视图确认新增提交已同步
   - 若产生冲突，输出面板与“冲突检测”视图应立即出现红色提示

3. **快速切换分支（Ctrl+Alt+B）**
   - 在 Git Assistant 侧边栏确认存在至少两个分支，如 `main` 与 `feature/shortcut-tests`
   - 按下快捷键，确认弹出的分支列表默认聚焦当前分支，可通过关键字实时过滤
   - 选择目标分支后，状态栏与控制面板“分支管理”标签页应立即更新，同时若新分支存在未提交更改，应弹出提醒
   - 使用 `git status` 验证工作区保持干净，确保切换过程中未残留临时文件

## 2.5 测试命令面板

`Ctrl+Shift+P` → 输入“Git Assistant” → 应展示全部命令（Push、Pull、Clone、Init、Add Remote、Initial Commit、创建/切换/合并分支等）。

## 2.6 测试控制面板

执行 **Git Assistant: 打开控制面板**，确认：

- 面板正常加载并显示仓库统计与快捷动作
- 8 个标签页顺序为：快捷指令 → Git 指令集 → 分支管理 → 分支依赖 → 冲突解决 → 提交图谱 → 时间线 → 热力图
- 各标签内容可加载并可交互

### 2.6.1 测试快捷指令

1. **界面布局验证**
   - 打开控制面板，切换到“快捷指令”标签页（第一个标签）
   - 确认页面包含以下部分：
     - 顶部标题“快捷指令”
     - “清除历史记录”按钮（位于页面右上角）
     - 左侧：命令历史记录区域（显示最近执行的命令）
     - 右侧：可用命令列表区域（按分类折叠/展开显示）

2. **命令分类显示**
   - 验证以下分类存在并按顺序显示：
     - 🚀 **开始使用**（init）：初始化仓库、克隆仓库
     - ⚙️ **配置仓库**（setup）：添加远程仓库、添加文件、提交更改
     - 🔄 **同步操作**（sync）：快速推送、快速拉取
     - 🌿 **分支管理**（branch）：创建分支、切换分支、合并分支
     - 🏷️ **标签管理**（tag）：创建标签、查看标签列表、删除标签、推送标签
     - 📊 **查看操作**（view）：查看提交历史、刷新分支列表
     - ⚠️ **冲突处理**（conflict）：解决冲突
     - 🛠️ **工具**（tools）：打开控制面板
   - 默认展开分类：确认“开始使用”和“工具”分类默认展开，其他分类可折叠
   - 点击分类标题验证折叠/展开功能正常

3. **命令可用性判断**
   - **非 Git 仓库场景**：
     - 在非 Git 目录打开控制面板，验证：
       - “开始使用”分类中的命令显示为可用状态（绿色高亮）
       - “配置仓库”及之后分类中的命令显示为禁用状态（灰色）
       - 尝试点击禁用命令，确认无响应或提示“请先初始化仓库”
   
   - **已初始化但无提交场景**：
     - 执行 `git init` 后，验证：
       - “配置仓库”分类的命令变为可用
       - “同步操作”“分支管理”“标签管理”仍为禁用（需要至少一次提交）
   
   - **已有提交场景**：
     - 创建初始提交后，验证所有需要“commits”的命令变为可用
     - 执行 `git push` 或 `git pull` 后，确认相关命令图标和状态正常

4. **命令历史记录功能**
   - **执行命令并观察历史**：
     - 依次执行以下命令，观察历史记录区域实时更新：
       1. **Git Assistant: 初始化仓库** → 应显示成功状态（✓）和时间戳
       2. **Git Assistant: 添加远程仓库** → 输入测试远程地址，确认记录成功
       3. **Git Assistant: 提交更改** → 创建提交后，历史记录显示提交信息
       4. **Git Assistant: 快速推送** → 推送成功后，记录显示推送状态
     - 验证每条历史记录包含：
       - 命令图标和名称
       - 执行时间（如“刚刚”“2分钟前”“1小时前”等相对时间）
       - 成功/失败状态指示（✓ 或 ✗）
       - 失败时显示错误信息
   
   - **历史记录顺序**：
     - 确认最新执行的命令显示在列表顶部
     - 最多显示最近 20 条记录（超过 20 条时，旧记录不显示但保留在存储中）
   
   - **重新执行历史命令**：
     - 在历史记录区域点击任意一条成功执行的命令
     - 确认命令被重新执行，并生成新的历史记录条目
     - 若命令需要用户输入（如分支名称、提交信息），应弹出输入框
     - 验证重新执行失败的命令时，错误提示正常显示

5. **清除历史记录**
   - 点击“清除历史记录”按钮
   - 确认弹出确认对话框（如“确定要清除所有历史记录吗？”）
   - 确认清除后，历史记录区域应为空
   - 验证清除操作不影响可用命令列表
   - 执行新命令后，历史记录重新开始记录

6. **命令执行反馈**
   - **成功执行**：
     - 执行任意命令（如“快速推送”），确认：
       - 历史记录立即添加新条目，状态为成功（✓）
       - 控制面板数据自动刷新（如分支列表、提交历史等）
       - 相关 UI 元素（侧边栏、状态栏）同步更新
   
   - **执行失败**：
     - 制造失败场景（如无远程仓库时执行推送），确认：
       - 历史记录显示失败状态（✗）和错误信息
       - 错误信息完整可读，包含失败原因
       - 不会中断扩展运行，其他功能仍可正常使用

7. **跨标签页集成验证**
   - 在“快捷指令”中执行“创建分支”，验证：
     - 切换到“分支管理”标签页，新分支应出现在分支树中
     - 切换到“分支依赖”标签页，分支关系图应更新
   - 在“快捷指令”中执行“快速推送”，验证：
     - 切换到“提交图谱”标签页，相关提交节点状态更新
     - 切换到“时间线”标签页，推送时间点应显示

8. **边界场景测试**
   - **历史记录上限**：
     - 快速连续执行 50+ 条命令，确认历史记录保持在最多 20 条显示
     - 清除后重新执行，验证记录计数从 0 开始
   
   - **命令执行中状态**：
     - 执行耗时命令（如克隆大型仓库），确认：
       - 历史记录不会在命令执行完成前添加
       - 命令执行过程中，相关按钮应显示加载状态或禁用
   
   - **并发执行**：
     - 快速点击多个命令按钮，验证：
       - 命令按顺序执行，不会并发冲突
       - 每条命令的执行结果都正确记录到历史

9. **UI/UX 细节验证**
   - 命令描述清晰：悬停在命令项上时，显示完整描述信息
   - 图标一致性：确认各分类和命令的图标显示正常，符合语义
   - 响应式布局：调整控制面板宽度，验证命令列表和历史记录区域自适应
   - 颜色主题：确认命令的可用/禁用状态在不同 VS Code 主题下清晰可辨

10. **回归检查清单**
    - [ ] 命令历史记录正确显示执行时间和状态
    - [ ] 可用命令列表按分类正确分组和折叠
    - [ ] 命令可用性基于仓库状态正确判断
    - [ ] 重新执行历史命令功能正常
    - [ ] 清除历史记录功能正常
    - [ ] 命令执行后历史记录实时更新
    - [ ] 失败命令的错误信息正确显示
    - [ ] 跨标签页数据同步正常

### 2.6.2 测试分支管理

1. **准备工作**
   - 切换到已有仓库的 `main` 分支，确保 `git status` 显示 clean
   - 在控制面板打开“分支管理”标签页，确认当前分支标识正确

2. **创建与命名规范**
   - 执行 **Git Assistant: 创建分支**，输入 `feature/branch-tests`
   - 观察侧边栏分支树即时出现新分支及对应图标/描述
   - 若输入非法名称（如包含空格），扩展应提示并阻止创建

3. **切换分支验证**
   - 使用 `Ctrl+Alt+B` 或命令面板切换到 `feature/branch-tests`
   - 控制面板、状态栏、侧边栏应同步显示新分支
   - 切换后修改 `src/app.ts`，确认自动提示“当前分支有未提交更改”

4. **推送与远程追踪**
   - 在“快捷指令”中执行 **快速推送** 将新分支推送到远程
   - 验证分支列表中 `feature/branch-tests` 显示远程标记，并在“分支依赖”视图看到与 `origin/feature/branch-tests` 的连线

5. **合并预演（快进）**
   - 切回 `main`，在分支树选择“合并到当前分支”，目标选 `feature/branch-tests`
   - 若 `main` 无新增提交，应自动快进；记录日志输出
   - 在提交历史确认 `feature/branch-tests` 的提交已出现

6. **合并预演（非快进）**
   - 创建 `feature/branch-tests-2` 并新增一条提交
   - 在 `main` 增加不同提交以制造非快进场景
   - 使用 **Git Assistant: 合并分支** 选择 `feature/branch-tests-2`，确认出现合并对话框、冲突提示或成功信息

7. **并行分支清理**
   - 删除已合并分支（本地 + 远程），验证“删除远程分支”确认弹窗
   - 对未合并分支尝试删除时应弹出警告，需启用“强制删除”

8. **回归检查**
   - 复查“分支依赖”“提交图谱”是否反映最新结构
   - 对照验证清单，确认分支创建/切换/合并均已覆盖

### 2.6.3 测试分支依赖

> **测试目标**：验证分支依赖关系图能有效解决程序员在 Git 协作中的常见痛点，如不清楚分支关系、难以识别已合并分支、无法追溯合并路径等。

#### 痛点场景 1：识别已合并和未合并的分支

**问题**：团队中分支很多，无法快速识别哪些分支已经合并到主分支，哪些还在开发中。

1. **准备测试数据**
   ```powershell
   # 创建模拟场景：已有主分支和多个功能分支
   git checkout main
   git checkout -b feature/user-auth
   echo "auth code" > src/auth.ts
   git commit -am "Add user authentication"
   git checkout main
   git merge feature/user-auth -m "Merge branch 'feature/user-auth'"
   
   git checkout -b feature/payment
   echo "payment code" > src/payment.ts
   git commit -am "Add payment feature"
   # 注意：此分支尚未合并到 main
   
   git checkout -b feature/notification
   echo "notify code" > src/notify.ts
   git commit -am "Add notification"
   git checkout main
   git merge feature/notification -m "Merge branch 'feature/notification'"
   ```

2. **验证合并关系显示**
   - 切换到控制面板“分支依赖”标签页
   - 验证图表中：
     - `feature/user-auth` → `main` 有一条合并连线（箭头指向 main）
     - `feature/notification` → `main` 有一条合并连线
     - `feature/payment` → `main` **没有连线**（表示未合并）
   - **痛点解决**：通过可视化连线，一眼识别哪些分支已合并，哪些待合并

3. **识别孤立分支**
   - 观察图表，确认没有任何合并连线的分支节点
   - 这些分支可能是：
     - 新创建但尚未合并的功能分支
     - 已经过时但未清理的分支
     - 实验性分支
   - **痛点解决**：快速发现需要关注或清理的分支

#### 痛点场景 2：理解复杂的合并路径和依赖关系

**问题**：在大型项目中，分支之间可能存在多层合并关系，难以理解分支的创建顺序和依赖链。

1. **创建多层合并场景**
   ```powershell
   git checkout main
   git checkout -b develop
   git checkout -b feature/api-v2
   echo "api v2" > src/api-v2.ts
   git commit -am "API v2 implementation"
   git checkout develop
   git merge feature/api-v2 -m "Merge branch 'feature/api-v2' into develop"
   
   git checkout develop
   git checkout -b feature/dashboard
   echo "dashboard" > src/dashboard.ts
   git commit -am "Add dashboard"
   git checkout develop
   git merge feature/dashboard -m "Merge branch 'feature/dashboard' into develop"
   
   git checkout main
   git merge develop -m "Merge branch 'develop' into main"
   ```

2. **验证依赖链显示**
   - 在分支依赖图中，验证：
     - `feature/api-v2` → `develop` 有连线
     - `feature/dashboard` → `develop` 有连线
     - `develop` → `main` 有连线
   - **痛点解决**：清晰看到分支的合并路径，理解代码流向（feature → develop → main）

3. **验证箭头方向**
   - 确认所有连线的箭头指向被合并的目标分支
   - 箭头从源分支指向目标分支（从 → 到）
   - **痛点解决**：准确理解合并方向，避免混淆

#### 痛点场景 3：当前分支状态的可视化标识

**问题**：切换分支后，容易忘记当前在哪个分支上工作，导致错误提交或合并。

1. **验证当前分支高亮**
   - 切换到不同分支（使用 `Ctrl+Alt+B` 或命令面板）
   - 在分支依赖图中验证：
     - 当前分支节点使用**蓝色高亮**（#4a90e2）
     - 当前分支节点有**虚线外圈**（pulse 动画效果）
     - 其他分支节点使用普通蓝色（#569cd6）
   - **痛点解决**：一目了然当前工作分支，避免操作错误

2. **动态更新验证**
   - 切换到 `feature/payment` 分支
   - 观察分支依赖图，确认节点高亮立即更新
   - 切换到 `main` 分支，确认高亮跟随切换
   - **痛点解决**：实时反馈，避免状态不一致

#### 痛点场景 4：多人协作时的分支状态追踪

**问题**：团队成员在多个分支并行开发，不清楚其他人的工作进度和分支状态。

1. **模拟多人协作场景**
   ```powershell
   # 模拟 Alice 的分支
   git checkout -b alice/feature-login
   echo "login by alice" > src/login.ts
   git commit -am "Implement login (Alice)"
   
   # 模拟 Bob 的分支
   git checkout main
   git checkout -b bob/feature-profile
   echo "profile by bob" > src/profile.ts
   git commit -am "Implement profile (Bob)"
   
   # Alice 先合并了
   git checkout main
   git merge alice/feature-login -m "Merge branch 'alice/feature-login'"
   
   # Bob 的分支还未合并
   ```

2. **验证多人分支可视化**
   - 在分支依赖图中，验证：
     - 能看到所有开发者的分支节点
     - 已合并的分支（`alice/feature-login`）有连线指向 `main`
     - 未合并的分支（`bob/feature-profile`）没有连线
   - **痛点解决**：快速了解团队工作状态，避免重复开发和冲突

3. **分支命名识别**
   - 确认分支节点标签清晰显示完整分支名
   - 长分支名自动截断（超过 15 个字符显示 "..."）
   - **痛点解决**：通过命名规范快速识别分支归属和用途

#### 痛点场景 5：冲突追溯和合并历史查看

**问题**：发生合并冲突时，难以快速了解冲突分支的来源和合并历史。

1. **创建冲突场景并验证**
   ```powershell
   git checkout main
   git checkout -b feature/conflict-source
   echo "version A" > src/config.ts
   git commit -am "Add config (source branch)"
   
   git checkout main
   echo "version B" > src/config.ts
   git commit -am "Update config (main branch)"
   
   git checkout feature/conflict-source
   git merge main  # 此时会产生冲突
   ```

2. **验证冲突分支的可视化**
   - 在分支依赖图中，即使存在冲突，也应显示：
     - `feature/conflict-source` 分支节点存在
     - 如果冲突已解决并合并，应显示合并连线
   - **痛点解决**：通过图形追溯冲突来源分支，理解冲突原因

3. **合并提交信息验证**
   - 查看连线的详细信息（如果有工具提示）
   - 确认合并记录中包含提交哈希
   - **痛点解决**：可以追溯到具体的合并提交，查看合并详情

#### 痛点场景 6：大型项目的分支结构理解

**问题**：项目分支数量多（20+ 分支），难以理解整体分支结构和组织方式。

1. **创建多分支场景**
   ```powershell
   # 创建多个功能分支
   for ($i=1; $i -le 10; $i++) {
       git checkout -b feature/task-$i
       echo "task $i" > src/task$i.ts
       git commit -am "Task $i implementation"
       git checkout main
       if ($i % 2 -eq 0) {
           git merge feature/task-$i -m "Merge branch 'feature/task-$i'"
       }
   }
   ```

2. **验证力导向图布局**
   - 分支依赖图应使用 D3.js 力导向布局
   - 验证：
     - 节点自动排列，避免重叠
     - 有合并关系的分支节点靠近显示
     - 孤立分支节点自动分离
     - 布局美观，易于阅读
   - **痛点解决**：即使分支很多，也能通过合理布局理解结构

3. **交互功能验证**
   - **拖拽节点**：
     - 点击并拖拽任意分支节点
     - 验证节点可以自由移动
     - 验证连线跟随节点移动
     - **痛点解决**：可以手动调整布局，突出关注的分支
   
   - **缩放功能**：
     - 使用鼠标滚轮向上滚动（放大）
     - 使用鼠标滚轮向下滚动（缩小）
     - 验证缩放范围：0.1倍到4倍
     - **痛点解决**：可以放大查看细节，或缩小查看全局
   
   - **平移功能**：
     - 点击并拖拽空白区域（非节点区域）
     - 验证整个图形可以平移
     - **痛点解决**：可以查看图形的不同区域，不受画布限制

#### 痛点场景 7：识别过时和可清理的分支

**问题**：项目维护过程中，积累了很多已合并但未删除的分支，占用空间且造成混乱。

1. **验证已合并分支的可识别性**
   - 在分支依赖图中，已合并到主分支的功能分支应：
     - 有清晰的合并连线指向主分支
     - 节点仍然显示（方便识别）
   - **痛点解决**：一眼看出哪些分支已合并，可以安全删除

2. **识别长时间未更新的分支**
   - 结合时间线和分支依赖图：
     - 查看分支依赖图中的分支节点
     - 切换到“时间线”标签页查看最后提交时间
     - 识别长时间没有活动且已合并的分支
   - **痛点解决**：识别可清理的过时分支，保持仓库整洁

#### 痛点场景 8：空仓库和边界情况处理

**问题**：在不同仓库状态下，工具应能优雅处理边界情况。

1. **空仓库验证**
   - 在只有初始提交的仓库中（无分支合并）
   - 打开分支依赖图，验证：
     - 显示所有分支节点（即使没有合并关系）
     - 如果没有合并记录，只显示分支节点，无连线
     - 显示友好的空状态提示："暂无分支数据"（当完全没有分支时）

2. **单一分支验证**
   - 仓库中只有一个分支（如 `main`）
   - 验证图表正确显示单个节点
   - 无连线是正常情况，不应报错

3. **无合并历史验证**
   - 创建多个分支但从未合并
   - 验证：
     - 所有分支节点都显示
     - 没有任何连线（符合实际情况）
     - 图表布局正常，节点不重叠

#### 痛点场景 9：性能和数据刷新

**问题**：执行 Git 操作后，可视化界面应及时更新，反映最新状态。

1. **实时更新验证**
   - 在分支依赖图中记录初始状态（分支数量和连线）
   - 执行以下操作，验证图表自动刷新：
     - **创建新分支**：`git checkout -b feature/new`
       - 验证新分支节点立即出现在图中
     - **合并分支**：`git merge feature/new`
       - 验证合并连线立即显示
     - **删除分支**：`git branch -d feature/new`
       - 验证分支节点从图中移除
     - **切换分支**：`git checkout main`
       - 验证当前分支高亮立即更新

2. **刷新按钮验证**
   - 如果控制面板有手动刷新按钮
   - 点击刷新，验证分支依赖图数据重新加载
   - 验证刷新不会丢失当前的缩放和平移状态（如可能）

3. **大数据量性能**
   - 创建 50+ 分支和多个合并关系
   - 验证：
     - 图表加载时间 < 2 秒
     - 交互（拖拽、缩放）流畅，无明显卡顿
     - 节点标签清晰可读

#### 痛点场景 10：图例和用户引导

**问题**：新用户可能不理解图表的含义和交互方式。

1. **图例验证**
   - 在分支依赖图右下角，验证图例存在：
     - **当前分支**：蓝色实心圆（#4a90e2）
     - **其他分支**：蓝色圆（#569cd6）
     - **合并关系**：带箭头的蓝色线条
   - **痛点解决**：新用户可以通过图例快速理解图表含义

2. **交互提示验证**
   - 在图表下方或旁边，验证存在交互提示：
     - "💡 提示：可以拖拽节点调整布局，使用鼠标滚轮缩放，拖拽空白区域平移"
   - **痛点解决**：用户知道如何与图表交互，提升使用体验

3. **空状态提示**
   - 当没有分支数据时，验证显示友好提示：
     - "📊 暂无分支数据，请确保仓库中有分支信息"
   - **痛点解决**：明确告知用户当前状态，避免困惑

#### 验证清单

**基础功能**
- [ ] 所有分支节点正确显示
- [ ] 合并关系连线正确显示（箭头方向正确）
- [ ] 当前分支高亮标识正常
- [ ] 图例和提示信息清晰

**痛点解决验证**
- [ ] 能够快速识别已合并和未合并的分支
- [ ] 能够理解复杂的分支依赖链
- [ ] 当前分支状态一目了然
- [ ] 多人协作分支状态清晰可见
- [ ] 冲突分支可以追溯到来源
- [ ] 大型项目的分支结构易于理解
- [ ] 过时分支可以识别
- [ ] 边界情况处理优雅

**交互功能**
- [ ] 节点拖拽功能正常
- [ ] 缩放功能正常（鼠标滚轮）
- [ ] 平移功能正常（拖拽空白区域）
- [ ] 交互流畅，无卡顿

**性能和数据**
- [ ] Git 操作后图表实时更新
- [ ] 大数据量（50+ 分支）性能良好
- [ ] 刷新机制正常工作



### 2.6.4 测试冲突解决

> **测试目标**：验证冲突解决功能能有效解决程序员在 Git 合并中遇到的常见痛点，如冲突检测不及时、冲突标记难以理解、不知道选择哪个版本、容易遗漏冲突文件等。

#### 痛点场景 1：实时冲突检测和即时提醒

**问题**：执行 `git merge` 或 `git pull` 后，冲突不会自动提醒，需要手动执行 `git status` 才能发现，导致遗漏冲突。

1. **触发冲突并验证实时检测**
   ```powershell
   # 准备冲突场景
   git checkout main
   git checkout -b feature/user-profile
   echo "function getUser() { return 'Alice'; }" > src/user.ts
   git commit -am "Add user profile feature"
   
   git checkout main
   echo "function getUser() { return 'Bob'; }" > src/user.ts
   git commit -am "Update user function"
   
   # 执行合并，触发冲突
   git checkout feature/user-profile
   git merge main
   ```

2. **验证自动冲突检测**
   - **侧边栏自动更新**：
     - 合并命令执行后，侧边栏“冲突检测”视图应**立即**显示红色警告图标 ⚠️
     - 冲突文件列表自动出现在侧边栏，无需手动刷新
     - 文件图标显示为警告状态（红色/黄色）
   
   - **控制面板自动刷新**：
     - 切换到控制面板“冲突解决”标签页
     - 验证页面顶部显示："发现 X 个冲突文件"
     - 冲突文件列表立即显示，无需点击刷新按钮
   
   - **编辑器高亮提示**：
     - 打开包含冲突的文件（如 `src/user.ts`）
     - 验证冲突区域自动高亮显示（红色背景或边框）
     - 验证冲突标记行（`<<<<<<<`, `=======`, `>>>>>>>`）有特殊标识
   
   - **痛点解决**：无需手动检查，冲突立即可见，避免遗漏

3. **状态栏和通知验证**
   - 验证 VS Code 状态栏显示合并状态（如果有）
   - 验证是否弹出通知提示："发现 X 个冲突文件，需要解决"
   - 点击通知应跳转到冲突解决界面

#### 痛点场景 2：理解冲突标记和代码对比

**问题**：Git 的冲突标记（`<<<<<<< HEAD`, `=======`, `>>>>>>> branch`）对新手不友好，难以理解当前版本和传入版本的区别。

1. **创建清晰的冲突示例**
   ```powershell
   git checkout main
   git checkout -b feature/api-refactor
   # 在当前分支修改
   echo @"
   // API Configuration
   const API_URL = 'https://api.example.com';
   const TIMEOUT = 5000;
   "@ | Out-File -Encoding utf8 src/config.ts
   git commit -am "Refactor API config"
   
   git checkout main
   # 在主分支有不同修改
   echo @"
   // API Settings
   const API_URL = 'https://api.production.com';
   const TIMEOUT = 3000;
   "@ | Out-File -Encoding utf8 src/config.ts
   git commit -am "Update API settings"
   
   git checkout feature/api-refactor
   git merge main
   ```

2. **验证冲突编辑器显示**
   - 在控制面板“冲突解决”标签页，点击冲突文件 `src/config.ts`
   - 点击“打开文件”按钮，验证：
     - 文件在编辑器中打开
     - 冲突区域有清晰的视觉分隔
     - 冲突标记（`<<<<<<< HEAD`, `=======`, `>>>>>>> main`）可见
   
   - **痛点解决**：即使不熟悉 Git 标记，也能通过界面理解冲突结构

3. **验证三栏对比视图（如果有）**
   - 如果扩展提供了三栏对比视图（当前/传入/合并结果）
   - 验证：
     - 左侧显示"当前更改"（HEAD 版本）
     - 中间显示"传入更改"（要合并的分支版本）
     - 右侧显示合并结果预览
   - **痛点解决**：并排对比，清晰理解两个版本的差异

#### 痛点场景 3：快速选择保留哪个版本的代码

**问题**：手动编辑冲突标记容易出错，不知道应该选择当前版本还是传入版本，或者需要合并两者。

1. **验证快速解决选项**
   - 在冲突解决界面，点击冲突文件展开操作选项
   - 验证存在三个快速解决按钮：
     - **"接受当前更改"**（←）：保留本地/当前分支的修改
     - **"接受传入更改"**（→）：使用要合并分支的修改
     - **"接受所有更改"**（↕）：合并两个版本的内容
   
   - **痛点解决**：一键选择，无需手动删除冲突标记

2. **测试快速解决流程**
   ```powershell
   # 已有冲突的情况下
   # 在 VS Code 冲突解决界面
   ```
   - 选择一个冲突文件（如 `src/config.ts`）
   - 点击"接受传入更改"按钮
   - 验证：
     - 冲突标记自动删除
     - 文件内容变为传入版本
     - 文件自动保存
     - 控制面板中该文件从冲突列表移除或标记为"已解决"
   
   - **痛点解决**：无需手动编辑，降低出错概率

3. **验证按钮描述清晰**
   - 验证每个按钮有清晰的图标和文字说明
   - 验证按钮有悬停提示，说明操作的具体含义
   - **痛点解决**：即使是新手，也能理解每个选项的作用

#### 痛点场景 4：处理多个冲突文件时的追踪和管理

**问题**：合并时可能有多个文件发生冲突，容易遗漏某个文件的冲突，导致合并不完整。

1. **创建多文件冲突场景**
   ```powershell
   git checkout main
   git checkout -b feature/multi-file-conflict
   
   # 修改多个文件
   echo "version A" > src/file1.ts
   echo "version A" > src/file2.ts
   echo "version A" > src/file3.ts
   git commit -am "Multiple file changes"
   
   git checkout main
   echo "version B" > src/file1.ts
   echo "version B" > src/file2.ts
   echo "version B" > src/file3.ts
   git commit -am "Different changes"
   
   git checkout feature/multi-file-conflict
   git merge main
   ```

2. **验证冲突列表管理**
   - 在控制面板“冲突解决”标签页，验证：
     - 显示所有冲突文件列表（`file1.ts`, `file2.ts`, `file3.ts`）
     - 每个文件显示完整路径
     - 已解决的文件有标识（如绿色勾选标记）
     - 未解决的文件突出显示（如红色警告图标）
   
   - **痛点解决**：一目了然所有冲突文件，不会遗漏

3. **逐个解决验证**
   - 点击第一个冲突文件，选择"接受当前更改"
   - 验证该文件在列表中标记为"已解决"
   - 验证冲突计数更新（如"发现 2 个冲突文件"）
   - 继续解决剩余冲突，验证每个文件的解决状态独立追踪
   - **痛点解决**：清晰的进度追踪，知道还有多少冲突待解决

4. **批量操作验证（如果有）**
   - 如果支持批量操作，验证：
     - "全部接受当前更改"按钮（谨慎使用）
     - "全部接受传入更改"按钮
     - 批量操作的确认对话框
   - **痛点解决**：特定场景下可以快速处理大量冲突

#### 痛点场景 5：解决冲突后的标记和提交流程

**问题**：解决冲突后容易忘记执行 `git add` 标记为已解决，或不知道如何完成合并提交。

1. **验证标记已解决功能**
   - 解决一个冲突文件后，验证：
     - 文件从冲突列表移除，或显示"已解决"状态
     - 侧边栏冲突计数减少
     - 可以执行 **Git Assistant: 标记冲突已解决** 命令
     - 执行后，`git status` 显示文件在暂存区（已 add）

2. **验证完成合并流程**
   ```powershell
   # 所有冲突解决后
   # 在扩展中完成合并
   ```
   - 解决所有冲突文件后，验证：
     - 控制面板显示"所有冲突已解决"提示
     - 提供"完成合并"或"提交合并"按钮/命令
     - 执行后自动创建合并提交
     - 提交信息包含合并信息（如 "Merge branch 'feature/xxx' into main"）
   
   - **痛点解决**：明确的流程指引，不会卡在合并中间状态

3. **验证放弃合并功能**
   - 如果冲突太复杂，想放弃合并，验证：
     - 存在"放弃合并"或"中止合并"按钮/命令
     - 执行后自动执行 `git merge --abort`
     - 工作区恢复到合并前的状态
     - 冲突标记全部清除
   - **痛点解决**：提供回退选项，避免陷入混乱状态

#### 痛点场景 6：复杂冲突和嵌套冲突的处理

**问题**：同一个文件可能有多个冲突区域，或者冲突代码嵌套复杂，难以逐个处理。

1. **创建多段冲突场景**
   ```powershell
   git checkout main
   git checkout -b feature/complex-conflict
   
   # 文件中有多个函数，在不同位置都有冲突
   echo @"
   function func1() {
       return 'version A - func1';
   }
   function func2() {
       return 'version A - func2';
   }
   function func3() {
       return 'version A - func3';
   }
   "@ | Out-File -Encoding utf8 src/utils.ts
   git commit -am "Multiple functions"
   
   git checkout main
   echo @"
   function func1() {
       return 'version B - func1';
   }
   function func2() {
       return 'version B - func2';
   }
   function func3() {
       return 'version B - func3';
   }
   "@ | Out-File -Encoding utf8 src/utils.ts
   git commit -am "Different implementations"
   
   git checkout feature/complex-conflict
   git merge main
   ```

2. **验证多段冲突处理**
   - 打开冲突文件，验证：
     - 每个冲突区域独立高亮显示
     - 可以使用"接受当前/传入/所有更改"逐个解决每个冲突
     - 解决一个冲突后，其他冲突区域仍然可见
     - 所有冲突解决后，文件可以正常保存

3. **验证嵌套冲突**
   - 如果冲突代码包含嵌套结构（如嵌套函数、对象等）
   - 验证冲突标记正确识别嵌套范围
   - 验证解决选项能正确处理嵌套结构
   - **痛点解决**：复杂代码结构也能正确处理

#### 痛点场景 7：二进制文件和特殊文件冲突

**问题**：图片、PDF 等二进制文件发生冲突时，无法通过文本编辑器解决，需要特殊处理。

1. **创建二进制文件冲突**
   ```powershell
   git checkout main
   git checkout -b feature/add-image
   # 创建一个图片文件（模拟）
   "binary content version A" | Out-File -Encoding binary src/logo.png
   git add src/logo.png
   git commit -m "Add logo A"
   
   git checkout main
   "binary content version B" | Out-File -Encoding binary src/logo.png
   git add src/logo.png
   git commit -m "Add logo B"
   
   git checkout feature/add-image
   git merge main
   ```

2. **验证二进制文件处理**
   - 在冲突列表中看到 `src/logo.png`
   - 点击该文件，验证：
     - 显示提示："二进制文件冲突，请手动选择版本"
     - 提供选项："保留当前版本"或"使用传入版本"
     - 无法直接编辑文件内容（这是正常的）
   
   - **痛点解决**：明确提示二进制文件需要特殊处理，避免用户困惑

3. **验证其他特殊文件**
   - 测试 JSON、XML、YAML 等格式文件的冲突处理
   - 验证特殊字符（如中文、emoji）在冲突标记中的显示
   - 验证大文件（>1MB）的冲突检测性能

#### 痛点场景 8：冲突来源追溯和上下文理解

**问题**：发生冲突时，不知道冲突是从哪个分支来的，或者不知道两个版本的修改背景。

1. **验证冲突信息显示**
   - 在冲突解决界面，验证显示：
     - 当前分支名称（HEAD 指向的分支）
     - 要合并的分支名称
     - 冲突文件的路径
   
   - **痛点解决**：清楚知道冲突的来源，便于决策

2. **验证提交信息追溯（如果有）**
   - 如果支持，验证可以查看：
     - 当前版本的提交信息和作者
     - 传入版本的提交信息和作者
     - 冲突引入的提交哈希
   - **痛点解决**：了解修改背景，做出更好的合并决策

3. **结合分支依赖图验证**
   - 切换到"分支依赖"标签页
   - 验证可以看到当前合并操作涉及的分支
   - 验证分支关系图能显示合并进行中的状态
   - **痛点解决**：在更大的上下文中理解冲突

#### 痛点场景 9：冲突解决后的验证和测试

**问题**：解决冲突后不确定是否正确，担心破坏了代码逻辑或引入了 bug。

1. **验证解决后的状态检查**
   - 所有冲突解决后，验证：
     - 文件可以正常保存
     - 没有残留的冲突标记（`<<<<<<<`, `=======`, `>>>>>>>`）
     - `git status` 显示文件在暂存区
     - 可以正常编译或运行语法检查（如果配置了）

2. **验证合并提交创建**
   - 完成合并后，验证：
     - 创建了合并提交
     - 提交信息正确
     - 提交历史中可以看到合并记录
     - 可以查看合并提交的详细信息

3. **验证回退机制**
   - 如果发现解决有误，验证可以：
     - 查看合并提交的差异（`git show`）
     - 如果需要，可以撤销合并提交（`git reset --hard HEAD~1`）
     - 重新开始合并流程
   - **痛点解决**：提供验证和回退路径，降低风险

#### 痛点场景 10：团队协作中的冲突预防和处理

**问题**：多人同时修改同一文件时容易产生冲突，需要提前了解潜在的冲突风险。

1. **验证冲突预防提示（如果有）**
   - 在拉取远程更改前，验证是否有提示：
     - "远程分支有新的提交，可能导致冲突"
     - 显示哪些文件在本地和远程都有修改
   
   - **痛点解决**：提前了解潜在冲突，做好准备

2. **验证合并前的预览（如果有）**
   - 执行合并前，验证是否可以预览：
     - 将要合并的提交列表
     - 可能受影响的文件列表
     - 预估的冲突文件
   
   - **痛点解决**：合并前评估影响，减少意外

3. **验证协作场景**
   ```powershell
   # 模拟团队协作
   # 开发者 A 的修改
   git checkout main
   git checkout -b alice/feature
   echo "Alice's code" > src/app.ts
   git commit -am "Alice's changes"
   git push origin alice/feature
   
   # 开发者 B 在本地修改同一文件
   git checkout main
   echo "Bob's code" > src/app.ts
   git commit -am "Bob's changes"
   
   # B 尝试合并 A 的分支
   git merge alice/feature
   ```
   - 验证冲突检测能正确识别团队协作场景
   - 验证解决冲突后，可以继续协作流程
   - **痛点解决**：支持团队协作的完整流程

#### 验证清单

**基础功能**
- [ ] 冲突检测实时且准确
- [ ] 冲突列表清晰显示所有冲突文件
- [ ] 冲突编辑器功能完整
- [ ] 快速解决选项（当前/传入/所有）正常工作
- [ ] 标记已解决功能正常
- [ ] 完成合并流程顺畅

**痛点解决验证**
- [ ] 无需手动检查，冲突立即可见
- [ ] 冲突标记清晰易懂
- [ ] 可以快速选择保留哪个版本
- [ ] 多个冲突文件不会遗漏
- [ ] 解决后流程清晰，不会卡住
- [ ] 复杂冲突也能正确处理
- [ ] 二进制文件有特殊处理
- [ ] 冲突来源信息清晰
- [ ] 解决后可以验证正确性
- [ ] 支持团队协作场景

**边界情况**
- [ ] 空冲突文件处理
- [ ] 只有空白字符差异的冲突
- [ ] 非常大的冲突文件性能
- [ ] 合并中止后的状态恢复
- [ ] 同时打开多个冲突文件的处理

**用户体验**
- [ ] 界面友好，提示清晰
- [ ] 操作流程符合直觉
- [ ] 错误提示有帮助性
- [ ] 性能良好，无明显延迟

### 2.6.3 测试提交历史与分析

- 提交列表显示最近变更，作者、时间、哈希准确
- 2D 提交图谱可缩放、hover，颜色与节点正常
- 时间线视图显示日历热区并同步柱状图
- 热力图/分支依赖图数据显示与仓库一致

### 2.6.4 测试标签管理

- **Git Assistant: 创建标签** → 创建带注释或轻量标签
- **Git Assistant: 查看标签列表** → 显示新标签详情
- **Git Assistant: 删除标签** → 移除目标标签并提示成功

## 2.7 场景化端到端测试

1. **初始化与激活**
   - 在空目录执行 `code .` 并安装 Git Assistant
   - 通过命令面板运行 **Git Assistant: 初始化仓库**，确认自动生成 `.git` 与 `README.md`
   - 输出通道应出现“扩展已激活/仓库已初始化”日志

2. **远程配置闭环**
   - 运行 **Git Assistant: 添加远程**，输入临时裸仓库地址（可 `git init --bare`）
   - 执行 **Git Assistant: 初始提交**，确认创建 `feat/initial-setup` 分支并推送成功
   - 在侧边栏检查“快捷指令历史”是否记录上述操作，可点击重放

3. **日常开发流程**
   - 创建文件 `src/app.ts` 并修改内容
   - 使用命令面板执行 **Git Assistant: 暂存当前文件** 与 **Git Assistant: 创建提交**
   - 在控制面板“Git 指令集”中执行 `git push origin HEAD`
   - 验证分支视图与提交历史实时刷新

4. **多人协作模拟**
   - 在外部终端向远程新增提交（模拟同事推送），再在扩展中执行 **快速拉取**
   - 确认通知提示成功且历史面板出现远程提交
   - 检查“分支依赖”视图是否更新

5. **功能性交叉验证**
   - 新建 `feature/scenario-test` 分支
   - 在“快捷指令”中依次执行：创建分支 → 切换分支 → 合并分支
   - 记录每一步的 toast/日志，确认提示信息符合预期

6. **冲突与恢复**
   - 参考第 2.8 节制造冲突并解决
   - 回到主分支后执行 **Git Assistant: 创建标签**（如 `v0.1-scenario`）
   - 在标签管理列表验证新标签存在，再执行删除验证清理能力

7. **异常演练**
   - 刻意让推送失败（如断网或错误凭证），检查错误提示是否引导用户查看日志
   - 在非 Git 目录运行任意 Git Assistant 命令，确认提示“请先初始化仓库”

8. **收尾**
   - 运行 **Git Assistant: 打开控制面板**，逐个检查 8 个标签页的交互情况
   - 使用验证清单勾选全部项目，并截图或记录日志作为回归凭证

# 3. 调试技巧

## 3.1 断点调试

```ts
context.subscriptions.push(
  vscode.commands.registerCommand('git-assistant.quickPush', async () => {
    debugger; // 在此设置断点
  })
);
```

## 3.2 调试控制台

- 查看 `console.log` 输出
- 执行表达式检查变量值

## 3.3 日志查看

- `Ctrl+Shift+U` → Git Assistant 日志
- 菜单：帮助 → 切换开发人员工具 → Console

## 3.4 Webview 调试

- 打开控制面板
- 右键 Webview → “打开开发者工具”
- 使用 Chrome DevTools 进行排查

# 4. 验证清单

**基础**

- [ ] 扩展激活（输出日志提示成功）
- [ ] 侧边栏显示分支/历史/冲突视图
- [ ] 命令面板列出所有 Git Assistant 命令
- [ ] 快捷键 `Ctrl+Alt+P/L/B` 正常
- [ ] 控制面板可加载

**功能覆盖**

- [ ] 控制面板 8 个标签内容与顺序正确
- [ ] Git 指令集与快捷指令历史面板可用
- [ ] 快捷指令历史可重新执行任一命令
- [ ] 标签管理命令覆盖创建/列表/删除
- [ ] “初始化仓库 → 添加远程 → 初始提交” 可在空目录闭环执行

**Git 操作**

- [ ] 查看状态、切换/创建/合并分支
- [ ] 拉取/推送操作成功
- [ ] 提交历史列表展示完整信息
- [ ] 冲突检测在有冲突时提示并可打开冲突解决器

**UI**

- [ ] 分支树正确标记当前/远程分支
- [ ] 2D 提交图谱、热力图、分支依赖图、时间线视图数据正确
- [ ] 控制面板按钮、刷新与操作提示正常

**错误处理**

- [ ] 非 Git 仓库时提示初始化
- [ ] Git 操作失败时展示错误信息
- [ ] 网络/认证错误打印日志且不中断扩展

# 5. 常见问题

| 问题           | 排查思路                                                     |
| -------------- | ------------------------------------------------------------ |
| 扩展未激活     | 确认 `workspaceContains:.git` 生效、当前文件夹包含 `.git`，或执行初始化 |
| 命令不可用     | 可能不在 Git 仓库内，先运行 `git init` 或 Git Assistant: 初始化仓库 |
| 侧边栏图标丢失 | 右键活动栏 → 勾选 **Git Assistant**                          |
| Webview 空白   | 重新编译 `npm run compile`，确保 `dist/webview/webview.js` 存在 |
| TS 类型错误    | 执行 `npm install --save-dev @types/vscode @types/node`      |

# 6. 参考与附录

**调试输出示例**

```
[Extension Host] Git Assistant 扩展已激活
[Git Assistant] INFO: 开始执行快速推送
```

**性能验证指标**

- Extension Host 启动 < 500 ms
- 内存占用 < 50 MB

**下一步**

- 参阅 `docs/DEVELOPMENT.md`
- 在 `src/` 中修改功能
- 编写测试 / 优化性能
- `vsce package` 打包

**需要帮助？**

1. `Ctrl+Shift+U` → Git Assistant 日志
2. VS Code 开发者工具 Console
3. 文档：`README_CN.md` / `docs/DEVELOPMENT.md`

调试愉快！🎉