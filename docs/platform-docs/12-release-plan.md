# TransformHub — Release Plan

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12

---

## Table of Contents

1. [Release Philosophy](#1-release-philosophy)
2. [Release Roadmap](#2-release-roadmap)
3. [Feature List per Release](#3-feature-list-per-release)
4. [Release Criteria](#4-release-criteria)
5. [Deployment Process](#5-deployment-process)
6. [Environment Promotion](#6-environment-promotion)
7. [Communication Plan](#7-communication-plan)
8. [Go-Live Checklist](#8-go-live-checklist)
9. [Post-Release Monitoring](#9-post-release-monitoring)
10. [Hotfix Process](#10-hotfix-process)

---

## 1. Release Philosophy

### Continuous Delivery

TransformHub follows a continuous delivery model:
- Every commit to `main` is deployable
- Feature flags control production visibility of incomplete features
- Deployments are frequent (multiple times per week)
- Releases are semantic-versioned milestones, not deployment events

### Semantic Versioning

`MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking API or schema changes requiring client action
- **MINOR**: New features, backward-compatible changes
- **PATCH**: Bug fixes, performance improvements, no new features

### Feature Flags

Environment variable–controlled flags for in-progress features:
```env
ENABLE_EXECUTIVE_REPORTING=false
ENABLE_REAL_TIME_STREAMING=false
ENABLE_SSO=false
```

---

## 2. Release Roadmap

| Release | Version | Theme | Target Month | Status |
|---------|---------|-------|-------------|--------|
| MVP | v0.1 | Core foundation: org setup, discovery, basic VSM | Month 1–2 | ✅ Done |
| Alpha | v0.5 | Full agent suite, RAG, HITL | Month 3–4 | ✅ Done |
| GA | v1.0 | All 18 agents, accuracy scoring, reporting | Month 5–6 | 🔄 In Progress |
| Enhancements | v1.1 | Performance, advanced RAG, RBAC, streaming | Month 7–8 | Planned |
| Enterprise | v1.2 | SSO, multi-region, Azure OpenAI, export v2 | Month 9–10 | Planned |
| Platform | v2.0 | Marketplace, real-time, Jira/Confluence | Month 12+ | Future |

### Visual Timeline

```
M1  M2  M3  M4  M5  M6  M7  M8  M9  M10  M12+
|── v0.1 ──|── v0.5 ──|── v1.0 ──|── v1.1 ──|── v1.2 ──|── v2.0+
  MVP        Alpha      GA         Enhancements Enterprise Platform
```

---

## 3. Feature List per Release

### v0.1 (MVP) — Done

| Feature | Status | Notes |
|---------|--------|-------|
| Organisation creation and management | ✅ | |
| Business segment configuration | ✅ | |
| Repository management | ✅ | |
| Demo orgs: US Bank, Telstra Health, ING Bank | ✅ | 3 demo orgs seeded |
| Discovery Agent | ✅ | 18 agents framework |
| Lean VSM Agent | ✅ | |
| Next.js dark glassmorphism UI | ✅ | |
| FastAPI + LangGraph backend | ✅ | |
| PostgreSQL + pgvector | ✅ | |
| NextAuth authentication | ✅ | |
| Basic RAG pipeline (vector only) | ✅ | |
| Document upload + embedding | ✅ | |

### v0.5 (Alpha) — Done

| Feature | Status | Notes |
|---------|--------|-------|
| Future State Vision Agent | ✅ | |
| Risk & Compliance Agent | ✅ | |
| Product Transformation Agent | ✅ | |
| Architecture Agent | ✅ | |
| BM25 hybrid RAG retrieval | ✅ | bm25_retrieval.py |
| Multi-query RAG (3–5 queries) | ✅ | execute/route.ts |
| HITL gates (LangGraph INTERRUPT) | ✅ | |
| Agent memory learning loop | ✅ | agent_memories table |
| Context document categories (6) | ✅ | |
| URL fetch for knowledge base | ✅ | POST /api/context/fetch-url |
| Benchmark-grounded future state | ✅ | projected_metrics with 3 bands |
| Org context format_context_section | ✅ | category-aware budget |
| SHA-256 chained audit trail | ✅ | |
| Org segment rename cascade | ✅ | |

### v1.0 (GA) — In Progress

| Feature | Status | Target |
|---------|--------|--------|
| Executive Reporting Agent | 🔄 | Month 5 |
| Initiative Prioritisation Agent | 🔄 | Month 5 |
| Transformation Roadmap Agent | 🔄 | Month 5 |
| Capability Maturity Agent | 🔄 | Month 5 |
| Benchmark Agent | 🔄 | Month 5 |
| Agent Memory Agent (dedicated) | 🔄 | Month 5 |
| Accuracy Scoring Agent | 🔄 | Month 5 |
| Human Gate Agent | 🔄 | Month 5 |
| Accuracy score dashboard display | 🔄 | Month 5 |
| Executive report PDF export | 🔄 | Month 6 |
| Historical run comparison | 🔄 | Month 6 |
| OWASP ZAP security scan pass | 🔄 | Month 6 |
| Performance benchmarks met (all) | 🔄 | Month 6 |

### v1.1 (Enhancements) — Planned

| Feature | Status | Target |
|---------|--------|--------|
| Real-time agent progress streaming (SSE) | Planned | Month 7 |
| HNSW pgvector index (vs ivfflat) | Planned | Month 7 |
| Redis cache for accuracy scores | Planned | Month 7 |
| Granular RBAC (viewer/editor/admin) | Planned | Month 7 |
| Member invitation and management | Planned | Month 7 |
| Agent run scheduling (cron) | Planned | Month 8 |
| Discovery incremental re-run | Planned | Month 8 |
| VSM step manual editing UI | Planned | Month 8 |
| Knowledge base full-text search | Planned | Month 8 |
| Report share link | Planned | Month 8 |

### v1.2 (Enterprise) — Planned

| Feature | Status | Target |
|---------|--------|--------|
| SSO / SAML via NextAuth OAuth | Planned | Month 9 |
| Azure OpenAI integration | Planned | Month 9 |
| Data residency configuration | Planned | Month 9 |
| Multi-region read replicas | Planned | Month 10 |
| Advanced PDF export (branded templates) | Planned | Month 10 |
| Audit log export (CSV/PDF) | Planned | Month 10 |
| Bulk document upload | Planned | Month 10 |

### v2.0 (Platform) — Future

| Feature | Status | Target |
|---------|--------|--------|
| Custom agent framework / marketplace | Future | Month 12 |
| Jira bidirectional integration | Future | Month 12 |
| Confluence integration | Future | Month 13 |
| Azure DevOps integration | Future | Month 14 |
| Predictive transformation risk scoring | Future | Month 15 |
| Mobile-responsive UI | Future | Month 12 |
| Multi-model support (Claude, Gemini) | Future | Month 14 |

---

## 4. Release Criteria

### v0.1 (MVP) Criteria — (ACHIEVED)
- All 3 demo orgs seed without error
- Discovery + VSM agents execute end-to-end
- Authentication works with valid credentials
- Platform accessible at http://localhost:3000

### v0.5 (Alpha) Criteria — (ACHIEVED)
- All 6 core domain agents execute on all 3 demo orgs
- HITL gate pause/resume verified
- RAG pipeline retrieves relevant context
- Benchmark-grounded future state confirmed with test docs

### v1.0 (GA) Criteria
- [ ] All 18 agents execute without S1/S2 bugs
- [ ] Unit test coverage ≥ 80% backend
- [ ] All performance benchmarks met (agent < 60s, RAG < 2s, API < 500ms)
- [ ] OWASP ZAP scan: no High or Critical findings
- [ ] 3 UAT users sign off on output quality
- [ ] Executive report PDF export functional
- [ ] Zero open S1 bugs, < 5 open S2 bugs

### v1.1 Criteria
- [ ] All v1.0 criteria maintained
- [ ] Real-time streaming tested with 20 concurrent users
- [ ] RBAC tested: viewer cannot trigger agent runs
- [ ] Redis cache reduces accuracy_cache DB queries by ≥ 80%

### v1.2 Criteria
- [ ] SSO tested with at least one enterprise SAML provider (Okta or Azure AD)
- [ ] Azure OpenAI integration tested (same outputs as OpenAI direct)
- [ ] Data residency config tested (EU-only mode)

---

## 5. Deployment Process

### Standard Deployment Runbook

```bash
# 1. Pre-deployment checks
git log --oneline -10           # Review changes
git status                      # Confirm clean working directory
npm run test                    # Frontend tests
pytest tests/                   # Backend tests

# 2. Database migrations
cd nextjs-app
npx prisma migrate deploy       # Apply pending migrations
npx prisma generate             # Regenerate client

# 3. Build frontend
npm run build                   # Next.js production build
npm run start                   # Verify build starts

# 4. Build + start agent service
cd agent-service
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000  # or via process manager

# 5. Verify health
curl http://localhost:8000/api/v1/health
# Expected: {"status": "ok", "db": "connected"}

# 6. Smoke tests
# Run 5 critical Playwright smoke tests
npx playwright test --grep @smoke

# 7. Update documentation
# Update MEMORY.md if architecture changed
```

### Rollback Procedure

```bash
# If deployment fails:
# 1. Revert to previous Docker image (if containerised)
docker pull transformhub:previous-tag && docker-compose up -d

# 2. Rollback database migration (if reversible)
npx prisma migrate reset --skip-seed  # CAUTION: only if migration is reversible

# 3. If data is corrupted: restore from backup
pg_restore -d transformhub /backups/transformhub_YYYY-MM-DD.dump
```

---

## 6. Environment Promotion

```
Developer local
    │  (passes unit tests)
    ▼
Feature branch PR
    │  (passes lint, unit, integration)
    ▼
main branch
    │  (passes full test suite, < 10 min)
    ▼
staging environment
    │  (E2E tests, performance tests, OWASP scan)
    ▼
production environment
    │  (smoke tests, monitoring checks)
    ▼
Release tagged (v1.0, v1.1, ...)
```

### Environment Configuration

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| DATABASE_URL | localhost:5432/transformhub | staging-db | prod-db |
| OPENAI_API_KEY | real key | real key | real key |
| LOG_LEVEL | DEBUG | INFO | INFO |
| NEXTAUTH_URL | http://localhost:3000 | https://staging.transformhub.io | https://app.transformhub.io |

---

## 7. Communication Plan

### Internal Communications

| Audience | Channel | Frequency | Content |
|---------|---------|-----------|---------|
| Dev team | Slack #dev | On merge to main | Auto-notification with changes |
| Product/Design | Slack #product | Weekly | Sprint progress + upcoming releases |
| Leadership | Email | Monthly | Release summary + metrics |

### External Communications (for SaaS release)

| Audience | Channel | Content |
|---------|---------|---------|
| Beta customers | Email | Release notes, new features, migration guide |
| Trial users | In-app banner | New features available |
| All users | Product blog | Major version announcement |

### Release Notes Format

```markdown
## TransformHub v1.0 — Release Notes
**Released**: 2026-MM-DD

### New Features
- Executive Reporting Agent: Generate board-ready reports in < 10 minutes
- Accuracy Score Dashboard: Real-time quality scores per agent module

### Improvements
- RAG retrieval latency reduced by 30%
- Agent memory injection now includes top-10 memories

### Bug Fixes
- Fixed: Risk Agent was using incorrect capability join direction
- Fixed: Future State fallback to multipliers when no benchmarks uploaded

### Known Limitations
- Executive Report PDF export requires Chrome (Safari print dialog varies)
```

---

## 8. Go-Live Checklist

### Infrastructure (30 items)
- [ ] PostgreSQL 18 with pgvector extension installed
- [ ] pgvector ivfflat index created on context_chunks.embedding
- [ ] Database connection pool configured (min=5, max=20)
- [ ] Environment variables set in all services (no hardcoded values)
- [ ] OPENAI_API_KEY valid and has GPT-4o + embedding model access
- [ ] NEXTAUTH_SECRET is a cryptographically random 32+ char string
- [ ] NEXTAUTH_URL matches production domain
- [ ] DATABASE_URL includes SSL parameters for production
- [ ] Agent service accessible from Next.js at AGENT_SERVICE_URL
- [ ] CORS configured for production domain only
- [ ] Health endpoint responds: GET /api/v1/health → 200 OK
- [ ] Demo orgs seeded: US Bank, Telstra Health, ING Bank
- [ ] pgvector probes setting: SET ivfflat.probes = 10
- [ ] Docker Compose (or equivalent) starts all services cleanly
- [ ] Log aggregation configured (structured JSON logs)
- [ ] Backup schedule configured: daily pg_dump to object storage
- [ ] DB backup restoration tested in last 30 days

### Testing
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] E2E smoke tests (5 critical journeys) passing
- [ ] Performance benchmarks met in staging
- [ ] Security scan: no Critical/High open findings
- [ ] Cross-org isolation test passing
- [ ] Audit chain integrity test passing

### Documentation
- [ ] Deployment runbook finalised
- [ ] Rollback procedure tested and documented
- [ ] MEMORY.md updated with current port/config
- [ ] .env.example up to date

### Sign-offs
- [ ] Tech Lead: technical approval
- [ ] Product Manager: scope approval
- [ ] Security: scan approval
- [ ] At least 1 UAT participant sign-off

---

## 9. Post-Release Monitoring

### Metrics to Watch (First 24 Hours)

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Agent error rate | > 5% | PagerDuty P2 |
| API p95 latency | > 1000ms | Slack alert |
| PostgreSQL connection pool | > 80% utilised | Slack alert |
| OpenAI API error rate | > 2% | Slack alert |
| Failed agent runs | > 10% | PagerDuty P2 |
| Health endpoint | Non-200 | PagerDuty P1 |
| HITL gates stuck > 24h | Any | Slack alert |

### Post-Release Actions

- **Hour 1**: Verify all services healthy, check error logs
- **Hour 4**: Review first real user sessions (if applicable)
- **Day 1**: Summary metrics review with team
- **Day 3**: Post-release retrospective

---

## 10. Hotfix Process

### Criteria for Hotfix (vs Next Sprint)

A hotfix is warranted when:
- S1 severity bug in production (platform unusable, data loss, security breach)
- S2 bug affecting > 20% of users' core workflow
- Security vulnerability confirmed exploitable

### Hotfix Pipeline

```
Identify S1/S2 bug in production
    │
    ▼
Create hotfix branch from production tag: git checkout -b hotfix/fix-audit-chain v1.0.2
    │
    ▼
Implement minimal fix (no new features)
    │
    ▼
Expedited review (1 reviewer, same day)
    │
    ▼
Run critical test subset (unit + relevant integration + smoke)
    │
    ▼
Deploy to staging, verify fix
    │
    ▼
Deploy to production
    │
    ▼
Tag as patch: v1.0.3
    │
    ▼
Merge hotfix branch back to main
    │
    ▼
Post-mortem within 48 hours
```

### Communication for Hotfixes

- **Internal**: Immediate Slack notification to team when S1 identified
- **Affected users** (if data impact): Email within 2 hours of discovery
- **All users** (if service disruption): Status page update within 30 minutes
- **Post-mortem**: Published within 5 business days of resolution
