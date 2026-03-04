import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { executionId, rating, comment, corrections } = body;

    if (!executionId || !rating) {
      return NextResponse.json({ error: "executionId and rating are required" }, { status: 400 });
    }

    const execution = await prisma.agentExecution.findUnique({ where: { id: executionId } });
    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    const feedback = await prisma.agentFeedback.create({
      data: {
        executionId,
        userId: user.id,
        rating: Math.min(Math.max(Math.round(Number(rating)), 1), 5),
        comment: comment?.trim() || null,
        corrections: corrections || null,
      },
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
