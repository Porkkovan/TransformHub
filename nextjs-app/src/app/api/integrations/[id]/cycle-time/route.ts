/**
 * Tier 3a: Jira Cycle Time Extraction
 * POST /api/integrations/[id]/cycle-time
 *
 * Fetches changelog for Jira epics/stories, computes per-status dwell time,
 * then updates value_stream_steps (or functionalities) with jira_measured timing.
 *
 * Mapping:
 *   EPIC key ≈ digital_capability name (matched by similarity)
 *   STORY key ≈ functionality name (matched by similarity)
 *   "In Progress" dwell time → process_time_hrs (timing_source = "jira_measured")
 *   "In Review" / "Blocked" dwell time → wait_time_hrs
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { createHash } from "crypto";

function basicAuth(username: string, token: string) {
  return "Basic " + Buffer.from(`${username}:${token}`).toString("base64");
}

// Status categories for process vs wait time
const IN_PROGRESS_STATUSES = new Set([
  "in progress", "in development", "in review", "code review",
  "in testing", "in qa", "in test", "development", "active",
]);
const WAIT_STATUSES = new Set([
  "blocked", "waiting", "on hold", "pending", "queued",
  "waiting for review", "waiting for deployment", "waiting for approval",
]);

interface StatusPeriod {
  status: string;
  durationMs: number;
}

async function fetchIssueChangelog(
  baseUrl: string,
  auth: string,
  issueKey: string
): Promise<StatusPeriod[]> {
  const url = `${baseUrl}/rest/api/3/issue/${issueKey}/changelog?maxResults=100`;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) return [];

  const data = await res.json();
  const histories: unknown[] = data.values || [];

  const transitions: { status: string; timestamp: number }[] = [];

  for (const history of histories) {
    const h = history as Record<string, unknown>;
    const items = (h.items as unknown[]) || [];
    const created = new Date((h.created as string) || "").getTime();
    for (const item of items) {
      const it = item as Record<string, unknown>;
      if ((it.field as string) === "status") {
        transitions.push({ status: (it.toString as string) || "", timestamp: created });
      }
    }
  }

  if (transitions.length === 0) return [];

  transitions.sort((a, b) => a.timestamp - b.timestamp);

  const periods: StatusPeriod[] = [];
  for (let i = 0; i < transitions.length - 1; i++) {
    periods.push({
      status: transitions[i].status.toLowerCase(),
      durationMs: transitions[i + 1].timestamp - transitions[i].timestamp,
    });
  }
  return periods;
}

function msToHours(ms: number): number {
  // Convert to working-hours (8h/day, 5d/week)
  const workingHoursPerMs = 8 / (24 * 60 * 60 * 1000);
  return Math.round(ms * workingHoursPerMs * 100) / 100;
}

function computeCycleTimes(periods: StatusPeriod[]): {
  processTimeHrs: number;
  waitTimeHrs: number;
} {
  let processMs = 0;
  let waitMs = 0;
  for (const p of periods) {
    if (IN_PROGRESS_STATUSES.has(p.status)) processMs += p.durationMs;
    else if (WAIT_STATUSES.has(p.status)) waitMs += p.durationMs;
  }
  return {
    processTimeHrs: msToHours(processMs),
    waitTimeHrs: msToHours(waitMs),
  };
}

function similarity(a: string, b: string): number {
  const aa = a.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/);
  const bb = new Set(b.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/));
  const intersection = aa.filter((w) => bb.has(w) && w.length > 2);
  return intersection.length / Math.max(aa.length, bb.size, 1);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("ANALYST");
    const { id } = await params;

    const integration = await prisma.externalIntegration.findUnique({ where: { id } });
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (integration.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (integration.type !== "jira") {
      return NextResponse.json(
        { error: "Cycle time extraction only supports Jira integrations" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const repositoryId: string | undefined = body.repositoryId;
    const maxIssues: number = Math.min(body.maxIssues ?? 50, 200);

    // 1. Fetch epics + stories from Jira
    const jql = integration.projectKey
      ? `project=${integration.projectKey} AND issuetype IN (Epic,Story,Task) ORDER BY issuetype ASC`
      : "issuetype IN (Epic,Story,Task) ORDER BY issuetype ASC";

    const searchUrl = `${integration.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxIssues}&fields=summary,issuetype,status`;
    const auth = basicAuth(integration.username || "", integration.apiToken);
    const searchRes = await fetch(searchUrl, { headers: { Authorization: auth } });
    if (!searchRes.ok) {
      return NextResponse.json({ error: `Jira API error: ${searchRes.status}` }, { status: 502 });
    }

    const searchData = await searchRes.json();
    const issues: unknown[] = searchData.issues || [];

    // 2. Load value_stream_steps and functionalities for this repo/org
    const orgId = user.organizationId!;
    const stepRows = await prisma.valueStreamStep.findMany({
      where: {
        productGroup: {
          digitalProduct: {
            repository: repositoryId
              ? { id: repositoryId }
              : { organizationId: orgId },
          },
        },
      },
      select: { id: true, name: true },
    });

    const funcRows = await prisma.functionality.findMany({
      where: {
        digitalCapability: {
          digitalProduct: {
            repository: repositoryId
              ? { id: repositoryId }
              : { organizationId: orgId },
          },
        },
      },
      select: { id: true, name: true },
    });

    // 3. For each issue, fetch changelog and compute cycle time
    let stepsUpdated = 0;
    let funcsUpdated = 0;
    const auditEntries: object[] = [];

    for (const issue of issues) {
      const i = issue as Record<string, unknown>;
      const fields = (i.fields || {}) as Record<string, unknown>;
      const typeName = (
        (fields.issuetype as Record<string, unknown>)?.name as string || ""
      ).toLowerCase();
      const summary = (fields.summary as string) || "";
      const issueKey = i.key as string;

      const periods = await fetchIssueChangelog(
        integration.baseUrl,
        auth,
        issueKey
      );
      if (periods.length === 0) continue;

      const { processTimeHrs, waitTimeHrs } = computeCycleTimes(periods);
      if (processTimeHrs === 0 && waitTimeHrs === 0) continue;

      if (typeName === "epic") {
        // Try matching to a value_stream_step
        const best = stepRows.reduce(
          (acc, s) => {
            const score = similarity(summary, s.name);
            return score > acc.score ? { id: s.id, score } : acc;
          },
          { id: "", score: 0 }
        );
        if (best.score >= 0.25 && best.id) {
          await prisma.valueStreamStep.update({
            where: { id: best.id },
            data: {
              processTimeHrs,
              waitTimeHrs,
              leadTimeHrs: processTimeHrs + waitTimeHrs,
              timingSource: "jira_measured",
              timingConfidence: Math.min(0.5 + periods.length * 0.02, 0.95),
            },
          });
          stepsUpdated++;
          auditEntries.push({ issueKey, summary, stepId: best.id, processTimeHrs, waitTimeHrs });
        }
      } else {
        // story/task → functionality
        const best = funcRows.reduce(
          (acc, f) => {
            const score = similarity(summary, f.name);
            return score > acc.score ? { id: f.id, score } : acc;
          },
          { id: "", score: 0 }
        );
        if (best.score >= 0.25 && best.id) {
          await prisma.functionality.update({
            where: { id: best.id },
            data: {
              estimatedCycleTimeMin: Math.round(processTimeHrs * 60),
              estimatedWaitTimeMin: Math.round(waitTimeHrs * 60),
              timingSource: "jira_measured",
              timingConfidence: Math.min(0.5 + periods.length * 0.02, 0.95),
            },
          });
          funcsUpdated++;
        }
      }
    }

    return NextResponse.json({
      issuesProcessed: issues.length,
      stepsUpdated,
      funcsUpdated,
      timingSource: "jira_measured",
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("cycle-time error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
