# Class Diagram - AMU-KPI-Monitoring-System

## Overview

Class diagram of the **Arba Minch University (AMU) KPI Monitoring System**, mapped one-to-one to
[Backend/prisma/schema.prisma](../Backend/prisma/schema.prisma) (26 models, PostgreSQL) and to the ten modules in
[MODULES_SPECIFICATION.html](../MODULES_SPECIFICATION.html). Table names (snake_case) are shown in brackets.

| Module | Models |
|---|---|
| 01 Identity & Authentication | `Person`, `UserAccount`, `UserSession` |
| 02 Organizational Hierarchy | `OfficeType`, `Office`, `Position`, `OfficePerson` |
| 03 Scoped Access Control | `Role`, `Permission`, `RolePermission`, `OfficePersonRole` |
| 04 Strategic KPI Catalog | `FiscalYear`, `KpiTheme`, `Kpi` |
| 05 Target Cascading | `KpiTarget` |
| 06 Evaluation Cycles | `EvalCycle`, `CycleReport` |
| 07 Performance Scoring | `KpiEvaluation` |
| 08 Evidence & Documents | `File`, `DocumentType`, `Document`, `DocumentLink` |
| 09 Notifications | `Notification`, `NotificationRecipient` |
| 10 System Governance | `SystemSetting`, `AuditLog` |

---

## 1. Domain Description

### Identity (Module 01)
- **Person** `[person]` — the human being (faculty, staff, management) with demographic and contact data. Every other
  module references a `Person`, never a login account.
- **UserAccount** `[user_account]` — optional 1:1 login credentials for a Person: username, bcrypt hash, first-login
  password change flag and TOTP MFA settings (`mfaEnabled`, `mfaEnforced`, `mfaSecret`). Deleting a Person cascades to it.
- **UserSession** `[user_session]` — one row per logged-in device/browser, so an account can have many concurrent
  sessions. Access tokens carry the session id (`sid`) and stop working as soon as the session is revoked or expires.
  Only SHA-256 hashes of the rotating refresh token are stored; replaying an already-rotated token revokes the session.
  Tracks IP, user agent, created / last used / expiry times and why it was revoked.

### Organization (Module 02)
- **OfficeType** `[office_type]` — tier of the hierarchy (University = 1, College = 2, Department = 3 …) via `levelOrder`.
- **Office** `[office]` — node of the university tree; `parentOfficeId` self-reference forms the `OfficeTree`.
- **Position** `[position]` — job title defined inside an office (e.g. Dean, Lecturer); `isHead` marks the office head.
- **OfficePerson** `[office_person]` — placement of a Person in an Office + Position with tenure (`startDate`/`endDate`)
  and an `isPrimary` flag. A person may hold several placements.

### Access control (Module 03)
- **Role** `[role]` — named bundle of permissions (Super Admin, Dean, Strategy Officer …).
- **Permission** `[permission]` — atomic code such as `kpi:create`, `target:cascade`; `*` is the Super Admin wildcard.
  The catalog lives in `Backend/config/permissions.js`.
- **RolePermission** `[role_permission]` — M:N join between Role and Permission.
- **OfficePersonRole** `[office_person_role]` — grants a Role to a placement, optionally limited to `scopeOfficeId`
  (that office and its descendants; `null` = university-wide) and a validity window (`validFrom`/`validTo`).

### KPI planning (Modules 04–05)
- **FiscalYear** `[fiscal_year]` — planning year (e.g. "2018 E.C.") with status `planned | active | closed`.
- **KpiTheme** `[kpi_theme]` — strategic pillar; `parentThemeId` self-reference forms the `ThemeTree`.
- **Kpi** `[kpi]` — master indicator: unit, `direction` (`higher_is_better | lower_is_better`), `cascadeMode`
  (`split | replicate | aggregate`) and `maxOverAllocationPercent` for cascading.
- **KpiTarget** `[kpi_target]` — target value for a KPI, office (and optionally a person) in a fiscal year.
  `parentTargetId` self-reference forms the `TargetTree`: a university target is cascaded into college, department
  and individual targets. Two Person relations: owner (`TargetOwner`) and assigner (`TargetAssigner`).

### Evaluation (Modules 06–07)
- **EvalCycle** `[eval_cycle]` — reporting window inside a fiscal year (Q1, Mid-Year, Annual) with status
  `planned | open | in_review | closed`.
- **CycleReport** `[cycle_report]` — one report dossier per office per cycle (`@@unique([evalCycleId, officeId])`);
  submitted and reviewed by Persons.
- **KpiEvaluation** `[kpi_evaluation]` — achievement for one target in one cycle (`@@unique([kpiTargetId, evalCycleId])`):
  `reportedValue`, verified `actualValue`, computed `score`, optional link to the CycleReport and evaluator.

### Evidence (Module 08)
- **File** `[file]` — stored binary: path, MIME type, size, checksum, uploader.
- **DocumentType** `[document_type]` — evidence category with allowed extensions and max size.
- **Document** `[document]` — business document wrapping a File (title, owner office, confidentiality).
- **DocumentLink** `[document_link]` — polymorphic attachment of a Document to any entity by
  (`entityType`, `entityId`), e.g. `kpi_evaluation`, `cycle_report`, `kpi_target`.

### Notifications & governance (Modules 09–10)
- **Notification** `[notification]` — broadcast to a target office (optionally `includeSubOffices`) and/or the holders
  of a `requiredPermission`; may reference an entity.
- **NotificationRecipient** `[notification_recipient]` — per-person delivery and read receipt.
- **SystemSetting** `[system_setting]` — key/value configuration grouped by `groupName` (`@@unique([groupName, key])`),
  optional File (e.g. logo), `isPublic` flag.
- **AuditLog** `[audit_log]` — immutable record of who changed what (`oldValues`/`newValues` JSON), from which IP/agent.

---

## 2. PlantUML Class Diagram

```plantuml
@startuml AMU_KPI_Class_Diagram
skinparam classAttributeIconSize 0
skinparam linetype ortho
hide methods

package "01 Identity" {
  class Person {
    id : Uuid
    firstName : String
    middleName : String?
    lastName : String
    gender : String?
    birthDate : Date?
    email : String? <<unique>>
    phone : String?
    status : String = "active"
  }
  class UserAccount {
    id : Uuid
    personId : Uuid <<unique>>
    username : String <<unique>>
    passwordHash : String
    isActive : Boolean = true
    mustChangePassword : Boolean = false
    mfaEnabled : Boolean = false
    mfaEnforced : Boolean = false
    mfaSecret : String?
    mfaType : String = "totp"
    lastLoginAt : Timestamptz?
  }
  class UserSession {
    id : Uuid
    userAccountId : Uuid
    refreshTokenHash : String <<unique>>
    previousRefreshTokenHash : String?
    rotatedAt : Timestamptz?
    ipAddress : String?
    userAgent : String?
    createdAt : Timestamptz
    lastUsedAt : Timestamptz
    expiresAt : Timestamptz
    revokedAt : Timestamptz?
    revokedReason : String?
  }
}

package "02 Organization" {
  class OfficeType {
    id : Int
    name : String <<unique>>
    levelOrder : Int?
  }
  class Office {
    id : Uuid
    parentOfficeId : Uuid?
    officeTypeId : Int
    name : String
    code : String? <<unique>>
    isActive : Boolean = true
  }
  class Position {
    id : Uuid
    officeId : Uuid
    title : String
    isHead : Boolean = false
  }
  class OfficePerson {
    id : Uuid
    personId : Uuid
    officeId : Uuid
    positionId : Uuid
    startDate : Date
    endDate : Date?
    isPrimary : Boolean = false
  }
}

package "03 Access Control" {
  class Role {
    id : Int
    name : String <<unique>>
    description : String?
  }
  class Permission {
    id : Int
    code : String <<unique>>
  }
  class RolePermission {
    id : Int
    roleId : Int
    permissionId : Int
  }
  class OfficePersonRole {
    id : Uuid
    officePersonId : Uuid
    roleId : Int
    scopeOfficeId : Uuid?
    validFrom : Date
    validTo : Date?
  }
}

package "04-05 KPI Planning" {
  class FiscalYear {
    id : Int
    label : String <<unique>>
    startDate : Date
    endDate : Date
    status : String = "planned"
  }
  class KpiTheme {
    id : Uuid
    parentThemeId : Uuid?
    name : String
    code : String?
    sortOrder : Int = 0
    isActive : Boolean = true
  }
  class Kpi {
    id : Uuid
    kpiThemeId : Uuid
    code : String <<unique>>
    name : String
    unitOfMeasure : String
    direction : String = "higher_is_better"
    cascadeMode : String = "split"
    maxOverAllocationPercent : Decimal(6,2)?
    sortOrder : Int = 0
    isActive : Boolean = true
  }
  class KpiTarget {
    id : Uuid
    fiscalYearId : Int
    kpiId : Uuid
    officeId : Uuid
    personId : Uuid?
    assignedByPersonId : Uuid?
    assignedAt : Date?
    parentTargetId : Uuid?
    baselineValue : Decimal(18,4)?
    targetValue : Decimal(18,4)
    weight : Decimal(7,4) = 1
    status : String = "draft"
  }
}

package "06-07 Evaluation" {
  class EvalCycle {
    id : Uuid
    fiscalYearId : Int
    name : String
    periodStart : Date
    periodEnd : Date
    dueDate : Date?
    status : String = "planned"
  }
  class CycleReport {
    id : Uuid
    evalCycleId : Uuid
    officeId : Uuid
    submittedByPersonId : Uuid?
    reviewedByPersonId : Uuid?
    status : String = "draft"
    submissionType : String? = "normal"
    autoFilledCount : Int = 0
    reviewNote : String?
    submittedAt : Timestamptz?
    reviewedAt : Timestamptz?
    createdAt : Timestamptz
  }
  class KpiEvaluation {
    id : Uuid
    kpiTargetId : Uuid
    evalCycleId : Uuid
    cycleReportId : Uuid?
    evaluatorPersonId : Uuid?
    reportedValue : Decimal(18,4)?
    actualValue : Decimal(18,4)?
    valueSource : String?
    score : Decimal(7,2)?
    comment : String?
    status : String = "pending"
  }
}

package "08 Evidence" {
  class File {
    id : Uuid
    originalName : String
    storagePath : String
    mimeType : String
    sizeBytes : BigInt
    checksum : String?
    uploadedByPersonId : Uuid?
    uploadedAt : Timestamptz
  }
  class DocumentType {
    id : Int
    name : String
    code : String <<unique>>
    allowedExtensions : String?
    maxSizeMb : Int?
    isActive : Boolean = true
  }
  class Document {
    id : Uuid
    documentTypeId : Int
    fileId : Uuid
    ownerOfficeId : Uuid?
    uploadedByPersonId : Uuid?
    title : String
    description : String?
    isConfidential : Boolean = false
    createdAt : Timestamptz
  }
  class DocumentLink {
    id : Uuid
    documentId : Uuid
    entityType : String
    entityId : Uuid
  }
}

package "09-10 Notifications & Governance" {
  class Notification {
    id : Uuid
    createdByPersonId : Uuid?
    targetOfficeId : Uuid?
    includeSubOffices : Boolean = false
    requiredPermissionId : Int?
    title : String
    message : String
    channel : String = "in_app"
    entityType : String?
    entityId : Uuid?
    createdAt : Timestamptz
  }
  class NotificationRecipient {
    id : Uuid
    notificationId : Uuid
    personId : Uuid
    isRead : Boolean = false
    readAt : Timestamptz?
    deliveredAt : Timestamptz?
  }
  class SystemSetting {
    id : Uuid
    groupName : String
    key : String
    value : String?
    valueType : String = "text"
    fileId : Uuid?
    description : String?
    isPublic : Boolean = false
    updatedByPersonId : Uuid?
    updatedAt : Timestamptz
  }
  class AuditLog {
    id : Uuid
    actorPersonId : Uuid?
    action : String
    entityType : String
    entityId : String?
    oldValues : Json?
    newValues : Json?
    ipAddress : String?
    userAgent : String?
    createdAt : Timestamptz
  }
}

' Identity
Person "1" -- "0..1" UserAccount : login >
UserAccount "1" -- "0..*" UserSession : signed in on >

' Organization
OfficeType "1" -- "0..*" Office : classifies >
Office "0..1" -- "0..*" Office : parent / children
Office "1" -- "0..*" Position : defines >
Person "1" -- "0..*" OfficePerson : placed as >
Office "1" -- "0..*" OfficePerson : employs >
Position "1" -- "0..*" OfficePerson : held in >

' Access control
Role "1" -- "0..*" RolePermission
Permission "1" -- "0..*" RolePermission
OfficePerson "1" -- "0..*" OfficePersonRole : granted >
Role "1" -- "0..*" OfficePersonRole
Office "0..1" -- "0..*" OfficePersonRole : scope >

' KPI planning
KpiTheme "0..1" -- "0..*" KpiTheme : parent / children
KpiTheme "1" -- "0..*" Kpi : groups >
FiscalYear "1" -- "0..*" KpiTarget
Kpi "1" -- "0..*" KpiTarget : measured by >
Office "1" -- "0..*" KpiTarget : owns >
Person "0..1" -- "0..*" KpiTarget : owner
Person "0..1" -- "0..*" KpiTarget : assigned by
KpiTarget "0..1" -- "0..*" KpiTarget : cascades into >

' Evaluation
FiscalYear "1" -- "0..*" EvalCycle
EvalCycle "1" -- "0..*" CycleReport
Office "1" -- "0..*" CycleReport : submits >
Person "0..1" -- "0..*" CycleReport : submitter / reviewer
KpiTarget "1" -- "0..*" KpiEvaluation : achieved in >
EvalCycle "1" -- "0..*" KpiEvaluation
CycleReport "0..1" -- "0..*" KpiEvaluation : contains >
Person "0..1" -- "0..*" KpiEvaluation : evaluator

' Evidence
Person "0..1" -- "0..*" File : uploads >
DocumentType "1" -- "0..*" Document
File "1" -- "0..*" Document : stored as >
Office "0..1" -- "0..*" Document : owner
Person "0..1" -- "0..*" Document : uploader
Document "1" -- "0..*" DocumentLink : attached via >
DocumentLink ..> KpiEvaluation : entityType/entityId
DocumentLink ..> CycleReport : entityType/entityId
DocumentLink ..> KpiTarget : entityType/entityId

' Notifications & governance
Person "0..1" -- "0..*" Notification : creator
Office "0..1" -- "0..*" Notification : target >
Permission "0..1" -- "0..*" Notification : required >
Notification "1" -- "0..*" NotificationRecipient : delivered to >
Person "1" -- "0..*" NotificationRecipient
File "0..1" -- "0..*" SystemSetting : asset
Person "0..1" -- "0..*" SystemSetting : updated by
Person "0..1" -- "0..*" AuditLog : actor

@enduml
```

---

## 3. Key Constraints

| Model | Constraint | Meaning |
|---|---|---|
| UserAccount | `personId` unique, `onDelete: Cascade` | At most one login per person; removed with the person |
| UserSession | `refreshTokenHash` unique, `onDelete: Cascade` | Each refresh token maps to one session; sessions are removed with the account |
| RolePermission | `@@unique([roleId, permissionId])` | A permission is granted to a role once |
| OfficePersonRole | `@@unique([officePersonId, roleId, scopeOfficeId, validFrom])` | No duplicate scoped grants |
| CycleReport | `@@unique([evalCycleId, officeId])` | One report dossier per office per cycle |
| KpiEvaluation | `@@unique([kpiTargetId, evalCycleId])` | One achievement entry per target per cycle |
| DocumentLink | `@@unique([documentId, entityType, entityId])` | A document is linked to an entity once |
| SystemSetting | `@@unique([groupName, key])` | Keys are unique within a group |
| NotificationRecipient | `@@unique([notificationId, personId])` | One receipt per person per notification |
