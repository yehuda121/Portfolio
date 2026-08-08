import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import "./Toast.css";

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = "info", durationMs = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (durationMs > 0) {
      window.setTimeout(() => dismiss(id), durationMs);
    }
  }, [dismiss]);

  const value = useMemo(
    () => ({
      showToast,
      showSuccess: (msg) => showToast(msg, "success"),
      showError: (msg) => showToast(msg, "error"),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item toast-item-${toast.type}`} role="status">
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
