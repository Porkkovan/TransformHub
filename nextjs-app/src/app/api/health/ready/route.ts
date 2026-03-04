import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Readiness probe endpoint.
 * Returns 200 only when the service is fully ready to accept traffic
 * (i.e., the database connection is established and responsive).
 */
export async function GET() {
  const checks: Record<string, unknown> = {
    ready: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    checks.ready = true;
    checks.database = { status: "connected", latencyMs: dbLatency };

    return NextResponse.json(checks, { status: 200 });
  } catch (error) {
    checks.database = {
      status: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return NextResponse.json(checks, { status: 503 });
  }
}
