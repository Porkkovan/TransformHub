-- AlterTable
ALTER TABLE "digital_capabilities" ALTER COLUMN "sources" DROP DEFAULT;

-- AlterTable
ALTER TABLE "digital_products" ALTER COLUMN "sources" DROP DEFAULT;

-- AlterTable
ALTER TABLE "functionalities" ADD COLUMN     "automation_potential" TEXT,
ADD COLUMN     "estimated_cycle_time_min" DOUBLE PRECISION,
ADD COLUMN     "estimated_wait_time_min" DOUBLE PRECISION,
ADD COLUMN     "manual_touchpoints" INTEGER,
ALTER COLUMN "sources" DROP DEFAULT;

-- AlterTable
ALTER TABLE "value_stream_steps" ADD COLUMN     "classification" TEXT,
ADD COLUMN     "flow_efficiency" DOUBLE PRECISION,
ADD COLUMN     "improvement_note" TEXT,
ADD COLUMN     "lead_time_hrs" DOUBLE PRECISION,
ADD COLUMN     "process_time_hrs" DOUBLE PRECISION,
ADD COLUMN     "wait_time_hrs" DOUBLE PRECISION;
