import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

// POST /api/approvals/[id] — { action: "approve"|"reject", reviewer_id, note }
// Used by AgentOutputReviewPanel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { action, reviewer_id, note } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    const existing = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reviewedBy: reviewer_id ?? null,
        reviewNote: note ?? null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update approval:", error);
    return NextResponse.json({ error: "Failed to update approval" }, { status: 500 });
  }
}
