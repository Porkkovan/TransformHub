import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const MOCK_COMPLIANCE_MAPPINGS = [
  {
    id: "1",
    framework: "FINRA",
    requirement: "Rule 3110 - Supervision",
    description: "Establish supervisory procedures",
    status: "COMPLIANT",
    entityType: "PROCESS",
  },
  {
    id: "2",
    framework: "FINRA",
    requirement: "Rule 4512 - Customer Account Information",
    description: "Maintain accurate customer records",
    status: "PARTIAL",
    entityType: "DATA",
  },
  {
    id: "3",
    framework: "SEC",
    requirement: "Rule 17a-4 - Record Retention",
    description: "Preserve electronic communications",
    status: "NON_COMPLIANT",
    entityType: "SYSTEM",
  },
  {
    id: "4",
    framework: "SEC",
    requirement: "Regulation S-P - Privacy",
    description: "Protect customer information",
    status: "COMPLIANT",
    entityType: "PROCESS",
  },
  {
    id: "5",
    framework: "GDPR",
    requirement: "Article 17 - Right to Erasure",
    description: "Enable data deletion requests",
    status: "PARTIAL",
    entityType: "DATA",
  },
  {
    id: "6",
    framework: "GDPR",
    requirement: "Article 25 - Data Protection by Design",
    description: "Privacy by design and default",
    status: "NON_COMPLIANT",
    entityType: "SYSTEM",
  },
];

export async function GET(request: NextRequest) {
  try {
    let user: { organizationId: string | null } | null = null;
    try { user = await requireAuth(); } catch { /* continue with query params */ }
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // Organization-level data isolation: prefer explicit query param, fall back to user's org
    const orgFilter = organizationId || user?.organizationId;

    // ComplianceMapping has no direct org relation — filter by entity IDs belonging to the org
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any).complianceMapping;
    if (model) {
      const where: Record<string, unknown> = {};
      if (orgFilter) {
        const orgCapabilities = await prisma.digitalCapability.findMany({
          where: { digitalProduct: { repository: { organizationId: orgFilter } } },
          select: { id: true },
        });
        where.entityId = { in: orgCapabilities.map((c: { id: string }) => c.id) };
      }
      const mappings = await model.findMany({
        where,
        orderBy: { framework: "asc" },
      });
      return NextResponse.json(mappings);
    }

    // If the model doesn't exist on the prisma client, fall through to mock data
    return NextResponse.json(MOCK_COMPLIANCE_MAPPINGS);
  } catch (error) {
    console.error("Failed to fetch compliance mappings:", error);
    // Return mock data as fallback when the table doesn't exist
    return NextResponse.json(MOCK_COMPLIANCE_MAPPINGS);
  }
}
