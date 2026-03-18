import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { chunkText } from "@/lib/text-extractor";
import { generateEmbedding } from "@/lib/embeddings";
import { auditLog } from "@/lib/audit-logger";
import { detectPromptInjection } from "@/lib/api-validation";

const VALID_CATEGORIES = [
  "CURRENT_STATE", "FUTURE_STATE", "COMPETITOR", "TECH_TREND",
  "VSM_BENCHMARKS", "TRANSFORMATION_CASE_STUDIES", "ARCHITECTURE_STANDARDS", "AGENT_OUTPUT",
];

/**
 * POST /api/context/fetch-url
 *
 * Fetches a URL (web page, PDF link, or public GitHub file), extracts text,
 * creates a ContextDocument, and auto-indexes it with embeddings.
 *
 * Body: { url, organizationId, category, subCategory? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { url, organizationId, category, subCategory } = body;

    if (!url || !organizationId || !category) {
      return NextResponse.json(
        { error: "Missing required fields: url, organizationId, category" },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Only http/https URLs are supported" },
        { status: 400 }
      );
    }

    // ── Fetch the URL ─────────────────────────────────────────────────────────
    let rawText = "";
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "TransformHub/2.0 Context Indexer",
      "Accept": "text/html,text/plain,application/pdf,*/*",
    };

    // GitHub raw content: convert github.com URLs to raw.githubusercontent.com
    let fetchUrl = url;
    if (parsedUrl.hostname === "github.com" && parsedUrl.pathname.includes("/blob/")) {
      fetchUrl = url
        .replace("github.com", "raw.githubusercontent.com")
        .replace("/blob/", "/");
    }

    const response = await fetch(fetchUrl, { headers: fetchHeaders, redirect: "follow" });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: HTTP ${response.status}` },
        { status: 422 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/pdf")) {
      // For PDF links, extract text from binary using basic approach
      const buffer = Buffer.from(await response.arrayBuffer());
      const raw = buffer.toString("latin1");
      const textParts: string[] = [];
      const regex = /\(([^)]{1,200})\)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(raw)) !== null) {
        const decoded = match[1]
          .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ")
          .replace(/\\\\/g, "\\").replace(/\\\(/g, "(").replace(/\\\)/g, ")");
        if (decoded.trim().length > 3) textParts.push(decoded);
      }
      rawText = textParts.join(" ").trim();
      if (!rawText) rawText = "[PDF content could not be extracted — try downloading and uploading directly]";
    } else {
      // HTML or plain text
      const html = await response.text();
      // Strip HTML tags, scripts, styles
      rawText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\s{3,}/g, "\n\n")
        .trim();
    }

    if (!rawText || rawText.length < 50) {
      return NextResponse.json(
        { error: "Could not extract meaningful text from URL" },
        { status: 422 }
      );
    }

    // Cap at 300 000 chars (generous limit for large reports)
    if (rawText.length > 300_000) rawText = rawText.slice(0, 300_000);

    // Scan fetched content for adversarial prompt injection before storing.
    // Sample the first 50k chars — sufficient to detect planted injection payloads.
    if (detectPromptInjection(rawText.slice(0, 50_000))) {
      return NextResponse.json(
        { error: "Fetched content contains patterns that cannot be processed" },
        { status: 422 }
      );
    }

    // ── Create ContextDocument record ─────────────────────────────────────────
    const fileName = parsedUrl.hostname + parsedUrl.pathname.replace(/\//g, "_").slice(0, 80);
    const document = await prisma.contextDocument.create({
      data: {
        organizationId,
        fileName: fileName || "url-import",
        fileType: "url",
        fileSize: rawText.length,
        filePath: url, // store the URL as filePath for reference
        category,
        subCategory: subCategory || null,
        status: "PROCESSING",
      },
    });

    // ── Chunk + embed ─────────────────────────────────────────────────────────
    const chunks = chunkText(rawText, fileName);

    if (chunks.length > 0) {
      await prisma.contextEmbedding.createMany({
        data: chunks.map((chunk) => ({
          contextDocumentId: document.id,
          organizationId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          metadata: { ...chunk.metadata, sourceUrl: url },
        })),
      });

      // Generate vector embeddings
      const createdEmbeddings = await prisma.contextEmbedding.findMany({
        where: { contextDocumentId: document.id },
        orderBy: { chunkIndex: "asc" },
        select: { id: true, content: true },
      });

      let embeddedCount = 0;
      for (const record of createdEmbeddings) {
        const vector = await generateEmbedding(record.content);
        if (vector) {
          const vectorStr = `[${vector.join(",")}]`;
          await prisma.$executeRaw`
            UPDATE context_embeddings
            SET embedding = ${vectorStr}::vector
            WHERE id = ${record.id}
          `;
          embeddedCount++;
        }
      }

      await prisma.contextDocument.update({
        where: { id: document.id },
        data: { status: "INDEXED", chunkCount: chunks.length },
      });

      await auditLog({
        action: "context_document.url_fetched",
        entityType: "ContextDocument",
        entityId: document.id,
        actor: user.id,
        details: { url, category, chunkCount: chunks.length, embeddedCount, organizationId },
      });

      return NextResponse.json(
        { ...document, status: "INDEXED", chunkCount: chunks.length },
        { status: 201 }
      );
    } else {
      await prisma.contextDocument.update({
        where: { id: document.id },
        data: { status: "FAILED", errorMessage: "No content chunks extracted" },
      });
      return NextResponse.json({ error: "No content chunks extracted" }, { status: 422 });
    }
  } catch (error) {
    console.error("Failed to fetch URL document:", error);
    return NextResponse.json(
      { error: "Failed to fetch and index URL" },
      { status: 500 }
    );
  }
}
