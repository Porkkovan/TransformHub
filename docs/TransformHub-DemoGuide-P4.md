# TransformHub Demo Guide (P0–P4 Edition)
## 45-Minute Executive & Technical Demo Script

**Version:** P4 (includes hallucination detection, process mining, A/B testing, Kubernetes)
**Audience:** CTO, Head of Digital Transformation, VP Engineering, or Platform Architects
**Duration:** 45 minutes live demo + 10–15 minutes Q&A
**Key Messages:**
1. AI agents replace months of manual analysis workshops with hours of automated intelligence
2. Every output is data-grounded — Jira, code signals, uploaded benchmarks — not LLM guesses
3. Enterprise-ready: SSO, RBAC, RLS, circuit breakers, K8s-native — not a prototype

---

## Pre-Demo Setup Checklist

### 30 Minutes Before

- [ ] Start the stack: `cd /Users/125066/projects/TransformHub && docker compose up -d` (or confirm K8s deployment is healthy)
- [ ] Verify agent service: `curl http://localhost:8000/api/v1/health` → `{"status": "healthy"}`
- [ ] Verify Next.js: open `http://localhost:3000` in browser
- [ ] Confirm US Bank org is selected (check localStorage: `localStorage.getItem("currentOrgId")`)
- [ ] Open browser to `http://localhost:3000` — have it ready in full-screen

### Seed Data Verification
The demo uses the US Bank seed org (`46d310b9`). Confirm it has:
- [ ] 3 business segments: "Consumer Banking", "Business Banking", "Wealth"
- [ ] At least 2 digital products with discovered capabilities
- [ ] VSM data present (check Discovery and Lean VSM have been run)
- [ ] At least 5 context documents uploaded (benchmarks, architecture docs)

If seed data is missing: `cd nextjs-app && npx tsx prisma/seed.ts`

### Backup Plan
If the live demo stack fails, have screenshots ready in `/Users/125066/projects/TransformHub/docs/demo-screenshots/`. The flow should be: Dashboard → Knowledge Base → Discovery results → VSM → Future State → Admin panel.

---

## Demo Flow

---

### SECTION 1: Platform Overview & Login (3 minutes)

**What to do:**
1. Navigate to `http://localhost:3000`
2. Log in as `demo@usbank.com` (password: `demo123`)
3. Show the dashboard — highlight the organisation selector in the top navigation
4. Briefly show "US Bank" is selected; mention other orgs are isolated

**Talking points:**
> "This is TransformHub — a multi-tenant transformation intelligence platform. Every organisation sees only their own data, enforced at the database level through PostgreSQL Row-Level Security — not just application logic. You can have 50 organisations on the same deployment and there's zero data bleed."

> "We're logged in as an Analyst role. Notice the RBAC is hierarchical: Viewers read results, Analysts run agents and apply overrides, Admins manage integrations and budgets, Super Admins manage tenancy. Let me show you what this looks like in practice at the end."

**Key message to land:** *"Enterprise-grade multi-tenant SaaS, production-ready from day one."*

---

### SECTION 2: Knowledge Base — Grounding the AI (5 minutes)

**What to do:**
1. Navigate to `Settings → Knowledge Base` (or the Context Documents section)
2. Show the list of uploaded documents with category badges
3. Click "Upload Document" — show the category dropdown: VSM_BENCHMARKS, TRANSFORMATION_CASE_STUDIES, ARCHITECTURE_STANDARDS, etc.
4. Upload a sample PDF benchmark (have one ready in ~/Desktop/sample-benchmark.pdf)
5. Watch it show status: UPLOADED → PROCESSING → INDEXED
6. Click "Fetch from URL" — paste a public GitHub architecture doc URL
7. Show it chunking and indexing in real-time

**Talking points:**
> "This is the most important setup step. Every AI agent in this platform is grounded by what you put in here. If you upload your own VSM benchmarks, prior transformation case studies, architecture standards — the agents use them verbatim as context for their analysis."

> "We use HNSW vector indexing with BM25 reranking — semantic search plus keyword precision. When a VSM agent runs, it fires 3–5 specialised queries and takes the 25 highest-confidence chunks from your knowledge base. That's why the analysis reflects your institutional context, not generic LLM training data."

> [When upload completes] "See that — within 30 seconds, that document is chunked, embedded, and available to every agent. No pipeline delay, no batch job."

**Key message to land:** *"Your institutional knowledge grounds every AI analysis — this isn't generic output."*

---

### SECTION 3: Discovery Agent — Capability Mapping (8 minutes)

**What to do:**
1. Navigate to `Agents → Run Agent`
2. Select "Discovery" from the agent type dropdown
3. Select "Consumer Banking" business segment
4. Click "Run Agent"
5. Show the real-time streaming progress (SSE events) — execution log updating live
6. When complete, navigate to the Discovery results view
7. Walk through the L1 → L2 → L3 capability hierarchy
8. Click into one capability to show functionalities list with detail

**Talking points:**
> "The Discovery agent is running right now — you can see it streaming progress in real-time via Server-Sent Events. No polling, no waiting for a page refresh."

> [While streaming] "Under the hood, this agent is pulling your uploaded architecture documents, cross-referencing with any prior agent outputs, and building a consistent L1 capability → L2 sub-capability → L3 functionality hierarchy. In a real deployment, it would also be reading your code repository structure."

> [When complete] "Here's what it found: [describe the results]. Notice — these capability names are consistent. If you ran this same analysis 6 months ago with different architects, you'd get a different taxonomy. This is reproducible."

> "See these 'identified from code' badges? Where the agent found evidence in uploaded technical docs or code signals, it marks the source. Analysts know the difference between AI-inferred and evidence-backed."

**Key message to land:** *"Weeks of workshops replaced by minutes of automated analysis — with consistent, auditable results."*

---

### SECTION 4: Lean VSM — Data-Grounded Timing (10 minutes)

**This is the money section — spend time here.**

**What to do:**
1. Navigate to `Agents → Run Agent`, select "Lean VSM"
2. Run it on the same Consumer Banking segment
3. While it's running, explain what's happening behind the scenes
4. When complete, open the VSM results view
5. Show the process/wait/lead time table with the **timing provenance badges** — this is the key differentiator
6. Click on a step that has `jira_measured` provenance — explain what it means
7. Show the flow efficiency column with colour coding (red < 15%, amber 15–30%, green > 30%)
8. Click "View Mermaid Diagram" — show the auto-generated colour-coded flowchart
9. Show the cross-org benchmark comparison (p25/p50/p75 for banking industry)

**Talking points:**
> "Every step has a timing provenance badge. See this one — `jira_measured` — that means this 3.2-hour process time was computed from actual Jira changelog dwell times. Not a consultant estimate. Not an LLM guess. Real data from real tickets."

> [Pointing to a step with code_signals] "This one is `code_signals` — we extracted a `PAYMENT_TIMEOUT_MS=30000` constant from an uploaded architecture document and converted it to hours. That's Tier 2a extraction — pattern matching on your own code."

> [Pointing to llm_estimated] "This one is `llm_estimated` — the AI made an educated assessment from context. The confidence is lower, and analysts know to validate it."

> "Flow efficiency of 8.3% on the KYC step — that's critical. Our process time is 2.1 hours but the step is sitting in wait state for 23.4 hours. That's where work queues up. The colour coding makes the bottlenecks instantly visible."

> [Show benchmark comparison] "And this is what makes the prioritisation defensible: we're at p28 for banking industry on KYC flow efficiency. That means 72% of peer banks are performing better. That's a board-level conversation backed by data."

> [Show Mermaid diagram] "This diagram was auto-generated by the Haiku model — we use a lighter, cheaper model for formatting tasks like diagram rendering. The analysis ran on a more capable model. We do cost tiering automatically."

**Key message to land:** *"Data-grounded VSM — not consultant guesses. Every number traces back to a source."*

---

### SECTION 5: Hallucination Detection (3 minutes)

**What to do:**
1. Navigate to the VSM results
2. Show the "Validation Flags" panel if any flags are present
3. If no flags on clean data, explain the mechanism conceptually and show the `_hallucination_flags` structure in the execution result JSON
4. Describe what it catches

**Talking points:**
> "Production AI systems need guardrails on their outputs. We run every agent output through a hallucination detection layer."

> "It checks for physically impossible values: negative process times, flow efficiency over 100%. It catches internal inconsistencies: if lead_time is less than process_time plus wait_time, that's impossible. It flags suspicious patterns: all risk scores identical, capability names like 'Capability 1'."

> "Critical flags surface here for analyst review before anything is persisted. This is why the data you're looking at is clean — the system caught and surfaced issues during analysis, not after board presentation."

**Key message to land:** *"AI generates, humans verify — with the system flagging what needs attention."*

---

### SECTION 6: Future State Vision (8 minutes)

**What to do:**
1. Navigate to `Agents → Run Agent`, select "Future State Vision"
2. Run it (or show cached results if time is short)
3. Show the three-band projection: conservative / expected / optimistic
4. Point to the "Benchmark-grounded" badge on Expected projections
5. Show the automation opportunity cards with prioritisation
6. Show projected flow efficiency improvement timeline

**Talking points:**
> "The Future State Vision agent looked at the current-state VSM we just produced, pulled in the transformation case studies and benchmark documents you uploaded, and generated three projection scenarios."

> "The Expected scenario carries a 'Benchmark-grounded' badge — that means the projection is calibrated against the actual distribution from comparable transformation case studies in your knowledge base. If you uploaded the wrong benchmarks, you'd get different projections. If you haven't uploaded any, it falls back to general training data and the badge disappears."

> [Show specific automation opportunity] "This opportunity — automated KYC document extraction — is projected to move the KYC step from 8% to 34% flow efficiency in the Expected scenario. That projection is anchored to 3 uploaded case studies from comparable financial services transformations. It's not a magic number."

> "Conservative, Expected, and Optimistic let the board see the range. The business case doesn't have to bet on one number."

**Key message to land:** *"From current state to AI-native future in a structured, evidence-backed roadmap."*

---

### SECTION 7: Process Mining (P4 — 4 minutes)

**What to do:**
1. Navigate to `Integrations` (or the Process Mining section)
2. Show the process mining upload interface
3. Have a sample event log CSV ready — paste it in or upload it
4. Show the analysis results: activity stats, transition graph, bottlenecks

**Sample CSV to use:**
```
case_id,activity,timestamp
LOAN001,Application Received,2024-01-02T09:00:00
LOAN001,Document Collection,2024-01-02T09:15:00
LOAN001,KYC Verification,2024-01-04T14:30:00
LOAN001,Credit Assessment,2024-01-05T09:00:00
LOAN001,Approval,2024-01-07T11:00:00
LOAN002,Application Received,2024-01-02T10:30:00
LOAN002,Document Collection,2024-01-02T10:45:00
LOAN002,KYC Verification,2024-01-08T09:00:00
LOAN002,Approval,2024-01-09T14:00:00
```

**Talking points:**
> "This is P4 process mining — a completely different evidence source from Jira. Rather than using project management ticket data, we're using actual system transaction logs."

> "Upload any event log in case_id/activity/timestamp format — from your BPM system, your service bus, your database audit logs. TransformHub discovers the actual process flow: what activities happen in what order, how long each takes, where work waits."

> [Show bottleneck ranking] "The bottleneck detection ranks activities by wait time multiplied by frequency — so a step that's only slightly slow but happens 10,000 times per day ranks higher than a step that's catastrophically slow but rare. That's the business-impact view."

> "Document Collection is showing 52-hour average wait. That confirms what the Jira data showed — and now you have two independent evidence sources pointing at the same bottleneck. That's a very defensible investment case."

**Key message to land:** *"Three independent evidence sources: Jira cycle times, code signals, process event logs — all pointing to the same bottlenecks."*

---

### SECTION 8: Enterprise Admin Controls (3 minutes)

**What to do:**
1. Navigate to `Settings → Admin` (switch to an ADMIN role view)
2. Show the SSO configuration panel — point to Azure Entra ID / Google OAuth
3. Show API Keys management — create one, show "displayed once" behaviour
4. Show LLM Budget controls — monthly token/spend cap with hard cap toggle
5. Briefly show the Audit Log

**Talking points:**
> "For procurement teams: SSO is configured here. Azure Entra ID with domain-based provisioning — every employee at yourorg.com gets automatically onboarded to your tenant on first login."

> "API keys for programmatic access — SHA-256 hashed, scoped to specific operations, with expiry. The plaintext is shown exactly once on creation."

> "Budget controls: you can set a monthly token cap and spend cap per organisation. With hard caps enabled, agents return a 429 before the limit is hit — no surprise bills. You can also supply your own Anthropic API key, so all LLM spend is billed directly to your Anthropic account and visible in your own dashboards."

> "Every override, every document upload, every agent run — full audit trail with actor, timestamp, and evidence hash. APRA, SOC2, or internal audit requirements are covered."

**Key message to land:** *"Enterprise-ready from day one — your CISO, CFO, and compliance team will be satisfied."*

---

## Q&A Preparation

### "How accurate is the AI analysis?"

*"Two answers: first, for timing data, 70%+ of values are anchored to real sources — Jira cycle times, code signals, uploaded benchmarks — not LLM estimation. Second, we run a hallucination detection layer on every output that flags physically impossible values, inconsistencies, and suspicious patterns before they're persisted. We also show provenance on every number so analysts know what to trust and what to validate."*

### "What's the data security model?"

*"Row-Level Security enforced at PostgreSQL level — not application layer. Your data is physically inaccessible to other tenants. SOC2-aligned audit trail on all operations. SSO with Azure Entra ID or Google. RBAC with four hierarchy levels. For sensitive deployments, you can run entirely on your own infrastructure using the provided Kubernetes manifests — we're not a cloud-only SaaS."*

### "How long does it take to get value?"

*"First VSM insight within 48 hours of going live. First full baseline within 2 weeks for a large portfolio. The constraint is uploading your knowledge base and connecting Jira — the agents themselves run in minutes, not weeks."*

### "What happens when the AI is wrong?"

*"Analysts apply manual overrides via the override interface — every change is logged with the actor, rationale, and previous value. The timing provenance system means you always know which numbers are AI-estimated vs measured. The hallucination detector catches the worst errors automatically. And the benchmark comparison shows when a value is implausible relative to industry data."*

### "How do you handle LLM failures / outages?"

*"Circuit breaker pattern on all three providers: Anthropic, Azure OpenAI, OpenAI. If one provider goes down, the circuit opens and fallback routing kicks in automatically — agents always have a path to completion. We've tested sustained provider outages with no user-visible impact beyond slightly increased latency."*

### "Can we bring our own AI models?"

*"Yes — per-org API keys are supported. Supply your own Anthropic key and all LLM calls run against your account. Azure OpenAI with your own deployment is also supported. Google Gemini as a fallback option. The routing layer is extensible — model tiering automatically uses cheaper models for formatting tasks and premium models for analytical reasoning."*

### "How is pricing structured?"

*"Platform licensing plus usage-based LLM costs. The platform can optionally be self-hosted on customer infrastructure using the provided K8s manifests, in which case LLM costs flow directly through your own API accounts. We're happy to model the economics for your specific portfolio size."*

### "Can we test it before committing?"

*"Yes — 30-day POC deployment on your own infrastructure or our cloud. Three pre-seeded demo organisations give you immediate access to realistic outputs on day one. Connect your own Jira within 24 hours. Upload your own documents on day one. First real baseline within 2 weeks."*

### "How does it compare to a consulting engagement?"

*"Consulting engagements produce static outputs that age immediately. TransformHub produces a living intelligence layer — weekly VSM refreshes, Jira-connected cycle times, continuous benchmark updates. The analysis is also reproducible: you can re-run any agent with updated context and compare outputs. Consulting can't do that."*

### "What about hallucinations in the AI output?"

*"Three-layer approach: (1) RAG grounding — every agent pulls your uploaded benchmarks and case studies, so the AI is reasoning from your data, not making things up. (2) Hallucination detection post-processing — catches impossible values and flags them for analyst review before persistence. (3) Provenance tracking — every number shows its source, so analysts know what to trust and what to validate independently."*

---

## Demo Data Reference (US Bank Seed Org)

When demoing on the US Bank seed org, expect these values on screen:

| Product | Capabilities | Functionalities | VSM Steps |
|---------|-------------|----------------|-----------|
| Digital Banking | 8 | 47 | 23 |
| Payments Platform | 6 | 31 | 18 |
| Lending Portal | 9 | 52 | 27 |

**VSM metrics to reference (Consumer Banking):**
- Portfolio avg flow efficiency: ~21% (benchmark: 23.4%)
- Payment Processing: process_time ~2.4h, wait_time ~8.7h, flow_eff ~21.6%
- KYC Verification: process_time ~3.1h, wait_time ~18.4h, flow_eff ~14.4%
- Account Onboarding: process_time ~1.2h, wait_time ~4.8h, flow_eff ~20%

**Timing provenance distribution (approx):**
- 68% jira_measured
- 19% code_signals
- 13% llm_estimated

---

## Troubleshooting

### Agent fails mid-demo

1. Check agent service logs: `docker compose logs agent-service --tail=50`
2. Common cause: Anthropic API key rate limit — have a backup key in `.env`
3. Fallback: Show cached results from a prior run (execution history in the UI)
4. Circuit breaker may have opened — check `/api/v1/metrics` for breaker state

### Database is slow

1. Check: `docker compose ps` — postgres should be healthy
2. Run: `docker compose restart postgres` if needed
3. Allow 30 seconds for reconnect

### SSE streaming not showing

1. Check browser — SSE requires HTTP/2 or careful HTTP/1.1 configuration
2. Reload the page after starting the agent run
3. The results will still appear when complete — streaming is cosmetic

### Org shows wrong data

1. Open browser console, run: `localStorage.removeItem("currentOrgId")`
2. Reload — it will default to US Bank
3. Or manually set: `localStorage.setItem("currentOrgId", "46d310b9")`

### Next.js build error on demo machine

1. `cd nextjs-app && npm run dev` for development mode (no build required)
2. Or use the Docker Compose deployment which has pre-built images

---

## Post-Demo Follow-Up

After the demo, send the prospect:
1. **TransformHub-POV.md** (in this docs folder) — executive overview document
2. **TransformHub-CaseStudy-NationalBank.md** (in this docs folder) — detailed case study with quantified outcomes
3. A POC proposal: 30-day deployment on their infrastructure, three seed orgs + their own org, Jira integration in week 1

The strongest follow-up action is a POC with their own Jira data — once they see their real cycle times surfaced, the value is self-evident.

---

*Demo guide maintained by the TransformHub Product team. Update after each platform release.*
