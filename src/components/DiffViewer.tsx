import { useMemo, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Columns2, Rows3, FileCode2, Check, Plus, Minus } from 'lucide-react';
import { parseDiff, selectionPatch, type DiffLine } from '../diff';
import type { Action } from '../types';

export function DiffViewer({
  text,
  path,
  staged,
  actionable,
  act,
  busy,
  comparisonLabel,
}: {
  text: string;
  path: string;
  staged: boolean;
  actionable: boolean;
  act: (a: Action) => void;
  busy: boolean;
  comparisonLabel?: string;
}) {
  const diff = useMemo(() => parseDiff(text), [text]);
  const [split, setSplit] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const parent = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () =>
      diff.hunks.flatMap((h, i) => [
        { kind: 'header' as const, hunk: i, line: null },
        ...h.lines.map((line) => ({ kind: 'line' as const, hunk: i, line })),
      ]),
    [diff],
  );
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 24,
    overscan: 20,
  });
  const apply = (ids: Set<number>) => {
    const patch = selectionPatch(diff, ids, staged);
    if (patch) act({ kind: 'apply_patch', patch, reverse: staged, cached: true });
    setSelected(new Set());
  };
  function toggle(line: DiffLine) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(line.id)) next.delete(line.id);
      else next.add(line.id);
      return next;
    });
  }
  const added = diff.hunks.reduce((n, h) => n + h.lines.filter((l) => l.type === 'add').length, 0);
  const removed = diff.hunks.reduce(
    (n, h) => n + h.lines.filter((l) => l.type === 'remove').length,
    0,
  );
  return (
    <section className="diff-viewer" aria-label="File diff">
      <header className="diff-toolbar">
        <div className="file-title">
          <FileCode2 size={16} />
          <span title={path}>{path || 'Commit details'}</span>
        </div>
        <div className="toolbar-actions">
          <span className="positive">+{added}</span>
          <span className="negative">−{removed}</span>
          <div className="segmented">
            <button aria-label="Unified diff" aria-pressed={!split} onClick={() => setSplit(false)}>
              <Rows3 size={15} />
            </button>
            <button aria-label="Split diff" aria-pressed={split} onClick={() => setSplit(true)}>
              <Columns2 size={15} />
            </button>
          </div>
          {actionable && selected.size > 0 && (
            <button disabled={busy} onClick={() => apply(selected)}>
              {staged ? 'Unstage' : 'Stage'} selected lines
            </button>
          )}
        </div>
      </header>
      {diff.binary ? (
        <div className="empty compact">
          <FileCode2 size={28} />
          <h2>Binary file</h2>
          <p>Stage the whole file, or inspect it in your editor.</p>
        </div>
      ) : rows.length === 0 ? (
        <pre className="plain-output">{text || 'No textual changes in this selection.'}</pre>
      ) : (
        <div className={`diff-scroll ${split ? 'split' : ''}`} ref={parent}>
          <div
            className="virtual-space"
            style={{ height: virtual.getTotalSize(), minWidth: split ? 900 : 680 }}
          >
            {virtual.getVirtualItems().map((item) => {
              const row = rows[item.index];
              const line = row.line;
              return (
                <div
                  key={item.key}
                  className={`diff-row ${line?.type || 'hunk-row'} ${line && selected.has(line.id) ? 'selected-line' : ''}`}
                  style={{ transform: `translateY(${item.start}px)`, height: item.size }}
                >
                  {row.kind === 'header' ? (
                    <>
                      <code>
                        {!path && diff.hunks[row.hunk].file ? `${diff.hunks[row.hunk].file}  ` : ''}
                        {diff.hunks[row.hunk].header}
                      </code>
                      {actionable && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            apply(new Set(diff.hunks[row.hunk].lines.map((l) => l.id)))
                          }
                        >
                          {staged ? <Minus size={12} /> : <Plus size={12} />}{' '}
                          {staged ? 'Unstage' : 'Stage'} hunk
                        </button>
                      )}
                    </>
                  ) : (
                    line && (
                      <>
                        {actionable ? (
                          <button
                            className="line-selector"
                            aria-label={`Select ${line.type} line ${line.next ?? line.old ?? ''}`}
                            disabled={!['add', 'remove'].includes(line.type)}
                            aria-pressed={selected.has(line.id)}
                            onClick={() => toggle(line)}
                          >
                            {selected.has(line.id) ? <Check size={11} /> : ''}
                          </button>
                        ) : (
                          <span className="line-selector" />
                        )}
                        <span className="line-number">{line.old}</span>
                        <span className="line-number">{line.next}</span>
                        {split ? (
                          <>
                            <code className="split-code">
                              {line.type !== 'add' ? line.text : ''}
                            </code>
                            <code className="split-code">
                              {line.type !== 'remove' ? line.text : ''}
                            </code>
                          </>
                        ) : (
                          <code className="code-line">
                            <span className="line-sign">
                              {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                            </span>
                            {line.text}
                          </code>
                        )}
                      </>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <footer className="diff-footer">
        <span>{comparisonLabel || (staged ? 'Index changes' : 'Working tree changes')}</span>
        <span>
          {actionable ? 'Select changed lines to stage a precise change' : 'Read-only comparison'}
        </span>
      </footer>
    </section>
  );
}
