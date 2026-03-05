-- Add confidence scoring and source attribution to discovery hierarchy

ALTER TABLE "digital_products"
  ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sources" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "digital_capabilities"
  ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sources" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "functionalities"
  ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sources" TEXT[] NOT NULL DEFAULT '{}';
