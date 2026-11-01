import { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowDownToLine,
  Braces,
  ChevronDown,
  CircleDot,
  Clock3,
  Command,
  Files,
  FolderGit2,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  History as HistoryIcon,
  LoaderCircle,
  MoreHorizontal,
  PanelBottom,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Tag,
  TerminalSquare,
  X,
  ExternalLink,
} from 'lucide-react';
import { open as folderDialog } from '@tauri-apps/plugin-dialog';
import { call, desktop, query } from './api';
import { nameOf } from './types';
import { save, saved, useWorkbench } from './useWorkbench';
import { Changes } from './components/Changes';
import { History, type Ask } from './components/History';
import { Collections } from './components/Collections';
import { FormDialog, Modal } from './components/Modal';
import { RebasePlanner } from './components/RebasePlanner';
import { GitPrompt } from './components/GitPrompt';
import { CommandPalette } from './components/CommandPalette';
const Terminal = lazy(() =>
  import('./components/Terminal').then((module) => ({ default: module.Terminal })),
);

const navigation = [
  { id: 'changes', label: 'Changes', icon: Files },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'branches', label: 'Branches', icon: GitBranch },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'stashes', label: 'Stashes', icon: Braces },
  { id: 'worktrees', label: 'Worktrees', icon: GitFork },
  { id: 'remotes', label: 'Remotes', icon: ExternalLink },
  { id: 'recovery', label: 'Recovery', icon: Clock3 },
] as const;
export default function App() {
  const workbench = useWorkbench();
  const { active, snapshot, job, view, setView, act } = workbench;
  const [theme, setTheme] = useState(saved('theme', 'system'));
  const [sidebar, setSidebar] = useState(true);
  const [drawer, setDrawer] = useState<'terminal' | 'log' | null>(null);
  const [terminalRepos, setTerminalRepos] = useState<string[]>([]);
  const [form, setForm] = useState<Ask | null>(null);
  const [dialog, setDialog] = useState<
    null | 'open' | 'clone' | 'init' | 'settings' | 'trust' | 'commands'
  >(null);
  const [inspection, setInspection] = useState<{ title: string; text: string } | null>(null);
  const [base, setBase] = useState('');

  const [gitVersion, setGitVersion] = useState('Checking Git…');
  const [drawerHeight, setDrawerHeight] = useState(saved('drawerHeight', 240));
  const [sidebarWidth, setSidebarWidth] = useState(saved('sidebarWidth', 208));
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as Element;
      document.querySelectorAll<HTMLDetailsElement>('details.menu[open]').forEach((menu) => {
        if (!menu.contains(target) || target.closest('button')) menu.open = false;
      });
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        document.querySelectorAll<HTMLDetailsElement>('details.menu[open]').forEach((menu) => {
          menu.open = false;
        });
    };
    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', closeMenus);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    save('theme', theme);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    void call<string>('git_version')
      .then(setGitVersion)
      .catch((e) => {
        setGitVersion('Git unavailable');
        workbench.setError(String(e));
      });
  }, []);
  useEffect(() => {
    if (!workbench.notice) return;
    const timer = setTimeout(() => workbench.setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [workbench.notice]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setDialog((previous) => (previous === 'commands' ? null : 'commands'));
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void chooseFolder();
      }
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        void workbench.refresh();
      }
      if (e.ctrlKey && e.key === 'Enter' && (e.target as HTMLElement).id === 'commit-message') {
        e.preventDefault();
        (e.target as HTMLTextAreaElement).form?.requestSubmit();
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  async function chooseFolder() {
    if (!desktop) {
      setDialog('open');
      return;
    }
    try {
      const path = await folderDialog({
        directory: true,
        multiple: false,
        title: 'Open Git repository',
      });
      if (typeof path === 'string') await workbench.open(path);
    } catch (e) {
      workbench.setError(String(e));
    }
  }
  function toggleTerminal() {
    if (!active) return;
    if (!active.trusted && desktop) {
      setDialog('trust');
      return;
    }
    setTerminalRepos((previous) =>
      previous.includes(active.id) ? previous : [...previous, active.id],
    );
    setDrawer((previous) => (previous === 'terminal' ? null : 'terminal'));
  }
  async function inspect(kind: string, path: string) {
    if (!active) return;
    try {
      setInspection({
        title: kind === 'blame' ? `Blame · ${path}` : `File history · ${path}`,
        text: await query<string>(active.id, kind, { path }),
      });
    } catch (e) {
      workbench.setError(String(e));
    }
  }
  function resize(e: React.PointerEvent, axis: 'sidebar' | 'drawer') {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const start = axis === 'sidebar' ? e.clientX : e.clientY;
    const size = axis === 'sidebar' ? sidebarWidth : drawerHeight;
    const move = (event: PointerEvent) => {
      const next =
        axis === 'sidebar'
          ? Math.max(160, Math.min(300, size + event.clientX - start))
          : Math.max(150, Math.min(innerHeight - 240, size + start - event.clientY));
      if (axis === 'sidebar') {
        setSidebarWidth(next);
        save('sidebarWidth', next);
      } else {
        setDrawerHeight(next);
        save('drawerHeight', next);
      }
    };
    const stop = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', stop);
      target.removeEventListener('pointercancel', stop);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', stop);
    target.addEventListener('pointercancel', stop);
  }
  const commands = [
    ...navigation.map((n) => ({
      label: `Go to ${n.label}`,
      hint: 'Navigate',
      run: () => setView(n.id),
    })),
    {
      label: 'Open repository',
      hint: 'Ctrl O',
      run: () => {
        void chooseFolder();
      },
    },
    { label: 'Clone repository', hint: 'Repository', run: () => setDialog('clone') },
    { label: 'Initialize repository', hint: 'Repository', run: () => setDialog('init') },
    { label: 'Toggle terminal', hint: 'Ctrl `', run: toggleTerminal },
    {
      label: 'Refresh repository',
      hint: 'F5',
      run: () => {
        void workbench.refresh();
      },
    },
    {
      label: 'Clean untracked files…',
      hint: 'Destructive',
      run: () => {
        void act({ kind: 'clean' });
      },
    },
    {
      label: 'Force push with lease…',
      hint: 'Remote',
      run: () => {
        void act({ kind: 'push', force: true });
      },
    },
    {
      label: 'Pull with rebase',
      hint: 'Remote',
      run: () => {
        void act({ kind: 'pull', rebase: true });
      },
    },
  ];
  return (
    <div
      className="app-shell"
      style={
        {
          '--sidebar-width': `${sidebar ? sidebarWidth : 56}px`,
          '--drawer-height': `${drawerHeight}px`,
        } as React.CSSProperties
      }
    >
      <GitPrompt />
      {!desktop && (
        <div className="preview-banner">
          <span>Design preview</span>Sample repository · read-only browser mode
          <span>Run the desktop app for real Git operations</span>
        </div>
      )}
      <header className="app-toolbar">
        <div className="wordmark">
          <span className="gik-mark">
            <GitFork size={19} />
          </span>
          <strong>gik</strong>
          <span className="product-caption">Git, in good order.</span>
        </div>
        <div className="toolbar-main">
          <button className="branch-picker" disabled={!active} onClick={() => setView('branches')}>
            <GitBranch size={14} />
            <strong>{snapshot?.branch || 'No repository'}</strong>
            <ChevronDown size={13} />
          </button>
          {snapshot && (
            <span className="tracking-info">
              <ArrowUp size={11} />
              {snapshot.ahead}
              <ArrowDown size={11} />
              {snapshot.behind}
            </span>
          )}
          <div className="toolbar-spacer" />
          <button
            disabled={!active || !!job || !active.trusted}
            onClick={() =>
              void act({ kind: 'fetch', remote: snapshot?.upstream.split('/')[0] || 'origin' })
            }
          >
            <RefreshCw size={14} />
            <span>Fetch</span>
          </button>
          <button
            disabled={!active || !!job || !active.trusted}
            onClick={() => void act({ kind: 'pull', rebase: false })}
          >
            <ArrowDownToLine size={14} />
            <span>Pull</span>
          </button>
          <button
            disabled={!active || !!job || !active.trusted}
            onClick={() => void act({ kind: 'push', force: false })}
          >
            <ArrowUp size={14} />
            <span>Push</span>
          </button>
          <span className="toolbar-divider" />
          <button
            className="icon-button"
            aria-label="Open command palette"
            title="Command palette (Ctrl K)"
            onClick={() => setDialog('commands')}
          >
            <Search size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Toggle terminal"
            title="Terminal (Ctrl `)"
            onClick={toggleTerminal}
          >
            <PanelBottom size={16} />
          </button>
        </div>
      </header>
      <aside className={`sidebar ${sidebar ? '' : 'collapsed'}`}>
        <div className="sidebar-workspace">
          <FolderGit2 size={17} />
          {sidebar && (
            <div>
              <strong>{active ? nameOf(active.path) : 'Your workspace'}</strong>
              <span>{active?.path || 'Local repositories'}</span>
            </div>
          )}
          <button
            className="icon-button"
            aria-label="Open repository"
            title="Open repository"
            onClick={() => void chooseFolder()}
          >
            <Plus size={14} />
          </button>
        </div>
        <nav aria-label="Repository views">
          {navigation.map((n, index) => (
            <button
              key={n.id}
              aria-label={
                n.id === 'changes' && snapshot?.changes.length
                  ? `Changes ${snapshot.changes.length}`
                  : n.label
              }
              disabled={!active}
              className={`${view === n.id ? 'active' : ''} ${index === 2 || index === 7 ? 'nav-group-start' : ''}`}
              aria-current={view === n.id ? 'page' : undefined}
              title={!sidebar ? n.label : undefined}
              onClick={() => setView(n.id)}
            >
              <n.icon size={16} />
              {sidebar && (
                <>
                  <span>{n.label} </span>
                  {n.id === 'changes' && !!snapshot?.changes.length && (
                    <span className="nav-count">{snapshot.changes.length}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>
        {sidebar && (
          <div className="sidebar-bottom">
            <div className="local-label">
              <CircleDot size={12} />
              <span>Local workspace</span>
            </div>
            <p>Your repositories stay on this computer.</p>
            <button className="command-trigger" onClick={() => setDialog('commands')}>
              <Command size={14} />
              Command palette<kbd>Ctrl K</kbd>
            </button>
          </div>
        )}
        <div className="sidebar-controls">
          <button
            className="icon-button"
            title="Settings"
            aria-label="Settings"
            onClick={() => setDialog('settings')}
          >
            <Settings2 size={15} />
          </button>
          {sidebar && <span>Gik 0.1</span>}
          <button
            className="icon-button"
            aria-label={sidebar ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={() => setSidebar(!sidebar)}
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
        <div
          className="resize-handle sidebar-resizer"
          role="separator"
          aria-label="Sidebar width"
          aria-orientation="vertical"
          aria-valuenow={sidebarWidth}
          aria-valuemin={160}
          aria-valuemax={300}
          tabIndex={0}
          onPointerDown={(e) => resize(e, 'sidebar')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              const n = Math.max(
                160,
                Math.min(300, sidebarWidth + (e.key === 'ArrowLeft' ? -8 : 8)),
              );
              setSidebarWidth(n);
              save('sidebarWidth', n);
            }
          }}
        />
      </aside>
      <main className="workspace">
        <div className="repository-tabs" role="group" aria-label="Open repositories">
          {workbench.repositories.map((r) => (
            <div className={`repository-tab ${r.id === active?.id ? 'active' : ''}`} key={r.id}>
              <button
                aria-pressed={r.id === active?.id}
                onClick={() => workbench.setActiveId(r.id)}
              >
                <FolderGit2 size={13} />
                {nameOf(r.path)}
                {r.id === active?.id && !!snapshot?.changes.length && (
                  <span className="unsaved-dot" />
                )}
              </button>
              <button
                className="close-tab"
                aria-label={`Close ${nameOf(r.path)}`}
                onClick={() => {
                  workbench.close(r.id);
                  setTerminalRepos((previous) => previous.filter((id) => id !== r.id));
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            className="new-tab"
            aria-label="Open another repository"
            onClick={() => void chooseFolder()}
          >
            <Plus size={15} />
          </button>
          <div className="tabs-spacer" />
          <details className="menu">
            <summary aria-label="Repository actions">
              <MoreHorizontal size={17} />
            </summary>
            <div className="menu-content">
              <button onClick={() => setDialog('clone')}>Clone repository…</button>
              <button onClick={() => setDialog('init')}>Initialize repository…</button>
              <button onClick={() => void workbench.refresh()}>Refresh</button>
              <button disabled={!active?.trusted} onClick={() => void act({ kind: 'clean' })}>
                Clean untracked files…
              </button>
            </div>
          </details>
        </div>
        {workbench.error && (
          <div className="error-banner" role="alert">
            <span>{workbench.error}</span>
            <button aria-label="Dismiss error" onClick={() => workbench.setError('')}>
              <X size={14} />
            </button>
          </div>
        )}
        {active && !active.trusted && desktop && (
          <div className="trust-banner">
            <ShieldCheck size={16} />
            <span>
              Inspection mode. Trust this repository to enable Git operations, hooks, and tools.
            </span>
            <button onClick={() => setDialog('trust')}>Review trust…</button>
          </div>
        )}
        {snapshot?.operation && (
          <div className="operation-banner">
            <GitCommitHorizontal size={16} />
            <strong>{snapshot.operation} in progress</strong>
            <span>Resolve any conflicts before continuing.</span>
            {(
              ['continue', ...(snapshot.operation !== 'merge' ? ['skip'] : []), 'abort'] as const
            ).map((kind) => (
              <button
                key={kind}
                disabled={!!job}
                onClick={() => void act({ kind: kind as 'continue' | 'skip' | 'abort' })}
              >
                {kind[0].toUpperCase() + kind.slice(1)}
              </button>
            ))}
          </div>
        )}
        <div className="workspace-content">
          {active && snapshot ? (
            view === 'changes' ? (
              <Changes
                key={active.id}
                repository={active.id}
                snapshot={snapshot}
                trusted={active.trusted}
                act={act}
                busy={!!job}
                revision={workbench.revision}
                inspect={(kind, path) => void inspect(kind, path)}
              />
            ) : view === 'history' ? (
              <History
                key={active.id}
                repository={active.id}
                revision={workbench.revision}
                act={act}
                ask={setForm}
                rebase={setBase}
              />
            ) : (
              <Collections
                key={`${active.id}:${view}`}
                view={view}
                repository={active.id}
                revision={workbench.revision}
                currentBranch={snapshot.branch}
                act={act}
                ask={setForm}
                open={workbench.open}
                busy={!!job}
                trusted={active.trusted}
              />
            )
          ) : active || workbench.loading ? (
            <div className="empty">
              <LoaderCircle className="spinner" size={28} />
              <h2>Reading repository…</h2>
            </div>
          ) : (
            <div className="welcome">
              <span className="welcome-mark">
                <GitFork size={36} />
              </span>
              <h1>A little clarity for your code.</h1>
              <p>
                Open a repository. Review your changes.
                <br />
                Keep your next commit in good order.
              </p>
              <div>
                <button className="primary" onClick={() => void chooseFolder()}>
                  <FolderOpen size={16} />
                  Open repository
                </button>
                <button onClick={() => setDialog('clone')}>Clone repository</button>
                <button onClick={() => setDialog('init')}>Initialize repository</button>
              </div>
              {saved<string[]>('recent', []).length > 0 && (
                <section className="recent">
                  <h2>Recent repositories</h2>
                  {saved<string[]>('recent', []).map((path) => (
                    <button key={path} onClick={() => void workbench.open(path)}>
                      <FolderGit2 size={15} />
                      <strong>{nameOf(path)}</strong>
                      <span>{path}</span>
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
        {(drawer || terminalRepos.length > 0) && (
          <section className="bottom-drawer" hidden={!drawer}>
            <div
              className="resize-handle drawer-resizer"
              role="separator"
              aria-label="Drawer height"
              aria-orientation="horizontal"
              aria-valuenow={drawerHeight}
              aria-valuemin={150}
              aria-valuemax={innerHeight - 240}
              tabIndex={0}
              onPointerDown={(e) => resize(e, 'drawer')}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  const n = Math.max(
                    150,
                    Math.min(innerHeight - 240, drawerHeight + (e.key === 'ArrowUp' ? 16 : -16)),
                  );
                  setDrawerHeight(n);
                  save('drawerHeight', n);
                }
              }}
            />
            <header className="drawer-tabs">
              <button
                className={drawer === 'terminal' ? 'active' : ''}
                onClick={() => {
                  if (active && !terminalRepos.includes(active.id)) toggleTerminal();
                  else setDrawer('terminal');
                }}
              >
                <TerminalSquare size={13} />
                Terminal
              </button>
              <button className={drawer === 'log' ? 'active' : ''} onClick={() => setDrawer('log')}>
                <Clock3 size={13} />
                Operation log<span>{workbench.logs.length}</span>
              </button>
              <span className="drawer-path">{active?.path}</span>
              {drawer === 'terminal' && active && terminalRepos.includes(active.id) && (
                <button
                  title="Terminate shell"
                  onClick={() =>
                    setTerminalRepos((previous) => previous.filter((id) => id !== active.id))
                  }
                >
                  End session
                </button>
              )}
              <button
                className="icon-button"
                aria-label="Close bottom panel"
                onClick={() => setDrawer(null)}
              >
                <X size={14} />
              </button>
            </header>
            <div className="drawer-body">
              {terminalRepos
                .filter((id) => workbench.repositories.some((r) => r.id === id))
                .map((id) => (
                  <Suspense key={id} fallback={<p className="drawer-empty">Starting terminal…</p>}>
                    <Terminal repository={id} active={drawer === 'terminal' && id === active?.id} />
                  </Suspense>
                ))}
              {drawer === 'terminal' && !terminalRepos.includes(active?.id || '') && (
                <p className="drawer-empty">
                  No shell for this repository.{' '}
                  <button onClick={toggleTerminal}>Start terminal</button>
                </p>
              )}
              {drawer === 'log' && (
                <div className="operation-log">
                  {workbench.logs.length ? (
                    workbench.logs.map((log) => (
                      <details key={log.id}>
                        <summary>
                          <time>{log.time}</time>
                          <span className={log.failed ? 'negative' : 'positive'}>
                            {log.failed ? 'Failed' : 'Completed'}
                          </span>
                          {log.title}
                        </summary>
                        <pre>{log.output}</pre>
                      </details>
                    ))
                  ) : (
                    <p>
                      Git operation results appear here. Terminal input and credentials are not
                      recorded.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
      <footer className="statusbar">
        <span>
          <CircleDot size={11} />
          {job ? 'Git operation running…' : snapshot ? 'Repository ready' : gitVersion}
        </span>
        {job && (
          <button
            onClick={() =>
              void call('cancel_operation', { job }).catch((e) => workbench.setError(String(e)))
            }
          >
            Cancel operation
          </button>
        )}
        <span className="status-notice" role="status">
          {workbench.notice}
        </span>
        <button onClick={() => setDrawer(drawer === 'log' ? null : 'log')}>
          <Clock3 size={11} />
          Operation log
        </button>
        <span>
          {snapshot?.bare
            ? 'Bare repository'
            : snapshot
              ? `${snapshot.changes.length} changed files`
              : 'Local, by design'}
        </span>
      </footer>
      {form && (
        <FormDialog
          title={form.title}
          fields={form.fields}
          close={() => setForm(null)}
          submit={(values) => {
            const action = form.action(values);
            setForm(null);
            void act(action);
          }}
        />
      )}
      {workbench.confirmation && (
        <Modal title="Review repository operation" close={() => workbench.setConfirmation(null)}>
          <pre className="confirmation-detail">{workbench.confirmation.detail}</pre>
          <p className="modal-description">
            The repository is checked again before this runs. Uncommitted content may not be
            recoverable.
          </p>
          <footer>
            <button onClick={() => workbench.setConfirmation(null)}>Cancel</button>
            <button
              className="danger"
              onClick={() => {
                const c = workbench.confirmation!;
                void workbench.perform(c.repository, c.action, c.token);
              }}
            >
              Confirm operation
            </button>
          </footer>
        </Modal>
      )}
      {base && active && (
        <RebasePlanner repository={active.id} base={base} act={act} close={() => setBase('')} />
      )}
      {inspection && (
        <Modal title={inspection.title} close={() => setInspection(null)} wide>
          <pre className="inspection-output">{inspection.text || 'No history available.'}</pre>
        </Modal>
      )}
      {dialog === 'trust' && active && (
        <Modal title="Trust this repository?" close={() => setDialog(null)}>
          <p className="modal-description">
            <strong>{active.path}</strong>
          </p>
          <p className="modal-description">
            Git operations can run repository hooks, filters, configured helpers, and signing tools.
            The terminal can run any command with your user permissions. Trust only repositories
            whose contents and configuration you understand.
          </p>
          <footer>
            <button onClick={() => setDialog(null)}>Keep inspection mode</button>
            <button
              className="primary"
              onClick={() => {
                void workbench.trust();
                setDialog(null);
              }}
            >
              Trust repository
            </button>
          </footer>
        </Modal>
      )}
      {dialog === 'settings' && (
        <Modal title="Settings" close={() => setDialog(null)}>
          <div className="form-fields">
            <label>
              Appearance
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="system">Follow system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <p>{gitVersion}</p>
            <p className="muted">
              Credentials, SSH, signing, and hooks use your installed Git configuration. Gik has no
              account and sends no telemetry.
            </p>
            <p className="muted">
              Shortcuts: Ctrl O to open, Ctrl K for commands, Ctrl ` for terminal, Ctrl Enter to
              commit, F5 to refresh.
            </p>
          </div>
        </Modal>
      )}
      {dialog === 'commands' && (
        <CommandPalette commands={commands} close={() => setDialog(null)} />
      )}
      {(dialog === 'open' || dialog === 'clone' || dialog === 'init') && (
        <FormDialog
          title={
            dialog === 'open'
              ? 'Open repository'
              : dialog === 'clone'
                ? 'Clone repository'
                : 'Initialize repository'
          }
          fields={[
            ...(dialog === 'clone'
              ? [
                  {
                    name: 'url',
                    label: 'Git URL',
                    placeholder: 'HTTPS or SSH repository URL',
                  },
                ]
              : []),
            {
              name: 'path',
              label: 'Absolute local folder path',
              placeholder: 'C:\\Projects\\my-repository',
            },
          ]}
          label={
            creating
              ? 'Working…'
              : dialog === 'open'
                ? 'Open'
                : dialog === 'clone'
                  ? 'Clone'
                  : 'Initialize'
          }
          close={() => {
            if (!creating) setDialog(null);
          }}
          submit={async (values) => {
            if (creating) return;
            setCreating(true);
            try {
              const path =
                dialog === 'open'
                  ? values.path
                  : await call<string>('create_repository', {
                      path: values.path,
                      url: dialog === 'clone' ? values.url : null,
                    });
              await workbench.open(path);
              setDialog(null);
            } catch (e) {
              workbench.setError(String(e));
            } finally {
              setCreating(false);
            }
          }}
        />
      )}
    </div>
  );
}
