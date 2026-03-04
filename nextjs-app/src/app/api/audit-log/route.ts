import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = new URL(request.url);
    const take = parseInt(searchParams.get("take") || "50", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.auditLog.count(),
    ]);

    return NextResponse.json({ data: auditLogs, total });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
