import { useCallback, useEffect, useState } from "react";

// Last good result per `key`, kept for the life of the tab. A page that has
// been seen before draws from here at once and refreshes underneath, instead
// of showing a skeleton every time you come back to it.
const cache = new Map();
const MAX_ENTRIES = 60;

const remember = (key, data) => {
  cache.delete(key); // re-insert so the Map's order is least-recently-used first
  cache.set(key, data);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
};

// Called on sign-in and sign-out: one person's data must never be drawn for
// the next person on the same device.
export const clearLoadCache = () => cache.clear();

/**
 * The load half of a screen: run `fn`, then expose exactly one of loading /
 * error / ready. Before this every page wrote its own `.catch(() => setList([]))`,
 * which rendered a failed request as an empty result — a student with no
 * connection saw the same screen as a student with no courses.
 *
 *   const { status, data, error, reload, setData } = useLoad(
 *     () => api.get("/enrollments/mine").then((r) => r.data.enrollments),
 *     [id],
 *     { key: `enrollments:${id}` }
 *   );
 *
 * `key` (optional) turns on stale-while-revalidate: the last result for that
 * key is shown immediately as "ready" while a fresh one is fetched. If that
 * refresh fails the remembered data stays on screen rather than being
 * replaced by an error. Only pass a key when `fn` has no side effects.
 *
 * `setData` is for the common case of editing loaded data in place after a
 * mutation (a renamed course, a changed role) without a round trip; with a
 * key it updates the remembered copy too.
 */
export function useLoad(fn, deps = [], { key } = {}) {
  const [state, setState] = useState(() =>
    key && cache.has(key)
      ? { status: "ready", data: cache.get(key), error: null }
      : { status: "loading", data: null, error: null }
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const hit = !!key && cache.has(key);
    if (hit) {
      const data = cache.get(key);
      setState((s) => (s.status === "ready" && s.data === data ? s : { status: "ready", data, error: null }));
    } else {
      setState((s) => (s.status === "loading" ? s : { ...s, status: "loading", error: null }));
    }

    Promise.resolve()
      .then(fn)
      .then((data) => {
        if (key) remember(key, data);
        if (!cancelled) setState({ status: "ready", data, error: null });
      })
      .catch((error) => {
        if (cancelled || hit) return; // keep showing what we had
        setState({ status: "error", data: null, error });
      });

    return () => {
      cancelled = true;
    };
    // `fn` is intentionally not a dep — callers pass an inline arrow, which is
    // a new function every render and would loop. `deps` is the contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (update) =>
      setState((s) => {
        const data = typeof update === "function" ? update(s.data) : update;
        if (key) remember(key, data);
        return { ...s, data };
      }),
    [key]
  );

  return { ...state, reload, setData };
}

export default useLoad;
