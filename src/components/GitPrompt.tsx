import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { call, desktop } from '../api';
import { Modal } from './Modal';
export function GitPrompt() {
  const [prompts, setPrompts] = useState<{ id: string; prompt: string }[]>([]);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    const cleanup: (() => void)[] = [];
    const register = async () => {
      const onPrompt = await listen<{ id: string; prompt: string }>('git-prompt', (e) => {
        setPrompts((previous) => [...previous, e.payload]);
        setValue('');
      });
      if (disposed) onPrompt();
      else cleanup.push(onPrompt);
      const onClose = await listen<string>('git-prompt-closed', (e) => {
        setPrompts((previous) => previous.filter((p) => p.id !== e.payload));
        setValue('');
      });
      if (disposed) onClose();
      else cleanup.push(onClose);
    };
    void register().catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      cleanup.forEach((fn) => fn());
    };
  }, []);
  const prompt = prompts[0];
  if (!prompt) return null;
  async function answer(value: string | null) {
    try {
      await call('answer_prompt', { id: prompt.id, value });
      setPrompts((previous) => previous.filter((p) => p.id !== prompt.id));
      setValue('');
      setError('');
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <Modal
      key={prompt.id}
      title="Git authentication"
      close={() => {
        void answer(null);
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void answer(value);
        }}
      >
        <div className="form-fields">
          <label>
            {prompt.prompt}
            <input
              autoFocus
              type={/password|passphrase|token/i.test(prompt.prompt) ? 'password' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className="muted">
            Passed directly to Git or SSH. Gik does not save or log your response.
          </p>
          {error && <p role="alert">{error}</p>}
        </div>
        <footer>
          <button type="button" onClick={() => void answer(null)}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Continue
          </button>
        </footer>
      </form>
    </Modal>
  );
}
