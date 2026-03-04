import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  await requireAuth();
  const body = await request.json();

  const res = await fetch(`${AGENT_SERVICE_URL}/api/v1/chat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: body.conversationId,
      message: body.message,
      repository_id: body.repositoryId,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
