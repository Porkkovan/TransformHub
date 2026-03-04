import { NextRequest, NextResponse } from "next/server";
import { getAgentStatus } from "@/lib/agent-client";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const status = await getAgentStatus(id);

    return NextResponse.json(status);
  } catch (error) {
    console.error("Failed to get agent status:", error);
    return NextResponse.json(
      { error: "Failed to get agent status" },
      { status: 500 }
    );
  }
}
