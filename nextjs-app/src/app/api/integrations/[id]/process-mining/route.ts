/**
 * POST /api/integrations/[id]/process-mining
 *
 * Accepts an event log CSV for the given integration and forwards it to the
 * Python agent service for process mining analysis.
 *
 * Body: { eventLog: string (CSV), repositoryId?: string }
 *
 * Returns process mining results:
 *   { events_parsed, cases, activities, transitions, bottlenecks, vsm_mapping? }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("ANALYST");
    const { id } = await params;

    // Validate integration belongs to the user's org
    const integration = await prisma.externalIntegration.findUnique({
      where: { id },
      select: { id: true, organizationId: true, name: true, type: true },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (integration.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { eventLog, repositoryId } = body as {
      eventLog?: string;
      repositoryId?: string;
    };

    if (!eventLog || typeof eventLog !== "string" || !eventLog.trim()) {
      return NextResponse.json(
        { error: "eventLog (CSV string) is required" },
        { status: 400 }
      );
    }

    // Optionally fetch VSM step names for the given repository so the agent
    // service can map discovered activities back to known VSM steps.
    let vsmStepNames: string[] | undefined;
    if (repositoryId) {
      const steps = await prisma.valueStreamStep.findMany({
        where: {
          productGroup: {
            digitalProduct: {
              repository: { id: repositoryId },
            },
          },
        },
        select: { name: true },
      });
      if (steps.length > 0) {
        vsmStepNames = steps.map((s) => s.name);
      }
    }

    // Forward to the Python agent service
    const agentRes = await fetch(`${AGENT_SERVICE_URL}/api/v1/process-mining`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_log: eventLog,
        ...(vsmStepNames ? { vsm_step_names: vsmStepNames } : {}),
        top_n_bottlenecks: 5,
      }),
    });

    if (!agentRes.ok) {
      const errorData = await agentRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: (errorData as { detail?: string }).detail || "Process mining failed" },
        { status: agentRes.status }
      );
    }

    const result = await agentRes.json();
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("process-mining route error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
