-- The office above can pass evidence of an office below up into its own report. The copy points back to its source.
ALTER TABLE "performance_evidence" ADD COLUMN "forwarded_from_id" UUID;

CREATE INDEX "performance_evidence_forwarded_from_id_idx" ON "performance_evidence"("forwarded_from_id");

ALTER TABLE "performance_evidence" ADD CONSTRAINT "performance_evidence_forwarded_from_id_fkey" FOREIGN KEY ("forwarded_from_id") REFERENCES "performance_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
