import { useEffect, useState } from 'react';
import { query } from '../api';
import type { Action, Conflict } from '../types';
export function ConflictEditor({
  repository,
  path,
  act,
  busy,
}: {
  repository: string;
  path: string;
  act: (a: Action) => Promise<void>;
  busy: boolean;
}) {
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setConflict(null);
    query<Conflict>(repository, 'conflict', { path })
      .then((c) => {
        if (alive) {
          setConflict(c);
          setResult(c.ours);
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [repository, path]);
  return (
    <section className="conflict-editor">
      <header className="diff-toolbar">
        <h2>Resolve {path}</h2>
        <button disabled={busy} onClick={() => void act({ kind: 'mergetool', path })}>
          Open merge tool
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {!conflict ? (
        <p>Loading conflict…</p>
      ) : (
        <>
          <p className="conflict-notice">
            {conflict.binary
              ? 'Binary conflict. Choose a version to keep.'
              : 'Compare all three versions, then edit the result. Saving stages the resolution.'}{' '}
            During rebase, “ours” is the rebased branch and “theirs” is the replayed commit.
          </p>
          <div className="conflict-sources">
            {(['base', 'ours', 'theirs'] as const).map((side) => (
              <section key={side}>
                <h3>{side === 'base' ? 'Base' : side === 'ours' ? 'Ours' : 'Theirs'}</h3>
                <pre>{conflict.binary ? 'Binary content' : conflict[side] || '(File absent)'}</pre>
                {side !== 'base' && (
                  <button
                    disabled={busy}
                    onClick={() => void act({ kind: 'resolve', path, content: null, side })}
                  >
                    Keep {side}
                  </button>
                )}
              </section>
            ))}
          </div>
          {!conflict.binary && (
            <>
              <label className="result-label" htmlFor="merge-result">
                Merge result
              </label>
              <textarea
                id="merge-result"
                className="merge-result"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                spellCheck={false}
              />
              <footer>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void act({ kind: 'resolve', path, content: result, side: null })}
                >
                  Save and stage resolution
                </button>
              </footer>
            </>
          )}
        </>
      )}
    </section>
  );
}
