import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toastState, setToastState] = useState(null); // { text, tone }
  const timer = useRef();

  // toast("Enrolled") for the happy path, toast(err.message, "error") for a
  // failure. The two used to render identically, so "Can't reach the server"
  // looked exactly as reassuring as "Saved".
  const toast = useCallback((text, tone = "info") => {
    setToastState({ text: String(text), tone });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastState(null), tone === "error" ? 4200 : 2600);
  }, []);

  const shown = (tone) => (toastState?.tone === tone ? toastState.text : null);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {/* Both live regions stay mounted and only their contents change. A region
          inserted at the same moment as its text is usually missed by screen
          readers — and several flows report failures through the toast alone.
          Errors go to the assertive region so they interrupt; everything else
          waits its turn. The wrappers have no box of their own; .toast is
          position:fixed. */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {shown("info") && <div className="toast">{shown("info")}</div>}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true">
        {shown("error") && <div className="toast toast--error">{shown("error")}</div>}
      </div>
    </ToastCtx.Provider>
  );
}
