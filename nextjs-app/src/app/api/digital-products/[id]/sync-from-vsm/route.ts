import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

/**
 * POST /api/digital-products/[id]/sync-from-vsm
 *
 * Reads the product's ProductGroups → ValueStreamSteps and creates
 * DigitalCapabilities → Functionalities from them (skipping any that
 * already exist by name, so it's safe to run multiple times).
 *
 * Returns { created: { capabilities, functionalities }, skipped: { capabilities, functionalities } }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: productId } = await params;

    // 1. Load product with VSM data
    const product = await prisma.digitalProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        productGroups: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            valueStreamSteps: {
              orderBy: { stepOrder: "asc" },
              select: { id: true, name: true, description: true, stepOrder: true, stepType: true },
            },
          },
        },
        digitalCapabilities: {
          select: { id: true, name: true },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.productGroups.length === 0) {
      return NextResponse.json({ error: "No product groups / VSM data found for this product" }, { status: 400 });
    }

    // 2. Existing cap names for dedup
    const existingCapNames = new Set(product.digitalCapabilities.map((c) => c.name.toLowerCase()));

    let createdCaps = 0;
    let skippedCaps = 0;
    let createdFuncs = 0;
    let skippedFuncs = 0;

    for (const group of product.productGroups) {
      if (group.valueStreamSteps.length === 0) continue;

      // 3. Find or create the matching capability
      let capId: string;
      if (existingCapNames.has(group.name.toLowerCase())) {
        // Already exists — find it
        const existing = product.digitalCapabilities.find(
          (c) => c.name.toLowerCase() === group.name.toLowerCase()
        );
        capId = existing!.id;
        skippedCaps++;
      } else {
        const cap = await prisma.digitalCapability.create({
          data: {
            name: group.name,
            description: group.description ?? `Value stream steps for ${group.name}`,
            digitalProductId: productId,
            category: "VALUE_STREAM",
          },
        });
        capId = cap.id;
        existingCapNames.add(group.name.toLowerCase());
        createdCaps++;
      }

      // 4. Load existing functionalities for this capability (dedup by name)
      const existingFuncs = await prisma.functionality.findMany({
        where: { digitalCapabilityId: capId },
        select: { name: true },
      });
      const existingFuncNames = new Set(existingFuncs.map((f) => f.name.toLowerCase()));

      // 5. Create functionalities from value stream steps
      for (const step of group.valueStreamSteps) {
        if (existingFuncNames.has(step.name.toLowerCase())) {
          skippedFuncs++;
          continue;
        }
        await prisma.functionality.create({
          data: {
            name: step.name,
            description: step.description ?? `Step ${step.stepOrder} (${step.stepType})`,
            digitalCapabilityId: capId,
            sourceFiles: [],
          },
        });
        existingFuncNames.add(step.name.toLowerCase());
        createdFuncs++;
      }
    }

    return NextResponse.json({
      created: { capabilities: createdCaps, functionalities: createdFuncs },
      skipped: { capabilities: skippedCaps, functionalities: skippedFuncs },
      message: `Created ${createdCaps} capabilities and ${createdFuncs} functionalities from VSM data`,
    });
  } catch (error) {
    console.error("sync-from-vsm error:", error);
    return NextResponse.json({ error: "Failed to sync from VSM" }, { status: 500 });
  }
}
