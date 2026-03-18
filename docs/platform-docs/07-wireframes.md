# TransformHub — Wireframe Specifications

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12

---

## Table of Contents

1. [Login / Auth Screen](#1-login--auth-screen)
2. [Main Dashboard](#2-main-dashboard)
3. [Organisation Setup](#3-organisation-setup)
4. [Discovery Page](#4-discovery-page)
5. [VSM Analysis Page](#5-vsm-analysis-page)
6. [Future State Page](#6-future-state-page)
7. [Risk & Compliance Page](#7-risk--compliance-page)
8. [Knowledge Base / Context Page](#8-knowledge-base--context-page)
9. [Agent Execution Modal](#9-agent-execution-modal)
10. [Executive Report Page](#10-executive-report-page)
11. [Settings / Admin Page](#11-settings--admin-page)

---

## 1. Login / Auth Screen

### ASCII Wireframe

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│                                                                    │
│                    ┌─────────────────────┐                        │
│                    │  [TransformHub Logo] │                        │
│                    │                     │                        │
│                    │  AI Transformation  │                        │
│                    │  Intelligence       │                        │
│                    └─────────────────────┘                        │
│                                                                    │
│               ┌───────────────────────────────┐                   │
│               │  Email Address                │                   │
│               │  [________________________]   │                   │
│               │                               │                   │
│               │  Password                     │                   │
│               │  [________________________]   │                   │
│               │                               │                   │
│               │  [ Sign In ──────────────── ] │                   │
│               │                               │                   │
│               │  ─────── or ───────           │                   │
│               │  [ Sign in with Google     ]  │                   │
│               │                               │                   │
│               │  Don't have an account?       │                   │
│               │  [Request Access]             │                   │
│               └───────────────────────────────┘                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
Background: #0a0e12 (dark) with subtle grid pattern
Card: glassmorphism (bg-white/5, backdrop-blur, border-white/10)
```

### Component Inventory
- Logo lockup (SVG)
- Email input field with label
- Password input field with show/hide toggle
- "Sign In" primary CTA button
- Divider with "or" text
- OAuth sign-in button (Google)
- "Request Access" link
- Error banner (shown below email on invalid credentials)
- Loading spinner on Sign In press

### Interaction Specifications
- On submit: validate email format + non-empty password → POST to NextAuth credentials → JWT set → redirect to /dashboard
- On OAuth: redirect to Google OAuth flow → callback → session creation → redirect to /dashboard
- On error (401): display inline error "Invalid email or password"
- Enter key submits form

### Accessibility
- Form has `role="form"` and aria-labels on all inputs
- Error messages announced via aria-live region
- Tab order: email → password → sign in → OAuth

---

## 2. Main Dashboard

### ASCII Wireframe

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR  │  HEADER                                                 │
│          │  [TransformHub]  [US Bank ▾] [🔔 3] [User ▾]           │
│ ○ Dash   ├─────────────────────────────────────────────────────────┤
│ ○ Disc   │  Dashboard                                              │
│ ○ VSM    │                                                         │
│ ○ Futr   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│ ○ Risk   │  │ Discovery   │ │ VSM         │ │ Future State│      │
│ ○ Prod   │  │ ✅ Complete  │ │ ✅ Complete │ │ ✅ Complete │      │
│ ○ Arch   │  │ 87% acc     │ │ 79% acc     │ │ 82% acc     │      │
│ ○ KB     │  │ 12 products │ │ 3 products  │ │ 2 roadmaps  │      │
│ ○ Rpts   │  └─────────────┘ └─────────────┘ └─────────────┘      │
│ ○ Sett   │                                                         │
│          │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│          │  │ Risk        │ │ Architecture│ │ Reports     │      │
│          │  │ ⚠️ Pending  │ │ ─ Not Run  │ │ ─ Not Run  │      │
│          │  │ ─           │ │ ─           │ │ ─           │      │
│          │  └─────────────┘ └─────────────┘ └─────────────┘      │
│          │                                                         │
│          │  Recent Activity                   Accuracy Overview    │
│          │  ┌──────────────────────────┐  ┌──────────────────┐   │
│          │  │ ✅ Discovery completed   │  │  Avg Score: 83%  │   │
│          │  │    2 hours ago           │  │  ████████░░ 83%  │   │
│          │  │ ✅ VSM Analysis done     │  │                  │   │
│          │  │    3 hours ago           │  │  ● Discovery 87% │   │
│          │  │ 👤 HITL gate approved    │  │  ● VSM      79%  │   │
│          │  │    1 day ago             │  │  ● Fut State 82% │   │
│          │  └──────────────────────────┘  └──────────────────┘   │
└──────────┴─────────────────────────────────────────────────────────┘
```

### Component Inventory
- Sidebar navigation (10 items, active state highlighted)
- Header: logo, org selector dropdown, notification bell with badge, user menu
- Agent module cards (6 cards) with status, accuracy score, summary stat, Run button
- Recent Activity feed (last 5 events)
- Accuracy Overview bar chart or gauge

### Interaction Specifications
- Module card click → navigates to that module's page
- "Run" button on card → opens Agent Execution Modal
- Org selector → dropdown with all orgs, click to switch
- Notification bell → dropdown with pending HITL gates and recent run completions
- Accuracy score → click opens score breakdown tooltip

### Data Displayed
- Agent run status per module: Not Run / Running / Awaiting Review / Complete / Failed
- Accuracy score (0–100%)
- Key metric per module (product count, roadmap count, etc.)
- Last 5 audit_log entries formatted as human-readable activity
- Portfolio-level accuracy average

---

## 3. Organisation Setup

### ASCII Wireframe

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Settings > Organisation                                │
│          ├─────────────────────────────────────────────────────────┤
│          │  Organisation Profile                                   │
│          │  ┌────────────────────────────────────────────────────┐ │
│          │  │  Name: [US Bank________________________________]    │ │
│          │  │  Desc: [Leading US commercial bank_____________]   │ │
│          │  │  [Save Changes]                                     │ │
│          │  └────────────────────────────────────────────────────┘ │
│          │                                                         │
│          │  Business Segments  [+ Add Segment]                    │
│          │  ┌────────────────────────────────────────────────────┐ │
│          │  │  ≡ 1. Retail Banking          [Rename] [Delete]    │ │
│          │  │  ≡ 2. Institutional Banking   [Rename] [Delete]    │ │
│          │  │  ≡ 3. Wealth Management       [Rename] [Delete]    │ │
│          │  └────────────────────────────────────────────────────┘ │
│          │                                                         │
│          │  Repositories  [+ New Repository]                      │
│          │  ┌────────────────────────────────────────────────────┐ │
│          │  │  📁 Digital Channels Portfolio     [Edit] [Delete] │ │
│          │  │     12 digital products                            │ │
│          │  │  📁 Core Banking Platform          [Edit] [Delete] │ │
│          │  │     7 digital products                             │ │
│          │  └────────────────────────────────────────────────────┘ │
│          │                                                         │
│          │  Members  [+ Invite Member]                            │
│          │  ┌────────────────────────────────────────────────────┐ │
│          │  │  👤 Jane Smith (Admin)   jane@usbank.com  [Remove] │ │
│          │  │  👤 Mark Chen  (Viewer)  mark@usbank.com  [Remove] │ │
│          │  └────────────────────────────────────────────────────┘ │
└──────────┴─────────────────────────────────────────────────────────┘
```

### Component Inventory
- Organisation profile form (name, description, save button)
- Business segments list (draggable, renameable, deleteable) with Add button
- Repositories list with product count, edit/delete actions, New Repository button
- Members list with role badge, remove action, Invite button
- Danger Zone section (delete organisation) at bottom

### Interaction Specifications
- Segment drag-and-drop reorders list → triggers PUT /api/organizations/[id]
- Segment rename: inline edit with confirm/cancel
- Segment delete: confirmation modal with cascade warning
- New Repository: modal with name + description fields
- Invite Member: modal with email input + role selector

---

## 4. Discovery Page

### ASCII Wireframe

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Discovery                    [Accuracy: 87% ●]        │
│          ├─────────────────────────────────────────────────────────┤
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │ Segment: [Retail Banking ▾]  Repo: [Digital ▾]   │  │
│          │  │ [🤖 Run Discovery Agent]  [Last run: 2h ago]     │  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
│          │  Filter: [🔍 Search products...]  [All Segments ▾]    │
│          │                                                         │
│          │  Digital Products (12)                                 │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │ ▼ 💳 Online Banking Portal        [Retail Banking]│  │
│          │  │   ▼ 🔷 Digital Authentication                    │  │
│          │  │       ● Biometric Login                          │  │
│          │  │       ● MFA Management                           │  │
│          │  │   ▼ 🔷 Account Management                        │  │
│          │  │       ● Balance Inquiry                          │  │
│          │  │       ● Transaction History                      │  │
│          │  │ ▶ 📱 Mobile Banking App          [Retail Banking]│  │
│          │  │ ▶ 💰 Payment Processing Hub      [Retail Banking]│  │
│          │  │ ▶ 🏦 Core Account Services       [Institutional] │  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                  [Export CSV] [+ Add]  │
└──────────┴─────────────────────────────────────────────────────────┘
```

### Component Inventory
- Segment selector dropdown
- Repository selector dropdown
- "Run Discovery Agent" CTA button with last-run timestamp
- Accuracy score badge
- Search/filter bar
- Segment filter dropdown
- Expandable tree (products → capabilities → functionalities)
- Product card: icon, name, segment badge, expand arrow
- Capability card: icon, name, maturity level badge
- Functionality item: bullet, name
- Export CSV button
- Add Product button (manual add)

### Interaction Specifications
- Run Discovery: POST to agent service → shows loading state → on complete, tree refreshes
- Expand product: toggles children visibility with animation
- Click capability: opens right panel with full details (description, maturity, functionalities)
- Segment filter: client-side filter on tree
- Search: filters tree nodes matching text

---

## 5. VSM Analysis Page

### ASCII Wireframe

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Value Stream Analysis             [Accuracy: 79% ●]   │
│          ├─────────────────────────────────────────────────────────┤
│          │  Product: [Online Banking Portal ▾]                    │
│          │  [🤖 Run VSM Analysis]  [Last run: 3h ago]             │
│          ├─────────────────────────────────────────────────────────┤
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │ Process Efficiency: 34%  Lead Time: 12d  Steps: 8│  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
│          │  Value Stream Map                                       │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │ ┌─────┐→┌─────┐→┌─────┐→┌─────┐→┌─────┐→┌─────┐│  │
│          │  │ │Reqmt│  │Design│ │Dev  │  │Test │  │Deploy│ │Ops │ │  │
│          │  │ │ 2d  │  │ 3d  │  │ 8d  │  │ 4d  │  │ 1d  │  │∞  │ │  │
│          │  │ │⚡35%│  │⚡20%│  │⚡60%│  │⚡45%│  │⚡85%│  │⚡80%│  │
│          │  │ │ CT:4h│  │CT:6h│  │CT:16h│ │CT:8h│  │CT:2h│  │─  │  │
│          │  │ │ WT:1.5d│WT:2.5d│WT:6d│ │WT:3d│  │WT:0.5d│─  │  │
│          │  │ └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘│
│          │  │        ⚠️ Waste: Wait    ⚠️ Waste: Overprocess       │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
│          │  Identified Wastes (5)                                  │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │ 🔴 Waiting: Dev queue backlog (High Impact)       │  │
│          │  │ 🟡 Overprocessing: Redundant test cycles (Med)    │  │
│          │  └──────────────────────────────────────────────────┘  │
└──────────┴─────────────────────────────────────────────────────────┘
```

### Component Inventory
- Product selector dropdown
- "Run VSM Analysis" button with last-run timestamp
- Summary metrics bar (efficiency %, lead time, step count)
- Swim lane diagram (horizontal scrollable for many steps)
- Step cards: name, duration, automation %, CT, WT, waste indicator
- Waste indicator icon on step (⚠️ with category colour)
- Waste list panel below diagram
- Waste item: severity colour, category, description, impact rating

### Interaction Specifications
- Product select → loads existing VSM if available, shows Run button
- Step card click → expands detail panel on right with full metrics and edit capability
- Waste item click → highlights corresponding step in swim lane
- Run VSM → shows Agent Execution Modal during run
- Hover step → tooltip with full metrics table

---

## 6. Future State Page

### ASCII Wireframe

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Future State Vision               [Accuracy: 82% ●]   │
│          ├─────────────────────────────────────────────────────────┤
│          │  Product: [Online Banking Portal ▾]                    │
│          │  [🤖 Run Future State Vision]  [Last run: 5h ago]      │
│          │  🎯 Benchmark-grounded                                  │
│          ├─────────────────────────────────────────────────────────┤
│          │  Transformation Roadmap                                 │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │ Phase 1: Stabilise     Phase 2: Modernise  Phase 3│  │
│          │  │ Months 1-3             Months 4-9          M10-18 │  │
│          │  │ ██████                 ████████████        ██████ │  │
│          │  │ • Auth upgrade         • API-first arch    • Cloud│  │
│          │  │ • Tech debt reduction  • Microservices     • AI   │  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
│          │  Projected Metrics                [🎯 Benchmark-based] │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │ Metric          Current  Conservative  Expected  Opt│
│          │  │ Process Eff.    34%      52%           65%      80% │
│          │  │ Lead Time       12d      8d            6d       4d  │
│          │  │ Automation      35%      55%           70%      85% │
│          │  │ Cycle Time      16h      11h           8h       5h  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
│          │  [Export PDF]  [Share Link]                            │
└──────────┴─────────────────────────────────────────────────────────┘
```

### Component Inventory
- Product selector
- Run Future State Vision button
- Benchmark-grounded badge (shown when agent provides projected_metrics)
- Roadmap timeline with phase blocks
- Phase cards: name, date range, activities list
- Projected metrics table with current/conservative/expected/optimistic columns
- Confidence band chart (toggleable with table view)
- Export PDF button
- Share Link button

### Interaction Specifications
- Phase click → expands to show full activity list and deliverables
- Metric row hover → tooltip shows benchmark source document
- Benchmark-grounded badge hover → tooltip explains "Based on N uploaded benchmark documents"
- "Estimated" label (fallback) hover → tooltip explains multiplier-based estimation
- Export PDF → generates and downloads PDF report

---

## 7. Risk & Compliance Page

### ASCII Wireframe

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Risk & Compliance                                      │
│          ├─────────────────────────────────────────────────────────┤
│          │  Product: [Online Banking Portal ▾]                    │
│          │  [🤖 Run Risk Assessment]                               │
│          ├──────────────────────┬──────────────────────────────────┤
│          │  Risk Heat Map       │  Filter: [All Categories ▾]     │
│          │  ┌─────────────────┐ │  Sort: [Severity ▾]             │
│          │  │   5 │ · · R · · │ │                                 │
│          │  │   4 │ · R · R · │ │  Risk Register                  │
│          │  │   3 │ · · R · · │ │  ┌──────────────────────────┐  │
│          │  │   2 │ R · · · · │ │  │ 🔴 R-001 Data Breach      │  │
│          │  │   1 │ · · · · · │ │  │ L:5 I:5 Sev:25 [GDPR]   │  │
│          │  │     └──────────-│ │  │ 🟡 R-002 API Downtime     │  │
│          │  │       1 2 3 4 5 │ │  │ L:3 I:4 Sev:12 [SLA]    │  │
│          │  │   Impact →      │ │  │ 🟢 R-003 UI Performance   │  │
│          │  └─────────────────┘ │  │ L:2 I:2 Sev:4  [Perf]   │  │
│          │  Likelihood ↑       │  └──────────────────────────┘  │
│          │                      │                                 │
│          │                      │  [Add Mitigation] [Export PDF] │
└──────────┴──────────────────────┴─────────────────────────────────┘
```

### Component Inventory
- Product selector
- Run Risk Assessment button
- 5×5 likelihood/impact heat map with risk dots
- Filter dropdown (by category)
- Sort dropdown (by severity, likelihood, impact)
- Risk register table (scrollable)
- Risk row: severity colour, ID, name, likelihood, impact, severity score, regulatory badge
- Risk detail side panel (slides in on click)
- Add Mitigation button
- Export PDF button

### Interaction Specifications
- Risk dot hover → tooltip with risk name and top mitigation
- Risk dot click → scrolls risk register to that row and opens detail
- Risk row click → opens detail panel with full description, mitigations, regulatory mapping
- Quadrant click on heat map → filters risk register to that quadrant
- Add Mitigation → inline form below selected risk row

---

## 8. Knowledge Base / Context Page

### ASCII Wireframe

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Knowledge Base                                         │
│          ├─────────────────────────────────────────────────────────┤
│          │  ┌──────────────────┐ ┌──────────────────────────────┐ │
│          │  │ Upload Document  │ │ Fetch from URL               │ │
│          │  │                  │ │                              │ │
│          │  │ [📎 Drop files   │ │ URL: [https://github.com/...] │ │
│          │  │   or click here] │ │ [Fetch Content]              │ │
│          │  │                  │ │                              │ │
│          │  │ Category:        │ │ Category:                    │ │
│          │  │ [VSM Benchmarks▾]│ │ [Case Studies ▾]             │ │
│          │  │ [Upload]         │ │                              │ │
│          │  └──────────────────┘ └──────────────────────────────┘ │
│          ├─────────────────────────────────────────────────────────┤
│          │  Search: [🔍 Search knowledge base...]                  │
│          │  Filter: [All Categories ▾]  Sort: [Latest ▾]         │
│          │                                                         │
│          │  Documents (24)                                         │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │ 📄 Banking VSM Benchmarks 2024   [VSM_BENCH]  87ch│  │
│          │  │    Uploaded 2 hours ago                [Delete]   │  │
│          │  │ 📄 Telstra Transformation Case    [CASE_STUDY] 142ch│
│          │  │    Fetched from URL               [Delete]        │  │
│          │  │ 🤖 Discovery Output - Retail      [AGENT_OUTPUT]  │  │
│          │  │    Auto-saved 3 hours ago         [Delete]        │  │
│          │  └──────────────────────────────────────────────────┘  │
└──────────┴─────────────────────────────────────────────────────────┘
```

### Component Inventory
- Upload panel: drag-and-drop zone, category selector, Upload button
- URL fetch panel: URL input, category selector, Fetch button
- Search bar with free-text search
- Category filter dropdown (All, VSM_BENCHMARKS, TRANSFORMATION_CASE_STUDIES, ARCHITECTURE_STANDARDS, REGULATORY, AGENT_OUTPUT, GENERAL)
- Sort dropdown (Latest, Most Chunks, Category)
- Document list (card-based)
- Document card: icon (📄 or 🤖), title, category badge, chunk count, upload timestamp, Delete button
- Chunk viewer panel (slides in on document click)

### Interaction Specifications
- Drop files → auto-detect type, show progress bar during upload/chunking/embedding
- Fetch URL → validates URL format, shows progress, adds to list on complete
- Document card click → opens right panel showing first 5 chunks with text preview
- Delete → confirmation modal → removes document + chunks from pgvector
- Search → live search against document titles and chunk content
- Category filter → client-side filter on document list

---

## 9. Agent Execution Modal

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  Running Discovery Agent                          [✕ Close] │
├─────────────────────────────────────────────────────────────┤
│  Progress                                                   │
│  ✅ Load Organisation Context                   0.8s        │
│  ✅ Retrieve RAG Context (23 chunks)            1.2s        │
│  ✅ Format Context Section                      0.1s        │
│  🔄 Generate Product Analysis...               [●●●○○○]    │
│  ○  Persist Results                                         │
│  ○  Save to Knowledge Base                                  │
│  ○  Update Accuracy Score                                   │
│                                                             │
│  Elapsed: 12.3s                                             │
├─────────────────────────────────────────────────────────────┤
│  [▼ Show agent log]                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [12:03:01] Agent starting with 23 context chunks    │   │
│  │ [12:03:02] Analysing business segment: Retail Bank  │   │
│  │ [12:03:08] Identified 12 digital products           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

--- HITL GATE STATE ---
┌─────────────────────────────────────────────────────────────┐
│  ⏸ Human Review Required                         [✕ Close] │
├─────────────────────────────────────────────────────────────┤
│  The agent has paused for your review before saving.        │
│                                                             │
│  Draft Output Preview:                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Read-only preview of agent output]                 │   │
│  │ • Product: Online Banking Portal                    │   │
│  │   Capabilities: Auth, Account Mgmt, Payments...    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ○ Approve — Save this output as-is                        │
│  ● Reject — Provide feedback for improvement               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Feedback: [Include treasury management product...   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Cancel]                    [Submit Decision ──────────]   │
└─────────────────────────────────────────────────────────────┘
```

### Component Inventory
- Modal header: agent name, close button
- Progress step list: icon (✅/🔄/○), step name, elapsed time
- Elapsed time counter
- Expandable agent log (collapsed by default)
- HITL gate view: pause message, draft output preview (read-only), approve/reject radio, feedback textarea, Submit button

### Interaction Specifications
- Steps complete in sequence with visual transition
- 🔄 icon animates while step is in progress
- "Show agent log" expands log with timestamped entries
- Close button: if agent running, shows "Agent will continue in background" confirmation
- HITL approve → POST to /api/agents/[id]/approve → agent resumes → modal shows completion
- HITL reject → POST to /api/agents/[id]/reject with feedback → modal shows "Agent re-running with your feedback"

---

## 10. Executive Report Page

### ASCII Wireframe

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Executive Report                                       │
│ Contents │  [🤖 Generate Report]  [Export PDF] [Share Link]       │
│ ─────────├─────────────────────────────────────────────────────────┤
│ 1. Exec  │  TransformHub Transformation Report                     │
│    Summary│  US Bank  |  Generated: 2026-03-12  |  Avg Acc: 83%   │
│ 2. Discov│  ─────────────────────────────────────────────────────  │
│ 3. VSM   │                                                         │
│ 4. Future│  1. Executive Summary                                   │
│ 5. Risk  │  ┌──────────────────────────────────────────────────┐  │
│ 6. Arch  │  │ US Bank's digital transformation assessment      │  │
│ 7. Recs  │  │ reveals 12 digital products across 3 business    │  │
│          │  │ segments with a current PCE of 34%...            │  │
│          │  │                                                   │  │
│          │  │ Key Findings:                                     │  │
│          │  │ • 12 products discovered, 87% accuracy           │  │
│          │  │ • 5 critical wastes identified in Online Banking  │  │
│          │  │ • 65% expected efficiency improvement potential   │  │
│          │  │ • 8 material risks requiring mitigation          │  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
│          │  2. Discovery Analysis         [87% accuracy]          │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │  [Pie chart: Products by Segment]                 │  │
│          │  │  [Table: Top Products by Capability Count]        │  │
│          │  └──────────────────────────────────────────────────┘  │
└──────────┴─────────────────────────────────────────────────────────┘
```

### Component Inventory
- Left sidebar: table of contents with section jump links
- Report header: org name, date, average accuracy score
- Section headings with module accuracy badge
- Executive Summary card with key findings bullets
- Discovery section: pie chart (products by segment) + table
- VSM section: swim lane summary + efficiency metrics
- Future State section: roadmap timeline + projected metrics table
- Risk section: heat map + top risks table
- Architecture section: recommendations cards
- Export PDF button (sticky header)
- Share Link button (generates shareable read-only URL)

### Interaction Specifications
- TOC link click → smooth scroll to section
- Section accuracy badge click → drill-down to agent run detail
- Chart data point click → links to corresponding detail page
- Export PDF → generates full PDF with all sections, charts, cover page
- Share → modal with read-only link and expiry options

---

## 11. Settings / Admin Page

### ASCII Wireframe

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Settings                                               │
│          ├─────┬───────────────────────────────────────────────────┤
│          │Org  │ API Keys │ Members │ Agents │ Danger Zone         │
│          ├─────┴───────────────────────────────────────────────────┤
│          │  API Configuration                                      │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │  OpenAI API Key                                   │  │
│          │  │  [sk-••••••••••••••••••••••••••••••••] [Update]   │  │
│          │  │  Status: ✅ Connected (gpt-4o)                    │  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
│          │  Agent Configuration                                    │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │  Discovery Agent   HITL: [○ Off  ● On]            │  │
│          │  │  VSM Agent         HITL: [● Off  ○ On]            │  │
│          │  │  Future State      HITL: [○ Off  ● On]            │  │
│          │  │  Risk & Compliance HITL: [● Off  ○ On]            │  │
│          │  └──────────────────────────────────────────────────┘  │
│          │                                                         │
│          │  Danger Zone                                            │
│          │  ┌──────────────────────────────────────────────────┐  │
│          │  │  [Clear All Agent Memories]  This cannot be undone│  │
│          │  │  [Reset All Agent Runs]      This cannot be undone│  │
│          │  │  [Delete Organisation]       Permanent deletion    │  │
│          │  └──────────────────────────────────────────────────┘  │
└──────────┴─────────────────────────────────────────────────────────┘
```

### Component Inventory
- Settings tabs: Org Profile, API Keys, Members, Agent Config, Danger Zone
- API Keys section: masked key display, update button, connection status indicator
- Agent HITL toggles (per agent, on/off)
- Danger Zone section: destructive actions with confirmation modals
- Platform version and health status footer

### Interaction Specifications
- API Key update → modal with new key input, validates by calling /api/v1/health → shows status
- HITL toggle → instant save via PATCH /api/agents/[type]/config
- Danger Zone actions → double-confirmation modal (type "DELETE" to confirm)
- Tab navigation → URL hash based (#api-keys, #members, etc.)
