import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const AGENT_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8002";
const AGENT_API_KEY = process.env.AGENT_SERVICE_API_KEY || "";

/**
 * POST /api/infer-personas
 * Body: { organizationId, repositoryId?, functionalityIds? }
 *
 * 1. Loads org personas + visible functionalities from DB
 * 2. Calls agent service /api/v1/infer-personas for LLM inference
 * 3. Upserts PersonaMapping records
 * 4. Returns { mapped, total }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { organizationId, repositoryId, functionalityIds } = body as {
      organizationId: string;
      repositoryId?: string;
      functionalityIds?: string[];
    };

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }

    // ── 1. Load org personas ─────────────────────────────────────────────────
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { personas: true },
    });

    const personas = (org?.personas as { type: string; name: string; responsibilities: string[] }[]) ?? [];
    if (personas.length === 0) {
      return NextResponse.json({ error: "No personas defined for this organization" }, { status: 400 });
    }

    // ── 2. Load functionalities ──────────────────────────────────────────────
    type FuncWhere = {
      id?: { in: string[] };
      digitalCapability?: {
        digitalProduct?: {
          repository?: { organizationId: string };
          repositoryId?: string;
        };
      };
    };

    const where: FuncWhere = functionalityIds?.length
      ? { id: { in: functionalityIds } }
      : {
          digitalCapability: {
            digitalProduct: repositoryId
              ? { repositoryId }
              : { repository: { organizationId } },
          },
        };

    const functionalities = await prisma.functionality.findMany({
      where,
      select: { id: true, name: true, description: true },
    });

    if (functionalities.length === 0) {
      return NextResponse.json({ mapped: 0, total: 0 });
    }

    // ── 3. Call agent service for LLM inference ──────────────────────────────
    const agentRes = await fetch(`${AGENT_URL}/api/v1/infer-personas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AGENT_API_KEY ? { "X-Api-Key": AGENT_API_KEY } : {}),
      },
      body: JSON.stringify({ personas, functionalities }),
    });

    if (!agentRes.ok) {
      const err = await agentRes.text();
      return NextResponse.json({ error: `Agent service error: ${err}` }, { status: 502 });
    }

    const inferred: { functionality_id: string; persona_types: string[] }[] = await agentRes.json();

    // ── 4. Replace PersonaMapping records ───────────────────────────────────
    let mapped = 0;
    const personaByType = new Map(personas.map((p) => [p.type, p]));
    const funcIds = inferred.map((i) => i.functionality_id).filter(Boolean);

    // Delete all existing mappings for these functionalities (full replace)
    if (funcIds.length > 0) {
      await prisma.personaMapping.deleteMany({
        where: { functionalityId: { in: funcIds } },
      });
    }

    // Create new mappings
    for (const item of inferred) {
      if (!item.functionality_id || !item.persona_types?.length) continue;

      for (const personaType of item.persona_types) {
        const persona = personaByType.get(personaType);
        if (!persona) continue;

        await prisma.personaMapping.create({
          data: {
            functionalityId: item.functionality_id,
            personaType,
            personaName: persona.name,
            responsibilities: persona.responsibilities ?? [],
          },
        });
        mapped++;
      }
    }

    return NextResponse.json({
      mapped,
      total: functionalities.length,
      message: `Inferred ${mapped} persona assignments across ${functionalities.length} functionalities`,
    });
  } catch (error) {
    console.error("infer-personas error:", error);
    return NextResponse.json({ error: "Failed to infer personas" }, { status: 500 });
  }
}
