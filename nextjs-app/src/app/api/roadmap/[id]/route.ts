import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { status, quarter, approvalStatus, reviewedBy, reviewNote, capabilityName, description } = body;

    // Organization-level data isolation: verify item belongs to user's org
    if (user.organizationId) {
      const existing = await prisma.roadmapItem.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Roadmap item not found" }, { status: 404 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (quarter !== undefined) updateData.quarter = quarter;
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
    if (reviewedBy !== undefined) updateData.reviewedBy = reviewedBy;
    if (reviewNote !== undefined) updateData.reviewNote = reviewNote;
    if (capabilityName !== undefined) updateData.capabilityName = capabilityName;
    if (description !== undefined) updateData.description = description;

    const item = await prisma.roadmapItem.update({
      where: { id },
      data: updateData,
    });

    await auditLog({
      action: "roadmap_item.updated",
      entityType: "RoadmapItem",
      entityId: id,
      actor: user.id,
      details: { updatedFields: Object.keys(updateData) },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update roadmap item:", error);
    return NextResponse.json({ error: "Failed to update roadmap item" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Organization-level data isolation: verify item belongs to user's org
    if (user.organizationId) {
      const existing = await prisma.roadmapItem.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Roadmap item not found" }, { status: 404 });
      }
    }

    await prisma.roadmapItem.delete({ where: { id } });

    await auditLog({
      action: "roadmap_item.deleted",
      entityType: "RoadmapItem",
      entityId: id,
      actor: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete roadmap item:", error);
    return NextResponse.json({ error: "Failed to delete roadmap item" }, { status: 500 });
  }
}
