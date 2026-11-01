-- A share without a contract yet is not the kept row, so only the row with neither link is limited to one
DROP INDEX "responsibility_allocation_one_retained";

CREATE UNIQUE INDEX "responsibility_allocation_one_retained" ON "responsibility_allocation"("parent_assignment_id") WHERE "child_assignment_id" IS NULL AND "child_office_id" IS NULL;
