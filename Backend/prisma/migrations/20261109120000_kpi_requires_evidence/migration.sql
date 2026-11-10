-- Whether a KPI's results need evidence is now decided on each KPI, not by one switch for the whole university.
-- evidence_requirement stays as the note saying what to attach.
ALTER TABLE "kpi" ADD COLUMN "requires_evidence" BOOLEAN NOT NULL DEFAULT false;

-- Keep what the university had chosen: if evidence was required everywhere, every KPI keeps requiring it.
UPDATE "kpi" SET "requires_evidence" = true
WHERE EXISTS (SELECT 1 FROM "system_setting" WHERE "group_name" = 'reporting' AND "key" = 'require_evidence' AND "value" = 'true');

DELETE FROM "system_setting" WHERE "group_name" = 'reporting' AND "key" = 'require_evidence';
