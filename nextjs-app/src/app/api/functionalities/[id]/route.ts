import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    const updated = await prisma.functionality.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update functionality:", error);
    return NextResponse.json(
      { error: "Failed to update functionality" },
      { status: 500 }
    );
  }
}
