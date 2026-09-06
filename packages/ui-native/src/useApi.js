import { useCallback, useEffect, useState } from 'react';

/* Fetch-on-focus-safe data hook with loading, error and a manual reload.
   Deliberately small — each screen reads one endpoint. */
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(fn)
      .then((result) => { if (live) { setData(result); setLoading(false); } })
      .catch((err) => {
        if (!live) return;
        setError(err);
        setLoading(false);
      });

    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload, setData };
}

/* Polls while `active` is true — used by the live walk screens on both sides,
   which read the same walk row. */
export function usePolling(fn, intervalMs, active) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!active) return undefined;
    let live = true;

    const tick = () => {
      Promise.resolve()
        .then(fn)
        .then((r) => { if (live) setData(r); })
        .catch(() => {});
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => { live = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, intervalMs]);

  return data;
}

/* Transient confirmation, 2.4s, matching toast() in the prototype. Returns
   [message, setMessage] — call setMessage(text) to show one; it clears itself. */
export function useToast() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(null), 2400);
    return () => clearTimeout(t);
  }, [message]);

  return [message, setMessage];
}
