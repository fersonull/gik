import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { desktop } from './api';
export function useWindowChrome(theme: string, onError: (error: string) => void) {
  const [fullscreen, setFullscreen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const report = (promise: Promise<unknown>) => {
    void promise.catch((error) => onError(String(error)));
  };
  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const window = getCurrentWindow();
    const refresh = async () => {
      const [full, max] = await Promise.all([window.isFullscreen(), window.isMaximized()]);
      if (!disposed) {
        setFullscreen(full);
        setMaximized(max);
      }
    };
    report(refresh());
    void window
      .onResized(() => report(refresh()))
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  useEffect(() => {
    if (desktop)
      report(getCurrentWindow().setTheme(theme === 'light' || theme === 'dark' ? theme : null));
  }, [theme]);
  async function toggleFullscreen() {
    const next = desktop ? !(await getCurrentWindow().isFullscreen()) : !fullscreen;
    if (desktop) await getCurrentWindow().setFullscreen(next);
    setFullscreen(next);
  }
  return {
    fullscreen,
    maximized,
    toggleFullscreen: () => report(toggleFullscreen()),
    minimize: () => {
      if (desktop) report(getCurrentWindow().minimize());
    },
    toggleMaximize: () => {
      if (desktop) report(getCurrentWindow().toggleMaximize());
      else setMaximized((value) => !value);
    },
    close: () => {
      if (desktop) report(getCurrentWindow().close());
    },
  };
}
