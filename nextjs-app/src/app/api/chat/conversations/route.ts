import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const user = await requireAuth();
  // Organization-level data isolation: use the user's org for filtering conversations
  const orgId = user.organizationId || "";
  const url = `${AGENT_SERVICE_URL}/api/v1/chat/conversations${orgId ? `?organization_id=${orgId}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json([], { status: 200 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  await requireAuth();
  const body = await request.json();

  const res = await fetch(`${AGENT_SERVICE_URL}/api/v1/chat/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organization_id: body.organizationId,
      user_id: body.userId,
      title: body.title,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
