import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { generateEmbedding } from "@/lib/embeddings";

interface VectorResult {
  id: string;
  content: string;
  chunk_index: number;
  document_id: string;
  file_name: string;
  category: string;
  sub_category: string | null;
  similarity: number;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);

    const organizationId = searchParams.get("organizationId");
    const query = searchParams.get("query");
    const category = searchParams.get("category");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    if (!organizationId || !query) {
      return NextResponse.json(
        { error: "organizationId and query are required" },
        { status: 400 }
      );
    }

    // Try vector similarity search first
    const queryEmbedding = await generateEmbedding(query);

    if (queryEmbedding) {
      const vectorStr = `[${queryEmbedding.join(",")}]`;
      const categoryCondition = category
        ? `AND cd.category = $3`
        : "";
      const queryParams: (string | number)[] = [organizationId, limit];
      if (category) queryParams.push(category);

      const vectorResults = await prisma.$queryRawUnsafe<VectorResult[]>(`
        SELECT
          ce.id,
          ce.content,
          ce.chunk_index,
          cd.id AS document_id,
          cd.file_name,
          cd.category,
          cd.sub_category,
          1 - (ce.embedding <=> '${vectorStr}'::vector) AS similarity
        FROM context_embeddings ce
        JOIN context_documents cd ON cd.id = ce.context_document_id
        WHERE ce.organization_id = $1
          AND ce.embedding IS NOT NULL
          ${categoryCondition}
        ORDER BY ce.embedding <=> '${vectorStr}'::vector
        LIMIT $2
      `, ...queryParams);

      const results = vectorResults.map((row) => ({
        id: row.id,
        content: row.content,
        chunkIndex: row.chunk_index,
        source: row.file_name,
        category: row.category,
        subCategory: row.sub_category,
        documentId: row.document_id,
        similarity: Math.round(Number(row.similarity) * 1000) / 1000,
      }));

      return NextResponse.json(results);
    }

    // Fallback to keyword search when no embedding available
    const where: Record<string, unknown> = {
      organizationId,
      content: {
        contains: query,
        mode: "insensitive",
      },
    };

    if (category) {
      where.contextDocument = {
        category,
      };
    }

    const chunks = await prisma.contextEmbedding.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        contextDocument: {
          select: {
            id: true,
            fileName: true,
            category: true,
            subCategory: true,
          },
        },
      },
    });

    const results = chunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      source: chunk.contextDocument.fileName,
      category: chunk.contextDocument.category,
      subCategory: chunk.contextDocument.subCategory,
      documentId: chunk.contextDocument.id,
      similarity: null,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to search context:", error);
    return NextResponse.json({ error: "Failed to search context" }, { status: 500 });
  }
}
