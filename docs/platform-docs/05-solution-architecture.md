# TransformHub — Solution Architecture

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12

---

## Table of Contents

1. [Solution Overview](#1-solution-overview)
2. [Architecture Decision Records](#2-architecture-decision-records)
3. [Solution Patterns](#3-solution-patterns)
4. [End-to-End Solution Flow](#4-end-to-end-solution-flow)
5. [Agent Orchestration Solution](#5-agent-orchestration-solution)
6. [Multi-Tenancy Solution](#6-multi-tenancy-solution)
7. [Scalability Solution](#7-scalability-solution)
8. [Observability Solution](#8-observability-solution)
9. [Data Flow Architecture](#9-data-flow-architecture)
10. [Integration Architecture](#10-integration-architecture)
11. [Disaster Recovery & Resilience](#11-disaster-recovery--resilience)
12. [Solution Tradeoffs](#12-solution-tradeoffs)
13. [Future Architecture Evolution](#13-future-architecture-evolution)

---

## 1. Solution Overview

TransformHub solves the fundamental challenge of enterprise transformation opacity: organisations cannot continuously, affordably, and reliably assess their digital transformation state.

### The Core Solution

The platform addresses this through three interlocking layers:

**Layer 1 — Discovery & Analysis** (Agents 1–6)
Autonomous LangGraph agents scan, map, and analyse an organisation's digital landscape using a combination of AI reasoning and retrieved context from the knowledge base.

**Layer 2 — Knowledge Grounding** (Agents 7–9)
A hybrid RAG pipeline ensures every agent output is grounded in real benchmark data, case studies, and prior agent outputs — preventing hallucination and improving result quality with each engagement.

**Layer 3 — Trust & Governance** (Agents 10–13)
Human-in-the-loop gates, agent memory learning loops, accuracy scoring, and SHA-256 chained audit trails provide the governance layer that makes AI outputs credible at board level.

### How All Pieces Fit

```
┌──────────────────────────────────────────────────────────────────┐
│  USER ACTION: "Analyse transformation readiness for Product X"   │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                              │
│  User selects segment, product, clicks "Run Agent"               │
│  Next.js 15 App Router — dark glassmorphism UI                   │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP POST
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  AGENT SERVICE (FastAPI :8000)                                   │
│  1. Validate request, extract org_id from JWT                    │
│  2. Load org context from PostgreSQL                             │
│  3. Execute RAG retrieval (multi-query hybrid)                   │
│  4. Compile LangGraph agent graph                                │
│  5. Execute agent with context-injected prompt                   │
│  6. [Optional] Pause at HITL gate                                │
│  7. Persist results to PostgreSQL                                │
│  8. Auto-save output as AGENT_OUTPUT context doc                 │
│  9. Write audit log entry                                        │
│  10. Update accuracy score                                       │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  DATA LAYER (PostgreSQL 18 + pgvector)                           │
│  All state persisted: products, capabilities, VSM steps,         │
│  risk items, context chunks, memories, audit logs                │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  RESPONSE TO USER                                                │
│  Structured results rendered in domain view                      │
│  Accuracy score updated on dashboard                             │
│  Knowledge base enriched with agent output                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Decision Records

### ADR-001: LangGraph for Agent Orchestration

**Context**: Need for stateful, resumable agent workflows with HITL support.
**Decision**: Use LangGraph 0.18 as the agent orchestration framework.
**Consequences**:
- ✅ Native INTERRUPT support for human gates
- ✅ Checkpointing to PostgreSQL via AsyncPostgresSaver
- ✅ Clean state machine model maps well to transformation domains
- ⚠️ LangGraph API evolves quickly — version pinning required

---

### ADR-002: PostgreSQL as Sole Data Store

**Context**: Need persistence for relational data, vector embeddings, agent state, and audit logs.
**Decision**: Use PostgreSQL 18 with pgvector extension as the only data store.
**Consequences**:
- ✅ Single system to manage and back up
- ✅ pgvector integrates vector search into same ACID transactions
- ✅ AsyncPostgresSaver for LangGraph checkpoints
- ⚠️ Not optimised for high-frequency time-series or event streaming — future Redis needed for real-time

---

### ADR-003: FastAPI + asyncpg (Not Django/SQLAlchemy)

**Context**: Python backend needed for LangGraph integration; performance matters for concurrent agent runs.
**Decision**: FastAPI with asyncpg for direct async PostgreSQL access.
**Consequences**:
- ✅ 2–3× throughput improvement over sync ORMs
- ✅ Native async/await for concurrent agent execution
- ⚠️ No ORM query builder — all SQL written manually (intentional for precision)

---

### ADR-004: Next.js 15 App Router

**Context**: Need React SSR for fast initial loads with ability to call backend from server components.
**Decision**: Next.js 15 App Router with TypeScript.
**Consequences**:
- ✅ Server components reduce client bundle size
- ✅ Server Actions simplify data mutations
- ✅ Built-in route-level caching
- ⚠️ App Router is complex — significant learning curve for new developers

---

### ADR-005: Hybrid BM25 + Vector RAG

**Context**: Pure vector search misses keyword-specific queries (e.g., exact regulation names, product codes).
**Decision**: Hybrid BM25 + cosine similarity search with union + deduplication.
**Consequences**:
- ✅ Recall improvement: BM25 catches keyword matches vector misses and vice versa
- ✅ Hit-count scoring naturally surfaces chunks retrieved by multiple queries
- ⚠️ Doubles retrieval latency (two search paths) — mitigated by parallelism

---

### ADR-006: OpenAI GPT-4o + text-embedding-3-small

**Context**: Need capable LLM for reasoning and fast, cost-effective embedding model.
**Decision**: GPT-4o for inference, text-embedding-3-small (1536 dims) for embedding.
**Consequences**:
- ✅ State-of-the-art reasoning quality for transformation analysis
- ✅ 1536-dim embeddings balance quality and storage cost
- ⚠️ OpenAI vendor dependency — migration path to Azure OpenAI planned for v1.2

---

### ADR-007: SHA-256 Chained Audit Trail

**Context**: Need forensic-grade audit trail for board-level credibility.
**Decision**: SHA-256 hash chaining in audit_logs (each entry hashes prev_entry).
**Consequences**:
- ✅ Tamper evidence without external blockchain
- ✅ Lightweight — no additional infrastructure
- ⚠️ Sequential hash generation can be a write bottleneck at high volume

---

### ADR-008: Prisma for Schema Management (Frontend) + asyncpg for Runtime (Backend)

**Context**: Need both schema migration tooling and high-performance runtime queries.
**Decision**: Prisma handles migrations and generates type-safe client for Next.js; asyncpg used directly in FastAPI.
**Consequences**:
- ✅ Prisma migration history + type-safe schema
- ✅ asyncpg raw SQL for maximum performance in agent service
- ⚠️ Schema is "owned" by Prisma — FastAPI must not run its own migrations

---

### ADR-009: ivfflat pgvector Index

**Context**: Need vector index for approximate nearest neighbour search over 1536-dim embeddings.
**Decision**: Use ivfflat with lists=100.
**Consequences**:
- ✅ Supports up to ~1M vectors efficiently
- ✅ Simple to configure
- ⚠️ Recall drops above 1M vectors — plan migration to HNSW for v1.1

---

### ADR-010: JSONB for Business Segments

**Context**: Business segments are an ordered list that varies by organisation and changes over time.
**Decision**: Store segments as JSONB array in organisations.business_segments.
**Consequences**:
- ✅ Flexible schema — no need to migrate for segment changes
- ✅ Positional mapping supports cascade rename
- ⚠️ Cannot foreign-key constrain digital_products.business_segment to segments list

---

### ADR-011: NextAuth for Authentication

**Context**: Need secure auth for Next.js without building from scratch.
**Decision**: NextAuth.js v5 with CredentialsProvider + database sessions.
**Consequences**:
- ✅ Handles JWT, session rotation, CSRF automatically
- ✅ Extensible to OAuth providers in v1.2
- ⚠️ Sessions stored in PostgreSQL — adds DB dependency for auth

---

### ADR-012: Multi-Query RAG Strategy

**Context**: Single query retrieval misses relevant chunks when agent needs cross-cutting context.
**Decision**: Generate 3–5 queries per agent_type, union results, deduplicate, score by hit_count.
**Consequences**:
- ✅ Significantly improved recall
- ✅ Hit-count scoring surfaces most relevant chunks
- ⚠️ 3–5× retrieval calls — mitigated by async execution and < 2s SLA

---

### ADR-013: Category-Aware Context Budget

**Context**: Different agents need different types of context (VSM agent needs benchmarks, not architecture standards).
**Decision**: format_context_section() applies category-aware budget allocation up to 12k chars total.
**Consequences**:
- ✅ Most relevant document types get more context window space per agent
- ✅ Prevents context dilution from irrelevant document types
- ⚠️ Budget allocation requires maintenance as new agent_types are added

---

### ADR-014: Agent Memory Learning Loop

**Context**: Agents should improve with feedback, not repeat the same mistakes.
**Decision**: Save HITL rejection feedback and positive signals to agent_memories; inject on next run.
**Consequences**:
- ✅ Platform learns per-org preferences over time
- ✅ Reduces human edit rate with each engagement
- ⚠️ Memory poisoning risk if low-quality feedback is accepted — mitigated by confidence scoring

---

### ADR-015: Accuracy Score Composite Formula

**Context**: Users need to trust AI outputs; a single binary pass/fail is insufficient.
**Decision**: Composite accuracy score = weighted average of confidence, source_diversity, run_success_rate, and inverse human_edit_rate.
**Consequences**:
- ✅ Nuanced signal that improves over time
- ✅ Shown on dashboard to build user trust
- ⚠️ Formula requires calibration — early scores may not be meaningful until 10+ runs per module

---

## 3. Solution Patterns

### 3.1 RAG Pattern

The Retrieval-Augmented Generation pattern is applied uniformly across all analysis agents. The pattern:
1. Pre-retrieve relevant context from knowledge base
2. Format context with category-aware budget
3. Inject into LLM prompt as grounding
4. Generate analysis grounded in retrieved facts

This prevents hallucination and allows organisations to ground AI outputs in their own uploaded standards.

### 3.2 CQRS for Agents

Commands (agent runs, data mutations) flow through the FastAPI/LangGraph path. Queries (dashboard views, report generation) read directly from PostgreSQL via Prisma (Next.js) or asyncpg (FastAPI). This separation ensures agent execution does not contend with read workloads.

### 3.3 HITL Interrupt-and-Resume Pattern

LangGraph INTERRUPT nodes checkpoint state to PostgreSQL before pausing. On approval, the graph resumes from checkpoint. On rejection, feedback is injected and the graph re-runs from the generate node. This pattern ensures no work is lost and feedback is structurally integrated.

### 3.4 Repository Pattern

All database access in the agent service goes through repository functions in `routers/` and `agents/*/graph.py`. No raw SQL in business logic — always via typed async functions that enforce org_id scoping.

---

## 4. End-to-End Solution Flow

```
User → Browser → Next.js (App Router)
                    │
                    ├── Auth check (NextAuth session)
                    ├── Org context (OrganizationContext)
                    └── User action (e.g., "Run Discovery")
                              │
                              ▼
                         API Route (Next.js /api or Server Action)
                              │
                              ▼
                    FastAPI Agent Service (:8000)
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
            PostgreSQL              OpenAI API
          (load context)         (LLM inference)
                    │                    │
                    └─────────┬──────────┘
                              │
                    LangGraph Agent Execution
                              │
                    ┌─────────▼──────────┐
                    │   Agent Nodes      │
                    │ 1. load_context    │
                    │ 2. retrieve_rag    │
                    │ 3. generate        │
                    │ 4. [hitl_gate]     │
                    │ 5. persist         │
                    │ 6. save_to_context │
                    │ 7. audit_log       │
                    │ 8. update_accuracy │
                    └─────────┬──────────┘
                              │
                    Results persisted to PostgreSQL
                              │
                    Response returned to Next.js
                              │
                    UI updated with results + accuracy
```

---

## 5. Agent Orchestration Solution

### Agent Coordination Model

Agents do NOT call each other directly. They share state via PostgreSQL:
- Discovery output → persisted to digital_products, digital_capabilities
- VSM output → persisted to product_groups, value_stream_steps
- Future State reads VSM from DB → generates roadmap
- All outputs → saved as AGENT_OUTPUT context_documents for RAG use by subsequent agents

### Orchestration Sequence

```
1. Discovery Agent (required first)
   ↓ persists product/capability hierarchy
2. VSM Agent (requires Discovery output)
   ↓ persists value stream steps + waste items
3. Future State Agent (requires VSM output)
   ↓ generates roadmap using VSM + benchmarks
4. Risk Agent (parallel with Future State)
   ↓ generates risk register
5. Architecture Agent (parallel with Future State)
   ↓ generates tech recommendations
6. Executive Reporting Agent (requires all above)
   ↓ compiles all outputs into executive report
```

### Error Recovery

```python
# Canonical retry wrapper used in all agents
@retry(max_retries=3, backoff_factor=2.0)
async def execute_with_retry(graph, state, config):
    async for event in graph.astream(state, config):
        yield event
```

If all retries fail:
1. agent_run.status set to "failed"
2. Error details saved to agent_run.output_data
3. Checkpoint preserved for potential manual recovery
4. User notified with actionable error message

---

## 6. Multi-Tenancy Solution

### Data Isolation

Every table with org-owned data includes `organization_id UUID NOT NULL`. Every query in the application includes `WHERE organization_id = $org_id` enforced at the repository layer.

### Context Isolation

The RAG pipeline filters context_chunks by organization_id through the document join:
```sql
SELECT cc.* FROM context_chunks cc
JOIN context_documents cd ON cc.document_id = cd.id
WHERE cd.organization_id = $1
```

### Agent Memory Isolation

agent_memories are scoped by `(organization_id, agent_type)`. An org's learnings never bleed into another org's agent runs.

### Session-Based Org Binding

The active organisation is encoded in the JWT session. All API calls carry the JWT, and the FastAPI dependency `get_current_org_id()` extracts and validates the org_id, making cross-org access structurally impossible through normal API paths.

---

## 7. Scalability Solution

### Horizontal Scaling

- **FastAPI**: Stateless — run N instances behind a load balancer
- **Next.js**: Stateless — run N instances behind a load balancer
- **PostgreSQL**: Scale via read replicas for dashboard queries; write path remains single primary
- **pgvector**: ivfflat index supports multi-threaded reads

### Agent Parallelism

Multiple agents can run simultaneously for the same org (e.g., Risk + Architecture agents in parallel after Discovery+VSM complete). LangGraph instances are per-run, stateless within the execution.

### Connection Pooling

asyncpg pool (min=5, max=20) per agent service instance. At 4 instances, supports 80 concurrent DB connections — sufficient for hundreds of concurrent users.

### Context Size Management

Category-aware budget (12k chars) prevents context window overflow as knowledge base grows. The multi-query top-25 approach keeps retrieval bounded regardless of corpus size.

---

## 8. Observability Solution

### Logging

- FastAPI structured logging (JSON) with request_id, org_id, agent_type, duration_ms
- LangGraph event streaming logged per node execution
- Log levels: DEBUG (dev), INFO (staging/prod), ERROR (always)

### Accuracy Scoring

Per-module accuracy scores on dashboard give continuous quality signal:
```
accuracy_score = weighted_average(
    confidence_score * 0.4,
    source_diversity_score * 0.2,
    run_success_rate * 0.3,
    (1 - human_edit_rate) * 0.1
)
```

### Audit Trail

SHA-256 chained audit_logs provide complete forensic trail:
- Who triggered what, when
- Input data and output data of every agent run
- Hash chain verifiable from any audit entry backward to genesis

### Health Endpoint

`GET /api/v1/health` returns:
```json
{
  "status": "ok",
  "db": "connected",
  "agents_available": 18,
  "vector_index": "ready",
  "timestamp": "2026-03-12T10:00:00Z"
}
```

---

## 9. Data Flow Architecture

### Ingestion Flow

```
External Document/URL
       │
       ▼
text-extractor.ts (Next.js API route)
  - Extract text from PDF/DOCX/TXT/MD
  - Chunk: 2k chars, 400 char overlap
       │
       ▼
OpenAI text-embedding-3-small
  - 1536-dim vectors per chunk
       │
       ▼
PostgreSQL
  - context_documents (metadata)
  - context_chunks (text + embedding)
```

### Retrieval Flow

```
Agent Execution Request
       │
       ▼
Multi-Query Generation (agent_type → 3-5 queries)
       │
       ├── Vector Search (pgvector cosine similarity)
       └── BM25 Search (rank_bm25 over chunk texts)
               │
               ▼
          Union + Dedup + Hit Count Scoring
               │
               ▼
          Top-25 by Hit Count
               │
               ▼
          BM25 Reranking (lean_vsm, future_state)
               │
               ▼
          format_context_section() (category-aware, 12k budget)
               │
               ▼
          Injected into Agent Prompt
```

### Agent Output Flow

```
Agent Output Generated
       │
       ├── Persist to domain tables (products, capabilities, VSM steps, risks)
       ├── save_agent_context_doc() → AGENT_OUTPUT context_document + chunks
       ├── audit_log entry (SHA-256 chained)
       └── accuracy_cache update
               │
               ▼
       Next agent run retrieves prior output as RAG context
```

---

## 10. Integration Architecture

### OpenAI Integration

```python
# Inference
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "system", "content": context_injected_prompt}, ...]
)

# Embedding
embedding_response = await client.embeddings.create(
    model="text-embedding-3-small",
    input=chunk_texts  # batched
)
```

**Rate Limiting Strategy**:
- Retry on 429 with exponential backoff
- Batch embedding requests (100 chunks per API call)
- Agent execution serialised per org (prevent simultaneous GPT-4o calls exhausting quota)

### PostgreSQL Integration

```python
# asyncpg pool (agent service)
pool = await asyncpg.create_pool(dsn=DATABASE_URL, min_size=5, max_size=20)

# Parameterised query pattern
result = await pool.fetch(
    "SELECT * FROM digital_capabilities WHERE digital_product_id = $1",
    product_id
)
```

### NextAuth Integration

```typescript
// nextjs-app/src/lib/auth.ts
export const authOptions = {
  providers: [CredentialsProvider(...)],
  session: { strategy: "jwt" },
  callbacks: {
    jwt: ({ token, user }) => { ... },
    session: ({ session, token }) => { ... }
  }
}
```

---

## 11. Disaster Recovery & Resilience

### Agent Failure Recovery

| Failure Scenario | Recovery Mechanism |
|-----------------|-------------------|
| Transient OpenAI error | 3-retry exponential backoff |
| Agent timeout | LangGraph state saved; manual re-trigger |
| HITL gate timeout | State checkpointed indefinitely; resumes on user action |
| DB connection lost | asyncpg pool reconnect; request retried |
| FastAPI crash | Stateless; restart from container orchestrator; no lost state |

### Data Durability

- PostgreSQL WAL (Write-Ahead Logging) enabled
- Daily pg_dump backups to object storage
- pgvector index can be rebuilt from context_chunks table

### Checkpoint Recovery

LangGraph checkpoints in PostgreSQL `agent_checkpoints` table:
```sql
-- Resume paused agent
SELECT * FROM agent_checkpoints WHERE run_id = $1 ORDER BY created_at DESC LIMIT 1;
```

---

## 12. Solution Tradeoffs

| Decision | Chosen | Alternative | Why Chosen |
|----------|--------|-------------|-----------|
| Agent orchestration | LangGraph | Celery + tasks | LangGraph provides native INTERRUPT, state machine model, checkpointing |
| Primary data store | PostgreSQL | Redis + PostgreSQL | Single system; pgvector integrates; ACID for audit trail |
| Vector database | pgvector | Pinecone / Weaviate | No additional infrastructure; tight ACID integration; sufficient at scale |
| Backend framework | FastAPI + asyncpg | Django + SQLAlchemy | 3× async throughput; direct SQL for precision |
| Frontend | Next.js 15 | React SPA + Express | App Router SSR; server components reduce bundle; integrated auth |
| Auth | NextAuth | Auth0 / Cognito | No external SaaS dependency; full data control; cost |
| Embedding model | text-embedding-3-small | text-embedding-3-large | 3× cost reduction; 1536 dims sufficient for transformation domain |
| Chunking strategy | 2k/400 overlap | 1k/200 overlap | Larger chunks preserve reasoning context across sentences |

---

## 13. Future Architecture Evolution

### v1.1 (Months 7-8)
- **HNSW pgvector index**: Replace ivfflat with HNSW for better recall at > 1M vectors
- **Real-time streaming**: Replace polling with SSE for agent progress streaming
- **Redis cache**: Offload accuracy cache and session data from PostgreSQL
- **Role-based access control**: Granular permissions per org member

### v1.2 (Months 9-10)
- **Azure OpenAI**: Add Azure OpenAI as alternative to OpenAI direct — data residency compliance
- **SSO / SAML**: Enterprise SSO integration via NextAuth OAuth providers
- **Multi-region PostgreSQL**: Read replicas per region for latency

### v2.0 (Month 12+)
- **Agent marketplace**: Custom agent framework enabling clients to add domain-specific agents
- **Jira/Confluence integration**: Bidirectional sync of initiatives and documentation
- **Predictive risk scoring**: ML model trained on historical transformation data
- **Multi-model support**: Add Anthropic Claude as alternative inference provider
