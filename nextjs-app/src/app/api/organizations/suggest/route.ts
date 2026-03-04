import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (q.length < 2) {
      return NextResponse.json([]);
    }

    const organizations = await prisma.organization.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        industryType: true,
      },
      take: 10,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error("Failed to suggest organizations:", error);
    return NextResponse.json(
      { error: "Failed to suggest organizations" },
      { status: 500 }
    );
  }
}
