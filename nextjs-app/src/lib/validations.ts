import { z } from "zod";

export const createRepositorySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  url: z.string().url("Invalid URL").optional().or(z.literal("")),
  description: z.string().max(2000).optional(),
  language: z.string().max(50).optional(),
  organizationId: z.string().uuid("Invalid organization ID").optional().nullable(),
});

export const createDigitalProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  currentState: z.string().max(5000).optional(),
  futureState: z.string().max(5000).optional(),
  businessSegment: z.string().max(200).optional().nullable(),
  repositoryId: z.string().uuid("Invalid repository ID"),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: z.string().min(1, "Slug is required").max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  industryType: z.string().min(1, "Industry type is required").max(100),
  description: z.string().max(2000).optional().nullable(),
  competitors: z.array(z.string().max(200)).optional().default([]),
  businessSegments: z.array(z.string().max(200)).optional().default([]),
  regulatoryFrameworks: z.array(z.string().max(200)).optional().default([]),
  personas: z.array(z.any()).optional().default([]),
});

export const executeAgentSchema = z.object({
  agentType: z.enum([
    "discovery",
    "lean_vsm",
    "future_state_vision",
    "backlog_okr",
    "risk_compliance",
    "architecture",
    "data_governance",
    "fiduciary",
    "market_intelligence",
    "product_transformation",
    "git_integration",
    "testing_validation",
    "cost_estimation",
    "change_impact",
    "documentation",
    "monitoring",
    "security",
    "skill_gap",
    "product_roadmap",
  ]),
  inputData: z.record(z.string(), z.unknown()).optional().default({}),
  repositoryId: z.string().uuid("Invalid repository ID").optional(),
  organizationId: z.string().uuid("Invalid organization ID").optional(),
});

// ─── Context Hub Schemas ─────────────────────────────────────────────────────

export const contextDocumentCategoryEnum = z.enum([
  "CURRENT_STATE",
  "FUTURE_STATE",
  "COMPETITOR",
  "TECH_TREND",
]);

export const uploadContextDocumentSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  category: contextDocumentCategoryEnum,
  subCategory: z.string().max(200).optional(),
});

export const createContextApplicationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  vendor: z.string().max(200).optional(),
  version: z.string().max(50).optional(),
  status: z.enum(["active", "deprecated", "sunset", "planned"]).optional().default("active"),
  businessSegment: z.string().max(200).optional(),
  technologyStack: z.array(z.string().max(200)).optional().default([]),
  integrations: z.array(z.string().max(200)).optional().default([]),
  annualCost: z.number().nonnegative().optional().nullable(),
  userCount: z.number().int().nonnegative().optional().nullable(),
  businessCriticality: z.enum(["high", "medium", "low"]).optional().default("medium"),
});

export const bulkCreateContextApplicationsSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  applications: z.array(createContextApplicationSchema).min(1),
});

export const contextSearchSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  query: z.string().min(1, "Query is required").max(500),
  category: contextDocumentCategoryEnum.optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

// ─── Tech Trend Schemas ──────────────────────────────────────────────────────

export const techTrendCategoryEnum = z.enum([
  "AI_ML",
  "CLOUD",
  "SECURITY",
  "DATA",
  "DEVOPS",
  "OTHER",
]);

export const techTrendMaturityEnum = z.enum([
  "ADOPT",
  "TRIAL",
  "ASSESS",
  "HOLD",
]);

export const createTechTrendSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: techTrendCategoryEnum,
  maturityLevel: techTrendMaturityEnum,
  description: z.string().max(2000).optional(),
  impactScore: z.number().int().min(1).max(10).optional().default(5),
  adoptionTimeline: z.string().max(200).optional(),
});

export const updateTechTrendSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: techTrendCategoryEnum.optional(),
  maturityLevel: techTrendMaturityEnum.optional(),
  description: z.string().max(2000).optional().nullable(),
  impactScore: z.number().int().min(1).max(10).optional(),
  adoptionTimeline: z.string().max(200).optional().nullable(),
});

export function formatZodError(error: z.core.$ZodError): string {
  return error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}
