import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createDigitalProductSchema, formatZodError } from "@/lib/validations";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    let user: { organizationId: string | null } | null = null;
    try { user = await requireAuth(); } catch { /* continue with query params */ }
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repositoryId");
    const businessSegment = searchParams.get("businessSegment");

    const organizationId = searchParams.get("organizationId");

    // Organization-level data isolation: prefer explicit query param, fall back to user's org
    const orgFilter = organizationId || user?.organizationId;
    const where: Record<string, unknown> = {};
    if (repositoryId) {
      where.repositoryId = repositoryId;
    }
    if (orgFilter) {
      where.repository = {
        organizationId: orgFilter,
      };
    }
    if (businessSegment) {
      where.businessSegment = businessSegment;
    }

    const digitalProducts = await prisma.digitalProduct.findMany({
      where,
      include: {
        repository: true,
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(digitalProducts);
  } catch (error) {
    console.error("Failed to fetch digital products:", error);
    return NextResponse.json(
      { error: "Failed to fetch digital products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const result = createDigitalProductSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 }
      );
    }

    const { name, description, currentState, futureState, businessSegment, repositoryId } = result.data;

    const digitalProduct = await prisma.digitalProduct.create({
      data: {
        name,
        description,
        currentState,
        futureState,
        businessSegment: businessSegment || null,
        repositoryId,
      },
    });

    return NextResponse.json(digitalProduct, { status: 201 });
  } catch (error) {
    console.error("Failed to create digital product:", error);
    return NextResponse.json(
      { error: "Failed to create digital product" },
      { status: 500 }
    );
  }
}
