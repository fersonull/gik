import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Modal } from './Modal';
import { query } from '../api';
import type { Action, Commit, RebaseStep } from '../types';
export function RebasePlanner({
  repository,
  base,
  act,
  close,
}: {
  repository: string;
  base: string;
  act: (a: Action) => Promise<void>;
  close: () => void;
}) {
  const [steps, setSteps] = useState<(RebaseStep & { subject: string })[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    query<Commit[]>(repository, 'history', { branch: 'HEAD' })
      .then((commits) => {
        if (!alive) return;
        const index = commits.findIndex((c) => c.oid === base);
        if (index < 0) {
          setError(
            'Base must be within the latest 200 commits on HEAD. Use the terminal for larger ranges.',
          );
          return;
        }
        setSteps(
          commits
            .slice(0, index)
            .reverse()
            .map((c) => ({ oid: c.oid, action: 'pick', subject: c.subject })),
        );
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [repository, base]);
  function move(index: number, offset: number) {
    setSteps((previous) => {
      const next = [...previous];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }
  return (
    <Modal title="Interactive rebase" close={close} wide>
      <p className="modal-description">
        Replay commits after <code>{base.slice(0, 12)}</code>, oldest first. Reorder with the
        arrows. Choose Edit to pause and amend a commit or its message.
      </p>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="rebase-steps">
        {steps.map((step, i) => (
          <div className="rebase-step" key={step.oid}>
            <select
              aria-label={`Action for ${step.subject}`}
              value={step.action}
              onChange={(e) =>
                setSteps((previous) =>
                  previous.map((s, n) => (n === i ? { ...s, action: e.target.value } : s)),
                )
              }
            >
              {['pick', 'edit', 'squash', 'fixup', 'drop'].map((a) => (
                <option key={a} disabled={i === 0 && ['squash', 'fixup'].includes(a)}>
                  {a}
                </option>
              ))}
            </select>
            <code>{step.oid.slice(0, 7)}</code>
            <span>{step.subject}</span>
            <button
              className="icon-button"
              disabled={i === 0}
              aria-label={`Move ${step.subject} earlier`}
              onClick={() => move(i, -1)}
            >
              <ArrowUp size={14} />
            </button>
            <button
              className="icon-button"
              disabled={i === steps.length - 1}
              aria-label={`Move ${step.subject} later`}
              onClick={() => move(i, 1)}
            >
              <ArrowDown size={14} />
            </button>
          </div>
        ))}
      </div>
      <footer>
        <button onClick={close}>Cancel</button>
        <button
          className="primary"
          disabled={!steps.length || !!error}
          onClick={() => {
            close();
            void act({
              kind: 'interactive_rebase',
              base,
              steps: steps.map(({ oid, action }) => ({ oid, action })),
            });
          }}
        >
          Review rebase…
        </button>
      </footer>
    </Modal>
  );
}
