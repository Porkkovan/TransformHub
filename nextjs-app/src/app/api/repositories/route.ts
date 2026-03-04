import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createRepositorySchema, formatZodError } from "@/lib/validations";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    let user: { organizationId: string | null } | null = null;
    try { user = await requireAuth(); } catch { /* continue with query params */ }
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // Organization-level data isolation: prefer explicit query param, fall back to user's org
    const orgFilter = organizationId || user?.organizationId;
    const repositories = await prisma.repository.findMany({
      where: orgFilter ? { organizationId: orgFilter } : undefined,
      include: {
        digitalProducts: {
          include: {
            digitalCapabilities: {
              include: {
                functionalities: {
                  include: {
                    personaMappings: true,
                  },
                  orderBy: { createdAt: "asc" },
                },
                vsmMetrics: true,
              },
            },
            productGroups: {
              include: {
                valueStreamSteps: {
                  orderBy: { stepOrder: "asc" },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(repositories);
  } catch (error) {
    console.error("Failed to fetch repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const result = createRepositorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 }
      );
    }

    const { name, url, description, language, organizationId } = result.data;

    const repository = await prisma.repository.create({
      data: {
        name,
        url: url || undefined,
        description,
        language,
        organizationId,
      },
    });

    return NextResponse.json(repository, { status: 201 });
  } catch (error) {
    console.error("Failed to create repository:", error);
    return NextResponse.json(
      { error: "Failed to create repository" },
      { status: 500 }
    );
  }
}
