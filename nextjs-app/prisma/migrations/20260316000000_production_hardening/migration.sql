-- ─── P0: Timing Provenance columns ──────────────────────────────────────────

ALTER TABLE "value_stream_steps"
  ADD COLUMN IF NOT EXISTS "timing_source"           TEXT,
  ADD COLUMN IF NOT EXISTS "timing_confidence"       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "target_process_time_hrs" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "target_wait_time_hrs"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "target_classification"   TEXT,
  ADD COLUMN IF NOT EXISTS "improvement_phase"       TEXT;

ALTER TABLE "functionalities"
  ADD COLUMN IF NOT EXISTS "timing_source"     TEXT,
  ADD COLUMN IF NOT EXISTS "timing_confidence" DOUBLE PRECISION;

-- ─── P0: User RBAC & MFA columns ─────────────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mfa_secret"    TEXT,
  ADD COLUMN IF NOT EXISTS "mfa_enabled"   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);

-- Back-fill old "MEMBER" role to "ANALYST" (now the default)
UPDATE "users" SET "role" = 'ANALYST' WHERE "role" = 'MEMBER';

-- ─── P0: API Key Management ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_by"      TEXT NOT NULL REFERENCES "users"("id"),
  "name"            TEXT NOT NULL,
  "key_hash"        TEXT NOT NULL UNIQUE,
  "key_prefix"      TEXT NOT NULL,
  "scopes"          TEXT[] NOT NULL DEFAULT ARRAY['agents:run'],
  "expires_at"      TIMESTAMP(3),
  "last_used_at"    TIMESTAMP(3),
  "is_active"       BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "api_keys_organization_id_idx" ON "api_keys"("organization_id");
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx"        ON "api_keys"("key_hash");

-- ─── P0: SSO Configuration ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sso_configs" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "provider"        TEXT NOT NULL,
  "client_id"       TEXT NOT NULL,
  "client_secret"   TEXT NOT NULL,
  "tenant_id"       TEXT,
  "issuer_url"      TEXT,
  "domain"          TEXT,
  "default_role"    TEXT NOT NULL DEFAULT 'ANALYST',
  "is_active"       BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── P0: Per-Org LLM Budget & Usage Tracking ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "org_llm_budgets" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "organization_id"       TEXT NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "monthly_token_cap"     INTEGER,
  "monthly_spend_cap"     DOUBLE PRECISION,
  "alert_threshold"       DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "hard_cap_enabled"      BOOLEAN NOT NULL DEFAULT FALSE,
  "current_period_start"  TIMESTAMP(3) NOT NULL,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "org_llm_usage" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "budget_id"       TEXT NOT NULL REFERENCES "org_llm_budgets"("id") ON DELETE CASCADE,
  "agent_type"      TEXT NOT NULL,
  "model"           TEXT NOT NULL,
  "input_tokens"    INTEGER NOT NULL,
  "output_tokens"   INTEGER NOT NULL,
  "cost_usd"        DOUBLE PRECISION NOT NULL,
  "execution_id"    TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "org_llm_usage_org_created_idx" ON "org_llm_usage"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "org_llm_usage_budget_idx"      ON "org_llm_usage"("budget_id");

-- ─── P1: Manual Timing Overrides ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "timing_overrides" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "entity_type"    TEXT NOT NULL,
  "entity_id"      TEXT NOT NULL,
  "field"          TEXT NOT NULL,
  "previous_value" DOUBLE PRECISION,
  "new_value"      DOUBLE PRECISION NOT NULL,
  "override_note"  TEXT,
  "overridden_by"  TEXT NOT NULL REFERENCES "users"("id"),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "timing_overrides_entity_idx" ON "timing_overrides"("entity_type", "entity_id");

-- ─── P2: Cross-Org Benchmark Aggregation ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "org_benchmarks" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "industry_type"   TEXT NOT NULL,
  "metric_name"     TEXT NOT NULL,
  "metric_value"    DOUBLE PRECISION NOT NULL,
  "agent_type"      TEXT NOT NULL,
  "period_month"    TEXT NOT NULL,
  "is_anonymized"   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "org_benchmarks_industry_metric_idx" ON "org_benchmarks"("industry_type", "metric_name");
CREATE INDEX IF NOT EXISTS "org_benchmarks_period_idx"          ON "org_benchmarks"("period_month");

-- ─── P2: HNSW Vector Index (replaces ivfflat for scale) ──────────────────────
-- Drop old ivfflat indices if they exist, create HNSW instead

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'context_embeddings_vector_idx'
  ) THEN
    DROP INDEX "context_embeddings_vector_idx";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "context_embeddings_hnsw_idx"
  ON "context_embeddings" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'code_embeddings_vector_idx'
  ) THEN
    DROP INDEX "code_embeddings_vector_idx";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "code_embeddings_hnsw_idx"
  ON "code_embeddings" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─── P2: Row-Level Security (multi-tenant isolation) ─────────────────────────

-- Enable RLS on org-scoped tables
ALTER TABLE "repositories"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "digital_products"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "digital_capabilities"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "functionalities"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_groups"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "value_stream_steps"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_executions"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "context_documents"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "context_embeddings"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vsm_metrics"           ENABLE ROW LEVEL SECURITY;

-- Application user bypasses RLS using set_config('app.current_org_id', ...)
-- Service account (transformhub) has BYPASSRLS for migrations

-- Repositories: org-scoped
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'repos_org_isolation' AND tablename = 'repositories'
  ) THEN
    CREATE POLICY "repos_org_isolation"
      ON "repositories" FOR ALL
      USING (
        "organization_id" = current_setting('app.current_org_id', TRUE)
        OR current_setting('app.current_org_id', TRUE) IS NULL
      );
  END IF;
END $$;

-- Agent executions: org-scoped
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'executions_org_isolation' AND tablename = 'agent_executions'
  ) THEN
    CREATE POLICY "executions_org_isolation"
      ON "agent_executions" FOR ALL
      USING (
        "organization_id" = current_setting('app.current_org_id', TRUE)
        OR "organization_id" IS NULL
        OR current_setting('app.current_org_id', TRUE) IS NULL
      );
  END IF;
END $$;

-- Context documents: org-scoped
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'context_docs_org_isolation' AND tablename = 'context_documents'
  ) THEN
    CREATE POLICY "context_docs_org_isolation"
      ON "context_documents" FOR ALL
      USING (
        "organization_id" = current_setting('app.current_org_id', TRUE)
        OR current_setting('app.current_org_id', TRUE) IS NULL
      );
  END IF;
END $$;

-- ─── P2: Audit log partitioning by month (range partition template) ───────────
-- Note: existing audit_logs table is already created; partitioning requires
-- recreating as partitioned table — done via separate maintenance migration.
-- This migration adds the archival index only.

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);
