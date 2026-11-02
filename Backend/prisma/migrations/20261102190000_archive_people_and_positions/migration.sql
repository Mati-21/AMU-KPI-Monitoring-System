-- Archived people and positions stay in the database for history but leave the screens
ALTER TABLE "person" ADD COLUMN "archived_at" TIMESTAMPTZ(6),
ADD COLUMN "archived_email" TEXT,
ADD COLUMN "archived_staff_number" TEXT;

ALTER TABLE "position" ADD COLUMN "archived_at" TIMESTAMPTZ(6);

-- People archived before this change: date them and free their email and staff number
UPDATE "person"
SET "archived_at" = "updated_at",
    "archived_email" = "email",
    "archived_staff_number" = "staff_number",
    "email" = NULL,
    "staff_number" = NULL
WHERE "is_active" = false;
