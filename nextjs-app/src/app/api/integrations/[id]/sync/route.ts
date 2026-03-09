import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { generateEmbedding } from "@/lib/embeddings";
import { chunkText } from "@/lib/text-extractor";

// ─── Type helpers ────────────────────────────────────────────────────────────

function basicAuthHeader(username: string, apiToken: string) {
  return "Basic " + Buffer.from(`${username}:${apiToken}`).toString("base64");
}

function bearerHeader(apiToken: string) {
  return "Bearer " + apiToken;
}

// ─── Jira sync ───────────────────────────────────────────────────────────────
//
// Hierarchy mapping (explicitly labelled in output for the Discovery agent):
//   Jira PROJECT / COMPONENT  →  L0: Product Group  (if components exist)
//   Jira PROJECT              →  L1: Product
//   EPIC                      →  L2: Capability
//   STORY / FEATURE / TASK    →  L3: Functionality
//
// The structured preamble at the top of each synced doc lets the Discovery
// agent correctly assign Epics as Capabilities and Stories as Functionalities
// rather than treating them generically as "issues".

async function syncJira(integration: {
  id: string;
  name: string;
  baseUrl: string;
  username: string | null;
  apiToken: string;
  projectKey: string | null;
}): Promise<{ content: string; subCategory: string; count: number }[]> {
  const jql = integration.projectKey
    ? `project=${integration.projectKey} ORDER BY issuetype ASC, created DESC`
    : "ORDER BY issuetype ASC, created DESC";

  // Fetch epics first (to build parent→children map)
  const url = `${integration.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=200&fields=summary,description,issuetype,status,priority,labels,assignee,components,parent,customfield_10014`;

  const res = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(integration.username || "", integration.apiToken),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const issues: unknown[] = data.issues || [];

  // ── Classify issues by type ──
  type JiraIssue = {
    key: string;
    summary: string;
    type: string;
    status: string;
    priority: string;
    description: string;
    components: string[];
    labels: string[];
    parentKey: string | null;
  };

  const epics: JiraIssue[] = [];
  const features: JiraIssue[] = [];
  const orphans: JiraIssue[] = []; // stories without a recognised epic parent
  const allComponents = new Set<string>();

  for (const issue of issues) {
    const i = issue as Record<string, unknown>;
    const fields = (i.fields || {}) as Record<string, unknown>;
    const typeName = ((fields.issuetype as Record<string, unknown>)?.name as string || "Story").toLowerCase();
    const status = ((fields.status as Record<string, unknown>)?.name as string) || "Unknown";
    const priority = ((fields.priority as Record<string, unknown>)?.name as string) || "Medium";
    const summary = (fields.summary as string) || "(no title)";
    const descObj = fields.description as Record<string, unknown> | null;
    let desc = "";
    if (descObj?.content) desc = extractAdfText(descObj).slice(0, 400);

    const comps = ((fields.components as unknown[]) || []).map(
      (c) => ((c as Record<string, unknown>).name as string) || ""
    ).filter(Boolean);
    comps.forEach((c) => allComponents.add(c));

    const labels = ((fields.labels as string[]) || []);

    // Parent detection: Cloud Jira stores parent on all issue types
    const parentField = fields.parent as Record<string, unknown> | null;
    const parentKey = parentField ? (parentField.key as string) : null;

    const ji: JiraIssue = {
      key: i.key as string,
      summary,
      type: typeName,
      status,
      priority,
      description: desc,
      components: comps,
      labels,
      parentKey,
    };

    if (typeName === "epic") {
      epics.push(ji);
    } else if (parentKey) {
      features.push(ji);
    } else {
      orphans.push(ji);
    }
  }

  // ── Build epic → children map ──
  const epicChildren = new Map<string, JiraIssue[]>();
  for (const epic of epics) epicChildren.set(epic.key, []);
  for (const f of features) {
    if (f.parentKey && epicChildren.has(f.parentKey)) {
      epicChildren.get(f.parentKey)!.push(f);
    } else {
      orphans.push(f); // parent is not an epic we know of
    }
  }

  // ── Format output ──
  const projectKey = integration.projectKey || "PROJECT";
  const lines: string[] = [
    `# TransformHub Hierarchy Mapping — Jira Project: ${projectKey} (${integration.name})`,
    ``,
    `> **AI Agent Reading Guide** — use this mapping when building the discovery hierarchy:`,
    `> - Jira **PROJECT** = **L1: Product** → "${integration.name}"`,
    `> - Jira **COMPONENT** = **L0: Product Group** signal (group related products)`,
    `> - Jira **EPIC** = **L2: Capability** (a major functional area of the product)`,
    `> - Jira **STORY / FEATURE / TASK** = **L3: Functionality** (a specific user-facing feature)`,
    `> - Story assignee / label ≈ **Persona** hint`,
    ``,
  ];

  // L0: Product Group from components
  if (allComponents.size > 0) {
    lines.push(`## L0: Product Groups (from Jira Components)`);
    for (const c of allComponents) lines.push(`- ${c}`);
    lines.push(``);
  }

  lines.push(`## L1: Product`);
  lines.push(`- **${integration.name}** (Jira project key: ${projectKey})`);
  lines.push(``);

  // L2: Capabilities (Epics) with nested L3 Functionalities
  if (epics.length > 0) {
    lines.push(`## L2: Capabilities (Epics)`);
    lines.push(``);
    for (const epic of epics) {
      lines.push(`### [L2: Capability] ${epic.key} — ${epic.summary}`);
      lines.push(`**Status**: ${epic.status} | **Priority**: ${epic.priority}`);
      if (epic.components.length) lines.push(`**Product Group**: ${epic.components.join(", ")}`);
      if (epic.description) lines.push(`> ${epic.description}`);
      lines.push(``);

      const children = epicChildren.get(epic.key) || [];
      if (children.length > 0) {
        lines.push(`#### L3: Functionalities under "${epic.summary}"`);
        for (const child of children) {
          const personaHint = child.labels.length ? ` | **Persona hint**: ${child.labels.join(", ")}` : "";
          lines.push(`- **[L3: Functionality]** ${child.key} — ${child.summary}`);
          lines.push(`  **Status**: ${child.status} | **Type**: ${child.type}${personaHint}`);
          if (child.description) lines.push(`  > ${child.description}`);
        }
        lines.push(``);
      }
    }
  }

  // Orphaned stories (no parent epic — still L3 candidates)
  if (orphans.length > 0) {
    lines.push(`## L3: Functionalities (no parent Epic)`);
    for (const o of orphans) {
      const personaHint = o.labels.length ? ` | **Persona hint**: ${o.labels.join(", ")}` : "";
      lines.push(`- **[L3: Functionality]** ${o.key} — ${o.summary}`);
      lines.push(`  **Status**: ${o.status} | **Type**: ${o.type}${personaHint}`);
    }
    lines.push(``);
  }

  const subCategory = `Jira - ${projectKey}`;
  const content = lines.join("\n");
  return [{ content, subCategory, count: issues.length }];
}

function extractAdfText(node: Record<string, unknown>): string {
  if (node.type === "text") return (node.text as string) || "";
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractAdfText).join(" ");
  }
  return "";
}

// ─── Confluence sync ─────────────────────────────────────────────────────────

async function syncConfluence(integration: {
  id: string;
  baseUrl: string;
  username: string | null;
  apiToken: string;
  projectKey: string | null;
}): Promise<{ content: string; subCategory: string; count: number }[]> {
  const spaceKey = integration.projectKey;
  const url = `${integration.baseUrl}/wiki/rest/api/content?${spaceKey ? `spaceKey=${spaceKey}&` : ""}type=page&expand=body.storage&limit=50`;

  const res = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(integration.username || "", integration.apiToken),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Confluence API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const pages: unknown[] = data.results || [];
  const subCategory = `Confluence - ${spaceKey || "All Spaces"}`;

  return pages.map((page: unknown) => {
    const p = page as Record<string, unknown>;
    const title = (p.title as string) || "Untitled";
    const bodyObj = (p.body as Record<string, unknown>)?.storage as Record<string, unknown>;
    const html = (bodyObj?.value as string) || "";
    const text = stripHtml(html).slice(0, 2000);
    return {
      content: `# ${title}\n\n${text}`,
      subCategory,
      count: 1,
    };
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Azure DevOps sync ───────────────────────────────────────────────────────
//
// Hierarchy mapping:
//   ADO AREA PATH   →  L0: Product Group
//   ADO PROJECT     →  L1: Product
//   EPIC            →  L2: Capability
//   FEATURE         →  L3: Functionality
//   USER STORY      →  Sub-functionality / Persona activity (brief listing)

async function syncAzureDevOps(integration: {
  id: string;
  name: string;
  baseUrl: string;
  username: string | null;
  apiToken: string;
  projectKey: string | null;
}): Promise<{ content: string; subCategory: string; count: number }> {
  // projectKey is "org/project"
  const [org, project] = (integration.projectKey || "").split("/");
  const baseUrl = integration.baseUrl.replace(/\/$/, "");

  // WIQL: fetch Epics and Features (the two levels we care most about)
  const wiqlUrl = `${baseUrl}/${org}/${project}/_apis/wit/wiql?api-version=7.0`;
  const wiqlRes = await fetch(wiqlUrl, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(integration.username || "", integration.apiToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query:
        "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] IN ('Epic','Feature','User Story') ORDER BY [System.WorkItemType] ASC, [System.ChangedDate] DESC",
    }),
  });

  if (!wiqlRes.ok) {
    throw new Error(`Azure DevOps WIQL error: ${wiqlRes.status} ${await wiqlRes.text()}`);
  }

  const wiqlData = await wiqlRes.json();
  const ids: number[] = ((wiqlData.workItems || []) as { id: number }[])
    .slice(0, 200)
    .map((w) => w.id);

  if (ids.length === 0) {
    return {
      content: "No work items found.",
      subCategory: `Azure DevOps - ${integration.projectKey}`,
      count: 0,
    };
  }

  const fieldsUrl =
    `${baseUrl}/${org}/${project}/_apis/wit/workitems?ids=${ids.join(",")}&` +
    `fields=System.Title,System.Description,System.WorkItemType,System.State,System.Priority,System.AreaPath,System.Parent,System.Tags&api-version=7.0`;
  const fieldsRes = await fetch(fieldsUrl, {
    headers: {
      Authorization: basicAuthHeader(integration.username || "", integration.apiToken),
      "Content-Type": "application/json",
    },
  });

  if (!fieldsRes.ok) {
    throw new Error(`Azure DevOps work items error: ${fieldsRes.status} ${await fieldsRes.text()}`);
  }

  const fieldsData = await fieldsRes.json();
  const items: unknown[] = fieldsData.value || [];

  // ── Classify by WorkItemType ──
  type AdoItem = {
    id: number;
    title: string;
    type: string;
    state: string;
    priority: string;
    areaPath: string;
    parentId: number | null;
    tags: string;
    description: string;
  };

  const epicsList: AdoItem[] = [];
  const featuresList: AdoItem[] = [];
  const storiesList: AdoItem[] = [];
  const areaPaths = new Set<string>();

  for (const item of items) {
    const w = item as Record<string, unknown>;
    const f = (w.fields || {}) as Record<string, unknown>;
    const type = (f["System.WorkItemType"] as string) || "Task";
    const areaPath = (f["System.AreaPath"] as string) || "";
    // Area path: "ProjectName\TeamName\SubTeam" — extract the team part as Product Group signal
    const areaSegments = areaPath.split("\\").slice(1); // drop project root
    if (areaSegments.length > 0) areaPaths.add(areaSegments[0]);

    const ai: AdoItem = {
      id: w.id as number,
      title: (f["System.Title"] as string) || "(no title)",
      type,
      state: (f["System.State"] as string) || "Unknown",
      priority: String(f["System.Priority"] || ""),
      areaPath,
      parentId: (f["System.Parent"] as number | null) ?? null,
      tags: (f["System.Tags"] as string) || "",
      description: f["System.Description"]
        ? stripHtml(f["System.Description"] as string).slice(0, 400)
        : "",
    };

    if (type === "Epic") epicsList.push(ai);
    else if (type === "Feature") featuresList.push(ai);
    else storiesList.push(ai);
  }

  // Build parent→children maps
  const epicChildren = new Map<number, AdoItem[]>();
  for (const e of epicsList) epicChildren.set(e.id, []);
  const orphanFeatures: AdoItem[] = [];
  for (const f of featuresList) {
    if (f.parentId && epicChildren.has(f.parentId)) {
      epicChildren.get(f.parentId)!.push(f);
    } else {
      orphanFeatures.push(f);
    }
  }

  const featureChildren = new Map<number, AdoItem[]>();
  for (const f of featuresList) featureChildren.set(f.id, []);
  const orphanStories: AdoItem[] = [];
  for (const s of storiesList) {
    if (s.parentId && featureChildren.has(s.parentId)) {
      featureChildren.get(s.parentId)!.push(s);
    } else {
      orphanStories.push(s);
    }
  }

  // ── Format output ──
  const lines: string[] = [
    `# TransformHub Hierarchy Mapping — Azure DevOps: ${org}/${project} (${integration.name})`,
    ``,
    `> **AI Agent Reading Guide** — use this mapping when building the discovery hierarchy:`,
    `> - ADO **AREA PATH** = **L0: Product Group** signal (e.g., "Digital Channels", "Core Banking")`,
    `> - ADO **PROJECT** = **L1: Product** → "${integration.name}"`,
    `> - ADO **EPIC** = **L2: Capability** (a major functional area of the product)`,
    `> - ADO **FEATURE** = **L3: Functionality** (a specific deliverable feature)`,
    `> - ADO **USER STORY** = Sub-functionality / Persona activity`,
    `> - Story **Tags** / **Area Path** ≈ **Persona** or **Product Group** hint`,
    ``,
  ];

  // L0: Product Groups from Area Paths
  if (areaPaths.size > 0) {
    lines.push(`## L0: Product Groups (from ADO Area Paths)`);
    for (const ap of areaPaths) lines.push(`- ${ap}`);
    lines.push(``);
  }

  lines.push(`## L1: Product`);
  lines.push(`- **${integration.name}** (ADO project: ${project})`);
  lines.push(``);

  // L2: Capabilities (Epics) with L3 Functionalities (Features) nested
  if (epicsList.length > 0) {
    lines.push(`## L2: Capabilities (Epics)`);
    lines.push(``);
    for (const epic of epicsList) {
      const areaHint = epic.areaPath.split("\\").slice(1, 2).join("") || "";
      lines.push(`### [L2: Capability] #${epic.id} — ${epic.title}`);
      lines.push(`**State**: ${epic.state}${epic.priority ? ` | **Priority**: ${epic.priority}` : ""}${areaHint ? ` | **Product Group**: ${areaHint}` : ""}`);
      if (epic.description) lines.push(`> ${epic.description}`);
      lines.push(``);

      const children = epicChildren.get(epic.id) || [];
      if (children.length > 0) {
        lines.push(`#### L3: Functionalities under "${epic.title}"`);
        for (const feat of children) {
          const tagHint = feat.tags ? ` | **Persona hint**: ${feat.tags}` : "";
          lines.push(`- **[L3: Functionality]** #${feat.id} — ${feat.title}`);
          lines.push(`  **State**: ${feat.state}${tagHint}`);
          if (feat.description) lines.push(`  > ${feat.description}`);

          // User stories under this feature (brief — persona signals)
          const stories = featureChildren.get(feat.id) || [];
          if (stories.length > 0) {
            lines.push(`  *User Stories (persona activities)*:`);
            for (const s of stories.slice(0, 5)) {
              const tagHint2 = s.tags ? ` [${s.tags}]` : "";
              lines.push(`  - ${s.title}${tagHint2} (${s.state})`);
            }
          }
        }
        lines.push(``);
      }
    }
  }

  // Orphaned Features
  if (orphanFeatures.length > 0) {
    lines.push(`## L3: Functionalities (no parent Epic)`);
    for (const f of orphanFeatures) {
      lines.push(`- **[L3: Functionality]** #${f.id} — ${f.title} (${f.state})`);
    }
    lines.push(``);
  }

  return {
    content: lines.join("\n"),
    subCategory: `Azure DevOps - ${integration.projectKey}`,
    count: items.length,
  };
}

// ─── Notion sync ─────────────────────────────────────────────────────────────

async function syncNotion(integration: {
  id: string;
  baseUrl: string;
  apiToken: string;
  projectKey: string | null;
}): Promise<{ content: string; subCategory: string; count: number }> {
  const databaseId = integration.projectKey;
  if (!databaseId) {
    throw new Error("Notion requires a projectKey (database ID)");
  }

  const url = `${integration.baseUrl}/v1/databases/${databaseId}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: bearerHeader(integration.apiToken),
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({ page_size: 100 }),
  });

  if (!res.ok) {
    throw new Error(`Notion API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const pages: unknown[] = data.results || [];

  const lines = pages.map((page: unknown) => {
    const p = page as Record<string, unknown>;
    const props = (p.properties || {}) as Record<string, unknown>;
    let title = "(no title)";
    for (const [, prop] of Object.entries(props)) {
      const pr = prop as Record<string, unknown>;
      if (pr.type === "title" && Array.isArray(pr.title)) {
        title = (pr.title as { plain_text?: string }[]).map((t) => t.plain_text || "").join("");
        break;
      }
    }
    const propLines = Object.entries(props)
      .filter(([, v]) => (v as Record<string, unknown>).type !== "title")
      .map(([key, val]) => {
        const v = val as Record<string, unknown>;
        let strVal = "";
        if (v.type === "rich_text" && Array.isArray(v.rich_text)) {
          strVal = (v.rich_text as { plain_text?: string }[]).map((t) => t.plain_text || "").join("");
        } else if (v.type === "select" && v.select) {
          strVal = (v.select as { name?: string }).name || "";
        } else if (v.type === "multi_select" && Array.isArray(v.multi_select)) {
          strVal = (v.multi_select as { name?: string }[]).map((s) => s.name || "").join(", ");
        } else if (v.type === "status" && v.status) {
          strVal = (v.status as { name?: string }).name || "";
        } else if (v.type === "number") {
          strVal = String(v.number ?? "");
        } else if (v.type === "date" && v.date) {
          strVal = (v.date as { start?: string }).start || "";
        }
        return strVal ? `**${key}**: ${strVal}` : null;
      })
      .filter(Boolean);

    return `# ${title}\n${propLines.join("\n")}`;
  });

  return {
    content: lines.join("\n\n---\n\n"),
    subCategory: `Notion - ${databaseId}`,
    count: pages.length,
  };
}

// ─── ServiceNow sync ─────────────────────────────────────────────────────────

async function syncServiceNow(integration: {
  id: string;
  baseUrl: string;
  username: string | null;
  apiToken: string;
  projectKey: string | null;
}): Promise<{ content: string; subCategory: string; count: number }> {
  const table = integration.projectKey || "sc_req_item";
  const url = `${integration.baseUrl}/api/now/table/${table}?sysparm_limit=100&sysparm_fields=short_description,description,state,priority,number,category`;

  const res = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(integration.username || "", integration.apiToken),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`ServiceNow API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const records: unknown[] = data.result || [];

  const lines = records.map((record: unknown) => {
    const r = record as Record<string, string>;
    return `# ${r.number || "Record"}: ${r.short_description || "(no title)"}\n**State**: ${r.state || "Unknown"}\n**Priority**: ${r.priority || "Unknown"}\n${r.description ? r.description.slice(0, 300) : ""}`;
  });

  const instanceName = new URL(integration.baseUrl).hostname.split(".")[0];
  return {
    content: lines.join("\n\n---\n\n"),
    subCategory: `ServiceNow - ${instanceName}`,
    count: records.length,
  };
}

// ─── Embed & persist helpers ─────────────────────────────────────────────────

/**
 * Chunks content, generates embeddings for each chunk, and inserts into
 * context_embeddings. Falls back to inserting without vector if embedding
 * API is unavailable (record still surfaced by the fallback retrieval path).
 */
async function persistChunksWithEmbeddings(
  docId: string,
  organizationId: string,
  content: string,
  source: string
): Promise<void> {
  const chunks = chunkText(content, source);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await generateEmbedding(chunk.content);

    if (embedding) {
      const vectorStr = `[${embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO context_embeddings
           (id, context_document_id, organization_id, chunk_index, content, embedding, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, NOW())`,
        docId,
        organizationId,
        i,
        chunk.content,
        vectorStr
      );
    } else {
      // No embedding API available — insert without vector for fallback retrieval
      await prisma.contextEmbedding.create({
        data: {
          contextDocumentId: docId,
          organizationId,
          chunkIndex: i,
          content: chunk.content,
        },
      });
    }
  }
}

// ─── Main sync handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const integration = await prisma.externalIntegration.findUnique({ where: { id } });
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (integration.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Mark as syncing
    await prisma.externalIntegration.update({
      where: { id },
      data: { status: "syncing", errorMessage: null },
    });

    try {
      let docsToCreate: { content: string; subCategory: string }[] = [];
      let totalCount = 0;

      switch (integration.type) {
        case "jira": {
          const results = await syncJira(integration);
          docsToCreate = results.map((r) => ({ content: r.content, subCategory: r.subCategory }));
          totalCount = results[0]?.count ?? 0;
          break;
        }
        case "confluence": {
          const results = await syncConfluence(integration);
          docsToCreate = results.map((r) => ({ content: r.content, subCategory: r.subCategory }));
          totalCount = results.length;
          break;
        }
        case "azure_devops": {
          const result = await syncAzureDevOps(integration);
          docsToCreate = [{ content: result.content, subCategory: result.subCategory }];
          totalCount = result.count;
          break;
        }
        case "notion": {
          const result = await syncNotion(integration);
          docsToCreate = [{ content: result.content, subCategory: result.subCategory }];
          totalCount = result.count;
          break;
        }
        case "servicenow": {
          const result = await syncServiceNow(integration);
          docsToCreate = [{ content: result.content, subCategory: result.subCategory }];
          totalCount = result.count;
          break;
        }
        default:
          throw new Error(`Unsupported integration type: ${integration.type}`);
      }

      // Delete previously synced docs (and their embeddings) for this integration
      const existingDocs = await prisma.contextDocument.findMany({
        where: {
          organizationId: integration.organizationId,
          metadata: { path: ["integrationId"], equals: id },
        },
        select: { id: true },
      });
      if (existingDocs.length > 0) {
        const existingIds = existingDocs.map((d) => d.id);
        await prisma.contextEmbedding.deleteMany({
          where: { contextDocumentId: { in: existingIds } },
        });
        await prisma.contextDocument.deleteMany({
          where: { id: { in: existingIds } },
        });
      }

      // Create new ContextDocuments + embeddings
      const now = new Date().toISOString();
      let chunksCreated = 0;

      for (const doc of docsToCreate) {
        if (!doc.content.trim()) continue;
        const contentBytes = Buffer.byteLength(doc.content, "utf8");

        const created = await prisma.contextDocument.create({
          data: {
            organizationId: integration.organizationId,
            fileName: `${integration.name} — ${doc.subCategory}.md`,
            fileType: "text/markdown",
            fileSize: contentBytes,
            filePath: `integration://${integration.type}/${id}/${now}`,
            category: "integration",
            subCategory: doc.subCategory,
            status: "INDEXED",
            chunkCount: 0, // updated after chunking
            metadata: {
              integrationId: id,
              integrationType: integration.type,
              integrationName: integration.name,
              syncedAt: now,
            },
          },
        });

        // Chunk + embed
        const source = `${integration.name} — ${doc.subCategory}`;
        await persistChunksWithEmbeddings(
          created.id,
          integration.organizationId,
          doc.content,
          source
        );

        const chunks = chunkText(doc.content, source);
        chunksCreated += chunks.length;

        // Update chunkCount
        await prisma.contextDocument.update({
          where: { id: created.id },
          data: { chunkCount: chunks.length },
        });
      }

      // Mark as synced
      await prisma.externalIntegration.update({
        where: { id },
        data: {
          status: "synced",
          lastSyncAt: new Date(),
          syncedItems: totalCount,
          errorMessage: null,
        },
      });

      return NextResponse.json({
        success: true,
        syncedItems: totalCount,
        docsCreated: docsToCreate.length,
        chunksIndexed: chunksCreated,
      });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : String(syncError);
      await prisma.externalIntegration.update({
        where: { id },
        data: { status: "error", errorMessage: message },
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } catch (error) {
    console.error("Sync route error:", error);
    return NextResponse.json({ error: "Failed to sync integration" }, { status: 500 });
  }
}

// ─── Test connection (GET) ───────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const integration = await prisma.externalIntegration.findUnique({ where: { id } });
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (integration.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Lightweight connectivity test per type
    let testUrl = "";
    let headers: Record<string, string> = { "Content-Type": "application/json" };

    switch (integration.type) {
      case "jira":
        testUrl = `${integration.baseUrl}/rest/api/3/myself`;
        headers.Authorization = basicAuthHeader(integration.username || "", integration.apiToken);
        break;
      case "confluence":
        testUrl = `${integration.baseUrl}/wiki/rest/api/space?limit=1`;
        headers.Authorization = basicAuthHeader(integration.username || "", integration.apiToken);
        break;
      case "azure_devops": {
        const [org] = (integration.projectKey || "").split("/");
        testUrl = `${integration.baseUrl}/${org}/_apis/projects?api-version=7.0`;
        headers.Authorization = basicAuthHeader(integration.username || "", integration.apiToken);
        break;
      }
      case "notion":
        testUrl = `${integration.baseUrl}/v1/users/me`;
        headers.Authorization = bearerHeader(integration.apiToken);
        headers["Notion-Version"] = "2022-06-28";
        break;
      case "servicenow":
        testUrl = `${integration.baseUrl}/api/now/table/sys_user?sysparm_limit=1`;
        headers.Authorization = basicAuthHeader(integration.username || "", integration.apiToken);
        break;
      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    const res = await fetch(testUrl, { headers });
    if (res.ok) {
      return NextResponse.json({ connected: true, status: res.status });
    } else {
      return NextResponse.json({ connected: false, status: res.status, error: await res.text() }, { status: 200 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ connected: false, error: message }, { status: 200 });
  }
}
