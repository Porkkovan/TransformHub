# TransformHub User Guide

**Version:** 1.0
**Platform:** TransformHub — AI-Powered Digital Transformation Intelligence
**Stack:** Next.js 15 · FastAPI · LangGraph · PostgreSQL + pgvector
**Audience:** Business Analysts, Digital Transformation Leads, Enterprise Architects, Platform Administrators

---

## Table of Contents

1. [About This Guide](#about-this-guide)
2. [Platform Overview](#platform-overview)
3. [Roles & Permissions Reference](#roles--permissions-reference)
4. [Getting Started](#getting-started)
5. [Organization Setup](#organization-setup)
6. [Context Hub — Knowledge Base Management](#context-hub--knowledge-base-management)
7. [Integrations](#integrations)
8. [Core Workflow: Step-by-Step](#core-workflow-step-by-step)
9. [Product Workbench](#product-workbench)
10. [Product Roadmap Page](#product-roadmap-page)
11. [Admin Reference](#admin-reference)
12. [Interpreting Quality Indicators](#interpreting-quality-indicators)
13. [Troubleshooting Reference](#troubleshooting-reference)
14. [Glossary of Key Terms](#glossary-of-key-terms)

---

## About This Guide

### How to Use This Guide

This is a reference guide — it is structured for lookup during actual work, not for linear reading. Each section assumes you are already in front of the platform and need to know what a screen does, what inputs it requires, what the output means, and what can go wrong.

Use the Table of Contents to jump directly to the agent, page, or concept you are working with. Every major section follows the same structure: purpose, pre-conditions, step-by-step procedure, output interpretation, and common gotchas.

### Document Conventions

| Convention | Meaning |
|------------|---------|
| `/discovery` | A URL path within the platform (e.g., `http://localhost:3000/discovery`) |
| `agent_type` | An identifier used in API calls or logs (e.g., `lean_vsm`) |
| ⚠️ | A warning — something that can silently produce incorrect results or data loss if ignored |
| 📌 | A critical note — something you must understand before proceeding |
| `monospace` | Code, field names, file names, or exact values to enter |
| L1 / L2 / L3 | Hierarchy levels: L1 = Segment/Product, L2 = Capability, L3 = Functionality/Step |

### Scope

This guide covers the TransformHub web application at paths `/` through `/admin/*`. It does not cover infrastructure setup, database migrations, or Python agent internals. For those, refer to the developer README in the project repository.

---

## Platform Overview

TransformHub is a multi-tenant enterprise SaaS platform that automates digital transformation analysis using 18 specialized AI agents built on LangGraph. It ingests your organization's repositories, process documents, architecture standards, and compliance frameworks, then generates structured intelligence: capability maps, value stream metrics, risk registers, transformation roadmaps, and future-state projections.

### How the Platform Works

1. You register your organization and define its business segments.
2. You populate the Context Hub with documents, URLs, Jira data, and code signals that give agents domain knowledge.
3. You run the Discovery agent to build a structured capability hierarchy from your repositories and uploaded context.
4. You run the Lean VSM agent to measure flow efficiency across that hierarchy using measured and estimated timing data.
5. You run subsequent agents (Future State, Risk, Architecture, Roadmap, etc.) in sequence or on demand, each building on the results of previous agents.
6. The platform stores all outputs in PostgreSQL and auto-saves agent results as Context Documents, enabling cross-agent knowledge chaining.

### The Data Hierarchy

Every piece of analysis in TransformHub is anchored to this hierarchy:

```
Organization
  └── Repository
        └── Digital Product  (tagged with Business Segment)
              ├── Digital Capability  (L2)
              │     └── Functionality  (L3 — individual process steps)
              └── Product Group
                    └── Value Stream Step
```

Understanding this hierarchy is essential for interpreting all agent outputs correctly.

### Key Numbers at a Glance

- 18 LangGraph agents with 5–7 nodes each
- 8 document categories in the Context Hub
- 4 timing provenance types (jira_measured, code_signals, manual_override, llm_estimated)
- 4 user roles (VIEWER, ANALYST, ADMIN, SUPER_ADMIN)
- 3 VSM view levels (L1 segment, L2 product capabilities, L3 functionality steps)

---

## Roles & Permissions Reference

| Role | Discovery | Run Agents | Apply Overrides | Manage Org | Integrations | Admin Pages | API Key Mgmt |
|------|-----------|-----------|----------------|------------|-------------|-------------|-------------|
| VIEWER | Read only | No | No | No | No | No | No |
| ANALYST | Read + run | Yes | Yes | No | No | No | No |
| ADMIN | Read + run | Yes | Yes | Yes | Yes | No | Yes |
| SUPER_ADMIN | Full | Yes | Yes | Yes | Yes | Yes | Yes |

📌 ANALYST is the standard role for transformation leads and business architects who run the day-to-day analysis workflow. ADMIN is required to connect Jira, manage business segments, and set per-org Anthropic API keys. SUPER_ADMIN is required for pipeline management, dead letter queue operations, and approvals.

---

## Getting Started

### Logging In

Navigate to `/login`. TransformHub supports three authentication methods:

1. **Email / Password** — Enter your registered email address and password. Click "Sign in."
2. **Google SSO** — Click "Sign in with Google." You will be redirected to Google's OAuth consent screen. On return, you will land on the Dashboard.
3. **Microsoft Azure Entra ID (SSO)** — Click "Sign in with Microsoft." You will be redirected to your organization's Azure AD tenant. On return, you will land on the Dashboard.

⚠️ If SSO is configured for your organization, attempting to sign in with email/password using an SSO-provisioned account will fail. Use the SSO button instead.

After first login, the platform checks whether an organization is associated with your account. If none exists, you are redirected to `/organizations` to create one.

### Switching Organisations

TransformHub is multi-tenant. All data — repositories, capabilities, risk assessments, context documents — is scoped to the currently active organization.

1. Look for the organization selector in the top navigation bar (shows the current organization name).
2. Click it to open the switcher dropdown.
3. Select a different organization from the list.
4. The page reloads and all data on screen refreshes to the selected organization.

⚠️ If the page shows stale data from a previous session, open the browser console and run `localStorage.removeItem("currentOrgId")`, then reload. This resets the org selector to the default (US Bank in demo environments).

### Understanding the Dashboard

The Dashboard at `/` provides a real-time summary of your organization's analysis state. It shows:

- **Repository count** — number of repositories scanned
- **Functionality count** — total L3 functionalities discovered
- **Risk summary** — counts of Critical / High / Medium / Low risk items
- **Recent executions** — the last agent runs with status indicators (COMPLETED, RUNNING, FAILED)

The Dashboard does not allow you to run agents. It is an overview only. Use the navigation to go to the relevant page to take action.

📌 If all counts show zero, the Discovery agent has not been run for this organization yet. Start at `/discovery`.

### Navigation Reference

| Page | Path | Purpose |
|------|------|---------|
| Dashboard | `/` | Real-time summary — repositories, functionalities, risk counts, recent executions |
| Organizations | `/organizations` | Create, edit, switch organizations; manage segments, personas, users |
| Context Hub | `/context-hub` | Upload documents, fetch URLs, manage integrations, search indexed content |
| Discovery | `/discovery` | Run Discovery agent; review and edit capability hierarchy |
| Value Stream Mapping | `/vsm` | Run Lean VSM agent; view flow efficiency at L1/L2/L3 |
| Risk & Compliance | `/risk-compliance` | Run Risk & Compliance agent; view risk register and compliance mappings |
| Product Workbench | `/product-workbench` | Run any agent on demand; view architecture analysis and readiness scores |
| Future State Vision | `/future-state` | Run Future State Vision agent; view three-scenario projections |
| Product Roadmap | `/product-roadmap` | View transformation roadmap timeline; filter by segment and strategy |
| RAG Accuracy | `/accuracy` | Inspect agent output quality, confidence scores, and context doc coverage |
| Admin Overview | `/admin` | Summary of pipeline status, pending approvals, recent executions |
| Agent Monitor | `/admin/agent-monitor` | Live status of all 18 agents; trigger re-runs |
| Audit Log | `/admin/audit-log` | Immutable append-only log of all data changes |
| Pipeline | `/admin/pipeline` | Agent execution queue management |
| Dead Letter Queue | `/admin/dead-letter` | Failed executions requiring manual intervention |
| Approvals | `/admin/approvals` | Human-in-the-loop approval gates for agent outputs |
| Notifications | `/admin/notifications` | Platform notification center |
| Backlog & OKR | `/admin/backlog-okr` | AI-generated backlog items and OKR frameworks |
| Change Impact | `/admin/change-impact` | Change cascade analysis |
| Cost Estimation | `/admin/cost-estimation` | Investment models and ROI calculations |
| Data Governance | `/admin/data-governance` | Data lineage and governance policies |
| Architecture | `/admin/architecture` | Architecture patterns and modernisation pathways |
| Security Agent | `/admin/security-agent` | Security posture and vulnerability map |
| Skill Gap | `/admin/skill-gap` | Team capability gap analysis |
| Testing & Validation | `/admin/testing-validation` | Quality gates and test strategy |
| Monitoring Agent | `/admin/monitoring-agent` | KPI framework and alerting thresholds |
| Market Intelligence | `/admin/market-intelligence` | Competitive landscape analysis |
| Documentation Agent | `/admin/documentation-agent` | Auto-generated technical and process documentation |
| Reports | `/admin/reports` | Exportable consolidated reports |
| AI Chat | `/admin/chat` | Conversational interface to platform data |

---

## Organization Setup

### Creating / Editing an Organisation

Navigate to `/organizations`. You will see a list of existing organizations and a "New Organization" button.

**To create a new organization:**

1. Click "New Organization." A form panel expands.
2. Enter the **Organization Name**. The platform auto-generates a URL slug (lowercase, hyphenated) as you type. You can edit the slug if needed.
3. Select the **Industry Type** from the dropdown. The platform auto-populates Regulatory Frameworks and Personas based on industry. For example, selecting "Banking & Financial Services" pre-fills APRA, AUSTRAC, and AML-CTF frameworks and populates FRONT_OFFICE / MIDDLE_OFFICE / BACK_OFFICE persona templates.
4. (Optional) Enter a **Description** for the organization.
5. Enter comma-separated **Competitors** (e.g., `Commonwealth Bank, ANZ, Westpac`). These are injected into Market Intelligence and VSM prompts.
6. Enter comma-separated **Business Segments** (e.g., `Retail Banking, Business Banking, Wealth Management`). Each segment appears as a filter across all agent pages and scopes which digital products appear in each view.
7. Review the auto-populated **Regulatory Frameworks** and remove any that do not apply.
8. Review the auto-populated **Personas** (role types with responsibility lists). These drive the Persona-Functionality Matrix in Discovery.
9. Click "Save Organization."

**To edit an existing organization:**

1. Click the pencil icon on the organization card.
2. Modify any field. Changing Business Segments will cascade-update `digital_products.business_segment` by position mapping — the first segment in the new list maps to the first in the old list.

⚠️ Renaming or reordering Business Segments after Discovery has already run will remap product-segment assignments. If products were tagged with specific segments by name, the cascade update uses positional matching, not name matching. Verify product assignments at `/discovery` after any segment rename.

### Managing Business Segments

Business Segments are the top-level filter across the platform. Every digital product discovered must be assigned to a segment before agents can scope their analysis correctly.

Best practice for segment setup:

- Define segments before running Discovery. The Discovery agent uses the segment you select in the dropdown at `/discovery` to tag discovered products.
- Keep segment names stable. Renaming after agent runs requires re-verification of product tags.
- Use 2–6 segments. Too many creates navigation friction; too few prevents meaningful segmentation of outputs.

### Inviting Users and Assigning Roles

User invitation is managed through the Organizations page. Under the organization card, locate the "Members" section.

1. Click "Invite User."
2. Enter the user's email address.
3. Select a Role: VIEWER, ANALYST, ADMIN, or SUPER_ADMIN.
4. Click "Send Invitation." The user receives an email with a sign-in link.

To change a user's role: click the role badge next to their name in the Members list and select a new role from the dropdown.

To remove a user: click the trash icon next to their record.

---

## Context Hub — Knowledge Base Management

### Overview and Purpose

The Context Hub at `/context-hub` is the knowledge base that powers all 18 agents. Before you run any agent, you should populate the Context Hub with documents relevant to that agent's scope. Agents use Retrieval-Augmented Generation (RAG) with BM25 reranking: they search the indexed documents for relevant chunks and inject them into the LLM prompt.

The Context Hub has six tabs:

- **Documents** — Upload files or fetch URLs; view indexed documents with chunk counts
- **Applications** — Register application portfolio items (name, tech stack, lifecycle)
- **Competitors** — Structured competitor intelligence cards
- **Tech Trends** — Technology radar built from uploaded trend documents
- **Search** — Full-text and semantic search across all indexed documents
- **Integrations** — Connect Jira, Confluence, Azure DevOps, Notion, ServiceNow

### Document Categories Reference

| Category | What to Upload | Primary Agents That Use It | Priority |
|----------|---------------|---------------------------|---------|
| CURRENT_STATE | Process maps (L0–L3), SOPs, system architecture diagrams, discovery outputs, runbooks, existing capability inventories | Discovery, Lean VSM, Risk & Compliance | High — upload before running Discovery |
| ARCHITECTURE_STANDARDS | Enterprise API gateway standards, cloud pattern libraries, AI/agent design patterns, tech maturity matrices, reference architectures | Architecture, Product Transformation, Security | High — upload before Architecture agent |
| VSM_BENCHMARKS | Industry process time / wait time / flow efficiency benchmarks (Gartner, APQC, McKinsey, SWIFT reports, BPMS studies) | Lean VSM, Future State Vision | Critical for benchmark-grounded projections |
| TRANSFORMATION_CASE_STUDIES | Published transformation case studies with real ROI figures, efficiency gains, and timelines (banking, fintech, telco examples work best) | Future State Vision | Critical for benchmark-grounded badge |
| FUTURE_STATE | Target architecture documents, strategic capability roadmaps, vision papers | Future State Vision, Product Roadmap | Medium |
| TECH_TREND | Gartner Hype Cycle, Forrester Wave reports, AI automation research, RPA market guides, analyst outlooks | Market Intelligence, Architecture | Medium |
| COMPETITOR | Competitor annual reports, capability comparison analyses, public capability maps, market positioning reports | Market Intelligence, Discovery (persona context) | Medium |
| AGENT_OUTPUT | Automatically populated when agents run — do not upload manually | All agents (cross-agent chaining) | System-managed |

📌 The AGENT_OUTPUT category is populated automatically every time an agent completes a run. It enables later agents to use the structured output of earlier agents as context. Do not delete documents in this category unless you want to sever that chaining.

### Uploading Documents

**Accepted formats:** `.pdf`, `.csv`, `.json`, `.txt`, `.md`, `.xlsx`, `.xls`

**Maximum file size:** 20 MB per file

**Step-by-step:**

1. Navigate to `/context-hub` and ensure the "Documents" tab is active.
2. Select the appropriate **Category** from the dropdown. Refer to the category table above. Choosing the wrong category means agents that need the document will either miss it or give it lower priority.
3. (Optional) Enter a **Sub-category** tag for further filtering (e.g., `mortgage-origination` under CURRENT_STATE).
4. Either drag your file onto the drop zone or click "Choose File" to open the file picker.
5. The upload starts immediately. You will see a progress indicator.
6. After upload, the platform automatically chunks and embeds the document into pgvector. This typically takes 5–30 seconds for a PDF under 5 MB.
7. Verify the document appears in the document list below the upload area with a chunk count greater than zero.

⚠️ If the chunk count shows zero after processing, the document may have failed to parse (e.g., a scanned PDF with no text layer, or a corrupted `.xlsx`). Delete and re-upload as a `.txt` or `.md` export of the same content.

⚠️ Do not upload the same document twice. Duplicate chunks reduce retrieval precision by inflating the score of repeated content.

### Fetching URLs

The URL fetch feature allows you to index web pages, GitHub pages, and publicly accessible documents without downloading them.

**Supported inputs:** Any publicly accessible URL that returns HTML or plain text. GitHub repository URLs (README, wiki pages) work well. Private URLs that require authentication will fail silently.

**Step-by-step:**

1. On the Documents tab, click the "URL" toggle next to the upload drop zone (switches the input mode from file to URL).
2. Select the appropriate **Category** from the dropdown.
3. Paste the full URL into the input field (e.g., `https://www.swift.com/standards/iso-20022/what-is-iso-20022`).
4. Click "Fetch & Index."
5. The platform fetches the URL content server-side (via `POST /api/context/fetch-url`), extracts text, chunks it, and embeds it.
6. On success, a confirmation message shows: "Indexed: [URL]." The document appears in the document list.

⚠️ JavaScript-rendered pages (SPAs, dashboards behind login) will return minimal content. For those sources, copy the text content and upload as a `.txt` file instead.

### Viewing and Managing Indexed Documents

The document list below the upload area shows all indexed documents for the current organization, filterable by category. For each document you can see:

- **Name** — the original filename or URL
- **Category** — the assigned document category
- **Chunks** — number of text chunks extracted and indexed in pgvector
- **Uploaded** — timestamp
- **Actions** — reprocess (re-chunk and re-embed) or delete

To filter by category: use the "All Categories" dropdown above the document list to select a specific category.

To delete a document: click the trash icon. This removes all associated chunks from pgvector. Agent runs after deletion will not have access to this content.

To reprocess a document: click the refresh icon. Use this after you update a file — delete the old version, upload the new one. Do not use reprocess to overwrite; it re-runs embedding on the existing stored content, not a new file.

### Checking Chunk Quality (RAG Accuracy Page)

After uploading documents, navigate to `/accuracy` to verify that the RAG pipeline is producing usable chunks.

The RAG Accuracy page shows:

- **Composite Score** — overall accuracy score across all modules (0–100)
- **Per-module breakdown** — Discovery, Lean VSM, Future State, Risk & Compliance, Product Transformation
- **Context document counts** — how many documents are indexed per category
- **Benchmark-grounded runs** — percentage of Future State runs that used uploaded benchmarks

Check that:

- The document count in the relevant category is greater than zero
- The composite score increases after uploading key documents
- Future State shows `hasBenchmarkDocs: true` if you have uploaded VSM_BENCHMARKS

### Best Practices and Anti-Patterns

**Best practices:**

- Upload documents before running agents. Agents perform RAG at the start of each run; documents uploaded after a run require a re-run to take effect.
- Use the correct category. The RAG pipeline allocates a larger chunk budget to categories that match the agent type. A VSM benchmark uploaded under CURRENT_STATE will receive lower priority in the Future State agent.
- Keep documents specific to the organization. Generic textbook content adds noise. Use industry-specific reports and your own internal documents.
- Include quantitative benchmarks. The Future State Vision agent looks specifically for numeric benchmarks (process times, wait times, flow efficiency percentages) in the VSM_BENCHMARKS category to produce the "Benchmark-grounded" projection.
- Chunk size is 2,000 characters with 400-character overlap. Documents with long unbroken paragraphs (e.g., legal text) chunk well. Heavily formatted tables in PDFs may chunk poorly — export as CSV or Markdown tables instead.

**Anti-patterns to avoid:**

- Do not upload PowerPoint decks with mostly images and minimal text. The text extractor will produce near-empty chunks.
- Do not upload duplicate versions of the same document. Each version is indexed separately, inflating retrieval scores for repeated content.
- Do not rely solely on the AGENT_OUTPUT category. It captures prior runs, not external benchmarks. An organization with only AGENT_OUTPUT documents in its knowledge base will produce lower-quality projections than one with uploaded benchmarks.
- Do not delete AGENT_OUTPUT documents mid-workflow. Later agents (e.g., Future State) use Discovery and VSM outputs stored in AGENT_OUTPUT as their primary context source.

---

## Integrations

### Jira Integration

#### Prerequisites

- A Jira Cloud or Jira Data Center instance accessible from the TransformHub server
- A Jira API token (generate at `https://id.atlassian.com/manage-profile/security/api-tokens`)
- Your Jira account email address
- At least one project key whose issues contain cycle time data (issue status transition history)
- ANALYST or ADMIN role in TransformHub

#### Step-by-Step Connection

1. Navigate to `/context-hub` and click the "Integrations" tab.
2. Click "Add Integration."
3. Select **Jira** from the Type dropdown.
4. Enter the **Base URL** — the root URL of your Jira instance (e.g., `https://yourcompany.atlassian.net`).
5. Enter the **Username / Email** — the email address associated with your API token.
6. Enter the **API Token** — paste the token generated from your Atlassian account settings.
7. Click "Save Integration." The status changes to "idle."

#### Configuring Project Keys

After saving the integration:

1. Click the integration record to expand its settings.
2. In the **Project Key** field, enter one or more Jira project keys separated by commas (e.g., `CONDIG, SMELEND`). Project keys are the uppercase prefix that appears on all issue IDs in that project (e.g., `CONDIG-1234`).
3. Click "Update."

📌 Use project keys that correspond to the digital products you have discovered. For example, if your Discovery run identified "Digital Lending" as a product, point Jira at the project that tracks lending platform work.

#### Running Cycle Time Extraction

1. With the integration configured and project keys set, click "Sync Now" on the integration record.
2. The status changes to "syncing." The platform fetches the changelog for all issues in the configured projects and computes dwell times (time an issue spent in each status category).
3. When sync completes, the status shows "synced" with a count of synced items and a "last synced" timestamp.
4. The extracted cycle times are stored and become available to the Lean VSM agent as `jira_measured` provenance data.

⚠️ Jira cycle time extraction uses the issue changelog (status transition history). Projects that do not use board statuses (e.g., projects where all work stays in "To Do" or "In Progress" permanently) will produce meaningless cycle times.

#### Understanding Extraction Results

After sync, the Lean VSM agent maps Jira status categories to VSM process time and wait time:

- Issues in "In Progress" or equivalent active statuses contribute to **process time**
- Issues in "In Review," "Blocked," or queue statuses contribute to **wait time**
- Total dwell across all issues for a status category, divided by issue count, produces the per-step average

The resulting times appear in VSM with the `jira_measured` provenance badge (confidence range 0.70–0.95).

#### Status Name Mapping

Jira status names vary by team. The agent maps status names to process/wait using keyword matching:

| Jira Status Keyword | Maps To |
|--------------------|---------|
| "in progress", "in development", "dev" | process_time |
| "in review", "code review", "review" | wait_time |
| "blocked", "on hold", "waiting" | wait_time |
| "to do", "backlog", "open" | excluded (pre-process) |
| "done", "closed", "resolved" | excluded (post-process) |

If your Jira uses non-standard status names, the mapping may misclassify statuses. Correct this by applying manual overrides on the VSM page after the agent runs.

---

### Git Integration (GitHub / GitLab)

#### Prerequisites

- A GitHub Personal Access Token (PAT) with `repo` scope for private repositories, or no token for public repositories
- Repository URLs for the systems you want to analyze
- ANALYST role or above

#### Step-by-Step Connection

Git integration is configured directly on the Discovery page, not through the Integrations tab.

1. Navigate to `/discovery`.
2. In the "Analyze Repositories" panel, click "Add Repository."
3. Enter the **Repository Name** (a label you choose, e.g., "Lending Platform API").
4. Enter the **Repository URL** (e.g., `https://github.com/yourorg/lending-platform`).
5. (Optional) Enter the **OpenAPI URL** if the repo exposes a Swagger/OpenAPI spec (e.g., `https://api.yourcompany.com/openapi.json`). Providing this significantly improves Discovery confidence.
6. (Optional) Enter a **GitHub Token** in the token field below the repo list. This is required for private repositories.
7. Add additional repositories by clicking "Add Repository" again.

#### What the Agent Extracts

The Discovery agent uses the repository URL to extract:

- **GitHub structure** (+0.15 confidence) — folder and module names that suggest product/capability names
- **GitHub tests** (+0.15 confidence) — test file names and test descriptions that reveal expected behaviors
- **OpenAPI spec** (+0.20 confidence) — endpoint names, tags, and operation summaries that directly map to capabilities and functionalities
- **Code signals** (+0.0 to +0.15 confidence via separate extraction) — timeouts, SLAs, cron expressions, and retry intervals embedded in code that inform VSM process time estimates

The Git Integration agent (`git_integration`) provides a deeper analysis: dependency graphs, tech stack identification, and code pattern analysis for architecture insights.

---

### Process Mining (Event Log Upload)

Process mining allows you to upload an event log CSV from your BPM system, ITSM tool, or middleware and derive actual process and wait times for VSM steps.

#### CSV Format Requirements

Your CSV must contain these columns (exact names, case-insensitive):

| Column | Description | Example Value |
|--------|-------------|---------------|
| `case_id` | Unique identifier for each process instance | `CASE-001`, `TXN-20240315-001` |
| `activity` | Name of the process step | `Loan Application Received`, `Credit Check` |
| `timestamp` | When the event occurred | `2024-03-15T09:23:41Z` (ISO 8601 preferred) |

Supported timestamp formats include ISO 8601 (`2024-03-15T09:23:41Z`), common date-time strings (`2024-03-15 09:23:41`), and US date format (`03/15/2024 09:23:41`).

Additional optional columns (ignored if present but do not cause errors): `resource`, `cost`, `lifecycle`.

⚠️ Each unique value in the `activity` column becomes a VSM step. If your activity names are not standardised (e.g., typos, multiple names for the same step), the resulting VSM will be fragmented. Clean activity names before uploading.

#### Upload Procedure

1. Navigate to `/vsm`.
2. In the left sidebar, locate "Update VSM Metrics" below the product selector.
3. Click "Import VSM Metrics (CSV/XLSX)."
4. Select your event log file.
5. The platform processes the event log: it groups events by `case_id`, sorts by `timestamp`, and computes the dwell time for each activity across all cases.
6. The resulting process times and wait times are written to the selected product's capability metrics.

#### Interpreting Bottleneck Results

After import, return to the VSM view. Steps that previously showed no data will now display process time and wait time derived from the event log. The flow efficiency color coding applies immediately:

- Green (FE ≥ 40%) — value-adding steps
- Amber (FE 20–40%) — bottleneck steps requiring attention
- Red (FE < 20%) — waste steps that are candidates for elimination or automation

Steps with very high wait times relative to process time indicate handoff delays, approval queues, or batch processing boundaries. These are typically your highest-value automation targets.

#### Mapping to VSM Steps

After event log import, the platform attempts to match activity names from the CSV to capability names in the Discovery hierarchy. If names do not match, the metrics are stored at the product level and will not automatically associate with specific capabilities. To manually associate:

1. On the VSM page at L2 view, click the capability you want to map.
2. Use the inline timing override fields to enter the process time and wait time from the event log manually.
3. Set provenance to `manual_override`.

---

## Core Workflow: Step-by-Step

The recommended sequence for a full transformation analysis is:

Discovery → Lean VSM → Future State → Risk & Compliance → Architecture → Product Transformation → Backlog & OKR → Additional Agents

Each step builds on the results of the previous one. You can run agents out of sequence using the Product Workbench, but output quality degrades without the foundation layers.

---

### Step 1 — Discovery Agent

#### When to Run

Run Discovery at the start of every new analysis engagement, or when significant new repositories or products need to be added to the capability map. Discovery is also the first step for any new organization.

#### Pre-conditions (What Must Be in Context Hub First)

| Document Type | Category | Why Needed |
|--------------|----------|-----------|
| Architecture diagrams, SOPs, existing process maps | CURRENT_STATE | Gives agent domain context; raises confidence from 0.35 base to 0.50+ |
| OpenAPI specs (if not provided via URL) | CURRENT_STATE | Provides direct capability-to-endpoint mapping |
| Database schema (if applicable) | CURRENT_STATE | Adds +0.20 confidence; reveals entity structure |
| Existing BRD or requirements documents | CURRENT_STATE | Provides known product/capability names |

You can run Discovery without any Context Hub documents, but confidence scores will be low (0.35–0.50). Agents downstream will produce lower-quality outputs.

#### How to Run

1. Navigate to `/discovery`.
2. In the **Business Segment Selector** (top-left dropdown), select the segment you are analyzing (e.g., "Retail Banking"). This determines which segment tag is applied to discovered products. If left blank, the agent defaults to the organization's first segment.

📌 Always select a Business Segment before running Discovery. Products tagged to the wrong segment will not appear in the correct filtered views across other pages.

3. In the "Analyze Repositories" panel, add one or more repositories:
   - Click "Add Repository" and enter the name and URL.
   - Optionally add an OpenAPI URL and GitHub token.
4. Fill in the optional context fields:
   - **Domain Context** — free-text description of the domain (e.g., "Retail banking digital platform serving 2M customers, including mobile banking, internet banking, and card management").
   - **DB Schema Text** — paste your SQL schema or JSON schema directly.
   - **Known Products** — comma-separated list of product names you already know (e.g., "Mobile Banking App, Internet Banking Portal, Cards Management").
   - **Known Capabilities** — comma-separated capability names (e.g., "Account Opening, Loan Origination, Transaction Processing").
5. Select the **Analysis Mode**:
   - **Single Pass (default)** — runs all three hierarchy levels (products, capabilities, functionalities) in one execution. Suitable for initial discovery.
   - **Multi-Pass** — runs three sequential passes with human review gates between each. Use this for large or complex portfolios where you want to validate the product list before capabilities are generated.
6. Click "Analyze Repositories."

#### What the Agent Does

The Discovery agent runs 6–7 LangGraph nodes:

1. **fetch_enrichment** — fetches repository structure, OpenAPI specs, and code signals
2. **parse_codebase** — parses folder structure, test names, and module names
3. **extract_functionalities** — uses LLM to extract L3 functionalities from code and context
4. **generate_brd** — synthesises a Business Requirements Document from all signals
5. **cluster_bmad** — groups functionalities into L2 capabilities and L1 products using the BMAD hierarchy framework
6. **map_personas** — assigns FRONT_OFFICE / MIDDLE_OFFICE / BACK_OFFICE persona mappings to functionalities
7. **persist_results** — writes products, capabilities, and functionalities to the database

#### Input Fields Explained

| Field | What It Does | Source of Input | Confidence Impact |
|-------|-------------|----------------|-------------------|
| Repository URL | Provides GitHub structure and test names for analysis | Your repository hosting system | +0.15 (structure) +0.15 (tests) |
| OpenAPI URL | Provides endpoint-to-capability mapping | Your API gateway or Swagger UI | +0.20 |
| GitHub Token | Enables access to private repo content | GitHub PAT settings | Required for private repos |
| DB Schema Text | Provides entity-level evidence for capabilities | Your database DDL | +0.20 |
| Domain Context | Guides the LLM's interpretation of the codebase | Analyst knowledge | +0.10 |
| Known Products | Hard constraints for clustering — agent preserves these product names | Prior analysis or documentation | +0.10 |
| Known Capabilities | Hints for capability naming and grouping | Prior analysis | +0.10 |
| Business Segment | Tags all discovered products to this segment | Business Segment selector | Required for correct filtering |

#### Output: Capabilities Table (L1/L2/L3)

After the agent completes, the output appears in the Discovery Pipeline panel:

- **Products** — count of L1 digital products created
- **Capabilities** — count of L2 digital capabilities created
- **Functionalities** — count of L3 functionalities created
- **Persona Mappings** — count of functionality-to-persona associations
- **Active Sources** — list of evidence sources used (url_analysis, openapi_spec, github_structure, etc.)

The HITL (Human-in-the-Loop) review panel appears below the pipeline stats. You must click "Approve" or "Reject" before results become permanent.

#### Reviewing and Correcting Results

After clicking "Approve," results become visible in the hierarchy views. Four view modes are available:

- **Products View** — card grid of all digital products with capability count, functionality count, and flow efficiency (if VSM has been run)
- **Drill-Down View** — select a product to explore its capabilities and functionalities in a hierarchical explorer; click a capability to see its functionalities and VSM metrics
- **Tree View** — collapsible tree showing the full hierarchy: Repository → Product → Capability → Functionality, with confidence badges and inline editing
- **Product Catalog** — enriched product cards with business segment filtering and metadata

To edit a product, capability, or functionality name: in Tree View, click the edit icon next to any item. Enter the new name and press Enter. Changes are saved immediately.

To delete an item: click the trash icon. Deletion cascades — deleting a product removes all its capabilities and functionalities.

To add a new capability or functionality: use the "Add New Item" panel at the bottom of the page. Select the item type (capability or functionality), choose the parent, enter a name and description, and click "Add."

#### Accepting vs Overriding Suggestions

The agent's suggestions have confidence scores displayed as badges. Confidence scoring is cumulative:

| Base | 0.35 |
|------|------|
| + openapi_spec | +0.20 |
| + github_structure | +0.15 |
| + github_tests | +0.15 |
| + db_schema | +0.20 |
| + context_document | +0.15 |
| + integration_data | +0.15 |
| + questionnaire | +0.10 |
| + triangulation bonus (≥3 sources agree) | +0.10 |
| Maximum | 1.00 |

Items with confidence below 0.50 should be reviewed carefully. Items above 0.75 can generally be accepted without deep review. Items with multiple sources listed (visible by hovering the confidence badge) have been corroborated across evidence types and are the most reliable.

#### Re-running After Corrections

If you correct the hierarchy (rename, delete, add items) and want the agent to incorporate your changes as constraints:

1. Add the corrected product and capability names to the **Known Products** and **Known Capabilities** fields.
2. Re-run the agent. With these fields populated, the agent preserves your named items and clusters new findings around them.

In Multi-Pass mode, approving Pass 1 (products) before Pass 2 runs means Pass 2 uses your confirmed product list as hard constraints for capability generation.

---

### Step 2 — Lean VSM Agent

#### When to Run

Run Lean VSM after Discovery has produced a capability hierarchy and you have at least one of: Jira cycle time data synced, an event log CSV uploaded, or VSM_BENCHMARKS documents in the Context Hub. The agent can run without any of these (it falls back to LLM estimation), but the result quality is lower.

#### Pre-conditions

| Prerequisite | Where to Configure | Why It Matters |
|-------------|-------------------|----------------|
| Discovery run and approved | `/discovery` | Agent loads capabilities from the database |
| Jira integration synced | `/context-hub` → Integrations | Provides `jira_measured` timing data |
| VSM_BENCHMARKS uploaded | `/context-hub` → Documents | Provides benchmark comparison context |
| Event log CSV imported | `/vsm` → Update VSM Metrics | Provides `jira_measured`-equivalent timing from process mining |

#### How to Run

1. Navigate to `/vsm`.
2. In the left sidebar, select the **Business Segment** to filter products.
3. Select a **Digital Product** from the sidebar list. The view advances to L2 (capability view).
4. (Optional) In the "Existing VSM Documents" panel, enter a URL to a process document or VSM file you want the agent to reference.
5. (Optional) In the "Competitor Value Streams" panel, enter competitor names and descriptions. The agent uses these to contextualise its benchmark comparisons.
6. Click "Run VSM Agent."

The agent runs against all capabilities in the selected organization (or repository, if a repository ID is in scope). It does not require you to have selected a product first — product selection in the UI is for viewing, not for scoping the agent run.

#### What the Agent Does (Evidence Sources)

The Lean VSM agent synthesises timing data from four sources in priority order:

1. **Jira changelog** (`jira_measured`, confidence 0.70–0.95) — dwell times computed from issue status transition histories
2. **Code signals** (`code_signals`, confidence 0.60–0.80) — timeout values, SLA annotations, retry intervals, and cron expressions extracted from the codebase
3. **Manual overrides** (`manual_override`, confidence 1.00) — analyst-entered times that override all other sources
4. **LLM estimation** (`llm_estimated`, confidence 0.50–0.65) — the agent estimates timing from domain context and uploaded benchmarks when no measured data is available

The agent uses BM25 reranking over the RAG-injected chunks, prioritising VSM_BENCHMARKS and TRANSFORMATION_CASE_STUDIES categories.

#### Output: VSM Table with Step-by-Step Timings

After approving the agent output, the VSM page shows:

- **Process Time (PT)** — time actively working on the step
- **Lead Time (LT)** — total elapsed time including wait (PT + WT)
- **Wait Time (WT)** — time the work item is idle, queued, or blocked
- **Flow Efficiency (FE)** — PT / LT × 100%

These are shown at three levels: L1 (segment total), L2 (product capability breakdown), L3 (individual functionality steps).

#### Reading Flow Efficiency %

The Flow Efficiency gauge in the top-right of the VSM page shows the overall PT/LT ratio for the selected scope:

| Flow Efficiency | Interpretation | Typical Industry Range |
|----------------|---------------|----------------------|
| ≥ 40% | Good — efficient value delivery | High-performing lean operations |
| 20–40% | Fair — moderate waste; bottlenecks present | Typical for most digital organizations |
| 10–20% | Poor — significant waste | Legacy-heavy processes |
| < 10% | Critical — requires urgent transformation | Paper-based or highly manual processes |

📌 World-class lean manufacturing achieves 85%+ flow efficiency. For digital product processes, 40–60% is considered good. Most enterprises see 5–25% before transformation.

#### Understanding the Mermaid Diagram

The Mermaid flow diagram renders a left-to-right process flow with nodes colour-coded by flow efficiency:

- Green nodes — FE ≥ 40% (value-adding)
- Amber nodes — FE 20–40% (bottleneck)
- Red nodes — FE < 20% (waste)
- Grey nodes — no data available

At L1, nodes represent digital products. At L2, nodes represent capabilities within the selected product. At L3, nodes represent individual functionalities within the selected capability.

Click the L1/L2/L3 tabs to switch levels. Select a product in the sidebar to enable L2. Select a capability card at L2 to enable L3.

#### Timing Provenance Badges

Each capability and functionality in the VSM output carries a provenance badge indicating the source of its timing data:

| Badge / Colour | Provenance | Confidence Range | What It Means |
|----------------|-----------|-----------------|--------------|
| Blue — "Jira" | `jira_measured` | 0.70–0.95 | Derived from actual Jira issue changelog dwell times |
| Cyan — "Code" | `code_signals` | 0.60–0.80 | Derived from timeout, SLA, or cron values in source code |
| Green — "Manual" | `manual_override` | 1.00 | Analyst-entered value; highest trust |
| Amber — "AI Est." | `llm_estimated` | 0.50–0.65 | LLM estimate based on domain context and benchmarks |

#### Identifying Bottlenecks

Bottlenecks are steps with FE < 20% or steps that contribute a disproportionately large percentage of total lead time. The Step Classification Panel (visible at L1 and L3) ranks all steps by their percentage of total lead time. Steps in red are the highest-priority transformation targets.

To identify bottlenecks systematically:

1. Go to L1 view. The product cards show each product's FE and its percentage of total segment lead time.
2. Click into the product with the worst FE to go to L2.
3. At L2, the capability cards show each capability's FE and its percentage of product lead time. The Capability Comparison Chart (shown when 2+ capabilities have metrics) visually compares all capabilities.
4. Click the worst capability to go to L3. Individual functionality steps are listed with PT, WT, and classification.

#### Applying Manual Timing Overrides

If you have access to more accurate timing data than what the agent estimated, you can override any step's timing directly:

1. On the VSM page at L3 view, locate the functionality step you want to correct.
2. Click the inline edit control (pencil icon or click the time value directly).
3. Enter the corrected process time and wait time in hours.
4. The provenance for this step changes to `manual_override` (confidence 1.00).
5. The parent capability's flow efficiency recalculates immediately based on the updated step timings.

#### Hallucination Flags: Critical vs Warning vs Info

The agent output review panel flags items that may be hallucinated or inaccurate:

| Flag Level | What It Means | What to Do |
|-----------|--------------|-----------|
| Critical | Timing values are implausible (e.g., 0.0h process time, or 1000+ hour wait times); no evidence sources found | Reject this output; add more Context Hub documents and re-run |
| Warning | Timing derived from LLM estimation only (no measured sources); confidence below 0.55 | Review carefully; apply manual overrides for critical steps |
| Info | Timing derived from code signals only (no Jira data); confidence 0.60–0.80 | Acceptable for initial analysis; sync Jira for higher precision |

---

### Step 3 — Future State Vision Agent

#### When to Run

Run Future State Vision after the Lean VSM agent has produced flow efficiency data for your target products. The agent requires current-state VSM data to compute improvement projections. For benchmark-grounded projections, you also need VSM_BENCHMARKS and TRANSFORMATION_CASE_STUDIES uploaded to the Context Hub.

#### Pre-conditions

| Prerequisite | Where to Configure | Why It Matters |
|-------------|-------------------|----------------|
| Lean VSM completed and approved | `/vsm` | Agent reads current-state PT/WT/FE from database |
| VSM_BENCHMARKS documents indexed | `/context-hub` | Required for "Benchmark-grounded" badge and realistic projection bands |
| TRANSFORMATION_CASE_STUDIES indexed | `/context-hub` | Provides real-world precedent for projection scenarios |

#### How to Run

1. Navigate to `/future-state`.
2. Select the **Business Segment** and **Digital Product** you want to project.
3. Choose a **Strategy**:
   - **Automation** — projects improvements from RPA, workflow automation, and AI/ML integration
   - **Agentification** — projects improvements from autonomous agent-based capabilities and conversational AI
4. Click "Run Future State Agent."

#### Output: Three-Scenario Projections Table

The agent returns three projection scenarios for each capability:

| Scenario | Description | How to Interpret |
|----------|-------------|-----------------|
| Conservative | Achievable with low-disruption automation (RPA, rule-based bots) | Safe lower bound for business case; assume 6–12 month implementation |
| Expected | Balanced transformation using proven AI/ML patterns from case studies | Primary scenario for roadmap planning and ROI calculations |
| Optimistic | Full agentification or best-in-class benchmark performance | Upper bound; achievable with high investment and multi-year commitment |

Each scenario provides projected process time, wait time, and flow efficiency as a numeric range (e.g., PT: 2.1–2.4h, FE: 52–58%).

Additionally, the agent returns an **automation coverage percentage** for each capability, indicating what fraction of the steps can be automated under each scenario.

#### Benchmark-Grounded Badge

When the agent's projection is grounded in uploaded VSM_BENCHMARKS or TRANSFORMATION_CASE_STUDIES documents (rather than pure LLM estimation), the output shows a "Benchmark-grounded" badge.

This badge means:

- The agent found specific numeric benchmarks in your uploaded documents that are relevant to this capability type
- The projection bands reflect actual industry data (e.g., SWIFT payment processing benchmarks, Gartner digital banking benchmarks) rather than generic LLM guesses
- The confidence of the projection is higher; it can be used in investment cases with appropriate citation

📌 To consistently achieve the Benchmark-grounded badge, upload at least 2–3 industry benchmark reports under VSM_BENCHMARKS before running the Future State agent. Reports from Gartner, APQC, McKinsey, Celent, and SWIFT all work well.

⚠️ If no benchmark documents are present, the agent still runs but produces `llm_estimated` projections. These are reasonable starting points but should not be cited in board-level investment cases without corroborating evidence.

#### Using the Output for Investment Prioritisation

The Future State output displays a current vs projected comparison panel with:

- PT saving in hours (absolute)
- WT saving in hours (absolute)
- LT saving percentage
- FE gain percentage points

Use these to prioritise:

1. Capabilities with the largest absolute WT saving are typically the fastest ROI (wait time reduction has immediate throughput impact without requiring new value-adding work).
2. Capabilities with the largest FE gain are the highest-leverage transformation candidates.
3. Capabilities where conservative and optimistic scenarios are close together (narrow band) have well-established automation patterns — lower execution risk.
4. Capabilities where the band is very wide are high-uncertainty targets — invest in further discovery (process mining, Jira analysis) before committing.

---

### Step 4 — Risk & Compliance Agent

#### When to Run

Run Risk & Compliance after Discovery has built the capability hierarchy. The agent does not require VSM data but produces richer risk assessments when capabilities have detailed functionality descriptions.

#### Pre-conditions

| Prerequisite | Where to Configure | Why It Matters |
|-------------|-------------------|----------------|
| Discovery completed | `/discovery` | Agent analyses each capability for risk exposure |
| Regulatory frameworks configured in org | `/organizations` | Agent generates compliance mappings specific to your frameworks |
| Compliance framework documents | `/context-hub` (CURRENT_STATE) | Improves specificity of compliance gap analysis |

#### How to Run

1. Navigate to `/risk-compliance`.
2. Click "Run Risk & Compliance Agent."
3. Wait for the agent to complete (typically 30–90 seconds).
4. Review the output in the review panel and click "Approve."

#### Output: Risk Register

The risk register shows:

- **Risk ID** — unique identifier
- **Capability / Product** — the entity at risk
- **Risk Category** — OPERATIONAL, COMPLIANCE, SECURITY, DATA, INTEGRATION, or STRATEGIC
- **Description** — natural language risk description
- **Severity** — CRITICAL / HIGH / MEDIUM / LOW
- **Mitigation** — recommended actions

#### Severity Ratings Interpretation

| Severity | Meaning | Action Required |
|----------|---------|----------------|
| CRITICAL | Regulatory breach risk or immediate operational exposure; potential licence impact | Escalate immediately; block deployment until resolved |
| HIGH | Significant compliance gap or operational risk; likely audit finding | Address within current quarter |
| MEDIUM | Moderate risk; may be accepted with compensating controls | Include in risk treatment plan |
| LOW | Minor risk; manageable with existing controls | Log and monitor; address when convenient |

The **Risk Category Breakdown** chart on the page shows the distribution of risks by category. A high proportion of COMPLIANCE risks suggests the regulatory framework analysis found gaps. A high proportion of SECURITY risks suggests architecture vulnerabilities.

#### Linking Risks to Mitigation Actions

The Compliance Framework Tabs section maps each identified risk to the relevant regulatory framework clauses. For each framework configured in your organization (e.g., APRA CPS 234, PCI-DSS, GDPR):

- Green items — capability is compliant
- Amber items — partial compliance or compensating controls in place
- Red items — non-compliant; requires remediation

To link a risk to a roadmap action: navigate to `/admin/backlog-okr` after running the Backlog & OKR agent. Risk items are automatically included as backlog entries with "RISK_MITIGATION" tags.

---

### Step 5 — Architecture Agent

The Architecture agent analyses your repositories and produces a current-state architecture assessment and modernisation pathways.

**Output: Current-State Patterns**
The agent identifies architectural patterns currently in use: monolithic, microservices, event-driven, API gateway, data lake, etc. Each pattern is described with the capabilities it serves and an assessment of technical debt.

**Output: Modernisation Pathways**
For each identified pattern, the agent recommends a modernisation pathway: Strangler Fig, Big Bang, Sidecar, or Event Sourcing migration. Prerequisites and dependencies between pathways are listed.

**Output: Tech Debt Map**
A categorised list of technical debt items: outdated dependencies, anti-patterns, missing test coverage, undocumented APIs.

To maximise output quality: upload ARCHITECTURE_STANDARDS documents (cloud patterns, enterprise integration patterns) to the Context Hub before running. The agent uses these to score your current state against standards.

---

### Step 6 — Product Transformation Agent

The Product Transformation agent produces a migration plan for transforming the selected digital product from its current to future state.

**Output: Migration Plan**
A phased migration plan with activities, durations, and dependencies. Each phase has acceptance criteria.

**Output: Prerequisites**
Ordered list of conditions that must be met before the migration can start (e.g., "API gateway must be deployed before service decomposition").

**Output: Dependency Graph**
A visual representation of the order in which capabilities must be transformed, based on inter-service dependencies extracted from the codebase.

**Output: Readiness Score**
A 0–10 score computed from four factors:

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| VSM Coverage | 35% | Fraction of capabilities with VSM metrics |
| Flow Efficiency | 25% | Average FE across capabilities with VSM data |
| Documentation | 25% | Presence of process maps and functionality descriptions |
| Functionality Depth | 15% | Average functionalities per capability |

A readiness score above 7.0 indicates the product is well-understood and ready for transformation planning. Below 4.0 indicates insufficient discovery data — return to Discovery and VSM before proceeding.

---

### Step 7 — Backlog & OKR Agent

The Backlog & OKR agent translates the transformation plan and risk register into a prioritised delivery backlog and OKR framework.

**Output: Prioritised Backlog**
AI-prioritised backlog items with RICE scores (Reach, Impact, Confidence, Effort). Items are categorised as: CAPABILITY_BUILD, RISK_MITIGATION, TECH_DEBT, PROCESS_AUTOMATION.

**Output: OKR Framework**
Objectives and Key Results structured around the transformation outcomes. Typically 3–5 objectives with 3 measurable key results each.

**Output: Sprint Suggestions**
Suggested sprint groupings of backlog items based on dependencies and effort estimates.

📌 The Backlog & OKR agent produces its best output when the Future State Vision and Risk & Compliance agents have been run first. It uses the Future State projected metrics as the basis for OKR targets and the Risk Register as input for mitigation backlog items.

---

### Step 8 — Additional Agents

#### Cost Estimation Agent

**When to run:** After Product Transformation and Backlog & OKR agents have produced a migration plan and backlog.

**What you get:**
- Investment model with one-time and ongoing cost estimates per transformation phase
- ROI calculations based on Future State projected time savings converted to FTE equivalents
- Payback period (months to break even)
- Three investment scenarios: minimal, recommended, and accelerated

**Key input to provide:** Upload industry cost benchmarks (consulting day rates, licence costs) under VSM_BENCHMARKS if available.

---

#### Change Impact Agent

**When to run:** After Architecture and Product Transformation agents have identified which capabilities and teams are affected.

**What you get:**
- Change cascade map showing how transformation of one capability ripples to dependent capabilities and teams
- Impacted teams list with severity of impact (Low / Medium / High)
- Communication plan template with key messages for each stakeholder group

---

#### Skill Gap Agent

**When to run:** After the Future State Vision and Product Transformation agents have identified required future capabilities.

**What you get:**
- Gap matrix: current team skills vs required future skills for each transformation workstream
- Training recommendations per role
- Hiring needs (skills not covered by upskilling alone)

---

#### Security Agent

**When to run:** After the Architecture agent has identified patterns and the Risk & Compliance agent has produced the risk register.

**What you get:**
- Security posture assessment across OWASP Top 10 and NIST CSF categories
- Vulnerability map tied to specific capabilities and repositories
- Remediation priority list (Critical / High / Medium / Low) with estimated effort

---

#### Fiduciary Agent

**When to run:** For financial services organizations after Risk & Compliance; for other industries when investment governance documentation is required.

**What you get:**
- Fiduciary risk assessment against applicable investment governance obligations
- Governance obligations checklist mapped to transformation activities
- Compliance checklist for investment committee presentation

---

#### Testing & Validation Agent

**When to run:** After the Product Transformation agent has produced the migration plan.

**What you get:**
- Quality gates for each migration phase (pass/fail criteria)
- Test strategy covering unit, integration, regression, performance, and UAT
- Validation checkpoints with sign-off owners per phase

---

#### Monitoring Agent

**When to run:** After Future State Vision has projected target metrics; these become the KPI baseline.

**What you get:**
- KPI framework with leading and lagging indicators per capability
- Observability requirements (logging, tracing, alerting specifications)
- Alerting thresholds based on current-state baselines and projected targets

---

#### Data Governance Agent

**When to run:** After Architecture analysis has identified data flows. Upload data flow diagrams under CURRENT_STATE before running.

**What you get:**
- Data quality assessment per data domain
- Data lineage map from source systems through capabilities to consumers
- Governance maturity rating (1–5) with specific recommendations to advance

---

#### Market Intelligence Agent

**When to run:** At any point; does not depend on Discovery. Best used early to contextualize capability gaps relative to competitors.

**What you get:**
- Competitive landscape analysis comparing your capability map to competitors
- Capability gaps: areas where competitors have capabilities you lack
- Market positioning summary

**What to upload first:** COMPETITOR documents (competitor annual reports, capability analyses) and TECH_TREND documents.

---

#### Documentation Agent

**When to run:** After key agents have produced outputs that need to be documented for delivery teams.

**What you get:**
- Auto-generated technical documentation for each capability (API references, data dictionaries)
- Process documentation (runbooks, SOPs) based on discovered functionalities
- Architecture Decision Records (ADRs) based on architecture analysis outputs
- Onboarding guides for new team members joining the transformation

---

## Product Workbench

### Running Any Agent on Demand

The Product Workbench at `/product-workbench` allows you to run any agent against any product without following the main workflow sequence. It is the primary page for Architecture and Product Transformation analysis.

1. Navigate to `/product-workbench`.
2. Select a **Business Segment** from the filter.
3. Select a **Digital Product** from the sidebar.
4. The workbench shows:
   - Readiness Score for the selected product (L1 view)
   - Capability cards with metrics (L2 view — click a product to expand)
   - Functionality cards (L3 view — click a capability to expand)
5. Use the agent buttons in the top-right area to run Architecture or Product Transformation agents directly.

The workbench shows the **Architecture Diagram Panel** when the Architecture agent has been run for the selected product. This renders the current-state architecture as a visual diagram using Mermaid.

The **Readiness Score Panel** shows the 0–10 composite readiness score with its four sub-factor breakdown bars.

### Monitoring Execution Status

All agent executions show real-time status in the execution panel:

- **RUNNING** — agent is actively processing (blue spinner)
- **COMPLETED** — agent finished successfully; review panel appears
- **FAILED** — agent encountered an error; error message shown

For executions that take longer than expected (over 2 minutes), check `/admin/agent-monitor` for detailed node-level status.

### Viewing and Downloading Results

After approving an agent output, results are persisted to the database and visible in the relevant page's views. To export:

- Use the **Export** dropdown in the page header (available on Discovery, Future State, and Product Roadmap pages)
- Export formats: JSON (structured data), CSV (tabular metrics), PDF (formatted report)
- Exports are scoped to the current organization and selected segment/product

---

## Product Roadmap Page

### Reading the Roadmap View

Navigate to `/product-roadmap`. The roadmap shows a timeline of transformation capabilities organised into delivery phases.

The page has two strategy tabs:

- **Modernization** — capabilities tagged RPA_AUTOMATION, AI_ML_INTEGRATION, ADVANCED_ANALYTICS
- **Agentification** — capabilities tagged AGENT_BASED, CONVERSATIONAL_AI

Within each strategy, capabilities are displayed on a timeline with:

- Quarter/phase labels across the top
- Capability bars with start date and duration
- Colour coding by category
- RICE score displayed on each bar (generated by the Backlog & OKR agent)

The **Roadmap Summary Panel** below the timeline shows total capabilities, estimated effort, and projected FE improvement across the roadmap.

Switch between **Capabilities** and **Functionalities** tabs to see the roadmap at different levels of granularity.

### Filtering by Segment / Product

1. Use the **Business Segment** dropdown to filter the roadmap to a single segment.
2. Use the **Digital Product** sidebar to select a specific product — the roadmap filters to show only capabilities belonging to that product.
3. Use the **Strategy Tab** (Modernization / Agentification) to filter by transformation approach.

To add a capability to the roadmap manually:

1. Click "Add Capability."
2. Fill in the capability name, category, phase, estimated effort, and RICE score.
3. Click "Add." The new item appears on the timeline.

---

## Admin Reference

### Agent Monitor — Tracking Executions

Navigate to `/admin/agent-monitor`. This page shows all 18 agent types with their current status, last run time, and recent execution history.

For each agent you can see:

- **Status** — COMPLETED, RUNNING, IDLE, FAILED
- **Last run** — timestamp of most recent execution
- **Execution history** — list of past runs with status, start/end times, and error messages for failed runs

To re-run a failed agent: click "Re-run" on the agent card. The agent starts immediately with the same input as the failed run.

📌 The Agent Monitor is read-only for ANALYST and ADMIN roles. Only SUPER_ADMIN can trigger re-runs from this page.

### Audit Log — Traceability and Compliance

Navigate to `/admin/audit-log`. The audit log is an immutable, append-only record of all data changes in the system.

Each entry shows:

- **Action** — the operation performed (CREATE, UPDATE, DELETE, AGENT_RUN, APPROVAL)
- **Entity Type** — the data type affected (digital_product, capability, vsm_metrics, etc.)
- **Entity ID** — the specific record modified
- **Actor** — the user or system that performed the action
- **Payload Hash** — SHA-256 hash of the change payload
- **Previous Hash** — hash of the preceding entry (chain integrity)
- **Timestamp** — when the action occurred

The hash chaining allows you to verify that the audit log has not been tampered with. For compliance exports, use the download button to export the full log as CSV.

### Pipeline — Agent Execution Queue

Navigate to `/admin/pipeline`. The pipeline view shows the agent execution queue: jobs that are pending, running, or recently completed.

Use the pipeline to:

- Monitor queue depth (number of pending jobs)
- Identify jobs that are stuck (running for longer than expected)
- Cancel jobs that are no longer needed

⚠️ Cancelling a running job mid-execution may leave partial data in the database. After cancellation, check the relevant page (Discovery, VSM, etc.) and delete any incomplete records before re-running.

### Dead Letter Queue — Handling Failed Executions

Navigate to `/admin/dead-letter`. The Dead Letter Queue (DLQ) holds agent executions that failed after all retry attempts.

For each failed execution, you can:

- View the error message and stack trace
- Re-enqueue the job (retries once more with the original input)
- Delete the job (removes it from the DLQ without re-running)

Common DLQ causes: database connection timeout during persist step, LLM API rate limit exceeded, malformed input data.

After resolving the root cause (e.g., waiting for rate limits to clear, correcting input data), re-enqueue the job.

### Budget Management — Setting Spend Caps

Navigate to `/admin` and locate the Budget section. For each organization, you can set:

- **Monthly token budget** — maximum tokens (input + output) per calendar month
- **Per-run token limit** — maximum tokens for a single agent execution
- **Alert threshold** — percentage of monthly budget at which to send a notification

When the monthly budget is exhausted, new agent executions return an error until the next calendar month or until the budget is increased.

### Per-Org Anthropic API Key

By default, all organizations share the platform's Anthropic API key. For enterprise deployments, you can configure a per-organization key:

1. Navigate to `/organizations` and click the settings icon on the organization card.
2. Locate the "Anthropic API Key" field.
3. Enter the organization's API key (starts with `sk-ant-`).
4. Click "Save." All subsequent agent runs for this organization will use this key.

📌 Per-org keys allow organizations to manage their own Anthropic billing independently. The platform does not store keys in plaintext — they are encrypted at rest.

### Notifications

Navigate to `/admin/notifications`. The notification center shows all platform events:

- Agent execution completions and failures
- Budget threshold alerts
- Approval requests pending action
- Integration sync results

Notifications can be dismissed individually or cleared in bulk. Future versions will support email and Slack delivery.

---

## Interpreting Quality Indicators

### Timing Provenance Reference Table

| Provenance | Badge Colour | Confidence Range | Data Source | When to Trust |
|-----------|-------------|-----------------|-------------|--------------|
| `jira_measured` | Blue | 0.70–0.95 | Jira issue changelog dwell times | Always — highest measured confidence. Verify project key scope is correct |
| `code_signals` | Cyan | 0.60–0.80 | Timeout, SLA, cron values in source code | For technical steps with explicit SLA annotations; less reliable for human-facing process steps |
| `manual_override` | Green | 1.00 | Analyst-entered | Always — analyst takes full ownership of accuracy |
| `llm_estimated` | Amber | 0.50–0.65 | LLM inference from context and benchmarks | For initial estimates only; replace with measured data before using in investment cases |

### Hallucination Flag Severity Table

| Flag Severity | Visual Indicator | Typical Causes | Recommended Action |
|--------------|-----------------|---------------|-------------------|
| Critical | Red banner in review panel | No evidence sources found; timing values at extreme ranges (0h or 1000+h); all capabilities have identical timings | Reject output; add Context Hub documents; verify Jira integration is synced; re-run |
| Warning | Amber banner | Single evidence source only; LLM confidence below 0.55; capability names do not match repository content | Review each flagged item; apply manual overrides for business-critical steps |
| Info | Blue note | Code signals only (no Jira); moderate confidence (0.55–0.70); limited context documents | Acceptable for initial analysis; document limitations in stakeholder communications |

### Confidence Score Guide

| Score Range | Interpretation | Typical State |
|------------|---------------|--------------|
| 0.80–1.00 | High confidence — triangulated from multiple independent sources | Well-documented products with OpenAPI + Jira + code signals |
| 0.65–0.79 | Moderate-high — 2 strong sources agree | OpenAPI + GitHub structure, or Jira + code signals |
| 0.50–0.64 | Moderate — single source or weak triangulation | GitHub structure only, or LLM + 1 weak source |
| 0.35–0.49 | Low — URL analysis and LLM only | No OpenAPI, no Jira, no db schema |
| Below 0.35 | Very low — should not occur in normal operation | Indicates missing repository access or parse failure |

### Flow Efficiency Benchmark Reference

| Industry Segment | Typical Current-State FE | World-Class FE | Key Bottleneck |
|-----------------|------------------------|---------------|---------------|
| Retail Banking — Account Opening | 8–15% | 55–65% | Manual KYC review, batch processing |
| Retail Banking — Loan Origination | 5–12% | 40–55% | Credit decisioning, document review |
| Insurance — Claims Processing | 10–18% | 50–60% | Manual assessment, fraud review |
| Telco — Service Provisioning | 12–20% | 60–70% | Network provisioning queues, manual config |
| Wealth Management — Onboarding | 6–14% | 45–55% | Compliance checks, suitability assessment |
| Healthcare — Prior Authorisation | 4–10% | 35–50% | Clinical review, payer gateway queues |

These benchmarks are for contextual reference. Upload specific industry reports under VSM_BENCHMARKS for agent-grounded projections.

---

## Troubleshooting Reference

| # | Issue | Cause | Resolution |
|---|-------|-------|-----------|
| 1 | Dashboard shows all zeros for a new organization | Discovery has not been run yet | Navigate to `/discovery`, add a repository, and run the agent |
| 2 | Discovery agent returns 0 products | Repository URL is inaccessible (private without token, or incorrect URL) | Verify the URL is accessible; add a GitHub token for private repos; check URL format |
| 3 | Discovery confidence scores are all below 0.40 | No enrichment sources provided | Add an OpenAPI URL, DB schema text, or domain context; upload CURRENT_STATE documents |
| 4 | Products are appearing in the wrong business segment | Segment was not selected before running Discovery | Select the correct segment in the dropdown, then re-run Discovery |
| 5 | Segment rename broke product assignments | Business segment rename triggered positional cascade update | Go to `/discovery`, filter by each segment, verify product-segment assignments, and manually PATCH any incorrectly assigned products |
| 6 | Lean VSM agent shows only llm_estimated timings | Jira integration not synced or no event log uploaded | Sync Jira integration or upload a process mining CSV; re-run the VSM agent |
| 7 | Jira sync status is "error" | Incorrect API token, base URL, or project key | Check that the API token is valid and not expired; verify the base URL includes the protocol (https://); confirm the project key exists in Jira |
| 8 | VSM flow efficiency seems too high (>70%) for a manual process | LLM overestimated process time relative to wait time | Apply manual timing overrides based on actual process observations; set provenance to manual_override |
| 9 | Future State agent runs but shows no "Benchmark-grounded" badge | No VSM_BENCHMARKS or TRANSFORMATION_CASE_STUDIES uploaded | Upload at least 2 industry benchmark reports under VSM_BENCHMARKS and re-run the Future State agent |
| 10 | Future State projections are identical across all scenarios | LLM fallback mode with no grounding data | Same as #9 — upload benchmarks and re-run |
| 11 | Agent run shows FAILED in the monitor | Network error, database timeout, or LLM API error | Check `/admin/dead-letter` for the error message; common fixes: re-run if LLM rate limited, check DB connection if timeout |
| 12 | "Organization not found" error on page load | localStorage has a stale org ID from a previous session | Open browser console and run `localStorage.removeItem("currentOrgId")`, then reload |
| 13 | Context Hub document shows 0 chunks after upload | Document failed to parse (scanned PDF, empty file, or encoding issue) | Delete and re-upload as `.txt` or `.md`; for PDFs, try converting to text first |
| 14 | Mermaid diagram is blank or shows "No data" | VSM agent has not been run, or selected product/capability has no timing data | Run the VSM agent; or import an event log CSV; or apply manual overrides |
| 15 | RAG Accuracy page shows very low composite score | Few context documents, low agent run history, or no approved outputs | Upload more context documents; run and approve more agents; the score improves as data accumulates |
| 16 | Product Workbench readiness score is below 3.0 | Insufficient VSM coverage or very few functionalities per capability | Run the Lean VSM agent for this product; or import an event log CSV; ensure Discovery produced 3+ functionalities per capability |
| 17 | Risk register is empty after running Risk & Compliance agent | Discovery capabilities are very sparse (0–1 capability per product) | Ensure Discovery has produced a complete hierarchy before running Risk & Compliance |
| 18 | Roadmap timeline shows no items | Backlog & OKR agent has not been run | Run the Backlog & OKR agent from `/admin/backlog-okr` or the Product Workbench |
| 19 | Adding a URL to the Context Hub returns "Failed to fetch" | URL is not publicly accessible, or the server is blocking the request | Verify the URL is accessible from the server environment; download the document and upload as a file instead |
| 20 | SSO login redirects to login page in a loop | Session cookie is not being set correctly (HTTPS required for production) | Ensure the platform is running over HTTPS in production; check `NEXTAUTH_URL` environment variable matches the deployment URL |
| 21 | Jira cycle time extraction shows 0 synced items | Project has no issues with status transitions, or project key is wrong | Verify the project key in Jira; ensure issues have been moved through multiple statuses; check the project has a changelog |
| 22 | Multi-pass Discovery does not advance to Pass 2 | Pass 1 review panel was not approved before timeout | Click "Approve Pass 1" in the multi-pass panel to advance to Pass 2 |
| 23 | Import Process Map CSV returns validation error | CSV is missing required columns or uses different column names | Ensure columns are named `case_id`, `activity`, `timestamp` (case-insensitive); check for BOM characters in the CSV header |
| 24 | Dead letter queue items keep re-failing | Root cause not resolved before re-enqueueing | Read the full error message first; fix the underlying issue (e.g., update API token, fix input data) before re-enqueueing |
| 25 | Agent Monitor shows RUNNING for over 5 minutes | Agent node is deadlocked or waiting on an external resource | Navigate to `/admin/pipeline`, cancel the job, and re-run from `/admin/agent-monitor` or the relevant page |

---

## Glossary of Key Terms

| Term | Definition |
|------|-----------|
| **Agent** | A LangGraph-based AI workflow that executes a series of nodes to analyze data and produce structured output. TransformHub has 18 agents. |
| **Agent Output** | The structured result returned by an agent after a successful run. Stored in the database and auto-saved as a Context Document for cross-agent chaining. |
| **BM25 Reranking** | A retrieval algorithm that ranks document chunks by term frequency relevance. Used alongside semantic (vector) search to improve RAG precision. |
| **BMAD Hierarchy** | Business-Motivation-Architecture-Delivery — the four-level hierarchy (Organization → Repository → Product → Capability → Functionality) that structures all analysis in TransformHub. |
| **Bottleneck** | A VSM step with flow efficiency between 20–40%, indicating it is constraining overall throughput. Distinguished from Waste (< 20%) and Value-Adding (≥ 40%). |
| **Business Segment** | A top-level organizational division used to scope agent analysis and filter views (e.g., Retail Banking, Business Banking, Wealth Management). |
| **Capability (L2)** | A digital capability is a distinct business function within a digital product (e.g., "Account Opening," "Loan Decisioning"). Capabilities group related functionalities. |
| **Chunk** | A 2,000-character segment of an indexed document, created by splitting the original content with 400-character overlap. The unit of retrieval in the RAG pipeline. |
| **Code Signals** | Timeout values, SLA annotations, retry intervals, and cron expressions embedded in source code, extracted by the Discovery agent to infer process timing. |
| **Confidence Score** | A 0.0–1.0 score assigned to each discovered entity, based on the number and quality of evidence sources that corroborate it. See the Confidence Score Guide section. |
| **Context Document** | A document indexed in the Context Hub and available to agents via RAG retrieval. Includes uploaded files, fetched URLs, and auto-saved agent outputs. |
| **Context Hub** | The knowledge base at `/context-hub` where you manage documents, integrations, competitor intelligence, and tech trends for AI agent consumption. |
| **Dead Letter Queue (DLQ)** | A queue of agent executions that failed after all retry attempts, awaiting manual intervention. |
| **Digital Product (L1)** | A top-level product in the discovery hierarchy (e.g., "Mobile Banking App," "Internet Banking Portal"). Products belong to a repository and are tagged with a business segment. |
| **Evidence Sources** | The data inputs used to generate and score a discovered entity: url_analysis, openapi_spec, github_structure, github_tests, db_schema, context_document, integration_data, questionnaire. |
| **Flow Efficiency (FE)** | The ratio of process time to lead time, expressed as a percentage. FE = PT / (PT + WT) × 100. Higher is better. |
| **Functionality (L3)** | An individual process step within a capability (e.g., "Validate customer identity," "Submit credit bureau request"). Functionalities carry timing data and persona mappings. |
| **HITL (Human-in-the-Loop)** | The review-and-approve mechanism that requires an analyst to explicitly approve agent output before it is persisted to the database. |
| **jira_measured** | A timing provenance type indicating that the time value was derived from Jira issue changelog dwell times. Confidence 0.70–0.95. |
| **LangGraph** | The Python orchestration framework used to build TransformHub's AI agents as stateful directed graphs. Each agent is a LangGraph `StateGraph` with 5–7 nodes. |
| **Lead Time (LT)** | The total elapsed time from the start of a process to its completion, including all wait time. LT = PT + WT. |
| **llm_estimated** | A timing provenance type indicating that the time value was estimated by the LLM from domain context and uploaded benchmarks. Confidence 0.50–0.65. |
| **manual_override** | A timing provenance type indicating that an analyst entered the time value directly. Confidence 1.00 — highest priority source. |
| **Multi-Pass Discovery** | A Discovery mode that runs three sequential passes (L1 products → L2 capabilities → L3 functionalities) with human review gates between each pass. Produces higher-quality hierarchies for complex portfolios. |
| **Persona** | A role archetype (FRONT_OFFICE, MIDDLE_OFFICE, BACK_OFFICE) used to map functionalities to the types of users who perform or benefit from them. |
| **pgvector** | A PostgreSQL extension that stores and queries vector embeddings for semantic similarity search. Used by the RAG pipeline to find relevant document chunks. |
| **Process Time (PT)** | The time actively spent working on a process step (value-adding time). |
| **Product Group** | A logical grouping of related digital products within a repository, used to organise the Value Stream at the product-group level. |
| **RAG (Retrieval-Augmented Generation)** | A technique that retrieves relevant document chunks from the knowledge base and injects them into the LLM prompt, grounding the AI's response in uploaded organizational context. |
| **Readiness Score** | A 0–10 composite score measuring how well-characterized a digital product is for transformation planning. Computed from VSM coverage (35%), flow efficiency (25%), documentation (25%), and functionality depth (15%). |
| **Repository** | A source code repository or system that anchors a set of digital products. Repositories are the entry point for Discovery analysis. |
| **RICE Score** | A prioritisation score: Reach × Impact × Confidence / Effort. Used by the Backlog & OKR agent to rank transformation backlog items. |
| **Triangulation Bonus** | A +0.10 confidence bonus applied when three or more independent evidence sources agree on a discovered entity's name and characteristics. |
| **Value Stream Step** | A named step in a product group's value stream, representing a discrete unit of work. The atomic element of the VSM hierarchy. |
| **VSM (Value Stream Mapping)** | A lean methodology for analysing the flow of materials and information through a process. In TransformHub, VSM is applied to digital product capability flows to identify waste and bottlenecks. |
| **Wait Time (WT)** | The time a work item spends idle, queued, or blocked between active processing steps. Represents waste in the value stream. |
| **Waste** | A VSM classification for steps with flow efficiency below 20%. These steps are primary candidates for automation or elimination. |

---

*TransformHub User Guide · Version 1.0 · Generated for TransformHub platform (Next.js 15 + FastAPI + LangGraph + PostgreSQL)*
