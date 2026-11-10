-- Opening a document's file is now a permission of its own. Every role that can already read documents keeps being able to open them.
INSERT INTO "permission" ("id", "code", "name", "module", "description") VALUES
  (gen_random_uuid(), 'document:download', 'Documents: download', 'Evidence & Documents', 'Open and download a document''s file, whether it is KPI evidence or an ordinary upload. Reading still decides which documents the person may reach')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permission" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), granted."role_id", download."id"
FROM "role_permission" granted
JOIN "permission" read_code ON read_code."id" = granted."permission_id" AND read_code."code" = 'document:read'
CROSS JOIN "permission" download
WHERE download."code" = 'document:download'
  AND NOT EXISTS (SELECT 1 FROM "role_permission" existing WHERE existing."role_id" = granted."role_id" AND existing."permission_id" = download."id");
