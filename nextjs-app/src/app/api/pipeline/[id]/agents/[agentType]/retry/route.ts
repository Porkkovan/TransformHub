import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

/**
 * POST /api/pipeline/[id]/agents/[agentType]/retry
 * Retry a failed agent in a pipeline execution.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentType: string }> }
) {
  try {
    await requireAuth();
    const { id, agentType } = await params;

    const res = await fetch(
      `${AGENT_SERVICE_URL}/api/v1/pipeline/${id}/agents/${agentType}/retry`,
      { method: "POST" }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to retry agent" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to retry agent:", error);
    return NextResponse.json(
      { error: "Failed to retry agent" },
      { status: 500 }
    );
  }
}
