# TransformHub — Epics, Features & OKRs

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12

---

## Table of Contents

1. [Epic Overview](#1-epic-overview)
2. [EP-001: Organisation & Repository Management](#ep-001-organisation--repository-management)
3. [EP-002: Digital Discovery & Mapping](#ep-002-digital-discovery--mapping)
4. [EP-003: Value Stream Analysis](#ep-003-value-stream-analysis)
5. [EP-004: Future State Intelligence](#ep-004-future-state-intelligence)
6. [EP-005: Risk & Compliance Management](#ep-005-risk--compliance-management)
7. [EP-006: Context & Knowledge Management](#ep-006-context--knowledge-management)
8. [EP-007: Agent Orchestration & Human Gates](#ep-007-agent-orchestration--human-gates)
9. [EP-008: Reporting & Executive Intelligence](#ep-008-reporting--executive-intelligence)
10. [Epic Dependency Map](#10-epic-dependency-map)
11. [Release Mapping](#11-release-mapping)

---

## 1. Epic Overview

| Epic ID | Title | Priority | Release Target | Stories |
|---------|-------|----------|----------------|---------|
| EP-001 | Organisation & Repository Management | P0 | MVP | 6 features |
| EP-002 | Digital Discovery & Mapping | P0 | MVP | 5 features |
| EP-003 | Value Stream Analysis | P0 | MVP | 5 features |
| EP-004 | Future State Intelligence | P0 | MVP | 5 features |
| EP-005 | Risk & Compliance Management | P1 | v0.5 | 4 features |
| EP-006 | Context & Knowledge Management | P0 | MVP | 5 features |
| EP-007 | Agent Orchestration & Human Gates | P0 | MVP | 6 features |
| EP-008 | Reporting & Executive Intelligence | P1 | v1.0 | 4 features |

---

## EP-001: Organisation & Repository Management

**Description**: Enables organisations to onboard, configure business segments, manage repositories, and switch between organisation contexts.
**Business Value**: Foundation for all other features — every agent and data entity is scoped to an organisation.
**Priority**: P0 (Must Have — MVP)

### Epic-Level OKR

**Objective**: Deliver a frictionless organisation setup experience that enables teams to begin transformation analysis within 15 minutes.

| Key Result | Target | Measurement |
|------------|--------|-------------|
| KR1: Organisation setup to first agent run | ≤ 15 minutes | Time tracked from org creation to first discovery run |
| KR2: Org switching latency | < 500ms | P95 measured in production |
| KR3: Demo org configuration accuracy | 100% correct seeding | Verified against seed scripts |

### Features

#### F-001-01: Organisation Onboarding
**Description**: Create and configure a new organisation with name, description, and business segments.

**Acceptance Criteria**:
- AC1: Given I navigate to Settings > Organisation, when I enter a name and description, then a new org is created and appears in the org selector
- AC2: Given I add business segments as a comma-separated list, when I save, then segments are stored in organisations.business_segments JSONB array
- AC3: Given an org exists, when I rename a business segment, then all digital_products with that segment name are cascade-updated
- AC4: Given the app loads for the first time, when no org is in localStorage, then the org named "US Bank" is auto-selected

**OKR**: Objective: Enable rapid org configuration. KR: 90% of users complete org setup without support in < 10 minutes.

**Story Points**: 5 | **Priority**: Must Have

---

#### F-001-02: Repository Management
**Description**: Create and manage repositories within an organisation to logically group digital products.

**Acceptance Criteria**:
- AC1: Given I am in org Settings, when I create a repository, then it is associated with the current org
- AC2: Given a repository exists, when I add digital products, then products are linked to the repository
- AC3: Given I delete a repository, when confirmed, then all child digital products and capabilities are cascade-deleted

**OKR**: Objective: Support logical product grouping. KR: 100% of digital products traceable to a repository.

**Story Points**: 3 | **Priority**: Must Have

---

#### F-001-03: Business Segment Configuration
**Description**: Configure and manage business segments that drive agent context segmentation and product tagging.

**Acceptance Criteria**:
- AC1: Given segments are configured, when Discovery Agent runs, then the selected segment is used to tag digital_products.business_segment
- AC2: Given I reorder segments in the list, when saved, then the positional mapping is used for cascade rename
- AC3: Given no segment is selected before running an agent, when agent starts, then org's first segment is used as default

**Story Points**: 3 | **Priority**: Must Have

---

#### F-001-04: Organisation Context Switching
**Description**: Allow users to switch between multiple organisations from a persistent context selector.

**Acceptance Criteria**:
- AC1: Given multiple orgs exist, when I select a different org from the header dropdown, then all data displayed updates to the selected org
- AC2: Given I refresh the page, when app loads, then the previously selected org is restored from localStorage
- AC3: Given I clear localStorage, when app loads, then "US Bank" demo org is auto-selected

**Story Points**: 2 | **Priority**: Must Have

---

#### F-001-05: Member Management
**Description**: Invite and manage users within an organisation with role assignments.

**Acceptance Criteria**:
- AC1: Given I am an org admin, when I invite a user by email, then they receive an invitation link
- AC2: Given a user accepts an invitation, when they log in, then they see only their org's data
- AC3: Given I remove a member, when confirmed, then they lose access to org data

**Story Points**: 5 | **Priority**: Should Have | **Release**: v1.1

---

#### F-001-06: Demo Organisation Seeding
**Description**: Pre-seed platform with 3 demo organisations (US Bank, Telstra Health, ING Bank) with realistic data.

**Acceptance Criteria**:
- AC1: Given a fresh database, when seed script runs, then 3 orgs with products, capabilities, and context docs are created
- AC2: Given demo orgs are seeded, when Discovery Agent runs on US Bank, then it finds existing product hierarchy to work with
- AC3: Given demo orgs are seeded, then each org has a distinct business segment set appropriate to its industry

**Story Points**: 3 | **Priority**: Must Have

---

## EP-002: Digital Discovery & Mapping

**Description**: AI-powered discovery of digital products, capabilities, and functionalities mapped to business segments.
**Business Value**: Replaces weeks of manual capability workshops with hours of AI-assisted discovery.
**Priority**: P0 (Must Have — MVP)

### Epic-Level OKR

**Objective**: Automate digital capability discovery to reduce analysis time by 90% compared to manual workshops.

| Key Result | Target | Measurement |
|------------|--------|-------------|
| KR1: Discovery agent execution time | < 30 seconds | Measured from trigger to persist |
| KR2: Product/capability accuracy vs manual review | ≥ 80% accuracy | Sampling of 50 products |
| KR3: Human edit rate on discovery outputs | < 25% of items edited | Tracked via HITL gate |

### Features

#### F-002-01: Discovery Agent Execution
**Description**: Run the Discovery LangGraph agent to map digital products and capabilities for a selected business segment.

**Acceptance Criteria**:
- AC1: Given a business segment is selected, when I click "Run Discovery", then the agent executes and results are persisted within 30 seconds
- AC2: Given agent completes, when results are displayed, then digital products are shown in expandable tree
- AC3: Given agent fails, when error occurs, then user sees descriptive error message and retry option

**OKR**: Objective: Enable one-click discovery. KR: 95% of discovery runs complete successfully on first attempt.

**Story Points**: 8 | **Priority**: Must Have

---

#### F-002-02: Digital Product Hierarchy Display
**Description**: Display discovered products as a hierarchical tree with products → capabilities → functionalities.

**Acceptance Criteria**:
- AC1: Given discovery results exist, when I view the Discovery page, then tree shows all 3 levels expandable
- AC2: Given I expand a product, when capabilities are shown, then each has maturity_level indicator
- AC3: Given I expand a capability, when functionalities are shown, then each has a description

**Story Points**: 5 | **Priority**: Must Have

---

#### F-002-03: Business Segment Tagging
**Description**: Ensure all discovered digital products are tagged with the correct business segment.

**Acceptance Criteria**:
- AC1: Given segment "Retail Banking" is selected, when discovery runs, then all products get business_segment = "Retail Banking"
- AC2: Given no segment selected, when discovery runs, then products get org's first segment
- AC3: Given I view products, when I filter by segment, then only matching products display

**Story Points**: 3 | **Priority**: Must Have

---

#### F-002-04: Manual Editing of Discovery Results
**Description**: Allow users to edit, add, and delete products, capabilities, and functionalities discovered by the agent.

**Acceptance Criteria**:
- AC1: Given a product exists, when I edit its name, then change persists and downstream agents use updated name
- AC2: Given a capability exists, when I delete it, then child functionalities are also deleted
- AC3: Given I add a new capability manually, when saved, then it appears in the capability hierarchy

**Story Points**: 5 | **Priority**: Should Have

---

#### F-002-05: Re-run and Incremental Discovery
**Description**: Support re-running discovery to update existing data without full reset.

**Acceptance Criteria**:
- AC1: Given discovery has run, when I re-run for the same segment, then new products are added without deleting existing ones
- AC2: Given a product exists, when re-discovery identifies the same product, then it updates rather than duplicates
- AC3: Given re-discovery is triggered, when changes occur, then audit log records the delta

**Story Points**: 5 | **Priority**: Should Have

---

## EP-003: Value Stream Analysis

**Description**: Lean VSM agent maps current-state value streams, identifies waste, and computes efficiency metrics.
**Business Value**: Replaces 3-week facilitated VSM workshops with AI-generated maps.
**Priority**: P0 (Must Have — MVP)

### Epic-Level OKR

**Objective**: Deliver automated value stream analysis that surfaces actionable waste insights within 2 hours.

| Key Result | Target | Measurement |
|------------|--------|-------------|
| KR1: VSM agent execution time | < 45 seconds | P95 measured |
| KR2: Waste identification accuracy vs expert review | ≥ 75% | Expert validation on 20 products |
| KR3: Process cycle efficiency baseline established | 100% of analysed products | Verified in DB |

### Features

#### F-003-01: VSM Agent Execution
**Description**: Run the Lean VSM LangGraph agent to generate current-state value stream map for a selected digital product.

**Acceptance Criteria**:
- AC1: Given a digital product is selected, when VSM Agent runs, then value_stream_steps are persisted with cycle_time, wait_time, quality_score, automation_level
- AC2: Given agent completes, when swim lane is displayed, then each step card shows its metrics
- AC3: Given agent uses capability context, then capabilities are loaded via correct dc.digital_product_id join

**Story Points**: 8 | **Priority**: Must Have

---

#### F-003-02: Swim Lane Diagram Display
**Description**: Visualise the value stream as a swim-lane process diagram with step metrics.

**Acceptance Criteria**:
- AC1: Given VSM results exist, when page loads, then swim lane shows steps in sequence order
- AC2: Given I hover on a step, when tooltip shows, then full metrics (cycle_time, wait_time, quality_score, automation_level) are visible
- AC3: Given waste is identified, when displayed, then waste indicator is colour-coded by category

**Story Points**: 5 | **Priority**: Must Have

---

#### F-003-03: Waste Identification & Categorisation
**Description**: AI-identified waste items categorised by lean waste type (waiting, overprocessing, defects, etc.).

**Acceptance Criteria**:
- AC1: Given VSM runs, when waste identified, then each waste item has category, description, and estimated impact
- AC2: Given I view waste items, when sorted by impact, then highest-impact wastes appear first
- AC3: Given waste is identified, when user reviews, then they can mark wastes as confirmed or dismissed

**Story Points**: 5 | **Priority**: Must Have

---

#### F-003-04: Efficiency Metrics Dashboard
**Description**: Display process cycle efficiency, lead time ratio, and throughput metrics for the analysed value stream.

**Acceptance Criteria**:
- AC1: Given VSM completes, when metrics panel shows, then process_cycle_efficiency is displayed as percentage
- AC2: Given metrics exist, when compared to industry benchmark, then delta is highlighted
- AC3: Given I navigate to Future State, when projected improvements are shown, then they reference VSM baseline

**Story Points**: 3 | **Priority**: Should Have

---

#### F-003-05: VSM Context Document Auto-Save
**Description**: Automatically save completed VSM outputs as AGENT_OUTPUT context documents for RAG use.

**Acceptance Criteria**:
- AC1: Given VSM agent completes, when persist_vsm runs, then save_agent_context_doc() creates a context doc in category AGENT_OUTPUT
- AC2: Given context doc is created, when Future State Agent runs, then it retrieves and uses the VSM context doc
- AC3: Given context docs exist, when user views Knowledge Base, then AGENT_OUTPUT docs are listed and searchable

**Story Points**: 3 | **Priority**: Must Have

---

## EP-004: Future State Intelligence

**Description**: AI-generated transformation roadmap with benchmark-grounded projected metrics.
**Business Value**: Turns VSM analysis into an actionable, data-grounded roadmap.
**Priority**: P0 (Must Have — MVP)

### Epic-Level OKR

**Objective**: Generate benchmark-grounded future state plans that reduce roadmap creation time from 4 weeks to 4 hours.

| Key Result | Target | Measurement |
|------------|--------|-------------|
| KR1: Future State agent execution time | < 60 seconds | P95 |
| KR2: Plans that include benchmark grounding | ≥ 70% of runs when benchmarks uploaded | Measured by projected_metrics presence |
| KR3: Stakeholder acceptance of AI roadmap without major revision | ≥ 60% | HITL gate approval rate |

### Features

#### F-004-01: Future State Vision Agent Execution
**Description**: Run Future State Vision Agent to generate transformation roadmap and projected metrics.

**Acceptance Criteria**:
- AC1: Given VSM has completed, when Future State Agent runs, then roadmap phases with activities and timelines are generated
- AC2: Given benchmarks are uploaded, when agent runs, then projected_metrics include conservative/expected/optimistic bands
- AC3: Given no benchmarks uploaded, when agent runs, then metric projections fall back to internal multipliers

**Story Points**: 8 | **Priority**: Must Have

---

#### F-004-02: Transformation Roadmap Visualisation
**Description**: Display the generated roadmap as a timeline with phases, milestones, and workstreams.

**Acceptance Criteria**:
- AC1: Given roadmap exists, when page loads, then phases are displayed on timeline
- AC2: Given I click a phase, when expanded, then activities and deliverables are shown
- AC3: Given I export the roadmap, when PDF generated, then all phases and activities are included

**Story Points**: 5 | **Priority**: Must Have

---

#### F-004-03: Projected Metrics Display
**Description**: Display projected improvement metrics with confidence bands (conservative/expected/optimistic).

**Acceptance Criteria**:
- AC1: Given projected_metrics from agent, when displayed, then three-band chart is shown per metric
- AC2: Given benchmark grounding used, when metric displayed, then "Benchmark-grounded" badge appears
- AC3: Given fallback multipliers used, when metric displayed, then "Estimated" label is shown
- AC4: Given I hover on a metric, when tooltip shows, then source and confidence score are visible

**Story Points**: 5 | **Priority**: Must Have

---

#### F-004-04: Benchmark Comparison View
**Description**: Side-by-side comparison of current state metrics vs industry benchmark vs projected state.

**Acceptance Criteria**:
- AC1: Given benchmarks are uploaded, when comparison view loads, then three columns show current / benchmark / projected
- AC2: Given comparison exists, when user views delta, then improvement percentage is highlighted
- AC3: Given I filter by metric category, when filter applied, then only selected metrics shown

**Story Points**: 3 | **Priority**: Should Have

---

#### F-004-05: Roadmap Export & Share
**Description**: Export the future state roadmap as PDF and generate shareable link.

**Acceptance Criteria**:
- AC1: Given roadmap exists, when I click Export, then PDF with cover page, timeline, and metrics is generated
- AC2: Given share is triggered, when link generated, then recipient can view read-only roadmap without login
- AC3: Given I export, when download completes, then file is named TransformHub_FutureState_[OrgName]_[Date].pdf

**Story Points**: 5 | **Priority**: Should Have

---

## EP-005: Risk & Compliance Management

**Description**: AI-driven risk identification, severity scoring, and regulatory compliance mapping.
**Business Value**: Replaces 4-week regulatory review with AI-assisted risk assessment.
**Priority**: P1 (Should Have — v0.5)

### Epic-Level OKR

**Objective**: Automate risk identification to surface 80% of material risks within 1 hour.

| Key Result | Target | Measurement |
|------------|--------|-------------|
| KR1: Risk agent execution time | < 60 seconds | P95 |
| KR2: Expert agreement on identified risks | ≥ 75% | Expert sampling on 10 assessments |
| KR3: Regulatory frameworks mapped per assessment | ≥ 3 frameworks | Counted per risk report |

### Features

#### F-005-01: Risk & Compliance Agent Execution
**Description**: Run Risk Agent to identify risks and map to regulatory frameworks.

**Acceptance Criteria**:
- AC1: Given product is selected, when Risk Agent runs, then risks are identified with category, likelihood, impact, severity
- AC2: Given agent completes, when risk register displays, then risks are sorted by severity score
- AC3: Given agent uses capability join, then capabilities loaded via correct dc.digital_product_id direction

**Story Points**: 8 | **Priority**: Should Have

---

#### F-005-02: Risk Register Display
**Description**: Display identified risks as a sortable, filterable table with severity heat map.

**Acceptance Criteria**:
- AC1: Given risk data exists, when page loads, then risk register table shows with all columns
- AC2: Given I filter by category, when filter applied, then only matching risks shown
- AC3: Given I click a risk, when detail view opens, then full description, mitigation suggestions, and regulatory refs shown

**Story Points**: 5 | **Priority**: Should Have

---

#### F-005-03: Risk Heat Map
**Description**: Visual 5×5 likelihood/impact matrix with risks plotted by position.

**Acceptance Criteria**:
- AC1: Given risks exist, when heat map loads, then all risks are plotted by likelihood × impact
- AC2: Given I hover a risk dot, when tooltip shows, then risk title and mitigation summary visible
- AC3: Given I click a quadrant, when filtered, then table below shows only risks in that quadrant

**Story Points**: 3 | **Priority**: Should Have

---

#### F-005-04: Mitigation Planning
**Description**: Allow users to create, assign, and track mitigation actions for identified risks.

**Acceptance Criteria**:
- AC1: Given a risk exists, when I add a mitigation action, then it is associated with the risk and assigned to a user
- AC2: Given mitigations exist, when I mark one complete, then risk residual score is recalculated
- AC3: Given I export risk report, when PDF generated, then mitigations are included per risk

**Story Points**: 5 | **Priority**: Could Have

---

## EP-006: Context & Knowledge Management

**Description**: RAG pipeline for capturing, indexing, and retrieving organisational knowledge to ground agent outputs.
**Business Value**: Enables agents to produce benchmark-grounded, context-aware outputs rather than generic AI responses.
**Priority**: P0 (Must Have — MVP)

### Epic-Level OKR

**Objective**: Build a knowledge layer that makes every agent run 40% more relevant than runs without context.

| Key Result | Target | Measurement |
|------------|--------|-------------|
| KR1: RAG retrieval precision (relevant chunks in top-10) | ≥ 85% | Sampled evaluation |
| KR2: Time from document upload to agent-usable | < 60 seconds | End-to-end measured |
| KR3: Context chunks per org (scale test) | ≥ 10,000 with no degradation | Load test |

### Features

#### F-006-01: Document Upload & Chunking
**Description**: Upload PDF, DOCX, TXT, MD files to the knowledge base with automatic chunking and embedding.

**Acceptance Criteria**:
- AC1: Given I upload a PDF, when processing completes, then document is split into 2k-char chunks with 400-char overlap
- AC2: Given chunks are created, when embedded, then each gets a 1536-dim vector stored in pgvector
- AC3: Given upload completes, when I search the knowledge base, then document content is retrievable

**Story Points**: 5 | **Priority**: Must Have

---

#### F-006-02: URL & GitHub Content Fetch
**Description**: Fetch content from URLs or GitHub links, auto-chunk and embed.

**Acceptance Criteria**:
- AC1: Given I enter a URL in the fetch field, when I click Fetch, then content is retrieved and chunked
- AC2: Given GitHub markdown URL is fetched, when processed, then content is appropriately chunked preserving structure
- AC3: Given fetch fails (404, timeout), when error occurs, then user sees descriptive error message

**Story Points**: 3 | **Priority**: Must Have

---

#### F-006-03: Document Categorisation
**Description**: Assign documents to semantic categories that agents use for category-aware RAG budget allocation.

**Acceptance Criteria**:
- AC1: Given I upload a document, when I select category VSM_BENCHMARKS, then document is tagged and retrievable by that category
- AC2: Given category is set, when VSM or Future State agent runs, then category-aware budget prioritises VSM_BENCHMARKS chunks
- AC3: Given I view Knowledge Base, when I filter by category, then only documents in that category display

**Story Points**: 3 | **Priority**: Must Have

---

#### F-006-04: Hybrid RAG Retrieval
**Description**: Multi-query BM25 + vector hybrid retrieval with deduplication and reranking.

**Acceptance Criteria**:
- AC1: Given an agent runs, when RAG retrieval executes, then 3–5 queries are generated per agent_type
- AC2: Given results from multiple queries, when deduplicated, then union of unique chunks with hit-count score is formed
- AC3: Given 25 candidate chunks, when reranked by BM25, then final chunks injected into agent prompt are ranked by relevance
- AC4: Given no relevant chunks found, when fallback triggered, then 25 chunks by recency are used

**Story Points**: 8 | **Priority**: Must Have

---

#### F-006-05: Agent Output Auto-Save to Context
**Description**: Automatically save Discovery, VSM, and Future State outputs as AGENT_OUTPUT category context documents.

**Acceptance Criteria**:
- AC1: Given Discovery Agent completes, when save_agent_context_doc() is called, then output is chunked and embedded
- AC2: Given AGENT_OUTPUT context doc exists, when subsequent agent runs, then prior agent output is used as RAG context
- AC3: Given I view Knowledge Base, when I filter by AGENT_OUTPUT, then all agent outputs are listed

**Story Points**: 3 | **Priority**: Must Have

---

## EP-007: Agent Orchestration & Human Gates

**Description**: LangGraph agent coordination, HITL gate management, agent memory, and accuracy scoring.
**Business Value**: Ensures human oversight, continuous learning, and trust in AI outputs.
**Priority**: P0 (Must Have — MVP)

### Epic-Level OKR

**Objective**: Build a trustworthy AI layer where humans maintain control and the system learns from every interaction.

| Key Result | Target | Measurement |
|------------|--------|-------------|
| KR1: HITL gate implementation rate | 100% of configured gates trigger correctly | Test suite |
| KR2: Agent memory retention rate | ≥ 90% of learnings persisted across runs | DB verification |
| KR3: Accuracy score coverage | 100% of agent modules have live accuracy scores | Dashboard check |

### Features

#### F-007-01: LangGraph Agent Execution Engine
**Description**: Execute all 18 agents as LangGraph state machines with error handling and retry.

**Acceptance Criteria**:
- AC1: Given an agent is triggered, when LangGraph graph runs, then state transitions are executed in order
- AC2: Given a transient error, when retry triggered, then agent retries up to 3 times with exponential backoff
- AC3: Given a terminal error, when max retries exceeded, then error state is persisted and user notified

**Story Points**: 8 | **Priority**: Must Have

---

#### F-007-02: Human-in-the-Loop Gates
**Description**: INTERRUPT nodes in LangGraph that pause execution for human review.

**Acceptance Criteria**:
- AC1: Given HITL is configured for an agent, when INTERRUPT node reached, then execution pauses and state checkpointed
- AC2: Given agent is paused, when user reviews and approves, then execution resumes from checkpoint
- AC3: Given user rejects output, when feedback submitted, then agent re-runs with feedback injected into prompt
- AC4: Given checkpoint exists, when server restarts, then paused agent state is recoverable

**Story Points**: 8 | **Priority**: Must Have

---

#### F-007-03: Agent Memory Learning Loop
**Description**: Store per-org, per-agent learnings from HITL feedback and inject into future runs.

**Acceptance Criteria**:
- AC1: Given agent completes, when learnings extracted, then they are saved to agent_memories table with org_id and agent_type
- AC2: Given memories exist, when agent runs next time, then relevant memories are injected into system prompt
- AC3: Given conflicting memories, when resolved, then most recent/higher confidence memory takes precedence

**Story Points**: 5 | **Priority**: Must Have

---

#### F-007-04: Accuracy Scoring
**Description**: Composite accuracy scores per agent module, displayed on dashboard.

**Acceptance Criteria**:
- AC1: Given an agent has run history, when accuracy score computed, then it uses formula: confidence + source_diversity + run_success + human_edit_rate
- AC2: Given score is computed, when cached, then TTL is 60 seconds
- AC3: Given I view dashboard, when accuracy panel loads, then each active module shows score as percentage

**Story Points**: 5 | **Priority**: Must Have

---

#### F-007-05: SHA-256 Chained Audit Trail
**Description**: Immutable audit log for all agent runs and data mutations with hash chaining.

**Acceptance Criteria**:
- AC1: Given any agent run or data mutation, when logged, then audit_log entry is created with SHA-256 hash of previous entry
- AC2: Given I query audit trail, when retrieved in order, then hash chain can be verified sequentially
- AC3: Given audit entry is tampered, when chain verified, then tampering is detectable

**Story Points**: 5 | **Priority**: Must Have

---

#### F-007-06: Context-Aware Agent Prompting
**Description**: All 18 agents inject format_context_section(input_data, agent_type) with category-aware context budget.

**Acceptance Criteria**:
- AC1: Given an agent runs, when format_context_section called, then relevant context docs are formatted per agent_type
- AC2: Given agent_type="lean_vsm", when context formatted, then VSM_BENCHMARKS get higher budget allocation
- AC3: Given max_chars=12k budget, when context formatted, then total injected context does not exceed limit

**Story Points**: 5 | **Priority**: Must Have

---

## EP-008: Reporting & Executive Intelligence

**Description**: AI-generated executive reports compiled from all agent outputs with confidence scoring.
**Business Value**: Eliminates manual report preparation for board and leadership presentations.
**Priority**: P1 (Should Have — v1.0)

### Epic-Level OKR

**Objective**: Automate executive report generation to produce board-ready reports in under 10 minutes.

| Key Result | Target | Measurement |
|------------|--------|-------------|
| KR1: Report generation time | < 10 minutes | End-to-end measured |
| KR2: Executive satisfaction with AI report quality | ≥ 75% rate as "usable without major edit" | Survey on 20 reports |
| KR3: Reports exported per month (adoption) | ≥ 50 | Usage analytics |

### Features

#### F-008-01: Executive Reporting Agent
**Description**: Compile all agent outputs into a structured C-suite report.

**Acceptance Criteria**:
- AC1: Given all domain agents have run, when Executive Reporting Agent triggered, then all outputs are compiled
- AC2: Given compilation complete, when report generated, then sections cover: discovery summary, VSM findings, future state, risks, architecture
- AC3: Given report exists, when viewed, then each section includes confidence scores and source references

**Story Points**: 8 | **Priority**: Should Have

---

#### F-008-02: Report Visualisation
**Description**: Rendered report view with charts, tables, and executive summary.

**Acceptance Criteria**:
- AC1: Given report data exists, when report page loads, then all sections render with appropriate visualisations
- AC2: Given accuracy scores exist, when shown in report, then each module's score is prominently displayed
- AC3: Given I navigate between sections, when sidebar selected, then smooth scroll to section occurs

**Story Points**: 5 | **Priority**: Should Have

---

#### F-008-03: PDF Export
**Description**: Export the full report as a formatted PDF document.

**Acceptance Criteria**:
- AC1: Given I click Export PDF, when download starts, then file name is TransformHub_[OrgName]_[Date].pdf
- AC2: Given PDF renders, when opened, then all charts and tables are included with correct formatting
- AC3: Given I export, when cover page shows, then it includes org name, date, platform version, and accuracy scores

**Story Points**: 5 | **Priority**: Should Have

---

#### F-008-04: Historical Runs & Comparison
**Description**: View history of all agent runs and compare outputs across time periods.

**Acceptance Criteria**:
- AC1: Given multiple runs exist, when I view Run History, then all runs are listed with date, agent, status, accuracy score
- AC2: Given I select two runs, when comparison triggered, then delta between outputs is highlighted
- AC3: Given I click a historical run, when detail view opens, then full output is shown read-only

**Story Points**: 5 | **Priority**: Could Have

---

## 10. Epic Dependency Map

| Epic | Depends On | Blocks |
|------|-----------|--------|
| EP-001: Org Management | — (Foundation) | EP-002, EP-003, EP-004, EP-005, EP-006, EP-007, EP-008 |
| EP-006: Knowledge Management | EP-001 | EP-002, EP-003, EP-004 (context grounding) |
| EP-007: Agent Orchestration | EP-001, EP-006 | EP-002, EP-003, EP-004, EP-005, EP-008 |
| EP-002: Discovery | EP-001, EP-006, EP-007 | EP-003 |
| EP-003: VSM | EP-001, EP-002, EP-007 | EP-004 |
| EP-004: Future State | EP-001, EP-003, EP-006 | EP-008 |
| EP-005: Risk | EP-001, EP-002, EP-007 | EP-008 |
| EP-008: Reporting | EP-002, EP-003, EP-004, EP-005 | — |

---

## 11. Release Mapping

| Feature | Release | Status |
|---------|---------|--------|
| F-001-01: Org Onboarding | MVP | ✅ Done |
| F-001-02: Repository Management | MVP | ✅ Done |
| F-001-03: Business Segment Configuration | MVP | ✅ Done |
| F-001-04: Org Context Switching | MVP | ✅ Done |
| F-001-05: Member Management | v1.1 | Planned |
| F-001-06: Demo Org Seeding | MVP | ✅ Done |
| F-002-01: Discovery Agent Execution | MVP | ✅ Done |
| F-002-02: Product Hierarchy Display | MVP | ✅ Done |
| F-002-03: Business Segment Tagging | MVP | ✅ Done |
| F-002-04: Manual Editing | v0.5 | Planned |
| F-002-05: Re-run & Incremental Discovery | v0.5 | Planned |
| F-003-01: VSM Agent Execution | MVP | ✅ Done |
| F-003-02: Swim Lane Display | MVP | ✅ Done |
| F-003-03: Waste Identification | MVP | ✅ Done |
| F-003-04: Efficiency Metrics | v0.5 | Planned |
| F-003-05: VSM Context Auto-Save | MVP | ✅ Done |
| F-004-01: Future State Agent | MVP | ✅ Done |
| F-004-02: Roadmap Visualisation | MVP | ✅ Done |
| F-004-03: Projected Metrics | MVP | ✅ Done |
| F-004-04: Benchmark Comparison | v0.5 | Planned |
| F-004-05: Roadmap Export | v0.5 | Planned |
| F-005-01: Risk Agent | v0.5 | ✅ Done |
| F-005-02: Risk Register Display | v0.5 | ✅ Done |
| F-005-03: Risk Heat Map | v0.5 | Planned |
| F-005-04: Mitigation Planning | v1.0 | Planned |
| F-006-01: Document Upload | MVP | ✅ Done |
| F-006-02: URL Fetch | MVP | ✅ Done |
| F-006-03: Document Categorisation | MVP | ✅ Done |
| F-006-04: Hybrid RAG Retrieval | MVP | ✅ Done |
| F-006-05: Agent Output Auto-Save | MVP | ✅ Done |
| F-007-01: LangGraph Execution Engine | MVP | ✅ Done |
| F-007-02: HITL Gates | MVP | ✅ Done |
| F-007-03: Agent Memory | MVP | ✅ Done |
| F-007-04: Accuracy Scoring | MVP | ✅ Done |
| F-007-05: Audit Trail | MVP | ✅ Done |
| F-007-06: Context-Aware Prompting | MVP | ✅ Done |
| F-008-01: Executive Reporting Agent | v1.0 | Planned |
| F-008-02: Report Visualisation | v1.0 | Planned |
| F-008-03: PDF Export | v1.0 | Planned |
| F-008-04: Historical Runs & Comparison | v1.2 | Planned |
