# TransformHub — Product Requirements Document (PRD)

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12
**Owner**: Product Management

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Goals](#3-product-vision--goals)
4. [Target Users & Personas](#4-target-users--personas)
5. [Key Use Cases](#5-key-use-cases)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [User Interface Requirements](#8-user-interface-requirements)
9. [Integration Requirements](#9-integration-requirements)
10. [Constraints & Assumptions](#10-constraints--assumptions)
11. [Out of Scope (v1)](#11-out-of-scope-v1)
12. [Success Criteria & Acceptance Criteria](#12-success-criteria--acceptance-criteria)

---

## 1. Executive Summary

### 1.1 Platform Overview

TransformHub is an enterprise-grade AI-powered digital transformation intelligence platform that enables organisations to discover, analyse, plan, and monitor their digital transformation journeys at scale. The platform deploys 18 specialised LangGraph agents, each owning a distinct transformation domain, coordinated through a shared PostgreSQL knowledge base and a hybrid RAG (Retrieval-Augmented Generation) pipeline.

The platform provides:
- **Automated discovery** of digital products, capabilities, and business segments
- **Lean Value Stream Mapping** with AI-identified waste and optimisation opportunities
- **Future state vision** grounded in industry benchmarks and transformation case studies
- **Risk and compliance intelligence** tailored to regulatory frameworks
- **Architecture recommendations** aligned to target technology platforms
- **Executive reporting** with confidence-scored insights and quantitative projections

### 1.2 Strategic Fit

TransformHub fills a critical gap between strategy consulting tools (PowerPoint decks) and operational tooling (Jira, Confluence). It provides continuous, AI-mediated transformation intelligence that:
- Replaces months of manual analysis with hours of agent-driven insight
- Maintains a living knowledge base that improves with each transformation engagement
- Provides audit-traceable, confidence-scored outputs suitable for board-level decisions

### 1.3 Target Users

| Persona | Role | Primary Need |
|---------|------|--------------|
| Chief Digital Officer | Executive | Portfolio-level transformation visibility |
| VP Digital Transformation | Leader | Prioritised roadmap with business case |
| Business Architect | Practitioner | Capability mapping and gap analysis |
| Product Manager | Practitioner | Product modernisation pathway |
| Technology Consultant | External | Repeatable delivery methodology |

---

## 2. Problem Statement

### 2.1 Core Problems

**P1 — Transformation Opacity**
Large enterprises operate hundreds of digital products and capabilities but lack a unified, continuously updated view of their transformation status. Strategic decisions are made on stale PowerPoint data, resulting in misaligned investment and failed initiatives.

**P2 — Siloed Expertise**
Transformation insights exist in individual consultant documents, tribal knowledge, and disconnected tooling. There is no mechanism to capture, accumulate, and reuse organisational learning across engagements.

**P3 — Manual, Time-Intensive Analysis**
Value stream mapping, capability assessments, risk identification, and architecture reviews each require weeks of workshop facilitation and document synthesis. At scale, this is economically unviable.

**P4 — No Continuous Intelligence**
Transformation assessments are point-in-time snapshots. Without continuous monitoring and feedback loops, organisations cannot detect drift, measure progress, or adapt roadmaps dynamically.

**P5 — Confidence Gap**
Executives lack confidence in AI-generated outputs because they cannot trace sources, understand reasoning, or calibrate against industry benchmarks. This prevents AI adoption in high-stakes transformation decisions.

### 2.2 Quantified Pain

- Average enterprise VSM engagement: 6–12 weeks, $250K–$500K consulting fees
- Typical transformation initiative failure rate: 70% (McKinsey)
- Time from strategic intent to executable roadmap: 3–6 months
- Data freshness of existing assessments: 6–18 months stale at time of decision

---

## 3. Product Vision & Goals

### 3.1 Vision Statement

*"To be the persistent transformation intelligence layer that every enterprise uses to continuously discover, plan, execute, and learn from its digital transformation journey — reducing time-to-insight from months to hours while increasing confidence in strategic decisions."*

### 3.2 Three-Year Goals

| Year | Goal |
|------|------|
| Year 1 | Establish core platform: discovery, VSM, future state, risk, architecture agents operational across 10 pilot enterprises |
| Year 2 | Achieve 50 enterprise clients, introduce real-time streaming agents, marketplace integrations with Jira/Confluence/Azure DevOps |
| Year 3 | Industry-specific agent libraries, benchmarking network across 200+ enterprises, predictive transformation risk scoring |

### 3.3 Success Metrics

| Metric | Target (12 months) |
|--------|-------------------|
| Time to complete discovery + VSM | < 4 hours (vs 6 weeks manual) |
| Agent output accuracy score | ≥ 80% on first run |
| Human edit rate on agent outputs | < 20% of outputs require significant edit |
| User NPS | ≥ 50 |
| Platform uptime | ≥ 99.5% |
| RAG retrieval relevance | ≥ 85% relevant chunks in top-10 |

---

## 4. Target Users & Personas

### 4.1 Persona: Chief Digital/Technology Officer

**Goals**: Portfolio-wide transformation visibility; board-ready reporting; investment prioritisation
**Pain**: Relies on monthly consultancy updates; no real-time view; decisions made on outdated data
**Key Features Used**: Executive dashboard, accuracy scores, risk heat maps, ROI projections, export to PDF
**Technical Proficiency**: Low — needs polished, non-technical views

### 4.2 Persona: VP Digital Transformation

**Goals**: Create and maintain the transformation roadmap; manage delivery of initiatives; report progress upward
**Pain**: Spends 40% of time aggregating status from teams; roadmaps go stale within weeks
**Key Features Used**: Future State Vision, Initiative Prioritisation, Architecture recommendations, HITL gate reviews
**Technical Proficiency**: Medium — comfortable with structured data and dashboards

### 4.3 Persona: Business Architect

**Goals**: Maintain accurate capability model; identify capability gaps; align capabilities to digital products
**Pain**: No tooling to keep capability maps current; always fighting with spreadsheets
**Key Features Used**: Discovery agent, capability hierarchy, VSM analysis, functional architecture view
**Technical Proficiency**: High — power user who wants depth and control

### 4.4 Persona: Product Manager

**Goals**: Understand product transformation pathway; identify technical debt priorities; plan modernisation
**Pain**: Lacks enterprise context for product decisions; no benchmark data
**Key Features Used**: Product Transformation agent, Future State, Risk assessment per product
**Technical Proficiency**: Medium-high

### 4.5 Persona: Technology Consultant

**Goals**: Deliver consistent, high-quality transformation assessments for clients; reuse methodology
**Key Features Used**: All agents, knowledge base upload, benchmark documents, report export, multi-org management
**Technical Proficiency**: High

---

## 5. Key Use Cases

### UC-001: Enterprise Digital Discovery

**Actor**: Business Architect
**Flow**: Select business segment → Run Discovery Agent → Review AI-mapped digital products and capabilities → Approve or edit hierarchy → Publish to org knowledge base
**Value**: 2-week manual workshops replaced with 2-hour AI-assisted session

### UC-002: Value Stream Analysis

**Actor**: VP Digital Transformation / Business Architect
**Flow**: Select digital product → Run Lean VSM Agent → Review current-state value stream steps with cycle times and waste indicators → Identify improvement opportunities → Save VSM as context document
**Value**: Eliminates 3-week facilitated mapping exercise

### UC-003: Future State Planning

**Actor**: VP Digital Transformation
**Flow**: Run Future State Vision Agent (post-VSM) → Review AI-generated transformation roadmap with projected metrics (conservative/expected/optimistic) → Compare against uploaded benchmarks → Export roadmap
**Value**: Data-driven roadmap grounded in industry benchmarks

### UC-004: Risk & Compliance Assessment

**Actor**: Risk Officer / Consultant
**Flow**: Run Risk & Compliance Agent → Review identified risks by category → Review regulatory mapping → Assign mitigation owners → Export risk register
**Value**: Automated identification of risks that typically require 4-week regulatory review

### UC-005: Architecture Recommendations

**Actor**: Enterprise Architect / Consultant
**Flow**: Run Architecture Agent → Review technology recommendations aligned to target state → Review integration patterns → Validate against uploaded architecture standards → Approve recommendations
**Value**: Architecture blueprints generated in hours vs weeks

### UC-006: Knowledge Base Management

**Actor**: Consultant
**Flow**: Upload VSM benchmarks, case studies, architecture standards → Or fetch content from URLs/GitHub → System auto-chunks and embeds → RAG pipeline uses documents to ground agent outputs
**Value**: Institutional knowledge captured and reused across engagements

### UC-007: Human Gate Review

**Actor**: VP Digital Transformation / Architect
**Flow**: Agent execution pauses at HITL gate → User receives notification → Reviews agent output → Approves or rejects with feedback → Agent resumes or rewrites with feedback injected
**Value**: Ensures human oversight at critical decision points

### UC-008: Executive Reporting

**Actor**: CDO / VP
**Flow**: Trigger Executive Reporting Agent → System compiles all agent outputs → Generates structured C-suite report with confidence scores → Export as PDF → Share link
**Value**: Board-ready report generated in minutes

---

## 6. Functional Requirements

### Module A: Organisation Management

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-001 | System shall allow creation of multiple organisations with name, description, and business_segments array | Must | JSONB field for flexibility |
| FR-002 | System shall support multiple repositories per organisation | Must | Logical grouping of digital products |
| FR-003 | System shall allow configuration of business segments per organisation | Must | Drives agent context segmentation |
| FR-004 | System shall support renaming business segments with cascade update to digital_products.business_segment | Must | Positional mapping |
| FR-005 | System shall allow switching active organisation via context selector | Must | OrganizationContext in React |
| FR-006 | System shall display 3 pre-seeded demo organisations (US Bank, Telstra Health, ING Bank) | Must | For demo/evaluation |
| FR-007 | System shall support user authentication via email/password with NextAuth | Must | |
| FR-008 | System shall associate users with organisations | Should | Multi-user support |

### Module B: Discovery

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-009 | System shall allow selection of business segment before running Discovery Agent | Must | Tags digital_products with segment |
| FR-010 | Discovery Agent shall map digital products from input data and existing context | Must | LangGraph graph |
| FR-011 | Discovery Agent shall create digital_capabilities under each digital_product | Must | |
| FR-012 | Discovery Agent shall create functionalities under each digital_capability | Must | |
| FR-013 | System shall persist Discovery results to PostgreSQL hierarchy | Must | repository → product → capability → functionality |
| FR-014 | System shall display discovered products as expandable tree | Must | |
| FR-015 | System shall allow manual editing of discovered products/capabilities | Should | |
| FR-016 | System shall support re-running Discovery Agent to update existing data | Should | |

### Module C: Value Stream Analysis

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-017 | VSM Agent shall load capabilities and product_groups from PostgreSQL for selected product | Must | Uses dc.digital_product_id join |
| FR-018 | VSM Agent shall identify value stream steps with cycle_time, wait_time, quality_score, automation_level | Must | |
| FR-019 | VSM Agent shall identify waste categories (overprocessing, waiting, defects, etc.) | Must | |
| FR-020 | System shall persist VSM results including product_groups and value_stream_steps | Must | Name→ID lookup for capabilities |
| FR-021 | System shall display VSM as swim-lane diagram with process steps | Must | |
| FR-022 | VSM Agent shall produce efficiency metrics (process cycle efficiency, lead time ratio) | Should | |

### Module D: Future State Vision

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-023 | Future State Agent shall generate transformation roadmap based on VSM results | Must | |
| FR-024 | Future State Agent shall produce projected_metrics with conservative/expected/optimistic bands | Must | Benchmark-grounded when docs uploaded |
| FR-025 | Future State Vision page shall display "Benchmark-grounded" badge when agent projected_metrics available | Must | |
| FR-026 | Future State Vision page shall fall back to multipliers when no agent metrics available | Must | |
| FR-027 | Future State Agent shall reference uploaded VSM_BENCHMARKS and TRANSFORMATION_CASE_STUDIES | Must | Via RAG pipeline |

### Module E: Risk & Compliance

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-028 | Risk Agent shall identify risks by category (Technical, Regulatory, Operational, Strategic) | Must | |
| FR-029 | Risk Agent shall map risks to regulatory frameworks (GDPR, SOC2, APRA, etc.) | Should | |
| FR-030 | Risk Agent shall assign severity (likelihood × impact) scores | Must | |
| FR-031 | System shall display risk register as sortable/filterable table | Must | |
| FR-032 | Risk Agent shall use dc.digital_product_id join direction for capability context | Must | Bug fix applied |

### Module F: Architecture

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-033 | Architecture Agent shall generate technology recommendations per product/capability | Must | |
| FR-034 | Architecture Agent shall reference uploaded ARCHITECTURE_STANDARDS documents | Must | Via RAG |
| FR-035 | Architecture Agent shall produce integration patterns and migration approach | Should | |

### Module G: Context & Knowledge Management

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-036 | System shall allow upload of documents (PDF, DOCX, TXT, MD) for knowledge base | Must | |
| FR-037 | System shall allow URL/GitHub link fetch for knowledge base population | Must | POST /api/context/fetch-url |
| FR-038 | Documents shall be chunked (2k chars, 400 char overlap) and embedded via OpenAI | Must | text-embedding-3-small |
| FR-039 | System shall support 6 document categories: VSM_BENCHMARKS, TRANSFORMATION_CASE_STUDIES, ARCHITECTURE_STANDARDS, AGENT_OUTPUT, GENERAL, REGULATORY | Must | |
| FR-040 | RAG retrieval shall use hybrid BM25 + vector search with multi-query (3–5 queries) and top-25 deduped chunks | Must | |
| FR-041 | Agent outputs (discovery, VSM, future_state) shall be auto-saved as AGENT_OUTPUT context documents | Must | save_agent_context_doc() |

### Module H: Agent Orchestration

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-042 | All agents shall inject format_context_section(input_data, agent_type) for context awareness | Must | |
| FR-043 | System shall support HITL gates via LangGraph INTERRUPT nodes | Must | |
| FR-044 | Agent state shall be checkpointed to PostgreSQL on INTERRUPT | Must | |
| FR-045 | System shall store per-org per-agent learnings in agent_memories table | Must | |
| FR-046 | System shall compute accuracy scores per module (composite: confidence + source diversity + run success + human edit rate) | Must | 60s TTL cache |
| FR-047 | System shall maintain SHA-256 chained audit_logs for all agent runs | Must | Immutable |

### Module I: Reporting

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-048 | Executive Reporting Agent shall compile all agent outputs into structured report | Must | |
| FR-049 | System shall support export of reports to PDF | Should | |
| FR-050 | System shall display accuracy scores per module on dashboard | Must | |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-001 | Performance | Discovery agent execution time | < 30 seconds |
| NFR-002 | Performance | VSM agent execution time | < 45 seconds |
| NFR-003 | Performance | RAG retrieval latency | < 2 seconds |
| NFR-004 | Performance | API response time (non-agent) | < 500ms (p95) |
| NFR-005 | Performance | Page load time (initial) | < 3 seconds |
| NFR-006 | Performance | Dashboard render time | < 1.5 seconds |
| NFR-007 | Scalability | Concurrent agent executions per org | ≥ 5 |
| NFR-008 | Scalability | Organisations supported | ≥ 500 |
| NFR-009 | Scalability | Context documents per org | ≥ 10,000 |
| NFR-010 | Scalability | Vector index size | ≥ 5M chunks |
| NFR-011 | Reliability | Platform uptime | ≥ 99.5% |
| NFR-012 | Reliability | Agent retry on transient failure | 3 retries with exponential backoff |
| NFR-013 | Reliability | Data durability | PostgreSQL WAL, daily backups |
| NFR-014 | Security | Authentication | NextAuth JWT, httpOnly cookies |
| NFR-015 | Security | API authorisation | Org-scoped access control on all endpoints |
| NFR-016 | Security | Audit trail | Immutable SHA-256 chained log for all mutations |
| NFR-017 | Security | Secrets management | Environment variables, never in code |
| NFR-018 | Compliance | Data residency | Configurable per deployment |
| NFR-019 | Usability | Accessibility | WCAG 2.1 AA |
| NFR-020 | Observability | Health endpoint | GET /api/v1/health returns service status within 200ms |

---

## 8. User Interface Requirements

### 8.1 Layout

- Dark glassmorphism theme with `#0a0e12` background
- Fixed sidebar navigation with 10+ sections
- Entity selector (organisation) in header
- Responsive — desktop-first (1280px+ primary), tablet-supported

### 8.2 Navigation Structure

```
Sidebar:
├── Dashboard
├── Discovery
├── Value Stream Analysis
├── Future State
├── Risk & Compliance
├── Product Transformation
├── Architecture
├── Knowledge Base
├── Reports
└── Settings
    ├── Organisation
    ├── Repositories
    └── Members
```

### 8.3 Agent Execution Flow

1. User selects prerequisites (business segment, digital product)
2. User clicks "Run [Agent Name]" button
3. Modal opens showing agent progress steps
4. Streaming log displays agent reasoning (optional)
5. If HITL gate configured: execution pauses, user prompted to review
6. User approves or rejects with feedback
7. Results displayed in domain-specific view
8. Auto-save to knowledge base triggered
9. Accuracy score updated

### 8.4 Results Visualisation

- Discovery: Expandable tree of products → capabilities → functionalities
- VSM: Swim-lane process diagram with step metrics
- Future State: Timeline roadmap + metrics chart with confidence bands
- Risk: Heatmap matrix + sortable risk table
- Architecture: Card-based recommendation layout

---

## 9. Integration Requirements

| System | Integration Type | Purpose |
|--------|-----------------|---------|
| OpenAI API | REST, gpt-4o + text-embedding-3-small | Agent LLM inference + document embedding |
| PostgreSQL 18 | Direct connection (asyncpg) | Primary data store |
| pgvector extension | PostgreSQL extension | Vector similarity search |
| NextAuth.js | Library | Authentication, session management |
| Prisma ORM | Library | Schema management, migrations |
| LangGraph | Library | Agent graph orchestration |

---

## 10. Constraints & Assumptions

### Constraints

- **C1**: OpenAI API required — no local LLM support in v1
- **C2**: PostgreSQL 18 with pgvector extension required
- **C3**: Node.js 20+ required for Next.js 15
- **C4**: Python 3.11+ required for FastAPI/LangGraph service
- **C5**: Platform requires persistent database — no SQLite in production

### Assumptions

- **A1**: Users have valid OpenAI API keys with GPT-4o and embedding model access
- **A2**: PostgreSQL instance is managed by operations team
- **A3**: Initial deployment is single-region
- **A4**: Users operate in English (internationalisation not in scope for v1)
- **A5**: Organisations have ≤ 500 digital products per repository in v1

---

## 11. Out of Scope (v1)

| Item | Rationale |
|------|-----------|
| Real-time agent streaming output | Planned for v1.1 |
| Mobile application | Desktop-primary focus for v1 |
| SSO / SAML integration | v1.2 feature |
| Marketplace integrations (Jira, Confluence, Azure DevOps) | Year 2 roadmap |
| Local LLM support (Ollama, etc.) | Year 2 roadmap |
| Automated scheduling of agent runs | v1.1 feature |
| Multi-language support | Year 2 roadmap |
| Role-based access control (granular) | v1.1 feature |
| Agent marketplace (custom agents) | Year 3 roadmap |

---

## 12. Success Criteria & Acceptance Criteria

### 12.1 MVP Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| All 18 agents execute without errors on all 3 demo orgs | 100% pass rate in test suite |
| Discovery + VSM + Future State completes end-to-end in < 2 hours | Measured on US Bank demo org |
| RAG pipeline retrieves relevant context in > 80% of agent runs | Measured via chunk relevance sampling |
| Zero critical security vulnerabilities | Passing OWASP ZAP scan |
| Audit trail complete for all agent runs | SHA-256 chain verified |

### 12.2 Feature Acceptance Criteria

**AC — Discovery Agent**
- Given a business segment is selected, when Discovery Agent runs, then digital_products are persisted with correct business_segment tag
- Given Discovery completes, when user views results, then expandable tree shows products → capabilities → functionalities

**AC — VSM Agent**
- Given a digital product is selected, when VSM Agent runs, then value_stream_steps are persisted with cycle_time and waste indicators
- Given VSM completes, when user views swim lane, then each step shows metrics panel

**AC — RAG Pipeline**
- Given a PDF is uploaded, when embedding completes, then chunks are queryable via /api/context/search
- Given agent runs with uploaded benchmarks, when future state agent completes, then "Benchmark-grounded" badge is visible

**AC — HITL Gate**
- Given HITL is configured, when agent reaches checkpoint, then execution pauses and user is notified
- Given user rejects output, when feedback is submitted, then agent re-runs with feedback injected into prompt

**AC — Accuracy Score**
- Given an agent has completed runs, when user views dashboard, then accuracy score is displayed per module with components (confidence, source diversity, run success, human edit rate)
