# TransformHub — Risk Register

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12

---

## Table of Contents

1. [Risk Management Framework](#1-risk-management-framework)
2. [Risk Categories](#2-risk-categories)
3. [Risk Register](#3-risk-register)
4. [Risk Heat Map](#4-risk-heat-map)
5. [Top 10 Critical Risks](#5-top-10-critical-risks)
6. [Risk Response Plans](#6-risk-response-plans)
7. [Risk Monitoring Plan](#7-risk-monitoring-plan)
8. [Risk Escalation Matrix](#8-risk-escalation-matrix)

---

## 1. Risk Management Framework

### Risk Identification

Risks are identified through:
- Architecture review sessions
- Sprint retrospectives
- Security scans and penetration testing
- Incident post-mortems
- Technology vendor announcements
- Regulatory change monitoring

### Risk Assessment

**Likelihood Scale (1–5)**:
| Level | Probability | Description |
|-------|------------|-------------|
| 1 | < 10% | Rare — unlikely in normal circumstances |
| 2 | 10–25% | Unlikely — possible but not expected |
| 3 | 25–50% | Moderate — could occur in some circumstances |
| 4 | 50–75% | Likely — will probably occur |
| 5 | > 75% | Almost Certain — expected to occur |

**Impact Scale (1–5)**:
| Level | Description | Platform Effect |
|-------|-------------|-----------------|
| 1 | Negligible | Minor inconvenience, no data/service impact |
| 2 | Minor | Feature degraded, workaround exists |
| 3 | Moderate | Significant feature loss or performance degradation |
| 4 | Major | Core platform unavailable, data integrity risk |
| 5 | Critical | Complete platform failure, data loss, security breach |

**Exposure Score** = Likelihood × Impact (1–25)

### Risk Response Strategies

| Strategy | Description |
|----------|-------------|
| Mitigate | Reduce likelihood and/or impact through controls |
| Accept | Acknowledge risk, monitor, no active action (low exposure) |
| Transfer | Shift risk to third party (insurance, SLA, vendor) |
| Avoid | Change approach to eliminate risk entirely |

---

## 2. Risk Categories

| Category | Description |
|----------|-------------|
| **Technical** | Platform code, infrastructure, third-party dependencies |
| **AI/ML** | LLM quality, hallucination, model changes, cost |
| **Security** | Data breach, unauthorised access, injection attacks |
| **Operational** | Process, team, knowledge, deployment |
| **External** | Vendors, regulations, market |
| **Organisational** | Scope, resources, stakeholder alignment |

---

## 3. Risk Register

| ID | Category | Risk Description | Likelihood | Impact | Exposure | Response | Owner | Status |
|----|----------|-----------------|------------|--------|----------|----------|-------|--------|
| RISK-001 | Technical | PostgreSQL connection pool exhaustion under concurrent agent load | 3 | 4 | 12 | Mitigate | Tech Lead | Active |
| RISK-002 | Technical | pgvector ivfflat recall degrades above 1M vectors | 3 | 3 | 9 | Mitigate | Tech Lead | Active |
| RISK-003 | Technical | LangGraph API breaking changes on version upgrade | 3 | 3 | 9 | Mitigate | Dev Team | Active |
| RISK-004 | Technical | Agent execution timeout (> 60s for large orgs) | 3 | 3 | 9 | Mitigate | Dev Team | Active |
| RISK-005 | Technical | asyncpg pool leaks under error conditions | 2 | 4 | 8 | Mitigate | Dev Team | Active |
| RISK-006 | Technical | Next.js App Router caching causes stale agent results | 3 | 2 | 6 | Mitigate | Frontend Dev | Active |
| RISK-007 | Technical | Prisma migration failure on production during schema change | 2 | 4 | 8 | Mitigate | Tech Lead | Active |
| RISK-008 | AI/ML | OpenAI GPT-4o returns low-quality or hallucinated agent output | 4 | 3 | 12 | Mitigate | AI Team | Active |
| RISK-009 | AI/ML | OpenAI API rate limits exceeded during peak usage | 3 | 3 | 9 | Mitigate | Platform Team | Active |
| RISK-010 | AI/ML | OpenAI API costs exceed budget at scale | 3 | 3 | 9 | Mitigate | Platform Team | Active |
| RISK-011 | AI/ML | text-embedding-3-small model deprecated by OpenAI | 2 | 3 | 6 | Transfer | Platform Team | Monitor |
| RISK-012 | AI/ML | Context window limit exceeded for large organisations | 3 | 3 | 9 | Mitigate | AI Team | Active |
| RISK-013 | AI/ML | Agent memory poisoning via malicious HITL feedback | 2 | 4 | 8 | Mitigate | Security Team | Active |
| RISK-014 | AI/ML | BM25 reranking degrades quality for non-English content | 2 | 2 | 4 | Accept | AI Team | Monitor |
| RISK-015 | Security | Unauthorised cross-org data access (multi-tenancy breach) | 2 | 5 | 10 | Mitigate | Security Team | Active |
| RISK-016 | Security | SQL injection via unparameterised asyncpg queries | 2 | 5 | 10 | Mitigate | Dev Team | Active |
| RISK-017 | Security | IDOR — agent run ID guessable, access other org's run | 2 | 4 | 8 | Mitigate | Security Team | Active |
| RISK-018 | Security | JWT secret compromised → session hijacking | 2 | 5 | 10 | Mitigate | Security Team | Active |
| RISK-019 | Security | API key in environment variable exposed via log leak | 2 | 5 | 10 | Mitigate | Security Team | Active |
| RISK-020 | Security | XSS via unsanitised agent output rendered in UI | 2 | 4 | 8 | Mitigate | Frontend Dev | Active |
| RISK-021 | Security | Audit trail tampering (UPDATE audit_logs directly) | 1 | 5 | 5 | Mitigate | Security Team | Active |
| RISK-022 | Security | pgvector embedding reveals sensitive document content | 2 | 3 | 6 | Accept | Security Team | Monitor |
| RISK-023 | Operational | Single engineer holds all architectural knowledge | 3 | 4 | 12 | Mitigate | Eng Manager | Active |
| RISK-024 | Operational | OpenAI service outage causes all agents unavailable | 3 | 4 | 12 | Mitigate | Platform Team | Active |
| RISK-025 | Operational | Database backup failure — undetected until recovery needed | 2 | 5 | 10 | Mitigate | Ops Team | Active |
| RISK-026 | Operational | pgvector index rebuild time at scale (1M+ vectors) | 2 | 3 | 6 | Mitigate | Ops Team | Monitor |
| RISK-027 | Operational | Demo org data contaminated by test mutations | 3 | 2 | 6 | Mitigate | Dev Team | Active |
| RISK-028 | Operational | HITL gate left pending indefinitely (blocking workflow) | 3 | 2 | 6 | Mitigate | Product Team | Active |
| RISK-029 | Operational | Deployment downtime during migration | 2 | 3 | 6 | Mitigate | Ops Team | Active |
| RISK-030 | External | OpenAI changes GPT-4o pricing model (cost spike) | 3 | 3 | 9 | Transfer | Platform Team | Active |
| RISK-031 | External | OpenAI deprecates GPT-4o in favour of new model | 2 | 3 | 6 | Mitigate | AI Team | Monitor |
| RISK-032 | External | GDPR/SOC2 compliance requirement changes | 2 | 3 | 6 | Mitigate | Compliance | Monitor |
| RISK-033 | External | pgvector project abandoned (no security patches) | 1 | 3 | 3 | Accept | Tech Lead | Monitor |
| RISK-034 | External | LangGraph commercial licensing change | 2 | 3 | 6 | Mitigate | Tech Lead | Monitor |
| RISK-035 | Organisational | Scope creep — additional agents/features requested mid-sprint | 4 | 2 | 8 | Mitigate | Product Manager | Active |
| RISK-036 | Organisational | Stakeholder misalignment on AI output quality expectations | 3 | 3 | 9 | Mitigate | Product Manager | Active |
| RISK-037 | Organisational | Key developer departure mid-project | 2 | 4 | 8 | Mitigate | Eng Manager | Active |
| RISK-038 | Organisational | OpenAI API key shared across dev/staging/prod | 3 | 3 | 9 | Mitigate | Ops Team | Active |
| RISK-039 | AI/ML | RAG retrieval quality degrades as context corpus grows stale | 3 | 3 | 9 | Mitigate | AI Team | Active |
| RISK-040 | Technical | SHA-256 chain write contention at high audit volume | 2 | 3 | 6 | Mitigate | Tech Lead | Monitor |

---

## 4. Risk Heat Map

```
         IMPACT
           1        2        3        4        5
         ───────────────────────────────────────
    5  │  ·        ·        ·        ·        ·
       │
    4  │  ·        ·        039      001,008  ·
L      │                    003,004  024
I      │                    009,010
K  3  │  ·        006,027  002,012  023      ·
E      │              028   030,036
L      │              038
I  2  │  ·        ·        011,022  005,007  015,016
H                          014      013,017  018,019
O      │                   026,040  020,029  025
O  1  │  ·        ·        033      ·        021
D
```

**Colour Key**:
- Exposure 1–4: 🟢 Low
- Exposure 5–9: 🟡 Medium
- Exposure 10–14: 🟠 High
- Exposure 15–25: 🔴 Critical

**High Exposure Risks (≥ 10)**:
| ID | Risk | Exposure |
|----|------|----------|
| RISK-008 | AI hallucination | 12 |
| RISK-001 | DB connection exhaustion | 12 |
| RISK-023 | Knowledge concentration | 12 |
| RISK-024 | OpenAI service outage | 12 |
| RISK-015 | Cross-org data breach | 10 |
| RISK-016 | SQL injection | 10 |
| RISK-018 | JWT compromise | 10 |
| RISK-019 | API key log leak | 10 |
| RISK-025 | Backup failure | 10 |

---

## 5. Top 10 Critical Risks

### RISK-001: PostgreSQL Connection Pool Exhaustion

**Likelihood**: 3 | **Impact**: 4 | **Exposure**: 12

**Scenario**: 10+ concurrent agent runs each opening 2–3 DB connections; asyncpg pool max=20 reached; subsequent requests queue and timeout.

**Current Controls**: asyncpg pool min=5, max=20; connection timeout configured.

**Additional Mitigations Needed**:
- Implement agent execution queue (max N concurrent per org)
- Add pool utilisation metric alert at 80%
- Test with 20 concurrent runs in load test

---

### RISK-008: Agent Hallucination / Low-Quality Output

**Likelihood**: 4 | **Impact**: 3 | **Exposure**: 12

**Scenario**: GPT-4o generates plausible-but-incorrect capability maps, risk items, or roadmaps that users trust without verification.

**Current Controls**: RAG grounding reduces hallucination; HITL gates allow human review; accuracy scoring provides quality signal.

**Additional Mitigations Needed**:
- Agent output validation against known schemas
- Confidence thresholding — flag low-confidence outputs
- Benchmark: sample 50 outputs per quarter for expert review
- Accuracy score threshold: warn users when < 60%

---

### RISK-023: Knowledge Concentration

**Likelihood**: 3 | **Impact**: 4 | **Exposure**: 12

**Scenario**: Only one engineer understands the full agent architecture + LangGraph state machine patterns + RAG pipeline. Departure causes extended outage.

**Current Controls**: This documentation suite partially addresses.

**Additional Mitigations Needed**:
- Pair programming: rotate engineers across all 18 agents
- Architecture walkthrough sessions (quarterly)
- Runbooks for all common operations in docs/platform-docs/
- Bus factor goal: ≥ 3 engineers who understand core platform

---

### RISK-024: OpenAI Service Outage

**Likelihood**: 3 | **Impact**: 4 | **Exposure**: 12

**Scenario**: OpenAI experiences a multi-hour outage. All 18 agents become non-functional. Platform's core value proposition is unavailable.

**Current Controls**: 3-retry with exponential backoff handles transient errors.

**Additional Mitigations Needed**:
- v1.2: Azure OpenAI as hot-standby (same API surface, model parity)
- Circuit breaker: stop attempting after 5 consecutive failures, show user-friendly downtime notice
- Status page integration: detect openai.com status and pre-emptively notify users

---

### RISK-015: Cross-Org Data Breach

**Likelihood**: 2 | **Impact**: 5 | **Exposure**: 10

**Scenario**: Bug in org_id scoping allows Org A to query Org B's digital products or context documents.

**Current Controls**: Every query includes WHERE organization_id = $1; FastAPI dependency enforces org_id from JWT.

**Additional Mitigations Needed**:
- Automated test: TC-008 (cross-org access → 403) runs on every PR
- Penetration test: quarterly manual testing of IDOR and auth bypass
- Database-level row security (PostgreSQL RLS) as defence-in-depth for v1.2

---

### RISK-016: SQL Injection

**Likelihood**: 2 | **Impact**: 5 | **Exposure**: 10

**Scenario**: A developer writes a raw asyncpg query with string interpolation. Attacker injects SQL via API parameter.

**Current Controls**: Parameterised queries enforced in code review; Pydantic input validation.

**Additional Mitigations Needed**:
- Static analysis: bandit scan in CI for SQL string interpolation patterns
- OWASP ZAP dynamic scan in CI/CD pipeline
- Query pattern: NEVER use f-strings or .format() for SQL — enforced in code review checklist

---

### RISK-018: JWT Secret Compromise

**Likelihood**: 2 | **Impact**: 5 | **Exposure**: 10

**Scenario**: NEXTAUTH_SECRET is weak, exposed in logs, or committed to git. Attacker forges JWT for any org.

**Current Controls**: Secret in environment variable, not in code.

**Additional Mitigations Needed**:
- Secret rotation procedure documented (quarterly rotation)
- git-secrets or gitleaks pre-commit hook to prevent secret commits
- JWT expiry: 24h maximum; refresh token rotation
- Alert on > 100 unique IPs using same JWT in 1 hour

---

### RISK-019: API Key in Log Leak

**Likelihood**: 2 | **Impact**: 5 | **Exposure**: 10

**Scenario**: OPENAI_API_KEY or DATABASE_URL is logged in an error message or debug log. Attacker reads logs.

**Current Controls**: Secrets in env vars; not passed to agent as arguments.

**Additional Mitigations Needed**:
- Log scrubbing: regex filter for sk-... patterns in log pipeline
- Separate API keys per environment (dev/staging/prod keys)
- API key monitoring: OpenAI usage alerts for unexpected spikes

---

### RISK-025: Database Backup Failure

**Likelihood**: 2 | **Impact**: 5 | **Exposure**: 10

**Scenario**: Daily pg_dump fails silently for 2 weeks. Production database is unrecoverable after hardware failure.

**Current Controls**: Daily pg_dump configured.

**Additional Mitigations Needed**:
- Backup verification: restore test to separate DB weekly
- Alert on backup job failure (non-zero exit code)
- WAL archiving for point-in-time recovery (PITR)
- Retention: keep 30 daily backups, 12 monthly backups

---

### RISK-009: OpenAI Rate Limit

**Likelihood**: 3 | **Impact**: 3 | **Exposure**: 9

**Scenario**: Multiple simultaneous agent runs across many organisations exhaust OpenAI rate limits. Agent runs return 429 errors.

**Current Controls**: 3-retry with backoff handles transient 429s.

**Additional Mitigations Needed**:
- Implement per-org agent execution queue (max 3 concurrent per org)
- Request batching for embedding API calls
- Monitor token usage per org per hour
- Plan: Azure OpenAI as fallback with separate rate limit pool

---

## 6. Risk Response Plans

### Response Plan: RISK-001 (DB Connection Exhaustion)

**Trigger**: Pool utilisation alert > 80% OR agent queue depth > 10

**Steps**:
1. Check current pool usage: `SELECT count(*) FROM pg_stat_activity WHERE datname='transformhub'`
2. Identify long-running queries: `SELECT pid, query, now() - query_start AS duration FROM pg_stat_activity ORDER BY duration DESC`
3. Kill blocking queries if over 5 minutes
4. If persistent: increase pool max temporarily (config change + service restart)
5. Root cause analysis: which agent is consuming connections
6. Permanent fix: implement connection pooling middleware or PgBouncer

---

### Response Plan: RISK-015 (Cross-Org Data Breach)

**Trigger**: Security scan flags IDOR vulnerability OR incident report of cross-org data access

**Steps**:
1. Immediately isolate affected API endpoints (feature flag off)
2. Audit audit_logs for cross-org access patterns (last 30 days)
3. Notify affected organisations within 2 hours
4. Fix: add/correct organization_id filter in offending query
5. Deploy hotfix (expedited pipeline)
6. Penetration test affected endpoints post-fix
7. Document incident and controls strengthened

---

### Response Plan: RISK-024 (OpenAI Outage)

**Trigger**: OpenAI API returns 5xx for > 5 consecutive requests OR openai.com status page shows incident

**Steps**:
1. Circuit breaker activates: stop attempting API calls
2. Update UI: show "AI analysis temporarily unavailable — OpenAI service incident"
3. Monitor: poll OpenAI status every 5 minutes
4. Log all queued requests (user + agent_type + input) for replay when service restores
5. On restore: automatically retry queued requests in order
6. Post-incident: evaluate Azure OpenAI fallback priority for v1.2

---

### Response Plan: RISK-008 (Agent Hallucination)

**Trigger**: User reports inaccurate output OR accuracy score drops below 60% OR expert review finds > 30% incorrect outputs

**Steps**:
1. Review recent agent_runs output_data for the affected agent_type
2. Check if relevant context documents are uploaded (missing benchmarks = expected accuracy drop)
3. If systematic hallucination: review and revise agent prompt
4. Add validation rule to flag implausible values (e.g., cycle_time = 0)
5. Lower HITL threshold temporarily (require human approval for all runs)
6. A/B test revised prompt against original on test orgs

---

### Response Plan: RISK-025 (Backup Failure)

**Trigger**: Backup monitoring alert OR discovered during recovery test

**Steps**:
1. Check backup job logs: `cat /var/log/pg_backup.log`
2. Identify failure cause: disk space, permissions, network
3. Run manual backup immediately: `pg_dump -Fc transformhub > /backups/manual_YYYYMMDD.dump`
4. Fix automated backup configuration
5. Test restore: `pg_restore -d transformhub_test /backups/manual_YYYYMMDD.dump`
6. Verify data integrity: spot-check rows in key tables
7. Update backup monitoring and alerting

---

## 7. Risk Monitoring Plan

| Category | Review Frequency | Key Risk Indicators (KRIs) | Monitored By |
|----------|-----------------|---------------------------|--------------|
| Technical | Weekly | DB pool utilisation %, agent error rate, API latency P95 | Tech Lead |
| AI/ML | Weekly | Accuracy scores per agent (< 60% = alert), HITL rejection rate | AI Team |
| Security | Monthly | OWASP scan results, auth failure rate, suspicious cross-org queries | Security |
| Operational | Monthly | Backup success/failure, deployment frequency, MTTF/MTTR | Ops Team |
| External | Quarterly | OpenAI pricing changes, LangGraph releases, regulatory updates | Platform Team |
| Organisational | Monthly | Bus factor review, scope change requests, stakeholder satisfaction | Eng Manager |

---

## 8. Risk Escalation Matrix

| Exposure Score | Level | Action | Notified Within |
|----------------|-------|--------|-----------------|
| 1–4 | Low | Monitor; review monthly | Next monthly review |
| 5–9 | Medium | Assign owner; active mitigation plan | Within 1 week |
| 10–14 | High | Escalate to Tech Lead; weekly status | Within 24 hours |
| 15–19 | Critical | Escalate to leadership; daily status | Within 4 hours |
| 20–25 | Severe | Immediate executive escalation; dedicated response team | Immediately |

### Escalation Contacts

| Role | Responsibility |
|------|---------------|
| Tech Lead | All Technical and AI/ML risks |
| Eng Manager | Organisational and Operational risks |
| Security Team | All Security risks |
| Product Manager | Scope and stakeholder risks |
| Platform Team | External vendor risks |
