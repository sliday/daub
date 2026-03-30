import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Toast } from "./Toast";

interface ToastItem {
  id: string;
  type?: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  duration: number;
}

interface ToastOpts {
  type?: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: ToastOpts) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let uid = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: ToastOpts) => {
    const id = `toast-${++uid}`;
    const duration = opts.duration ?? 4000;
    const item: ToastItem = { id, type: opts.type, title: opts.title, message: opts.message, duration };
    setToasts((prev) => [...prev, item]);
    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    }
  }, [dismiss]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div className="db-toast-stack">
            {toasts.map((t) => (
              <Toast key={t.id} id={t.id} type={t.type} title={t.title} message={t.message} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
