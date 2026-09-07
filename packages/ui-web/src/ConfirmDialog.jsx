/* Confirmation dialog for actions that are hard or impossible to undo.

   `useConfirm()` returns [confirm, dialog]: call `await confirm({...})` and it
   resolves true or false, so a call site reads as a plain guard clause instead
   of a pile of state. Render `dialog` anywhere in the tree.

   The dialog is rendered only while it is open — never mounted-but-hidden. The
   Build Book records the prototype's worst bug as exactly that: `.sheet-layer`
   kept `display:flex` through the `hidden` attribute, leaving an invisible
   full-screen layer over the app that swallowed every click. */
import { useCallback, useEffect, useRef, useState } from 'react';

export function ConfirmDialog({
  open, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', busy = false, onConfirm, onCancel
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-layer"
      role="presentation"
      onMouseDown={(e) => {
        /* Backdrop click cancels, but only when the press started on the
           backdrop — otherwise a drag that ends outside would close it. */
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="confirm__title">{title}</div>
        {body && <div className="confirm__body">{body}</div>}
        <div className="confirm__foot">
          <button className="wbtn wbtn--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={`wbtn wbtn--${tone === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    setState(options);
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = useCallback((answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setState(null);
    setBusy(false);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={Boolean(state)}
      busy={busy}
      {...(state ?? {})}
      onCancel={() => settle(false)}
      onConfirm={() => { setBusy(true); settle(true); }}
    />
  );

  return [confirm, dialog];
}
