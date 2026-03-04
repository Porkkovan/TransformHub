import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { generateEmbedding } from "@/lib/embeddings";
import prisma from "@/lib/prisma";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

interface VectorResult {
  id: string;
  content: string;
  file_name: string;
  category: string;
  similarity: number;
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { message, organizationId, conversationId } = body;

    if (!message || !conversationId) {
      return NextResponse.json(
        { error: "message and conversationId are required" },
        { status: 400 }
      );
    }

    // Retrieve relevant context via vector similarity
    let sources: { source: string; category: string; similarity: number }[] = [];
    let enrichedMessage = message;

    if (organizationId) {
      const queryEmbedding = await generateEmbedding(message);

      if (queryEmbedding) {
        const vectorStr = `[${queryEmbedding.join(",")}]`;

        const vectorResults = await prisma.$queryRawUnsafe<VectorResult[]>(`
          SELECT
            ce.id,
            ce.content,
            cd.file_name,
            cd.category,
            1 - (ce.embedding <=> '${vectorStr}'::vector) AS similarity
          FROM context_embeddings ce
          JOIN context_documents cd ON cd.id = ce.context_document_id
          WHERE ce.organization_id = $1
            AND ce.embedding IS NOT NULL
          ORDER BY ce.embedding <=> '${vectorStr}'::vector
          LIMIT 5
        `, organizationId);

        if (vectorResults.length > 0) {
          sources = vectorResults.map((r) => ({
            source: r.file_name,
            category: r.category,
            similarity: Math.round(Number(r.similarity) * 1000) / 1000,
          }));

          const contextBlock = vectorResults
            .map((r, i) => `[Context ${i + 1} - ${r.file_name}]:\n${r.content}`)
            .join("\n\n");

          enrichedMessage = `Use the following context documents to inform your answer. If the context is not relevant, answer based on your general knowledge.\n\n${contextBlock}\n\n---\nUser Question: ${message}`;
        }
      }
    }

    // Proxy to agent service
    const res = await fetch(`${AGENT_SERVICE_URL}/api/v1/chat/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationId,
        message: enrichedMessage,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Chat failed" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ response: data.response, sources });
  } catch (error) {
    console.error("RAG chat failed:", error);
    return NextResponse.json({ error: "RAG chat failed" }, { status: 500 });
  }
}
