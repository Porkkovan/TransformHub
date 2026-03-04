import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { extractText, chunkText } from "@/lib/text-extractor";
import { generateEmbedding } from "@/lib/embeddings";
import { auditLog } from "@/lib/audit-logger";

export async function POST(
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

    // Set status to PROCESSING
    await prisma.contextDocument.update({
      where: { id },
      data: { status: "PROCESSING" },
    });

    try {
      // Extract text from the file
      const text = await extractText(document.filePath);

      // Chunk the text
      const chunks = chunkText(text, document.fileName);

      // Delete existing embeddings for re-process support
      await prisma.contextEmbedding.deleteMany({
        where: { contextDocumentId: id },
      });

      // Batch create embedding records
      if (chunks.length > 0) {
        await prisma.contextEmbedding.createMany({
          data: chunks.map((chunk) => ({
            contextDocumentId: id,
            organizationId: document.organizationId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            metadata: chunk.metadata,
          })),
        });

        // Generate and store vector embeddings for each chunk
        const createdEmbeddings = await prisma.contextEmbedding.findMany({
          where: { contextDocumentId: id },
          orderBy: { chunkIndex: "asc" },
          select: { id: true, content: true },
        });

        for (const record of createdEmbeddings) {
          const vector = await generateEmbedding(record.content);
          if (vector) {
            const vectorStr = `[${vector.join(",")}]`;
            await prisma.$executeRaw`
              UPDATE context_embeddings
              SET embedding = ${vectorStr}::vector
              WHERE id = ${record.id}
            `;
          }
        }
      }

      // Update document status to INDEXED
      const updated = await prisma.contextDocument.update({
        where: { id },
        data: {
          status: "INDEXED",
          chunkCount: chunks.length,
        },
      });

      await auditLog({
        action: "context_document.processed",
        entityType: "ContextDocument",
        entityId: id,
        actor: user.id,
        details: { fileName: document.fileName, chunkCount: chunks.length },
      });

      return NextResponse.json(updated);
    } catch (processingError) {
      // Set status to FAILED with error message
      const errorMessage = processingError instanceof Error
        ? processingError.message
        : String(processingError);

      await prisma.contextDocument.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage,
        },
      });

      return NextResponse.json(
        { error: `Processing failed: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to process context document:", error);
    return NextResponse.json(
      { error: "Failed to process context document" },
      { status: 500 }
    );
  }
}
