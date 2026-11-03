-- Staff contracts: an office gives a contract to one person working in it, with KPIs taken from its own contract

ALTER TABLE "performance_contract" ADD COLUMN "person_id" UUID;
ALTER TABLE "kpi_assignment" ADD COLUMN "source_assignment_id" UUID;

ALTER TABLE "performance_contract" ADD CONSTRAINT "performance_contract_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kpi_assignment" ADD CONSTRAINT "kpi_assignment_source_assignment_id_fkey" FOREIGN KEY ("source_assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One office contract per office, and one staff contract per person and office, each year and version
DROP INDEX "performance_contract_fiscal_year_id_office_id_version_no_key";
CREATE INDEX "performance_contract_fiscal_year_id_office_id_version_no_idx" ON "performance_contract"("fiscal_year_id", "office_id", "version_no");
CREATE UNIQUE INDEX "performance_contract_office_one_per_year" ON "performance_contract"("fiscal_year_id", "office_id", "version_no") WHERE "person_id" IS NULL;
CREATE UNIQUE INDEX "performance_contract_person_one_per_year" ON "performance_contract"("fiscal_year_id", "office_id", "person_id", "version_no") WHERE "person_id" IS NOT NULL;

CREATE INDEX "performance_contract_person_id_idx" ON "performance_contract"("person_id");
CREATE INDEX "kpi_assignment_source_assignment_id_idx" ON "kpi_assignment"("source_assignment_id");
