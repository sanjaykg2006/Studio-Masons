"use client";

/**
 * Lightweight, app-wide notification system — the standard way to surface
 * successes and failures to the user without bespoke per-page UI.
 *
 *   const toast = useToast();
 *   toast.success("Vendor added");
 *   toast.error("Couldn't save", "Your browser blocked local storage.");
 *
 * Wrap the tree once in <ToastProvider> (done in the ERP layout) and the
 * <Toaster> renders fixed, stacked, top-right above everything else.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  /** Auto-dismiss after this many ms. 0 keeps it until the user closes it. */
  duration: number;
}

interface ToastInput {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  notify: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const META: Record<
  ToastType,
  { icon: string; color: string; bg: string; border: string }
> = {
  success: { icon: "check_circle", color: "#16a34a", bg: "#f1fdf5", border: "rgba(22,163,74,0.3)" },
  error:   { icon: "error",        color: "#ba1a1a", bg: "#fff5f4", border: "rgba(186,26,26,0.3)" },
  warning: { icon: "warning",      color: "#b45309", bg: "#fffbeb", border: "rgba(180,83,9,0.3)" },
  info:    { icon: "info",         color: "#0059a8", bg: "#f0f7ff", border: "rgba(0,89,168,0.3)" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (input: ToastInput) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const toast: Toast = {
        id,
        type: input.type ?? "info",
        title: input.title,
        message: input.message,
        duration: input.duration ?? 5000,
      };
      setToasts((prev) => [...prev, toast]);
      if (toast.duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), toast.duration));
      }
      return id;
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    notify,
    dismiss,
    success: (title, message) => notify({ type: "success", title, message }),
    // Failures linger a little longer so they're not missed.
    error: (title, message) => notify({ type: "error", title, message, duration: 8000 }),
    warning: (title, message) => notify({ type: "warning", title, message, duration: 7000 }),
    info: (title, message) => notify({ type: "info", title, message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 9999, // above modals (z 100) and the FAB (z 50)
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "360px",
        maxWidth: "calc(100vw - 32px)",
        pointerEvents: "none",
      }}
    >
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}`}</style>
      {toasts.map((t) => {
        const m = META[t.type];
        return (
          <div
            key={t.id}
            role="alert"
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "14px 16px",
              background: m.bg,
              border: `1px solid ${m.border}`,
              borderLeft: `3px solid ${m.color}`,
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              animation: "toast-in 0.2s ease-out",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "20px", color: m.color, flexShrink: 0, marginTop: "1px" }}
            >
              {m.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#333333", lineHeight: 1.4 }}>
                {t.title}
              </p>
              {t.message && (
                <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px", lineHeight: 1.5 }}>
                  {t.message}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#999999",
                display: "flex",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                close
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
