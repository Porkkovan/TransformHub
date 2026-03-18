# TransformHub — Complete Demo Guide
## Step-by-Step Walkthrough with Synthetic Data

**Version**: 1.0
**Date**: 2026-03-13
**Audience**: Sales Engineers, Solution Architects, Product Managers
**Duration**: ~45 minutes (full demo) | ~20 minutes (executive walkthrough)

---

## Pre-Flight Checklist

Before starting any demo, verify both services are running:

```
# Terminal 1 — Agent Service (FastAPI)
cd /Users/125066/projects/TransformHub/agent-service
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Next.js Frontend
cd /Users/125066/projects/TransformHub/nextjs-app
npm run dev   # runs on :3000
```

**Health Check:** `curl http://localhost:8000/api/v1/health`
Expected: `{"status":"healthy","database":{"status":"connected"}}`

**3 Demo Organisations Pre-Seeded:**

| Organisation | ID | Segment |
|---|---|---|
| US Bank | `aff924cf` | Retail Banking, Commercial Lending, Wealth Management |
| Telstra Health | `cc4c627f` | Clinical Systems, Health Data Analytics, Telehealth |
| ING Bank | `1dce538c` | Retail Banking, Wholesale Banking, Direct Banking Platform |

---

## PART A — Platform Orientation (5 min)

### Step 1: Open the App & Select Organisation

1. Navigate to `http://localhost:3000`
2. Sign in with demo credentials: `admin@transformhub.io` / `demo1234`
3. The platform defaults to **US Bank** (set via `OrganizationContext`)
4. Confirm the header shows **"US Bank"** with the organisation switcher dropdown

> **Talking Point:** TransformHub is multi-tenant. Each organisation has its own isolated data partition, knowledge base, and agent memory — all enforced via `WHERE organization_id = $org_id` at every DB query.

### Step 2: Dashboard Overview

The Dashboard shows the live transformation state:

| Widget | Synthetic Value | Description |
|---|---|---|
| Products Discovered | 3 | LoanFlow Digital, InstaPay Hub, FraudShield AI |
| Digital Capabilities | 15 | Mapped across all products |
| VSM Steps | 10 | Across the loan origination value stream |
| Agent Memories | 9 | Accumulated learnings from prior runs |
| Audit Events | 12 | SHA-256 chained, tamper-evident |
| Context Documents | 7 | Indexed and embedded for RAG |

> **Talking Point:** This isn't a demo dashboard with hardcoded numbers. Every metric pulls live from PostgreSQL in real time. The 12 audit events chain together with SHA-256 hashes — you can verify tamper-evidence by checking `previous_hash → payload_hash` linkage.

---

## PART B — Organisation Setup (5 min)

### Step 3: Review US Bank Organisation Profile

Navigate to **Settings → Organisation**. The pre-seeded US Bank profile includes:

**Organisation Details (Synthetic Data):**
- **Name:** US Bank
- **Industry:** Banking / Financial Services
- **Headquarters:** Minneapolis, MN
- **Employee Count:** 71,000
- **Annual Revenue:** $23.5B
- **Competitors:** JPMorgan Chase, Wells Fargo, PNC Financial
- **Regulatory Frameworks:** FINRA, SEC, SOX, FDIC, BSA/AML

**Business Segments:**
1. Retail Banking — consumer deposits, mortgages, personal loans
2. Commercial Lending — SME and corporate credit facilities
3. Wealth Management — investment advisory and trust services

**Personas:**

| Role | Type | Key Responsibilities |
|---|---|---|
| Branch Manager | Front Office | Customer relationships, loan origination, revenue |
| Credit Analyst | Middle Office | Risk assessment, portfolio monitoring, compliance |
| Payment Ops Specialist | Back Office | Payment processing, settlement, fraud triage |

> **Talking Point:** Personas drive the agent's understanding of who uses each digital product and what their transformation pain points are. The HITL approval workflow routes to the correct persona type based on agent output.

### Step 4: Add a New Repository (Live Action)

> **OPTIONAL — skip in executive demos**

1. Click **+ Add Repository**
2. Enter: `us-bank-mortgage-platform`
3. Description: `Digital mortgage origination and servicing platform`
4. Connect to: `github.com/usbank/mortgage-platform` (placeholder URL)
5. Click **Save**

The repository becomes the anchor for product and capability discovery.

---

## PART C — Knowledge Base & RAG Setup (7 min)

### Step 5: Upload Context Documents

Navigate to **Knowledge Base** (sidebar).

The US Bank Knowledge Base is pre-loaded with **7 indexed documents**:

| Document | Category | Status |
|---|---|---|
| us-bank-current-state-brd.pdf | CURRENT_STATE | ✅ INDEXED |
| us-bank-process-maps.pdf | CURRENT_STATE | ✅ INDEXED |
| us-bank-vsm-kpi-benchmarks.xlsx | VSM_BENCHMARKS | ✅ INDEXED |
| us-bank-industry-case-studies.pdf | TRANSFORMATION_CASE_STUDIES | ✅ INDEXED |
| us-bank-tech-architecture-standards.pdf | ARCHITECTURE_STANDARDS | ✅ INDEXED |
| us-bank-discovery-agent-output.json | AGENT_OUTPUT | ✅ INDEXED |
| us-bank-vsm-agent-output.json | AGENT_OUTPUT | ✅ INDEXED |

**Demo Action — Upload a new document:**
1. Click **Upload Document**
2. Select category: `VSM_BENCHMARKS`
3. Upload file: `banking-lean-benchmarks-2025.pdf` (synthetic)
4. The system will: chunk → embed → store in pgvector

**Chunk Parameters:**
- Chunk size: 2,000 characters
- Overlap: 400 characters
- Embedding model: `text-embedding-3-small` (1,536 dimensions)

### Step 6: Fetch a URL (Live Feature)

1. Toggle to **URL** tab in the upload panel
2. Enter: `https://www.mckinsey.com/banking-transformation-2025` (placeholder)
3. Click **Fetch & Embed**
4. The API call: `POST /api/context/fetch-url`
5. The URL content is fetched, chunked, embedded, and stored as a AGENT_OUTPUT category document

> **Talking Point:** TransformHub can ingest any public URL — analyst reports, regulatory guidance, competitor case studies, GitHub README files. All content becomes searchable context that agents can retrieve during execution.

### Step 7: Explain the Hybrid RAG Pipeline

**How retrieval works during agent execution:**

```
Agent Trigger
    │
    ├─→ Multi-Query Generation (3–5 queries per agent_type)
    │       "loan origination process inefficiencies"
    │       "retail banking value stream benchmarks"
    │       "digital lending transformation case studies"
    │
    ├─→ Vector Search (pgvector ivfflat, top-25 by cosine similarity)
    │
    ├─→ BM25 Reranking (keyword frequency scoring)
    │
    ├─→ Union + Dedup by hit count
    │
    └─→ Category-Aware Budget Allocation (12k chars max)
            CURRENT_STATE: 3,000 chars
            VSM_BENCHMARKS: 2,500 chars
            AGENT_OUTPUT: 2,500 chars
            TRANSFORMATION_CASE_STUDIES: 2,000 chars
            ARCHITECTURE_STANDARDS: 2,000 chars
```

> **Talking Point:** Unlike naive RAG (single vector query), TransformHub uses multi-query fusion with BM25 reranking. This means the lean VSM agent doesn't just get semantically similar chunks — it gets the most relevant AND most keyword-relevant content, deduplicated and budget-allocated by document type.

---

## PART D — Agent Execution Walkthrough (20 min)

### Step 8: Discovery Agent — Map the Landscape

Navigate to **Discovery** in the sidebar.

**Pre-conditions:**
- Organisation: US Bank selected
- Business Segment: `Retail Banking` (select from dropdown — CRITICAL)

**Click "Run Discovery Agent"**

**What happens under the hood:**
1. `POST /api/agents/execute` with `{agent_type: "discovery", organization_id: "...", input_data: {businessSegment: "Retail Banking"}}`
2. LangGraph state machine initialises with 6 nodes: `load_context → fetch_products → analyse_capabilities → map_functionalities → persist_results → write_audit`
3. BM25 + vector RAG injects context from CURRENT_STATE and AGENT_OUTPUT documents
4. Agent memory from prior runs is injected: `product_patterns` and `source_quality_map`
5. GPT-4o generates structured discovery output
6. Results persisted to `digital_products`, `digital_capabilities`, `functionalities`

**Expected Output (Synthetic — Retail Banking):**

| Product | Type | Capabilities |
|---|---|---|
| LoanFlow Digital | Lending Platform | AI Underwriting, Digital Application Portal, Loan Disbursement, Customer Onboarding, Credit Risk Analytics, Document Management, Compliance Engine, Rate Engine, Loan Servicing |
| MortgageConnect | Mortgage Platform | Property Valuation Engine, Title Search Integration, Escrow Management, HMDA Reporting |
| SmartSaver | Savings & Deposits | High-Yield Account Engine, Auto-Savings Rules, Certificate of Deposit Manager |

**Audit Event Written:**
```json
{
  "action": "DISCOVERY_COMPLETED",
  "entity_type": "Repository",
  "actor": "discovery-agent",
  "payload": {"productsDiscovered": 3, "capabilitiesMapped": 16, "functionalitiesIdentified": 48},
  "payload_hash": "sha256:...",
  "previous_hash": "sha256:..."
}
```

> **Talking Point:** Every agent action is written to an immutable, SHA-256 chained audit log. If anyone modifies a past record, the hash chain breaks — providing tamper evidence at the database level, not just the application level.

### Step 9: Lean VSM Agent — Identify Waste

Navigate to **VSM** in the sidebar.

**Pre-conditions:**
- Discovery must be complete (products and capabilities exist)
- Select product: `LoanFlow Digital`

**Click "Run Lean VSM Agent"**

**Current VSM State (Live in DB — 10 steps):**

| Step | Waste Type | Bottleneck |
|---|---|---|
| Application Entry | Over-processing | Manual data re-entry |
| Credit Bureau Pull | Wait time | 3rd-party API latency (avg 4.2s) |
| Risk Assessment | Defects | Manual override rate 23% |
| Document Verification | Wait time | Human queue avg 2.1 days |
| Underwriting Queue | Overproduction | 40% of files reworked |
| Final Approval | Wait time | Committee meeting cadence |
| Loan Disbursement | Motion waste | 7-system handoff |
| Payment Initiation | Over-processing | Duplicate ACH validation |
| Fraud Screening | Wait time | Rules engine latency |
| AML/BSA Check | Defects | 12% false positive rate |

**Key VSM Metrics:**
- Total Lead Time: **18.3 days** (industry benchmark: 5.2 days)
- Total Process Time: **6.2 hours** (value-add only)
- Process Cycle Efficiency (PCE): **1.6%** (benchmark: 34%)
- Top Bottleneck: Document Verification (2.1-day queue)

**Mermaid VSM Diagram** is auto-generated and stored in `vsm_metrics.mermaid_source`.

> **Talking Point:** The 1.6% PCE means US Bank spends 98.4% of loan processing time on non-value-adding wait and waste. The industry best-in-class is 34% PCE. The VSM agent not only identifies this but quantifies the waste categories so the prioritisation agent can rank improvements by impact.

### Step 10: Future State Vision Agent — Benchmark-Grounded

Navigate to **Future State** in the sidebar.

**Click "Run Future State Vision Agent"**

**This agent uses uploaded VSM_BENCHMARKS and TRANSFORMATION_CASE_STUDIES documents** (the "🎯 Benchmark-grounded" badge appears on results).

**Projected Metrics (3 Scenarios):**

| Metric | Conservative | Expected | Optimistic |
|---|---|---|---|
| Lead Time | 8.1 days | 5.8 days | 3.9 days |
| PCE | 18% | 28% | 38% |
| Straight-Through Processing | 52% | 68% | 81% |
| False Positive Rate | 7% | 4.5% | 2.1% |
| Cost Per Loan | $1,240 | $890 | $620 |
| Customer NPS | +12 | +22 | +34 |

**3 Transformation Phases:**

**Phase 1 — Foundation (Q1–Q2 2026):**
- Implement AI-powered document OCR and classification
- Deploy real-time credit bureau API with sub-500ms SLA
- Eliminate manual data re-entry via structured intake forms
- Expected PCE improvement: 1.6% → 12%

**Phase 2 — Automation (Q3 2026 – Q1 2027):**
- ML-based underwriting with explainable AI decisions
- Automated fraud screening with adaptive thresholds
- Parallel processing of AML/BSA checks
- Expected PCE improvement: 12% → 24%

**Phase 3 — Intelligence (Q2 2027+):**
- Predictive loan pricing based on real-time market signals
- Customer lifetime value optimisation engine
- Regulatory change monitoring with auto-alert
- Expected PCE improvement: 24% → 34%

> **Talking Point:** The "Benchmark-grounded" badge means these projections are derived from the VSM benchmarks document you uploaded — not from generic LLM hallucination. When the VSM_BENCHMARKS category document is present, the agent grounds its projections in real industry data.

### Step 11: HITL Gate — Human-in-the-Loop Approval

After Future State Vision completes, the agent reaches a **HITL checkpoint**:

1. The LangGraph state machine hits an `INTERRUPT` node
2. State is checkpointed to PostgreSQL `agent_checkpoints` table
3. An approval request appears in **Approvals** (notification badge on sidebar)

**Approval Request Card (Synthetic):**
```
Agent: Future State Vision
Organisation: US Bank
Status: PENDING_REVIEW

Summary: 3-phase transformation roadmap projected to improve PCE from
1.6% → 34% and reduce lead time from 18.3 → 5.8 days (expected scenario).

Human Gate Type: SENIOR_ANALYST
Deadline: 2026-03-14 17:00

[Approve with Notes]  [Reject with Reason]
```

**Demo Action:**
1. Click **Review**
2. Read the projected metrics summary
3. Add approval note: `"Validated against Q4 2025 benchmarks. Phase 1 timeline approved. Phase 2 pending budget sign-off."`
4. Click **Approve**
5. The LangGraph graph resumes from checkpoint — Future State persisted

> **Talking Point:** This is a real LangGraph INTERRUPT pattern — not a mock. The agent state is frozen to disk, and resumes execution only after the human provides a signal. Rejections are stored as `agent_memories` so the agent learns from them in future runs.

### Step 12: Risk & Compliance Agent

Navigate to **Risk** in the sidebar.

**Click "Run Risk & Compliance Agent"**

**Live Risk Register (from DB):**

| Category | Severity | Risk Description |
|---|---|---|
| REGULATORY | CRITICAL | BSA/AML compliance gaps in automated lending decisions |
| TECHNOLOGY | HIGH | Real-time payment system migration risks |
| OPERATIONAL | MEDIUM | ML model drift increasing false positive rates |
| DATA_PRIVACY | LOW | Transaction data anonymisation for ML training |

**Compliance Framework Mapping (Synthetic):**

| Framework | Applicable Capabilities | Gap Count | Risk Level |
|---|---|---|---|
| BSA/AML | Payment Routing, AML Compliance | 3 | CRITICAL |
| FINRA | AI Underwriting, Rate Engine | 2 | HIGH |
| SOX | Credit Risk Analytics, Audit Trail | 1 | MEDIUM |
| FDIC | Customer Onboarding, Loan Servicing | 0 | LOW |
| SEC | Wealth Management APIs | 2 | MEDIUM |

> **Talking Point:** The Risk agent doesn't just list regulatory frameworks — it maps each framework to specific digital capabilities and identifies which capabilities have compliance gaps. This becomes the input for the initiative prioritisation agent.

### Step 13: Transformation Roadmap Agent — RICE Scoring

Navigate to **Roadmap** in the sidebar.

**Live Roadmap Items (from DB — US Bank):**

| Initiative | RICE Score | Quarter | Status |
|---|---|---|---|
| Digital Application Portal | 6.0 | Q2 2026 | planned |
| Income Verification Automation | 5.6 | Q3 2026 | completed |
| Credit Scoring Engine Upgrade | 5.4 | Q2 2026 | in_progress |
| AI Underwriting | 5.0 | Q1 2026 | planned |
| Form Builder Overhaul | 5.4 | Q3 2026 | deferred |
| Data Validation Pipeline | 5.6 | Q4 2026 | planned |

**RICE Formula:**
`RICE Score = (Reach × Impact × Confidence) / Effort`

**Approve a Roadmap Item (Live Action):**
1. Click on **Digital Application Portal**
2. Review the initiative detail (reach: 12k users/month, impact: HIGH, confidence: 90%, effort: 2 months)
3. Click **Approve Initiative**
4. The `approval_status` field updates to `approved`
5. An audit log event is written

> **Talking Point:** Roadmap items are auto-generated by the Initiative Prioritisation agent using RICE scoring. The human approval workflow connects to the LangGraph HITL gate. Approved initiatives flow directly into the sprint planning view.

---

## PART E — Advanced Features (8 min)

### Step 14: Agent Memory — Learning Over Time

Navigate to **Settings → Agent Memory** or demonstrate via API:

```bash
curl http://localhost:8000/api/v1/agents/status/{execution_id}
```

**Active US Bank Agent Memories (9 learnings):**

| Agent | Memory Key | What Was Learned |
|---|---|---|
| discovery | product_patterns | US Bank products follow monolithic Java + Oracle stack patterns |
| discovery | source_quality_map | GitHub repos have higher code signal than Confluence docs |
| lean_vsm | flow_efficiency_benchmarks | US banking PCE baseline: 8–12% (pre-transformation) |
| lean_vsm | bottleneck_patterns | Document verification is the #1 bottleneck in 3 of 3 products |
| risk_compliance | framework_requirements | BSA/AML always CRITICAL for US payment processors |
| risk_compliance | severity_thresholds | US Bank uses conservative risk thresholds vs industry average |
| future_state_vision | automation_benchmarks | ML underwriting reduces manual review by 67% in peer banks |
| product_transformation | transformation_patterns | Retail banking products benefit from API-first modernisation |
| architecture | stack_preferences | US Bank architecture committee prefers AWS + Kubernetes |

> **Talking Point:** Agent memory is persistent. If a human reviewer rejects a recommendation with a reason, that reason becomes a memory that shapes all future runs for that organisation. The system gets smarter with every interaction — without retraining the underlying LLM.

### Step 15: Accuracy Scoring — Quantified Quality

Navigate to **Accuracy** in the sidebar.

**Composite Accuracy Formula:**
```
score = (confidence × 0.4)
      + (source_diversity × 0.2)
      + (run_success_rate × 0.3)
      + ((1 − human_edit_rate) × 0.1)
```

**Synthetic Accuracy Scores by Module (US Bank Run):**

| Module | Confidence | Source Diversity | Run Success | Human Edit Rate | Composite |
|---|---|---|---|---|---|
| Discovery | 0.91 | 0.85 | 1.00 | 0.08 | 0.893 |
| Lean VSM | 0.88 | 0.90 | 1.00 | 0.11 | 0.881 |
| Future State | 0.86 | 0.92 | 1.00 | 0.15 | 0.869 |
| Risk & Compliance | 0.93 | 0.78 | 1.00 | 0.06 | 0.896 |
| Product Transformation | 0.84 | 0.88 | 1.00 | 0.18 | 0.856 |
| Architecture | 0.89 | 0.83 | 1.00 | 0.10 | 0.878 |
| Roadmap | 0.87 | 0.86 | 1.00 | 0.12 | 0.872 |
| Executive Report | 0.92 | 0.91 | 1.00 | 0.05 | 0.905 |
| **Portfolio Average** | | | | | **0.881** |

> **Talking Point:** The 60-second TTL cache means accuracy scores refresh automatically as new agent runs complete. The human edit rate component is self-correcting: if humans frequently edit an agent's output, the accuracy score drops, signalling that either the agent needs more context documents or the prompts need refinement.

### Step 16: SHA-256 Audit Trail

Navigate to **Audit Log** in the sidebar.

**Live Audit Events (12 entries, SHA-256 chained):**

| # | Action | Actor | Timestamp |
|---|---|---|---|
| 12 | DISCOVERY_COMPLETED | discovery-agent | 2026-03-13 11:18 |
| 11 | TRANSFORMATION_PLANNED | product-transformation-agent | 2026-03-09 02:44 |
| 10 | COMPLIANCE_MAPPED | risk-compliance-agent | 2026-03-09 02:44 |
| 9 | RISK_ASSESSED | risk-compliance-agent | 2026-03-09 02:44 |
| 8 | VSM_COMPLETED | lean-vsm-agent | 2026-03-09 02:44 |
| ... | ... | ... | ... |

**Verify Hash Chain Integrity:**
```bash
curl http://localhost:3000/api/audit-log?organizationId=aff924cf...
```

Each entry's `payload_hash` becomes the next entry's `previous_hash` — creating an unbreakable chain. Any record tampering invalidates all subsequent hashes.

> **Talking Point:** This isn't just a log — it's evidence. For regulatory audits (SOX, FDIC), you can prove that no transformation recommendation was altered after it was generated. The hash chain provides cryptographic proof of data integrity.

---

## PART F — Executive Report & Export (5 min)

### Step 17: Generate Executive Report

Navigate to **Executive Report** in the sidebar.

**Click "Generate Executive Report"**

The Executive Reporting agent synthesises output from all prior agents:

**Report Sections:**
1. **Executive Summary** — 3-paragraph C-suite narrative
2. **Transformation Maturity Score** — 2.1/5.0 (current) → 4.2/5.0 (target)
3. **Top 3 Strategic Priorities** — ranked by business impact
4. **Investment Required** — $14.2M over 18 months
5. **Expected ROI** — 287% over 3 years, payback period 14 months
6. **Risk Landscape** — 4 risks, 1 CRITICAL requiring board attention
7. **Recommended Next Steps** — 90-day action plan

### Step 18: Export Options

| Format | Button | Output |
|---|---|---|
| PDF | Export → PDF | Executive report, formatted |
| CSV | Export → CSV | Raw data: products, capabilities, risks |
| Word | Export → Discovery | Capability map in .docx |
| Roadmap Export | Export → Roadmap | RICE-scored initiative table |
| Workbench | Export → Workbench | Full platform state snapshot |

---

## PART G — ING Bank Demo Variant (Alternative Org)

Switch organisation to **ING Bank** to show a different industry context:

| Attribute | ING Bank |
|---|---|
| Industry | Banking (European, PSD2/MiFID II) |
| Segments | Retail Banking, Wholesale Banking, Direct Banking Platform |
| Regulatory | PSD2, MiFID II, GDPR, EBA, DORA, Basel III |
| Agent Focus | Open banking APIs, pan-European compliance mapping |

> **Talking Point:** The same 18 agents run against ING Bank data but produce fundamentally different outputs — because the regulatory frameworks, competitive context, and transformation benchmarks are different. The platform adapts its analysis to each organisation's context, not just its data.

---

## PART H — Telstra Health Demo Variant

Switch organisation to **Telstra Health** for a healthcare context:

| Attribute | Telstra Health |
|---|---|
| Industry | Healthcare Technology |
| Segments | Clinical Systems, Health Data Analytics, Telehealth |
| Regulatory | HIPAA, HL7 FHIR, Australian Privacy Act, My Health Records Act |
| Agent Focus | Clinical workflow efficiency, interoperability, care quality |

> **Talking Point:** The Risk & Compliance agent automatically surfaces HIPAA PHI handling risks for Telstra Health — the same risk that scored CRITICAL in the database. Cross-industry use cases demonstrate platform versatility without configuration changes.

---

## E2E Live System Health Check

### Verified Status (as of 2026-03-13)

| Component | Status | Notes |
|---|---|---|
| FastAPI Agent Service (:8000) | ✅ Healthy | DB latency: 217ms |
| Next.js Frontend (:3000) | ✅ Running | Auth redirect working |
| PostgreSQL Database | ✅ Connected | 25 tables, all populated |
| Discovery Agent | ✅ COMPLETED | Live test run successful (exec: 99f66cf6) |
| Agent Memories | ✅ 9 learnings | Across 6 agents for US Bank |
| Context Documents | ✅ 7 indexed | All categories represented |
| Audit Trail | ✅ 12 events | SHA-256 chain intact |
| Risk Assessments | ✅ 4 active | CRITICAL, HIGH, MEDIUM, LOW |
| Roadmap Items | ✅ 6 items | RICE-scored, quarterly planned |
| VSM Steps | ✅ 10 steps | Full loan origination stream |
| Redis Cache | ⚠️ Unavailable | In-memory fallback active (non-critical) |
| Accuracy Scores Table | ⚠️ Not seeded | Feature functional, DB table needs seed |

### Known Limitations

1. **Redis unavailable** — accuracy score TTL cache uses in-memory fallback. No functional impact for demos; relevant for multi-instance production deployments.
2. **accuracy_scores table** — the DB table exists conceptually but was not included in the Prisma migration. Accuracy scoring still works via in-memory computation; persistence requires migration `add_accuracy_scores_table`.
3. **org/repositories route** — Next.js has no `/api/organizations/{id}/repositories` route; the frontend uses `/api/repositories?organizationId=` instead (works correctly).

---

## Demo Tips & Common Questions

### Q: "How does it handle sensitive data?"
> All queries are organisation-scoped. The `WHERE organization_id = $org_id` constraint is enforced at the Prisma ORM layer and re-validated at the FastAPI agent service. No cross-org data leakage is possible.

### Q: "Can we connect to our real GitHub/Jira?"
> Yes — the External Integrations screen supports GitHub, Jira, Confluence, and ServiceNow. The `external_integrations` table stores OAuth tokens with encrypted credential storage. The integration sync agent (`POST /api/integrations/{id}/sync`) pulls live data.

### Q: "Is the AI output deterministic?"
> Agent outputs are reproducible within a session due to `temperature=0` on critical extraction nodes. Future runs may differ as the agent memory evolves — this is by design; the system learns and improves.

### Q: "How long does a full pipeline run take?"
> Discovery: 45–90 seconds | VSM: 30–60 seconds | Future State: 60–120 seconds | Risk: 30–45 seconds | Full pipeline: 4–8 minutes

### Q: "What LLM is used?"
> OpenAI GPT-4o by default. The agent service is LLM-agnostic — switching to Claude, Gemini, or a self-hosted model requires only a config change in `app/core/config.py`.

---

## Appendix A — Synthetic Data Reference

### US Bank Product Catalog

**LoanFlow Digital (Retail Banking)**

| Capability | Functionality Count | Technology |
|---|---|---|
| AI Underwriting | 6 | Python ML, scikit-learn, XGBoost |
| Digital Application Portal | 5 | React, Next.js, REST APIs |
| Loan Disbursement | 4 | Java Spring Boot, Oracle |
| Customer Onboarding | 7 | Python, KYC APIs, Twilio |
| Credit Risk Analytics | 8 | Python, Apache Spark, Delta Lake |
| Document Management | 5 | AWS S3, Textract OCR |
| Compliance Engine | 6 | Java, Drools rules engine |
| Rate Engine | 4 | C#, .NET, SQL Server |
| Loan Servicing | 5 | Oracle FLEXCUBE, Java |

**InstaPay Hub (Commercial Lending)**

| Capability | Functionality Count | Technology |
|---|---|---|
| Payment Routing | 5 | Java, Kafka, ISO 20022 |
| Fraud Screening | 7 | Python ML, TensorFlow |
| AML Compliance | 6 | Java, NICE Actimize |
| Real-Time Settlement | 4 | C++, FIX protocol |
| Payment Orchestration | 5 | Node.js, RabbitMQ |
| Merchant Gateway | 3 | REST, Stripe integration |

**FraudShield AI (Wealth Management)**

| Capability | Functionality Count | Technology |
|---|---|---|
| Behavioural Analytics | 8 | Python, PyTorch |
| Transaction Monitoring | 6 | Flink, Kafka Streams |
| Case Management | 5 | Java, Salesforce integration |

### VSM Baseline Metrics (LoanFlow Digital)

| Step | Process Time | Lead Time | Waste Category |
|---|---|---|---|
| Application Entry | 12 min | 45 min | Over-processing |
| Credit Bureau Pull | 4 min | 3.2 hrs | Wait (API latency) |
| Risk Assessment | 2.5 hrs | 1.8 days | Defects (rework) |
| Document Verification | 1.5 hrs | 2.1 days | Wait (human queue) |
| Underwriting Queue | 3 hrs | 4.2 days | Overproduction |
| Final Approval | 1 hr | 3.5 days | Wait (committee) |
| Loan Disbursement | 45 min | 1.2 days | Motion (7 systems) |
| Payment Initiation | 8 min | 2 hrs | Over-processing |
| Fraud Screening | 3 min | 45 min | Wait (rules latency) |
| AML/BSA Check | 6 min | 4 hrs | Defects (false pos) |
| **TOTAL** | **6.2 hrs** | **18.3 days** | |

---

## Appendix B — API Quick Reference

### Agent Execution
```bash
# Execute an agent
POST http://localhost:8000/api/v1/agents/execute
{
  "agent_type": "discovery|lean_vsm|future_state_vision|risk_compliance|...",
  "organization_id": "aff924cf-9d2a-4602-b32e-c21104139b3a",
  "input_data": {"businessSegment": "Retail Banking"}
}

# Poll status
GET http://localhost:8000/api/v1/agents/status/{execution_id}

# Get results
GET http://localhost:8000/api/v1/agents/results/{execution_id}

# Stream progress (SSE)
GET http://localhost:8000/api/v1/agents/stream/{execution_id}
```

### HITL Approvals
```bash
# List pending approvals
GET http://localhost:3000/api/approvals?status=PENDING

# Approve
POST http://localhost:3000/api/approvals/{id}/approve
{"notes": "Approved after peer review"}

# Reject
POST http://localhost:3000/api/approvals/{id}/reject
{"reason": "Metrics not aligned with Q1 targets", "improvement_notes": "..."}
```

### Context Documents
```bash
# Upload file
POST http://localhost:3000/api/context/upload
Content-Type: multipart/form-data
{file, organizationId, category}

# Fetch URL
POST http://localhost:3000/api/context/fetch-url
{"url": "https://...", "organizationId": "...", "category": "VSM_BENCHMARKS"}

# Semantic search
POST http://localhost:3000/api/context/search
{"query": "loan origination benchmarks", "organizationId": "...", "limit": 10}
```

### Agent Types Reference
| Agent Type | Key | Purpose |
|---|---|---|
| Discovery | `discovery` | Map products, capabilities, functionalities |
| Lean VSM | `lean_vsm` | Value stream mapping + waste identification |
| Future State Vision | `future_state_vision` | Benchmark-grounded transformation roadmap |
| Risk & Compliance | `risk_compliance` | Risk scoring + regulatory framework mapping |
| Product Transformation | `product_transformation` | Modernisation strategy per product |
| Architecture | `architecture` | Tech stack recommendations |
| Executive Reporting | `executive_report` | C-suite summary generation |
