import { Children, forwardRef, type ComponentProps, type MouseEventHandler } from "react";
import { cn } from "../utils/cn";
import { Button } from "./Button";

export interface ChangeSummaryFile {
  path: string;
  additions?: number;
  deletions?: number;
  status?: "added" | "modified" | "deleted";
}

export interface ChangeSummaryProps extends Omit<ComponentProps<"div">, "dangerouslySetInnerHTML"> {
  files: ChangeSummaryFile[];
  title?: string;
  description?: string;
  undoLabel?: string;
  undoDisabled?: boolean;
  onUndo?: MouseEventHandler<HTMLButtonElement>;
  onViewChanges?: MouseEventHandler<HTMLButtonElement>;
}

function normalizeChangeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value))) : 0;
}

function Counts({ className, additions, deletions }: { className: string; additions: number; deletions: number }) {
  return <span className={className}>
    <span className="db-change-summary__additions" role="img" aria-label={`${additions} additions`}>{`+${additions}`}</span>
    <span className="db-change-summary__deletions" role="img" aria-label={`${deletions} deletions`}>{`-${deletions}`}</span>
  </span>;
}

export const ChangeSummary = forwardRef<HTMLDivElement, ChangeSummaryProps>(function ChangeSummary({
  files, title, description, undoLabel = "Undo", undoDisabled = false, onUndo, onViewChanges, children, className, ...props
}, ref) {
  const rows = (Array.isArray(files) ? files : []).filter(file => file && !Array.isArray(file) && typeof file.path === "string");
  const totals = rows.reduce((total, file) => ({
    additions: Math.min(Number.MAX_SAFE_INTEGER, total.additions + normalizeChangeCount(file.additions)),
    deletions: Math.min(Number.MAX_SAFE_INTEGER, total.deletions + normalizeChangeCount(file.deletions)),
  }), { additions: 0, deletions: 0 });
  const heading = typeof title === "string" && title.trim() ? title : rows.length ? `Edited ${rows.length} file${rows.length === 1 ? "" : "s"}` : "No files changed";
  const hasActions = Boolean(onUndo || onViewChanges) || Children.toArray(children).length > 0;

  return <div role="group" aria-label={heading} {...props} ref={ref} data-db-react="" className={cn("db-change-summary", className)}>
    <div className="db-change-summary__header">
      <span className="db-change-summary__icon" aria-hidden="true"><i data-lucide="files" style={{ width: 16, height: 16 }} /></span>
      <div className="db-change-summary__heading">
        <div className="db-change-summary__title">{heading}</div>
        {description && <p className="db-change-summary__description">{description}</p>}
        <Counts className="db-change-summary__totals" {...totals} />
      </div>
      {hasActions && <div className="db-change-summary__actions">
        {onUndo && <Button variant="ghost" size="sm" icon="undo-2" disabled={undoDisabled} onClick={onUndo}>{undoLabel}</Button>}
        {onViewChanges && <Button variant="ghost" size="sm" icon="diff" onClick={onViewChanges}>View changes</Button>}
        {children}
      </div>}
    </div>
    <ul className="db-change-summary__files">
      {rows.map((file, index) => {
        const status = file.status && ["added", "modified", "deleted"].includes(file.status) ? file.status : undefined;
        return <li key={index} className="db-change-summary__file" data-status={status}>
          <span className="db-change-summary__path" title={file.path} aria-label={status ? `${file.path}, ${status}` : undefined}>{file.path}</span>
          <Counts className="db-change-summary__counts" additions={normalizeChangeCount(file.additions)} deletions={normalizeChangeCount(file.deletions)} />
        </li>;
      })}
    </ul>
  </div>;
});

ChangeSummary.displayName = "ChangeSummary";
