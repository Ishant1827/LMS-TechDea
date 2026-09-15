import { useEffect, useState } from "react";

// Subscribe to a CSS media query from JS, so a layout can switch structure
// (e.g. table -> cards) instead of only restyling.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches); // re-sync in case it changed before we subscribed
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// Below this width a data table stops being usable and becomes a card list.
export const useIsNarrow = () => useMediaQuery("(max-width: 700px)");
