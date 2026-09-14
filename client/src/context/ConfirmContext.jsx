import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "../components/Modal";

// confirm({ title, message, detail, confirmLabel, danger }) -> Promise<boolean>
// Drop-in replacement for window.confirm() that uses the app's own dialog.
const ConfirmCtx = createContext(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    const o = typeof opts === "string" ? { message: opts } : opts || {};
    return new Promise((resolve) => {
      resolver.current = resolve;
      setReq({
        title: "Are you sure?",
        confirmLabel: "Confirm",
        cancelLabel: "Cancel",
        danger: false,
        ...o,
      });
    });
  }, []);

  const settle = (value) => {
    setReq(null);
    const r = resolver.current;
    resolver.current = null;
    r?.(value);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {req && (
        <Modal title={req.title} onClose={() => settle(false)}>
          {req.message && <p className="confirm-body">{req.message}</p>}
          {req.detail && <p className="confirm-detail">{req.detail}</p>}
          <div className="confirm-actions">
            <button className="btn btn-secondary" onClick={() => settle(false)}>
              {req.cancelLabel}
            </button>
            <button
              className={"btn " + (req.danger ? "btn-danger" : "btn-primary")}
              onClick={() => settle(true)}
            >
              {req.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
