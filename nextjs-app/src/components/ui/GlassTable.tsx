"use client";

import React from "react";

interface GlassTableColumn {
  key: string;
  header: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface GlassTableProps {
  columns: GlassTableColumn[];
  data: Record<string, unknown>[];
}

export default function GlassTable({ columns, data }: GlassTableProps) {
  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-sm font-semibold text-slate-300"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-sm text-slate-200"
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
