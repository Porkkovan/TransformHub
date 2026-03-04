import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const document = await prisma.contextDocument.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Organization-level data isolation
    if (user.organizationId && document.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete embeddings
    await prisma.contextEmbedding.deleteMany({
      where: { contextDocumentId: id },
    });

    // If this is a Process Map document, also delete the associated VSM capabilities + metrics
    if (document.subCategory === "Process Map") {
      const meta = document.metadata as Record<string, unknown> | null;
      const productId = meta?.productId as string | undefined;
      if (productId) {
        const caps = await prisma.digitalCapability.findMany({
          where: {
            digitalProductId: productId,
            OR: [
              { category: "PROCESS_MAP" },
              { category: null, vsmMetrics: { some: {} } },
            ],
          },
          select: { id: true, functionalities: { select: { id: true } } },
        });
        if (caps.length > 0) {
          const capIds = caps.map((c) => c.id);
          const funcIds = caps.flatMap((c) => c.functionalities.map((f) => f.id));
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
          await prisma.vsmMetrics.deleteMany({ where: { digitalCapabilityId: { in: capIds } } });
          await prisma.digitalCapability.deleteMany({ where: { id: { in: capIds } } });
        }
      }
    }

    // Delete database record
    await prisma.contextDocument.delete({ where: { id } });

    // Delete file from disk
    try {
      await fs.unlink(document.filePath);
    } catch {
      // File may already be deleted, continue
    }

    await auditLog({
      action: "context_document.deleted",
      entityType: "ContextDocument",
      entityId: id,
      actor: user.id,
      details: { fileName: document.fileName, organizationId: document.organizationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete context document:", error);
    return NextResponse.json({ error: "Failed to delete context document" }, { status: 500 });
  }
}
