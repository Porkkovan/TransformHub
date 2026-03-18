/**
 * LLM Budget Management — /api/admin/budgets
 *
 * GET  — current period usage summary
 * POST — create or update monthly budget caps
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

function currentPeriodStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function GET(_request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.organizationId) {
      return NextResponse.json({ error: "No organisation assigned" }, { status: 400 });
    }

    const budget = await prisma.orgLlmBudget.findUnique({
      where: { organizationId: user.organizationId },
    });

    // Fetch current-period totals
    const periodStart = budget?.currentPeriodStart ?? currentPeriodStart();
    const usageAgg = await prisma.orgLlmUsage.aggregate({
      where: {
        organizationId: user.organizationId,
        createdAt: { gte: periodStart },
      },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
    });

    // By-agent breakdown
    const byAgent = await prisma.orgLlmUsage.groupBy({
      by: ["agentType", "model"],
      where: {
        organizationId: user.organizationId,
        createdAt: { gte: periodStart },
      },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      orderBy: { _sum: { costUsd: "desc" } },
    });

    const totalTokens =
      (usageAgg._sum.inputTokens ?? 0) + (usageAgg._sum.outputTokens ?? 0);
    const totalCost = usageAgg._sum.costUsd ?? 0;

    // Never expose the API key in GET responses
    const budgetSafe = budget
      ? { ...budget, anthropicApiKey: budget.anthropicApiKey ? "***set***" : null }
      : null;

    return NextResponse.json({
      budget: budgetSafe,
      summary: {
        periodStart: periodStart.toISOString(),
        totalTokens,
        totalCostUsd: Math.round(totalCost * 10000) / 10000,
        tokenUsagePct: budget?.monthlyTokenCap
          ? Math.round((totalTokens / budget.monthlyTokenCap) * 1000) / 10
          : null,
        spendUsagePct:
          budget?.monthlySpendCap && budget.monthlySpendCap > 0
            ? Math.round((totalCost / budget.monthlySpendCap) * 1000) / 10
            : null,
      },
      byAgent,
    });
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
    const { monthlyTokenCap, monthlySpendCap, alertThreshold, hardCapEnabled, anthropicApiKey } = body;

    const updateData: Record<string, unknown> = {
      monthlyTokenCap: monthlyTokenCap ?? null,
      monthlySpendCap: monthlySpendCap ?? null,
      alertThreshold: alertThreshold ?? 0.8,
      hardCapEnabled: hardCapEnabled ?? false,
      updatedAt: new Date(),
    };
    // Only update the API key if explicitly provided (allows clearing with empty string)
    if (anthropicApiKey !== undefined) {
      updateData.anthropicApiKey = anthropicApiKey || null;
    }

    const budget = await prisma.orgLlmBudget.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        monthlyTokenCap: monthlyTokenCap ?? null,
        monthlySpendCap: monthlySpendCap ?? null,
        alertThreshold: alertThreshold ?? 0.8,
        hardCapEnabled: hardCapEnabled ?? false,
        anthropicApiKey: anthropicApiKey || null,
        currentPeriodStart: currentPeriodStart(),
      },
      update: updateData,
    });

    return NextResponse.json({
      budget: { ...budget, anthropicApiKey: budget.anthropicApiKey ? "***set***" : null },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("POST /api/admin/budgets error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
