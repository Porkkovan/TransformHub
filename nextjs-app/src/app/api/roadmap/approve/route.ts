import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { itemId, action, reviewedBy, reviewNote } = body;

    if (!itemId || !action) {
      return NextResponse.json({ error: "itemId and action are required" }, { status: 400 });
    }

    if (action !== "APPROVED" && action !== "REJECTED") {
      return NextResponse.json({ error: "action must be APPROVED or REJECTED" }, { status: 400 });
    }

    const item = await prisma.roadmapItem.update({
      where: { id: itemId },
      data: {
        approvalStatus: action,
        reviewedBy: reviewedBy || null,
        reviewNote: reviewNote || null,
      },
    });

    await auditLog({
      action: `roadmap_item.${action.toLowerCase()}`,
      entityType: "RoadmapItem",
      entityId: itemId,
      actor: reviewedBy || "system",
      details: { approvalAction: action, reviewNote: reviewNote || null },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update approval status:", error);
    return NextResponse.json({ error: "Failed to update approval status" }, { status: 500 });
  }
}
