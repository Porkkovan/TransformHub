import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const startTime = Date.now();

export async function GET() {
  const checks: Record<string, unknown> = {
    status: "healthy",
    service: "transformhub-web",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  let dbHealthy = true;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    checks.database = {
      status: "connected",
      latencyMs: dbLatency,
    };
  } catch (error) {
    dbHealthy = false;
    checks.database = {
      status: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    checks.status = "unhealthy";
  }

  const statusCode = dbHealthy ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
