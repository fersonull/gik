# Validation

## Desktop experience update — 2026-11-03

- Production build and optimized unsigned `0.2.0` NSIS installer pass. Packaged resources include WebView2Loader, the local LLVM runtime, and Inter's OFL license. Isolated installation, installed-app smoke, and uninstall pass.
- Eight frontend tests and thirteen Microsoft Edge browser tests pass. Regressions cover history scrolling/pagination, unobstructed branch picker, disclosures, palette input focus/backdrop dismissal, fullscreen geometry, collapsed control alignment, persistent motion preference, and system reduced motion. Existing keyboard, pane persistence and light/dark axe checks pass.
- Twenty-two real Git integration tests pass, including friendly path display without changing canonical storage, foreground hook cancellation, and cancellation after Git exits while a background hook child retains pipes. The 100,000-commit benchmark below belongs to the earlier acceptance run and was not rerun for this update.
- Actual WebView2 verifies staging/commit, askpass, branch switches without navigation, undecorated themed chrome, maximize/restore/close, native fullscreen, palette focus, friendly paths and real PowerShell output. The harness waits for the shell prompt before entering commands.
- Final visual review covers light, dark, compact, collapsed navigation, history, branch picker, Settings and repository forms. Disposition: ship. Static captures settle animations before inspection.
- Design-taste inspector: zero failures; one warning for optional Cascadia Code not being installed. The declared system monospace fallback renders correctly; Inter Variable is bundled locally. Dependency audit reports zero known npm vulnerabilities.
- Windows Snap Layout hover, physical Narrator/high contrast and multi-monitor scaling are still manual release checks. The installer remains unsigned. No claim is made that those checks passed.

Verified on Windows on 2026-11-01. Git repositories used by automated tests are disposable fixtures, not the user's repositories.

## Passed

- Production TypeScript/Vite build. Terminal code is loaded separately; initial JavaScript is approximately 321 kB before compression.
- Seven frontend tests: diff parsing, partial staging against a real Git index, and distinct merge-parent graph lanes.
- Twenty Rust integration tests: stage/unstage/commit, unborn and bare repositories, Unicode/spaced paths, binary/non-UTF-8 content, CRLF/missing newline, stale previews, stale stash indices, trust/path validation, branches, stashes, tags, reflog, linked worktrees, real local remotes, push rejection, interactive rebase, failed hooks, pre-start and active hook-tree cancellation, submodules, and merge resolution/continuation.
- Explicit large-repository benchmark: 100,000 commits and 10,000 changed paths. Snapshot approximately 2.57 seconds; fixture creation plus bulk staging approximately 16 seconds. Git runs away from the UI thread. The bulk operation uses NUL-delimited path input rather than a Windows command line.
- Six production-browser tests in Microsoft Edge: navigation, command palette, themes, terminal explanation, arrow-key selection/focus, correct historical comparison labels, actual keyboard/pointer pane geometry and persistence at 1440/1024, no window overflow at 1440/1024/768, and light/dark axe checks with no serious or critical violations.
- Native installed-app smoke: isolated WebView2 profile and a path containing spaces; real Rust IPC, staging, commit creation, history, authenticated askpass response, and verified PowerShell PTY output.
- Optimized NSIS installer builds. Local LLVM build bundles its runtime and WebView2 loader; neither is assumed to be on the user's PATH. Silent test installation, same-version reinstall, and uninstall succeeded; a repository sentinel remained unchanged.
- Dependency audit: npm reports zero known vulnerabilities. Formatting and TypeScript checks pass.
- Design-taste browser inspector: zero failures and warnings at 1440/1024. Horizontal code clipping is allowed because the diff viewer intentionally scrolls horizontally. Source lint has zero failures; its three warnings are the real menu/dialog shadows and monospace merge-result text.
- Fresh Impeccable UI review: initial file-focus and historical-label findings fixed; subsequent pane-cascade finding fixed and checked against actual geometry. Final disposition: ship at the reviewed UI scope. Product/design records and token sidecar are present.

## Release-machine checks still required

- Windows code signing and certificate/device integration. The supplied installer is unsigned.
- Physical Narrator use, Windows high-contrast calibration, multi-monitor DPI/text scaling at 100–200%, and real signing hardware.
- Missing-Git installation guidance on a clean machine and missing-WebView2 bootstrap installation. This machine already has Git and WebView2.
- Real HTTPS/SSH hosting credentials and provider-specific credential-manager behavior. Askpass was verified using a local hook challenge; network operations were tested against local Git remotes.
- A version-to-version upgrade over an existing user installation. The isolated `0.2.0` clean install does not verify migration of an existing workspace.
- macOS, Linux, WSL, network shares, and Rust advisory-database audit were not verified.

## Operational limits

Git is authoritative. App operations share a lock by common Git directory, but external Git and terminal processes do not. Destructive previews detect changed state before execution; the check and external Git mutation cannot be made one atomic transaction. Cancellation can leave Git state or locks requiring inspection. Discarded uncommitted content is not guaranteed recoverable.
