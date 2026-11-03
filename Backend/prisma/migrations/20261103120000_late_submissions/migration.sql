-- A report submitted after its deadline is marked late. The Super Admin can let one office submit after the
-- deadline and grace period, until a given day, with a reason.
ALTER TABLE "performance_report" ADD COLUMN "is_late" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "late_allowed_until" DATE,
ADD COLUMN "late_allowed_reason" TEXT,
ADD COLUMN "late_allowed_by_person_id" UUID;

ALTER TABLE "performance_report" ADD CONSTRAINT "performance_report_late_allowed_by_person_id_fkey" FOREIGN KEY ("late_allowed_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
