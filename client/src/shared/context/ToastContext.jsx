import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef();

  const toast = useCallback((text) => {
    setMsg(String(text));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {/* The live region stays mounted and only its contents change. A region
          inserted at the same moment as its text is usually missed by screen
          readers — and several flows report failures through the toast alone.
          The wrapper has no box of its own; .toast is position:fixed. */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {msg && <div className="toast">{msg}</div>}
      </div>
    </ToastCtx.Provider>
  );
}
