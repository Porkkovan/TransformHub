# TransformHub — User Stories

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12

---

## Table of Contents

1. [EP-001: Organisation Management](#ep-001-organisation-management)
2. [EP-002: Digital Discovery](#ep-002-digital-discovery)
3. [EP-003: Value Stream Analysis](#ep-003-value-stream-analysis)
4. [EP-004: Future State Intelligence](#ep-004-future-state-intelligence)
5. [EP-005: Risk & Compliance](#ep-005-risk--compliance)
6. [EP-006: Knowledge Management](#ep-006-knowledge-management)
7. [EP-007: Agent Orchestration & Human Gates](#ep-007-agent-orchestration--human-gates)
8. [EP-008: Reporting & Executive Intelligence](#ep-008-reporting--executive-intelligence)
9. [Story Summary Table](#story-summary-table)

---

## EP-001: Organisation Management

---

**US-001**: Create New Organisation
- **As a** Technology Consultant
- **I want to** create a new organisation with name, description, and business segments
- **So that** I can manage a new client engagement within the platform
- **Acceptance Criteria**:
  - AC1: Given I navigate to Settings > Organisation, when I fill in name, description, and business segments and click Save, then the org is created and appears in the org selector
  - AC2: Given I enter duplicate org name, when I save, then I receive a validation error asking for a unique name
  - AC3: Given org is created, when I refresh, then the new org persists and is selectable
- **Story Points**: 3 | **Priority**: Must Have

---

**US-002**: Configure Business Segments
- **As a** Business Architect
- **I want to** configure the list of business segments for my organisation
- **So that** I can properly categorise digital products by their business domain
- **Acceptance Criteria**:
  - AC1: Given I am in org settings, when I add "Retail Banking" to segments, then it is saved and available in the Discovery segment selector
  - AC2: Given segments exist, when I drag to reorder them, then order is saved and positional mapping is updated
  - AC3: Given I rename a segment, when I save, then all digital_products with the old segment name are updated automatically
- **Story Points**: 3 | **Priority**: Must Have

---

**US-003**: Create and Manage Repositories
- **As a** Technology Consultant
- **I want to** create repositories to logically group digital products
- **So that** I can organise large product portfolios into manageable domains
- **Acceptance Criteria**:
  - AC1: Given I am in org settings, when I create a repository with a name, then it appears in the repository list
  - AC2: Given a repository exists, when I create a digital product, then I can assign it to that repository
  - AC3: Given I delete a repository, when I confirm, then a warning shows that child products will also be deleted
- **Story Points**: 2 | **Priority**: Must Have

---

**US-004**: Switch Between Organisations
- **As a** Technology Consultant
- **I want to** quickly switch between client organisations from the header
- **So that** I can manage multiple client engagements without logging out and back in
- **Acceptance Criteria**:
  - AC1: Given multiple orgs exist, when I click the org selector in the header, then a dropdown shows all my orgs
  - AC2: Given I select a different org, when it becomes active, then all pages refresh to show that org's data within 500ms
  - AC3: Given I refresh the page, when app loads, then my last selected org is restored from localStorage
- **Story Points**: 2 | **Priority**: Must Have

---

**US-005**: View Organisation Dashboard
- **As a** CDO
- **I want to** see a summary of my organisation's transformation status on the dashboard
- **So that** I can quickly understand the current state without navigating to individual pages
- **Acceptance Criteria**:
  - AC1: Given I load the dashboard, when data exists, then I see cards for each active agent module with status and accuracy score
  - AC2: Given accuracy scores exist, when displayed, then each score is colour-coded (red < 60%, amber 60-80%, green > 80%)
  - AC3: Given I click an agent card, when navigating, then I am taken to the relevant agent results page
- **Story Points**: 5 | **Priority**: Must Have

---

**US-006**: Load Demo Organisation on First Visit
- **As a** Evaluator / Prospect
- **I want to** see a pre-populated demo organisation when I first open the platform
- **So that** I can evaluate the platform's capabilities without needing to set up data myself
- **Acceptance Criteria**:
  - AC1: Given no org in localStorage, when app loads, then US Bank demo org is auto-selected
  - AC2: Given US Bank is selected, when I navigate to Discovery, then products and capabilities are already visible
  - AC3: Given I want to reset to demo, when I run localStorage.removeItem("currentOrgId"), then app reverts to US Bank on next load
- **Story Points**: 2 | **Priority**: Must Have

---

**US-007**: Invite Team Members
- **As an** Organisation Admin
- **I want to** invite colleagues to join my organisation in the platform
- **So that** multiple team members can collaborate on the transformation analysis
- **Acceptance Criteria**:
  - AC1: Given I am org admin, when I enter a colleague's email and click Invite, then they receive an invitation email
  - AC2: Given an invitation is accepted, when the user logs in, then they see only the invited org's data
  - AC3: Given I revoke an invitation, when confirmed, then the user loses access immediately
- **Story Points**: 5 | **Priority**: Should Have | **Release**: v1.1

---

**US-008**: Audit Organisation Changes
- **As a** Compliance Officer
- **I want to** see an audit log of all changes made to the organisation's data
- **So that** I can maintain a complete record of who changed what and when
- **Acceptance Criteria**:
  - AC1: Given any data change occurs, when I view the audit log, then the entry shows user, action, entity, timestamp
  - AC2: Given I filter by date range, when filter applied, then only entries within that range are shown
  - AC3: Given I export the audit log, when CSV downloaded, then all columns are included with no data loss
- **Story Points**: 3 | **Priority**: Should Have

---

## EP-002: Digital Discovery

---

**US-009**: Run Discovery Agent for a Business Segment
- **As a** Business Architect
- **I want to** run the Discovery Agent for a selected business segment
- **So that** the platform automatically maps our digital products and capabilities
- **Acceptance Criteria**:
  - AC1: Given I select "Retail Banking" and click Run Discovery, when agent completes within 30 seconds, then digital products are shown in the tree view
  - AC2: Given discovery runs, when results appear, then each product shows its business_segment tag matching my selection
  - AC3: Given agent fails, when error displayed, then I see a specific error message and a Retry button
- **Story Points**: 8 | **Priority**: Must Have

---

**US-010**: View Discovered Product Hierarchy
- **As a** Business Architect
- **I want to** view discovered digital products as an expandable tree showing products, capabilities, and functionalities
- **So that** I can validate the AI-generated capability map
- **Acceptance Criteria**:
  - AC1: Given discovery results exist, when page loads, then products are shown as top-level nodes expandable to capabilities then functionalities
  - AC2: Given I expand a capability, when functionalities show, then each has a name and description
  - AC3: Given a product has a maturity_level, when capability card shows, then maturity level is displayed as a badge
- **Story Points**: 3 | **Priority**: Must Have

---

**US-011**: Filter Products by Business Segment
- **As a** VP Digital Transformation
- **I want to** filter the product tree by business segment
- **So that** I can focus on a specific part of the business portfolio
- **Acceptance Criteria**:
  - AC1: Given products from multiple segments exist, when I select "Institutional Banking" in filter, then only those products show
  - AC2: Given I clear the filter, when all segments selected, then all products are visible
  - AC3: Given I apply filter, when count shows, then "(N products)" reflects the filtered count
- **Story Points**: 2 | **Priority**: Should Have

---

**US-012**: Edit Discovered Product Details
- **As a** Business Architect
- **I want to** edit the name and description of discovered products and capabilities
- **So that** I can correct any AI inaccuracies and align to our internal naming conventions
- **Acceptance Criteria**:
  - AC1: Given a product exists, when I click Edit and change the name, then the updated name is saved and shown in the tree
  - AC2: Given I edit a capability description, when saved, then the description persists across page refreshes
  - AC3: Given I save an edit, then an audit log entry is created recording the change
- **Story Points**: 5 | **Priority**: Should Have

---

**US-013**: Add Manual Products and Capabilities
- **As a** Business Architect
- **I want to** manually add products and capabilities not discovered by the agent
- **So that** I can include legacy or undocumented systems in the capability map
- **Acceptance Criteria**:
  - AC1: Given I click "Add Product", when I enter name, segment, and repository, then new product appears in tree
  - AC2: Given a product exists, when I click "Add Capability", then I can create a capability under it
  - AC3: Given I add a capability manually, when saved, then it is available for VSM analysis
- **Story Points**: 5 | **Priority**: Should Have

---

**US-014**: Re-run Discovery Incrementally
- **As a** Business Architect
- **I want to** re-run discovery without losing existing manually edited products
- **So that** I can update the capability map as the organisation evolves
- **Acceptance Criteria**:
  - AC1: Given discovery has run and I've edited products, when I re-run, then existing products are updated not deleted
  - AC2: Given re-run discovers a new product, when results shown, then new product is added to tree with "New" badge
  - AC3: Given a product exists in DB but not in re-run output, when results shown, then it is retained (not auto-deleted)
- **Story Points**: 5 | **Priority**: Should Have

---

**US-015**: View Discovery Accuracy Score
- **As a** VP Digital Transformation
- **I want to** see the accuracy score for the Discovery module
- **So that** I can assess how much I should trust the AI-generated capability map
- **Acceptance Criteria**:
  - AC1: Given discovery has run, when I view the dashboard, then Discovery accuracy score is displayed as a percentage
  - AC2: Given I hover over the score, when tooltip shows, then I see component breakdown (confidence, source diversity, run success, human edit rate)
  - AC3: Given multiple runs exist, when score is shown, then it is a composite across the most recent N runs
- **Story Points**: 3 | **Priority**: Must Have

---

**US-016**: Export Discovery Results
- **As a** Technology Consultant
- **I want to** export the discovered capability map to CSV or PDF
- **So that** I can share results with clients who don't have platform access
- **Acceptance Criteria**:
  - AC1: Given discovery results exist, when I click Export CSV, then a CSV with product, capability, functionality, segment columns is downloaded
  - AC2: Given I click Export PDF, when PDF generated, then a formatted report with the product tree is created
  - AC3: Given export runs, when download starts, then filename includes org name and date
- **Story Points**: 3 | **Priority**: Could Have

---

## EP-003: Value Stream Analysis

---

**US-017**: Run VSM Agent for a Digital Product
- **As a** Business Architect
- **I want to** run the Lean VSM Agent for a selected digital product
- **So that** I can get an AI-generated current-state value stream map
- **Acceptance Criteria**:
  - AC1: Given a digital product is selected, when I click Run VSM Analysis, then the agent completes within 45 seconds
  - AC2: Given agent completes, when swim lane shows, then steps are listed with cycle_time, wait_time, quality_score, automation_level
  - AC3: Given agent runs, when capabilities are loaded, then they are fetched via dc.digital_product_id join
- **Story Points**: 8 | **Priority**: Must Have

---

**US-018**: View Swim Lane Diagram
- **As a** Business Architect
- **I want to** view the value stream as a swim-lane process diagram
- **So that** I can visually understand the end-to-end process flow
- **Acceptance Criteria**:
  - AC1: Given VSM results exist, when page loads, then steps appear left-to-right in sequence order
  - AC2: Given a step has high wait_time, when displayed, then the step card has a visual waste indicator
  - AC3: Given I click on a step, when detail panel opens, then all metrics (cycle time, wait time, quality, automation) are shown
- **Story Points**: 5 | **Priority**: Must Have

---

**US-019**: View Waste Identification Summary
- **As a** VP Digital Transformation
- **I want to** see a list of identified wastes with categories and estimated impact
- **So that** I can prioritise improvement efforts
- **Acceptance Criteria**:
  - AC1: Given VSM completes, when waste panel shows, then each waste item has category (waiting, overprocessing, defects, etc.), description, and estimated impact
  - AC2: Given I sort by impact, when sorted, then highest-impact wastes appear at the top
  - AC3: Given I click a waste item, when detail shows, then the affected process step is highlighted in the swim lane
- **Story Points**: 3 | **Priority**: Must Have

---

**US-020**: View Process Efficiency Metrics
- **As a** VP Digital Transformation
- **I want to** see overall process efficiency metrics for the value stream
- **So that** I can communicate the baseline to leadership
- **Acceptance Criteria**:
  - AC1: Given VSM data exists, when metrics panel shows, then Process Cycle Efficiency is displayed as a percentage
  - AC2: Given metrics exist, when industry benchmark is available, then delta vs benchmark is shown
  - AC3: Given I export the VSM, when PDF generated, then metrics are included in the summary section
- **Story Points**: 3 | **Priority**: Should Have

---

**US-021**: Compare Multiple Products' VSM Results
- **As a** Business Architect
- **I want to** compare VSM results across multiple digital products
- **So that** I can identify which products have the most transformation potential
- **Acceptance Criteria**:
  - AC1: Given multiple products have VSM results, when I open comparison view, then side-by-side efficiency metrics are shown
  - AC2: Given comparison shows, when sorted by efficiency score, then lowest-performing products are at top
  - AC3: Given I select two products, when compared, then the delta in cycle time and waste count is highlighted
- **Story Points**: 5 | **Priority**: Could Have

---

**US-022**: Edit Value Stream Steps
- **As a** Business Architect
- **I want to** edit individual value stream steps to correct AI-generated metrics
- **So that** the VSM accurately reflects actual process performance
- **Acceptance Criteria**:
  - AC1: Given a value stream step exists, when I edit cycle_time, then the updated value persists and efficiency is recalculated
  - AC2: Given I edit a step, when saved, then an audit log entry records the change with old and new values
  - AC3: Given I edit metrics, when Future State Agent next runs, then it uses the updated metrics as baseline
- **Story Points**: 3 | **Priority**: Should Have

---

**US-023**: VSM Benchmark Upload
- **As a** Technology Consultant
- **I want to** upload VSM benchmark documents for an industry
- **So that** the VSM agent can produce benchmark-grounded efficiency comparisons
- **Acceptance Criteria**:
  - AC1: Given I upload a PDF tagged as VSM_BENCHMARKS, when processed, then chunks are available to VSM and Future State agents
  - AC2: Given benchmarks are uploaded, when VSM analysis runs, then step cards show benchmark comparison where available
  - AC3: Given benchmark doc is uploaded, when I search knowledge base with "banking VSM benchmark", then document is returned
- **Story Points**: 3 | **Priority**: Must Have

---

## EP-004: Future State Intelligence

---

**US-024**: Run Future State Vision Agent
- **As a** VP Digital Transformation
- **I want to** run the Future State Vision Agent after VSM is complete
- **So that** I get an AI-generated transformation roadmap grounded in benchmarks
- **Acceptance Criteria**:
  - AC1: Given VSM has completed for a product, when I click Run Future State, then roadmap is generated within 60 seconds
  - AC2: Given benchmarks are uploaded, when agent completes, then projected_metrics include conservative/expected/optimistic values
  - AC3: Given no benchmarks uploaded, when agent completes, then metrics still shown using internal multipliers with "Estimated" label
- **Story Points**: 8 | **Priority**: Must Have

---

**US-025**: View Benchmark-Grounded Projected Metrics
- **As a** VP Digital Transformation
- **I want to** see projected metrics showing conservative, expected, and optimistic transformation outcomes
- **So that** I can present a range of scenarios to leadership
- **Acceptance Criteria**:
  - AC1: Given projected_metrics from agent, when displayed, then three-band chart shows each metric at all three levels
  - AC2: Given benchmarks were used, when displayed, then "Benchmark-grounded" badge appears next to each metric
  - AC3: Given I hover on a confidence band, when tooltip shows, then the source benchmark document is referenced
- **Story Points**: 5 | **Priority**: Must Have

---

**US-026**: View Transformation Roadmap Timeline
- **As a** VP Digital Transformation
- **I want to** view the transformation roadmap as a phase timeline
- **So that** I can plan resource allocation and communicate milestones to stakeholders
- **Acceptance Criteria**:
  - AC1: Given roadmap exists, when page loads, then phases appear on a timeline with start/end indicators
  - AC2: Given I click a phase, when expanded, then activities and key deliverables are listed
  - AC3: Given phases have dependencies, when shown, then dependency arrows connect related phases
- **Story Points**: 5 | **Priority**: Must Have

---

**US-027**: Export Transformation Roadmap
- **As a** Technology Consultant
- **I want to** export the transformation roadmap as a PDF
- **So that** I can include it in client deliverables and board presentations
- **Acceptance Criteria**:
  - AC1: Given roadmap exists, when I click Export PDF, then a formatted PDF with cover page, timeline, and metrics is generated
  - AC2: Given PDF is generated, when downloaded, then filename includes org name and date (e.g. TransformHub_USBank_FutureState_2026-03-12.pdf)
  - AC3: Given PDF renders, when opened, then all phases, activities, metrics, and confidence scores are included
- **Story Points**: 5 | **Priority**: Should Have

---

**US-028**: Compare Future States Across Products
- **As a** CDO
- **I want to** compare transformation roadmaps across multiple digital products
- **So that** I can prioritise investment in the most impactful transformations
- **Acceptance Criteria**:
  - AC1: Given multiple products have future state results, when I open portfolio view, then all roadmaps are shown on a single timeline
  - AC2: Given portfolio view shows, when I sort by expected ROI, then highest-value transformations are at top
  - AC3: Given I click a product, when detail opens, then full roadmap is shown
- **Story Points**: 5 | **Priority**: Could Have

---

**US-029**: Approve Future State Plan via HITL Gate
- **As a** VP Digital Transformation
- **I want to** review and approve the AI-generated future state plan before it is finalised
- **So that** I maintain oversight and can inject domain knowledge before the plan is saved
- **Acceptance Criteria**:
  - AC1: Given HITL gate is configured, when agent reaches checkpoint, then execution pauses and I receive a review notification
  - AC2: Given I review the draft plan, when I approve, then execution resumes and plan is finalised and saved
  - AC3: Given I reject with feedback "Include regulatory migration phase", when feedback submitted, then agent re-runs incorporating my feedback
- **Story Points**: 5 | **Priority**: Must Have

---

## EP-005: Risk & Compliance

---

**US-030**: Run Risk & Compliance Agent
- **As a** Risk Officer
- **I want to** run the Risk & Compliance Agent for a digital product
- **So that** I get an AI-identified risk register with regulatory mapping
- **Acceptance Criteria**:
  - AC1: Given a product is selected, when I click Run Risk Assessment, then risks are identified within 60 seconds
  - AC2: Given agent completes, when risk register shows, then each risk has category, likelihood, impact, severity, and regulatory reference
  - AC3: Given agent uses capability context, then capabilities are loaded via correct dc.digital_product_id join
- **Story Points**: 8 | **Priority**: Should Have

---

**US-031**: View Risk Register
- **As a** Risk Officer
- **I want to** view identified risks in a sortable, filterable risk register
- **So that** I can prioritise mitigation activities
- **Acceptance Criteria**:
  - AC1: Given risks exist, when risk register loads, then all columns (ID, Category, Description, Likelihood, Impact, Severity, Regulatory Ref, Owner, Status) are shown
  - AC2: Given I sort by Severity, when sorted, then highest-severity risks are at the top
  - AC3: Given I filter by Category "Technical", when filter applied, then only technical risks are shown
- **Story Points**: 3 | **Priority**: Should Have

---

**US-032**: View Risk Heat Map
- **As a** CDO
- **I want to** see risks visualised on a 5×5 likelihood/impact heat map
- **So that** I can quickly identify critical risk areas at a glance
- **Acceptance Criteria**:
  - AC1: Given risks exist, when heat map loads, then risks are plotted as dots at their likelihood × impact coordinates
  - AC2: Given I hover on a risk dot, when tooltip shows, then risk title and mitigation summary are visible
  - AC3: Given I click a red-zone risk, when detail opens, then full risk description, regulatory mapping, and suggested mitigations are shown
- **Story Points**: 5 | **Priority**: Should Have

---

**US-033**: Create Mitigation Actions
- **As a** Risk Officer
- **I want to** create and assign mitigation actions for identified risks
- **So that** I can track remediation progress and reduce residual risk
- **Acceptance Criteria**:
  - AC1: Given a risk exists, when I click "Add Mitigation", then I can enter description, owner, and due date
  - AC2: Given a mitigation is marked complete, when saved, then the risk's residual severity is recalculated
  - AC3: Given mitigations exist, when I view the risk register, then each risk shows its mitigation count and completion percentage
- **Story Points**: 5 | **Priority**: Could Have

---

**US-034**: Upload Regulatory Framework Documents
- **As a** Technology Consultant
- **I want to** upload regulatory framework documents (GDPR, APRA, SOC2) to the knowledge base
- **So that** the Risk Agent can reference them when identifying compliance risks
- **Acceptance Criteria**:
  - AC1: Given I upload a document tagged REGULATORY, when processed, then it is chunked and available to the Risk Agent
  - AC2: Given regulatory doc is uploaded, when Risk Agent runs, then risk items reference specific regulatory clauses
  - AC3: Given I search knowledge base for "APRA CPS 234", when results show, then relevant regulatory chunks appear
- **Story Points**: 3 | **Priority**: Should Have

---

## EP-006: Knowledge Management

---

**US-035**: Upload Document to Knowledge Base
- **As a** Technology Consultant
- **I want to** upload PDF, DOCX, or Markdown files to the knowledge base
- **So that** agents can use this content to ground their analysis in real data
- **Acceptance Criteria**:
  - AC1: Given I select a PDF and click Upload, when processing completes within 60 seconds, then document appears in knowledge base list
  - AC2: Given document is uploaded, when chunks are created, then 2k-char chunks with 400-char overlap are stored in pgvector
  - AC3: Given upload fails, when error displayed, then I see the specific reason (file too large, unsupported format, etc.)
- **Story Points**: 5 | **Priority**: Must Have

---

**US-036**: Fetch Content from URL
- **As a** Technology Consultant
- **I want to** fetch content from a web URL or GitHub link
- **So that** I can add online resources to the knowledge base without manual download
- **Acceptance Criteria**:
  - AC1: Given I enter a GitHub markdown URL and click Fetch, when content is retrieved, then it is chunked and embedded automatically
  - AC2: Given I enter a web article URL, when fetched, then main text content is extracted (ads/nav stripped) and chunked
  - AC3: Given URL returns 404 or times out, when error shown, then I see a descriptive error message
- **Story Points**: 3 | **Priority**: Must Have

---

**US-037**: Categorise Knowledge Base Documents
- **As a** Technology Consultant
- **I want to** assign a category (VSM_BENCHMARKS, TRANSFORMATION_CASE_STUDIES, ARCHITECTURE_STANDARDS, REGULATORY, AGENT_OUTPUT, GENERAL) to each document
- **So that** agents receive context proportional to the document's relevance to their task
- **Acceptance Criteria**:
  - AC1: Given I upload a document, when I select category VSM_BENCHMARKS, then document is tagged
  - AC2: Given category is set, when VSM Agent retrieves context, then VSM_BENCHMARKS chunks receive higher budget allocation
  - AC3: Given I view knowledge base, when I filter by category, then only matching documents display
- **Story Points**: 3 | **Priority**: Must Have

---

**US-038**: Search Knowledge Base
- **As a** Technology Consultant
- **I want to** search the knowledge base using natural language queries
- **So that** I can verify relevant content exists before running an agent
- **Acceptance Criteria**:
  - AC1: Given documents exist, when I search "banking digital transformation ROI", then relevant chunks appear in results
  - AC2: Given search results show, when I click a result, then the full chunk text is displayed with document source
  - AC3: Given I search with no matching content, when results empty, then I see "No results found — try different keywords"
- **Story Points**: 3 | **Priority**: Should Have

---

**US-039**: View Agent Output Documents in Knowledge Base
- **As a** Business Architect
- **I want to** view auto-saved agent output documents in the knowledge base
- **So that** I can verify that prior agent outputs are available as context for future runs
- **Acceptance Criteria**:
  - AC1: Given Discovery Agent has completed, when I view knowledge base, then an AGENT_OUTPUT document for the discovery run appears
  - AC2: Given I click an AGENT_OUTPUT document, when detail shows, then I can view the chunks and confirm content
  - AC3: Given multiple agent runs exist, when filtered by AGENT_OUTPUT, then all runs' outputs are listed chronologically
- **Story Points**: 2 | **Priority**: Must Have

---

**US-040**: Delete Knowledge Base Documents
- **As a** Technology Consultant
- **I want to** delete outdated documents from the knowledge base
- **So that** agents are not grounded in stale or incorrect information
- **Acceptance Criteria**:
  - AC1: Given a document exists, when I click Delete and confirm, then document and all its chunks are removed from pgvector
  - AC2: Given I delete a document, when confirmed, then an audit log entry records the deletion
  - AC3: Given I accidentally delete, when I check knowledge base, then document is gone and cannot be recovered (warn user before delete)
- **Story Points**: 2 | **Priority**: Should Have

---

**US-041**: View Chunk Count and Embedding Status
- **As a** Technology Consultant
- **I want to** see the number of chunks and embedding status for each document
- **So that** I can verify documents have been successfully indexed
- **Acceptance Criteria**:
  - AC1: Given a document is uploaded, when processing completes, then chunk count and status "Indexed" are shown in the document list
  - AC2: Given embedding fails, when status shown, then it reads "Failed" with a retry button
  - AC3: Given I hover over chunk count, when tooltip shows, then I see average chunk size and total character count
- **Story Points**: 2 | **Priority**: Should Have

---

## EP-007: Agent Orchestration & Human Gates

---

**US-042**: View Agent Execution Progress
- **As a** Business Architect
- **I want to** see a progress indicator while an agent is running
- **So that** I know the system is working and approximately how long it will take
- **Acceptance Criteria**:
  - AC1: Given an agent is running, when progress shown, then each node completion is displayed (Load Context → RAG Retrieval → Generate → Persist)
  - AC2: Given agent runs > 15 seconds, when progress shown, then elapsed time is displayed
  - AC3: Given agent completes, when success shown, then accuracy score is immediately visible
- **Story Points**: 3 | **Priority**: Must Have

---

**US-043**: Configure HITL Gates
- **As a** VP Digital Transformation
- **I want to** configure which agents require human approval before finalising results
- **So that** I maintain oversight for critical transformation decisions
- **Acceptance Criteria**:
  - AC1: Given I navigate to agent settings, when I enable HITL for Future State Agent, then that agent will pause at the gate node
  - AC2: Given HITL is enabled, when agent reaches gate, then a banner notification appears in the UI
  - AC3: Given HITL is disabled, when agent runs, then it completes without pausing
- **Story Points**: 3 | **Priority**: Must Have

---

**US-044**: Approve Agent Output at HITL Gate
- **As a** VP Digital Transformation
- **I want to** review and approve agent output before it is saved
- **So that** I can validate AI decisions at critical points in the analysis
- **Acceptance Criteria**:
  - AC1: Given agent is paused at HITL gate, when I click Review, then I see the draft output in read-only view
  - AC2: Given I review and click Approve, when confirmed, then agent resumes and results are persisted
  - AC3: Given I approve, when confirmation shown, then accuracy score component "human_edit_rate" is updated
- **Story Points**: 5 | **Priority**: Must Have

---

**US-045**: Reject Agent Output with Feedback
- **As a** VP Digital Transformation
- **I want to** reject agent output and provide improvement feedback
- **So that** the agent re-runs with my domain knowledge injected
- **Acceptance Criteria**:
  - AC1: Given I review agent output and find issues, when I click Reject, then a feedback text area appears
  - AC2: Given I enter "Include data migration risk for legacy core banking system" and submit, when agent re-runs, then my feedback is injected into the prompt
  - AC3: Given feedback is submitted, when agent completes re-run, then feedback is saved to agent_memories for future use
- **Story Points**: 5 | **Priority**: Must Have

---

**US-046**: View Agent Memory Learnings
- **As a** Technology Consultant
- **I want to** view what the platform has learned from my HITL feedback
- **So that** I can understand how agent outputs will improve in future runs
- **Acceptance Criteria**:
  - AC1: Given HITL feedback has been submitted, when I view agent memories, then I see a list of stored learnings per agent
  - AC2: Given I view a memory, when detail shows, then the original feedback text and confidence score are displayed
  - AC3: Given a memory is no longer relevant, when I delete it, then it is removed from agent_memories and will not be injected in future runs
- **Story Points**: 3 | **Priority**: Should Have

---

**US-047**: View Accuracy Score Breakdown
- **As a** Business Architect
- **I want to** see the accuracy score breakdown for each agent module
- **So that** I can understand which aspects of the analysis are most trustworthy
- **Acceptance Criteria**:
  - AC1: Given an agent has completed runs, when I view the accuracy panel, then score is shown as a percentage with component breakdown
  - AC2: Given component scores shown, when I hover on "confidence", then a tooltip explains what this metric measures
  - AC3: Given accuracy is below 60%, when displayed, then score is red and a note suggests running with more context documents
- **Story Points**: 3 | **Priority**: Must Have

---

**US-048**: View Audit Trail
- **As a** Compliance Officer
- **I want to** view a tamper-evident audit trail of all platform activities
- **So that** I can produce evidence of AI governance for regulatory reviews
- **Acceptance Criteria**:
  - AC1: Given any agent runs or data changes, when I view audit log, then all activities appear with user, action, timestamp
  - AC2: Given I click "Verify Chain", when verification runs, then system confirms SHA-256 chain integrity
  - AC3: Given I export audit log, when CSV downloaded, then hash column is included for external verification
- **Story Points**: 3 | **Priority**: Must Have

---

**US-049**: Retry Failed Agent Runs
- **As a** Business Architect
- **I want to** retry a failed agent run
- **So that** I can recover from transient errors without re-entering all inputs
- **Acceptance Criteria**:
  - AC1: Given an agent run shows status "Failed", when I click Retry, then the run re-executes with the same inputs
  - AC2: Given retry succeeds, when results show, then success status replaces failure status
  - AC3: Given retry also fails (3rd attempt), when error shown, then I see suggested actions (check OpenAI key, check DB connection)
- **Story Points**: 2 | **Priority**: Must Have

---

## EP-008: Reporting & Executive Intelligence

---

**US-050**: Generate Executive Summary Report
- **As a** CDO
- **I want to** generate a comprehensive executive report from all completed agent analyses
- **So that** I have a board-ready document without manual synthesis
- **Acceptance Criteria**:
  - AC1: Given all domain agents have run, when I click Generate Report, then report is created within 10 minutes
  - AC2: Given report is generated, when viewed, then it includes: Discovery Summary, VSM Findings, Transformation Roadmap, Risk Register, Architecture Recommendations
  - AC3: Given accuracy scores exist, when report shows, then each section includes its module accuracy score
- **Story Points**: 8 | **Priority**: Should Have

---

**US-051**: View Report with Visualisations
- **As a** CDO
- **I want to** view the executive report with embedded charts and tables
- **So that** I can review the content visually before exporting
- **Acceptance Criteria**:
  - AC1: Given report exists, when I view it, then charts (efficiency metrics, risk heat map, roadmap timeline) are rendered inline
  - AC2: Given I navigate the report, when I click a section in the sidebar, then smooth scroll takes me to that section
  - AC3: Given the report is open, when I click a metric, then I can drill down to the source agent output
- **Story Points**: 5 | **Priority**: Should Have

---

**US-052**: Export Report as PDF
- **As a** Technology Consultant
- **I want to** export the executive report as a professionally formatted PDF
- **So that** I can include it in client deliverable packages
- **Acceptance Criteria**:
  - AC1: Given a report exists, when I click Export PDF, then a PDF with cover page, table of contents, and all sections is generated
  - AC2: Given PDF is generated, when downloaded, then filename is TransformHub_[OrgName]_[Date].pdf
  - AC3: Given PDF renders, when opened, then all charts and tables are legible and all text is included without truncation
- **Story Points**: 5 | **Priority**: Should Have

---

**US-053**: View Historical Agent Runs
- **As a** Business Architect
- **I want to** view the history of all agent runs for my organisation
- **So that** I can track how the analysis has evolved over time
- **Acceptance Criteria**:
  - AC1: Given multiple runs exist, when I view Run History, then each run shows agent type, date, status, accuracy score
  - AC2: Given I click a historical run, when detail view opens, then full inputs and outputs are shown in read-only view
  - AC3: Given I filter by agent type, when filter applied, then only runs of that type are shown
- **Story Points**: 3 | **Priority**: Could Have

---

**US-054**: Compare Analysis Across Time Periods
- **As a** CDO
- **I want to** compare transformation analysis results across two time periods
- **So that** I can demonstrate transformation progress to the board
- **Acceptance Criteria**:
  - AC1: Given runs from Q1 and Q2 exist, when I select both for comparison, then delta metrics are highlighted
  - AC2: Given comparison shows, when metrics improved, then improvement is shown in green with percentage
  - AC3: Given comparison shows, when metrics declined, then decline is flagged in red with a note
- **Story Points**: 5 | **Priority**: Could Have

---

**US-055**: Share Report Link
- **As a** Technology Consultant
- **I want to** share a read-only link to the generated report with client stakeholders
- **So that** they can review findings without needing a platform account
- **Acceptance Criteria**:
  - AC1: Given report exists, when I click Share, then a shareable link is generated
  - AC2: Given share link is opened, when viewed without login, then a read-only version of the report is shown
  - AC3: Given I revoke the share link, when link is accessed, then viewer receives "Access Revoked" message
- **Story Points**: 5 | **Priority**: Could Have

---

## Story Summary Table

| Story ID | Title | Epic | Priority | Points |
|----------|-------|------|----------|--------|
| US-001 | Create New Organisation | EP-001 | Must Have | 3 |
| US-002 | Configure Business Segments | EP-001 | Must Have | 3 |
| US-003 | Create and Manage Repositories | EP-001 | Must Have | 2 |
| US-004 | Switch Between Organisations | EP-001 | Must Have | 2 |
| US-005 | View Organisation Dashboard | EP-001 | Must Have | 5 |
| US-006 | Load Demo Organisation on First Visit | EP-001 | Must Have | 2 |
| US-007 | Invite Team Members | EP-001 | Should Have | 5 |
| US-008 | Audit Organisation Changes | EP-001 | Should Have | 3 |
| US-009 | Run Discovery Agent | EP-002 | Must Have | 8 |
| US-010 | View Product Hierarchy | EP-002 | Must Have | 3 |
| US-011 | Filter Products by Segment | EP-002 | Should Have | 2 |
| US-012 | Edit Discovered Product Details | EP-002 | Should Have | 5 |
| US-013 | Add Manual Products | EP-002 | Should Have | 5 |
| US-014 | Re-run Discovery Incrementally | EP-002 | Should Have | 5 |
| US-015 | View Discovery Accuracy Score | EP-002 | Must Have | 3 |
| US-016 | Export Discovery Results | EP-002 | Could Have | 3 |
| US-017 | Run VSM Agent | EP-003 | Must Have | 8 |
| US-018 | View Swim Lane Diagram | EP-003 | Must Have | 5 |
| US-019 | View Waste Identification | EP-003 | Must Have | 3 |
| US-020 | View Efficiency Metrics | EP-003 | Should Have | 3 |
| US-021 | Compare Multiple Products' VSM | EP-003 | Could Have | 5 |
| US-022 | Edit Value Stream Steps | EP-003 | Should Have | 3 |
| US-023 | VSM Benchmark Upload | EP-003 | Must Have | 3 |
| US-024 | Run Future State Vision Agent | EP-004 | Must Have | 8 |
| US-025 | View Projected Metrics | EP-004 | Must Have | 5 |
| US-026 | View Transformation Roadmap | EP-004 | Must Have | 5 |
| US-027 | Export Roadmap as PDF | EP-004 | Should Have | 5 |
| US-028 | Compare Future States | EP-004 | Could Have | 5 |
| US-029 | Approve Future State via HITL | EP-004 | Must Have | 5 |
| US-030 | Run Risk & Compliance Agent | EP-005 | Should Have | 8 |
| US-031 | View Risk Register | EP-005 | Should Have | 3 |
| US-032 | View Risk Heat Map | EP-005 | Should Have | 5 |
| US-033 | Create Mitigation Actions | EP-005 | Could Have | 5 |
| US-034 | Upload Regulatory Documents | EP-005 | Should Have | 3 |
| US-035 | Upload Document to Knowledge Base | EP-006 | Must Have | 5 |
| US-036 | Fetch Content from URL | EP-006 | Must Have | 3 |
| US-037 | Categorise Documents | EP-006 | Must Have | 3 |
| US-038 | Search Knowledge Base | EP-006 | Should Have | 3 |
| US-039 | View Agent Output Documents | EP-006 | Must Have | 2 |
| US-040 | Delete Knowledge Base Documents | EP-006 | Should Have | 2 |
| US-041 | View Chunk Count & Status | EP-006 | Should Have | 2 |
| US-042 | View Agent Execution Progress | EP-007 | Must Have | 3 |
| US-043 | Configure HITL Gates | EP-007 | Must Have | 3 |
| US-044 | Approve Agent Output at HITL | EP-007 | Must Have | 5 |
| US-045 | Reject Output with Feedback | EP-007 | Must Have | 5 |
| US-046 | View Agent Memory Learnings | EP-007 | Should Have | 3 |
| US-047 | View Accuracy Score Breakdown | EP-007 | Must Have | 3 |
| US-048 | View Audit Trail | EP-007 | Must Have | 3 |
| US-049 | Retry Failed Agent Runs | EP-007 | Must Have | 2 |
| US-050 | Generate Executive Summary Report | EP-008 | Should Have | 8 |
| US-051 | View Report with Visualisations | EP-008 | Should Have | 5 |
| US-052 | Export Report as PDF | EP-008 | Should Have | 5 |
| US-053 | View Historical Agent Runs | EP-008 | Could Have | 3 |
| US-054 | Compare Analysis Across Periods | EP-008 | Could Have | 5 |
| US-055 | Share Report Link | EP-008 | Could Have | 5 |

**Total Stories**: 55
**Total Story Points**: 224
**Must Have**: 29 stories, 131 points
**Should Have**: 17 stories, 66 points
**Could Have**: 9 stories, 40 points
