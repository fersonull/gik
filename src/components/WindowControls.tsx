import { Minus, Square, Copy, X } from 'lucide-react';
export function WindowControls({
  maximized,
  minimize,
  toggleMaximize,
  close,
}: {
  maximized: boolean;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
}) {
  return (
    <div className="window-controls" role="group" aria-label="Window controls">
      <button className="window-control" aria-label="Minimize window" onClick={minimize}>
        <Minus size={15} />
      </button>
      <button
        className="window-control"
        aria-label={maximized ? 'Restore window' : 'Maximize window'}
        onClick={toggleMaximize}
      >
        {maximized ? <Copy size={13} /> : <Square size={13} />}
      </button>
      <button className="window-control window-close" aria-label="Close window" onClick={close}>
        <X size={17} />
      </button>
    </div>
  );
}
