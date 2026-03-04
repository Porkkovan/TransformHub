import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

/**
 * GET /api/pipeline/[id] - Get pipeline execution status by ID.
 * Proxies to agent-service GET /api/v1/pipeline/status/{id}.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const res = await fetch(
      `${AGENT_SERVICE_URL}/api/v1/pipeline/status/${id}`
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Pipeline execution not found" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to get pipeline status:", error);
    return NextResponse.json(
      { error: "Failed to get pipeline status" },
      { status: 500 }
    );
  }
}
