-- People archived by the older deactivate step kept running placements, so their positions still looked held.
-- End each one the day before the person was archived, as archiving does now (never before the placement began).
UPDATE "office_person" AS op
SET "end_date" = GREATEST(op."start_date", (p."archived_at" AT TIME ZONE 'UTC')::date - 1)
FROM "person" AS p
WHERE op."person_id" = p."id"
  AND p."is_active" = false
  AND p."archived_at" IS NOT NULL
  AND (op."end_date" IS NULL OR op."end_date" >= (p."archived_at" AT TIME ZONE 'UTC')::date);
