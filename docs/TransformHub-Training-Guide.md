# TransformHub Platform Training Guide

**Version:** 1.0
**Audience:** Business Analysts, Enterprise Architects, Transformation Leads, Platform Administrators
**Last Updated:** March 2026

---

## Training Overview

### Objectives

By the end of this training, you will be able to:

- Explain the TransformHub data model and how it structures a digital estate
- Navigate every section of the platform confidently
- Build a high-quality knowledge base that improves AI agent accuracy
- Run the Discovery, Lean VSM, and Future State Vision agents end-to-end
- Interpret agent outputs critically — including timing provenance, hallucination flags, and confidence scores
- Apply manual overrides and re-run agents to refine outputs
- Manage users, budgets, and integrations as an administrator

### Audience

| Role | Recommended Modules |
|------|---------------------|
| Business Analyst / Transformation Lead | 1–7, 11 |
| Enterprise Architect | 1–8, 11 |
| Programme Manager | 1–3, 7, 11 |
| Platform Administrator | 1–3, 10 |
| Super Admin / DevOps | All modules |

### Prerequisites

- Access to a TransformHub tenant (credentials provided by your administrator)
- Familiarity with basic digital transformation concepts (value streams, capabilities, backlogs)
- No coding experience required for Modules 1–9

### Module Duration Estimates

| Module | Title | Estimated Time |
|--------|-------|----------------|
| 1 | Platform Overview & Core Concepts | 60 min |
| 2 | Getting Started | 20 min |
| 3 | Building Your Knowledge Base | 45 min |
| 4 | Discovery Agent — Capability Mapping | 60 min |
| 5 | Value Stream Mapping (Lean VSM Agent) | 75 min |
| 6 | Jira Integration | 30 min |
| 7 | Future State Vision | 45 min |
| 8 | Risk, Architecture & Compliance Agents | 45 min |
| 9 | Delivery & Organisational Agents | 60 min |
| 10 | Admin Functions | 30 min |
| 11 | End-to-End Workflow Practice | 120 min |

---

## Module 1: Platform Overview & Core Concepts

### What TransformHub Does and Why It Exists

Digital transformation programmes regularly fail because organisations lack a clear, evidence-based picture of what they currently do — at the level of digital products, capabilities, and value streams. Traditional consulting-led discovery work is slow, expensive, and relies heavily on individual interviews that produce inconsistent results.

TransformHub accelerates and standardises this analysis by applying a suite of 18 specialised AI agents to your organisation's code repositories, Jira projects, architecture documents, and uploaded knowledge base. The platform maps your digital estate automatically, calculates where waste and bottlenecks are concentrated, models future-state scenarios, and links findings directly to a prioritised delivery roadmap.

The result is a living, continuously-updated view of your transformation — not a one-off consulting report.

### The Transformation Analysis Lifecycle

The platform follows a deliberate sequence:

1. **Context loading** — You upload architecture standards, process documents, case studies, and policy frameworks to the knowledge base (Context Hub). The AI agents read this material before they analyse your systems.
2. **Discovery** — The Discovery agent scans code repositories, API specs, and integration data to identify digital products and their L1/L2/L3 capability hierarchy.
3. **Value stream mapping** — The Lean VSM agent maps how work flows through each product group, measuring process time, wait time, and flow efficiency per step.
4. **Risk and architecture analysis** — Specialist agents assess compliance gaps, technical debt, and modernisation pathways.
5. **Future state visioning** — The Future State Vision agent projects what flow efficiency and lead time could look like after transformation, grounded in benchmark data you have uploaded.
6. **Delivery planning** — Downstream agents generate backlogs, cost models, change impact assessments, and OKR frameworks from the findings above.

Each step feeds the next. Running Discovery before VSM is not merely recommended — the VSM agent reads the capability hierarchy that Discovery creates.

### Core Data Model

Understanding the data model is essential because every agent writes into it and reads from it.

```
Organization
  └── Repository  (a code repository, application, or logical system boundary)
        └── DigitalProduct  (a product line — e.g. "Home Loan Origination")
              ├── DigitalCapability  (L1 capability — e.g. "Credit Assessment")
              │     └── Functionality  (L2/L3 — e.g. "Serviceability Calculator")
              └── ProductGroup  (a logical grouping of value stream steps)
                    └── ValueStreamStep  (one step in the end-to-end flow)
```

The two branches under DigitalProduct (capabilities and product groups / value stream steps) serve different analytical purposes. Capabilities describe *what the product can do*; value stream steps describe *how work moves through the product*. The Lean VSM agent joins these two views to produce a complete flow analysis.

Each Functionality record carries timing fields (estimated cycle time, wait time, automation potential, manual touchpoints) and timing provenance fields (see below). Each ValueStreamStep carries parallel fields — process time in hours, wait time in hours, lead time, flow efficiency — plus future-state targets set by the Future State Vision agent.

### The 18-Agent Intelligence Engine

TransformHub deploys 18 LangGraph agents, each responsible for a distinct analytical domain:

| Agent | Primary Purpose |
|-------|----------------|
| Discovery | Map digital products, L1–L3 capabilities, functionalities from repositories and integrations |
| Lean VSM | Build value stream maps with measured timings; classify steps as value-adding, bottleneck, or waste |
| Future State Vision | Model transformation scenarios with conservative/expected/optimistic outcome bands |
| Risk & Compliance | Assess regulatory risk, compliance gaps, and transition-blocking issues |
| Architecture | Identify modernisation pathways, technical debt, and cloud migration readiness |
| Product Transformation | Generate migration plans from current-state capabilities to target architecture |
| Backlog & OKR | Create AI-prioritised backlogs and aligned OKR frameworks |
| Testing & Validation | Define quality gates and test coverage requirements |
| Cost Estimation | Build ROI models and investment cases with uncertainty ranges |
| Change Impact | Map organisational cascades from proposed changes |
| Data Governance | Assess data quality, lineage, and governance gaps |
| Market Intelligence | Analyse competitive landscape and technology trends |
| Skill Gap | Map current team capabilities against future-state requirements |
| Monitoring | Design KPI frameworks and alerting strategies |
| Documentation | Auto-generate technical documentation from agent findings |
| Security | Map vulnerabilities against OWASP and NIST frameworks |
| Fiduciary | Provide investment governance and budget justification analysis |
| Git Integration | Extract signals from commit history and code structure |

All 18 agents share a common execution infrastructure: they accept structured input, inject your knowledge base context via the RAG pipeline, produce structured JSON output, and write findings back to the database. You can track every execution in the Agent Monitor and Audit Log.

### Timing Provenance Hierarchy

When the platform assigns a time value to a value stream step or functionality, it always records *where that number came from*. This is called timing provenance. You should never treat all timing values as equally reliable.

| Source | Confidence Range | What It Means |
|--------|-----------------|---------------|
| `jira_measured` | 0.70–0.95 | Cycle time calculated from Jira changelog transitions (e.g. "In Progress" → "Done" across real tickets) |
| `manual_override` | 1.00 | A human explicitly entered or confirmed this value and saved it |
| `code_signals` | 0.60–0.80 | Estimated from static code analysis — complexity, test coverage, PR size distributions |
| `llm_estimated` | 0.50–0.65 | The AI inferred a plausible value from context; treat with caution |

The platform surfaces these confidence ratings as coloured badges next to every timing value in the VSM view. Steps with `llm_estimated` provenance are the highest-priority candidates for manual review or Jira integration. 📌 A flow efficiency figure that looks excellent may be unreliable if it is built entirely on `llm_estimated` steps — always check the provenance column before presenting results to stakeholders.

### Roles and What Each Can Do

TransformHub uses role-based access control with four roles:

| Role | Agent Execution | Override Timings | Manage Org | Manage Users | Set Budgets | Platform Admin |
|------|----------------|-----------------|------------|--------------|-------------|----------------|
| VIEWER | No | No | No | No | No | No |
| ANALYST | Yes | Yes | No | No | No | No |
| ADMIN | Yes | Yes | Yes | No | Yes | No |
| SUPER_ADMIN | Yes | Yes | Yes | Yes | Yes | Yes |

**VIEWER** — suitable for executives and stakeholders who need to review dashboards and agent outputs but should not trigger analysis or modify data.

**ANALYST** — the standard working role for transformation leads and business analysts. You can run any agent, apply timing overrides, provide feedback on outputs, and access all pages.

**ADMIN** — appropriate for the programme manager or platform owner within an organisation. You manage organisation settings, set LLM token and spend budgets, configure integrations, and invite users.

**SUPER_ADMIN** — reserved for the platform engineering team. SUPER_ADMINs can see and manage all organisations, configure circuit breaker settings, and access the full audit trail across tenants.

---

## Module 2: Getting Started

### Logging In

TransformHub supports two authentication methods:

**Email and password** — Navigate to the login page at your organisation's tenant URL (e.g., `https://app.transformhub.io` or your self-hosted domain). Enter your email address and password. If multi-factor authentication (MFA) is enabled for your account, you will be prompted for a six-digit TOTP code from your authenticator app immediately after password entry.

**SSO (Single Sign-On)** — If your organisation has configured an identity provider (Okta, Azure AD, Google Workspace, or a generic SAML provider), click the "Sign in with SSO" button. You will be redirected to your identity provider's login screen. After authenticating, you are returned to TransformHub automatically. Your role is assigned based on the `defaultRole` configured by your ADMIN — if you need a different role, contact your administrator.

⚠️ If your organisation enforces domain-restricted SSO, you cannot log in with an email address outside that domain. Contact your ADMIN if you receive an authentication error.

### Selecting Your Organisation

TransformHub is multi-tenant. After login, the platform reads your user record to determine which organisation you belong to, and sets that as your active context. The organisation name appears in the top navigation bar.

If you are a SUPER_ADMIN with access to multiple organisations, you will see an organisation switcher in the top bar. Click it to switch context. All data you see — repositories, agent results, knowledge base — belongs to the currently active organisation.

If the wrong organisation is shown after first login, clear your browser's local storage (`localStorage.removeItem("currentOrgId")` in the browser console) and refresh the page.

### Navigating the Sidebar

The sidebar is divided into two sections: main navigation and admin.

**Main navigation** (visible to all roles):

| Page | Purpose |
|------|---------|
| Organization Setup | Configure org name, industry type, business segments, regulatory frameworks, personas |
| Context Hub | Upload and manage your knowledge base |
| Discovery | Run the Discovery agent; review capability hierarchy |
| Dashboard | Portfolio overview across all products and repositories |
| Value Stream / VSM | Run the Lean VSM agent; view and edit value stream maps |
| Risk & Compliance | Run the Risk & Compliance agent; view risk assessments |
| Product Workbench | Run multiple agents against a product in sequence |
| Future State Vision | Run the Future State Vision agent; view scenario projections |
| Product Roadmap | RICE-scored roadmap across all products |
| RAG Accuracy | Inspect retrieval quality; review what context agents are using |

**Admin section** (visible to ADMIN and SUPER_ADMIN):

Architecture, Audit Log, Documentation Agent, Market Intelligence, Monitoring Agent, Notifications, Dead Letter, Backlog & OKR, Change Impact, Cost Estimation, Data Governance, Agent Monitor, Approvals, Pipeline, Reports, Security Agent, Skill Gap, Testing & Validation, Chat.

### Understanding the Dashboard

The Dashboard page is your portfolio overview. It shows:

- A summary count of repositories, digital products, capabilities, and functionalities across the organisation
- Per-product flow efficiency scores (where VSM has been run)
- A breakdown of timing provenance coverage across all value stream steps — useful for identifying which products still rely heavily on LLM estimates
- Recent agent execution status (last 10 executions with status badges)
- A list of open approval requests waiting for human review

The dashboard refreshes on each page load. It does not auto-poll — if you are waiting for a long-running agent to complete, navigate to the Agent Monitor in the admin section, which shows live execution status.

---

## Module 3: Building Your Knowledge Base (Context Hub)

### Why the Knowledge Base Matters

Every AI agent in TransformHub injects your knowledge base content into its prompt before analysing your systems. This is called Retrieval-Augmented Generation (RAG). The practical consequence is straightforward: agents that have access to your architecture standards, process documentation, regulatory policies, and industry benchmarks produce significantly more accurate, organisation-specific outputs than agents working without that context.

Without a populated knowledge base, the Discovery agent makes general inferences about your industry. With your architecture standards, API catalogues, and domain documentation loaded, it maps capabilities that align with your actual terminology, governance model, and technology constraints. The difference in output quality is substantial.

### Document Categories and What to Upload

The Context Hub organises documents into categories. Uploading into the correct category matters because the RAG pipeline allocates different budget proportions per category depending on which agent is running.

| Category | What to Upload | Used Heavily By |
|----------|---------------|-----------------|
| CURRENT_STATE | Current architecture diagrams, process maps, capability assessments, application portfolios | Discovery, Lean VSM |
| ARCHITECTURE_STANDARDS | Enterprise architecture principles, API standards, cloud strategy, reference architectures, ADRs | Discovery, Risk & Compliance, Architecture |
| VSM_BENCHMARKS | Industry lean/flow benchmarks, cycle time data from peer organisations, process efficiency studies | Lean VSM, Future State Vision |
| TRANSFORMATION_CASE_STUDIES | Published transformation case studies, before/after flow metrics, post-implementation reviews | Future State Vision, Market Intelligence, Product Transformation |
| AGENT_OUTPUT | Automatically saved by agents — prior Discovery and VSM outputs stored for cross-run awareness | All agents |
| REGULATORY | Policy documents, compliance frameworks (e.g. PCI-DSS controls, APRA CPS 234), audit findings | Risk & Compliance, Security, Fiduciary |
| INTEGRATION | Automatically populated by Jira/Confluence/Azure DevOps syncs | Discovery, Lean VSM |
| GENERAL | Reference material that does not fit the above categories | All agents (low priority) |

📌 The `AGENT_OUTPUT` category is written automatically by the platform when agents complete. You do not need to manage it manually — but you should be aware that it exists, because it means subsequent agent runs benefit from the findings of earlier runs.

### How to Upload Documents

1. Click **Context Hub** in the sidebar.
2. In the upload area, select the toggle for "File Upload" (the default view).
3. Click "Choose file" or drag and drop a file into the drop zone. Supported formats include PDF, DOCX, TXT, MD, and CSV.
4. Select the appropriate **Category** from the dropdown.
5. Optionally enter a **Sub-category** label — for example, "APRA CPS 234" under the REGULATORY category.
6. Click **Upload**.

The platform chunks the document into segments of approximately 2,000 characters with 400-character overlaps, generates a 1,536-dimensional embedding vector for each chunk using OpenAI's embedding model, and stores both the text and the vector in PostgreSQL with the pgvector extension. Status updates from "UPLOADED" → "PROCESSING" → "READY" as this pipeline runs. You will see a chunk count appear once processing is complete.

⚠️ Very large documents (over 50 MB) may take several minutes to process. Do not navigate away from the Context Hub page until you see the "READY" status, or you will not know if an error occurred.

### How to Fetch URLs

For content hosted on the web — including GitHub repositories, Confluence pages, or public documentation sites — you can fetch the content directly rather than downloading and re-uploading.

1. In the Context Hub, select the **URL Fetch** toggle.
2. Paste the URL of the resource.
3. Select the appropriate Category.
4. Click **Fetch**.

The platform sends a server-side HTTP request to the URL, extracts the main text content, strips navigation and boilerplate, and then chunks and embeds the content using the same pipeline as file uploads. GitHub links to individual files or README documents work particularly well. Confluence pages require that your Confluence instance is publicly accessible or that the URL includes a valid authentication token.

### Chunking, Embedding, and BM25 Reranking Explained

When an agent runs, it does not inject your entire knowledge base into the prompt. That would be far too large. Instead, the retrieval pipeline:

1. **Generates multiple queries** — The system formulates 3–5 search queries tailored to the agent type and the specific product being analysed (e.g., for the Lean VSM agent: "value stream step cycle time", "process bottleneck patterns", "wait time in [product name]").
2. **Runs semantic retrieval** — Each query is embedded using the same model as the documents, and pgvector performs cosine similarity search to find the top matching chunks.
3. **Unions and deduplicates** — Results from all queries are combined and duplicates are removed, giving a pool of up to 25 candidate chunks by hit frequency.
4. **BM25 reranking** — A keyword-frequency reranker (BM25) scores the candidate chunks against the original queries. This catches precise terminology matches that semantic search can miss — for example, an exact process name or a specific regulatory control code.
5. **Category-aware budget allocation** — The top chunks are injected into the prompt, but the system allocates context budget by category. For the Lean VSM agent, VSM_BENCHMARKS receive 38% of the available context window, TRANSFORMATION_CASE_STUDIES receive 18%, and prior AGENT_OUTPUT receives 24%.

You do not need to configure this pipeline. It runs automatically. Understanding it helps you make better decisions about what to upload and which categories to use.

### Best Practices for Knowledge Base Quality

- Upload documents in their most structured form. A well-formatted PDF with clear headings is easier to chunk meaningfully than a scanned image or a presentation slide deck.
- Use specific, descriptive file names. The file name is included in the document's metadata and surfaced to agents as the source label.
- Upload benchmark data before running the Lean VSM and Future State Vision agents. These two agents benefit most from having industry flow metrics available.
- Do not upload the same document multiple times under different categories. Duplicate content inflates chunk counts and degrades retrieval precision.
- After a major agent run, visit the **RAG Accuracy** page. It shows you which chunks were retrieved for the most recent execution and how they were scored. If you see irrelevant chunks being injected, delete the offending document from the Context Hub and upload a more focused version.
- Keep regulatory documents up to date. If your compliance framework has been revised, delete the old version and upload the new one. Agents do not automatically detect version conflicts.

---

## Module 4: Discovery Agent — Capability Mapping

### What It Does

The Discovery agent is the foundation of the TransformHub analysis. It reads your code repositories, OpenAPI/Swagger specifications, database schemas, Jira project data, and uploaded documentation to build a three-level capability hierarchy:

- **L1 (DigitalProduct)** — A major product or product line (e.g. "Home Loan Origination", "FX Trading Platform", "Customer Onboarding")
- **L2 (DigitalCapability)** — A business capability within that product (e.g. "Credit Assessment", "Document Management", "Notification Service")
- **L3 (Functionality)** — A specific functionality within a capability (e.g. "Serviceability Calculator", "PDF Document Parser", "SMS Dispatch Worker")

Each item receives a confidence score (0.0–1.0) and a list of source attribution strings that tell you how that item was identified. Items with multiple independent sources receive a triangulation bonus.

### Inputs Required Before Running

Before running the Discovery agent, ensure you have:

1. **At least one Repository** configured in the system (via Organization Setup → Repositories). The repository should have a URL if it is a GitHub repository, or a meaningful name and description if you are treating it as a logical system boundary.
2. **A Business Segment selected** — On the Discovery page, use the business segment dropdown to choose which segment of your organisation this analysis is for. This tag is written to all digital products created by the run. If you skip this, products default to your organisation's first configured segment.
3. **Relevant documents uploaded** to the Context Hub — particularly current-state architecture documents and your API catalogue, if one exists.

Optional but highly valuable inputs (entered on the Discovery page before running):

| Input | What It Adds | Confidence Bonus |
|-------|-------------|-----------------|
| OpenAPI spec URLs | Precise API surface area, endpoint names, data contracts | +0.20 |
| GitHub token | Repository file structure, test file names, module organisation | +0.15 to +0.30 |
| Database schema text | Entity-level evidence for data capabilities | +0.20 |
| Domain context (free text) | Guided focus on specific domains or known terminology | +0.10 |
| Known product names | Hard constraints preventing LLM from inventing product names | +0.10 |
| Known capability names | Anchors L2 naming to your existing vocabulary | +0.10 |

### Step-by-Step: How to Run It

1. Navigate to **Discovery** in the sidebar.
2. Select the **Repository** you want to analyse from the dropdown.
3. Select the **Business Segment** for this product family.
4. Expand the **Enrichment Inputs** section and enter any of the optional inputs listed above.
5. If you want a phased run rather than a full single-pass run, select the pass mode:
   - **Full (Pass 0)** — Maps everything in one shot. Suitable for an initial baseline.
   - **L1 only (Pass 1)** — Creates only digital products; you review them before L2 is added.
   - **L2 (Pass 2)** — Adds capabilities under confirmed L1 products.
   - **L3 (Pass 3)** — Adds functionalities under confirmed capabilities.
6. Click **Run Discovery**.
7. The execution card updates in real time. Discovery typically takes 45 seconds to 3 minutes depending on repository size and the number of enrichment sources.
8. When status shows "COMPLETED", click **View Results**.

### What the Output Means

The Discovery output page shows the capability hierarchy as an expandable tree. For each item, you will see:

- **Name and description** — Generated by the AI from your evidence sources
- **Confidence score** — A percentage from 0–100%. Items below 60% warrant careful review.
- **Sources** — A list such as `["github_structure", "openapi_spec", "context_document"]` showing which evidence sources contributed
- **Business segment** — The segment tag applied to the product
- **Current state / future state** summaries — Brief AI-generated descriptions of what the product does today and where it could go

The Business Requirements Document (BRD) tab contains a more narrative summary of findings, suitable for sharing with stakeholders who prefer prose over structured data.

### How to Review and Accept / Correct Suggestions

The Discovery output is a starting point, not a final answer. You should review it before proceeding to VSM.

- **Accept items as-is** — If a product, capability, or functionality is named correctly and described accurately, no action is needed. It remains in the database.
- **Edit names and descriptions** — Click the edit icon next to any item. Inline editing lets you correct naming, fix descriptions, or adjust the business segment. Changes are saved immediately and logged in the audit trail.
- **Delete incorrect items** — If the agent has hallucinated a product that does not exist (for example, a test harness mistaken for a product), delete it. This is preferable to leaving wrong data in the system, as subsequent agents read from the Discovery output.
- **Add missing items manually** — Use the "Add product" / "Add capability" / "Add functionality" buttons to fill gaps the agent missed.

📌 When you edit or delete Discovery output, the audit log records both the original AI-generated value and your correction. This creates a feedback trail that improves future runs.

### Common Issues and How to Resolve

| Issue | Likely Cause | Resolution |
|-------|-------------|------------|
| Products are very generic ("API Service", "Data Service") | No OpenAPI spec or GitHub token provided | Add the GitHub token or paste the OpenAPI spec URL and re-run |
| Too many products identified (20+) | Repository contains multiple microservices, each treated as a product | Use Pass 1, review L1 products, delete incorrect ones, then run Pass 2 |
| Capabilities named with code identifiers ("UserSvcModule") | No domain context or known capability names provided | Add domain context text and known capability names; re-run |
| Confidence scores all below 50% | No enrichment sources; no Context Hub documents | Upload architecture documents to Context Hub; add enrichment inputs |
| Business segment not tagging correctly | Segment not selected before running | Always select the segment before clicking Run; check the dropdown shows the correct value |
| Execution shows "FAILED" | LLM provider error or network timeout | Check Agent Monitor for error details; retry once; if it persists check the Dead Letter queue |

---

## Module 5: Value Stream Mapping (Lean VSM Agent)

### What Value Stream Mapping Is

Value stream mapping (VSM) is a lean manufacturing technique, adapted here for digital product delivery. A value stream is the end-to-end sequence of steps required to deliver a unit of value — a feature, a transaction, a customer request — from trigger to completion.

The critical metrics are:

- **Process time** — The active work time at each step (where someone or something is doing work)
- **Wait time** — Idle time between steps (queue time, approval delays, batch processing windows)
- **Lead time** — Process time plus wait time for a step; the total elapsed time from the customer's perspective
- **Flow efficiency** — Process time divided by lead time, expressed as a percentage. Industry benchmarks for software delivery typically range from 5–40%. Anything above 40% represents a highly optimised flow.

Bottlenecks are steps where wait time is disproportionately large relative to process time. Waste steps are steps that consume time but add no customer-perceivable value. Identifying and eliminating or automating these is the core purpose of a VSM exercise.

### How TransformHub Automates VSM

The Lean VSM agent reads the capability hierarchy created by Discovery, fetches timing data from Jira (if integrated), applies code signals from the repository analysis, and uses your uploaded VSM benchmark documents as grounding for its estimates. It then:

1. Loads all capabilities and product groups for the selected product from the database
2. Constructs value stream steps ordered by workflow position
3. Assigns timing values using the best available source (Jira > code signals > LLM estimate)
4. Classifies each step as `value_adding`, `bottleneck`, or `waste`
5. Calculates flow efficiency at the step and product level
6. Generates improvement notes for bottleneck and waste steps
7. Flags potential hallucinations in the output (see below)
8. Persists results to the database and saves an AGENT_OUTPUT context document for future runs

### Inputs: Capabilities from Discovery, Jira Integration, Code Signals

The Lean VSM agent is **not designed to be run before Discovery**. It reads the capability hierarchy and product groups that Discovery creates. Running VSM on a repository where Discovery has not been completed will produce low-quality results because there is no structured capability data to map.

Additionally, having the Jira integration configured dramatically improves timing accuracy. See Module 6 for Jira setup instructions.

### Step-by-Step: How to Run It

1. Confirm that Discovery has been run for the target product and you are satisfied with the capability hierarchy.
2. Navigate to **Value Stream / VSM** in the sidebar.
3. Select the **Organisation**, **Repository**, and **Digital Product** you want to map.
4. If Jira is integrated, ensure the project key is configured (see Module 6). The agent will automatically pull cycle time data.
5. Click **Run Lean VSM**.
6. The execution typically takes 60 seconds to 4 minutes. Progress updates appear on the execution card.
7. When "COMPLETED", click **View VSM**.

### Reading the VSM Output

The VSM output page renders the value stream as a horizontal flow diagram (generated as Mermaid source) plus a detailed table of all steps.

**The flow diagram** shows each step as a box with its process time and wait time annotated below. Steps classified as bottlenecks are highlighted in amber; waste steps are highlighted in red; value-adding steps are shown in green.

**The step table** contains the following columns:

| Column | What It Shows |
|--------|-------------|
| Step Name | The name of the value stream step |
| Step Type | "process" or "wait" node type |
| Process Time (hrs) | Active work time for this step |
| Wait Time (hrs) | Idle time before this step begins |
| Lead Time (hrs) | Process + wait time |
| Flow Efficiency | Process / lead time for this step |
| Classification | value_adding / bottleneck / waste |
| Timing Source | Provenance badge (see below) |
| Confidence | Numeric confidence for the timing values |
| Improvement Note | AI-generated suggestion for this step |

At the bottom of the page, the **summary panel** shows:

- Total process time (sum of all process times)
- Total lead time (end-to-end elapsed time)
- Overall flow efficiency percentage
- Count of bottleneck steps and waste steps
- A Mermaid diagram you can copy and embed in Confluence or a slide deck

### Timing Provenance Badges — What They Mean

Every step in the VSM table shows a coloured provenance badge next to its timing values:

- **Blue badge — `jira_measured` (0.70–0.95 confidence)** — The most reliable source. Cycle time was calculated from actual ticket transitions in Jira. Trust these numbers.
- **Green badge — `manual_override` (1.00 confidence)** — A human has reviewed and confirmed or corrected this value. Always trust these numbers.
- **Yellow badge — `code_signals` (0.60–0.80 confidence)** — Derived from static code analysis. Reasonably reliable for simple, well-structured code; less reliable for legacy or poorly-tested code.
- **Red badge — `llm_estimated` (0.50–0.65 confidence)** — The AI inferred a value from context and benchmarks. Treat as an informed estimate. These steps should be prioritised for Jira integration or manual review.

📌 A step-level flow efficiency of 80% built on `llm_estimated` data means very little. Conversely, a flow efficiency of 12% built on `jira_measured` data is a reliable finding that merits investigation.

### Applying Manual Overrides

When you have better timing data than the system has — for example, from a recent time-and-motion study, or from a colleague who manages that process — you can override individual step timings.

1. In the VSM step table, click the edit icon on the row you want to modify.
2. Enter your corrected **Process Time (hrs)** and/or **Wait Time (hrs)**.
3. Enter an **Override Note** describing the source of your data (e.g., "Q3 2025 process audit — averaged over 12 samples").
4. Click **Save Override**.

The timing source immediately changes to `manual_override` and confidence becomes 1.00. The lead time and flow efficiency recalculate automatically. The previous value is stored in the `timing_overrides` table with your user ID and timestamp, creating a full audit trail.

⚠️ If you override a timing value and later re-run the Lean VSM agent, the agent will not overwrite `manual_override` values. They are preserved across re-runs. If you want the agent to re-estimate a step you previously overrode, you must delete the override first.

### Hallucination Flags — How to Respond

The Lean VSM agent includes a self-inspection step that flags outputs that may be unreliable. Hallucination flags appear as inline callouts in the VSM output at three severity levels:

| Severity | Meaning | Recommended Action |
|----------|---------|-------------------|
| CRITICAL | The AI cannot reliably estimate this value and the number may be fabricated | Do not use this value. Apply a manual override or connect Jira. |
| WARNING | The estimate is based on limited evidence and may be significantly off | Review carefully. Corroborate with subject matter experts before presenting. |
| INFO | A minor uncertainty; the estimate is plausible but unverified | Note for future validation. Acceptable for initial analysis. |

When you see CRITICAL flags, the most productive response is to either integrate Jira (Module 6) or apply manual overrides from your own process knowledge. A VSM with multiple CRITICAL flags should not be used as the basis for investment decisions without first resolving those flags.

---

## Module 6: Jira Integration

### Setting Up the Integration

1. Navigate to **Organization Setup** → **Integrations** tab.
2. Click **Add Integration** and select **Jira**.
3. Enter the following details:

| Field | Value |
|-------|-------|
| Base URL | Your Jira instance URL (e.g., `https://yourcompany.atlassian.net`) |
| Username | The email address of the Jira account to use for API calls |
| API Token | A Jira API token (generated in Atlassian Account Settings → API tokens) |
| Project Key | The Jira project key (e.g., `HLLO` for Home Loan) |

4. Click **Test Connection**. You should see a green success indicator confirming that the API credentials are valid and the project exists.
5. Click **Save**.

⚠️ The API token is stored encrypted at rest. However, the account you use must have at minimum "Browse Projects" and "View Issue History" permissions on all projects you intend to analyse. If cycle time extraction fails, check that the account has permission to view the changelog on issues.

### Project Key Configuration

Each ExternalIntegration record holds a single project key. If your digital product spans multiple Jira projects (for example, a separate project for each squad), you should create one integration record per project. The Lean VSM agent queries all integration records for the organisation when building its timing model.

You can update the project key for an existing integration at any time without needing to re-enter credentials. Navigate to Organization Setup → Integrations, click the edit icon on the integration, update the Project Key field, and save.

### Running Cycle Time Extraction

Once the Jira integration is configured, cycle time extraction happens automatically when the Lean VSM agent runs. You do not need to trigger it separately. The agent:

1. Fetches all issues from the configured project that have transitioned through a "done" state in the last 90 days (configurable)
2. Parses the changelog for each issue to find the timestamps of transitions into and out of each status
3. Calculates median cycle time per status category (In Progress, In Review, In Test, Done)
4. Maps each status category to a value stream step name using the step's name as the lookup key
5. Records the timing source as `jira_measured` and stores the confidence score based on sample size

📌 Larger Jira sample sizes produce higher confidence scores. If a project has fewer than 10 completed tickets in the last 90 days, the confidence will be lower (closer to 0.70) than a project with 200+ completed tickets (which may reach 0.92–0.95).

### How Jira Data Feeds into VSM Timings

After extraction, Jira cycle times become the primary timing source for any value stream step whose name matches a Jira status category. The matching is done by the Lean VSM agent using the step name — for example, a value stream step named "Code Review" will receive the measured cycle time for issues that spent time in a "Code Review" or "In Review" status in Jira.

If a step name does not match any Jira status, the agent falls back to code signals or LLM estimation for that step. This is why naming value stream steps with language that aligns with your Jira workflow statuses improves data quality — and why reviewing and editing Discovery output (particularly product group and value stream step names) before running VSM is worthwhile.

---

## Module 7: Future State Vision

### What the Agent Produces

The Future State Vision agent takes your current-state VSM results and projects what performance could look like after a defined transformation programme. Rather than producing a single target figure, it generates three scenario bands:

- **Conservative** — Assumes partial automation, existing team structure, realistic change management friction
- **Expected** — Assumes a well-executed programme with targeted automation and capability uplift
- **Optimistic** — Assumes full automation of all automatable steps, skills uplift complete, minimal organisational drag

For each scenario, the agent produces projected values for: total lead time, flow efficiency, process time, bottleneck reduction percentage, and estimated cost-to-serve change.

When VSM_BENCHMARKS documents are present in the Context Hub, the agent grounds these projections in your uploaded data and adds a "Benchmark-grounded" badge to the output. Without benchmarks, it falls back to multiplier-based estimates, which are less defensible.

### Benchmark Grounding Explained

When you upload industry benchmark data to the Context Hub under the VSM_BENCHMARKS category, the Future State Vision agent retrieves that content via the RAG pipeline and uses it to calibrate scenario ranges. For example, if your benchmarks indicate that financial services organisations running similar transformation programmes achieve 25–45% flow efficiency improvement after 18 months, the agent anchors its "expected" scenario to that range rather than using generic assumptions.

This is one of the highest-value activities you can perform before running this agent. Suitable benchmark sources include:

- Industry analyst reports on lean/agile transformation outcomes (Gartner, Forrester, McKinsey)
- Published case studies from peer organisations (with specific before/after flow metrics)
- Your own post-implementation reviews from previous transformation programmes
- Academic or practitioner research on process improvement in your sector

### Inputs Required

The Future State Vision agent requires:

- At least one completed Lean VSM run for the product you want to vision (the agent reads current-state timings from the database)
- VSM_BENCHMARKS documents in the Context Hub (strongly recommended)
- TRANSFORMATION_CASE_STUDIES documents in the Context Hub (strongly recommended)
- AGENT_OUTPUT from prior Discovery and VSM runs (populated automatically)

### Step-by-Step: How to Run It

1. Confirm that the Lean VSM agent has completed successfully for the target product and the VSM output looks reasonable.
2. Navigate to **Future State Vision** in the sidebar.
3. Select the **Organisation** and **Digital Product**.
4. Optionally enter a **Transformation Horizon** (default: 18 months) and a **Focus Area** (e.g., "Automate back-office processing", "Eliminate approval bottlenecks").
5. Click **Run Future State Vision**.
6. Execution takes 60 seconds to 3 minutes.
7. When "COMPLETED", click **View Future State**.

### Reading Projected Metrics

The output page shows:

- A **scenario comparison table** with conservative, expected, and optimistic columns for each metric
- A **step-level future state panel** showing target process time and wait time for each value stream step, with an `improvementPhase` tag (now / next / later) indicating when each improvement is expected to be delivered
- A **"Benchmark-grounded" badge** if VSM_BENCHMARKS documents contributed to the projection
- A **narrative summary** explaining the assumptions behind each scenario band

The `projected_metrics` structure returned by the agent is written back into the database and can be read by the Cost Estimation and Backlog & OKR agents to inform investment sizing.

### Using Findings for Investment Prioritisation

The Future State Vision output is designed to support an investment case. To build one:

1. Take the **expected scenario** as your central case (present this to executives)
2. Use **conservative** as your downside case (use this for budget floor)
3. Use **optimistic** as your upside case (use this to illustrate the ceiling of the opportunity)
4. Feed the expected scenario into the **Cost Estimation agent** (admin section) to get an ROI model
5. Feed the step-level improvement phases into the **Backlog & OKR agent** to generate a delivery roadmap with OKRs

📌 When presenting the Future State Vision to a steering committee, always include the provenance of the current-state timings (how many steps are `jira_measured` vs `llm_estimated`) alongside the projection. A projection built on reliable current-state data is far more defensible than one built on LLM estimates.

---

## Module 8: Risk, Architecture & Compliance Agents

### Risk & Compliance Agent

**What it analyses:** The Risk & Compliance agent reviews the current-state capability map, your uploaded regulatory documents, and organisation metadata (particularly `regulatoryFrameworks` configured in Organization Setup) to:

- Identify capabilities that touch regulated activities
- Assess risk category (operational, regulatory, data, security, transition) for each
- Generate a risk score (0–10) and severity rating (LOW / MEDIUM / HIGH / CRITICAL)
- Describe mitigation plans for each finding
- Flag any capabilities where a transition to future state is blocked until the risk is mitigated

**Output format:** A structured list of `RiskAssessment` records, each with: entity type, entity ID (linking to the specific product or capability), risk category, risk score, severity, description, and mitigation plan. Findings with `transitionBlocked = true` appear highlighted in red — these must be addressed before the associated capability can move forward.

**When to run it:** After Discovery has completed and before building the investment case. Risk findings should inform scope, sequencing, and contingency in your roadmap. Run it again after applying major changes to the capability map.

### Architecture Agent

**What it analyses:** The Architecture agent reviews your current-state capabilities, technology stack data from the application portfolio (entered in Organization Setup), and your uploaded ARCHITECTURE_STANDARDS documents. It produces:

- Modernisation pathway recommendations per capability (lift-and-shift, re-platform, re-architect, replace, retire)
- Technical debt assessment
- Cloud migration readiness scores
- Integration dependency mapping

**When to run it:** After Discovery, and ideally before Future State Vision — the architecture pathway recommendations can inform which transformation scenarios are realistic.

📌 The more complete your application portfolio in Organization Setup (with technology stack, vendor, lifecycle status, and annual cost per application), the more precise the Architecture agent's modernisation recommendations will be.

### Fiduciary Agent

**What it analyses:** The Fiduciary agent operates at the investment governance level. It reviews cost estimates, projected benefits, risk assessments, and benchmark data to:

- Validate that investment cases are adequately substantiated
- Identify gaps in the evidence base (e.g., projections not grounded in benchmarks)
- Flag conflicts of interest or over-optimistic assumptions
- Recommend additional due diligence before commitment

**When to run it:** After Cost Estimation has produced a model, and before submitting an investment proposal to a governance board.

### Security Agent

**What it analyses:** The Security agent maps your capabilities and application portfolio against OWASP Top 10 and NIST Cybersecurity Framework controls. It identifies:

- Capabilities with exposure to OWASP vulnerability categories
- Gaps in NIST CSF coverage (Identify, Protect, Detect, Respond, Recover)
- Recommended security controls per capability

**When to run it:** In parallel with Risk & Compliance. If your organisation operates in a regulated industry (banking, health, government), run the Security agent before the Fiduciary agent so that security remediation costs can be included in the investment case.

### Summary: When to Run Each

| Agent | Prerequisite | Typical Timing in Programme |
|-------|-------------|----------------------------|
| Risk & Compliance | Discovery complete | Week 2–3 |
| Architecture | Discovery complete; app portfolio populated | Week 2–3 |
| Security | Discovery complete; app portfolio populated | Week 2–3 |
| Fiduciary | Cost Estimation complete | Week 5–6 |

---

## Module 9: Delivery & Organisational Agents

### Product Transformation Agent

The Product Transformation agent generates detailed migration plans from the current-state capability structure to a defined target architecture. It reads prior agent outputs (Discovery, Architecture, Risk & Compliance) and produces:

- A phased migration plan with now/next/later horizons
- Per-capability migration approach (lift-and-shift, re-platform, re-architect, decommission)
- Dependency sequencing — which capabilities must be transformed before others can follow
- Key risks and mitigations for each migration phase

Run this after Architecture and Risk & Compliance are complete. The output feeds directly into the Backlog & OKR agent.

### Backlog & OKR Agent

The Backlog & OKR agent creates an AI-prioritised delivery backlog from all available agent findings. It uses RICE scoring (Reach, Impact, Confidence, Effort) to rank backlog items and groups them into OKR-aligned objectives.

Output includes:
- `RoadmapItem` records in the database, each with RICE score, quarter, status, and source attribution
- OKR objectives linked to transformation themes
- A quarter-by-quarter delivery sequence

These items appear in the **Product Roadmap** page, where you can review, approve, or reject them. Items with `approvalStatus = PENDING` are surfaced in the Approvals admin page for ADMIN review before they are considered committed.

### Cost Estimation Agent

The Cost Estimation agent builds an ROI model from:

- Future state projections (process time and efficiency improvements)
- Backlog items and their estimated effort
- Current-state cost data (if application annual cost is populated in Organization Setup)
- Industry benchmark cost-to-serve data from the Context Hub

Output includes conservative/expected/optimistic cost and benefit projections, NPV and payback period estimates, and a sensitivity analysis showing which assumptions most affect the ROI.

### Change Impact Agent

The Change Impact agent maps organisational cascades from proposed transformation activities. It reads the persona definitions from Organization Setup and analyses how each backlog initiative affects each persona type (FRONT_OFFICE, MIDDLE_OFFICE, BACK_OFFICE).

Output includes:
- Impacted roles per initiative
- Change readiness assessment for each role
- Recommended change management activities (training, communication, process redesign)
- Transition risk flags for initiatives with high organisational impact

### Skill Gap Agent

The Skill Gap agent compares the skills required to deliver and operate the future-state architecture against the capabilities assumed in your current team structure. It produces:

- A skills gap matrix per capability area
- Recommended upskilling pathways
- Build vs buy vs partner recommendations for critical skill gaps
- Estimated timeline and cost for skills uplift

### Market Intelligence Agent

The Market Intelligence agent analyses your competitive landscape and technology trends in the context of your transformation programme. It reads your organisation's configured competitor list and uploaded TRANSFORMATION_CASE_STUDIES to produce:

- Competitive positioning assessment
- Technology trends relevant to your industry and capability map
- Peer organisation transformation benchmarks
- Recommendations for where to invest ahead of the market

This agent benefits greatly from having fresh competitive intelligence uploaded to the Context Hub. Consider uploading annual reports, analyst briefings, or competitor product announcements before running it.

### Testing & Validation Agent

The Testing & Validation agent defines quality gates for the delivery programme. For each capability in scope, it produces:

- Test coverage requirements
- Recommended test types (unit, integration, performance, security, UAT)
- Acceptance criteria templates
- Definition of Done for each capability transition phase

### Monitoring Agent

The Monitoring agent designs a KPI framework for tracking transformation progress and post-go-live performance. Output includes:

- Leading and lagging KPIs per objective
- Alerting thresholds and escalation paths
- Dashboard specification for ongoing reporting

### Data Governance Agent

The Data Governance agent assesses data quality, lineage, and governance gaps across the capabilities in scope. It produces:

- Data quality assessments per capability (completeness, accuracy, timeliness, consistency)
- Data lineage maps showing how data flows between capabilities
- Gaps in data ownership and stewardship
- Recommended governance controls and data quality remediation actions

### Documentation Agent

The Documentation agent auto-generates technical documentation from agent findings. It produces:

- Architecture decision records (ADRs) for major modernisation choices
- Capability catalogue entries in a structured format
- Process narrative descriptions for each value stream
- Summary briefing documents for executive stakeholders

Documents generated by this agent are saved to the Context Hub as AGENT_OUTPUT, making them available to subsequent analysis runs.

---

## Module 10: Admin Functions

### Managing Users and Roles (RBAC)

User management is accessible to ADMIN and SUPER_ADMIN roles under **Organization Setup → Users**.

To invite a new user:
1. Click **Invite User**.
2. Enter their email address.
3. Select their role (VIEWER, ANALYST, ADMIN).
4. Click **Send Invitation**.

The invited user receives an email with a link to create their password. If your organisation uses SSO, direct them to use the SSO login path instead — password-based accounts and SSO accounts for the same email address are treated as separate users. ⚠️ Ensure you use the same email address that is registered with your identity provider.

To change a user's role:
1. Find the user in the user list.
2. Click the role badge.
3. Select the new role from the dropdown.
4. Confirm the change.

Role changes take effect immediately at next login. Active sessions are not invalidated when a role is downgraded — the user must log out and back in for the change to apply to their current session.

### Setting LLM Budgets and Per-Org API Keys

Each organisation can have its own monthly token cap and spend cap. These are configured under **Admin → Agent Monitor → Budget Settings** (or via the API).

| Setting | Purpose |
|---------|---------|
| Monthly Token Cap | Maximum total tokens (input + output) consumable per calendar month. Once reached, agent executions are blocked until the next billing period. |
| Monthly Spend Cap | Maximum USD spend per calendar month. Calculated from input/output token counts multiplied by the model's per-token rate. |
| Alert Threshold | A fraction (default 0.80) at which the platform sends a notification alert to ADMIN users. |
| Hard Cap Enabled | When enabled, agent executions that would exceed the cap are rejected. When disabled, the cap is advisory only. |

Organisations can also supply a private Anthropic API key. When set, all agent executions for that organisation use the organisation's own key, and costs are billed directly to that account rather than to the platform's global key. This is particularly useful for large enterprise clients with their own Anthropic agreements.

⚠️ The per-org API key is never returned in list API responses. It can only be set (not read) via the admin endpoint. If you need to rotate the key, simply set a new value — it overwrites the previous one.

### Viewing the Audit Log

The Audit Log is accessible under **Admin → Audit Log**. Every meaningful action in the platform creates an immutable audit entry including:

- Action type (e.g., `AGENT_EXECUTION_STARTED`, `TIMING_OVERRIDE_APPLIED`, `USER_ROLE_CHANGED`)
- Entity type and entity ID (linking to the affected record)
- Actor (user ID or "system" for automated actions)
- Full payload (the data at the time of the action)
- SHA-256 hash of the payload
- Previous hash (creating a tamper-evident chain)

You can filter the audit log by entity type, entity ID, actor, action, and date range. The payload hash chain means that any modification to a historical audit record would break the chain and be detectable.

### Agent Monitor: Tracking Executions

The **Agent Monitor** page (Admin → Agent Monitor) shows all agent executions for your organisation, with:

- Agent type and status (PENDING / RUNNING / COMPLETED / FAILED)
- Start time and completion time
- Retry count (agents automatically retry up to 3 times on transient failures)
- Last node completed — for LangGraph agents, this shows the last graph node that succeeded, which is helpful for diagnosing partial failures
- Checkpoint data — agents can resume from their last checkpoint if they are restarted after a failure

When an execution shows "FAILED" after all retries are exhausted, it moves to the Dead Letter queue.

### Dead Letter Queue Management

The **Dead Letter** page shows executions that have exhausted all retry attempts. For each dead letter job, you can see:

- The agent type and execution ID
- The full input data that was submitted
- The error message from the final failed attempt
- The number of attempts made

From this page, you can:
- **Inspect** the input and error to diagnose the root cause
- **Retry** the job (this submits it to the queue again with a fresh execution ID)
- **Dismiss** the job (marks it as acknowledged without reprocessing)

Common causes of dead letter jobs include: malformed input (missing required fields), LLM provider rate limits or outages, and database connectivity issues. For LLM provider errors, the platform implements a circuit breaker: it automatically fails over from Anthropic to Azure OpenAI to OpenAI. If all three providers are unavailable, the execution is dead-lettered.

---

## Module 11: End-to-End Workflow Practice

This module walks you through a complete baseline analysis of a new digital product from scratch. Work through this as a hands-on exercise in your development or staging environment.

**Scenario:** You have just joined a transformation programme for a mid-sized banking institution. Your first task is to baseline the "Home Loan Origination" product — a set of systems that handles application intake, credit assessment, document management, and settlement. You have access to a GitHub repository, a Jira project (key: `HLO`), and a set of architecture documents.

---

### Exercise 1: Populate the Knowledge Base

**Objective:** Upload at least three documents across different categories before running any agent.

Steps:
1. Log in and confirm you are viewing the correct organisation.
2. Navigate to **Context Hub**.
3. Upload the architecture standards document (if provided). Select category: ARCHITECTURE_STANDARDS.
4. Upload the current-state process map. Select category: CURRENT_STATE.
5. If you have an industry benchmark report on mortgage origination cycle times, upload it. Select category: VSM_BENCHMARKS.
6. Wait for all documents to reach "READY" status.
7. Navigate to **RAG Accuracy**. Verify that your newly uploaded documents appear in the document inventory.

**Expected outcome:** Three or more documents in READY status. The RAG Accuracy page confirms they are indexed and ready for retrieval.

---

### Exercise 2: Run Discovery and Review Results

**Objective:** Generate the L1–L3 capability hierarchy for Home Loan Origination.

Steps:
1. Navigate to **Organization Setup** → confirm the business segment "Retail Banking" (or equivalent) exists. If not, add it.
2. Navigate to **Discovery**.
3. Select the Home Loan repository from the dropdown.
4. Select the **Retail Banking** business segment.
5. In Enrichment Inputs, enter the GitHub token for the repository.
6. Enter a domain context: "Home loan origination processing covering application intake, credit decisioning, document management, and settlement. Core borrower journeys: First Home Buyer, Refinance, Top-Up."
7. Enter known products: "Home Loan Origination".
8. Leave pass mode as **Full (Pass 0)**.
9. Click **Run Discovery**. Wait for completion.
10. Review the output. Check that the following L1 product and representative capabilities are present:
    - L1: Home Loan Origination
    - L2 capabilities: Application Intake, Credit Assessment, Document Management, Settlement Processing, Notification Service
    - L3 functionalities under Credit Assessment: Serviceability Calculator, LVR Assessment, Credit Scoring Integration
11. Edit any items with incorrect names or descriptions.
12. Delete any items that are test harnesses, build scripts, or other non-product artefacts the agent may have included.

**Expected outcome:** A well-named, 3-level capability hierarchy with confidence scores mostly above 60%.

---

### Exercise 3: Run Lean VSM and Interpret Findings

**Objective:** Generate a value stream map for the Home Loan Origination product.

Steps:
1. Navigate to **Value Stream / VSM**.
2. Select Home Loan Origination as the target product.
3. If Jira is configured with project key `HLO`, confirm it appears in the integrations list.
4. Click **Run Lean VSM**.
5. When complete, review the flow diagram. Identify:
    - Which steps are classified as bottlenecks (amber)
    - Which steps are classified as waste (red)
    - What the overall flow efficiency is
6. Examine the timing provenance badges for each step. Note which steps are `llm_estimated`.
7. Note any CRITICAL or WARNING hallucination flags in the output.

**Questions to answer after completing this exercise:**
- What is the total lead time for the current state?
- What percentage of steps have `jira_measured` provenance?
- Which single step has the highest wait time?
- What improvement note did the agent generate for the highest-wait-time step?

---

### Exercise 4: Apply Overrides and Re-Run

**Objective:** Improve data quality by overriding LLM-estimated values with known data.

Steps:
1. Identify the two steps with the lowest provenance confidence (both should be `llm_estimated`).
2. From your scenario materials (or your own knowledge), determine more accurate timing values for at least one of these steps.
3. Apply a manual override to that step. Include an override note citing your data source.
4. For the second step, if you have the Jira integration configured, verify that the step name matches a Jira status label. If it does not match, edit the step name to match the Jira status.
5. Re-run the Lean VSM agent for the same product.
6. Compare the new output with the previous run:
    - Did the overridden step retain its `manual_override` value?
    - Did the step whose name you corrected receive `jira_measured` data in the re-run?
    - Did the overall flow efficiency change?

**Expected outcome:** At least one step now shows `manual_override` and at least one shows `jira_measured`. Overall data quality (percentage of steps with high-confidence provenance) should have improved.

---

### Exercise 5: Run Future State Vision and Build an Investment Case

**Objective:** Generate a future-state scenario model and use it to structure an investment case.

Steps:
1. Navigate to **Future State Vision**.
2. Select Home Loan Origination.
3. Set the transformation horizon to 18 months.
4. Enter a focus area: "Eliminate manual document handling; automate credit decisioning for standard applications; reduce settlement processing wait time."
5. Click **Run Future State Vision**.
6. Review the output:
    - Check whether the "Benchmark-grounded" badge appears (it will if you uploaded VSM benchmarks in Exercise 1)
    - Record the expected scenario values for total lead time and flow efficiency
    - Review the step-level improvement phases (now/next/later)
7. Navigate to **Admin → Cost Estimation**. Select the Home Loan Origination product and run the Cost Estimation agent.
8. When complete, record the expected NPV and payback period.

**Investment case summary to prepare:**
Using the outputs from Exercises 2–5, prepare a one-page summary covering:
- Current state: total lead time, flow efficiency, primary bottlenecks
- Future state (expected scenario): projected lead time, flow efficiency
- Improvement: percentage reduction in lead time; percentage improvement in flow efficiency
- Top 3 initiatives by RICE score (from Product Roadmap page)
- Estimated NPV and payback period (from Cost Estimation output)

---

## Knowledge Check Questions

The following 15 questions test your understanding of the platform. Answers follow each question.

---

**Q1. What is the correct order of operations when baselining a new digital product for the first time?**

**A:** Populate the knowledge base (Context Hub) → Run Discovery → Review and correct capability hierarchy → Run Lean VSM → Apply manual overrides → Run Future State Vision. Running VSM before Discovery produces poor results because VSM reads the capability hierarchy that Discovery creates.

---

**Q2. A value stream step shows a flow efficiency of 8% and a timing source of `llm_estimated`. What should you do?**

**A:** Do not treat this number as reliable. `llm_estimated` confidence ranges from 0.50–0.65, meaning the AI inferred this value from context without direct measurement. You should either integrate Jira (to get `jira_measured` data) or apply a manual override based on your own process knowledge. An 8% flow efficiency may be correct or may be wildly wrong — you cannot know without validating the source.

---

**Q3. Which document category should you use for a McKinsey report on lean transformation outcomes in financial services?**

**A:** `TRANSFORMATION_CASE_STUDIES`. This category is surfaced preferentially by the Future State Vision agent (28% budget allocation) and the Market Intelligence agent. Uploading transformation case studies in this category directly improves the quality of scenario projections.

---

**Q4. What does the "Benchmark-grounded" badge on the Future State Vision output indicate?**

**A:** It indicates that the agent retrieved and used documents from the `VSM_BENCHMARKS` category in the Context Hub when generating the scenario projections, rather than relying solely on generic multiplier-based estimates. Benchmark-grounded projections are more defensible for investment cases.

---

**Q5. A user with the ANALYST role cannot see the Audit Log. Why?**

**A:** The Audit Log is in the Admin section of the sidebar, which is only visible to ADMIN and SUPER_ADMIN roles. ANALYSTs can run agents, apply overrides, and view agent outputs, but they cannot access admin functions.

---

**Q6. You apply a manual override to a value stream step timing. The Lean VSM agent is then re-run. What happens to your override?**

**A:** It is preserved. The Lean VSM agent does not overwrite values with `manual_override` provenance. Your value remains, with confidence = 1.00, regardless of what the agent calculates. If you want the agent to re-estimate the step, you must delete the override first.

---

**Q7. What is BM25 reranking and why does TransformHub use it alongside semantic (vector) search?**

**A:** BM25 is a keyword-frequency scoring algorithm. Semantic search finds chunks that are conceptually similar to a query, even if the exact words do not match. BM25 finds chunks where the exact query terms appear frequently. The two approaches are complementary — semantic search catches paraphrases and synonyms; BM25 catches exact terminology matches (e.g., a specific regulatory control number, a process step name that matches exactly). Using both together produces better retrieval results than either alone.

---

**Q8. What is a dead letter job, and what should you do when you find one?**

**A:** A dead letter job is an agent execution that has exhausted all automatic retries (up to 3) without succeeding. You should navigate to Admin → Dead Letter, inspect the error message to diagnose the root cause, and then either retry the job (after fixing the underlying issue) or dismiss it if the run is no longer needed.

---

**Q9. Your organisation's Jira integration is configured, but a value stream step still shows `llm_estimated` provenance. What are the likely causes?**

**A:** The two most likely causes are: (1) the value stream step name does not match any Jira status label, so the agent cannot find corresponding cycle time data; and (2) there are fewer than 10 completed Jira issues in the configured project in the last 90 days, resulting in insufficient data. To fix (1), edit the step name to match the Jira status. To fix (2), consider extending the time window or using a different project key.

---

**Q10. Which agent should you run immediately before submitting a transformation investment proposal to a governance board?**

**A:** The Fiduciary agent. It reviews the investment case for adequacy of evidence, over-optimistic assumptions, and gaps in substantiation. Running it before governance gives you the opportunity to address any issues it identifies before the board meeting.

---

**Q11. What is the `AGENT_OUTPUT` context document category and how does it get populated?**

**A:** `AGENT_OUTPUT` documents are automatically saved by agents when they complete a run. The Discovery, Lean VSM, and Future State Vision agents (among others) save their structured findings as context documents in this category. This means that when a subsequent agent runs, it can retrieve prior analysis from earlier agents via the RAG pipeline, creating a compounding knowledge effect across runs.

---

**Q12. A Discovery run produces 25 digital products for a single repository. This seems too many. What is the most likely cause and the best resolution?**

**A:** The most likely cause is that the repository contains many microservices, each of which the agent has treated as a separate digital product. The best resolution is to use Pass 1 (L1 only) mode, review the 25 candidate products, delete the ones that are infrastructure services or sub-components rather than user-facing products, and then use Pass 2 to add capabilities under the confirmed products.

---

**Q13. How does the circuit breaker in TransformHub work?**

**A:** The circuit breaker provides automatic failover between LLM providers. When the primary provider (Anthropic) fails or returns errors, the system automatically retries with Azure OpenAI, then with OpenAI. If all three providers are unavailable, the execution is dead-lettered. This ensures maximum availability without manual intervention.

---

**Q14. What is the significance of the `triangulation bonus` in the Discovery agent's confidence scoring?**

**A:** When three or more independent evidence sources agree on a capability or product (for example, a capability that appears in both the OpenAPI spec, the GitHub test files, and an uploaded architecture document), the agent awards a triangulation bonus of +0.10 to the confidence score. This reflects the statistical principle that convergent evidence from independent sources is more reliable than evidence from a single source.

---

**Q15. You are an ADMIN and you want to ensure your organisation's agent runs use your company's own Anthropic API key rather than the platform's shared key. How do you configure this?**

**A:** Navigate to Admin → Agent Monitor → Budget Settings for your organisation. Enter your Anthropic API key in the "Per-org API key" field. Once saved, all agent executions for your organisation will use this key. Note that the key is write-only — it cannot be read back after saving. To rotate it, simply enter the new key value and save again.

---

## Quick Reference Card

### Essential Pre-Run Checklist

Before running any agent, confirm:

- [ ] Organisation name and industry type set in Organization Setup
- [ ] Business segments configured (at least one)
- [ ] Regulatory frameworks entered (e.g., APRA CPS 234, PCI-DSS, GDPR)
- [ ] At least one Repository configured
- [ ] Relevant documents uploaded to Context Hub and in READY status
- [ ] For VSM: Discovery has been completed and reviewed

---

### Running the Core Three Agents

| Agent | Page | Key Inputs | Typical Duration | Output Location |
|-------|------|-----------|-----------------|-----------------|
| Discovery | Discovery | Repository, business segment, GitHub token, OpenAPI URLs | 1–3 min | Discovery → View Results |
| Lean VSM | Value Stream / VSM | Product (post-Discovery), Jira project key | 1–4 min | VSM → View VSM |
| Future State Vision | Future State Vision | Product (post-VSM), transformation horizon | 1–3 min | Future State → View Future State |

---

### Timing Provenance at a Glance

| Badge Colour | Source | Confidence | Trustworthiness |
|-------------|--------|------------|-----------------|
| Blue | jira_measured | 0.70–0.95 | High — use in investment cases |
| Green | manual_override | 1.00 | Definitive — human confirmed |
| Yellow | code_signals | 0.60–0.80 | Medium — corroborate before presenting |
| Red | llm_estimated | 0.50–0.65 | Low — validate before use |

---

### Role Permissions Summary

| Action | VIEWER | ANALYST | ADMIN | SUPER_ADMIN |
|--------|--------|---------|-------|-------------|
| View dashboards and outputs | Yes | Yes | Yes | Yes |
| Run agents | No | Yes | Yes | Yes |
| Apply timing overrides | No | Yes | Yes | Yes |
| Manage org settings | No | No | Yes | Yes |
| Invite and manage users | No | No | No | Yes |
| Set LLM budgets | No | No | Yes | Yes |
| View audit log | No | No | Yes | Yes |
| Manage dead letter queue | No | No | Yes | Yes |
| Access all organisations | No | No | No | Yes |

---

### Context Hub Category Quick Reference

| Category | Best For | Key Agents Served |
|----------|---------|-------------------|
| CURRENT_STATE | Architecture diagrams, process maps | Discovery, Lean VSM |
| ARCHITECTURE_STANDARDS | EA principles, API standards, ADRs | Discovery, Risk & Compliance, Architecture |
| VSM_BENCHMARKS | Industry cycle time data, lean benchmarks | Lean VSM, Future State Vision |
| TRANSFORMATION_CASE_STUDIES | Published transformation outcomes | Future State Vision, Market Intelligence |
| REGULATORY | Compliance policies, audit findings | Risk & Compliance, Security, Fiduciary |
| AGENT_OUTPUT | Auto-populated by agents | All agents |
| INTEGRATION | Auto-populated by Jira/Confluence sync | Discovery, Lean VSM |

---

### Troubleshooting Quick Fixes

| Symptom | Quick Fix |
|---------|----------|
| Agent shows FAILED | Check Admin → Agent Monitor for error; check Dead Letter queue; retry once |
| Discovery produces generic capability names | Add GitHub token and domain context; re-run |
| VSM shows all `llm_estimated` | Configure Jira integration; ensure step names match Jira statuses |
| "Benchmark-grounded" badge missing | Upload VSM benchmark PDFs to Context Hub under VSM_BENCHMARKS category |
| Wrong organisation shown after login | Run `localStorage.removeItem("currentOrgId")` in browser console and refresh |
| Business segment not tagging | Select segment dropdown on Discovery page before clicking Run |
| Context Hub document stuck in PROCESSING | Reload page; if still stuck after 5 min, delete and re-upload |
| Approval requests blocking roadmap | Navigate to Admin → Approvals; review and approve or reject pending items |

---

*End of TransformHub Platform Training Guide*

*For support, contact your platform administrator or refer to the platform documentation available via the Documentation Agent in the admin section.*
