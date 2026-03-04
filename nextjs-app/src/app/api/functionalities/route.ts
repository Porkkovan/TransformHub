import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const digitalCapabilityId = searchParams.get("digitalCapabilityId");

    const where = digitalCapabilityId ? { digitalCapabilityId } : {};

    const functionalities = await prisma.functionality.findMany({
      where,
      include: {
        personaMappings: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(functionalities);
  } catch (error) {
    console.error("Failed to fetch functionalities:", error);
    return NextResponse.json(
      { error: "Failed to fetch functionalities" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { name, description, sourceFiles, digitalCapabilityId } = body;

    if (!name || !digitalCapabilityId) {
      return NextResponse.json(
        { error: "Name and digitalCapabilityId are required" },
        { status: 400 }
      );
    }

    const functionality = await prisma.functionality.create({
      data: {
        name,
        description,
        sourceFiles: sourceFiles || [],
        digitalCapabilityId,
      },
    });

    return NextResponse.json(functionality, { status: 201 });
  } catch (error) {
    console.error("Failed to create functionality:", error);
    return NextResponse.json(
      { error: "Failed to create functionality" },
      { status: 500 }
    );
  }
}
