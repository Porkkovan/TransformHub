import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const productGroupId = searchParams.get("productGroupId");

    const where = productGroupId ? { productGroupId } : {};

    const valueStreamSteps = await prisma.valueStreamStep.findMany({
      where,
      orderBy: { stepOrder: "asc" },
    });

    return NextResponse.json(valueStreamSteps);
  } catch (error) {
    console.error("Failed to fetch value stream steps:", error);
    return NextResponse.json(
      { error: "Failed to fetch value stream steps" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { name, description, stepOrder, stepType, productGroupId } = body;

    if (!name || stepOrder === undefined || !productGroupId) {
      return NextResponse.json(
        { error: "Name, stepOrder, and productGroupId are required" },
        { status: 400 }
      );
    }

    const valueStreamStep = await prisma.valueStreamStep.create({
      data: {
        name,
        description,
        stepOrder,
        stepType: stepType || "process",
        productGroupId,
      },
    });

    return NextResponse.json(valueStreamStep, { status: 201 });
  } catch (error) {
    console.error("Failed to create value stream step:", error);
    return NextResponse.json(
      { error: "Failed to create value stream step" },
      { status: 500 }
    );
  }
}
