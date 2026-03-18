# TransformHub — Definition of Done

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12

---

## 1. DoD Philosophy

The Definition of Done is a shared, non-negotiable agreement across the entire delivery team that defines what "complete" means at each level of work. It exists to:

- Prevent incomplete work from accumulating as hidden technical debt
- Ensure consistent quality across all contributors
- Provide a clear contract between development, QA, and product
- Make progress visible and measurable

**DoD is applied at four levels**: Story → Feature → Epic → Release. Each level inherits and adds to the level below.

---

## 2. Story-Level DoD

A user story is **Done** when ALL of the following are true:

### Code Completeness
- [ ] All acceptance criteria from the story are implemented
- [ ] Code follows project conventions (TypeScript strict mode, Pydantic v2, async/await patterns)
- [ ] No commented-out code, no debug print/console.log statements
- [ ] All files saved and no syntax errors
- [ ] No `TODO` comments left that are not linked to a future story

### Testing
- [ ] Unit tests written for new/changed logic (functions, components, agent nodes)
- [ ] Unit tests pass locally
- [ ] Integration tests updated or written for affected API routes
- [ ] All existing tests continue to pass
- [ ] Test coverage for changed lines ≥ 80%

### Code Review
- [ ] Pull request raised against main branch
- [ ] At least 1 peer review approval received
- [ ] All review comments resolved or replied to with justification
- [ ] PR description includes: what changed, why, how to test

### Database
- [ ] Any schema changes have a Prisma migration file
- [ ] Migration is reversible (or explicitly documented as one-way)
- [ ] Migration tested against a clean database and against existing data
- [ ] No breaking changes to existing queries without code updates

### Security
- [ ] No new hardcoded secrets or API keys in code
- [ ] All new API endpoints include org_id scoping (WHERE organization_id = $1)
- [ ] User input is validated via Pydantic (backend) or Zod/type checking (frontend)
- [ ] No SQL injection vectors introduced

### Observability
- [ ] Any new agent action writes an audit_log entry
- [ ] Errors are caught and return structured error response {error, code, details}
- [ ] New agent nodes log start/end events

### Documentation
- [ ] PR description includes any relevant context for future developers
- [ ] API changes reflected in route comments
- [ ] Complex logic has inline comments explaining the "why"

---

## 3. Feature-Level DoD

A feature is **Done** when ALL stories are at Story DoD AND:

### Integration
- [ ] Feature integration tested end-to-end (not just unit)
- [ ] Feature works correctly with all 3 demo organisations (US Bank, Telstra Health, ING Bank)
- [ ] Any new agent wired into the agent accuracy scoring
- [ ] Feature does not regress any existing feature's test suite

### Demonstration
- [ ] Feature demonstrated to Product Manager in a live walkthrough
- [ ] Product Manager has accepted the feature against acceptance criteria
- [ ] Feature is demo-able in the demo-guide.html or equivalent

### Performance
- [ ] Feature meets relevant performance benchmark from the test plan:
  - Agent execution: < 30-60 seconds
  - RAG retrieval: < 2 seconds
  - Page load: < 3 seconds
  - API response: < 500ms
- [ ] Performance tested with production-representative data volume

### Edge Cases
- [ ] Empty state handled (no data, no agent runs yet)
- [ ] Error state handled (agent failure, network error, DB error)
- [ ] Loading state handled (spinner/skeleton while data loads)

---

## 4. Epic-Level DoD

An epic is **Done** when ALL features are at Feature DoD AND:

### Completeness
- [ ] All features in the epic delivered (or explicitly deferred with documented decision)
- [ ] Epic OKR key results are measurable and verified against targets
- [ ] All critical bugs for the epic are resolved

### Testing
- [ ] E2E Playwright test covers the primary user journey for this epic
- [ ] Integration test suite covers all epic API endpoints
- [ ] Load test run for high-traffic epic paths (agent execution, RAG retrieval)

### Stakeholder Sign-off
- [ ] Epic demonstrated to business stakeholders
- [ ] At least one persona (CDO, Architect, Consultant) has validated the user experience
- [ ] Stakeholder sign-off recorded in sprint retrospective notes

### Release Preparation
- [ ] Release notes drafted for this epic's features
- [ ] Any breaking changes communicated to downstream consumers
- [ ] Rollback procedure documented for risky database migrations

---

## 5. Release-Level DoD

A release is **Done** when ALL epics in-scope are at Epic DoD AND:

### Quality Gates
- [ ] All automated tests passing in staging environment
- [ ] Unit test coverage ≥ 80% backend, ≥ 70% frontend
- [ ] Zero open S1/S2 (Critical/High) defects
- [ ] S3 (Medium) defects: known list accepted by Product Manager
- [ ] Performance benchmarks met in staging with production-sized data

### Security
- [ ] OWASP ZAP DAST scan completed, no High/Critical findings unaddressed
- [ ] Dependency audit run (`npm audit`, `pip-audit`), no Critical vulnerabilities
- [ ] All secrets confirmed to be in environment variables (no secrets in code)
- [ ] Org isolation test: verified cross-org data access is impossible

### Infrastructure
- [ ] Docker Compose file tested and all services start cleanly
- [ ] Environment variables documented in `.env.example`
- [ ] Health endpoint responds correctly: GET /api/v1/health → 200 OK
- [ ] Database migrations applied successfully to staging
- [ ] pgvector index confirmed present in production DB

### Deployment
- [ ] Deployment runbook written and tested (step-by-step)
- [ ] Rollback procedure documented and tested
- [ ] Database migration rollback tested where applicable
- [ ] Staging deployment completed and verified

### Documentation
- [ ] MEMORY.md and platform docs updated if architecture changed
- [ ] API changes documented
- [ ] Any known limitations or workarounds documented for users

### Sign-off
- [ ] Product Manager approval on release scope
- [ ] Tech Lead approval on technical quality
- [ ] At least 2 UAT test cases validated by business users
- [ ] Release notes finalised and reviewed

---

## 6. Agent-Specific DoD

Any story involving a new or modified AI agent must additionally satisfy:

### Prompt Quality
- [ ] Agent prompt reviewed for: clarity, specificity, output schema alignment
- [ ] Prompt tested with at least 3 different input scenarios
- [ ] Prompt includes format_context_section() call with correct agent_type

### Output Schema
- [ ] Agent output schema defined as Pydantic v2 model
- [ ] Schema validation tested with valid and invalid OpenAI responses
- [ ] Schema handles null/missing fields gracefully

### RAG Integration
- [ ] Agent generates 3–5 queries appropriate to its agent_type
- [ ] Category-aware context budget configured in org_context.py
- [ ] Context injection tested — verify context appears in logged prompt

### HITL Gate
- [ ] INTERRUPT node tested (if configured): pause, checkpoint, resume verified
- [ ] Rejection feedback path tested: feedback injected in re-run prompt

### Memory
- [ ] Agent memory injection tested: memories from prior runs appear in prompt
- [ ] New learnings saved to agent_memories on HITL interaction

### Accuracy
- [ ] Accuracy score baseline established (run on all 3 demo orgs, record initial scores)
- [ ] Accuracy score formula calibrated for this agent type
- [ ] Accuracy score visible on dashboard after 3+ runs

### Audit
- [ ] audit_log entry created on agent run start, complete, and failure
- [ ] SHA-256 hash chain verified after new audit entries

### Context Auto-Save
- [ ] Agent output auto-saved as AGENT_OUTPUT context_document via save_agent_context_doc()
- [ ] Subsequent agent runs verified to retrieve this agent's output via RAG

---

## 7. DoD by Role

### Developer
- [ ] All Story DoD code and testing items
- [ ] PR submitted with description and test instructions
- [ ] Self-tested in local environment against all 3 demo orgs

### QA Engineer
- [ ] Independent test execution against acceptance criteria
- [ ] Regression test suite run (no new failures)
- [ ] Performance tested if applicable
- [ ] Bug report filed for any deviation from AC

### Product Manager
- [ ] Story/Feature/Epic acceptance criteria reviewed
- [ ] Live demo walkthrough attended
- [ ] Formal acceptance or rejection recorded
- [ ] Release notes contribution reviewed

### Tech Lead
- [ ] Architecture alignment confirmed (no divergence from documented decisions)
- [ ] Security review completed for high-risk changes
- [ ] Performance benchmarks confirmed met
- [ ] Release sign-off

---

## 8. Quality Gates (CI/CD Automation)

These gates are automated in the CI/CD pipeline and block merging/deployment if failed:

| Gate | Trigger | Action on Fail |
|------|---------|----------------|
| Lint | PR open | Block merge |
| Unit tests | PR open | Block merge |
| Type check (TypeScript) | PR open | Block merge |
| Integration tests | Merge to main | Block staging deploy |
| E2E smoke (5 critical journeys) | Staging deploy | Block prod deploy |
| Coverage ≥ 80% backend | Merge to main | Warning (not block) |
| Security scan (OWASP) | Weekly | Create S2 tickets |
| Performance benchmark | Staging deploy | Warning if > 10% regression |

---

## 9. Exceptions Process

If a DoD item cannot be completed before a story/feature must ship:

1. **Document the exception**: Record in PR description or sprint notes: what is not done, why, and the risk
2. **Create a follow-up ticket**: Immediately create a ticket for the exception (S3 or S4 severity)
3. **Tech Lead approval required**: No exception ships without Tech Lead sign-off
4. **Time-bounded**: Exception tickets must be resolved within the next sprint (2 weeks maximum)
5. **Track**: Exception tickets tracked in a dedicated "DoD Exceptions" board column

**Examples of acceptable temporary exceptions**:
- Documentation update deferred 1 sprint (non-functional)
- Performance optimisation deferred (within 20% of target)

**Never acceptable exceptions**:
- Security vulnerabilities (org isolation, auth bypass, XSS, SQLi)
- Data integrity issues (missing audit logs, broken hash chain)
- Agent wrong join direction (known data correctness bugs)
