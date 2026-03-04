import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const organizationId = searchParams.get("organizationId") || user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { organizationId };
    if (category) where.category = category;
    if (status) where.status = status;

    const documents = await prisma.contextDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Failed to fetch context documents:", error);
    return NextResponse.json({ error: "Failed to fetch context documents" }, { status: 500 });
  }
}
