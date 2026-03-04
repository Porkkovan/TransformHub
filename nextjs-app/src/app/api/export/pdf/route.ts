import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

/**
 * GET /api/export/pdf?reportType=<type>&executionId=<id>
 *
 * Generates a simple HTML report and returns it as a downloadable PDF-like
 * response. The content is generated from agent execution results.
 *
 * Supported reportTypes:
 *   - discovery, lean_vsm, risk_compliance, architecture,
 *     pipeline_summary, full_report
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("reportType") || "full_report";
    const executionId = searchParams.get("executionId");

    // Fetch execution results if an executionId is provided
    let reportData: Record<string, unknown> = {};
    if (executionId) {
      try {
        const res = await fetch(
          `${AGENT_SERVICE_URL}/api/v1/agents/results/${executionId}`
        );
        if (res.ok) {
          reportData = await res.json();
        }
      } catch {
        // Continue with empty data if fetch fails
      }
    }

    const title = formatReportTitle(reportType);
    const timestamp = new Date().toISOString();
    const outputHtml = reportData.output
      ? formatOutputAsHtml(reportData.output as Record<string, unknown>)
      : "<p>No data available for this report.</p>";

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title} - Digital Products Blueprint Creator Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a2e;
      padding: 48px;
      max-width: 900px;
      margin: 0 auto;
      line-height: 1.6;
    }
    .header {
      border-bottom: 3px solid #0891b2;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .header h1 { font-size: 28px; color: #0891b2; }
    .header .meta { font-size: 12px; color: #666; margin-top: 8px; }
    h2 { font-size: 20px; color: #1a1a2e; margin: 24px 0 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
    h3 { font-size: 16px; color: #333; margin: 16px 0 8px; }
    p { margin-bottom: 12px; }
    ul, ol { margin: 8px 0 16px 24px; }
    li { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; font-size: 13px; }
    th { background: #f5f5f5; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #999; text-align: center; }
    pre { background: #f7f7f7; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Blueprint Creator: ${title}</h1>
    <div class="meta">
      Generated: ${timestamp}
      ${executionId ? ` | Execution: ${executionId}` : ""}
      ${reportData.agent_type ? ` | Agent: ${reportData.agent_type}` : ""}
    </div>
  </div>

  <div class="content">
    ${outputHtml}
  </div>

  <div class="footer">
    Digital Products Blueprint Creator &mdash; Confidential
  </div>
</body>
</html>`.trim();

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="transformhub-${reportType}-${Date.now()}.html"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate PDF export:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

function formatReportTitle(reportType: string): string {
  return reportType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatOutputAsHtml(output: Record<string, unknown>): string {
  const sections: string[] = [];

  for (const [key, value] of Object.entries(output)) {
    const heading = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    if (Array.isArray(value)) {
      sections.push(`<h2>${heading}</h2>`);
      sections.push("<ul>");
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          sections.push(`<li><pre>${JSON.stringify(item, null, 2)}</pre></li>`);
        } else {
          sections.push(`<li>${String(item)}</li>`);
        }
      }
      sections.push("</ul>");
    } else if (typeof value === "object" && value !== null) {
      sections.push(`<h2>${heading}</h2>`);
      sections.push(`<pre>${JSON.stringify(value, null, 2)}</pre>`);
    } else {
      sections.push(`<h2>${heading}</h2>`);
      sections.push(`<p>${String(value)}</p>`);
    }
  }

  return sections.join("\n");
}
