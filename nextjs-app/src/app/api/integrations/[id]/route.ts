import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const integration = await prisma.externalIntegration.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        name: true,
        type: true,
        baseUrl: true,
        username: true,
        projectKey: true,
        status: true,
        lastSyncAt: true,
        syncedItems: true,
        errorMessage: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (integration.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(integration);
  } catch (error) {
    console.error("Failed to fetch integration:", error);
    return NextResponse.json({ error: "Failed to fetch integration" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.externalIntegration.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (existing.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, username, apiToken, projectKey, baseUrl } = body;
    const updated = await prisma.externalIntegration.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(username !== undefined && { username }),
        ...(apiToken !== undefined && { apiToken }),
        ...(projectKey !== undefined && { projectKey }),
        ...(baseUrl !== undefined && { baseUrl: baseUrl.replace(/\/$/, "") }),
      },
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        username: true,
        projectKey: true,
        status: true,
        lastSyncAt: true,
        syncedItems: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update integration:", error);
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const existing = await prisma.externalIntegration.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (existing.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete synced ContextDocuments tagged with this integration
    await prisma.contextDocument.deleteMany({
      where: {
        organizationId: existing.organizationId,
        metadata: { path: ["integrationId"], equals: id },
      },
    });

    await prisma.externalIntegration.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete integration:", error);
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }
}
