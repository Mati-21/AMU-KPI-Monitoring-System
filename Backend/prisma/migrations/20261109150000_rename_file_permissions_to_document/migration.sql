-- Reading documents is now "document:read", like uploading ("document:create"). Roles keep what they had:
-- the permission rows are renamed in place, so every role link follows.
UPDATE "permission"
SET "code" = 'document:read',
    "name" = 'Documents: read',
    "description" = 'List documents and open their files for the person''s own office'
WHERE "code" = 'file:read'
  AND NOT EXISTS (SELECT 1 FROM "permission" WHERE "code" = 'document:read');

UPDATE "permission"
SET "code" = 'document:read_all',
    "name" = 'Documents: read_all',
    "description" = 'Also see the documents and files of every office below, within the role''s scope. Without it only the person''s own office'
WHERE "code" = 'file:read_all'
  AND NOT EXISTS (SELECT 1 FROM "permission" WHERE "code" = 'document:read_all');
