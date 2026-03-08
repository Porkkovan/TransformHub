import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";

const ALLOWED_TYPES = [".pdf", ".csv", ".json", ".txt", ".md", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const organizationId = formData.get("organizationId") as string | null;
    const category = formData.get("category") as string | null;
    const subCategory = formData.get("subCategory") as string | null;

    if (!file || !organizationId || !category) {
      return NextResponse.json(
        { error: "Missing required fields: file, organizationId, category" },
        { status: 400 }
      );
    }

    // Validate file extension
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Allowed: ${ALLOWED_TYPES.join(", ")} (for Excel, save as .xlsx)` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      "CURRENT_STATE", "FUTURE_STATE", "COMPETITOR", "TECH_TREND",
      "VSM_BENCHMARKS", "TRANSFORMATION_CASE_STUDIES", "ARCHITECTURE_STANDARDS", "AGENT_OUTPUT",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Save file to disk
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uploadDir = path.join(process.cwd(), "uploads", "context", organizationId);
    await fs.mkdir(uploadDir, { recursive: true });

    const fileName = `${timestamp}_${safeName}`;
    const filePath = path.join(uploadDir, fileName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    // Create database record
    const document = await prisma.contextDocument.create({
      data: {
        organizationId,
        fileName: file.name,
        fileType: ext.replace(".", ""),
        fileSize: file.size,
        filePath,
        category,
        subCategory: subCategory || null,
        status: "UPLOADED",
      },
    });

    await auditLog({
      action: "context_document.uploaded",
      entityType: "ContextDocument",
      entityId: document.id,
      actor: user.id,
      details: { fileName: file.name, category, fileSize: file.size, organizationId },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Failed to upload context document:", error);
    return NextResponse.json(
      { error: "Failed to upload context document" },
      { status: 500 }
    );
  }
}
