import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { call, desktop } from '../api';
import '@xterm/xterm/css/xterm.css';
export function Terminal({
  repository,
  active,
  motion,
}: {
  repository: string;
  active: boolean;
  motion: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const terminal = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let id: string | undefined;
    let unlisten: (() => void) | undefined;
    let unexit: (() => void) | undefined;
    const pending = new Map<string, number[][]>();
    const xterm = new XTerminal({
      screenReaderMode: true,
      fontFamily: 'Cascadia Code, Consolas, monospace',
      fontSize: 13,
      cursorBlink: motion && !matchMedia('(prefers-reduced-motion: reduce)').matches,
      scrollback: 5000,
      allowProposedApi: false,
      theme: {
        background: '#202022',
        foreground: '#ededf0',
        cursor: '#9bbfff',
        selectionBackground: '#355486',
      },
    });
    terminal.current = xterm;
    const fit = new FitAddon();
    fitRef.current = fit;
    xterm.loadAddon(fit);
    xterm.open(element.current!);
    const observer = new ResizeObserver(() => {
      if (element.current?.offsetWidth) {
        fit.fit();
        if (id)
          void call('terminal_resize', { id, rows: xterm.rows, cols: xterm.cols }).catch((e) =>
            setError(String(e)),
          );
      }
    });
    observer.observe(element.current!);
    async function start() {
      unlisten = await listen<{ id: string; data: number[] }>('terminal-output', (event) => {
        if (event.payload.id === id) xterm.write(Uint8Array.from(event.payload.data));
        else if (!id) {
          const chunks = pending.get(event.payload.id) ?? [];
          if (chunks.length < 64) chunks.push(event.payload.data);
          pending.set(event.payload.id, chunks);
        }
      });
      unexit = await listen<string>('terminal-exit', (event) => {
        if (event.payload === id)
          xterm.writeln(
            '\r\n[Shell exited. Close and reopen the terminal to start another session.]',
          );
      });
      if (disposed) {
        unlisten();
        unexit();
        return;
      }
      id = await call<string>('terminal_open', { repository });
      if (disposed) {
        await call('terminal_close', { id });
        return;
      }
      for (const chunk of pending.get(id) ?? []) xterm.write(Uint8Array.from(chunk));
      pending.clear();
      fit.fit();
      await call('terminal_resize', { id, rows: xterm.rows, cols: xterm.cols });
      xterm.onData((data) => {
        void call('terminal_write', { id, data }).catch((e) => setError(String(e)));
      });
    }
    void start().catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      observer.disconnect();
      unlisten?.();
      unexit?.();
      if (id) void call('terminal_close', { id }).catch(() => {});
      xterm.dispose();
    };
  }, [repository]);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (terminal.current) terminal.current.options.cursorBlink = motion && !reduced.matches;
    };
    apply();
    reduced.addEventListener('change', apply);
    return () => reduced.removeEventListener('change', apply);
  }, [motion]);
  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => {
        fitRef.current?.fit();
      });
    }
  }, [active]);
  return (
    <div className="terminal-surface" hidden={!active}>
      {!desktop ? (
        <p className="terminal-notice">
          The browser preview is read-only. The desktop app opens a real PowerShell session in this
          repository.
        </p>
      ) : (
        <div ref={element} className="terminal-host" />
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
