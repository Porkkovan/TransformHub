import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

/**
 * GET /api/export/csv?reportType=<type>&executionId=<id>
 *
 * Fetches agent execution results and returns them as a downloadable CSV file.
 * Flattens nested JSON output into rows and columns.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("reportType") || "full_report";
    const executionId = searchParams.get("executionId");

    if (!executionId) {
      return NextResponse.json(
        { error: "executionId query parameter is required" },
        { status: 400 }
      );
    }

    // Fetch execution results
    const res = await fetch(
      `${AGENT_SERVICE_URL}/api/v1/agents/results/${executionId}`
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to fetch execution results" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const output = data.output || {};

    const csv = convertToCsv(output, reportType);
    const filename = `transformhub-${reportType}-${executionId.slice(0, 8)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate CSV export:", error);
    return NextResponse.json(
      { error: "Failed to generate CSV export" },
      { status: 500 }
    );
  }
}

/**
 * Convert agent output JSON to CSV format.
 * Handles arrays of objects (each item becomes a row) and flat key-value pairs.
 */
function convertToCsv(
  output: Record<string, unknown>,
  reportType: string
): string {
  const rows: string[][] = [];

  // Try to find the best array to tabulate
  let bestArray: Record<string, unknown>[] | null = null;
  let bestKey = "";

  for (const [key, value] of Object.entries(output)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      if (!bestArray || value.length > bestArray.length) {
        bestArray = value as Record<string, unknown>[];
        bestKey = key;
      }
    }
  }

  if (bestArray && bestArray.length > 0) {
    // Extract headers from the first object
    const headers = collectHeaders(bestArray);
    rows.push(headers);

    for (const item of bestArray) {
      const row = headers.map((h) => formatCsvValue(flatGet(item, h)));
      rows.push(row);
    }
  } else {
    // Fall back to key-value pairs
    rows.push(["Section", "Key", "Value"]);

    for (const [section, value] of Object.entries(output)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          rows.push([
            formatCsvValue(section),
            formatCsvValue(k),
            formatCsvValue(v),
          ]);
        }
      } else if (Array.isArray(value)) {
        for (const item of value) {
          rows.push([
            formatCsvValue(section),
            "",
            formatCsvValue(item),
          ]);
        }
      } else {
        rows.push([formatCsvValue(section), "", formatCsvValue(value)]);
      }
    }
  }

  // Add metadata header
  const header = `# Digital Products Blueprint Creator ${reportType.replace(/_/g, " ")} Export\n# Generated: ${new Date().toISOString()}\n`;
  const csvBody = rows.map((row) => row.join(",")).join("\n");

  return header + csvBody;
}

function collectHeaders(items: Record<string, unknown>[]): string[] {
  const headerSet = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      headerSet.add(key);
    }
  }
  return Array.from(headerSet);
}

function flatGet(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Escape quotes and wrap in quotes if needed
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
