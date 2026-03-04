import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;

  const upstream = await fetch(`${AGENT_SERVICE_URL}/api/v1/agents/stream/${id}`, {
    headers: { Accept: "text/event-stream" },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Stream not available", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
