import React from "react";
import { cn } from "@/lib/utils";

type CompareRow = {
  label: string;
  values: string[];
};

type CompareTableProps = {
  columns: string[];
  rows: CompareRow[];
  className?: string;
};

export function CompareTable({ columns, rows, className }: CompareTableProps) {
  const [localRows, setLocalRows] = React.useState<CompareRow[]>(rows);

  const handleEdit = (rowIndex: number, colIndex: number, value: string) => {
    setLocalRows((prev) =>
      prev.map((row, idx) =>
        idx === rowIndex
          ? {
              ...row,
              values: row.values.map((cell, cIdx) =>
                cIdx === colIndex ? value : cell
              ),
            }
          : row
      )
    );
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-inner",
        "dark:border-white/10 dark:bg-white/5",
        className
      )}
    >
      <table className="min-w-full text-sm text-foreground">
        <thead className="bg-muted/40 text-muted-foreground dark:bg-white/5 dark:text-white/80">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">
              Critere
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {localRows.map((row, rowIndex) => (
            <tr key={row.label} className="border-t border-border dark:border-white/5">
              <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
              {row.values.map((value, colIndex) => (
                <td key={`${row.label}-${colIndex}`} className="px-4 py-3">
                  <input
                    value={value}
                    onChange={(e) => handleEdit(rowIndex, colIndex, e.target.value)}
                    className="w-full rounded-lg bg-background border border-border px-2 py-1 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-white/5 dark:border-white/10 dark:text-white"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border dark:border-white/10">
        Modifiable localement pour preparer une reco rapide.
      </div>
    </div>
  );
}
