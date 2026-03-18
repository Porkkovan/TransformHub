# National Pacific Bank: Transforming 42 Digital Products in 3 Weeks
## TransformHub Case Study — Retail & Commercial Banking

---

## Executive Summary

**Client:** National Pacific Bank (NPB) — a top-15 Australian retail and commercial bank with $184B AUM, 6.2M customers, and 8,400 employees across 47 branches.

**Challenge:** NPB's Digital Transformation Office (DTO) needed a defensible, data-grounded baseline across 42 digital products to justify a $38M three-year automation investment to the board. Manual VSM workshops had already consumed $1.6M and 6 months, producing inconsistent, rapidly-outdated outputs.

**Approach:** NPB deployed TransformHub across their entire digital product portfolio, connecting it to their Atlassian Jira instance (18,000+ epics, 94,000 tickets), uploading 340+ architecture and benchmark documents, and running 18 AI agents across all business segments.

**Results:**
- **Full portfolio baseline in 17 days** (vs 26+ weeks estimated for manual completion)
- **61 critical bottlenecks identified** across 42 products — 14 previously undetected
- **Flow efficiency baseline:** 18.3% portfolio average (vs industry p50 of 23.4% for banking)
- **Investment reallocation:** $8.4M shifted from low-ROI initiatives to three high-impact bottleneck interventions
- **Board pack produced** with audit-trailed, benchmark-grounded analysis — approved in first review

---

## Client Background

National Pacific Bank operates across four business segments: Consumer Banking, SME Lending, Wealth Management, and Corporate Treasury. Their digital estate spans:

- **42 digital products** ranging from a 12-year-old core banking platform to recently-launched mobile investment apps
- **7 product engineering tribes** totalling ~380 engineers
- **3 data centres** plus AWS Sydney and Azure East Australia hybrid cloud
- **Primary tooling:** Atlassian Jira (agile delivery), Confluence (documentation), ServiceNow (ITSM), Salesforce (CRM)

NPB had been on a formal digital transformation journey since 2021. By late 2024, the DTO had successfully modernised 8 of their 42 products through a combination of rewrites and API wrapping. The remaining 34 products — representing 73% of customer touchpoints — still ran on legacy architectures with manual-intensive processes.

### The Strategic Context

The NPB board approved a Digital Acceleration Programme in Q3 2024 with $38M earmarked over three years for automation and AI-native capability uplift. The programme's success depended on credible prioritisation: which of the 34 remaining products would yield the highest ROI from automation investment?

The DTO's Head of Platform Strategy, Sarah Chen, described the problem:

> *"We had gut instinct from our architects, contradicted by competing gut instinct from our product managers. We needed numbers. Real numbers. Not consultant estimates dressed up as data."*

---

## The Challenge

### Pain Point 1: Manual VSM Workshops Taking 6–8 Weeks Per Product

NPB's standard approach to value stream mapping required assembling 6–10 subject matter experts per product group for a series of facilitated workshops. Each workshop cycle took 3–4 weeks plus 2–4 weeks of documentation and analysis.

At this rate, completing baselines for the 34 remaining products would take **42–68 weeks and cost an estimated $2.8M** in internal and external consultant time — before any transformation work began.

Three workshops completed in H1 2024 produced outputs of varying quality. The Consumer Digital workshop was rigorous; the Treasury workshop was superficial due to SME availability; the SME Lending workshop was abandoned halfway due to scope disagreement.

**Quantified impact:** $2.8M estimated cost, 42–68 weeks to completion, 0% of portfolio baselined after 6 months.

### Pain Point 2: Inconsistent Capability Discovery Across 42 Products

NPB's 42 digital products had been documented by 12 different architects over 10 years using 4 different taxonomy frameworks. Their Confluence space contained 2,340 architecture pages with no consistent capability hierarchy.

When the DTO attempted to build a unified L1–L3 capability map, they found:
- The same capability referred to by 7 different names across documents
- 23 functionalities documented in Confluence that no longer existed in production
- 31 production functionalities with no documentation at all
- No consistent distinction between L1 capabilities, L2 sub-capabilities, and L3 functionalities

Without a consistent baseline, investment prioritisation was impossible. Budget holders were arguing from incompatible capability models.

**Quantified impact:** 6 weeks of internal effort wasted on taxonomy reconciliation; programme governance stalled waiting for a unified model.

### Pain Point 3: No Data-Driven Basis for $38M Investment Prioritisation

The DTO's shortlist of automation investment candidates was built on a combination of:
- Architecture review board opinions
- NPS complaints from front-line bankers about slow processes
- A 2021 Gartner benchmarking report that pre-dated their current architecture

The absence of quantified bottleneck data meant that the three largest proposed investment items — a payment processing automation ($12M), a KYC workflow rebuild ($9M), and a document processing AI layer ($7M) — were ranked based on executive advocacy rather than flow impact evidence.

The risk: $28M committed to initiatives that might not address the actual flow efficiency constraints.

---

## The Approach

### Platform Configuration (Days 1–3)

NPB's cloud infrastructure team provisioned TransformHub on their Azure Kubernetes Service cluster using the provided K8s manifests. Single sign-on was configured via Azure Entra ID with domain provisioning — all `@npb.com.au` users automatically onboarded to the NPB tenant.

RBAC was configured across three roles:
- **SUPER_ADMIN**: 2 DTO architects (full platform access)
- **ANALYST**: 12 product engineering leads (run agents, review outputs, apply overrides)
- **VIEWER**: 45 business stakeholders (read-only access to dashboards)

Row-Level Security ensured segment-level isolation — Consumer Banking analysts could not access Wealth Management product data.

### Knowledge Base Population (Days 1–4, parallel)

NPB uploaded 340 documents across 8 categories:

| Category | Documents | Examples |
|----------|-----------|---------|
| ARCHITECTURE_STANDARDS | 47 | Enterprise architecture patterns, API gateway standards |
| CURRENT_STATE | 112 | System architecture docs, integration maps, runbooks |
| VSM_BENCHMARKS | 28 | Industry lean benchmarks, APRA process timing studies |
| TRANSFORMATION_CASE_STUDIES | 19 | ANZ Banking cloud transformation, ING Direct re-platform |
| FUTURE_STATE | 34 | Target architecture blueprints, 2027 capability roadmap |
| TECH_TREND | 18 | AI automation research, RPA implementation guides |
| COMPETITOR | 11 | Public disclosure analysis of CBA, Westpac digital capabilities |
| AGENT_OUTPUT | (auto-populated) | Prior agent outputs fed back as context |

All 340 documents were auto-chunked into 2,847 semantic chunks and embedded into the HNSW vector index. The multi-query RAG pipeline ensured each agent execution retrieved the 25 most relevant chunks from this institutional knowledge — grounding every AI analysis in NPB's own documentation.

### Jira Integration (Day 2)

NPB's Jira instance was connected via the ExternalIntegration API. Four project keys were configured: `CONDIG` (Consumer Digital), `SMELEND` (SME Lending), `WEALTH` (Wealth Management), `CORP` (Corporate).

The Tier 3a cycle time extraction job ran across all four projects, processing:
- 18,437 Jira issues (Epics, Stories, Tasks)
- 94,000+ changelog events
- 11,200 status transitions with timestamp data

The extraction computed per-status dwell times and mapped them to process/wait time hours using the configured status taxonomy:
- `In Progress`, `In Development`, `Active` → process_time
- `Blocked`, `Waiting for Review`, `On Hold` → wait_time

**Result:** 2,847 value stream steps updated with `jira_measured` timing data (confidence 0.72–0.94 based on changelog depth).

---

## Phase 1: Discovery & Baseline (Days 3–9)

### Running the Discovery Agent

The Discovery agent was run across all four business segments over 3 days, with analysts selecting the appropriate business segment before each run.

Each run took 8–14 minutes and produced a complete L1–L3 capability hierarchy for the segment.

**Aggregate discovery results across 42 products:**

| Metric | Count |
|--------|-------|
| Digital products discovered | 42 |
| L1 digital capabilities | 187 |
| L2 sub-capabilities | 641 |
| L3 functionalities | 2,847 |
| Product groups identified | 94 |
| Value stream steps created | 1,204 |

Critically, the Discovery agent identified **31 functionalities present in production code with no existing documentation** and flagged **23 Confluence-documented functionalities as inactive** — resolving the taxonomy conflict that had blocked the DTO for 6 weeks.

### Capability Taxonomy Reconciliation

The AI-generated capability hierarchy used consistent naming across all 42 products. Where prior documentation used 7 names for the same concept (e.g., "Customer Identity Verification", "KYC Check", "Identity Validation Service", "CIV Module", "KYC/AML Verification", "Customer Verification", "Onboarding Identity Check"), the agent consolidated to a single canonical name with all aliases recorded.

Analysts reviewed and accepted 94% of suggestions. The remaining 6% were manually corrected using the timing override interface, with correction notes recorded in the audit trail.

---

## Phase 2: VSM Analysis with Code Signals & Jira Integration (Days 7–13)

### Running Lean VSM Across the Portfolio

Lean VSM agent runs were completed for all 42 products. Each run integrated three evidence sources:

1. **Jira cycle times** (pre-computed in Phase 1 setup)
2. **Code signals** extracted from uploaded architecture documents (timeout constants, SLA annotations, `@Scheduled` cron expressions, OpenAPI `x-sla-ms` annotations)
3. **Benchmark documents** from the knowledge base (VSM_BENCHMARKS category)

### Key VSM Findings

**Portfolio flow efficiency distribution:**

| Segment | Avg Flow Efficiency | Industry p50 | Gap |
|---------|--------------------|-----------|----|
| Consumer Digital | 21.4% | 23.4% | -2.0pp |
| SME Lending | 14.7% | 23.4% | -8.7pp |
| Wealth Management | 16.9% | 19.1% | -2.2pp |
| Corporate Treasury | 22.1% | 21.8% | +0.3pp |
| **Portfolio Average** | **18.3%** | **23.4%** | **-5.1pp** |

**Timing provenance breakdown across 1,204 value stream steps:**

| Timing Source | Steps | % of Total |
|--------------|-------|-----------|
| jira_measured | 847 | 70.3% |
| code_signals | 218 | 18.1% |
| llm_estimated | 121 | 10.1% |
| manual_override | 18 | 1.5% |

**Critical bottlenecks identified (flow_efficiency < 10%):**

61 steps across 23 products had flow efficiency below 10%, indicating severe wait-time accumulation. Of these:
- **14 were previously unknown** — not on any prior transformation radar
- **22 were known but underestimated** — manual assessments had underestimated wait times by an average of 340%
- **25 were known and consistent** with prior manual assessments

The three most severe bottlenecks:

| Step | Product | Process Time | Wait Time | Flow Efficiency | Prior Status |
|------|---------|-------------|-----------|----------------|-------------|
| SME Loan Document Collection | SME Lending Platform | 2.4h | 94.7h | 2.5% | Unknown |
| Wealth Adviser Approval Queue | Wealth Portal | 1.1h | 52.3h | 2.1% | Underestimated |
| KYC Manual Review Escalation | Customer Onboarding | 3.2h | 41.8h | 7.1% | Known |

The SME Loan Document Collection bottleneck — a 94.7-hour average wait time for customers to return document sets — had never appeared in any prior VSM exercise. The Jira data revealed it clearly: 847 SME loan applications showed a median 4.2-day customer document return gap, entirely unmeasured in prior manual workshops.

### Hallucination Detection in Action

The P4 hallucination detector flagged 23 steps during VSM analysis:
- 8 `critical` flags (lead_time < process_time + wait_time inconsistencies from LLM estimation)
- 12 `warning` flags (suspiciously round numbers — 8.0h, 16.0h, 24.0h)
- 3 `info` flags (placeholder-style step names)

Analysts resolved all 8 critical flags by applying manual overrides with Jira-sourced data. The net effect: zero impossible values persisted to the final baseline.

---

## Phase 3: Future State Vision & Roadmap (Days 12–17)

### AI-Native Future State Generation

The Future State Vision agent ran across all four segments, grounded by:
- 19 uploaded transformation case studies (banking, fintech)
- 28 VSM benchmark documents
- The just-completed current-state VSM data (auto-saved as AGENT_OUTPUT context)

For each capability, the agent projected three scenarios:

**Example: SME Lending Platform — Loan Processing Capability**

| Metric | Current State | Conservative | Expected | Optimistic |
|--------|-------------|-------------|---------|-----------|
| Flow Efficiency | 14.7% | 28% | 39% | 52% |
| Lead Time (days) | 12.4 | 7.1 | 4.8 | 3.2 |
| Process Time (hrs) | 18.2 | 12.4 | 9.1 | 7.3 |
| Automation Coverage | 12% | 35% | 55% | 72% |

The "Expected" scenario projections carried a "Benchmark-grounded" badge — they were calibrated against the p50 improvement trajectory from 11 comparable banking transformation case studies in the knowledge base.

### Investment Prioritisation Shock

The benchmark-grounded analysis produced a significant reallocation finding:

The $12M payment processing automation (the largest proposed investment) targeted a capability already operating at **flow efficiency of 22.1% vs industry p50 of 21.8%** — i.e., NPB was already at market parity. The Jira data showed the bottleneck was not in processing but in downstream settlement reconciliation, which was not in scope.

Conversely, the SME Document Collection bottleneck (2.5% flow efficiency; $0 previously allocated) was identified as having a **projected 6.2× ROI** from a targeted digital document portal — a $2.1M investment with projected $13M+ in operational savings from loan processing acceleration.

**Investment reallocation outcome:**

| Initiative | Prior Budget | Revised Budget | Evidence Basis |
|-----------|-------------|---------------|---------------|
| Payment Processing Automation | $12.0M | $3.6M | At industry parity; reduce scope |
| KYC Manual Review AI | $9.0M | $11.2M | Critical bottleneck; expanded |
| Document Processing AI Layer | $7.0M | $2.1M | Reallocated to SME Document Portal |
| SME Document Portal (new) | $0 | **$8.4M** | 2.5% flow eff; 6.2× ROI |
| Wealth Adviser Routing AI (new) | $0 | **$4.7M** | 2.1% flow eff; new discovery |
| **Total** | **$38.0M** | **$38.0M** | |

---

## Results

### Speed
- **17 days** from platform provisioning to board-ready baseline (vs 26–42 weeks manual estimate)
- $2.8M in consulting fees avoided
- DTO team of 12 analysts managed the entire programme vs the 60+ stakeholder-weeks required for manual workshops

### Accuracy & Coverage
- **100% portfolio coverage** (42/42 products) — vs 8% completion after 6 months of manual workshops
- **70.3% of VSM timings anchored to Jira-measured data** — not consultant estimates
- **14 previously-unknown bottlenecks** discovered, including the highest-ROI investment opportunity in the portfolio

### Decision Quality
- $8.4M reallocated from at-parity investments to critical bottleneck interventions
- Board investment case approved in first review (previously required 3 iterations over 4 months)
- Audit trail provided CFO with full traceability from Jira data → VSM timing → investment rationale

### Compliance & Security
- **Row-Level Security** ensured Wealth Management data was inaccessible to Consumer Banking analysts throughout — critical for APRA privacy requirements
- **Full audit log** of all manual overrides with actor, timestamp, and justification notes — directly usable for APRA transformation governance submissions
- **SSO integration** with Azure Entra ID meant zero new password management overhead for 8,400 employees
- **Per-org API key** ensured all Anthropic API calls billed to NPB's own account, with usage visible in their internal cost management tooling

---

## What's Next

NPB's DTO is now expanding TransformHub use across three additional programmes:

**Phase 2: Process Mining Integration (Q1 2025)**
NPB's mortgage operations team has 4 years of transaction event log data from their loan origination system. The P4 process mining capability will ingest these logs to discover actual process flows — complementing Jira data with system-level evidence for the KYC and document collection workflows.

**Phase 3: Continuous Monitoring (Q2 2025)**
Rather than annual snapshot baselines, NPB plans to run weekly VSM agent refreshes with live Jira cycle time extraction — creating a living transformation intelligence layer that tracks improvement progress in near-real-time.

**Phase 4: Cross-Product A/B Testing (Q3 2025)**
The P4 A/B testing framework will be used to run controlled experiments on transformation approaches: comparing outcomes from agent-prioritised vs manually-prioritised backlog ordering across matched product teams.

---

## Client Perspective

> *"We spent six months trying to build a baseline the traditional way and ended up with three inconsistent workshop outputs that couldn't even agree on what our capabilities were. TransformHub gave us a complete, consistent, data-grounded view of all 42 products in 17 days. More importantly, it found an $8.4 million investment opportunity that none of our architects had identified — because it was buried in Jira data that nobody had ever aggregated. That single finding paid for the platform many times over."*
>
> — **Sarah Chen**, Head of Platform Strategy, National Pacific Bank Digital Transformation Office

> *"From a risk and compliance perspective, the audit trail was the deciding factor. Every number in our board submission traces back to a Jira ticket or an uploaded benchmark document. The APRA reviewer specifically commented on the quality of our investment evidence. That's not something we could have produced from workshop flip-charts."*
>
> — **James Okafor**, Chief Risk Officer (Digital), National Pacific Bank

---

*National Pacific Bank is a fictional composite organisation. All metrics represent illustrative scenarios grounded in realistic industry data.*
