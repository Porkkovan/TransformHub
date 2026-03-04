import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createOrganizationSchema, formatZodError } from "@/lib/validations";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";

export async function GET() {
  try {
    try { await requireAuth(); } catch { /* allow with session cookie from middleware */ }
    const organizations = await prisma.organization.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(organizations);
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("MEMBER");
    const body = await request.json();
    const result = createOrganizationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 }
      );
    }

    const { name, slug, industryType, description, competitors, businessSegments, regulatoryFrameworks, personas } = result.data;

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        industryType,
        description: description || null,
        competitors,
        businessSegments,
        regulatoryFrameworks,
        personas: personas as Prisma.InputJsonValue,
      },
    });

    await auditLog({
      action: "organization.created",
      entityType: "Organization",
      entityId: organization.id,
      details: { name, slug, industryType },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to create organization:", error);
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }
}
