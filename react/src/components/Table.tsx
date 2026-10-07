import { forwardRef, useState, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface TableProps extends Omit<ComponentProps<"div">, "children"> {
  columns: string[];
  rows: (string | number)[][];
  sortable?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ columns, rows, sortable, className, style, ...props }, ref) => {
    const [sort, setSort] = useState<{ column: number; direction: "ascending" | "descending" } | null>(null);
    const activeSort = sortable && sort && sort.column < columns.length ? sort : null;
    const ordered = rows.map((row, index) => ({ row, index }));
    if (activeSort) ordered.sort((a, b) => {
      const left = a.row[activeSort.column] ?? "";
      const right = b.row[activeSort.column] ?? "";
      const numeric = String(left).trim() !== "" && String(right).trim() !== "" && Number.isFinite(Number(left)) && Number.isFinite(Number(right));
      const compare = numeric ? Number(left) - Number(right) : String(left).localeCompare(String(right), undefined, { numeric: true });
      return (activeSort.direction === "ascending" ? compare : -compare) || a.index - b.index;
    });
    return (
    <div data-db-react="" className={cn("db-table", sortable && "db-table--sortable", className)} style={{ overflowX: "auto", ...style }} {...props}>
      <table ref={ref} style={{ width: "100%" }}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} scope="col" aria-sort={activeSort?.column === i ? activeSort.direction : undefined}>
                {sortable ? <button type="button" className="db-btn db-btn--ghost" aria-label={`Sort by ${col}`} onClick={() => setSort({ column: i, direction: activeSort?.column === i && activeSort.direction === "ascending" ? "descending" : "ascending" })}>{col}</button> : col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map(({ row, index: i }) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    );
  },
);

Table.displayName = "Table";
