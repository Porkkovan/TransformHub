import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reviewer_id, note } = body;

    const existing = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedBy: reviewer_id ?? null,
        reviewNote: note ?? null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to reject:", error);
    return NextResponse.json({ error: "Failed to reject" }, { status: 500 });
  }
}
