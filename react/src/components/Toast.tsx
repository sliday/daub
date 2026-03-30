import { cn } from "../utils/cn";

export interface ToastProps {
  id: string;
  type?: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  onDismiss: (id: string) => void;
}

export function Toast({ id, type = "info", title, message, onDismiss }: ToastProps) {
  return (
    <div className={cn("db-toast", `db-toast--${type}`)}>
      <div className="db-toast__content">
        {title && <strong>{title}</strong>}
        <span>{message}</span>
      </div>
      <button className="db-btn db-btn--ghost db-btn--icon" onClick={() => onDismiss(id)}>
        &times;
      </button>
    </div>
  );
}
