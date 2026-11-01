-- A share names its office, so it can be set before that office has a contract
ALTER TABLE "responsibility_allocation" ADD COLUMN "child_office_id" UUID;

CREATE UNIQUE INDEX "responsibility_allocation_parent_assignment_id_child_office_key" ON "responsibility_allocation"("parent_assignment_id", "child_office_id");

ALTER TABLE "responsibility_allocation" ADD CONSTRAINT "responsibility_allocation_child_office_id_fkey" FOREIGN KEY ("child_office_id") REFERENCES "office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
