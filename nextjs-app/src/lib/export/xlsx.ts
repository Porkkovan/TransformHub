import * as XLSX from "xlsx";

export interface ExportSheet {
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  colWidths?: number[];
}

export function buildXLSX(sheets: ExportSheet[]): Buffer {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const data = [
      sheet.headers,
      ...sheet.rows.map((r) => r.map((c) => (c == null ? "" : c))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Auto column widths
    const widths = sheet.colWidths
      ? sheet.colWidths
      : sheet.headers.map((h, i) => {
          const maxLen = Math.max(
            h.length,
            ...sheet.rows.slice(0, 200).map((r) => String(r[i] ?? "").length)
          );
          return Math.min(Math.max(maxLen + 2, 10), 60);
        });
    ws["!cols"] = widths.map((w) => ({ wch: w }));

    // Freeze top row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function pct(v: number | null | undefined): string {
  if (v == null) return "";
  return `${(v * 100).toFixed(1)}%`;
}

export function round2(v: number | null | undefined): string {
  if (v == null) return "";
  return v.toFixed(2);
}
