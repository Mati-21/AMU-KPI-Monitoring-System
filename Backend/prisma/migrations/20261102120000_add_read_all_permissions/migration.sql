-- Seeing the offices below is now a permission of its own
INSERT INTO "permission" ("id", "code", "name", "module", "description") VALUES
  (gen_random_uuid(), 'office:read_all', 'Offices, office types, positions & placements: read_all', 'Organizational Hierarchy', 'Also see the profile, positions and people of every office below, within the role''s scope. Without it only the person''s own office'),
  (gen_random_uuid(), 'contract:read_all', 'Performance contracts and KPI assignments: read_all', 'Contracts & Cascading', 'Also see the contracts of every office below, including those between lower offices, within the role''s scope. Without it only the person''s own office'),
  (gen_random_uuid(), 'report:read_all', 'Performance reports: read_all', 'Performance Scoring', 'Also see the reports of every office below once submitted, within the role''s scope'),
  (gen_random_uuid(), 'scorecard:read_all', 'Achievements and scores: read_all', 'Performance Scoring', 'Also see the scorecards and performance of every office below, within the role''s scope. Without it only the person''s own office'),
  (gen_random_uuid(), 'file:read_all', 'Stored files: read_all', 'Evidence & Documents', 'Also see the documents and files of every office below, within the role''s scope. Without it only the person''s own office'),
  (gen_random_uuid(), 'evidence:read_all', 'Performance evidence: read_all', 'Evidence & Documents', 'Also see the evidence of every office below, within the role''s scope. Without it only the person''s own office'),
  (gen_random_uuid(), 'dashboard:read_all', 'Dashboards: read_all', 'Dashboards', 'Also see the university dashboard and the dashboards and comparison of every office below, within the role''s scope')
ON CONFLICT ("code") DO NOTHING;
