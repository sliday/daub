import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface DataTableColumn {
  label: string;
  sortable?: boolean;
}

export interface DataTableProps extends Omit<ComponentProps<"div">, "children"> {
  columns: DataTableColumn[];
  rows: (string | number)[][];
  selectable?: boolean;
}

export const DataTable = forwardRef<HTMLTableElement, DataTableProps>(
  ({ columns, rows, selectable, className, ...props }, ref) => (
    <div className={cn("db-data-table", className)} {...props}>
      <table ref={ref}>
        <thead>
          <tr>
            {selectable && (
              <th>
                <input type="checkbox" />
              </th>
            )}
            {columns.map((col, i) => (
              <th key={i} data-sortable={col.sortable || undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {selectable && (
                <td>
                  <input type="checkbox" />
                </td>
              )}
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
);

DataTable.displayName = "DataTable";
