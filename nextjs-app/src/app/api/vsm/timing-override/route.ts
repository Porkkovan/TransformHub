/**
 * Manual Timing Override — /api/vsm/timing-override
 *
 * POST — apply a manual timing override to a ValueStreamStep or Functionality.
 *         Proxies to the agent service timing-override endpoint and also
 *         creates an AuditLog entry.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { createHash } from "crypto";

const AGENT_SERVICE_URL =
  process.env.AGENT_SERVICE_URL ?? "http://localhost:8000/api/v1";
const AGENT_SERVICE_KEY = process.env.AGENT_SERVICE_API_KEY ?? "";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ANALYST");

    const body = await request.json();
    const { entityType, entityId, field, newValue, overrideNote } = body;

    if (!entityType || !entityId || !field || newValue === undefined) {
      return NextResponse.json(
        { error: "entityType, entityId, field, and newValue are required" },
        { status: 400 }
      );
    }

    if (!["value_stream_step", "functionality"].includes(entityType)) {
      return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
    }

    // Proxy to agent service
    const agentResp = await fetch(`${AGENT_SERVICE_URL}/agents/timing-override`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": AGENT_SERVICE_KEY,
      },
      body: JSON.stringify({
        entity_type: entityType,
        entity_id: entityId,
        field,
        new_value: newValue,
        override_note: overrideNote,
        overridden_by: user.id,
      }),
    });

    if (!agentResp.ok) {
      const err = await agentResp.text();
      return NextResponse.json(
        { error: "Agent service error", detail: err },
        { status: agentResp.status }
      );
    }

    const result = await agentResp.json();

    // Append to audit log
    const payload = {
      entityType,
      entityId,
      field,
      previousValue: result.previous_value,
      newValue,
      overrideNote,
    };
    const payloadJson = JSON.stringify(payload);
    const payloadHash = createHash("sha256").update(payloadJson).digest("hex");

    // Get the most recent audit log hash for chaining
    const lastLog = await prisma.auditLog.findFirst({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      select: { payloadHash: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "TIMING_OVERRIDE",
        entityType,
        entityId,
        actor: user.id,
        payload,
        payloadHash,
        previousHash: lastLog?.payloadHash ?? null,
      },
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("POST /api/vsm/timing-override error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("ANALYST");

    const { searchParams } = request.nextUrl;
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId query params required" },
        { status: 400 }
      );
    }

    const logs = await prisma.auditLog.findMany({
      where: { entityType, entityId, action: "TIMING_OVERRIDE" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ overrides: logs });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
