import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onCancel={close}
      aria-labelledby="dialog-title"
    >
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={close}>
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
export function FormDialog({
  title,
  fields,
  submit,
  close,
  label = 'Apply',
}: {
  title: string;
  fields: Field[];
  submit: (values: Record<string, string>) => Promise<void> | void;
  close: () => void;
  label?: string;
}) {
  return (
    <Modal title={title} close={close}>
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
                  placeholder={f.placeholder}
                  required={f.required !== false}
                  rows={5}
                />
              ) : (
                <input
                  name={f.name}
                  defaultValue={f.value}
                  placeholder={f.placeholder}
                  required={f.required !== false}
                  autoComplete="off"
                />
              )}
            </label>
          ))}
        </div>
        <footer>
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" type="submit">
            {label}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
