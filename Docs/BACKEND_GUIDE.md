# Backend Guide

How the backend in `Backend/` is organised and how to work on it.

**References:** [MODULES_SPECIFICATION.html](../MODULES_SPECIFICATION.html) (tables and routes) ·
[TASK_DIVISION.html](../TASK_DIVISION.html) (module status) · [CLASS_DIAGRAM.md](CLASS_DIAGRAM.md) ·
[srs.md](srs.md) · Swagger at `http://localhost:8058/api-docs`

## Modules

| Module | Folder under `modules/` | Purpose |
|---|---|---|
| 01 | `01-identity-access` | Login, MFA, sessions, people and accounts |
| 02 | `02-office-hierarchy` | Office types, the office tree, positions and placements |
| 03 | `03-access-control` | Roles, permissions and office-scoped grants |
| 04 | `04-kpi-catalog` | Fiscal years and the master KPI catalog |
| 05 | `05-contract-cascading` | Contracts, assignments, baselines, targets, weights, change requests |
| 06 | `06-reporting-periods` | When offices report, and deadlines |
| 07 | `07-performance-scoring` | Reports, achievements, roll-ups, contract scores, scorecards |
| 08 | `08-evidence-documents` | File uploads, documents and evidence |
| 09 | `09-notifications` | Inbox, alerts, deadline reminders, live push |
| 10 | `10-system-governance` | Settings and the audit trail |
| 11 | `11-dashboards` | University, parent office and own office views |

Later modules depend on earlier ones. Module 07 reads from 04, 05 and 06, and Module 11 only reads what Module 07 saved.

## How a module is built

- **Routes** declare the full path, the guards and the Swagger docs, and are mounted in `modules/index.js`.
- **Controllers** only read the request and call a service with `actorOf(req)`.
- **Services** hold the logic and database access. They throw helpers from `utils/httpError.js`, and Express 5 forwards the error.
- **Rule files** (`*.rules.js`) are pure calculations with no database access, so they can be tested alone.
- **Input** is parsed with `utils/validation.js`. Every change is recorded with `auditAction` from `utils/auditLogger.js`.

## Access

- `requirePermission(code)` on a route checks that the person holds the permission somewhere.
- `actor.access.can(code, officeId)` in a service checks that it covers this office. A grant applies to its office and everything below it.
- `actor.access.canGlobally(code)` checks for university-wide authority.

## Configuration

Nothing the university may want to change is hard-coded.

| File in `config/` | Holds | Reaches the database |
|---|---|---|
| `permissions.json` | Permission catalog | At every server start |
| `settings.json` | Setting definitions and defaults | At every server start |
| `roles.json` | Baseline roles | `npm run seed:roles` or `npm run seed:roles:sync` |
| `reference.json` | Starting reference data | `npm run seed:admin` |

Read a setting with `getSetting(group, key)`.

## Results and history

- **Official results:** only approved reports are official. A missing result is never treated as zero, and is left out of the score unless the `missing_result_policy` setting fills it.
- **Separate measures:** improvement achievement and target achievement are always kept apart. Raw values are never altered, and capping is a separate column.
- **Versions:** baselines, targets and weights are versioned, and each achievement records the versions it used.
- **Locking:** KPIs and scales lock once in use. A closed year is read-only until a Super Admin reopens it.

## Login security

- Failed passwords and verification codes are limited per account and client address (`max_failed_attempts` and `lockout_minutes` in the `security` settings). See `middleware/attemptLimiter.js`.
- Counts are held in memory. A restart clears them, and each server instance counts on its own.
- Behind a reverse proxy, set Express `trust proxy` so the real client address is used. Otherwise all clients share one address, though counts stay separate per account.

## Commands

Run these from `Backend/`:

```bash
npm run dev               # start the API on port 8058
npm run db:migrate        # create and apply a migration after changing schema.prisma
npm run db:deploy         # apply existing migrations
npm run seed:admin        # root office, reference data and the Super Admin
npm run seed:roles:sync   # bring seeded roles in line with config/roles.json
```
