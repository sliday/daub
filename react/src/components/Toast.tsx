import { cn } from "../utils/cn";

export interface ToastProps {
  id: string;
  type?: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  onDismiss: (id: string) => void;
  dismissLabel?: string;
  role?: "status" | "alert";
}

export function Toast({ id, type = "info", title, message, onDismiss, dismissLabel = "Dismiss notification", role }: ToastProps) {
  return (
    <div data-db-react="" role={role ?? (type === "error" ? "alert" : "status")} aria-atomic="true" className={cn("db-toast", `db-toast--${type}`)}>
      <div className="db-toast__content">
        {title && <strong>{title}</strong>}
        <span>{message}</span>
      </div>
      <button type="button" aria-label={dismissLabel} className="db-btn db-btn--ghost db-btn--icon" onClick={() => onDismiss(id)}>
        &times;
      </button>
    </div>
  );
}
