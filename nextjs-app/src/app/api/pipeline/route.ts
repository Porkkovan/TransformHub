import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

/**
 * POST /api/pipeline - Execute a full agent pipeline.
 * Proxies to the agent-service POST /api/v1/pipeline/execute.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    const res = await fetch(`${AGENT_SERVICE_URL}/api/v1/pipeline/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repository_url: body.repositoryUrl,
        repository_id: body.repositoryId,
        input_data: body.inputData || {},
        halt_on_failure: body.haltOnFailure ?? true,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Pipeline execution failed" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 202 });
  } catch (error) {
    console.error("Failed to execute pipeline:", error);
    return NextResponse.json(
      { error: "Failed to execute pipeline" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pipeline?id=<pipeline_execution_id> - Get pipeline status.
 * Proxies to agent-service GET /api/v1/pipeline/status/{id}.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Pipeline execution ID is required" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${AGENT_SERVICE_URL}/api/v1/pipeline/status/${id}`
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to get pipeline status" },
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
