import { NextRequest, NextResponse } from "next/server";
import { getAgentResults } from "@/lib/agent-client";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const results = await getAgentResults(id);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to get agent results:", error);
    return NextResponse.json(
      { error: "Failed to get agent results" },
      { status: 500 }
    );
  }
}
