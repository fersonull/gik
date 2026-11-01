import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, GitCommitHorizontal, GitBranch, ArrowDown, MoreHorizontal } from 'lucide-react';
import { query } from '../api';
import type { Action, Commit, Entry } from '../types';
import { FormDialog, type Field } from './Modal';
import { DiffViewer } from './DiffViewer';
import { SplitPane } from './SplitPane';
import { layoutGraph } from '../graph';
export interface Ask {
  title: string;
  fields: Field[];
  action: (values: Record<string, string>) => Action;
}
export function History({
  repository,
  revision,
  act,
  ask,
  rebase,
}: {
  repository: string;
  revision: number;
  act: (a: Action) => Promise<void>;
  ask: (a: Ask) => void;
  rebase: (base: string) => void;
}) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selected, setSelected] = useState<Commit | null>(null);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState<Entry[]>([]);
  const [diff, setDiff] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [compare, setCompare] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const parent = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: commits.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 56,
    overscan: 12,
  });
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      query<Commit[]>(repository, 'history', { search, branch })
        .then((rows) => {
          if (alive) {
            setCommits(rows);
            setHasMore(rows.length === 200);
            setSelected((previous) => rows.find((c) => c.oid === previous?.oid) || rows[0] || null);
          }
        })
        .catch((e) => {
          if (alive) setError(String(e));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [repository, revision, search, branch]);
  useEffect(() => {
    query<Entry[]>(repository, 'branches')
      .then(setBranches)
      .catch((e) => setError(String(e)));
  }, [repository, revision]);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    query<string>(repository, 'diff', { revision: selected.oid, compare })
      .then((d) => {
        if (alive) setDiff(d);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [selected, repository, compare]);
  const lanes = useMemo(() => layoutGraph(commits), [commits]);
  const graphWidth = Math.max(56, ...lanes.map((row) => Math.max(row.before, row.after) * 14 + 14));
  async function loadMore() {
    setLoading(true);
    try {
      const more = await query<Commit[]>(repository, 'history', {
        skip: commits.length,
        search,
        branch,
      });
      setCommits((previous) => [...previous, ...more]);
      setHasMore(more.length === 200);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <SplitPane className="history-layout" storageKey="historyPane" initial={560}>
      <section className="history-list">
        <header className="panel-heading">
          <h1>History</h1>
          <span className="muted">
            {commits.length}
            {hasMore ? '+' : ''} commits
          </span>
        </header>
        <div className="history-filters">
          <div className="filter">
            <Search size={14} />
            <input
              aria-label="Search commits"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commit messages…"
            />
          </div>
          <select
            aria-label="Filter history by branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div
          ref={parent}
          className="commit-scroll"
          role="list"
          aria-label="Commit history"
          aria-busy={loading}
        >
          <div
            className="virtual-space"
            style={{ height: virtual.getTotalSize(), minWidth: graphWidth + 300 }}
          >
            {virtual.getVirtualItems().map((item) => {
              const commit = commits[item.index];
              const graph = lanes[item.index];
              return (
                <button
                  role="listitem"
                  aria-label={`${commit.subject}, ${commit.author}, ${commit.parents.length} parents`}
                  key={commit.oid}
                  className={`commit-row ${selected?.oid === commit.oid ? 'selected' : ''}`}
                  style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                  onClick={() => {
                    setSelected(commit);
                    setCompare('');
                  }}
                >
                  <svg
                    className="commit-graph"
                    width={graphWidth}
                    style={{ width: graphWidth }}
                    height="56"
                    aria-hidden="true"
                  >
                    {Array.from({ length: graph.before }, (_, i) => (
                      <path key={`b${i}`} d={`M${14 + i * 14} 0 V28`} className="graph-track" />
                    ))}
                    {graph.tracks.map((track) => (
                      <path
                        key={`track-${track.from}`}
                        d={`M${14 + track.from * 14} 28 C${14 + track.from * 14} 42 ${14 + track.to * 14} 42 ${14 + track.to * 14} 56`}
                        className="graph-track"
                      />
                    ))}
                    {graph.targets.map((target, i) => (
                      <path
                        key={i}
                        d={`M${14 + graph.lane * 14} 28 C${14 + graph.lane * 14} 42 ${14 + target * 14} 42 ${14 + target * 14} 56`}
                        className="graph-edge"
                      />
                    ))}
                    <circle
                      cx={14 + graph.lane * 14}
                      cy="28"
                      r={commit.parents.length > 1 ? 4.5 : 3.5}
                    />
                  </svg>
                  <span className="commit-description">
                    <strong>{commit.subject}</strong>
                    <span>
                      {commit.refs && (
                        <span className="ref-label">
                          <GitBranch size={11} />
                          {commit.refs}
                        </span>
                      )}
                      <span>{commit.author}</span>
                      <time dateTime={commit.date}>
                        {new Date(commit.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                    </span>
                  </span>
                  <code>{commit.oid.slice(0, 7)}</code>
                </button>
              );
            })}
          </div>
          {!commits.length && !loading && (
            <div className="empty compact">
              <GitCommitHorizontal size={28} />
              <h2>No commits found</h2>
              <p>
                {search ? 'Try another commit message.' : 'Your first commit will appear here.'}
              </p>
            </div>
          )}
        </div>
        {hasMore && (
          <button className="load-more" disabled={loading} onClick={() => void loadMore()}>
            <ArrowDown size={13} />
            Load more commits
          </button>
        )}
      </section>
      <section className="commit-detail">
        {compareOpen && (
          <FormDialog
            title="Compare revisions"
            fields={[{ name: 'revision', label: 'Compare with revision', value: 'HEAD' }]}
            close={() => setCompareOpen(false)}
            submit={(values) => {
              setCompare(values.revision);
              setCompareOpen(false);
            }}
          />
        )}
        {selected ? (
          <>
            <header className="commit-detail-heading">
              <div>
                <code>{selected.oid.slice(0, 12)}</code>
                <h2>{selected.subject}</h2>
                <p>
                  {selected.author} committed {new Date(selected.date).toLocaleString()}
                </p>
              </div>
              <details className="menu">
                <summary aria-label="Commit actions">
                  <MoreHorizontal size={18} />
                </summary>
                <div className="menu-content">
                  <button onClick={() => void act({ kind: 'cherry_pick', target: selected.oid })}>
                    Cherry-pick commit
                  </button>
                  <button onClick={() => void act({ kind: 'revert', target: selected.oid })}>
                    Revert commit
                  </button>
                  <button
                    onClick={() =>
                      ask({
                        title: 'Create branch here',
                        fields: [{ name: 'name', label: 'Branch name' }],
                        action: (v) => ({
                          kind: 'create_branch',
                          name: v.name,
                          start: selected.oid,
                        }),
                      })
                    }
                  >
                    Create branch here…
                  </button>
                  <button
                    onClick={() =>
                      ask({
                        title: 'Reset current branch',
                        fields: [
                          { name: 'mode', label: 'Reset mode', options: ['soft', 'mixed', 'hard'] },
                        ],
                        action: (v) => ({ kind: 'reset', target: selected.oid, mode: v.mode }),
                      })
                    }
                  >
                    Reset current branch here…
                  </button>
                  <button onClick={() => rebase(selected.oid)}>
                    Interactive rebase after this…
                  </button>
                  <button onClick={() => setCompareOpen(true)}>Compare with revision…</button>
                </div>
              </details>
            </header>
            {compare && (
              <p className="comparison-label">
                Comparing {compare} → {selected.oid.slice(0, 7)}{' '}
                <button onClick={() => setCompare('')}>Clear</button>
              </p>
            )}
            <DiffViewer
              comparisonLabel={compare ? `Comparison with ${compare}` : 'Commit changes'}
              key={selected.oid + compare}
              text={diff}
              path=""
              staged={false}
              actionable={false}
              act={() => {}}
              busy={false}
            />
          </>
        ) : (
          <div className="empty">
            <GitCommitHorizontal size={32} />
            <h2>Select a commit</h2>
            <p>Inspect its changes and history.</p>
          </div>
        )}
      </section>
    </SplitPane>
  );
}
