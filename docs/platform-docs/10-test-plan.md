# TransformHub — Test Plan

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12

---

## Table of Contents

1. [Test Strategy Overview](#1-test-strategy-overview)
2. [Test Levels](#2-test-levels)
3. [Test Cases by Feature](#3-test-cases-by-feature)
4. [Test Data Management](#4-test-data-management)
5. [Test Environment Setup](#5-test-environment-setup)
6. [Defect Management Process](#6-defect-management-process)
7. [Test Metrics & KPIs](#7-test-metrics--kpis)
8. [Automation Strategy](#8-automation-strategy)
9. [Performance Benchmarks](#9-performance-benchmarks)
10. [UAT Plan](#10-uat-plan)

---

## 1. Test Strategy Overview

### Testing Pyramid

```
           /\
          /E2E\        5% — Playwright e2e (critical user journeys)
         /──────\
        /Integr. \     25% — API + DB + Agent integration tests
       /──────────\
      /  Unit Tests\   70% — Component, function, agent node tests
     /______________\
```

### Scope

**In Scope**:
- All 18 LangGraph agents
- FastAPI REST endpoints (50+ routes)
- Next.js pages and components
- RAG pipeline (chunking, embedding, retrieval)
- HITL gate mechanics
- Agent memory injection
- Accuracy score calculation
- SHA-256 audit chain
- Authentication and authorisation

**Out of Scope**:
- OpenAI API internal reliability (mocked)
- PostgreSQL internals
- Browser compatibility beyond Chrome/Firefox/Safari latest

### Test Objectives

1. Verify all 18 agents execute without errors on all 3 demo orgs
2. Validate RAG pipeline retrieves relevant context in > 80% of agent runs
3. Confirm HITL gate pause/resume works correctly
4. Verify audit chain integrity
5. Validate multi-tenancy data isolation
6. Confirm performance SLAs are met

### Tools

| Layer | Tool | Version |
|-------|------|---------|
| Frontend Unit | Jest + React Testing Library | Jest 29+ |
| Frontend E2E | Playwright | 1.40+ |
| Backend Unit | pytest | 8.x |
| Backend Integration | pytest + pytest-asyncio | — |
| API Testing | httpx (pytest) / Postman | — |
| Performance | Locust (load) + pytest-benchmark | — |
| Security | OWASP ZAP (DAST) | — |
| Coverage | pytest-cov (backend) / Istanbul (frontend) | — |

---

## 2. Test Levels

### 2.1 Unit Tests

**Frontend (Jest)**:
- React component rendering (snapshot + behaviour)
- OrganizationContext state management
- API client helper functions
- Utility functions (formatters, validators)
- RAG execute/route.ts chunking and dedup logic

**Backend (pytest)**:
- Agent node functions (load_context, retrieve_rag, persist)
- BM25 retrieval scoring
- format_context_section category budget allocation
- Accuracy score formula
- SHA-256 hash chain generation and verification
- Pydantic schema validation for agent inputs/outputs
- Organisation segment rename cascade logic

**Target Coverage**: ≥ 80% line coverage

---

### 2.2 Integration Tests

**API Layer**:
- All 50+ FastAPI endpoints with real test DB
- Auth middleware (valid/invalid/expired JWT)
- Org-scoped access control (org isolation)
- File upload and URL fetch endpoints
- Agent run create/read/update

**Agent Integration**:
- Discovery agent full graph execution (with mock OpenAI)
- VSM agent capability join correctness
- Future State agent projected_metrics schema
- HITL checkpoint save/resume
- Agent memory injection into prompt

**RAG Pipeline Integration**:
- End-to-end: upload → chunk → embed → retrieve
- Multi-query deduplication
- Category-aware budget formatting
- Fallback retrieval when no results

**Target**: All critical paths covered; no orphaned API routes

---

### 2.3 End-to-End Tests (Playwright)

Critical user journeys:
1. Login → Dashboard → Run Discovery → View results
2. Run VSM → View swim lane → Identify waste
3. Upload benchmark → Run Future State → See benchmark badge
4. HITL: Run agent → Pause → Reject → Re-run with feedback
5. Export executive report as PDF

---

### 2.4 Performance Tests (Locust)

- 50 concurrent users — dashboard load
- 10 concurrent agent runs — agent service throughput
- 1000-chunk document upload — embedding pipeline
- RAG retrieval with 100k chunks in index

---

### 2.5 Security Tests (OWASP ZAP)

- SQL injection on all input fields
- XSS on text inputs
- CSRF protection
- Auth bypass attempts
- Cross-org data access attempts

---

## 3. Test Cases by Feature

| TC-ID | Feature | Test Description | Steps | Expected Result | Priority |
|-------|---------|-----------------|-------|-----------------|---------|
| TC-001 | Auth | Valid login | Enter valid creds, click Sign In | Redirect to /dashboard, session cookie set | P0 |
| TC-002 | Auth | Invalid password | Enter wrong password | Error "Invalid email or password", no redirect | P0 |
| TC-003 | Auth | Expired session | Wait for session expiry | Redirect to login page | P0 |
| TC-004 | Auth | CSRF protection | Submit form without CSRF token | 403 Forbidden | P1 |
| TC-005 | Org | Create organisation | POST /api/v1/organizations with valid payload | 201 Created, org appears in list | P0 |
| TC-006 | Org | Duplicate name | POST with existing org name | 409 Conflict with error message | P1 |
| TC-007 | Org | Segment rename cascade | Rename segment, check digital_products | All products with old segment updated | P0 |
| TC-008 | Org | Cross-org access | User A tries to access Org B's data | 403 Forbidden, no data returned | P0 |
| TC-009 | Org | Demo org auto-select | Clear localStorage, load app | US Bank org auto-selected | P1 |
| TC-010 | Discovery | Run agent success | POST /execute with valid org+segment | 200 OK, products persisted in DB | P0 |
| TC-011 | Discovery | Segment tagging | Run discovery with "Retail Banking" selected | All products have business_segment="Retail Banking" | P0 |
| TC-012 | Discovery | Default segment | Run without segment selection | Products tagged with org's first segment | P0 |
| TC-013 | Discovery | Capability join | Load capabilities for product | Loaded via dc.digital_product_id = $product_id | P0 |
| TC-014 | Discovery | Auto-save context | Discovery completes | AGENT_OUTPUT context_document created | P0 |
| TC-015 | Discovery | Accuracy score | Discovery completes | accuracy_cache updated within 5 seconds | P1 |
| TC-016 | Discovery | Agent retry | OpenAI returns 503 | Agent retries 3× with backoff, then fails gracefully | P1 |
| TC-017 | VSM | Run agent | POST lean-vsm/execute for valid product | 200 OK, value_stream_steps persisted | P0 |
| TC-018 | VSM | Capability join direction | VSM agent loads capabilities | Uses dc.digital_product_id join, not reversed | P0 |
| TC-019 | VSM | Name→ID lookup | AI returns capability names in output | Correctly resolved to capability IDs before persist | P0 |
| TC-020 | VSM | Waste identification | VSM output includes waste_items | Each waste has category, description, impact | P0 |
| TC-021 | VSM | BM25 reranking | VSM agent retrieves context | BM25 reranking applied to top-25 chunks | P1 |
| TC-022 | VSM | Swim lane order | View VSM results | Steps displayed in sequence_order | P1 |
| TC-023 | Future State | Benchmark-grounded | Upload VSM_BENCHMARKS doc, run agent | projected_metrics includes 3 bands, benchmark_grounded=true | P0 |
| TC-024 | Future State | No benchmarks | Run without benchmark docs | projected_metrics uses multipliers, "Estimated" label shown | P0 |
| TC-025 | Future State | Badge display | Future State page loads with agent metrics | "🎯 Benchmark-grounded" badge visible | P0 |
| TC-026 | Future State | Fallback display | Future State page loads without agent metrics | Falls back to multiplier-based display | P0 |
| TC-027 | Risk | Join direction | Risk agent loads capabilities | Uses dc.digital_product_id join correctly | P0 |
| TC-028 | Risk | Risk severity | Risk agent completes | Each risk has likelihood × impact = severity | P1 |
| TC-029 | RAG | Document upload | Upload PDF | Chunks created with 2k chars, 400 overlap | P0 |
| TC-030 | RAG | Embedding stored | Upload completes | context_chunks rows have non-null embeddings | P0 |
| TC-031 | RAG | URL fetch | POST /api/context/fetch-url with GitHub URL | Content fetched, chunked, embedded | P0 |
| TC-032 | RAG | Category filter | Upload with VSM_BENCHMARKS category | Only VSM_BENCHMARKS chunks returned when filtering | P1 |
| TC-033 | RAG | Multi-query | Agent executes | 3–5 queries generated per agent_type | P0 |
| TC-034 | RAG | Deduplication | Multi-query returns same chunk twice | Chunk deduplicated, hit_count = 2 | P0 |
| TC-035 | RAG | Top-25 limit | Agent retrieves context | Exactly 25 chunks maximum injected | P0 |
| TC-036 | RAG | Fallback trigger | No relevant chunks found | 25 most recent chunks returned | P0 |
| TC-037 | RAG | Context budget | format_context_section called | Total injected context ≤ 12k chars | P0 |
| TC-038 | RAG | Org isolation | Org A's chunks not retrieved by Org B | Vector search filters by org_id | P0 |
| TC-039 | HITL | Gate pause | Agent reaches INTERRUPT node | Status = awaiting_review, checkpoint saved | P0 |
| TC-040 | HITL | Approve resumes | User approves HITL gate | Agent resumes from checkpoint, completes | P0 |
| TC-041 | HITL | Reject re-runs | User rejects with feedback | Agent re-runs with feedback injected | P0 |
| TC-042 | HITL | Feedback memory | HITL rejection submitted | Feedback saved to agent_memories | P0 |
| TC-043 | Memory | Injection | Agent runs for org with memories | Memories injected into system prompt | P0 |
| TC-044 | Memory | Org isolation | Org A memory not used by Org B | memory.organization_id filter enforced | P0 |
| TC-045 | Accuracy | Score computation | Agent run completes | Composite score = confidence×0.4 + diversity×0.2 + success×0.3 + edit×0.1 | P0 |
| TC-046 | Accuracy | TTL cache | Score requested twice within 60s | Second request returns cached value | P1 |
| TC-047 | Accuracy | Display | Dashboard loads | Each module shows accuracy % | P1 |
| TC-048 | Audit | Entry created | Any agent run | audit_log entry created with correct fields | P0 |
| TC-049 | Audit | Hash chain | Sequential audit entries | hash = SHA256(prev_hash + payload) | P0 |
| TC-050 | Audit | Tamper detect | Modify an audit_log row externally | Hash chain verification fails | P0 |
| TC-051 | Auth | Org isolation | JWT for Org A | Cannot access Org B endpoints | P0 |
| TC-052 | API | Health check | GET /api/v1/health | 200 OK within 200ms | P0 |
| TC-053 | API | Pagination | GET /context/documents?page=2&page_size=5 | Returns items 6-10 with total count | P1 |
| TC-054 | API | Error format | Send invalid payload | Response is {error, code, details} | P1 |
| TC-055 | E2E | Full discovery journey | Login → org select → run discovery → view tree | Tree shows products and capabilities | P0 |
| TC-056 | E2E | Full VSM journey | Select product → run VSM → view swim lane | Swim lane with step metrics visible | P0 |
| TC-057 | E2E | HITL journey | Run agent → reject → re-run | Feedback incorporated, re-run completes | P0 |
| TC-058 | E2E | Knowledge base journey | Upload doc → verify chunks → run agent | Agent run references uploaded doc content | P0 |
| TC-059 | Perf | Discovery agent | Trigger discovery | Completes within 30 seconds | P0 |
| TC-060 | Perf | RAG retrieval | Execute RAG query | Returns within 2 seconds | P0 |

---

## 4. Test Data Management

### Demo Organisation Seeds

Three seed organisations provide test data:
```bash
# Seed all demo orgs
cd agent-service
python -m app.scripts.seed_demo_orgs

# Orgs seeded:
# - US Bank: id=46d310b9, segments=[Retail Banking, Institutional Banking, Wealth Management]
# - Telstra Health: id=c6895660, segments=[Digital Health, Provider Services, Insurance]
# - ING Bank: id=e558b174, segments=[Personal Banking, Business Banking]
```

### Test Database

- Separate `transformhub_test` PostgreSQL database
- Reset between integration test suites: `TRUNCATE ... CASCADE`
- pgvector extension must be installed in test DB

### Mock OpenAI

All unit and integration tests mock OpenAI:
```python
@pytest.fixture
def mock_openai(mocker):
    mock = mocker.patch("app.agents.discovery.graph.AsyncOpenAI")
    mock.return_value.chat.completions.create.return_value = MockDiscoveryResponse()
    return mock
```

### Playwright Test Data

Playwright tests use the seeded US Bank demo org for all e2e tests. Tests clean up created data after each test run.

---

## 5. Test Environment Setup

### Local Development

```bash
# Backend tests
cd agent-service
source venv/bin/activate
pytest tests/ -v --cov=app --cov-report=html

# Frontend tests
cd nextjs-app
npm test

# E2E tests
cd nextjs-app
npx playwright test
```

### Environment Variables (Test)

```env
DATABASE_URL=postgresql://transformhub:password@localhost:5432/transformhub_test
OPENAI_API_KEY=sk-test-MOCK  # Mocked in tests
NEXTAUTH_SECRET=test-secret-do-not-use-in-prod
NEXTAUTH_URL=http://localhost:3000
AGENT_SERVICE_URL=http://localhost:8000
```

### CI/CD (GitHub Actions)

```yaml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: pgvector/pgvector:pg18
      env:
        POSTGRES_PASSWORD: password
  steps:
    - uses: actions/checkout@v4
    - name: Run backend tests
      run: cd agent-service && pip install -r requirements.txt && pytest
    - name: Run frontend tests
      run: cd nextjs-app && npm ci && npm test
    - name: Run E2E tests
      run: cd nextjs-app && npx playwright test
```

---

## 6. Defect Management Process

### Severity Levels

| Level | Description | SLA (Fix) | Example |
|-------|-------------|-----------|---------|
| S1 Critical | Platform unusable, data loss, security breach | 4 hours | Authentication bypass, data corruption |
| S2 High | Core feature broken, no workaround | 24 hours | Discovery agent fails, HITL gate broken |
| S3 Medium | Feature degraded, workaround exists | 72 hours | Incorrect accuracy score, UI display error |
| S4 Low | Minor cosmetic or UX issue | Next sprint | Label typo, tooltip formatting |

### Triage Process

1. Defect submitted with: title, severity, steps to reproduce, expected vs actual, environment
2. Triage meeting daily (S1/S2 immediately)
3. Assigned to owning squad
4. Fix verified in test environment before production

---

## 7. Test Metrics & KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unit test coverage (backend) | ≥ 80% | pytest-cov |
| Unit test coverage (frontend) | ≥ 70% | Istanbul |
| Integration test pass rate | 100% | CI/CD pipeline |
| E2E test pass rate | ≥ 95% | Playwright reporter |
| Defect escape rate | < 5% | Defects found in prod / total defects |
| Mean time to fix (S2) | < 24 hours | Jira metrics |
| Test execution time (CI) | < 10 minutes | GitHub Actions timer |

---

## 8. Automation Strategy

### What to Automate

| Test Type | Automate? | Tool | Rationale |
|-----------|-----------|------|-----------|
| Unit tests (all) | Yes | Jest, pytest | Fast, stable, high ROI |
| API integration tests | Yes | pytest + httpx | Reliable, fast |
| Agent graph integration | Yes | pytest-asyncio | Critical path |
| Critical E2E journeys (5) | Yes | Playwright | Smoke test on every deploy |
| Full E2E suite (30+) | Partial | Playwright | Run nightly |
| Performance tests | Yes (nightly) | Locust | Regression detection |
| Security scans | Yes (weekly) | OWASP ZAP | Automated DAST |

### CI/CD Integration

```
PR → Lint + Unit Tests + Integration Tests (< 5 min) → Pass required to merge
Merge to main → Full test suite (< 10 min) → Deploy to staging
Deploy to staging → E2E smoke tests → Auto-deploy to prod (if passes)
Nightly → Full E2E + Performance + Security scans
```

---

## 9. Performance Benchmarks

| Scenario | Target | Measurement Method |
|----------|--------|-------------------|
| Discovery agent execution | < 30 seconds | Timer from POST to 200 OK |
| VSM agent execution | < 45 seconds | Timer from POST to 200 OK |
| Future State agent execution | < 60 seconds | Timer from POST to 200 OK |
| RAG retrieval (25 chunks) | < 2 seconds | Timer from query start |
| Document upload + embed (100 chunks) | < 60 seconds | Timer from upload to indexed status |
| Dashboard page load | < 3 seconds | Lighthouse / Playwright |
| API response (non-agent) | < 500ms P95 | Locust P95 |
| Health endpoint | < 200ms | P99 |
| pgvector query (1M vectors) | < 500ms | Direct DB benchmark |
| Concurrent agent runs (10) | No degradation > 20% | Locust concurrent users |

---

## 10. UAT Plan

### UAT Participants

| Role | Responsibility | Count |
|------|---------------|-------|
| CDO / VP Digital | Executive report validation | 2 |
| Business Architect | Discovery + VSM accuracy validation | 3 |
| Technology Consultant | Full workflow validation | 2 |
| Risk Officer | Risk agent output validation | 1 |

### UAT Test Cases

| UAT-ID | Scenario | Acceptor | Pass Criteria |
|--------|----------|----------|---------------|
| UAT-001 | Complete discovery for US Bank Retail Banking segment | Business Architect | Products match known US Bank digital landscape |
| UAT-002 | VSM analysis for Online Banking Portal | Business Architect | Steps and waste items reflect real process knowledge |
| UAT-003 | Future State with uploaded banking benchmarks | VP Digital | Projected metrics are plausible and benchmark-cited |
| UAT-004 | HITL rejection flow with meaningful feedback | VP Digital | Re-run output incorporates feedback correctly |
| UAT-005 | Risk assessment for Core Banking system | Risk Officer | Regulatory mappings are accurate (APRA, PCI-DSS) |
| UAT-006 | Executive report generation and PDF export | CDO | Report is board-presentable without manual editing |
| UAT-007 | Consultant manages 3 client orgs simultaneously | Consultant | Context switching works correctly, no data bleed |
| UAT-008 | Knowledge base: upload + verify agent uses content | Consultant | Subsequent agent run references uploaded document |

### Sign-off Criteria

- ≥ 90% of UAT test cases pass
- No S1/S2 defects open
- CDO and VP Digital sign off on report quality
- All performance benchmarks met in UAT environment
