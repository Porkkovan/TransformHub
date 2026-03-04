import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  await requireAuth();
  const agentType = request.nextUrl.searchParams.get("agentType");
  if (!agentType) {
    return NextResponse.json({ error: "agentType is required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${AGENT_SERVICE_URL}/api/v1/agents/versions?agent_type=${agentType}`
    );
    if (!res.ok) throw new Error(`Agent service error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}
