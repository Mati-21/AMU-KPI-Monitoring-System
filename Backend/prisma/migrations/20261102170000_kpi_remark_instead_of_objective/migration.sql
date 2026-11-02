-- KPIs are not tied to strategic objectives. A free remark takes the place of that column.
ALTER TABLE "kpi" DROP CONSTRAINT IF EXISTS "kpi_strategic_objective_id_fkey";
DROP INDEX IF EXISTS "kpi_strategic_objective_id_idx";
ALTER TABLE "kpi" DROP COLUMN "strategic_objective_id";
ALTER TABLE "kpi" ADD COLUMN "remark" TEXT;
DROP TABLE "strategic_objective";
