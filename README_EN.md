# Gitly — Powerful Git Visualizer & Assistant for VS Code

<div align="center">
  <img src="resources/icon.png" alt="Gitly Icon" width="200" />
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

> Gitly is a Git history visualizer and assistant extension for VS Code. Through graph views, sidebar tree lists, and Webview control panels, Gitly digitizes all Git workflows with **English / Simplified Chinese** bilingual support.

![Recording of Gitly](https://github.com/YIXUAN-oss/Gitly/raw/master/resources/demo.gif)

## 🔍 Project Overview

- **Status**: v1.1.0 released on 2025-12-19; actively maintained
- **Core Scenarios**: Commit graph view, branch management, conflict detection, quick commands & control panel
- **Tech Stack**: TypeScript, VS Code Extension API, Native DOM + SVG/Canvas, Node.js child_process
- **Performance Metrics**:
  - Extension activation < 500ms
  - Basic panel data refresh < 400ms
  - Large repository statistics (heatmap/timeline) refresh < 1.5s
- **Language Support**: `en` / `zh-CN` (VS Code settings + Webview text)

## ✨ Core Features

### 1. Git Commit Graph (Gitly View)

Gitly's core feature provides an interactive Git commit history visualization to help developers intuitively understand code evolution.

**Visualization Features:**
- **Commit Graph Rendering**: Uses native SVG/Canvas technology to draw branch graphs, supporting rounded/angular styles
- **Complete Data Display**: Simultaneously displays branches, tags, HEAD, stashes, uncommitted changes, and all Git states
- **Smart Layout Algorithm**: Custom branch layout algorithm that automatically calculates commit node positions, avoiding branch crossings
- **Color System**: Each branch uses a different color identifier, supporting customizable 12-color schemes

**Interactive Features:**
- **Rich Context Menu**: Right-click commits/branches/tags to execute checkout, merge, rebase, cherry-pick, push, pull, reset, delete, rename, etc.
- **Dual Commit Comparison**: `Ctrl/Cmd + Click` to select two commits for comparison, automatically opens VS Code Diff view
- **Hover Tooltips**: Mouse hover shows branch ownership, commit details, author information
- **Emoji Support**: Automatically recognizes and renders gitmoji emojis, making commit messages more vivid
- **File Review**: Mark reviewed files, supporting code review workflows
- **Quick Navigation**: Keyboard shortcuts to quickly locate HEAD and stash positions

**Commit Details View:**
- **Inline/Bottom Docked**: Supports inline display or bottom docking for commit details view
- **File Tree/List View**: Choose between file tree or list view for displaying commit files
- **Diff Preview**: Click files to directly view changes, supports opening full Diff editor
- **Commit Message Parsing**: Supports Markdown-formatted commit message rendering

### 2. Sidebar Views (Activity Bar)

Gitly provides four dedicated views in the VS Code sidebar for quick access to common Git information.

**Branches View:**
- Tree structure displaying all local and remote branches
- Highlights the currently checked-out branch
- Right-click menu supports quick checkout, delete, merge, rename branches
- Supports checking out remote branches as local branches

**History View:**
- Displays commit history in chronological order
- Shows commit hash, author, date, commit message
- Click commits to view details or open commit graph
- Supports filtering by author, date range

**Staged View:**
- Real-time display of staged file list
- Integrates with VS Code Git API, automatically monitors staged area changes
- Supports unstaging, viewing file changes
- Shows file status (new, modified, deleted)

**Conflicts View:**
- Automatically detects merge conflicts
- Lists all conflicted files
- Quick jump to conflicted files for resolution
- Shows conflict status and resolution progress

### 3. Git Assistant Panel (Assistant Webview)

Gitly provides a feature-rich visual control panel implemented through Webview technology, containing 9 functional tabs.

**📋 Quick Commands:**
- **Command Grouping**: Intelligently groups available commands by repository state
  - Initialization: Initialize repository, clone repository, add remote
  - Remote Configuration: Add/edit/delete remotes, set default push remote
  - Branch/Tag Management: Create, switch, merge, delete branches and tags
  - Sync Operations: Push, pull, fetch updates
  - Conflict Resolution: Detect and resolve merge conflicts
- **Command History**: Records all executed commands, including:
  - Command name and execution time
  - Execution status (success/failure)
  - Execution duration
  - Support for copying commands or re-executing
- **State Awareness**: Dynamically shows/hides unavailable commands based on current repository state
- **Quick Actions**: One-click execution of common Git operations without memorizing commands

**📚 Git Command Reference:**
- Complete Git command reference manual
- Categorized display of common Git commands
- Each command includes description, parameters, examples
- Supports search and filtering

**☁️ Remote Manager:**
- **Remote List**: Table display of all remote repositories
- **Remote Operations**:
  - Add new remote (supports HTTPS/SSH)
  - Edit remote URL
  - Delete remote
  - Set default push remote
- **Quick Access**: Click remote URL to open in browser
- **Status Display**: Shows remote branch sync status

**🌿 Branch Manager:**
- **Branch Tree View**: Visual display of branch relationship tree
- **Branch Operations**:
  - Create new branch (supports creating from current branch or specified commit)
  - Switch branch (supports checking out remote branches)
  - Merge branch (supports multiple merge strategies)
  - Delete branch (local/remote)
  - Rename branch
- **Branch Information**: Shows latest commit, upstream tracking information
- **Branch Status**: Identifies current branch, merged branches, unpushed branches

**🏷️ Tag Manager:**
- **Tag List**: Table display of all tags
- **Tag Operations**:
  - Create tag (supports lightweight and annotated tags)
  - Delete tag (local/remote)
  - Push tag to remote
  - Batch push all tags
- **Tag Details**: Shows commit pointed to by tag, creator, creation time

**⚠️ Conflict Resolver:**
- **Three-Column Comparison View**:
  - Left: Current branch version (ours)
  - Center: Merge result preview
  - Right: Merge branch version (theirs)
- **Resolution Strategies**:
  - Accept current version
  - Accept merge version
  - Accept both (manual editing)
  - Undo resolution
- **Conflict History**: Records resolved conflicts, supports viewing and re-resolving
- **Batch Operations**: Supports batch acceptance strategies

**📊 Commit Graph:**
- Simplified commit graph embedded in control panel
- Canvas rendering, performance optimized
- Supports clicking commits to view details
- Shows branch relationships and merge points

**📅 Timeline View:**
- **Commit Timeline**: Displays commit history on timeline
- **Contributor Activity**: Statistics on each contributor's commit frequency
- **Commit Peaks**: Identifies peak periods of code commits
- **Visual Charts**: Uses Canvas to draw timeline charts

**🔥 Heatmap Analysis:**
- **File Modification Heatmap**: Shows file modification frequency and hotspots
- **Commit Heatmap**: Displays commit density by date
- **Contributor Heatmap**: Shows activity distribution of contributors
- **Color Encoding**: Uses color intensity to represent activity level

### 4. Smart Experience

**Command History Tracking:**
- All Git operations are recorded in command history
- Records command name, parameters, execution time, status, duration
- Supports viewing history, copying commands, re-executing
- History data persisted storage

**Safety Check Mechanism:**
- Detects unsaved files before executing push/pull
- Prompts for uncommitted changes before switching branches
- Provides automatic stash option
- Dangerous operations (like force push, hard reset) require confirmation

**Performance Optimization:**
- **Parallel Data Refresh**: Uses `Promise.allSettled` to update multiple data sources simultaneously
- **Smart Debouncing**: Webview communication and file watching use 300ms debouncing
- **Incremental Loading**: Git graph initially loads only 300 commits, automatically loads more on scroll
- **On-Demand Loading**: Commit details loaded on demand, reducing initial load time
- **Caching Mechanism**: Caches Git command results to avoid repeated execution

**File Watch Optimization:**
- Only watches critical files: `.git/HEAD` and `refs/heads/**`
- 300ms debouncing to avoid frequent refreshes
- Intelligently determines changes, only refreshes necessary data

**Error Handling:**
- Single command failure doesn't affect other features
- Automatically falls back to default data
- Detailed error message prompts
- Supports retrying failed operations

## 🚀 Installation & Quick Start

### 🎯 Install from VS Code Marketplace

1. Open VS Code, press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS) to open Extensions view
2. Search for "Gitly" in the search box
3. Click the Install button
4. Restart VS Code after installation (recommended)

> 💡 **Tip**: If you've downloaded a `.vsix` file, you can click the "..." menu in the Extensions view and select "Install from VSIX..." to install.

### 💻 Build from Source

```bash
# Clone repository
git clone https://github.com/YIXUAN-oss/Gitly.git
cd Gitly

# Install dependencies
npm install

# Compile project (compile backend TypeScript and Webview)
npm run compile

# Package as VSIX file
npm run package
```

> 📦 After compilation, a `gitly-1.1.0.vsix` file will be generated in the project root directory, which can be installed via VS Code command "Extensions: Install from VSIX...".

### ⚙️ Quick Experience

1. **Open Git Repository**
   - Open a folder containing a Git repository in VS Code
   - If there's no repository, you can run the command `Gitly: Initialize Repository` to create a new one

2. **View Sidebar Views**
   - Click the Gitly icon in the Activity Bar (left sidebar)
   - View the four views: branches, history, staged, conflicts

3. **Open Commit Graph**
   - Run command `Gitly: View Gitly (git log)` via Command Palette (`Ctrl+Shift+P`)
   - Or click the "Open Git Graph" button in the sidebar view

4. **Use Control Panel**
   - Run command `Gitly: Open Visual Panel` or click the assistant icon in the sidebar
   - Experience quick commands, remote management, branch management, etc.

5. **Common Shortcuts**
   - `Ctrl+Alt+P` (Windows/Linux) or `Cmd+Alt+P` (macOS): Quick push
   - `Ctrl+Alt+L` (Windows/Linux) or `Cmd+Alt+L` (macOS): Quick pull
   - `Ctrl+Alt+B` (Windows/Linux) or `Cmd+Alt+B` (macOS): Quick switch branch

## 📚 Command Reference

Gitly provides rich commands covering all aspects of Git operations:

| Command | Shortcut | Description |
| --- | --- | --- |
| **Gitly: View Gitly (git log)** | - | Open Git commit graph view |
| **Gitly: Open Visual Panel** | - | Open Assistant Webview control panel |
| **Gitly: Quick Push** | `Ctrl+Alt+P` | Quickly push current branch to remote |
| **Gitly: Quick Pull** | `Ctrl+Alt+L` | Quickly pull remote updates |
| **Gitly: Switch Branch** | `Ctrl+Alt+B` | Quickly switch branch |
| **Gitly: Initialize Repository** | - | Initialize new Git repository |
| **Gitly: Clone Repository** | - | Clone remote repository to local |
| **Gitly: Add Remote** | - | Add new remote repository |
| **Gitly: Edit Remote** | - | Edit existing remote repository URL |
| **Gitly: Delete Remote** | - | Delete remote repository |
| **Gitly: Stage Changes** | - | Add files to staging area |
| **Gitly: Unstage** | - | Remove files from staging area |
| **Gitly: Commit Staged Changes** | - | Commit staged files |
| **Gitly: Commit All Changes** | - | Commit all changes (including unstaged) |
| **Gitly: Undo Last Commit** | - | Undo last commit |
| **Gitly: Create Branch** | - | Create new branch |
| **Gitly: Merge Branch** | - | Merge specified branch into current branch |
| **Gitly: Rename Branch** | - | Rename branch |
| **Gitly: Delete Branch** | - | Delete branch |
| **Gitly: Create Tag** | - | Create new tag |
| **Gitly: Delete Tag** | - | Delete tag |
| **Gitly: Push Tag** | - | Push tag to remote |
| **Gitly: Resolve Merge Conflicts** | - | Open conflict resolver |

## 🧰 Tech Stack & Architecture

### Core Tech Stack

**Backend (Extension Host):**
- **TypeScript 5.9+**: Strict type system ensuring code quality and maintainability
- **VS Code Extension API 1.107+**: Uses VS Code extension API to implement commands, views, Webview, etc.
- **Node.js child_process**: Directly executes Git CLI commands via `spawn`, no dependency on third-party Git libraries
- **iconv-lite**: Handles character encoding conversion for Git output, supports multiple encoding formats

**Frontend (Webview):**
- **Native DOM API**: No frontend frameworks, directly uses native DOM operations for optimal performance
- **TypeScript**: Webview code also written in TypeScript for type safety
- **SVG/Canvas**: Git graph uses SVG to draw branch lines, Canvas to draw commit nodes for high-performance rendering
- **CSS3**: Uses modern CSS features for styling and animations

**Build Tools:**
- **TypeScript Compiler**: Directly uses `tsc` to compile TypeScript code
- **vsce**: VS Code extension packaging tool, generates `.vsix` files
- **Jest + ts-jest**: Unit testing framework covering core business logic

**Development Tools:**
- **ESLint**: Code quality checking using TypeScript ESLint rules
- **Git**: Version control (of course!)

### Architecture Design

```
Gitly Extension Architecture
├── Extension Host (Node.js Backend)
│   ├── src/
│   │   ├── extension.ts              # Extension entry, registers commands and views
│   │   ├── dataSource.ts             # Git command execution layer, encapsulates all Git operations
│   │   ├── repoManager.ts            # Repository management, monitors file changes
│   │   ├── gitGraphView.ts           # Git graph view panel management
│   │   ├── assistantPanel.ts         # Assistant Webview panel management
│   │   ├── commands.ts                # Git graph view command handling
│   │   ├── assistantCommands.ts      # Assistant panel command handling
│   │   ├── sidebarViews.ts           # Sidebar TreeDataProvider
│   │   ├── avatarManager.ts          # Avatar management (GitHub/GitLab/Gravatar)
│   │   ├── diffDocProvider.ts        # Diff document provider
│   │   ├── statusBarItem.ts          # Status bar item
│   │   ├── config.ts                 # Configuration management
│   │   ├── logger.ts                 # Logging system
│   │   ├── extensionState.ts         # Extension state persistence
│   │   ├── assistantCommandHistory.ts # Command history management
│   │   ├── conflictHistory.ts       # Conflict resolution history
│   │   ├── repoFileWatcher.ts       # File watcher
│   │   └── utils/                    # Utility functions
│   │       ├── event.ts              # Event system
│   │       ├── disposable.ts        # Resource cleanup
│   │       └── bufferedQueue.ts     # Buffered queue
│   │
│   └── out/                          # Compiled JavaScript
│
├── Webview (Browser Environment)
│   ├── web/
│   │   ├── main.ts                   # Git graph view main logic
│   │   ├── graph.ts                  # Git graph rendering engine (SVG/Canvas)
│   │   ├── contextMenu.ts            # Context menu
│   │   ├── dialog.ts                 # Dialog component
│   │   ├── dropdown.ts               # Dropdown menu component
│   │   ├── findWidget.ts             # Search component
│   │   ├── settingsWidget.ts        # Settings component
│   │   ├── textFormatter.ts         # Text formatting (Markdown, Emoji)
│   │   ├── utils.ts                  # Webview utility functions
│   │   │
│   │   └── assistant/                # Assistant panel
│   │       ├── app.ts                # Assistant application main class
│   │       ├── i18n.ts               # Internationalization
│   │       ├── types/                 # Type definitions
│   │       ├── components/           # Feature components
│   │       │   ├── command-history.ts      # Command history component
│   │       │   ├── git-command-reference.ts # Git command reference component
│   │       │   ├── remote-manager.ts        # Remote manager component
│   │       │   ├── branch-tree.ts           # Branch tree component
│   │       │   ├── tag-manager.ts           # Tag manager component
│   │       │   ├── conflict-editor.ts       # Conflict editor component
│   │       │   ├── commit-graph.ts          # Commit graph component
│   │       │   ├── timeline-view.ts         # Timeline view component
│   │       │   └── heatmap-analysis.ts      # Heatmap analysis component
│   │       ├── utils/                # Assistant utility functions
│   │       └── styles/               # Style files
│   │
│   └── media/                        # Compiled Webview resources
│
└── Tests
    └── tests/                        # Jest test files
```

### Data Flow & Communication

**1. Command Execution Flow:**
```
User Action (command/click)
  ↓
VS Code Command API
  ↓
Extension Host (commands.ts / assistantCommands.ts)
  ↓
DataSource (dataSource.ts)
  ↓
child_process.spawn('git', [...args])
  ↓
Parse Git Output
  ↓
Return Structured Data
  ↓
Update UI (Webview / Sidebar)
```

**2. Webview Communication:**
```
Extension Host                    Webview
     │                               │
     │── postMessage(gitData) ──────>│
     │                               │ Render UI
     │                               │
     │<── postMessage(command) ──────│
     │                               │
     │ Execute Git Command            │
     │                               │
     │── postMessage(result) ───────>│
     │                               │ Update UI
```

**3. File Watch Mechanism:**
```
File System Changes
  ↓
repoFileWatcher.ts (watch .git/HEAD, refs/heads/**)
  ↓
300ms Debounce
  ↓
Trigger Refresh Event
  ↓
repoManager.refresh()
  ↓
Update All Views (Sidebar + Webview)
```

### Git Command Execution Layer (DataSource)

The `DataSource` class is Gitly's core, responsible for executing all Git commands and parsing results:

**Core Methods:**
- `spawnGit()`: Low-level Git command execution using `child_process.spawn`
- `getCommits()`: Get commit list, parse `git log` output
- `getCommitDetails()`: Get commit details, including file changes
- `getBranches()`: Get branch list (local + remote)
- `getRemotes()`: Get remote repository list
- `getTags()`: Get tag list
- `getStashes()`: Get stash list
- `checkoutBranch()`: Switch branch
- `mergeBranch()`: Merge branch
- `pushBranch()`: Push branch
- `pullBranch()`: Pull updates
- ... 100+ Git operation methods

**Features:**
- **Error Handling**: Unified error message format for easy UI display
- **Encoding Handling**: Uses `iconv-lite` to handle different encodings of Git output
- **Askpass Support**: Integrates Git credential helper, supports HTTPS authentication
- **Command Caching**: Caches some command results to improve performance
- **Logging**: All Git commands logged for debugging

### Git Graph Rendering Engine (Graph)

The `Graph` class is responsible for visualizing Git commit graphs:

**Rendering Process:**
1. **Data Preparation**: Receives commit list, builds commit relationship graph
2. **Layout Calculation**: Uses custom algorithm to calculate X/Y coordinates for each commit
3. **Branch Assignment**: Assigns colors and positions for each branch
4. **Path Calculation**: Calculates connection paths between branches (supports rounded/angular)
5. **SVG Drawing**: Uses SVG `<path>` to draw branch lines
6. **Canvas Drawing**: Uses Canvas to draw commit nodes (circles)
7. **Interaction Handling**: Handles click, hover, selection interactions

**Layout Algorithm:**
- Topology-based layout algorithm
- Automatically avoids branch crossings
- Supports dynamic adjustment when expanding commit details
- Optimized performance for large repositories (virtual scrolling)

### Assistant Panel Architecture

The Assistant panel uses a componentized architecture, with each functional module as an independent component:

**Component Communication:**
- All components managed uniformly through `App` class
- Components communicate through events or data sharing
- Uses TypeScript interfaces to define data contracts

**State Management:**
- Uses VS Code Webview State API for state persistence
- Tab switching state, scroll position, etc. are saved
- Supports restoring last used tab

**Internationalization:**
- Uses `i18n.ts` to uniformly manage multiple languages
- Supports dynamic language switching
- Automatically selects based on VS Code language settings

### Performance Optimization Strategies

**1. Data Loading Optimization:**
- **Initial Load**: Git graph initially loads only 300 commits (configurable)
- **Incremental Load**: Automatically loads more commits when scrolling to bottom
- **On-Demand Load**: Commit details loaded on demand, doesn't block initial rendering
- **Caching**: Caches Git command results to avoid repeated execution

**2. Rendering Optimization:**
- **Virtual Scrolling**: Only renders commits in visible area
- **Canvas Optimization**: Uses offscreen Canvas for pre-rendering
- **SVG Optimization**: Merges paths, reduces DOM nodes
- **Debouncing/Throttling**: All user interactions use debouncing/throttling

**3. Communication Optimization:**
- **Batch Updates**: Merges multiple data updates into one message
- **Incremental Updates**: Only sends changed data
- **Message Queue**: Uses buffered queue to handle high-frequency messages

**4. File Watch Optimization:**
- **Precise Watching**: Only watches critical files (`.git/HEAD`, `refs/heads/**`)
- **Debouncing**: 300ms debouncing to avoid frequent refreshes
- **Smart Detection**: Only refreshes changed parts

### Extensibility Design

**1. Configuration-Driven:**
- All behaviors controllable through VS Code configuration items
- Supports workspace-level and user-level configuration
- Configuration changes take effect automatically without restart

**2. Message-Driven Architecture:**
- Extension Host and Webview communicate via `postMessage`
- Standardized message format, easy to extend
- Supports adding new message types and commands

**3. Componentized Design:**
- Assistant panel components are independent, easy to add new features
- Each component has clear interface definitions
- Supports component reuse and composition

**4. Plugin Support:**
- Command system supports registering custom commands
- View system supports adding new sidebar views
- Webview supports adding new tabs

## ⚙️ Recommended Configuration

Gitly provides rich configuration options. Here are some recommended configurations:

```json
{
  // Git graph view configuration
  "gitly.repository.commits.initialLoad": 300,
  "gitly.repository.commits.loadMore": 100,
  "gitly.repository.commits.loadMoreAutomatically": true,
  "gitly.repository.showRemoteBranches": true,
  "gitly.repository.showTags": true,
  "gitly.repository.showStashes": true,
  "gitly.repository.showUncommittedChanges": true,
  
  // Commit details view configuration
  "gitly.commitDetailsView.location": "Inline",
  "gitly.commitDetailsView.fileView.type": "File Tree",
  "gitly.commitDetailsView.autoCenter": true,
  
  // Graph style configuration
  "gitly.graph.style": "rounded",
  "gitly.graph.colours": [
    "#0085d9", "#d9008f", "#00d90a", "#d98500",
    "#a300d9", "#ff0000", "#00d9cc", "#e138e8",
    "#85d900", "#dc5b23", "#6f24d6", "#ffcc00"
  ],
  
  // Date format configuration
  "gitly.date.format": "Date & Time",
  "gitly.date.type": "Author Date",
  
  // Avatar configuration
  "gitly.repository.commits.fetchAvatars": false,
  
  // Other configuration
  "gitly.retainContextWhenHidden": true,
  "gitly.showStatusBarItem": true
}
```

## 🏗️ Development & Build

### Development Environment Setup

```bash
# 1. Clone repository
git clone https://github.com/YIXUAN-oss/Gitly.git
cd Gitly

# 2. Install dependencies
npm install

# 3. Compile project
npm run compile

# 4. Start development mode (watch file changes)
npm run watch:src         # Watch backend code
npm run watch:web        # Watch Webview code
npm run watch:assistant   # Watch Assistant code
```

### Build Commands

```bash
# Compile all code (backend + Webview)
npm run compile

# Compile backend only
npm run compile-src

# Compile Webview only
npm run compile-web

# Package as VSIX file
npm run package

# Package and auto-install
npm run package-and-install
```

### Testing

```bash
# Run all tests
npm test

# Run tests and generate coverage report
npm run test-and-report-coverage

# Compile test code
npm run compile-tests

# Watch mode for tests
npm run watch-tests
```

### Code Quality

```bash
# Run ESLint check
npm run lint

# Generate ESLint JSON report
npm run lint:json
```

### Debugging

1. **Debug Extension Host:**
   - Open project in VS Code
   - Press `F5` to start debugging
   - Opens a new VS Code window (Extension Development Host)
   - Test extension features in the new window

2. **Debug Webview:**
   - Open Webview in Extension Development Host
   - Right-click Webview, select "Inspect"
   - Use browser developer tools to debug

## 🧩 Documentation & Resources

- **`README.md`**: Chinese version documentation
- **`CONTRIBUTING.md`**: Contribution guide including development process, code standards, etc.
- **`CODE_OF_CONDUCT.md`**: Code of Conduct
- **`CHANGELOG.md`**: Detailed changelog recording changes for each version
- **`LICENSE`**: MIT License

## 📌 Roadmap (Planned)

### v1.2.0 (Planned)
- AI-assisted conflict resolution suggestions
- Collaboration templates and code review workflows
- Custom quick command configuration
- Enhanced commit message templates

### v1.3.0 (Planned)
- Interactive Rebase assistant
- Commit convention checking (Conventional Commits)
- Smart conflict prevention tips
- Performance analysis and optimization suggestions

### v1.4.0 (Planned)
- PR/MR preview and creation
- Smart rollback suggestions
- Git submodule management
- Multi-repository workflow support

### v1.5.0+ (Future)
- Unified multi-repository management interface
- Code impact analysis tools
- Performance report export
- Team collaboration statistics

## 📝 License & Acknowledgements

- **License**: MIT License (see `LICENSE` file)

- **Acknowledgements**:
  - **Git Graph**: Gitly is based on the excellent [Git Graph](https://github.com/mhutchie/vscode-git-graph) project, thanks to the original project authors and all contributors
  - **Icon Resources**:
    - [Octicons](https://primer.style/octicons/) - GitHub official icon library
    - [Icons8](https://icons8.com/) - Icon resources
  - **Open Source Community**: Thanks to all users who submitted Issues, PRs, and feedback

## 📮 Contact Us

- **Issues & Feature Requests**: <https://github.com/YIXUAN-oss/Gitly/issues>
- **Discussions**: <https://github.com/YIXUAN-oss/Gitly/discussions>
- **Email**: byyi.xuan@outlook.com

---

<div align="center">
  <p>If Gitly helps you, please give it a ⭐ Star!</p>
  <p>Made with ❤️ by Gitly Team</p>
</div>
