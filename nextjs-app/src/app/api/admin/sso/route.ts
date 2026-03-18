/**
 * SSO Configuration — /api/admin/sso
 *
 * GET  — retrieve SSO config for current org (client_secret redacted)
 * POST — create or update SSO config
 * DELETE — disable SSO config
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const ALLOWED_PROVIDERS = ["okta", "azure_ad", "google_workspace", "saml_generic"];

export async function GET(_request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.organizationId) {
      return NextResponse.json({ ssoConfig: null });
    }

    const config = await prisma.ssoConfig.findUnique({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        provider: true,
        clientId: true,
        tenantId: true,
        issuerUrl: true,
        domain: true,
        defaultRole: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // clientSecret intentionally omitted
      },
    });

    return NextResponse.json({ ssoConfig: config });
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
    const { provider, clientId, clientSecret, tenantId, issuerUrl, domain, defaultRole } = body;

    if (!provider || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: "provider, clientId, and clientSecret are required" },
        { status: 400 }
      );
    }
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `provider must be one of: ${ALLOWED_PROVIDERS.join(", ")}` },
        { status: 400 }
      );
    }

    const config = await prisma.ssoConfig.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        provider,
        clientId,
        clientSecret,
        tenantId,
        issuerUrl,
        domain,
        defaultRole: defaultRole ?? "ANALYST",
        isActive: true,
      },
      update: {
        provider,
        clientId,
        clientSecret: clientSecret || undefined,
        tenantId,
        issuerUrl,
        domain,
        defaultRole: defaultRole ?? "ANALYST",
        isActive: true,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        provider: true,
        clientId: true,
        domain: true,
        defaultRole: true,
        isActive: true,
      },
    });

    return NextResponse.json({ ssoConfig: config });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("POST /api/admin/sso error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.organizationId) {
      return NextResponse.json({ error: "No organisation assigned" }, { status: 400 });
    }

    await prisma.ssoConfig.updateMany({
      where: { organizationId: user.organizationId },
      data: { isActive: false },
    });

    return NextResponse.json({ status: "disabled" });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
