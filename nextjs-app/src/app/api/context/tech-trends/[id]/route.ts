import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";
import { updateTechTrendSchema, formatZodError } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Organization-level data isolation
    if (user.organizationId) {
      const existing = await prisma.techTrend.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Tech trend not found" }, { status: 404 });
      }
    }

    const result = updateTechTrendSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 }
      );
    }

    const data = result.data;

    const trend = await prisma.techTrend.update({
      where: { id },
      data,
    });

    await auditLog({
      action: "tech_trend.updated",
      entityType: "TechTrend",
      entityId: id,
      actor: user.id,
      details: { updates: Object.keys(data) },
    });

    return NextResponse.json(trend);
  } catch (error) {
    console.error("Failed to update tech trend:", error);
    return NextResponse.json({ error: "Failed to update tech trend" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Organization-level data isolation
    if (user.organizationId) {
      const existing = await prisma.techTrend.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Tech trend not found" }, { status: 404 });
      }
    }

    await prisma.techTrend.delete({ where: { id } });

    await auditLog({
      action: "tech_trend.deleted",
      entityType: "TechTrend",
      entityId: id,
      actor: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tech trend:", error);
    return NextResponse.json({ error: "Failed to delete tech trend" }, { status: 500 });
  }
}
