import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

/**
 * DELETE /api/process-map/[productId]
 * Removes all PROCESS_MAP capabilities (and their VsmMetrics) for a digital product.
 * Leaves the product itself and any Discovery-Agent capabilities intact.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    await requireAuth();
    const { productId } = await params;

    // Find all process-map capabilities for this product.
    // Matches both explicitly tagged ("PROCESS_MAP") and older imports that had null category
    // but still have VsmMetrics attached (discovery-agent caps have no vsmMetrics).
    const caps = await prisma.digitalCapability.findMany({
      where: {
        digitalProductId: productId,
        OR: [
          { category: "PROCESS_MAP" },
          { category: null, vsmMetrics: { some: {} } },
        ],
      },
      select: {
        id: true,
        functionalities: { select: { id: true } },
      },
    });

    if (caps.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    const capIds = caps.map((c) => c.id);
    const funcIds = caps.flatMap((c) => c.functionalities.map((f) => f.id));

    // RoadmapItem has non-cascade FKs to both DigitalCapability and Functionality.
    // Null them out before deletion to avoid FK constraint errors.
    if (funcIds.length > 0) {
      await prisma.roadmapItem.updateMany({
        where: { functionalityId: { in: funcIds } },
        data: { functionalityId: null },
      });
    }
    await prisma.roadmapItem.updateMany({
      where: { digitalCapabilityId: { in: capIds } },
      data: { digitalCapabilityId: null },
    });

    // VsmMetrics cascades via onDelete:Cascade but explicit delete is safer
    await prisma.vsmMetrics.deleteMany({ where: { digitalCapabilityId: { in: capIds } } });

    // Delete capabilities — Functionality + PersonaMapping cascade automatically
    await prisma.digitalCapability.deleteMany({ where: { id: { in: capIds } } });

    return NextResponse.json({ deleted: capIds.length });
  } catch (error) {
    console.error("Failed to delete process map:", error);
    return NextResponse.json({ error: "Failed to delete process map" }, { status: 500 });
  }
}
