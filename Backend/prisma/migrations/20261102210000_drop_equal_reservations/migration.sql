-- Sharing equally no longer reserves a part for offices that do not hold the KPI yet: a share counts once the KPI
-- is on that office's contract. Remove the parts reserved ahead of time.
DELETE FROM "responsibility_allocation" AS ra
USING "kpi_assignment" AS parent
WHERE ra."parent_assignment_id" = parent."id"
  AND parent."distribution_method" = 'EQUAL'
  AND ra."allocation_type" = 'DISTRIBUTED'
  AND ra."child_assignment_id" IS NULL;
