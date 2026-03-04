import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const organization = await prisma.organization.findUnique({ where: { id } });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json(organization);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch organization:", error);
    return NextResponse.json({ error: "Failed to fetch organization" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("MEMBER");
    const { id } = await params;
    const body = await request.json();
    const { name, slug, industryType, description, competitors, businessSegments, regulatoryFrameworks, personas } = body;

    // If businessSegments changed, cascade rename to digital products
    if (businessSegments !== undefined) {
      const oldOrg = await prisma.organization.findUnique({
        where: { id },
        select: { businessSegments: true },
      });
      const oldSegments: string[] = oldOrg?.businessSegments ?? [];
      const newSegments: string[] = businessSegments ?? [];

      // Build rename map: match old → new by position for changed entries
      const renameOps: { oldName: string; newName: string }[] = [];
      for (let i = 0; i < oldSegments.length; i++) {
        if (i < newSegments.length && oldSegments[i] !== newSegments[i]) {
          renameOps.push({ oldName: oldSegments[i], newName: newSegments[i] });
        } else if (i >= newSegments.length) {
          // Segment was removed — clear products that had it
          renameOps.push({ oldName: oldSegments[i], newName: "" });
        }
      }

      // Apply renames to all digital products and context applications in this organization
      if (renameOps.length > 0) {
        await Promise.all(
          renameOps.flatMap(({ oldName, newName }) => [
            prisma.digitalProduct.updateMany({
              where: {
                businessSegment: oldName,
                repository: { organizationId: id },
              },
              data: { businessSegment: newName || null },
            }),
            prisma.contextApplication.updateMany({
              where: {
                businessSegment: oldName,
                organizationId: id,
              },
              data: { businessSegment: newName || null },
            }),
          ])
        );
      }
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(industryType !== undefined && { industryType }),
        ...(description !== undefined && { description }),
        ...(competitors !== undefined && { competitors }),
        ...(businessSegments !== undefined && { businessSegments }),
        ...(regulatoryFrameworks !== undefined && { regulatoryFrameworks }),
        ...(personas !== undefined && { personas }),
      },
    });

    await auditLog({
      action: "organization.updated",
      entityType: "Organization",
      entityId: id,
      details: { updatedFields: Object.keys(body) },
    });

    return NextResponse.json(organization);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to update organization:", error);
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    await prisma.organization.delete({ where: { id } });

    await auditLog({
      action: "organization.deleted",
      entityType: "Organization",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to delete organization:", error);
    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
  }
}
