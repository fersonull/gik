import { useEffect, useState } from 'react';
import { Check, CircleCheck, Undo2, Search, ShieldCheck } from 'lucide-react';
import { query } from '../api';
import { isStaged, isUnstaged, type Action, type Snapshot } from '../types';
import { DiffViewer } from './DiffViewer';
import { FileGroup } from './FileGroup';
import { SplitPane } from './SplitPane';
import { ConflictEditor } from './ConflictEditor';
import { save, saved } from '../useWorkbench';

export function Changes({
  repository,
  snapshot,
  trusted,
  act,
  busy,
  revision,
  inspect,
}: {
  repository: string;
  snapshot: Snapshot;
  trusted: boolean;
  act: (a: Action) => Promise<void>;
  busy: boolean;
  revision: number;
  inspect: (kind: string, path: string) => void;
}) {
  const [selected, setSelected] = useState<{ path: string; staged: boolean } | null>(null);
  const [diff, setDiff] = useState('');
  const [diffError, setDiffError] = useState('');
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState(saved(`message:${snapshot.root}`, ''));
  const [amend, setAmend] = useState(false);
  const [sign, setSign] = useState(false);
  const staged = snapshot.changes.filter(isStaged);
  const unstaged = snapshot.changes.filter(isUnstaged);
  const change = snapshot.changes.find((c) => c.path === selected?.path);
  useEffect(() => {
    if (
      !selected ||
      !snapshot.changes.some(
        (c) => c.path === selected.path && (selected.staged ? isStaged(c) : isUnstaged(c)),
      )
    ) {
      const first = unstaged[0] || staged[0];
      setSelected(first ? { path: first.path, staged: !unstaged[0] } : null);
    }
  }, [snapshot]); // Selection survives background refresh.
  useEffect(() => {
    let cancelled = false;
    setDiffError('');
    if (!selected || change?.conflict) {
      setDiff('');
      return;
    }
    query<string>(repository, 'diff', { path: selected.path, staged: selected.staged })
      .then((text) => {
        if (!cancelled) setDiff(text);
      })
      .catch((e) => {
        if (!cancelled) setDiffError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [repository, selected, snapshot.token, revision]);
  return (
    <SplitPane className="changes-layout" storageKey="changesPane" initial={320}>
      <section className="changes-panel" aria-label="Changed files">
        <header className="panel-heading">
          <div>
            <h1>Changes</h1>
            <span className="count">{snapshot.changes.length}</span>
          </div>
          <button
            className="icon-button"
            title="Discard selected unstaged changes"
            aria-label="Discard selected unstaged changes"
            disabled={!selected || selected.staged || busy || !trusted}
            onClick={() => selected && void act({ kind: 'discard', paths: [selected.path] })}
          >
            <Undo2 size={15} />
          </button>
        </header>
        <div className="filter">
          <Search size={14} />
          <input
            aria-label="Filter changed files"
            placeholder="Filter files…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <kbd>⌕</kbd>
        </div>
        <div className="file-groups">
          <FileGroup
            title="Unstaged"
            files={unstaged}
            filter={filter}
            staged={false}
            trusted={trusted}
            busy={busy}
            selected={selected}
            select={setSelected}
            act={act}
          />
          <FileGroup
            title="Staged"
            files={staged}
            filter={filter}
            staged
            trusted={trusted}
            busy={busy}
            selected={selected}
            select={setSelected}
            act={act}
          />
          {!snapshot.changes.length && (
            <div className="clean-state">
              <CircleCheck size={28} />
              <strong>Working tree clean</strong>
              <p>All changes are committed.</p>
            </div>
          )}
        </div>
        <form
          className="commit-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ kind: 'commit', message, amend, sign });
          }}
        >
          <div className="commit-heading">
            <span className="avatar">G</span>
            <div>
              <strong>Your next commit</strong>
              <span>
                {staged.length} {staged.length === 1 ? 'file' : 'files'} staged
              </span>
            </div>
            <ShieldCheck size={15} />
          </div>
          <label className="sr-only" htmlFor="commit-message">
            Commit message
          </label>
          <textarea
            id="commit-message"
            placeholder="Summary of your changes"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              save(`message:${snapshot.root}`, e.target.value);
            }}
            rows={3}
            required
          />
          <div className="commit-options">
            <label>
              <input type="checkbox" checked={amend} onChange={(e) => setAmend(e.target.checked)} />
              Amend
            </label>
            <label>
              <input type="checkbox" checked={sign} onChange={(e) => setSign(e.target.checked)} />
              Sign commit
            </label>
          </div>
          <button
            className="primary commit-button"
            disabled={busy || !trusted || (!staged.length && !amend) || !message.trim()}
            type="submit"
          >
            <Check size={15} />
            {amend ? 'Amend commit' : 'Commit changes'}
            <kbd>Ctrl ↵</kbd>
          </button>
        </form>
      </section>
      <div className="diff-panel">
        {selected && change?.conflict ? (
          <ConflictEditor repository={repository} path={selected.path} act={act} busy={busy} />
        ) : selected ? (
          <>
            <div className="file-context">
              <span>{selected.staged ? 'Staged changes' : 'Unstaged changes'}</span>
              <div>
                <button onClick={() => inspect('file_history', selected.path)}>File history</button>
                <button onClick={() => inspect('blame', selected.path)}>Blame</button>
              </div>
            </div>
            {diffError ? (
              <p className="inline-error" role="alert">
                {diffError}
              </p>
            ) : (
              <DiffViewer
                key={`${selected.path}:${selected.staged}`}
                text={diff}
                path={selected.path}
                staged={selected.staged}
                actionable={trusted && !change?.submodule}
                act={(a) => void act(a)}
                busy={busy}
              />
            )}
          </>
        ) : (
          <div className="empty">
            <CircleCheck size={36} />
            <h2>You’re all caught up</h2>
            <p>Your working tree is clean. Explore history or start your next change.</p>
          </div>
        )}
      </div>
    </SplitPane>
  );
}
