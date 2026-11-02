# Gik

A local Git workbench for Windows 11 x64. Tauri 2 + Rust, React + TypeScript, and your installed Git. No account, hosting-provider API, or telemetry.

## Run

Install Node 24+, Git for Windows, Rust stable, and Visual Studio Build Tools with **Desktop development with C++** and a Windows SDK. WebView2 is required; the installer downloads its bootstrapper when needed.

```powershell
npm ci
npm run desktop
```

The Windows launcher also detects this workspace's isolated, ignored `.tools` Rust/LLVM toolchain. It adds its runtime DLL only to local builds; standard MSVC builds do not need that DLL. No toolchain download happens from the launcher.

```powershell
npm run desktop:build
# Development installer (faster, larger, unsigned):
powershell -ExecutionPolicy Bypass -File scripts/desktop.ps1 build -DebugBuild
```

Installers appear in `src-tauri/target/release/bundle/nsis/` (or `debug/bundle/nsis/`). Themed Windows caption controls share the app toolbar; dragging, resizing and maximize/restore use native window actions. macOS/Linux source boundaries exist, but those platforms are not verified or packaged yet.

`npm run dev` opens a **read-only browser design preview** with explicitly labeled sample repository data. It cannot access the filesystem or execute Git. Desktop builds always use Rust and actual repositories.

## Workflows

- Open, initialize, clone, reopen recent repositories, and switch repository tabs.
- Review staged/unstaged changes, unified/split diffs, file/hunk/line staging, commits, amend, signing, blame, and file history.
- Search paginated history, inspect commit ancestry, compare revisions, cherry-pick, revert, reset, merge, and rebase.
- Create, rename, delete, switch, and track branches; manage tags, remotes, stashes, and linked worktrees.
- Resolve text conflicts through base/ours/theirs and a merge result. Keep binary versions or open the configured Git merge tool. Continue, skip, or abort interrupted operations.
- Reorder, drop, squash, fixup, or edit commits in a visual rebase plan. Edit pauses for amendment, including changing the message. Merge-preserving and root rebases remain terminal workflows.
- Recover reflog commits as new branches. Destructive operations require previews, checked again before execution.
- Use per-repository PowerShell terminals for all other installed Git commands, including submodules, LFS, sparse checkout, bisect, and plumbing. Hidden drawers and repository switches preserve running shells; **End session** terminates one.

Git credential helpers, SSH agents, signing tools, and repository hooks use existing Git configuration. Interactive Git/SSH askpass challenges appear in a dialog; responses are passed through memory and are not stored or logged. Native credential-manager and signing dialogs may also open.

Trust is required for mutations and terminal access. Reading a repository disables filesystem monitors and external diff/textconv execution. Repository content is rendered as text. Trust permits hooks, helpers, filters, and configured tools to execute with your user permissions.

## Keyboard and appearance

Ctrl O opens a repository; Ctrl K opens and focuses commands; Ctrl backtick toggles the terminal; F5 refreshes; Ctrl Enter submits the commit form. F11 toggles fullscreen and hides the toolbar and window controls. Escape exits fullscreen when no dialog is open. Arrow keys navigate changed files. Pane separators support arrow-key resizing.

Settings provide system, light, and dark appearance. A bundled Inter Variable font gives Windows the requested Mac-like typography. Interface motion is enabled by default; turn it off in Settings for performance. System reduced motion always takes precedence. Keyboard navigation stays immediate. Branches switch directly from the searchable toolbar picker, and staged/unstaged groups collapse independently.

## Verification

```powershell
npm run build
npm test
npm run test:e2e
powershell -ExecutionPolicy Bypass -File scripts/desktop.ps1 test
powershell -ExecutionPolicy Bypass -File scripts/desktop.ps1 check
npm run format:check
```

Browser tests use installed Microsoft Edge and the production build. Native smoke tests require a built **debug** executable and installed WebView2:

```powershell
npm run test:native
```

The native harness uses an isolated WebView profile and disposable Git repository. It checks real IPC, staging, commit creation, history, askpass authentication, and terminal output. Set `GIK_EXECUTABLE` to test an installed executable instead.

Run the explicit 100,000-commit/10,000-path acceptance benchmark using `cargo test --manifest-path src-tauri/Cargo.toml --no-default-features benchmark_large_repository -- --ignored --nocapture`. The benchmark also stages all 10,000 paths through NUL-delimited stdin, avoiding Windows command-line length limits.

## Release and operational limits

- Public distribution requires a code-signing certificate. Configure Tauri `bundle.windows.certificateThumbprint`, `digestAlgorithm`, and `timestampUrl` (or your signing service's `signCommand`) in a private build config passed with `--config`. No certificate or signing credential is committed. Current local installers are unsigned development artifacts.
- Updates use manual installer downloads. There is no updater endpoint or release publishing automation.
- Windows-local repositories only. WSL, network shares, hosting-provider dashboards, and other OS installers are deferred.
- Git queries use bounded output (32 MiB); individual untracked text previews are limited to 2 MiB. Use the terminal/editor for larger content or non-UTF-8 paths. Symbolic-link conflicts use the terminal.
- Refresh occurs after app operations, on focus, and while visible every three seconds. It preserves selections. External Git processes and terminal commands cannot participate in the app's mutation locks; preview checking reduces races but cannot eliminate them.
- Cancelling Git kills its Windows process tree. Git may have already changed files or left a lock; inspect state before continuing. The app never removes Git lock files automatically.
- Full physical Narrator, hardware/DPI calibration, missing-WebView2 installation, real remote-provider credentials, and real signing-device checks require release-machine validation. See `VALIDATION.md` for checks actually run.

## Development workflow

`dev` is the integration branch. Potentially breaking work belongs on descriptive feature/fix branches and merges only after checks pass. Never modify or merge into `main`. See `AGENTS.md`.
