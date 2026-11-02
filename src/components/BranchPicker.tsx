import { useEffect, useRef, useState } from 'react';
import { GitBranch, ChevronDown, Check, Search } from 'lucide-react';
import { query } from '../api';
import type { Action, Entry } from '../types';
export function BranchPicker({
  repository,
  branch,
  revision,
  trusted,
  busy,
  act,
  manage,
}: {
  repository?: string;
  branch: string;
  revision: number;
  trusted: boolean;
  busy: boolean;
  act: (action: Action) => Promise<void>;
  manage: () => void;
}) {
  const [branches, setBranches] = useState<Entry[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!repository) return;
    let alive = true;
    query<Entry[]>(repository, 'branches')
      .then((rows) => {
        if (alive) {
          setBranches(rows);
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [repository, revision, branch]);
  function close() {
    if (details.current) details.current.open = false;
    trigger.current?.focus();
  }
  return (
    <details
      className="menu branch-picker-menu"
      ref={details}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        if (e.currentTarget.open) {
          setFilter('');
          requestAnimationFrame(() => input.current?.focus());
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        if (e.key === 'ArrowDown' && e.target === trigger.current) {
          e.preventDefault();
          if (details.current) details.current.open = true;
          input.current?.focus();
        }
      }}
    >
      <summary
        className="branch-picker"
        ref={trigger}
        role="button"
        aria-label={`Switch branch ${branch || 'No repository'}`}
        aria-expanded={open}
        aria-disabled={!repository}
        onClick={(e) => {
          if (!repository) e.preventDefault();
        }}
      >
        <GitBranch size={15} />
        <strong>{branch || 'No repository'}</strong>
        <ChevronDown size={13} />
      </summary>
      <div className="menu-content branch-popover">
        <div className="branch-search">
          <Search size={15} />
          <input
            ref={input}
            aria-label="Find a branch"
            placeholder="Find a branch…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                details.current
                  ?.querySelector<HTMLButtonElement>('.branch-options button:not(:disabled)')
                  ?.focus();
              }
            }}
          />
        </div>
        <div className="branch-options" role="group" aria-label="Branches">
          {branches
            .filter((entry) => entry.name.toLowerCase().includes(filter.toLowerCase()))
            .map((entry) => (
              <button
                key={entry.name}
                disabled={busy || !trusted || entry.name === branch}
                aria-label={`Switch to ${entry.name}`}
                onClick={() => {
                  close();
                  void act({ kind: 'switch', branch: entry.name });
                }}
                onKeyDown={(e) => {
                  if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                    e.preventDefault();
                    const buttons = Array.from(
                      details.current!.querySelectorAll<HTMLButtonElement>(
                        '.branch-options button:not(:disabled)',
                      ),
                    );
                    const index = buttons.indexOf(e.currentTarget);
                    buttons[
                      (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
                    ]?.focus();
                  }
                }}
              >
                <GitBranch size={14} />
                <span>{entry.name}</span>
                {entry.name === branch && <Check size={14} />}
              </button>
            ))}
          {!branches.length && <p className="group-empty">No branches yet</p>}
        </div>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        {!trusted && (
          <p className="branch-hint">
            {repository === 'preview'
              ? 'Branch switching is available in the desktop app.'
              : 'Trust the repository to switch branches.'}
          </p>
        )}
        <button
          className="branch-manage"
          onClick={() => {
            close();
            manage();
          }}
        >
          Manage branches…
        </button>
      </div>
    </details>
  );
}
