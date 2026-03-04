import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

// ─── Type helpers ────────────────────────────────────────────────────────────

function basicAuthHeader(username: string, apiToken: string) {
  return "Basic " + Buffer.from(`${username}:${apiToken}`).toString("base64");
}

function bearerHeader(apiToken: string) {
  return "Bearer " + apiToken;
}

// ─── Syncer per integration type ─────────────────────────────────────────────

async function syncJira(integration: {
  id: string;
  baseUrl: string;
  username: string | null;
  apiToken: string;
  projectKey: string | null;
}): Promise<{ content: string; subCategory: string; count: number }> {
  const jql = integration.projectKey
    ? `project=${integration.projectKey}`
    : "ORDER BY created DESC";
  const url = `${integration.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,description,issuetype,status,priority,labels,assignee`;

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

  const lines = issues.map((issue: unknown) => {
    const i = issue as Record<string, unknown>;
    const fields = (i.fields || {}) as Record<string, unknown>;
    const issuetype = (fields.issuetype as Record<string, unknown>)?.name || "Issue";
    const status = (fields.status as Record<string, unknown>)?.name || "Unknown";
    const priority = (fields.priority as Record<string, unknown>)?.name || "Medium";
    const summary = (fields.summary as string) || "(no title)";
    const descObj = fields.description as Record<string, unknown> | null;
    // Jira Cloud returns ADF (Atlassian Document Format); extract plain text
    let desc = "";
    if (descObj && descObj.content) {
      desc = extractAdfText(descObj);
    }
    return `# ${issuetype} ${i.key}: ${summary}\n**Status**: ${status}\n**Priority**: ${priority}${desc ? `\n${desc.slice(0, 300)}` : ""}`;
  });

  const subCategory = `Jira - ${integration.projectKey || "All Projects"}`;
  return {
    content: lines.join("\n\n---\n\n"),
    subCategory,
    count: issues.length,
  };
}

function extractAdfText(node: Record<string, unknown>): string {
  if (node.type === "text") return (node.text as string) || "";
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractAdfText).join(" ");
  }
  return "";
}

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

async function syncAzureDevOps(integration: {
  id: string;
  baseUrl: string;
  username: string | null;
  apiToken: string;
  projectKey: string | null;
}): Promise<{ content: string; subCategory: string; count: number }> {
  // projectKey is "org/project"
  const [org, project] = (integration.projectKey || "").split("/");
  const baseUrl = integration.baseUrl.replace(/\/$/, "");

  // WIQL query to get work item IDs
  const wiqlUrl = `${baseUrl}/${org}/${project}/_apis/wit/wiql?api-version=7.0`;
  const wiqlRes = await fetch(wiqlUrl, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(integration.username || "", integration.apiToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "SELECT [System.Id] FROM WorkItems ORDER BY [System.ChangedDate] DESC" }),
  });

  if (!wiqlRes.ok) {
    throw new Error(`Azure DevOps WIQL error: ${wiqlRes.status} ${await wiqlRes.text()}`);
  }

  const wiqlData = await wiqlRes.json();
  const ids: number[] = ((wiqlData.workItems || []) as { id: number }[]).slice(0, 100).map((w) => w.id);

  if (ids.length === 0) {
    return { content: "No work items found.", subCategory: `Azure DevOps - ${integration.projectKey}`, count: 0 };
  }

  const fieldsUrl = `${baseUrl}/${org}/${project}/_apis/wit/workitems?ids=${ids.join(",")}&fields=System.Title,System.Description,System.WorkItemType,System.State,System.Priority&api-version=7.0`;
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

  const lines = items.map((item: unknown) => {
    const w = item as Record<string, unknown>;
    const f = (w.fields || {}) as Record<string, string>;
    return `# ${f["System.WorkItemType"] || "Item"} #${w.id}: ${f["System.Title"] || "(no title)"}\n**State**: ${f["System.State"] || "Unknown"}\n${f["System.Description"] ? stripHtml(f["System.Description"]).slice(0, 300) : ""}`;
  });

  return {
    content: lines.join("\n\n---\n\n"),
    subCategory: `Azure DevOps - ${integration.projectKey}`,
    count: items.length,
  };
}

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
    // Extract title from the first title-type property
    let title = "(no title)";
    for (const [, prop] of Object.entries(props)) {
      const pr = prop as Record<string, unknown>;
      if (pr.type === "title" && Array.isArray(pr.title)) {
        title = (pr.title as { plain_text?: string }[]).map((t) => t.plain_text || "").join("");
        break;
      }
    }
    // Format properties as key: value pairs
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
          const result = await syncJira(integration);
          docsToCreate = [{ content: result.content, subCategory: result.subCategory }];
          totalCount = result.count;
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

      // Delete previously synced docs for this integration
      await prisma.contextDocument.deleteMany({
        where: {
          organizationId: integration.organizationId,
          metadata: { path: ["integrationId"], equals: id },
        },
      });

      // Create new ContextDocuments
      const now = new Date().toISOString();
      for (const doc of docsToCreate) {
        if (!doc.content.trim()) continue;
        const contentBytes = Buffer.byteLength(doc.content, "utf8");
        await prisma.contextDocument.create({
          data: {
            organizationId: integration.organizationId,
            fileName: `${integration.name} — ${doc.subCategory}.md`,
            fileType: "text/markdown",
            fileSize: contentBytes,
            filePath: `integration://${integration.type}/${id}/${now}`,
            category: "integration",
            subCategory: doc.subCategory,
            status: "PROCESSED",
            chunkCount: 1,
            metadata: {
              integrationId: id,
              integrationType: integration.type,
              integrationName: integration.name,
              content: doc.content,
              syncedAt: now,
            },
          },
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
