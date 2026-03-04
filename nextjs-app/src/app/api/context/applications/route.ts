import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";
import {
  createContextApplicationSchema,
  bulkCreateContextApplicationsSchema,
  formatZodError,
} from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const organizationId = searchParams.get("organizationId") || user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const status = searchParams.get("status");
    const businessSegment = searchParams.get("businessSegment");

    const where: Record<string, unknown> = { organizationId };
    if (status) where.status = status;
    if (businessSegment) where.businessSegment = businessSegment;

    const applications = await prisma.contextApplication.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Failed to fetch context applications:", error);
    return NextResponse.json({ error: "Failed to fetch context applications" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Detect bulk vs single create
    if (body.applications && Array.isArray(body.applications)) {
      // Bulk create
      const result = bulkCreateContextApplicationsSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json(
          { error: formatZodError(result.error) },
          { status: 400 }
        );
      }

      const { organizationId, applications } = result.data;

      const created = await prisma.contextApplication.createMany({
        data: applications.map((app) => ({
          organizationId,
          name: app.name,
          description: app.description || null,
          vendor: app.vendor || null,
          version: app.version || null,
          status: app.status || "active",
          businessSegment: app.businessSegment || null,
          technologyStack: app.technologyStack || [],
          integrations: app.integrations || [],
          annualCost: app.annualCost ?? null,
          userCount: app.userCount ?? null,
          businessCriticality: app.businessCriticality || "medium",
        })),
      });

      await auditLog({
        action: "context_application.bulk_created",
        entityType: "ContextApplication",
        entityId: organizationId,
        actor: user.id,
        details: { count: created.count, organizationId },
      });

      return NextResponse.json({ created: created.count }, { status: 201 });
    } else {
      // Single create
      const organizationId = body.organizationId || user.organizationId;
      if (!organizationId) {
        return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
      }

      const result = createContextApplicationSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json(
          { error: formatZodError(result.error) },
          { status: 400 }
        );
      }

      const data = result.data;

      const application = await prisma.contextApplication.create({
        data: {
          organizationId,
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
        action: "context_application.created",
        entityType: "ContextApplication",
        entityId: application.id,
        actor: user.id,
        details: { name: data.name, organizationId },
      });

      return NextResponse.json(application, { status: 201 });
    }
  } catch (error) {
    console.error("Failed to create context application:", error);
    return NextResponse.json({ error: "Failed to create context application" }, { status: 500 });
  }
}
