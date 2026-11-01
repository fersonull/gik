import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { call, desktop, execute, openRepository, query } from './api';
import { destructive, type Action, type Repository, type Snapshot, type View } from './types';
export function saved<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`gik:${key}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(`gik:${key}`, JSON.stringify(value));
  } catch {
    /* Preferences must not block repository operations. */
  }
}
export interface Log {
  id: string;
  time: string;
  title: string;
  output: string;
  failed: boolean;
}
export function useWorkbench() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [activeId, setActiveId] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [view, setView] = useState<View>(saved('view', 'changes'));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState<{
    repository: string;
    action: Action;
    token: string;
    detail: string;
  } | null>(null);
  const active = repositories.find((r) => r.id === activeId);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (!activeId || refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await query<Snapshot>(activeId, 'snapshot');
      if (activeRef.current === activeId) {
        setSnapshot((previous) => (previous?.token === next.token ? previous : next));
      }
    } catch (e) {
      if (activeRef.current === activeId) setError(String(e));
    } finally {
      refreshing.current = false;
    }
  }, [activeId]);
  useEffect(() => {
    setSnapshot(null);
    refreshing.current = false;
    void refresh();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 3000);
    window.addEventListener('focus', refresh);
    let unlisten: (() => void) | undefined;
    if (desktop)
      void listen('repository-changed', () => {
        void refresh();
        setRevision((n) => n + 1);
      }).then((fn) => {
        unlisten = fn;
      });
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      unlisten?.();
    };
  }, [refresh]);
  useEffect(() => {
    save('view', view);
  }, [view]);
  async function open(path: string) {
    setLoading(true);
    setError('');
    try {
      const existing = repositories.find((r) => r.path === path);
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      const repository = await openRepository(path);
      setRepositories((previous) => [
        ...previous.filter((r) => r.path !== repository.path),
        repository,
      ]);
      setActiveId(repository.id);
      const recent = saved<string[]>('recent', []);
      save(
        'recent',
        [repository.path, ...recent.filter((p) => p !== repository.path)].slice(0, 12),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let disposed = false;
    async function restore() {
      const paths = desktop ? saved<string[]>('tabs', []) : ['C:/Projects/gik'];
      const opened: Repository[] = [];
      for (const path of paths) {
        try {
          opened.push(await openRepository(path));
        } catch (e) {
          if (!disposed) setError(`Could not restore ${path}: ${e}`);
        }
      }
      if (!disposed) {
        setRepositories(opened);
        setActiveId(opened.find((r) => r.path === saved('active', ''))?.id || opened[0]?.id || '');
      }
    }
    void restore();
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    if (repositories.length)
      save(
        'tabs',
        repositories.map((r) => r.path),
      );
    if (active) save('active', active.path);
  }, [repositories, active]);
  function close(id: string) {
    setRepositories((previous) => {
      const remaining = previous.filter((r) => r.id !== id);
      save(
        'tabs',
        remaining.map((r) => r.path),
      );
      if (activeId === id) setActiveId(remaining[0]?.id || '');
      return remaining;
    });
  }
  async function trust() {
    if (!active) return;
    try {
      await call('trust_repository', { repository: active.id });
      setRepositories((previous) =>
        previous.map((r) => (r.id === active.id ? { ...r, trusted: true } : r)),
      );
      setNotice('Repository trusted. Hooks and configured tools may now run.');
    } catch (e) {
      setError(String(e));
    }
  }
  async function perform(repository: string, action: Action, expected?: string) {
    const id = crypto.randomUUID();
    setJob(id);
    setError('');
    setConfirmation(null);
    try {
      const output = await execute(repository, action, id, expected);
      setLogs((previous) =>
        [
          {
            id,
            time: new Date().toLocaleTimeString(),
            title: action.kind.replaceAll('_', ' '),
            output: output || 'Completed',
            failed: false,
          },
          ...previous,
        ].slice(0, 100),
      );
      setNotice(`${action.kind.replaceAll('_', ' ')} completed`);
    } catch (e) {
      setError(String(e));
      setLogs((previous) =>
        [
          {
            id,
            time: new Date().toLocaleTimeString(),
            title: action.kind,
            output: String(e),
            failed: true,
          },
          ...previous,
        ].slice(0, 100),
      );
    } finally {
      setJob('');
      await refresh();
      setRevision((n) => n + 1);
    }
  }
  async function act(action: Action) {
    if (!active || job) return;
    if (!active.trusted) {
      setError('Trust this repository before running Git operations.');
      return;
    }
    if (destructive(action)) {
      try {
        const [token, detail] = await call<[string, string]>('preview', {
          repository: active.id,
          action,
        });
        setConfirmation({ repository: active.id, action, token, detail });
      } catch (e) {
        setError(String(e));
      }
    } else await perform(active.id, action);
  }
  return {
    repositories,
    active,
    activeId,
    setActiveId,
    snapshot,
    view,
    setView,
    error,
    setError,
    notice,
    setNotice,
    loading,
    job,
    logs,
    revision,
    confirmation,
    setConfirmation,
    refresh,
    open,
    close,
    trust,
    act,
    perform,
  };
}
