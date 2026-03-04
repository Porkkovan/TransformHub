import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

/**
 * GET /api/dead-letter - List dead letter jobs.
 * Proxies to agent-service GET /api/v1/dead-letter.
 */
export async function GET() {
  try {
    await requireAuth();

    const res = await fetch(`${AGENT_SERVICE_URL}/api/v1/dead-letter`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to fetch dead letter jobs" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch dead letter jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch dead letter jobs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dead-letter - Retry a dead letter job.
 * Body: { jobId: string }
 * Proxies to agent-service POST /api/v1/dead-letter/{jobId}/retry.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const res = await fetch(
      `${AGENT_SERVICE_URL}/api/v1/dead-letter/${jobId}/retry`,
      { method: "POST" }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to retry job" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to retry dead letter job:", error);
    return NextResponse.json(
      { error: "Failed to retry dead letter job" },
      { status: 500 }
    );
  }
}
