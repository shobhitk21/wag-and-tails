/* Form dialog for the console's create and edit actions.

   Deliberately built on the same `.confirm-layer` / `.confirm` shell and the
   same `.field` markup the rest of the console already uses, so adding these
   flows introduced no new visual vocabulary — a create dialog looks like the
   confirm dialog with fields in it, because that is what it is.

   Like ConfirmDialog, it is only ever in the DOM while open. The Build Book
   records the prototype's worst bug as a dialog layer that stayed mounted with
   `display:flex` under a `hidden` attribute, leaving an invisible full-screen
   sheet that swallowed every click on the page behind it.

   `useFormDialog()` returns [openForm, dialog]. `await openForm({...})`
   resolves to the submitted values, or null if it was cancelled, so a call
   site reads as a guard clause:

     const values = await openForm({ title: 'New coupon', fields: [...] });
     if (!values) return;
*/
import { useCallback, useEffect, useRef, useState } from 'react';

export function FormDialog({
  open, title, body, fields = [], submitLabel = 'Save', cancelLabel = 'Cancel',
  busy = false, error = null, fieldErrors = null, onSubmit, onCancel
}) {
  const [values, setValues] = useState({});
  const firstRef = useRef(null);

  /* Reset to the defaults each time it opens, so a cancelled edit does not
     leave its half-typed values behind for the next one. */
  useEffect(() => {
    if (!open) return;
    const initial = {};
    for (const f of fields) initial[f.name] = f.value ?? (f.type === 'checkbox' ? false : '');
    setValues(initial);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const set = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    onSubmit?.(values);
  };

  return (
    <div
      className="confirm-layer"
      role="presentation"
      onMouseDown={(e) => {
        /* Only a press that both starts and ends on the backdrop cancels, so
           selecting text inside the dialog and releasing outside does not
           throw the form away. */
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <form className="confirm" onSubmit={submit} aria-label={title}>
        <div className="confirm__title">{title}</div>
        {body && <div className="confirm__body">{body}</div>}

        <div className="formgrid">
          {fields.map((f, i) => {
            const problem = fieldErrors?.[f.name]?.[0];
            const common = {
              ref: i === 0 ? firstRef : undefined,
              className: 'field__input',
              value: values[f.name] ?? '',
              onChange: (e) => set(f.name, e.target.value),
              placeholder: f.placeholder,
              disabled: busy
            };

            return (
              <div key={f.name} className={f.wide ? 'formgrid__wide' : undefined}>
                {f.label && <div className="formlabel">{f.label}</div>}

                {f.type === 'select' ? (
                  <div className="field">
                    <select {...common}>
                      {f.placeholder && <option value="">{f.placeholder}</option>}
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ) : f.type === 'textarea' ? (
                  <div className="field"><textarea rows={3} {...common} /></div>
                ) : f.type === 'checkbox' ? (
                  <label className="formcheck">
                    <input
                      type="checkbox"
                      checked={Boolean(values[f.name])}
                      onChange={(e) => set(f.name, e.target.checked)}
                      disabled={busy}
                    />
                    <span>{f.checkboxLabel ?? f.label}</span>
                  </label>
                ) : (
                  <div className="field">
                    <input type={f.type ?? 'text'} inputMode={f.inputMode} {...common} />
                  </div>
                )}

                {(problem || f.hint) && (
                  <div className={problem ? 'formhint is-bad' : 'formhint'}>
                    {problem ?? f.hint}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* The API's own message, so a refusal says what was actually wrong
            rather than "something went wrong". */}
        {error && <div className="formerror">{error}</div>}

        <div className="confirm__foot">
          <button type="button" className="wbtn wbtn--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="submit" className="wbtn wbtn--primary" disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/* The dialog stays open when the API refuses, showing the reason against the
   field that caused it — closing it would throw away everything just typed. It
   closes only on success or cancel. */
export function useFormDialog() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState(null);
  const resolver = useRef(null);

  const openForm = useCallback((options) => {
    setState(options);
    setError(null);
    setFieldErrors(null);
    setBusy(false);
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
    setBusy(false);
    setError(null);
    setFieldErrors(null);
  }, []);

  const dialog = (
    <FormDialog
      open={Boolean(state)}
      busy={busy}
      error={error}
      fieldErrors={fieldErrors}
      {...(state ?? {})}
      onCancel={() => close(null)}
      onSubmit={async (values) => {
        /* `submit` does the API call so the dialog can stay open and show the
           error. Without one, the caller gets the values and closes it. */
        if (!state?.submit) return close(values);

        setBusy(true);
        setError(null);
        setFieldErrors(null);
        try {
          const result = await state.submit(values);
          close(result ?? values);
        } catch (err) {
          setError(err.message);
          setFieldErrors(err.details ?? null);
          setBusy(false);
        }
        return undefined;
      }}
    />
  );

  return [openForm, dialog];
}
