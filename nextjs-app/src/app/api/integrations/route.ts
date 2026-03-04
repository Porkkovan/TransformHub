import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const VALID_TYPES = ["jira", "confluence", "azure_devops", "notion", "servicenow"];

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") || user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const integrations = await prisma.externalIntegration.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
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
        metadata: true,
        createdAt: true,
        updatedAt: true,
        // Exclude apiToken from list response
      },
    });

    return NextResponse.json(integrations);
  } catch (error) {
    console.error("Failed to fetch integrations:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { organizationId, name, type, baseUrl, username, apiToken, projectKey } = body;

    const orgId = organizationId || user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }
    if (!name || !type || !baseUrl || !apiToken) {
      return NextResponse.json({ error: "name, type, baseUrl, and apiToken are required" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }

    const integration = await prisma.externalIntegration.create({
      data: {
        organizationId: orgId,
        name,
        type,
        baseUrl: baseUrl.replace(/\/$/, ""), // strip trailing slash
        username: username || null,
        apiToken,
        projectKey: projectKey || null,
        status: "idle",
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

    return NextResponse.json(integration, { status: 201 });
  } catch (error) {
    console.error("Failed to create integration:", error);
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }
}
