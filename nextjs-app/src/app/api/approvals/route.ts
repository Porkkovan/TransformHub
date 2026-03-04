import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const executionId = searchParams.get("execution_id");

    const approvals = await prisma.approvalRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(executionId ? { executionId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(approvals);
  } catch (error) {
    console.error("Failed to fetch approvals:", error);
    return NextResponse.json({ error: "Failed to fetch approvals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { execution_id, gate_name, agent_type, data_for_review } = body;

    if (!execution_id || !gate_name || !agent_type) {
      return NextResponse.json(
        { error: "execution_id, gate_name, and agent_type are required" },
        { status: 400 }
      );
    }

    const approval = await prisma.approvalRequest.create({
      data: {
        executionId: execution_id,
        gateName: gate_name,
        agentType: agent_type,
        dataForReview: data_for_review ?? {},
        status: "PENDING",
      },
    });

    return NextResponse.json({ id: approval.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to create approval:", error);
    return NextResponse.json({ error: "Failed to create approval" }, { status: 500 });
  }
}
