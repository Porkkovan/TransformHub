import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";
import { createContextApplicationSchema, formatZodError } from "@/lib/validations";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Organization-level data isolation
    if (user.organizationId) {
      const existing = await prisma.contextApplication.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }
    }

    const result = createContextApplicationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 }
      );
    }

    const data = result.data;

    const application = await prisma.contextApplication.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        vendor: data.vendor || null,
        version: data.version || null,
        status: data.status || "active",
        businessSegment: data.businessSegment || null,
        technologyStack: data.technologyStack || [],
        integrations: data.integrations || [],
        annualCost: data.annualCost ?? null,
        userCount: data.userCount ?? null,
        businessCriticality: data.businessCriticality || "medium",
      },
    });

    await auditLog({
      action: "context_application.updated",
      entityType: "ContextApplication",
      entityId: id,
      actor: user.id,
      details: { name: data.name },
    });

    return NextResponse.json(application);
  } catch (error) {
    console.error("Failed to update context application:", error);
    return NextResponse.json({ error: "Failed to update context application" }, { status: 500 });
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
      const existing = await prisma.contextApplication.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }
    }

    await prisma.contextApplication.delete({ where: { id } });

    await auditLog({
      action: "context_application.deleted",
      entityType: "ContextApplication",
      entityId: id,
      actor: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete context application:", error);
    return NextResponse.json({ error: "Failed to delete context application" }, { status: 500 });
  }
}
