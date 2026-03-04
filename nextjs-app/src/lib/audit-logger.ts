import crypto from "crypto";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import logger from "@/lib/logger";

interface AuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  actor?: string;
  details?: Record<string, unknown>;
}

/**
 * Writes a tamper-evident audit log entry to the audit_logs table.
 *
 * Each entry includes a SHA-256 hash of its payload and chains to the
 * previous entry's hash, forming a lightweight append-only audit chain.
 */
export async function auditLog({
  action,
  entityType,
  entityId,
  actor = "system",
  details = {},
}: AuditLogParams): Promise<void> {
  try {
    // Build the payload that will be stored
    const payload = {
      action,
      entityType,
      entityId,
      actor,
      details,
      timestamp: new Date().toISOString(),
    };

    // Compute a deterministic hash of the payload
    const payloadHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    // Fetch the most recent log's hash to form a chain
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: { payloadHash: true },
    });

    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        actor,
        payload: payload as unknown as Prisma.InputJsonValue,
        payloadHash,
        previousHash: lastLog?.payloadHash ?? null,
      },
    });

    logger.info("Audit log recorded", { action, entityType, entityId, actor });
  } catch (error) {
    // Audit logging must never break the primary request flow.
    // Log the failure and continue.
    logger.error("Failed to write audit log", {
      action,
      entityType,
      entityId,
      actor,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default auditLog;
