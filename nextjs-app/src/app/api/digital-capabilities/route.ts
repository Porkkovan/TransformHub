import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const digitalProductId = searchParams.get("digitalProductId");

    const where = digitalProductId ? { digitalProductId } : {};

    const digitalCapabilities = await prisma.digitalCapability.findMany({
      where,
      include: {
        functionalities: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(digitalCapabilities);
  } catch (error) {
    console.error("Failed to fetch digital capabilities:", error);
    return NextResponse.json(
      { error: "Failed to fetch digital capabilities" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { name, description, category, digitalProductId } = body;

    if (!name || !digitalProductId) {
      return NextResponse.json(
        { error: "Name and digitalProductId are required" },
        { status: 400 }
      );
    }

    const digitalCapability = await prisma.digitalCapability.create({
      data: {
        name,
        description,
        category,
        digitalProductId,
      },
    });

    return NextResponse.json(digitalCapability, { status: 201 });
  } catch (error) {
    console.error("Failed to create digital capability:", error);
    return NextResponse.json(
      { error: "Failed to create digital capability" },
      { status: 500 }
    );
  }
}
