import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({
  title,
  children,
  close,
  wide = false,
  motion = true,
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  motion?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const outside = useRef(false);
  const closing = useRef(false);
  const alive = useRef(true);
  const canAnimate = () =>
    motion &&
    document.documentElement.dataset.input !== 'keyboard' &&
    document.documentElement.dataset.motion !== 'off' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  function dismiss() {
    if (closing.current || !dismissible) return;
    closing.current = true;
    const dialog = ref.current!;
    if (canAnimate()) {
      dialog.getAnimations().forEach((animation) => animation.cancel());
      const animation = dialog.animate(
        [
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(4px) scale(.98)' },
        ],
        { duration: 140, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
      );
      void animation.finished
        .catch(() => {})
        .then(() => {
          if (alive.current) close();
        });
    } else close();
  }
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>('[data-autofocus],input:not([type=hidden]),textarea,select')
      ?.focus();
    if (canAnimate())
      dialog.animate(
        [
          { opacity: 0, transform: 'translateY(8px) scale(.97)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      );
    return () => {
      alive.current = false;
      dialog.getAnimations().forEach((animation) => animation.cancel());
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        outside.current =
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom);
      }}
      onClick={(event) => {
        if (outside.current && event.target === event.currentTarget) dismiss();
        outside.current = false;
      }}
      aria-labelledby={titleId}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={dismiss}
          disabled={!dismissible}
        >
          <X size={16} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export interface Field {
  name: string;
  label: string;
  value?: string;
  placeholder?: string;
  options?: string[];
  multiline?: boolean;
  required?: boolean;
}
export function fieldPlaceholder(title: string, field: Field): string {
  if (field.placeholder) return field.placeholder;
  if (field.name === 'name')
    return /remote/i.test(title) ? 'origin' : /tag/i.test(title) ? 'v1.0.0' : 'feature/my-change';
  return (
    (
      {
        url: 'https://github.com/owner/repository.git',
        path: 'C:\\Projects\\my-repository',
        branch: 'feature/my-change',
        start: 'HEAD',
        target: 'HEAD',
        revision: 'HEAD~1',
        upstream: 'origin/dev',
        message: 'Describe this change',
        old: 'feature/previous-name',
        oid: 'a1b2c3d',
      } as Record<string, string>
    )[field.name] || field.label
  );
}
export function FormDialog({
  title,
  fields,
  submit,
  close,
  label,
  busy = false,
  error,
}: {
  title: string;
  fields: Field[];
  submit: (values: Record<string, string>) => Promise<void> | void;
  close: () => void;
  label?: string;
  busy?: boolean;
  error?: string;
}) {
  return (
    <Modal title={title} close={close} dismissible={!busy}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const values = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<
            string,
            string
          >;
          void submit(values);
        }}
      >
        <div className="form-fields">
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {fields.map((f) => (
            <label key={f.name}>
              {f.label}
              {f.options ? (
                <select name={f.name} defaultValue={f.value}>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.multiline ? (
                <textarea
                  name={f.name}
                  defaultValue={f.value}
                  placeholder={fieldPlaceholder(title, f)}
                  required={f.required !== false}
                  rows={5}
                />
              ) : (
                <input
                  name={f.name}
                  defaultValue={f.value}
                  placeholder={fieldPlaceholder(title, f)}
                  required={f.required !== false}
                  autoComplete="off"
                />
              )}
            </label>
          ))}
        </div>
        <footer>
          <button type="button" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {label || title}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
