import { useEffect, useRef, useState, type ReactNode } from 'react';
import { save, saved } from '../useWorkbench';
export function SplitPane({
  storageKey,
  initial,
  className,
  children,
}: {
  storageKey: string;
  initial: number;
  className: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(saved(storageKey, initial));
  const clamp = (value: number) =>
    Math.max(240, Math.min((root.current?.clientWidth || 1000) - 280, value));
  useEffect(() => {
    const observer = new ResizeObserver(() => setSize((previous) => clamp(previous)));
    observer.observe(root.current!);
    return () => observer.disconnect();
  }, []);
  const update = (value: number) => {
    const next = clamp(value);
    setSize(next);
    save(storageKey, next);
  };
  return (
    <div
      ref={root}
      className={className}
      style={{ '--pane-size': `${size}px` } as React.CSSProperties}
    >
      {children}
      <div
        className="pane-resizer"
        role="separator"
        aria-label="List pane width"
        aria-orientation="vertical"
        aria-valuenow={size}
        aria-valuemin={240}
        aria-valuemax={Math.max(240, (root.current?.clientWidth || 1000) - 280)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            update(size + (e.key === 'ArrowLeft' ? -8 : 8));
          }
        }}
        onPointerDown={(e) => {
          const target = e.currentTarget;
          target.setPointerCapture(e.pointerId);
          const start = e.clientX;
          const current = size;
          const move = (event: PointerEvent) => update(current + event.clientX - start);
          const stop = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', stop);
            target.removeEventListener('pointercancel', stop);
          };
          target.addEventListener('pointermove', move);
          target.addEventListener('pointerup', stop);
          target.addEventListener('pointercancel', stop);
        }}
      />
    </div>
  );
}
