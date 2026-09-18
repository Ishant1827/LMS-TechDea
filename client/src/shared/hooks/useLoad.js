import { useCallback, useEffect, useState } from "react";

/**
 * The load half of a screen: run `fn`, then expose exactly one of loading /
 * error / ready. Before this every page wrote its own `.catch(() => setList([]))`,
 * which rendered a failed request as an empty result — a student with no
 * connection saw the same screen as a student with no courses.
 *
 *   const { status, data, error, reload, setData } = useLoad(
 *     () => api.get("/enrollments/mine").then((r) => r.data.enrollments),
 *     [id]
 *   );
 *
 * `setData` is for the common case of editing loaded data in place after a
 * mutation (a renamed course, a changed role) without a round trip.
 */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => (s.status === "loading" ? s : { ...s, status: "loading", error: null }));

    Promise.resolve()
      .then(fn)
      .then((data) => !cancelled && setState({ status: "ready", data, error: null }))
      .catch((error) => !cancelled && setState({ status: "error", data: null, error }));

    return () => {
      cancelled = true;
    };
    // `fn` is intentionally not a dep — callers pass an inline arrow, which is
    // a new function every render and would loop. `deps` is the contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (update) =>
      setState((s) => ({
        ...s,
        data: typeof update === "function" ? update(s.data) : update,
      })),
    []
  );

  return { ...state, reload, setData };
}

export default useLoad;
