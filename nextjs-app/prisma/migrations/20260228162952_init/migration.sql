-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry_type" TEXT NOT NULL,
    "description" TEXT,
    "competitors" TEXT[],
    "business_segments" TEXT[],
    "regulatory_frameworks" TEXT[],
    "personas" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "language" TEXT,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "current_state" TEXT,
    "future_state" TEXT,
    "business_segment" TEXT,
    "repository_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_capabilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "digital_product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "functionalities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_files" TEXT[],
    "digital_capability_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "functionalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "digital_product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "value_stream_steps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "step_order" INTEGER NOT NULL,
    "step_type" TEXT NOT NULL DEFAULT 'process',
    "product_group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "value_stream_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_mappings" (
    "id" TEXT NOT NULL,
    "persona_type" TEXT NOT NULL,
    "persona_name" TEXT NOT NULL,
    "responsibilities" TEXT[],
    "functionality_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vsm_metrics" (
    "id" TEXT NOT NULL,
    "process_time" DOUBLE PRECISION NOT NULL,
    "lead_time" DOUBLE PRECISION NOT NULL,
    "wait_time" DOUBLE PRECISION NOT NULL,
    "flow_efficiency" DOUBLE PRECISION NOT NULL,
    "mermaid_source" TEXT,
    "digital_capability_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vsm_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "risk_category" TEXT NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT,
    "mitigation_plan" TEXT,
    "transition_blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_mappings" (
    "id" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "description" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidence_links" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "previous_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_executions" (
    "id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "error_message" TEXT,
    "repository_id" TEXT,
    "organization_id" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "last_node_completed" TEXT,
    "checkpoint_data" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_jobs" (
    "id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "input_data" JSONB NOT NULL,
    "error_message" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dead_letter_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_versions" (
    "id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "prompt_hash" TEXT NOT NULL,
    "graph_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_embeddings" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CURRENT_STATE',
    "sub_category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "error_message" TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "context_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_embeddings" (
    "id" TEXT NOT NULL,
    "context_document_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_applications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "version" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "business_segment" TEXT,
    "technology_stack" TEXT[],
    "integrations" TEXT[],
    "annual_cost" DOUBLE PRECISION,
    "user_count" INTEGER,
    "business_criticality" TEXT NOT NULL DEFAULT 'medium',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "context_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "organization_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_executions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "repository_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "agent_statuses" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "gate_name" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "data_for_review" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "organization_id" TEXT,
    "memory_type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_feedbacks" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "corrections" JSONB,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "capability_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "reach" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effort" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rice_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quarter" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "source" TEXT NOT NULL DEFAULT 'agent',
    "approval_status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "digital_product_id" TEXT,
    "digital_capability_id" TEXT,
    "functionality_id" TEXT,
    "item_type" TEXT NOT NULL DEFAULT 'capability',
    "initiative" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_trends" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "maturity_level" TEXT NOT NULL,
    "impact_score" INTEGER NOT NULL DEFAULT 5,
    "adoption_timeline" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tech_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "agent_executions_agent_type_idx" ON "agent_executions"("agent_type");

-- CreateIndex
CREATE INDEX "agent_executions_status_idx" ON "agent_executions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_versions_agent_type_version_key" ON "agent_versions"("agent_type", "version");

-- CreateIndex
CREATE INDEX "code_embeddings_repository_id_idx" ON "code_embeddings"("repository_id");

-- CreateIndex
CREATE INDEX "context_documents_organization_id_idx" ON "context_documents"("organization_id");

-- CreateIndex
CREATE INDEX "context_documents_category_idx" ON "context_documents"("category");

-- CreateIndex
CREATE INDEX "context_documents_status_idx" ON "context_documents"("status");

-- CreateIndex
CREATE INDEX "context_embeddings_context_document_id_idx" ON "context_embeddings"("context_document_id");

-- CreateIndex
CREATE INDEX "context_embeddings_organization_id_idx" ON "context_embeddings"("organization_id");

-- CreateIndex
CREATE INDEX "context_applications_organization_id_idx" ON "context_applications"("organization_id");

-- CreateIndex
CREATE INDEX "context_applications_status_idx" ON "context_applications"("status");

-- CreateIndex
CREATE INDEX "agent_memories_agent_type_organization_id_idx" ON "agent_memories"("agent_type", "organization_id");

-- CreateIndex
CREATE INDEX "roadmap_items_organization_id_idx" ON "roadmap_items"("organization_id");

-- CreateIndex
CREATE INDEX "roadmap_items_rice_score_idx" ON "roadmap_items"("rice_score");

-- CreateIndex
CREATE INDEX "roadmap_items_digital_product_id_idx" ON "roadmap_items"("digital_product_id");

-- CreateIndex
CREATE INDEX "tech_trends_organization_id_idx" ON "tech_trends"("organization_id");

-- CreateIndex
CREATE INDEX "tech_trends_category_idx" ON "tech_trends"("category");

-- CreateIndex
CREATE INDEX "tech_trends_maturity_level_idx" ON "tech_trends"("maturity_level");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_products" ADD CONSTRAINT "digital_products_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_capabilities" ADD CONSTRAINT "digital_capabilities_digital_product_id_fkey" FOREIGN KEY ("digital_product_id") REFERENCES "digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "functionalities" ADD CONSTRAINT "functionalities_digital_capability_id_fkey" FOREIGN KEY ("digital_capability_id") REFERENCES "digital_capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_digital_product_id_fkey" FOREIGN KEY ("digital_product_id") REFERENCES "digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "value_stream_steps" ADD CONSTRAINT "value_stream_steps_product_group_id_fkey" FOREIGN KEY ("product_group_id") REFERENCES "product_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_mappings" ADD CONSTRAINT "persona_mappings_functionality_id_fkey" FOREIGN KEY ("functionality_id") REFERENCES "functionalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vsm_metrics" ADD CONSTRAINT "vsm_metrics_digital_capability_id_fkey" FOREIGN KEY ("digital_capability_id") REFERENCES "digital_capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_embeddings" ADD CONSTRAINT "code_embeddings_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_documents" ADD CONSTRAINT "context_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_embeddings" ADD CONSTRAINT "context_embeddings_context_document_id_fkey" FOREIGN KEY ("context_document_id") REFERENCES "context_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_embeddings" ADD CONSTRAINT "context_embeddings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_applications" ADD CONSTRAINT "context_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_executions" ADD CONSTRAINT "pipeline_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "agent_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_feedbacks" ADD CONSTRAINT "agent_feedbacks_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "agent_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_feedbacks" ADD CONSTRAINT "agent_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_digital_product_id_fkey" FOREIGN KEY ("digital_product_id") REFERENCES "digital_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_digital_capability_id_fkey" FOREIGN KEY ("digital_capability_id") REFERENCES "digital_capabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_functionality_id_fkey" FOREIGN KEY ("functionality_id") REFERENCES "functionalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_trends" ADD CONSTRAINT "tech_trends_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
