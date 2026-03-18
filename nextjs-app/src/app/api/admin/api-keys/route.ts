/**
 * API Key Management — /api/admin/api-keys
 *
 * GET  — list API keys for current org (key hash hidden, prefix shown)
 * POST — create a new API key (returns the plaintext key ONCE)
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

function generateApiKey(): string {
  // Format: th_<random 32 bytes hex>
  return "th_" + crypto.randomBytes(32).toString("hex");
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.organizationId) {
      return NextResponse.json({ error: "No organisation assigned" }, { status: 400 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ keys });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.organizationId) {
      return NextResponse.json({ error: "No organisation assigned" }, { status: 400 });
    }

    const body = await request.json();
    const { name, scopes, expiresInDays } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const plaintext = generateApiKey();
    const keyHash = hashKey(plaintext);
    const keyPrefix = plaintext.slice(0, 11); // "th_" + 8 chars

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400_000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        organizationId: user.organizationId,
        createdBy: user.id,
        keyHash,
        keyPrefix,
        scopes: scopes ?? ["agents:run"],
        expiresAt,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      // plaintext returned ONCE — never stored
      key: plaintext,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("POST /api/admin/api-keys error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
