import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

/**
 * DELETE /api/dead-letter/[id] - Delete a dead letter job.
 * Proxies to agent-service DELETE /api/v1/dead-letter/{id}.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const res = await fetch(
      `${AGENT_SERVICE_URL}/api/v1/dead-letter/${id}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to delete dead letter job" },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete dead letter job:", error);
    return NextResponse.json(
      { error: "Failed to delete dead letter job" },
      { status: 500 }
    );
  }
}
