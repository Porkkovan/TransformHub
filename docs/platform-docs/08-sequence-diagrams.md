# TransformHub — Sequence Diagrams

**Version**: 1.0
**Status**: Approved
**Last Updated**: 2026-03-12

---

## Table of Contents

1. [User Authentication Flow](#1-user-authentication-flow)
2. [Organisation Setup Flow](#2-organisation-setup-flow)
3. [Discovery Agent Execution Flow](#3-discovery-agent-execution-flow)
4. [VSM Analysis Flow](#4-vsm-analysis-flow)
5. [Future State Vision Flow](#5-future-state-vision-flow)
6. [RAG Document Upload Flow](#6-rag-document-upload-flow)
7. [RAG Retrieval Flow During Agent Execution](#7-rag-retrieval-flow-during-agent-execution)
8. [Human-in-the-Loop Gate Flow](#8-human-in-the-loop-gate-flow)
9. [Agent Memory Learning Flow](#9-agent-memory-learning-flow)
10. [Accuracy Score Calculation Flow](#10-accuracy-score-calculation-flow)
11. [Executive Report Generation Flow](#11-executive-report-generation-flow)
12. [Context Document Fetch-URL Flow](#12-context-document-fetch-url-flow)

---

## 1. User Authentication Flow

**Description**: Covers the complete authentication journey from login form submission through JWT session creation and redirect to the dashboard. NextAuth handles session lifecycle and stores sessions in PostgreSQL.

```mermaid
sequenceDiagram
    actor User
    participant Browser as Browser (Next.js)
    participant NextAuth as NextAuth.js
    participant DB as PostgreSQL

    User->>Browser: Enter email + password, click Sign In
    Browser->>NextAuth: POST /api/auth/callback/credentials {email, password}
    NextAuth->>DB: SELECT user WHERE email = ?
    DB-->>NextAuth: User record (hashed password)
    NextAuth->>NextAuth: bcrypt.compare(password, hash)
    alt Password valid
        NextAuth->>DB: INSERT INTO sessions (token, userId, expires)
        DB-->>NextAuth: Session created
        NextAuth->>Browser: Set httpOnly JWT cookie
        Browser->>Browser: Redirect to /dashboard
        Browser->>DB: GET organizations WHERE user_id = ?
        DB-->>Browser: Org list
        Browser->>Browser: Set defaultOrg (US Bank) in OrganizationContext
        Browser-->>User: Dashboard loaded with org context
    else Password invalid
        NextAuth-->>Browser: 401 Unauthorized
        Browser-->>User: Display "Invalid email or password"
    end
```

---

## 2. Organisation Setup Flow

**Description**: User creates a new organisation, configures business segments, and creates a repository. All data is persisted via the Next.js API routes which call FastAPI for agent-related operations, and Prisma for structural data.

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as FastAPI (:8000)
    participant DB as PostgreSQL

    User->>UI: Navigate to Settings > Organisation
    User->>UI: Enter org name, description, business segments
    UI->>API: POST /api/v1/organizations {name, desc, business_segments}
    API->>DB: INSERT INTO organizations (name, description, business_segments)
    DB-->>API: {id: "uuid", name: "US Bank"}
    API-->>UI: 201 Created {org}
    UI->>UI: Update OrganizationContext with new org
    UI-->>User: Org created, now in org settings

    User->>UI: Click "+ Add Segment" → type "Retail Banking"
    UI->>API: PUT /api/v1/organizations/{id} {business_segments: ["Retail Banking"]}
    API->>DB: UPDATE organizations SET business_segments = $1
    DB-->>API: Updated
    API-->>UI: 200 OK

    User->>UI: Click "+ New Repository" → enter "Digital Channels"
    UI->>API: POST /api/v1/repositories {organization_id, name, description}
    API->>DB: INSERT INTO repositories (organization_id, name, description)
    DB-->>API: {id: "repo-uuid", name: "Digital Channels"}
    API-->>UI: 201 Created {repository}
    UI-->>User: Repository shown in list, ready for products
```

---

## 3. Discovery Agent Execution Flow

**Description**: Full flow of the Discovery LangGraph agent from user trigger through AI analysis, result persistence, context doc auto-save, and accuracy score update.

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as FastAPI (:8000)
    participant LG as LangGraph (Discovery Graph)
    participant OpenAI as OpenAI API
    participant DB as PostgreSQL

    User->>UI: Select "Retail Banking" segment, click "Run Discovery"
    UI->>API: POST /api/v1/agents/discovery/execute {org_id, repo_id, business_segment}
    API->>DB: INSERT INTO agent_runs (org_id, agent_type, input_data, status=running)
    DB-->>API: run_id

    API->>LG: compile_graph().ainvoke(state, config)

    Note over LG: Node: load_context
    LG->>DB: SELECT organizations, repositories WHERE id = org_id
    DB-->>LG: Org context data

    Note over LG: Node: retrieve_rag
    LG->>DB: Multi-query vector + BM25 search for discovery context
    DB-->>LG: Top-25 deduplicated context chunks

    Note over LG: Node: format_context
    LG->>LG: format_context_section(input_data, agent_type="discovery")

    Note over LG: Node: generate
    LG->>OpenAI: POST /v1/chat/completions {model: gpt-4o, messages: [system+context+prompt]}
    OpenAI-->>LG: {products: [{name, capabilities: [...]}]}

    Note over LG: Node: validate
    LG->>LG: Pydantic schema validation of output

    Note over LG: Node: persist_results
    LG->>DB: INSERT INTO digital_products (repo_id, name, business_segment="Retail Banking")
    LG->>DB: INSERT INTO digital_capabilities (digital_product_id, name, maturity_level)
    LG->>DB: INSERT INTO functionalities (digital_capability_id, name, description)

    Note over LG: Node: save_output_to_context
    LG->>DB: INSERT INTO context_documents (org_id, title, category="AGENT_OUTPUT")
    LG->>OpenAI: Embed discovery output chunks
    OpenAI-->>LG: embeddings[]
    LG->>DB: INSERT INTO context_chunks (document_id, chunk_text, embedding)

    Note over LG: Node: audit_log
    LG->>DB: INSERT INTO audit_logs (action, entity_type, payload, hash=SHA256(prev_hash+payload))

    Note over LG: Node: update_accuracy
    LG->>DB: UPDATE accuracy_cache SET score=? WHERE org_id=? AND agent_type="discovery"
    LG->>DB: UPDATE agent_runs SET status=completed, output_data=?, accuracy_score=?

    LG-->>API: {status: completed, output: {products: [...]}, accuracy_score: 87}
    API-->>UI: 200 OK {run_id, status, output, accuracy_score}
    UI->>UI: Refresh product tree with new data
    UI-->>User: Discovery complete — product tree visible
```

---

## 4. VSM Analysis Flow

**Description**: Lean VSM agent loads capabilities for a product, runs analysis to identify value stream steps and waste, persists results, and auto-saves as context.

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as FastAPI (:8000)
    participant LG as LangGraph (VSM Graph)
    participant OpenAI as OpenAI API
    participant BM25 as BM25 Retrieval
    participant DB as PostgreSQL

    User->>UI: Select "Online Banking Portal", click "Run VSM Analysis"
    UI->>API: POST /api/v1/agents/lean-vsm/execute {org_id, product_id}

    Note over LG: Node: load_capabilities
    LG->>DB: SELECT dc.* FROM digital_capabilities dc WHERE dc.digital_product_id = $product_id
    DB-->>LG: Capabilities list (via correct join direction)
    LG->>DB: SELECT pg.* FROM product_groups pg WHERE pg.digital_product_id = $product_id
    DB-->>LG: Product groups

    Note over LG: Node: retrieve_rag (VSM-specific)
    LG->>DB: Vector search: ["VSM steps for digital banking", "cycle time benchmarks fintech", ...]
    LG->>BM25: BM25 search over same queries
    BM25-->>LG: BM25 scored chunks
    DB-->>LG: Vector similarity chunks
    LG->>LG: Union + dedup + top-25 by hit count
    LG->>BM25: Rerank top-25 with BM25

    Note over LG: Node: generate
    LG->>OpenAI: POST /v1/chat/completions {VSM analysis prompt + context + capabilities}
    OpenAI-->>LG: {value_stream_steps: [{name, cycle_time, wait_time, quality_score, automation_level, waste_items}]}

    Note over LG: Node: persist_vsm
    LG->>DB: Name→ID lookup: SELECT id FROM digital_capabilities WHERE name=$name
    LG->>DB: INSERT INTO product_groups (digital_product_id, name, process_type)
    LG->>DB: INSERT INTO value_stream_steps (product_group_id, name, cycle_time, wait_time, ...)

    Note over LG: Auto-save + audit
    LG->>DB: INSERT INTO context_documents (category="AGENT_OUTPUT") + context_chunks

    LG-->>API: {status: completed, vsm_steps: [...], waste_items: [...], accuracy_score: 79}
    API-->>UI: 200 OK with VSM data
    UI->>UI: Render swim lane diagram
    UI-->>User: VSM swim lane with steps, metrics, and waste indicators visible
```

---

## 5. Future State Vision Flow

**Description**: Future State agent uses VSM output and uploaded benchmarks to generate a transformation roadmap with projected metrics including conservative/expected/optimistic bands.

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as FastAPI (:8000)
    participant LG as LangGraph (Future State Graph)
    participant OpenAI as OpenAI API
    participant DB as PostgreSQL

    User->>UI: Click "Run Future State Vision" (after VSM complete)
    UI->>API: POST /api/v1/agents/future-state/execute {org_id, product_id}

    Note over LG: Node: load_vsm_context
    LG->>DB: SELECT vsm_steps, waste_items, product_groups WHERE product_id=$id
    DB-->>LG: Current state VSM data

    Note over LG: Node: retrieve_rag (benchmark-specific)
    LG->>DB: Vector search: ["transformation ROI banking", "PCE improvement fintech benchmark", ...]
    DB-->>LG: Top chunks — prioritises VSM_BENCHMARKS and TRANSFORMATION_CASE_STUDIES categories
    LG->>DB: SELECT previous AGENT_OUTPUT context docs for this product
    DB-->>LG: Prior agent outputs (Discovery, VSM)

    Note over LG: Node: generate_roadmap
    LG->>OpenAI: POST /v1/chat/completions {Future state prompt + VSM baseline + benchmarks}
    OpenAI-->>LG: {phases: [...], projected_metrics: {conservative: {...}, expected: {...}, optimistic: {...}}}

    alt Benchmarks found in context
        LG->>LG: Set benchmark_grounded = true
        Note over LG: projected_metrics populated from benchmark data
    else No benchmarks
        LG->>LG: Apply internal multipliers for projections
        Note over LG: projected_metrics populated with estimated values
    end

    Note over LG: Node: persist_roadmap
    LG->>DB: UPDATE agent_runs SET output_data = {phases, projected_metrics, benchmark_grounded}
    LG->>DB: INSERT context_document (AGENT_OUTPUT) + embed chunks

    LG-->>API: {roadmap, projected_metrics, benchmark_grounded: true, accuracy_score: 82}
    API-->>UI: 200 OK
    UI->>UI: Display roadmap timeline
    UI->>UI: Display projected metrics table
    UI->>UI: If benchmark_grounded=true: show "🎯 Benchmark-grounded" badge
    UI-->>User: Future state roadmap with 3-band metrics visible
```

---

## 6. RAG Document Upload Flow

**Description**: User uploads a document (PDF/DOCX/TXT/MD), it is extracted, chunked, embedded, and stored in pgvector for use in future agent runs.

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant UploadAPI as Next.js /api/context/upload
    participant Extractor as text-extractor.ts
    participant OpenAI as OpenAI Embeddings API
    participant DB as PostgreSQL (pgvector)

    User->>UI: Drag-drop PDF, select category "VSM_BENCHMARKS", click Upload
    UI->>UploadAPI: POST /api/context/upload {file, category, organization_id}

    UploadAPI->>Extractor: extractText(file)
    Extractor->>Extractor: Parse PDF using pdf-parse
    Extractor-->>UploadAPI: rawText (full document content)

    UploadAPI->>UploadAPI: chunkText(rawText, chunk_size=2000, overlap=400)
    Note over UploadAPI: Produces N chunks of ≤2000 chars with 400-char overlap

    UploadAPI->>DB: INSERT INTO context_documents {title, category, org_id, status="processing"}
    DB-->>UploadAPI: document_id

    loop For each batch of 100 chunks
        UploadAPI->>OpenAI: POST /v1/embeddings {model: "text-embedding-3-small", input: [chunk_texts]}
        OpenAI-->>UploadAPI: {embeddings: [[1536 floats], ...]}
        UploadAPI->>DB: INSERT INTO context_chunks (document_id, chunk_text, chunk_index, embedding)
    end

    UploadAPI->>DB: UPDATE context_documents SET status="indexed", chunk_count=N
    UploadAPI-->>UI: 200 OK {document_id, chunk_count: 87, status: "indexed"}
    UI->>UI: Add document to list with chunk count
    UI-->>User: "Banking VSM Benchmarks 2024 — 87 chunks indexed ✅"
```

---

## 7. RAG Retrieval Flow During Agent Execution

**Description**: The hybrid multi-query RAG retrieval executed at the start of every agent run, combining vector similarity and BM25 keyword search with deduplication and reranking.

```mermaid
sequenceDiagram
    participant Agent as Agent (any)
    participant QueryGen as Multi-Query Generator
    participant VectorSearch as Vector Search (pgvector)
    participant BM25 as BM25 Search (rank_bm25)
    participant Dedup as Deduplicator
    participant Reranker as BM25 Reranker
    participant Formatter as Context Formatter
    participant DB as PostgreSQL

    Agent->>QueryGen: generate_queries(agent_type, input_data)
    Note over QueryGen: agent_type="lean_vsm" generates:<br/>1. "value stream steps for {product}"<br/>2. "cycle time benchmarks banking"<br/>3. "waste identification lean VSM"<br/>4. "process efficiency improvement fintech"<br/>5. "automation opportunities digital banking"
    QueryGen-->>Agent: queries[5]

    loop For each query (parallel)
        Agent->>VectorSearch: SELECT chunks ORDER BY embedding <=> $query_embed LIMIT 15
        VectorSearch->>DB: ivfflat cosine similarity query (probes=10)
        DB-->>VectorSearch: [{chunk_id, text, score}, ...]
        VectorSearch-->>Agent: vector_results[q]

        Agent->>BM25: bm25_search(query, all_org_chunks)
        BM25->>DB: SELECT chunk_text WHERE document.org_id = $org_id
        DB-->>BM25: All org chunk texts
        BM25->>BM25: BM25Okapi(corpus).get_scores(query)
        BM25-->>Agent: bm25_results[q]
    end

    Agent->>Dedup: union_and_deduplicate(all_vector_results + all_bm25_results)
    Dedup->>Dedup: Group by chunk_id, count hits per chunk
    Dedup-->>Agent: {chunk_id: hit_count}[all unique chunks]

    Agent->>Agent: Sort by hit_count DESC, take top-25

    alt lean_vsm or future_state_vision
        Agent->>Reranker: bm25_rerank(top_25, original_query)
        Reranker-->>Agent: reranked_chunks[25]
    end

    alt No results found
        Agent->>DB: SELECT * FROM context_chunks WHERE document.org_id=$id ORDER BY created_at DESC LIMIT 25
        DB-->>Agent: fallback_chunks[25]
    end

    Agent->>Formatter: format_context_section(chunks, agent_type)
    Note over Formatter: Category-aware budget: 12k total chars<br/>VSM_BENCHMARKS: 4k budget for lean_vsm<br/>AGENT_OUTPUT: 3k budget<br/>Others: remaining budget
    Formatter-->>Agent: formatted_context_string (≤12k chars)
    Agent->>Agent: Inject formatted_context into system prompt
```

---

## 8. Human-in-the-Loop Gate Flow

**Description**: LangGraph INTERRUPT node pauses agent execution for human review. State is checkpointed to PostgreSQL. User reviews draft output and either approves (resume) or rejects with feedback (re-run with feedback injected).

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as FastAPI (:8000)
    participant LG as LangGraph Agent
    participant DB as PostgreSQL

    Note over LG: Agent reaches INTERRUPT node (e.g. after generate)
    LG->>DB: INSERT INTO agent_checkpoints (run_id, checkpoint_data, state="awaiting_review")
    LG->>DB: UPDATE agent_runs SET status="awaiting_review"
    LG-->>API: {status: "awaiting_review", checkpoint_id, draft_output}
    API-->>UI: 200 OK {status: "awaiting_review", draft_output}
    UI->>UI: Show HITL gate notification banner
    UI-->>User: "⏸ Discovery Agent awaiting your review"

    User->>UI: Click "Review" → opens HITL review panel
    UI-->>User: Shows draft output in read-only view

    alt User Approves
        User->>UI: Select "Approve", click "Submit Decision"
        UI->>API: POST /api/v1/agents/{run_id}/resume {decision: "approve"}
        API->>DB: SELECT checkpoint_data FROM agent_checkpoints WHERE run_id=$id
        DB-->>API: checkpoint_data
        API->>LG: graph.ainvoke(checkpoint_data) — resume from INTERRUPT
        Note over LG: Continues from persist node
        LG->>DB: Persist final results
        LG->>DB: INSERT audit_log (action="hitl_approved", ...)
        LG->>DB: UPDATE accuracy_cache (human_edit_rate decremented)
        LG-->>API: {status: "completed", output}
        API-->>UI: 200 OK completed
        UI-->>User: Agent completed — results visible

    else User Rejects with Feedback
        User->>UI: Select "Reject", enter feedback text, click "Submit"
        UI->>API: POST /api/v1/agents/{run_id}/resume {decision: "reject", feedback: "Include..."}
        API->>DB: INSERT INTO agent_memories (org_id, agent_type, memory_key, memory_value=feedback)
        DB-->>API: memory saved
        API->>LG: graph.ainvoke(state_with_feedback) — re-run from generate node
        Note over LG: Prompt now includes: "Previous feedback: Include..."
        LG->>LG: Re-generate with feedback injected
        LG-->>API: {status: "completed" or "awaiting_review"}
        API-->>UI: Result
        UI-->>User: "Agent re-ran with your feedback"
    end
```

---

## 9. Agent Memory Learning Flow

**Description**: After each agent run with HITL interactions, learnings are extracted and stored in agent_memories table. These are injected into the system prompt for future runs of the same agent within the same organisation.

```mermaid
sequenceDiagram
    participant LG as LangGraph Agent
    participant Memory as Agent Memory Module
    participant DB as PostgreSQL
    participant FutureRun as Future Agent Run

    Note over LG: Agent run completes (with or without HITL)
    LG->>Memory: extract_learnings(run_output, hitl_feedback, human_edits)

    Memory->>Memory: Identify learnings:
    Note over Memory: - Patterns in human edits<br/>- Rejected output themes<br/>- Approved output characteristics<br/>- Organisation-specific terminology

    loop For each learning
        Memory->>DB: SELECT * FROM agent_memories WHERE org_id=$id AND agent_type=$type AND memory_key=$key
        alt Memory exists
            DB-->>Memory: existing memory
            Memory->>Memory: Merge + update confidence score
            Memory->>DB: UPDATE agent_memories SET memory_value=$merged, confidence=$new_score
        else New memory
            Memory->>DB: INSERT INTO agent_memories (org_id, agent_type, memory_key, memory_value, confidence)
        end
    end

    Note over FutureRun: Next time same agent runs for same org
    FutureRun->>DB: SELECT * FROM agent_memories WHERE org_id=$id AND agent_type=$type ORDER BY confidence DESC LIMIT 10
    DB-->>FutureRun: Top-10 memories
    FutureRun->>FutureRun: Format memories as "Organisation Preferences" section
    FutureRun->>FutureRun: Inject into system prompt before RAG context
    Note over FutureRun: Prompt now includes:<br/>"Organisation preferences:<br/>- Always include treasury management products<br/>- Use internal product naming convention X"
```

---

## 10. Accuracy Score Calculation Flow

**Description**: Composite accuracy score calculation triggered after each agent run, using a weighted formula across four components. Scores are cached for 60 seconds.

```mermaid
sequenceDiagram
    participant API as FastAPI
    participant Scorer as Accuracy Scorer
    participant Cache as accuracy_cache table
    participant DB as PostgreSQL

    API->>Cache: SELECT * FROM accuracy_cache WHERE org_id=$id AND agent_type=$type AND computed_at > NOW()-60s

    alt Cache hit (fresh)
        Cache-->>API: cached_score
        API-->>API: Return cached score (no recalculation)
    else Cache miss (stale or missing)
        API->>Scorer: compute_accuracy(org_id, agent_type)

        Scorer->>DB: SELECT AVG(confidence) FROM agent_runs WHERE org_id=$id AND agent_type=$type AND status='completed' ORDER BY started_at DESC LIMIT 20
        DB-->>Scorer: confidence_avg

        Scorer->>DB: SELECT COUNT(DISTINCT source_type) FROM agent_runs r JOIN context_docs d ON r.id=d.run_id WHERE r.org_id=$id AND r.agent_type=$type ORDER BY r.started_at DESC LIMIT 20
        DB-->>Scorer: source_diversity_avg

        Scorer->>DB: SELECT COUNT(*) FILTER (status='completed') * 1.0 / COUNT(*) FROM agent_runs WHERE org_id=$id AND agent_type=$type ORDER BY started_at DESC LIMIT 20
        DB-->>Scorer: run_success_rate

        Scorer->>DB: SELECT COUNT(*) FILTER (WHERE human_edited=true) * 1.0 / COUNT(*) FROM agent_runs WHERE org_id=$id AND agent_type=$type ORDER BY started_at DESC LIMIT 20
        DB-->>Scorer: human_edit_rate

        Scorer->>Scorer: score = (confidence_avg * 0.4) + (source_diversity * 0.2) + (run_success * 0.3) + ((1 - human_edit_rate) * 0.1)
        Scorer->>Scorer: Normalise to 0-100

        Scorer->>Cache: INSERT INTO accuracy_cache (org_id, agent_type, score, components, computed_at=NOW())
        Cache-->>Scorer: Saved

        Scorer-->>API: {score: 87, components: {confidence: 0.89, source_diversity: 0.75, run_success: 0.95, human_edit_rate: 0.12}}
    end
```

---

## 11. Executive Report Generation Flow

**Description**: Executive Reporting Agent compiles all completed agent outputs into a structured C-suite report with confidence scores, visualisation data, and export capability.

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as FastAPI (:8000)
    participant LG as LangGraph (Reporting Graph)
    participant OpenAI as OpenAI API
    participant DB as PostgreSQL

    User->>UI: Click "Generate Report"
    UI->>API: POST /api/v1/agents/executive-reporting/execute {org_id}

    Note over LG: Node: gather_all_outputs
    LG->>DB: SELECT latest completed run per agent_type for org_id
    DB-->>LG: {discovery_output, vsm_output, future_state_output, risk_output, architecture_output}

    Note over LG: Node: gather_accuracy_scores
    LG->>DB: SELECT score, components FROM accuracy_cache WHERE org_id=$id
    DB-->>LG: Per-module accuracy scores

    Note over LG: Node: compile_narrative
    LG->>OpenAI: POST /v1/chat/completions {Report compilation prompt + all outputs + scores}
    OpenAI-->>LG: {executive_summary, key_findings, recommendations, sections: [...]}

    Note over LG: Node: build_visualisation_data
    LG->>LG: Compute: products by segment (pie data), risk heat map coords, roadmap timeline data, efficiency metrics table

    Note over LG: Node: persist_report
    LG->>DB: INSERT INTO agent_runs (agent_type="executive_reporting", output_data={narrative, viz_data, accuracy_scores})
    LG->>DB: INSERT INTO audit_logs (action="report_generated")

    LG-->>API: {report_id, narrative, viz_data, accuracy_scores}
    API-->>UI: 200 OK with full report data
    UI->>UI: Render report sections with charts
    UI-->>User: Executive report displayed

    User->>UI: Click "Export PDF"
    UI->>UI: Call browser print API or PDF generation library
    UI-->>User: TransformHub_USBank_2026-03-12.pdf downloaded
```

---

## 12. Context Document Fetch-URL Flow

**Description**: User provides a URL (web page or GitHub markdown), the backend fetches content, strips navigation/ads, chunks, embeds, and stores for RAG use.

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant FetchAPI as Next.js /api/context/fetch-url
    participant HTTPClient as httpx (async)
    participant Parser as Content Parser
    participant OpenAI as OpenAI Embeddings API
    participant DB as PostgreSQL

    User->>UI: Enter URL "https://github.com/org/repo/blob/main/benchmarks.md"
    User->>UI: Select category "VSM_BENCHMARKS", click "Fetch Content"
    UI->>FetchAPI: POST /api/context/fetch-url {url, category, organization_id}

    FetchAPI->>FetchAPI: Validate URL format (must be http/https)
    FetchAPI->>HTTPClient: GET {url} (timeout=30s, headers={User-Agent})

    alt URL is GitHub markdown
        HTTPClient->>HTTPClient: Transform to raw.githubusercontent.com URL
        HTTPClient-->>FetchAPI: Raw markdown content
        FetchAPI->>Parser: parse_markdown(content)
        Parser-->>FetchAPI: cleaned_text
    else URL is web page
        HTTPClient-->>FetchAPI: HTML content
        FetchAPI->>Parser: parse_html(html) using BeautifulSoup
        Parser->>Parser: Extract <main>, <article>, <body>; strip nav, footer, ads
        Parser-->>FetchAPI: cleaned_text
    end

    FetchAPI->>FetchAPI: chunkText(cleaned_text, chunk_size=2000, overlap=400)
    FetchAPI->>DB: INSERT INTO context_documents {title=url_title, source_url=url, category, org_id}
    DB-->>FetchAPI: document_id

    loop Embed chunks in batches of 100
        FetchAPI->>OpenAI: POST /v1/embeddings {model: "text-embedding-3-small", input: batch}
        OpenAI-->>FetchAPI: embeddings[]
        FetchAPI->>DB: INSERT INTO context_chunks (document_id, chunk_text, chunk_index, embedding)
    end

    FetchAPI->>DB: UPDATE context_documents SET status="indexed", chunk_count=N
    FetchAPI-->>UI: 200 OK {document_id, title, chunk_count, status: "indexed"}
    UI->>UI: Add document to knowledge base list
    UI-->>User: "benchmarks.md — 42 chunks indexed ✅"
