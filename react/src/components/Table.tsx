import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface TableProps extends Omit<ComponentProps<"div">, "children"> {
  columns: string[];
  rows: (string | number)[][];
  sortable?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ columns, rows, sortable, className, ...props }, ref) => (
    <div className={cn("db-table", sortable && "db-table--sortable", className)} {...props}>
      <table ref={ref}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
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

Table.displayName = "Table";
