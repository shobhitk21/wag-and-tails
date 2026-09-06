import { useCallback, useEffect, useState } from 'react';

/* Fetch-on-mount with loading, error and a manual reload. Deliberately small —
   the consoles read a screen's worth of JSON per route, so a cache layer would
   be weight without benefit. */
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
        if (!live || err.name === 'AbortError') return;
        setError(err);
        setLoading(false);
      });

    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload, setData };
}

/* Transient confirmation with the prototype's 2.4s lifetime. */
export function useToast() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(null), 2400);
    return () => clearTimeout(t);
  }, [message]);

  return [message, setMessage];
}
