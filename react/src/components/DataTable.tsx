import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { useControllable } from "../hooks/useControllable";

export interface DataTableColumn {
  label: string;
  sortable?: boolean;
}

export interface DataTableProps extends Omit<ComponentProps<"div">, "children"> {
  columns: DataTableColumn[];
  rows: (string | number)[][];
  selectable?: boolean;
  sort?: { column: number; direction: "ascending" | "descending" } | null;
  defaultSort?: { column: number; direction: "ascending" | "descending" } | null;
  onSortChange?: (sort: { column: number; direction: "ascending" | "descending" } | null) => void;
  selectedRows?: number[];
  defaultSelectedRows?: number[];
  onSelectionChange?: (rows: number[]) => void;
  selectAllLabel?: string;
  getRowLabel?: (row: (string | number)[], index: number) => string;
}

export const DataTable = forwardRef<HTMLTableElement, DataTableProps>(
  ({ columns, rows, selectable, sort, defaultSort = null, onSortChange, selectedRows, defaultSelectedRows = [], onSelectionChange, selectAllLabel = "Select all rows", getRowLabel, className, style, ...props }, ref) => {
    const [sorting, setSorting] = useControllable(sort, defaultSort, onSortChange);
    const [selection, setSelection] = useControllable(selectedRows, defaultSelectedRows, onSelectionChange);
    const selected = new Set(selection.filter(index => Number.isInteger(index) && index >= 0 && index < rows.length));
    const allSelected = rows.length > 0 && selected.size === rows.length;
    const activeSort = sorting && columns[sorting.column]?.sortable ? sorting : null;
    const ordered = rows.map((row, index) => ({ row, index }));
    if (activeSort) ordered.sort((a, b) => {
      const left = a.row[activeSort.column] ?? "";
      const right = b.row[activeSort.column] ?? "";
      const numeric = String(left).trim() !== "" && String(right).trim() !== "" && Number.isFinite(Number(left)) && Number.isFinite(Number(right));
      const compare = numeric ? Number(left) - Number(right) : String(left).localeCompare(String(right), undefined, { numeric: true });
      return (activeSort.direction === "ascending" ? compare : -compare) || a.index - b.index;
    });
    const toggleSort = (column: number) => setSorting({ column, direction: activeSort?.column === column && activeSort.direction === "ascending" ? "descending" : "ascending" });
    return (
    <div data-db-react="" className={cn("db-data-table", className)} style={{ overflowX: "auto", ...style }} {...props}>
      <table ref={ref} style={{ width: "100%" }}>
        <thead>
          <tr>
            {selectable && (
              <th scope="col">
                <input
                  type="checkbox"
                  className="db-data-table__check"
                  aria-label={selectAllLabel}
                  checked={allSelected}
                  disabled={rows.length === 0}
                  ref={(node) => { if (node) node.indeterminate = selected.size > 0 && !allSelected; }}
                  onChange={(event) => setSelection(event.target.checked ? rows.map((_, index) => index) : [])}
                />
              </th>
            )}
            {columns.map((col, i) => (
              <th key={i} scope="col" data-sortable={col.sortable || undefined} aria-sort={activeSort?.column === i ? activeSort.direction : undefined}>
                {col.sortable ? (
                  <button type="button" className="db-btn db-btn--ghost" aria-label={`Sort by ${col.label}`} onClick={() => toggleSort(i)}>
                    {col.label}<span className="db-data-table__sort" aria-hidden="true">{"\u2191"}</span>
                  </button>
                ) : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map(({ row, index: i }) => (
            <tr key={i} data-selected={selectable && selected.has(i) ? "" : undefined}>
              {selectable && (
                <td>
                  <input type="checkbox" className="db-data-table__check" aria-label={getRowLabel?.(row, i) ?? `Select row ${i + 1}`} checked={selected.has(i)} onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(i); else next.delete(i);
                    setSelection([...next].sort((a, b) => a - b));
                  }} />
                </td>
              )}
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="db-data-table__empty" colSpan={Math.max(1, columns.length + (selectable ? 1 : 0))}>No data</td></tr>}
        </tbody>
      </table>
    </div>
    );
  },
);

DataTable.displayName = "DataTable";
