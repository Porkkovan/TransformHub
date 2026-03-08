import fs from "fs/promises";
import path from "path";

/**
 * Converts a CSV string into structured readable text, preserving column headers.
 * Each row is formatted as "Header1: Value1 | Header2: Value2 | ..."
 * This lets Claude understand the structure of uploaded process step spreadsheets.
 */
function csvToStructuredText(raw: string): string {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return raw;

  // Detect delimiter: comma, semicolon, or tab
  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : firstLine.includes(";")
    ? ";"
    : ",";

  const parseRow = (line: string): string[] =>
    line.split(delimiter).map((cell) => cell.replace(/^"|"$/g, "").trim());

  const headers = parseRow(firstLine);

  // If there's only one column or no recognizable headers, return raw text
  if (headers.length <= 1) return raw;

  const output: string[] = [`SPREADSHEET: ${headers.length} columns, ${lines.length - 1} rows`];
  output.push(`Columns: ${headers.join(" | ")}`);
  output.push("");

  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    const rowParts: string[] = [];
    headers.forEach((header, idx) => {
      const value = cells[idx] ?? "";
      if (value) rowParts.push(`${header}: ${value}`);
    });
    if (rowParts.length > 0) {
      output.push(`Row ${i}: ${rowParts.join(" | ")}`);
    }
  }

  return output.join("\n");
}

/**
 * Extracts text content from a file based on its extension.
 * Supports: .txt, .md, .csv, .json, .pdf, .xlsx, .xls
 */
export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  switch (ext) {
    case ".txt":
    case ".md":
      return buffer.toString("utf-8");

    case ".csv": {
      const raw = buffer.toString("utf-8");
      return csvToStructuredText(raw);
    }

    case ".json": {
      const parsed = JSON.parse(buffer.toString("utf-8"));
      return JSON.stringify(parsed, null, 2);
    }

    case ".xlsx":
    case ".xls": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require("xlsx") as typeof import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });

      const sheetTexts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        // Convert sheet to CSV then to structured text
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        const structured = csvToStructuredText(csv);
        sheetTexts.push(`=== Sheet: ${sheetName} ===\n${structured}`);
      }
      return sheetTexts.join("\n\n") || "[Excel file contained no readable content]";
    }

    case ".pdf": {
      // Basic PDF text extraction — extracts text between parentheses in PDF streams.
      // This is a simplified placeholder; for production use, integrate a proper PDF library.
      const raw = buffer.toString("latin1");
      const textParts: string[] = [];
      const regex = /\(([^)]*)\)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(raw)) !== null) {
        const decoded = match[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")");
        if (decoded.trim()) {
          textParts.push(decoded);
        }
      }
      return textParts.join(" ") || "[PDF text extraction returned no content]";
    }

    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

interface TextChunk {
  content: string;
  chunkIndex: number;
  metadata: {
    source: string;
    charStart: number;
    charEnd: number;
  };
}

/**
 * Splits text into overlapping chunks for embedding/indexing.
 * For structured spreadsheet text, tries to keep rows together.
 * Default: 2000 chars per chunk, 400 char overlap.
 */
export function chunkText(
  text: string,
  source: string,
  chunkSize = 2000,
  overlap = 400
): TextChunk[] {
  const chunks: TextChunk[] = [];

  if (!text || text.trim().length === 0) {
    return chunks;
  }

  // For structured spreadsheet text, chunk by row groups to avoid splitting mid-row
  if (text.startsWith("SPREADSHEET:") || text.startsWith("=== Sheet:")) {
    const lines = text.split("\n");
    let current = "";
    let charStart = 0;
    let chunkIndex = 0;

    for (const line of lines) {
      const candidate = current ? current + "\n" + line : line;
      if (candidate.length > chunkSize && current.length > 0) {
        chunks.push({
          content: current.trim(),
          chunkIndex,
          metadata: { source, charStart, charEnd: charStart + current.length },
        });
        chunkIndex++;
        charStart += current.length - overlap;
        // Start new chunk with overlap — keep last N chars
        const overlapText = current.slice(-overlap);
        current = overlapText + "\n" + line;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) {
      chunks.push({
        content: current.trim(),
        chunkIndex,
        metadata: { source, charStart, charEnd: charStart + current.length },
      });
    }
    return chunks;
  }

  // Default character-based chunking for prose/unstructured text
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const content = text.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        chunkIndex,
        metadata: {
          source,
          charStart: start,
          charEnd: end,
        },
      });
      chunkIndex++;
    }

    if (end >= text.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}
