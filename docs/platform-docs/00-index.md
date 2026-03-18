# TransformHub — Platform Documentation Index

**Version**: 1.0
**Last Updated**: 2026-03-12
**Total Documents**: 15

---

## Platform Overview

TransformHub is an enterprise-grade AI-powered digital transformation intelligence platform. It deploys 18 specialised LangGraph agents coordinated through a shared PostgreSQL knowledge base and hybrid RAG pipeline, enabling organisations to discover, analyse, plan, and monitor their digital transformation journeys.

**Stack**: Next.js 15 App Router + TypeScript + Tailwind v4 (`:3000`) | FastAPI + LangGraph 18 agents (`:8000`) | PostgreSQL 18 + pgvector

---

## Document Index

### Foundation

| # | Document | Description |
|---|----------|-------------|
| 01 | [Product Requirements Document (PRD)](./01-prd.md) | Executive summary, problem statement, functional requirements (FR-001–FR-050), non-functional requirements, integration requirements, success criteria |
| 02 | [Epics, Features & OKRs](./02-epics-features-okrs.md) | 8 epics × 4–6 features each, OKRs at epic and feature level, acceptance criteria, epic dependency map, release mapping |

### Architecture

| # | Document | Description |
|---|----------|-------------|
| 03 | [Functional Architecture](./03-functional-architecture.md) | Business capability model (L1/L2), 7 functional domains with I/O, functional flow diagrams (Mermaid), 30 business rules catalogue |
| 04 | [Technical Architecture](./04-technical-architecture.md) | C4 diagrams (System Context + Container + Component), full technology stack, frontend/backend/agent architecture, DB indexing, RAG pipeline, security, deployment |
| 05 | [Solution Architecture](./05-solution-architecture.md) | 15 Architecture Decision Records (ADRs), solution patterns, E2E flow, multi-tenancy, scalability, observability, disaster recovery, tradeoffs, future evolution |

### Delivery

| # | Document | Description |
|---|----------|-------------|
| 06 | [User Stories](./06-user-stories.md) | 55 user stories (US-001–US-055) across 8 epics with Given/When/Then acceptance criteria, story points, MoSCoW priority, summary table |
| 07 | [Wireframe Specifications](./07-wireframes.md) | ASCII wireframes for all 11 major screens with component inventory, interaction specifications, data displayed, responsive notes |
| 08 | [Sequence Diagrams](./08-sequence-diagrams.md) | 12 Mermaid sequence diagrams covering: auth, org setup, discovery, VSM, future state, RAG upload, RAG retrieval, HITL gate, agent memory, accuracy scoring, executive report, URL fetch |
| 09 | [Data Model](./09-data-model.md) | Full ER diagram, 17 table definitions with all columns/types/constraints, data dictionary, index strategy, pgvector configuration, migration strategy |

### Quality & Governance

| # | Document | Description |
|---|----------|-------------|
| 10 | [Test Plan](./10-test-plan.md) | Test strategy (pyramid), 5 test levels, 60 test cases (TC-001–TC-060), UAT plan, performance benchmarks, automation strategy, CI/CD integration |
| 11 | [Definition of Done](./11-definition-of-done.md) | Story/Feature/Epic/Release DoD checklists, agent-specific DoD, DoD by role, CI/CD quality gates, exceptions process |
| 12 | [Release Plan](./12-release-plan.md) | Release philosophy, roadmap (v0.1→v2.0), feature list per release, release criteria, deployment runbook, environment promotion, go-live checklist, hotfix process |
| 13 | [Risk Register](./13-risk-register.md) | Risk management framework, 40 risks (RISK-001–RISK-040) with likelihood/impact/exposure, heat map, top 10 critical risks, 5 response plans, monitoring and escalation matrix |
| 14 | [Multi-Agent Orchestration](./14-agent-orchestration.md) | All 18 agents documented: catalogue table, detailed per-agent sections, LangGraph state machine patterns, INTERRUPT/HITL pattern, RAG injection, agent memory, accuracy scoring, error handling, technology stack, orchestration sequence diagram, performance benchmarks |

---

## Quick Reference

### Key URLs (Local Development)
- Frontend: http://localhost:3000
- Agent Service: http://localhost:8000
- Health Check: http://localhost:8000/api/v1/health

### Demo Organisations
| Org | ID | Industry |
|-----|----|---------|
| US Bank | `46d310b9` | Banking |
| Telstra Health | `c6895660` | Healthcare |
| ING Bank | `e558b174` | Banking |

### 18 Agents Quick Reference
| Agent | Domain |
|-------|--------|
| Discovery | Digital product + capability mapping |
| Lean VSM | Value stream mapping + waste identification |
| Future State Vision | Transformation roadmap + projected metrics |
| Risk & Compliance | Risk identification + regulatory mapping |
| Product Transformation | Product modernisation strategy |
| Architecture | Technology architecture recommendations |
| Context Output | Agent output → AGENT_OUTPUT context docs |
| BM25 Retrieval | Keyword-based retrieval reranking |
| Org Context | Category-aware context budget allocation |
| Human Gate | LangGraph INTERRUPT for human review |
| Agent Memory | Per-org per-agent learning storage |
| Accuracy Scoring | Composite quality score per module |
| Audit Trail | SHA-256 chained immutable event log |
| Benchmark | Industry benchmark comparison |
| Capability Maturity | Maturity assessment scoring |
| Initiative Prioritisation | RICE-scored initiative ranking |
| Transformation Roadmap | Phased implementation planning |
| Executive Reporting | C-suite summary generation |

### DB Hierarchy
```
repositories (organization_id)
  └── digital_products (repository_id, business_segment)
        ├── digital_capabilities (digital_product_id)
        │     └── functionalities (digital_capability_id)
        └── product_groups (digital_product_id)
              └── value_stream_steps (product_group_id)
```

### Critical Rules
1. All queries must include `WHERE organization_id = $org_id`
2. Capability join: always `dc.digital_product_id = dp.id` (never reversed)
3. Context budget: 12k chars max, category-aware allocation
4. RAG retrieval: 3–5 queries per agent_type, top-25 deduped chunks
5. Chunks: 2k chars, 400 char overlap (text-embedding-3-small, 1536 dims)
6. Audit: every mutation writes SHA-256 chained audit_log entry
7. Accuracy cache TTL: 60 seconds
