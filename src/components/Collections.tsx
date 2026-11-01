import { useEffect, useState } from 'react';
import { GitBranch, Plus, MoreHorizontal, Search, ArrowUpRight } from 'lucide-react';
import { query } from '../api';
import type { Action, Entry, View } from '../types';
import type { Ask } from './History';
export function Collections({
  view,
  repository,
  revision,
  currentBranch,
  act,
  ask,
  open,
  busy,
  trusted,
}: {
  view: Exclude<View, 'changes' | 'history'>;
  repository: string;
  revision: number;
  currentBranch: string;
  act: (a: Action) => Promise<void>;
  ask: (a: Ask) => void;
  open: (path: string) => Promise<void>;
  busy: boolean;
  trusted: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  useEffect(() => {
    let alive = true;
    setError('');
    query<Entry[]>(repository, view)
      .then((rows) => {
        if (alive) setEntries(rows);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [view, repository, revision]);
  const title = view[0].toUpperCase() + view.slice(1);
  const enabled = !busy && trusted;
  function create() {
    if (view === 'branches')
      ask({
        title: 'Create branch',
        fields: [
          { name: 'name', label: 'Branch name', placeholder: 'feature/my-change' },
          { name: 'start', label: 'Start at', value: 'HEAD' },
        ],
        action: (v) => ({ kind: 'create_branch', name: v.name, start: v.start }),
      });
    if (view === 'tags')
      ask({
        title: 'Create tag',
        fields: [
          { name: 'name', label: 'Tag name' },
          { name: 'target', label: 'Revision', value: 'HEAD' },
          { name: 'message', label: 'Annotation (optional)', required: false },
        ],
        action: (v) => ({ kind: 'create_tag', ...v }) as Action,
      });
    if (view === 'stashes')
      ask({
        title: 'Stash changes',
        fields: [
          { name: 'message', label: 'Message' },
          { name: 'untracked', label: 'Include untracked files', options: ['yes', 'no'] },
        ],
        action: (v) => ({
          kind: 'stash_save',
          message: v.message,
          untracked: v.untracked === 'yes',
        }),
      });
    if (view === 'remotes')
      ask({
        title: 'Add remote',
        fields: [
          { name: 'name', label: 'Name', value: 'origin' },
          { name: 'url', label: 'Git URL' },
        ],
        action: (v) => ({ kind: 'add_remote', name: v.name, url: v.url }),
      });
    if (view === 'worktrees')
      ask({
        title: 'Add worktree',
        fields: [
          { name: 'path', label: 'Absolute destination path' },
          { name: 'branch', label: 'Existing branch' },
        ],
        action: (v) => ({ kind: 'add_worktree', path: v.path, branch: v.branch }),
      });
  }
  function actions(entry: Entry): { label: string; action: () => void }[] {
    const run = (action: Action) => () => {
      void act(action);
    };
    if (view === 'branches')
      return [
        { label: 'Switch to branch', action: run({ kind: 'switch', branch: entry.name }) },
        { label: 'Merge into current branch', action: run({ kind: 'merge', target: entry.name }) },
        {
          label: 'Rebase current branch onto this',
          action: run({ kind: 'rebase', target: entry.name }),
        },
        {
          label: 'Rename…',
          action: () =>
            ask({
              title: 'Rename branch',
              fields: [{ name: 'name', label: 'New branch name', value: entry.name }],
              action: (v) => ({ kind: 'rename_branch', old: entry.name, name: v.name }),
            }),
        },
        {
          label: 'Set upstream…',
          action: () =>
            ask({
              title: 'Set upstream',
              fields: [{ name: 'upstream', label: 'Upstream branch', value: entry.detail }],
              action: (v) => ({ kind: 'upstream', branch: entry.name, upstream: v.upstream }),
            }),
        },
        {
          label: 'Delete merged branch',
          action: run({ kind: 'delete_branch', name: entry.name, force: false }),
        },
        {
          label: 'Force delete branch…',
          action: run({ kind: 'delete_branch', name: entry.name, force: true }),
        },
      ];
    if (view === 'stashes')
      return [
        { label: 'Apply', action: run({ kind: 'stash_apply', name: entry.name, pop: false }) },
        { label: 'Pop', action: run({ kind: 'stash_apply', name: entry.name, pop: true }) },
        { label: 'Drop…', action: run({ kind: 'stash_drop', name: entry.name }) },
      ];
    if (view === 'tags')
      return [
        {
          label: 'Create branch from tag…',
          action: () =>
            ask({
              title: 'Branch from tag',
              fields: [{ name: 'name', label: 'Branch name' }],
              action: (v) => ({ kind: 'create_branch', name: v.name, start: entry.name }),
            }),
        },
        { label: 'Delete tag…', action: run({ kind: 'delete_tag', name: entry.name }) },
      ];
    if (view === 'remotes')
      return [
        { label: 'Fetch', action: run({ kind: 'fetch', remote: entry.name }) },
        { label: 'Remove remote…', action: run({ kind: 'remove_remote', name: entry.name }) },
      ];
    if (view === 'worktrees')
      return [
        {
          label: 'Open in tab',
          action: () => {
            void open(entry.name);
          },
        },
        { label: 'Remove worktree…', action: run({ kind: 'remove_worktree', path: entry.name }) },
      ];
    return [
      {
        label: 'Recover as new branch…',
        action: () =>
          ask({
            title: 'Recover commit as a branch',
            fields: [{ name: 'branch', label: 'New branch name', placeholder: 'recovery/my-work' }],
            action: (v) => ({ kind: 'recover', oid: entry.oid, branch: v.branch }),
          }),
      },
    ];
  }
  return (
    <section className="collection">
      <header className="collection-heading">
        <div>
          <h1>{title}</h1>
          <p>
            {view === 'recovery'
              ? 'Recover reachable reflog commits as a new branch. Discarded uncommitted content may be unrecoverable.'
              : `Manage ${view} in this repository.`}
          </p>
        </div>
        {view !== 'recovery' && (
          <button disabled={!enabled} onClick={create}>
            <Plus size={15} />
            {view === 'stashes'
              ? 'Stash changes'
              : `New ${view === 'branches' ? 'branch' : view.slice(0, -1)}`}
          </button>
        )}
      </header>
      <div className="filter collection-filter">
        <Search size={14} />
        <input
          aria-label={`Filter ${view}`}
          placeholder={`Filter ${view}…`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="entry-table">
        <div className="entry-table-heading">
          <span>Name</span>
          <span>{view === 'remotes' ? 'URL' : view === 'branches' ? 'Upstream' : 'Details'}</span>
          <span>Commit</span>
          <span />
        </div>
        {entries
          .filter((e) => `${e.name} ${e.detail}`.toLowerCase().includes(filter.toLowerCase()))
          .map((entry) => (
            <div className="entry-row" key={entry.name}>
              <div className="entry-name">
                <GitBranch size={16} />
                <strong title={entry.name}>{entry.name}</strong>
                {entry.name === currentBranch && <span className="current-label">Current</span>}
              </div>
              <span className="entry-detail" title={entry.detail}>
                {entry.detail || '—'}
              </span>
              <code>{entry.oid.slice(0, 7) || '—'}</code>
              <details className="menu">
                <summary aria-label={`Actions for ${entry.name}`}>
                  <MoreHorizontal size={17} />
                </summary>
                <div className="menu-content">
                  {actions(entry).map((a) => (
                    <button key={a.label} disabled={!enabled} onClick={a.action}>
                      {a.label}
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                </div>
              </details>
            </div>
          ))}
        {!entries.length && (
          <div className="empty compact">
            <GitBranch size={28} />
            <h2>No {view} yet</h2>
            <p>
              {view === 'recovery'
                ? 'Reflog entries appear as you work.'
                : `Create your first ${view === 'branches' ? 'branch' : view.slice(0, -1)}.`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
