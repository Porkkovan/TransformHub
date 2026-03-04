import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const digitalProductId = searchParams.get("digitalProductId");

    const where = digitalProductId ? { digitalProductId } : {};

    const productGroups = await prisma.productGroup.findMany({
      where,
      include: {
        valueStreamSteps: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(productGroups);
  } catch (error) {
    console.error("Failed to fetch product groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch product groups" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { name, description, digitalProductId } = body;

    if (!name || !digitalProductId) {
      return NextResponse.json(
        { error: "Name and digitalProductId are required" },
        { status: 400 }
      );
    }

    const productGroup = await prisma.productGroup.create({
      data: {
        name,
        description,
        digitalProductId,
      },
    });

    return NextResponse.json(productGroup, { status: 201 });
  } catch (error) {
    console.error("Failed to create product group:", error);
    return NextResponse.json(
      { error: "Failed to create product group" },
      { status: 500 }
    );
  }
}
