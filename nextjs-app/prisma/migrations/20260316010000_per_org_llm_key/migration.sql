-- Add per-org Anthropic API key to org_llm_budgets.
-- Stored encrypted at the application level; never returned in API responses.
ALTER TABLE "org_llm_budgets"
  ADD COLUMN IF NOT EXISTS "anthropic_api_key" TEXT;
