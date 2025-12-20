## Gitly extension for Visual Studio Code

Gitly is a Git history visualizer and assistant for VS Code. It lets you **view commit graphs**, **manage branches / tags / remotes**, and **operate Git through a visual dashboard** – with **English / Simplified Chinese UI**.

![Recording of Gitly](https://github.com/YIXUAN-oss/Gitly/raw/master/resources/demo.gif)


---

### Main Features

- **Gitly View (Commit Graph)**
  - **Visual graph**: local & remote branches, heads, tags, remotes, stashes, uncommitted changes
  - **Right‑click actions on commits / branches / tags**:
    - **Branches**: Create, checkout, delete, fetch, merge, pull, push, rebase, rename, reset
    - **Tags**: Add, delete, push, view annotated tag details (name, email, date, message)
    - **Commits**: Checkout, cherry‑pick, drop, merge, revert
    - **Working tree**: Clean, reset, stash / apply / pop; create branch from stash
    - **Copy helpers**: Copy commit hashes, branch / tag / stash names, file paths
  - **Commit Details / Comparison views**:
    - View VS Code diff for any file
    - Open current version of a file at a given revision
    - Copy file paths
    - Click HTTP/HTTPS URLs in commit messages to open in browser
    - Compare any two commits by `Ctrl/Cmd+Click`
  - **Code Review workflow**:
    - Track which files are reviewed / unreviewed
    - Reviews persist across sessions (auto‑closed after long inactivity)
  - **Filtering & search**:
    - Filter branches via the **Branches** dropdown (single / multiple / custom glob patterns)
    - **Find widget**: search commits by message, date, author, hash, branch or tag name
  - **Tooling & UX**:
    - Hover a commit to see whether it is in HEAD, and which branches / tags / stashes contain it
    - Resize columns, toggle Date / Author / Commit columns
    - Keyboard shortcuts for find, scroll to HEAD, refresh, scroll to stashes, etc.
    - Common emoji shortcodes (including [gitmoji](https://gitmoji.carloscuesta.me/)) rendered in messages

- **Gitly Sidebar Views (Activity Bar)**
  - **Branches (`gitly.sidebar.branches`)**:
    - Visual tree of local / remote branches with quick actions (checkout / merge / rename / delete)
    - One‑click navigation to the main Gitly graph
  - **History (`gitly.sidebar.history`)**:
    - Focused view on recent commits with shortcuts to open details / graph / diff
  - **Conflicts (`gitly.sidebar.conflicts`)**:
    - List of conflicted files
    - Quick entry to conflict resolution helpers and the assistant panel

- **Gitly Visual Panel (Assistant Webview)**
  - **Quick Commands**: grouped by repository state (init, setup, changes, commit, sync, branches, tags, conflicts, tools)
  - **Git Command Reference**: searchable list of common Git commands with copy‑to‑clipboard
  - **Remote Manager**: manage remotes, show upstream and default push remotes, open remote in browser
  - **Branch / Tag Managers**: view and operate on local & remote branches / tags
  - **Conflict Resolution View**: see conflicted files and apply strategies (current / incoming / both)
  - **Timeline & Heatmap**: basic visualizations of commit activity and file / contributor hot spots
  - Fully localized between **English (`en`)** and **Simplified Chinese (`zh-CN`)** (see configuration below).

- **Internationalization**
  - UI strings are driven by:
    - `package.nls.json` (English)
    - `package.nls.zh-CN.json` (Simplified Chinese)
    - `web/assistant/i18n.ts` (assistant panel)
  - Change the language via the `gitly.language` setting (see **Configuration**).

---

### Getting Started

1. **Install the extension**
   - Search for **“Gitly”** in the VS Code extension marketplace (or package from source using `vsce` if unpublished).
2. **Open Gitly View**
   - Run command: `Gitly: View Gitly (git log)` (command ID: `gitly.view`)
   - Or click the Gitly icon in the Status Bar.
3. **Use the Sidebar and Assistant Panel**
   - In the Activity Bar choose the **Gitly** icon to access:
     - Branch management, commit history, conflict list views.
   - Run: `Gitly: Open Assistant Panel` (command ID: `gitly.openAssistant`) to open the visual dashboard.

For Chinese documentation, please refer to `README.md` or `README.zh-CN.md`.

---

### Configuration

Gitly contributes a rich set of configuration options under the `gitly.*` namespace. Only the most commonly used options are listed here; see VS Code Settings UI for the full list.

- **Language**
  - **`gitly.language`**: display language for Gitly.
    - `"en"` – English
    - `"zh-CN"` – Simplified Chinese

- **Commit Details View**
  - **`gitly.commitDetailsView.autoCenter`**: automatically center the Commit Details View when opened.
  - **`gitly.commitDetailsView.fileView.type`**: default file view type (`File Tree` / `File List`).
  - **`gitly.commitDetailsView.fileView.fileTree.compactFolders`**: compact single-child folder chains in the File Tree.
  - **`gitly.commitDetailsView.location`**: render commit details inline with the graph or docked to bottom.

- **Graph & Repository**
  - **`gitly.graph.colours`** / **`gitly.graph.style`** / **`gitly.graph.uncommittedChanges`**: appearance of the graph.
  - **`gitly.repository.commits.*`**: number of commits to load, load‑more behavior, muting, ordering, signature display.
  - **`gitly.repository.show*`**: whether to show remote branches, tags, stashes, uncommitted & untracked files.
  - **`gitly.repository.fetchAndPrune`**, **`gitly.repository.fetchAndPruneTags`**: control pruning behavior when fetching.
  - **`gitly.referenceLabels.*`**: alignment and combination of branch / tag labels.

- **General**
  - **`gitly.showStatusBarItem`**: toggle the status bar entry that opens Gitly.
  - **`gitly.openNewTabEditorGroup`**: which editor group to use when opening diffs / files from Gitly.
  - **`gitly.retainContextWhenHidden`**: keep Gitly context when the tab is hidden (faster restore, more memory).
  - **`gitly.enhancedAccessibility`**: enable extra visual indicators for file changes.
  - **`gitly.fileEncoding`**: encoding used when reading historical file contents.

Gitly also consumes the following existing VS Code setting:

- **`git.path`** – path to a Git executable, if you want to override the default discovery.

---

### Contributing & Development

- Repository: `https://github.com/YIXUAN-oss/Gitly`
- Ways to contribute:
  - File Issues / Feature Requests
  - Fork and open Pull Requests

See `CONTRIBUTING.md` for detailed development and contribution guidelines.

---

### Release Notes

See [`CHANGELOG.md`](CHANGELOG.md) for the full history.  
Note: entries up to `1.30.0` originate from the upstream Git Graph project; Gitly‑specific changes are tracked from versions published in this repository.

---

### License & Acknowledgements

Gitly is licensed under the terms in `LICENSE`. It reuses large parts of the original Git Graph implementation.

Some of the icons used in Gitly are from the following sources – please support them:

- [GitHub Octicons](https://octicons.github.com/) ([License](https://github.com/primer/octicons/blob/master/LICENSE))
- [Icons8](https://icons8.com/icon/pack/free-icons/ios11) ([License](https://icons8.com/license))

## Gitly extension for Visual Studio Code

Gitly is a Git history visualizer and assistant for VS Code. It lets you **view commit graphs**, **manage branches / tags / remotes**, and **operate Git through a visual dashboard** – with **English / Simplified Chinese UI**.

![Recording of Gitly](https://github.com/YIXUAN-oss/Gitly/raw/master/resources/demo.gif)

> Gitly is based on the excellent [Git Graph](https://github.com/mhutchie/vscode-git-graph) project and extends it with a sidebar, assistant panel, and Chinese localization.

---

### Main Features

- **Gitly View (Commit Graph)**
  - **Visual graph**: local & remote branches, heads, tags, remotes, stashes, uncommitted changes
  - **Right‑click actions on commits / branches / tags**:
    - **Branches**: Create, checkout, delete, fetch, merge, pull, push, rebase, rename, reset
    - **Tags**: Add, delete, push, view annotated tag details (name, email, date, message)
    - **Commits**: Checkout, cherry‑pick, drop, merge, revert
    - **Working tree**: Clean, reset, stash / apply / pop; create branch from stash
    - **Copy helpers**: Copy commit hashes, branch / tag / stash names, file paths
  - **Commit Details / Comparison views**:
    - View VS Code diff for any file
    - Open current version of a file at a given revision
    - Copy file paths
    - Click HTTP/HTTPS URLs in commit messages to open in browser
    - Compare any two commits by `Ctrl/Cmd+Click`
  - **Code Review workflow**:
    - Track which files are reviewed / unreviewed
    - Reviews persist across sessions (auto‑closed after long inactivity)
  - **Filtering & search**:
    - Filter branches via the **Branches** dropdown (single / multiple / custom glob patterns)
    - **Find widget**: search commits by message, date, author, hash, branch or tag name
  - **Tooling & UX**:
    - Hover a commit to see whether it is in HEAD, and which branches / tags / stashes contain it
    - Resize columns, toggle Date / Author / Commit columns
    - Keyboard shortcuts for find, scroll to HEAD, refresh, scroll to stashes, etc.
    - Common emoji shortcodes (including [gitmoji](https://gitmoji.carloscuesta.me/)) rendered in messages

- **Gitly Sidebar Views (Activity Bar)**
  - **Branches (`gitly.sidebar.branches`)**:
    - Visual tree of local / remote branches with quick actions (checkout / merge / rename / delete)
    - One‑click navigation to the main Gitly graph
  - **History (`gitly.sidebar.history`)**:
    - Focused view on recent commits with shortcuts to open details / graph / diff
  - **Conflicts (`gitly.sidebar.conflicts`)**:
    - List of conflicted files
    - Quick entry to conflict resolution helpers and the assistant panel

- **Gitly Visual Panel (Assistant Webview)**
  - **Quick Commands**: grouped by repository state (init, setup, changes, commit, sync, branches, tags, conflicts, tools)
  - **Git Command Reference**: searchable list of common Git commands with copy‑to‑clipboard
  - **Remote Manager**: manage remotes, show upstream and default push remotes, open remote in browser
  - **Branch / Tag Managers**: view and operate on local & remote branches / tags
  - **Conflict Resolution View**: see conflicted files and apply strategies (current / incoming / both)
  - **Timeline & Heatmap**: basic visualizations of commit activity and file / contributor hot spots
  - Fully localized between **English (`en`)** and **Simplified Chinese (`zh-CN`)** (see configuration below).

- **Internationalization**
  - UI strings are driven by:
    - `package.nls.json` (English)
    - `package.nls.zh-CN.json` (Simplified Chinese)
    - `web/assistant/i18n.ts` (assistant panel)
  - Change the language via the `gitly.language` setting (see **Configuration**).

---

### Getting Started

1. **Install the extension**
   - Search for **“Gitly”** in the VS Code extension marketplace (or package from source using `vsce` if unpublished).
2. **Open Gitly View**
   - Run command: `Gitly: View Gitly (git log)` (command ID: `gitly.view`)
   - Or click the Gitly icon in the Status Bar.
3. **Use the Sidebar and Assistant Panel**
   - In the Activity Bar choose the **Gitly** icon to access:
     - Branch management, commit history, conflict list views.
   - Run: `Gitly: Open Assistant Panel` (command ID: `gitly.openAssistant`) to open the visual dashboard.

For Chinese documentation, please refer to `README.md` or `README.zh-CN.md`.

---

### Configuration

Gitly contributes a rich set of configuration options under the `gitly.*` namespace. Only the most commonly used options are listed here; see VS Code Settings UI for the full list.

- **Language**
  - **`gitly.language`**: display language for Gitly.
    - `"en"` – English
    - `"zh-CN"` – Simplified Chinese

- **Commit Details View**
  - **`gitly.commitDetailsView.autoCenter`**: automatically center the Commit Details View when opened.
  - **`gitly.commitDetailsView.fileView.type`**: default file view type (`File Tree` / `File List`).
  - **`gitly.commitDetailsView.fileView.fileTree.compactFolders`**: compact single-child folder chains in the File Tree.
  - **`gitly.commitDetailsView.location`**: render commit details inline with the graph or docked to bottom.

- **Graph & Repository**
  - **`gitly.graph.colours`** / **`gitly.graph.style`** / **`gitly.graph.uncommittedChanges`**: appearance of the graph.
  - **`gitly.repository.commits.*`**: number of commits to load, load‑more behavior, muting, ordering, signature display.
  - **`gitly.repository.show*`**: whether to show remote branches, tags, stashes, uncommitted & untracked files.
  - **`gitly.repository.fetchAndPrune`**, **`gitly.repository.fetchAndPruneTags`**: control pruning behavior when fetching.
  - **`gitly.referenceLabels.*`**: alignment and combination of branch / tag labels.

- **General**
  - **`gitly.showStatusBarItem`**: toggle the status bar entry that opens Gitly.
  - **`gitly.openNewTabEditorGroup`**: which editor group to use when opening diffs / files from Gitly.
  - **`gitly.retainContextWhenHidden`**: keep Gitly context when the tab is hidden (faster restore, more memory).
  - **`gitly.enhancedAccessibility`**: enable extra visual indicators for file changes.
  - **`gitly.fileEncoding`**: encoding used when reading historical file contents.

Gitly also consumes the following existing VS Code setting:

- **`git.path`** – path to a Git executable, if you want to override the default discovery.

---

### Contributing & Development

- Repository: `https://github.com/YIXUAN-oss/Gitly`
- Ways to contribute:
  - File Issues / Feature Requests
  - Fork and open Pull Requests

See `CONTRIBUTING.md` for detailed development and contribution guidelines.

---

### Release Notes

See [`CHANGELOG.md`](CHANGELOG.md) for the full history.  
Note: entries up to `1.30.0` originate from the upstream Git Graph project; Gitly‑specific changes are tracked from versions published in this repository.

---

### License & Acknowledgements

Gitly is licensed under the terms in `LICENSE`. It reuses large parts of the original Git Graph implementation.

Some of the icons used in Gitly are from the following sources – please support them:

- [GitHub Octicons](https://octicons.github.com/) ([License](https://github.com/primer/octicons/blob/master/LICENSE))
- [Icons8](https://icons8.com/icon/pack/free-icons/ios11) ([License](https://icons8.com/license))


