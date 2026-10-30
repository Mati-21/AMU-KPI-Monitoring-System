# Developer A — 4-Day Backend Task Plan

**Owner:** Developer A (Core Architecture)
**Modules:** 01 Identity & Auth · 02 Office Hierarchy · 03 Access Control · 04 KPI Catalog · 10 System Governance
**Scope:** Backend only (`Backend/`). The frontend is frozen until the integration phase.
**References:** [MODULES_SPECIFICATION.html](../MODULES_SPECIFICATION.html) (routes and models, source of truth) ·
[TASK_DIVISION.html](../TASK_DIVISION.html) · [CLASS_DIAGRAM.md](CLASS_DIAGRAM.md) · Swagger at `http://localhost:8058/api-docs`

---

## 1. Why this order

Developer B's modules depend on yours, so the order follows what unblocks them:

```
02 Offices ──► 03 Roles & scoped access ──► 04 KPI catalog ──► 10 Settings & audit ──► 01 hardening
   │                 │                          │
   └─ B: notifications, evidence owner office   └─ B: targets (05), cycles (06), scoring (07)
                     └─ B: office-scoped authority in every service
```

| Day | Focus | Unblocks for Developer B |
|---|---|---|
| **Day 1** | Module 02 — office types, offices, tree, positions, placements | Office targeting, scope checks, report dossiers |
| **Day 2** | Module 03 — roles, permission sync, scoped role assignment, baseline roles seed | Realistic test users (Dean, Head, Officer) |
| **Day 3** | Module 04 — fiscal years, themes, KPIs, KPI seed | Target cascading (05) and evaluation cycles (06) |
| **Day 4** | Module 10 — settings and audit queries; Module 01 hardening; wrap-up | Audit trail for all modules |

Each task within a day builds on the previous one, so finish them in order.
Tasks marked **(stretch)** can slip to the next day without blocking anyone.

---

## 2. Current state (already done)

| Area | Status |
|---|---|
| Routes for all your endpoints (paths, permission guards, Swagger) | ✅ Wired — services return **501** until implemented |
| Module 01 — login, first-login password change, TOTP MFA, persons CRUD, accounts | ✅ Implemented |
| Module 01 — multi-device sessions (`UserSession`), refresh rotation, revocation | ✅ Implemented |
| Scoped permission resolution (`access.service.js`, `requirePermission`, `check-permission`) | ✅ Implemented |
| Permission catalog (`config/permissions.js`) + seed (`npm run seed:admin`) | ✅ Implemented |
| Migrations baseline + `user_session` | ✅ Applied |

**Your job:** replace each `notImplemented(...)` stub in the service files below with real logic.
Controllers and routes are already written; change them only if a signature has to change.

---

## 3. Conventions (apply to every task)

1. **Services hold the logic, controllers stay thin.** Controllers already pass `(params, body, actorOf(req))`.
2. **Errors:** throw from `utils/httpError.js`: `badRequest`, `notFound`, `conflict`, `forbidden`. Never send
   `res.status(...)` from a service. Prisma unique/FK/not-found errors are mapped automatically by `errorMiddleware`.
3. **No try/catch in controllers.** Express 5 forwards rejected promises to the error handler.
4. **Office scope:** the route guard only checks that a permission is held *somewhere*. When the action targets a
   specific office, check scope in the service:
   ```js
   if (!(await actor.access.can(PERMISSIONS.OFFICE_UPDATE, officeId))) throw forbidden('Office is outside your scope');
   ```
   `actor.access` is set by `requirePermission`. On routes without a guard, call `loadAccess(req)` first.
5. **Audit every write** with `logActivity` from `utils/auditLogger.js`:
   ```js
   await logActivity({ actorPersonId: actor.personId, action: 'OFFICE_UPDATED', entityType: 'office',
     entityId: office.id, oldValues: before, newValues: office, ipAddress: actor.ipAddress, userAgent: actor.userAgent });
   ```
   Action names: `ENTITY_VERB` in upper case (`ROLE_CREATED`, `FISCAL_YEAR_ACTIVATED`).
6. **Multi-row writes go in `prisma.$transaction`.**
7. **Validate input in the service:** required fields, enums, date order, existence of referenced IDs. Parse numeric
   IDs with `Number.parseInt` (`Role`, `OfficeType`, `FiscalYear` and `DocumentType` use Int ids; everything else is UUID).
8. **Response shapes:** lists return arrays (or `{ data, pagination }` when paginated, as `/persons` does); single items
   return the object. Decimal fields come back as strings in JSON.
9. **Testing each task:** use Swagger (log in as the Super Admin, then Try it out) or `curl` with the cookie jar.
   Each task below lists its checks.

---

## 4. Day 1 — Module 02: Office Hierarchy

**Files:** `modules/02-office-hierarchy/office.service.js` (+ controller and routes if needed)
**Permissions:** `office:create`, `office:update`, `office:manage`, `office:assign`

### Task 1.1 — Office types
- `listOfficeTypes()`: all types ordered by `levelOrder` ascending (nulls last), each with an office count.
- `createOfficeType({ name, levelOrder })`: `name` required and trimmed, unique (409); `levelOrder` a positive integer if given.
- Audit `OFFICE_TYPE_CREATED`.

**Done when:** creating `College` (2), `Directorate` (2), `Department` (3) and `Unit` (4) works; a duplicate name returns 409.

### Task 1.2 — Office create, read and list
- `listOffices({ officeTypeId, parentOfficeId, isActive, search })`: flat list with the type, the parent `{ id, name }`
  and a child count; `search` matches name or code case-insensitively.
- `getOfficeById(id)`: the office with its type, parent, direct children, positions, and the **current head**
  (the active placement whose position has `isHead = true`). 404 if missing.
- `createOffice({ name, code, officeTypeId, parentOfficeId })`:
  - `name` and `officeTypeId` are required, and the type must exist.
  - A parent is **required** unless no root office exists yet (only one root is allowed — the seed created `AMU`).
  - The parent must exist and be active.
  - Hierarchy rule: the child's `levelOrder` must be greater than the parent's (when both are set).
  - `code` is optional, upper-cased and unique (409).
  - **Scope:** `actor.access.can(OFFICE_CREATE, parentOfficeId)`.
- Audit `OFFICE_CREATED`.

**Done when:** you can create a college under AMU and a department under that college, and creating a college under a
department returns 400.

### Task 1.3 — Office update with cycle prevention
- `updateOffice(id, { name, code, officeTypeId, parentOfficeId, isActive })`, with scope `can(OFFICE_UPDATE, id)`.
- Re-parenting: the new parent cannot be the office itself or one of its descendants (400 "would create a cycle").
  The root cannot be given a parent.
- Deactivating (`isActive: false`) is refused while the office has active children (409).
- Audit `OFFICE_UPDATED` with old and new values.

### Task 1.4 — Tree and descendant helper (Developer B uses this)
- Export `getOfficeDescendantIds(officeId)` (self included) using a recursive CTE, mirroring
  `getOfficeAncestorIds` in `access.service.js`. Developer B needs it for `includeSubOffices` notifications and
  scoped listings.
- `getOfficeTree()`: load all offices in **one query** and build the nested tree in memory:
  `{ id, name, code, isActive, officeType: { id, name, levelOrder }, children: [...] }`, siblings sorted by name.

**Done when:** `GET /offices/tree` returns AMU → colleges → departments.

### Task 1.5 — Positions
- `listPositions(officeId)`: 404 if the office doesn't exist; each position comes with its count of active holders.
- `createPosition(officeId, { title, isHead })`: `title` required; the scope check uses `can(OFFICE_MANAGE, officeId)`.
  Allow only **one head position per office** (409 if another `isHead` position exists).
- Audit `POSITION_CREATED`.

### Task 1.6 — Members (placements)
- `listMembers(officeId)`: **active** placements (`startDate <= today`, and `endDate` null or `>= today`), each with
  the person (id, full name, email), the position, `isPrimary`, and their role assignments.
- `assignMember(officeId, { personId, positionId, startDate, endDate, isPrimary })`:
  - The person must exist and not be archived; the position must belong to **this** office (400 otherwise).
  - `startDate` is required, and `endDate` (if given) must be ≥ `startDate`.
  - No overlapping active placement for the same person + position (409).
  - **Head positions:** only one active holder at a time (409).
  - `isPrimary: true` clears `isPrimary` on the person's other placements, in a transaction. If this is the person's
    first placement, make it primary automatically.
  - Scope: `can(OFFICE_ASSIGN, officeId)`.
- Audit `MEMBER_ASSIGNED`.

**Done when:** you can place a test person as Dean of a college; a second Dean returns 409; `GET /persons/:id`
shows the placement.

### End of Day 1 — handoff
Tell Developer B: the office endpoints are live, and `getOfficeDescendantIds` is exported from `office.service.js`.

---

## 5. Day 2 — Module 03: Roles & Scoped Access

**Files:** `modules/03-access-control/role.service.js`, `scripts/seedRoles.js` (new)
**Permissions:** `role:read`, `role:create`, `role:update`, `role:delete`, `role:assign`

### Task 2.1 — Roles CRUD
- `listRoles()`: each role with its permission count and its **active** assignment count.
- `getRoleById(id)`: the role plus its permission codes sorted; 404 if missing.
- `createRole({ name, description })`: name required, unique case-insensitively (409).
- `updateRole(id, data)`: the **Super Admin role cannot be renamed** (403).
- `deleteRole(id)`: refuse if it's Super Admin (403) or it has any active assignment (409). `RolePermission` rows cascade.
- Audit `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED`.

### Task 2.2 — Permission catalog and role permission sync
- `listPermissions()`: all codes, grouped by module prefix (`user`, `office`, `kpi` …) for an easy UI later.
- `syncRolePermissions(roleId, permissionCodes, actor)`:
  - It must be an array; every code must exist in `PERMISSION_CODES` (400 listing the unknown ones).
  - **Privilege rules:** only a Super Admin may grant `*`; the Super Admin role must keep `*`.
  - Replace the set in one transaction (`deleteMany` + `createMany`), and return the updated role.
- Audit `ROLE_PERMISSIONS_SYNCED` with the old and new code lists.

### Task 2.3 — Scoped role assignment and revocation
- `assignRole(officePersonId, { roleId, scopeOfficeId, validFrom, validTo }, actor)`:
  - The placement must exist and be active; the role must exist; `scopeOfficeId` (if given) must exist; `validFrom` is
    required, and `validTo` (if given) must be ≥ `validFrom`.
  - **Anti-escalation:**
    - A non-Super-Admin must hold `role:assign` within `scopeOfficeId` (or globally when the scope is null).
    - They may only grant roles whose permissions they hold themselves.
    - Only a Super Admin may grant a role containing `*`.
  - A duplicate (same placement, role, scope and `validFrom`) returns 409, via the unique constraint.
- `revokeRoleAssignment(id, actor)`: delete the row (the audit log keeps the history); scope check against the
  assignment's scope office.
- Audit `ROLE_ASSIGNED` and `ROLE_REVOKED`.

**Done when:** a Dean scoped to a college gets `allowed: true` from `GET /auth/check-permission?permission=target:cascade&officeId=<department in that college>`
and `allowed: false` for a department in another college.

### Task 2.4 — Baseline roles seed (Developer B needs test users)
Roles are named after the **access they give**, not after job titles: a Position ("Dean") is the job, a Role
("College Leadership") is what that job may do. Definitions live in `config/roles.json`; `resource:*` expands to every
action of that resource.

| Role | Typical positions | Typical scope | Permissions |
|---|---|---|---|
| University Leadership | President, Vice President | university | `dashboard:read`, `scorecard:read`, `target:read`, `report:read`, `report:review`, `evaluation:read`, `evidence:read`, `file:read` |
| Strategy Officer | Strategy & Planning Director | university | `kpi:*`, `target:*`, `cycle:manage`, `report:read`, `evaluation:read`, `scorecard:read`, `dashboard:read`, `evidence:read`, `file:read`, `notification:send` |
| Access Administrator | ICT Director, HR Officer | university | `user:*`, `office:*`, `role:*`, `audit:read` |
| College Leadership | Dean, Directorate Director | office | `user:read`, `office:assign`, `role:read`, `role:assign`, `target:read/assign/cascade`, `report:*`, `evaluation:*`, `scorecard:read`, `evidence:*`, `file:*`, `document:create`, `notification:send` |
| Department Leadership | Department Head, Unit Head | office | `user:read`, `target:read/assign/cascade`, `report:create/read/submit`, `evaluation:read/write`, `scorecard:read`, `evidence:*`, `file:*`, `document:create` |
| Staff | Lecturer, Officer | office | `target:read`, `evaluation:read/write`, `file:*`, `document:create`, `evidence:*` |

Commands: `npm run seed:permissions` then `npm run seed:roles` (creates missing roles; existing ones are left as edited)
or `npm run seed:roles:sync` (resets the seeded roles to the JSON). College Leadership holds every permission of
Department Leadership and Staff, so a Dean can delegate those roles inside their college.

### Task 2.5 (stretch) — Test fixture
Extend the seed (behind a `--demo` flag) to create one college, one department, and three demo people (Dean, Head,
Staff) with accounts, placements and scoped roles. Share the credentials with Developer B.

### End of Day 2 — handoff
Tell Developer B: role seeding is ready, and scoped checks work through `actor.access.can(code, officeId)`.

---

## 6. Day 3 — Module 04: Strategic KPI Catalog

> ✅ **Implemented** against the new ERD in `modules/04-kpi-catalog/`: `fiscalYear.service.js`, `catalog.service.js`,
> `kpi.service.js`. Routes are listed in `MODULES_SPECIFICATION.html`.

- **Fiscal years:** PLANNING, ACTIVE, CLOSED. Closing needs a reason and makes the year read-only; only a Super Admin can
  reopen it, also with a reason. Every module
  that writes year data must call `assertFiscalYearOpen(fiscalYearId)` first.
- **Catalog:** strategic objectives, themes, units, reporting frequencies, stage and category scales, currencies,
  exchange rates.
- **Locks:** a scale locks once a KPI uses it. A KPI locks once it has an assignment that is not cancelled or rejected;
  after that only `isActive`, `coordinatingOfficeId` and `defaultFrequencyId` can change. A real change means a new KPI
  with `replacesKpiId`, which retires the old one.
- **Validation:** `validateDefinition` in `kpi.service.js` applies the rules per measurement type.
- **Seed:** `npm run seed:kpis` adds sample KPIs from `config/kpi-samples.json`, one per measurement type.

### End of Day 3 — handoff
Tell Developer B: fiscal years and KPIs are ready, so target cascading (05) and cycles (06) can start against real data.
Point out the locked `direction` and `cascadeMode` rule.

---

## 7. Day 4 — Module 10 + Module 01 hardening + wrap-up

**Files:** `modules/10-system-governance/system.service.js`, `modules/01-identity-access/*`
**Permissions:** `settings:manage`, `audit:read`

### Task 4.1 — System settings
> ✅ **Implemented** with a settings registry (`config/settings.json`): groups `branding`, `general`, `kpi`,
> `reporting` (submission window, deadline reminders, late submission, auto-lock, required evidence) and `system`
> (maintenance mode, message, expected end). Other modules read values with
> `getSetting(group, key)` from `modules/10-system-governance/system.service.js`. Maintenance mode is enforced by
> `middleware/maintenanceMiddleware.js`. Every setting is a row in `system_setting`, created with its default by
> `scripts/seedSettings.js` (`npm run seed:settings`, also run on every server start); there is no in-code fallback.

- `getPublicSettings()` (no auth): settings with `isPublic = true` as a flat `{ key: value }` map per group,
  plus `activeFiscalYear: { id, label }` and the logo URL when a `file` setting exists.
- `getSettingsGrouped()`: `{ [groupName]: [settings...] }`.
- `updateSettingsGroup(groupName, { settings })`:
  - `settings` must be a non-empty array; each `key` is required.
  - Validate `value` against `valueType` (`number` parses, `boolean` is `true`/`false`, `json` parses, `file` needs
    an existing `fileId`).
  - Upsert all of them in one transaction on `(groupName, key)`, and set `updatedByPersonId`.
- Audit `SETTINGS_UPDATED` with the changed keys only.
- Seed defaults (in `seedAdmin.js`): `branding.university_name` (public), `branding.system_name` (public),
  `kpi.default_cycle_names` (`Q1,Q2,Q3,Q4`).

### Task 4.2 — Audit log queries
- `listAuditLogs({ actorPersonId, action, entityType, from, to, page, limit })`: paginated (default 20, max 100),
  newest first, with the actor's `{ id, fullName }`. The `to` bound is inclusive to the end of that day.
- `getAuditLogById(id)`: full entry including `oldValues` and `newValues`. 404 if missing.

### Task 4.3 — Module 01: audit hooks
Add `logActivity` to the identity writes that don't log yet: person create/update/delete, account
create/update, toggle-active, reset-password, MFA enforce (user and role), and session revoke-all by admin.
Successful logins log `LOGIN_SUCCESS`; failed logins log `LOGIN_FAILED` with the identifier (never the password).

### Task 4.4 — Module 01: login rate limiting
- Add `express-rate-limit` and apply it to `/auth/login`, `/auth/mfa/verify`, `/auth/mfa/verify-setup` and
  `/auth/change-password-first-login`: 10 attempts per 15 minutes per IP + identifier, then a JSON 429 that matches the
  error format.
- If deployed behind a proxy, set `app.set('trust proxy', 1)` so IPs (and the session `ipAddress`) are correct.

### Task 4.5 — Wrap-up
- Re-check that each of your endpoints works in Swagger with the Super Admin and with a scoped demo user (Day 2 fixture).
- Confirm that no Developer A route still returns 501:
  `grep -rn "notImplemented" Backend/modules/0[1-4]* Backend/modules/10*` should print nothing.
- Update the checklist statuses for modules 01–04 and 10 in `TASK_DIVISION.html`.
- Commit per module (e.g. `Implement office hierarchy (module 02)`).

---

## 8. Daily checklist

| ✔ | Task | Module | Day |
|---|---|---|---|
| ✅ | 1.1 Office types | 02 | 1 |
| ✅ | 1.2 Office create, read and list | 02 | 1 |
| ✅ | 1.3 Office update + cycle prevention | 02 | 1 |
| ✅ | 1.4 Tree + `getOfficeDescendantIds` | 02 | 1 |
| ✅ | 1.5 Positions | 02 | 1 |
| ✅ | 1.6 Members / placements | 02 | 1 |
| ✅ | 2.1 Roles CRUD | 03 | 2 |
| ✅ | 2.2 Permission sync | 03 | 2 |
| ✅ | 2.3 Scoped assignment / revoke | 03 | 2 |
| ✅ | 2.4 Baseline roles seed | 03 | 2 |
| ☐ | 2.5 Demo fixture (stretch) | 03 | 2 |
| ☐ | 3.1 Fiscal years | 04 | 3 |
| ☐ | 3.2 Strategic themes | 04 | 3 |
| ☐ | 3.3 Master KPIs | 04 | 3 |
| ☐ | 3.4 KPI seed | 04 | 3 |
| ✅ | 4.1 System settings | 10 | 4 |
| ✅ | 4.2 Audit log queries | 10 | 4 |
| ☐ | 4.3 Identity audit hooks | 01 | 4 |
| ☐ | 4.4 Login rate limiting | 01 | 4 |
| ☐ | 4.5 Wrap-up | all | 4 |

---

## 9. Handoff contract with Developer B

| You provide | Where | Used by Developer B for |
|---|---|---|
| `protect`, `requirePermission`, `loadAccess` | `middleware/authMiddleware.js` | Every route |
| `actor.access.can(code, officeId)` | `utils/requestContext.js` → `req.access` | Office-scoped authority in services |
| `getOfficeAncestorIds`, `getOfficeDescendantIds` | `access.service.js`, `office.service.js` | Roll-ups, notification targeting |
| Exactly one `active` fiscal year | Module 04 | Default year for targets and cycles |
| Locked `direction` / `cascadeMode` once targets exist | Module 04 | Stable scoring and cascading |
| `logActivity()` | `utils/auditLogger.js` | Audit trail in modules 05–09 |
| Baseline roles + demo users | `seed:roles` (`--demo`) | Testing scoped workflows |
| `PERMISSIONS` constants | `config/permissions.js` | Route guards; add new codes **only** through you |
