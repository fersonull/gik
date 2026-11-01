import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, File, FilePlus2, Plus, Minus } from 'lucide-react';
import { nameOf, type Action, type Change } from '../types';
export function FileGroup({
  title,
  files,
  filter,
  staged,
  trusted,
  busy,
  selected,
  select,
  act,
}: {
  title: string;
  files: Change[];
  filter: string;
  staged: boolean;
  trusted: boolean;
  busy: boolean;
  selected: { path: string; staged: boolean } | null;
  select: (value: { path: string; staged: boolean }) => void;
  act: (action: Action) => Promise<void>;
}) {
  const visible = useMemo(
    () => files.filter((c) => c.path.toLowerCase().includes(filter.toLowerCase())),
    [files, filter],
  );
  const parent = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 48,
    overscan: 6,
  });
  return (
    <section className="file-group">
      <header>
        <div>
          <ChevronDown size={13} />
          <h2>{title}</h2>
          <span className="count">{files.length}</span>
        </div>
        <button
          className="quiet"
          disabled={busy || !trusted || !files.some((c) => !c.conflict)}
          onClick={() =>
            void act({
              kind: staged ? 'unstage' : 'stage',
              paths: files.filter((c) => !c.conflict).map((c) => c.path),
            })
          }
        >
          {staged ? 'Unstage all' : 'Stage all'}
        </button>
      </header>
      {visible.length ? (
        <div
          ref={parent}
          className="file-group-scroll"
          style={{ height: Math.min(visible.length * 48, 384) }}
          onKeyDown={(e) => {
            if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
            e.preventDefault();
            const current = visible.findIndex((c) => c.path === selected?.path);
            const index = Math.max(
              0,
              Math.min(visible.length - 1, current + (e.key === 'ArrowDown' ? 1 : -1)),
            );
            select({ path: visible[index].path, staged });
            virtual.scrollToIndex(index);
            requestAnimationFrame(() =>
              parent.current
                ?.querySelector<HTMLButtonElement>(`[data-file-index="${index}"] .file-select`)
                ?.focus(),
            );
          }}
        >
          <div className="virtual-space" style={{ height: virtual.getTotalSize() }}>
            {virtual.getVirtualItems().map((item) => {
              const c = visible[item.index];
              return (
                <div
                  className={`file-row ${selected?.path === c.path && selected.staged === staged ? 'selected' : ''}`}
                  key={c.path}
                  data-file-index={item.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <button
                    className="file-select"
                    onClick={() => select({ path: c.path, staged })}
                    title={c.path}
                  >
                    {c.index === '?' ? <FilePlus2 size={15} /> : <File size={15} />}
                    <span>
                      <span className="filename">{nameOf(c.path)}</span>
                      <span className="filepath">
                        {c.path.includes('/')
                          ? c.path.slice(0, c.path.lastIndexOf('/'))
                          : 'Repository root'}
                        {c.submodule ? ' · submodule' : ''}
                      </span>
                    </span>
                    <span
                      className={`file-status ${c.conflict ? 'warning' : c.index === '?' || c.index === 'A' ? 'positive' : 'modified'}`}
                    >
                      {c.conflict
                        ? 'Conflict'
                        : c.index === '?'
                          ? 'U'
                          : staged
                            ? c.index
                            : c.worktree}
                    </span>
                  </button>
                  <button
                    className="row-action"
                    disabled={busy || !trusted || c.conflict}
                    aria-label={`${staged ? 'Unstage' : 'Stage'} ${c.path}`}
                    onClick={() =>
                      void act({ kind: staged ? 'unstage' : 'stage', paths: [c.path] })
                    }
                  >
                    {staged ? <Minus size={13} /> : <Plus size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="group-empty">
          {filter ? 'No matching files' : staged ? 'No staged changes' : 'No unstaged changes'}
        </p>
      )}
    </section>
  );
}
