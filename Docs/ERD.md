# Entity Relationship Diagram - AMU-KPI-Monitoring-System

Generated from [Backend/prisma/schema.prisma](../Backend/prisma/schema.prisma) (52 models, 27 enums, PostgreSQL).
The diagrams are Mermaid `erDiagram` code: they render in GitHub, in VS Code with a Mermaid preview extension, and at https://mermaid.live.

## How to read it

- `PK` primary key, `FK` foreign key, `UK` unique column. A column marked "optional" can be empty.
- `||` exactly one, `|o` zero or one, `o{` zero or many, `o|` zero or one (a one-to-one link).
- The text on a line is the relation field in the schema, for example `Office ||--o{ Office : "parent"` reads "an office has many child offices".
- Names are the Prisma model names. The real table names are in `@@map` in the schema. Columns that point to another table by a relation list are not repeated as columns.
- Columns typed `X_list` are arrays. Enum columns show the enum's name as their type.

## Whole system (relationships only)

```mermaid
erDiagram
    FileUpload
    Person
    UserAccount
    UserSession
    Office
    OfficeType
    OfficeHierarchyHistory
    Position
    OfficePerson
    Role
    RolePermission
    Permission
    OfficePersonRole
    KpiTheme
    KpiScale
    KpiScaleLevel
    Currency
    ExchangeRate
    Kpi
    MeasurementUnit
    ReportingFrequency
    FiscalYear
    ReportingPeriod
    PerformanceContract
    ContractRejection
    KpiAssignment
    KpiWeight
    KpiBaseline
    KpiTarget
    ResponsibilityAllocation
    AssignmentChangeRequest
    DocumentType
    Document
    BaselineEvidence
    ChangeRequestEvidence
    PerformanceReport
    PerformanceValue
    PerformanceEvidence
    PerformanceReview
    KpiAchievement
    PerformanceStatusThreshold
    ContractScore
    SystemSetting
    Notification
    NotificationRecipient
    SupportRequest
    Message
    MessageAttachment
    SystemAlert
    AuditLog
    FileUpload |o--o| Person : "profilePicture"
    Person ||--o| UserAccount : "person"
    UserAccount ||--o{ UserSession : "userAccount"
    Office |o--o{ Office : "parent"
    OfficeType ||--o{ Office : "officeType"
    Office ||--o{ OfficeHierarchyHistory : "office"
    Office |o--o{ OfficeHierarchyHistory : "parent"
    Person |o--o{ OfficeHierarchyHistory : "changedBy"
    Office ||--o{ Position : "office"
    Person ||--o{ OfficePerson : "person"
    Office ||--o{ OfficePerson : "office"
    Position ||--o{ OfficePerson : "position"
    Role ||--o{ RolePermission : "role"
    Permission ||--o{ RolePermission : "permission"
    OfficePerson ||--o{ OfficePersonRole : "officePerson"
    Role ||--o{ OfficePersonRole : "role"
    Office |o--o{ OfficePersonRole : "scopeOffice"
    KpiTheme |o--o{ KpiTheme : "parent"
    Person |o--o{ KpiScale : "approvedBy"
    KpiScale ||--o{ KpiScaleLevel : "scale"
    Currency ||--o{ ExchangeRate : "fromCurrency"
    Currency ||--o{ ExchangeRate : "toCurrency"
    KpiTheme ||--o{ Kpi : "theme"
    MeasurementUnit |o--o{ Kpi : "unit"
    KpiScale |o--o{ Kpi : "scale"
    Currency |o--o{ Kpi : "currency"
    ReportingFrequency ||--o{ Kpi : "defaultFrequency"
    Office |o--o{ Kpi : "coordinatingOffice"
    Kpi |o--o{ Kpi : "replaces"
    Person |o--o{ Kpi : "createdBy"
    FiscalYear ||--o{ ReportingPeriod : "fiscalYear"
    ReportingFrequency ||--o{ ReportingPeriod : "frequency"
    FiscalYear ||--o{ PerformanceContract : "fiscalYear"
    Office ||--o{ PerformanceContract : "office"
    Office |o--o{ PerformanceContract : "assigningOffice"
    Person |o--o{ PerformanceContract : "person"
    Person |o--o{ PerformanceContract : "signedBy"
    Person |o--o{ PerformanceContract : "approvedBy"
    PerformanceContract ||--o{ ContractRejection : "contract"
    Person |o--o{ ContractRejection : "rejectedBy"
    PerformanceContract ||--o{ KpiAssignment : "contract"
    Kpi ||--o{ KpiAssignment : "kpi"
    KpiAssignment |o--o{ KpiAssignment : "parent"
    KpiAssignment |o--o{ KpiAssignment : "source"
    ReportingFrequency ||--o{ KpiAssignment : "reportingFrequency"
    Person |o--o{ KpiAssignment : "createdBy"
    Person |o--o{ KpiAssignment : "approvedBy"
    Person |o--o{ KpiAssignment : "acknowledgedBy"
    KpiAssignment ||--o{ KpiWeight : "assignment"
    Person |o--o{ KpiWeight : "createdBy"
    Person |o--o{ KpiWeight : "approvedBy"
    KpiAssignment ||--o{ KpiBaseline : "assignment"
    KpiScaleLevel |o--o{ KpiBaseline : "scaleLevel"
    Currency |o--o{ KpiBaseline : "currency"
    ReportingPeriod |o--o{ KpiBaseline : "effectiveFromPeriod"
    Person |o--o{ KpiBaseline : "createdBy"
    Person |o--o{ KpiBaseline : "verifiedBy"
    KpiAssignment ||--o{ KpiTarget : "assignment"
    KpiScaleLevel |o--o{ KpiTarget : "scaleLevel"
    Currency |o--o{ KpiTarget : "currency"
    ReportingPeriod |o--o{ KpiTarget : "effectiveFromPeriod"
    Person |o--o{ KpiTarget : "createdBy"
    Person |o--o{ KpiTarget : "approvedBy"
    KpiAssignment ||--o{ ResponsibilityAllocation : "parentAssignment"
    KpiAssignment |o--o{ ResponsibilityAllocation : "childAssignment"
    Office |o--o{ ResponsibilityAllocation : "childOffice"
    Person |o--o{ ResponsibilityAllocation : "createdBy"
    KpiAssignment ||--o{ AssignmentChangeRequest : "assignment"
    Person |o--o{ AssignmentChangeRequest : "requestedBy"
    Person |o--o{ AssignmentChangeRequest : "reviewedBy"
    KpiBaseline |o--o{ AssignmentChangeRequest : "newBaseline"
    KpiTarget |o--o{ AssignmentChangeRequest : "newTarget"
    KpiWeight |o--o{ AssignmentChangeRequest : "newWeight"
    Person |o--o{ FileUpload : "uploadedBy"
    DocumentType ||--o{ Document : "documentType"
    FileUpload ||--o{ Document : "file"
    Office |o--o{ Document : "ownerOffice"
    Person |o--o{ Document : "createdBy"
    KpiBaseline ||--o{ BaselineEvidence : "baseline"
    Document ||--o{ BaselineEvidence : "document"
    AssignmentChangeRequest ||--o{ ChangeRequestEvidence : "changeRequest"
    Document ||--o{ ChangeRequestEvidence : "document"
    PerformanceContract ||--o{ PerformanceReport : "contract"
    ReportingPeriod ||--o{ PerformanceReport : "reportingPeriod"
    Person |o--o{ PerformanceReport : "preparedBy"
    Person |o--o{ PerformanceReport : "submittedBy"
    Person |o--o{ PerformanceReport : "lateAllowedBy"
    PerformanceReport ||--o{ PerformanceValue : "report"
    KpiAssignment ||--o{ PerformanceValue : "assignment"
    KpiScaleLevel |o--o{ PerformanceValue : "scaleLevel"
    Currency |o--o{ PerformanceValue : "currency"
    ExchangeRate |o--o{ PerformanceValue : "exchangeRate"
    Person |o--o{ PerformanceValue : "enteredBy"
    PerformanceValue ||--o{ PerformanceEvidence : "performanceValue"
    Document ||--o{ PerformanceEvidence : "document"
    Person |o--o{ PerformanceEvidence : "verifiedBy"
    PerformanceReport ||--o{ PerformanceReview : "report"
    Person ||--o{ PerformanceReview : "reviewer"
    Office |o--o{ PerformanceReview : "reviewerOffice"
    KpiAssignment ||--o{ KpiAchievement : "assignment"
    ReportingPeriod ||--o{ KpiAchievement : "reportingPeriod"
    KpiBaseline ||--o{ KpiAchievement : "baseline"
    KpiTarget ||--o{ KpiAchievement : "target"
    KpiWeight ||--o{ KpiAchievement : "weight"
    KpiScaleLevel |o--o{ KpiAchievement : "actualScaleLevel"
    PerformanceStatusThreshold |o--o{ KpiAchievement : "statusThreshold"
    PerformanceContract ||--o{ ContractScore : "contract"
    ReportingPeriod ||--o{ ContractScore : "reportingPeriod"
    FileUpload |o--o{ SystemSetting : "file"
    Person |o--o{ SystemSetting : "updatedBy"
    Person |o--o{ Notification : "createdBy"
    Office |o--o{ Notification : "targetOffice"
    Permission |o--o{ Notification : "requiredPermission"
    Notification ||--o{ NotificationRecipient : "notification"
    Person ||--o{ NotificationRecipient : "person"
    Person |o--o{ SupportRequest : "person"
    Person |o--o{ SupportRequest : "handledBy"
    Person ||--o{ Message : "sender"
    Person ||--o{ Message : "receiver"
    Message ||--o{ MessageAttachment : "message"
    FileUpload ||--o| MessageAttachment : "file"
    Person |o--o{ SystemAlert : "acknowledgedBy"
    Person |o--o{ AuditLog : "actor"
```

## Identity

Tables: `Person`, `UserAccount`, `UserSession`.

Defined in another part and shown only as a stub (id only), because a table here points to it: `FileUpload`.

```mermaid
erDiagram
    Person {
        String id PK
        String staffNumber UK "optional"
        String firstName
        String middleName "optional"
        String lastName
        String email UK "optional"
        String phone "optional"
        String profilePictureFileId FK,UK "optional"
        Boolean isActive
        DateTime archivedAt "optional"
        String archivedEmail "optional"
        String archivedStaffNumber "optional"
        DateTime createdAt
        DateTime updatedAt
    }
    UserAccount {
        String id PK
        String personId FK,UK
        String username UK
        String passwordHash
        Boolean isActive
        Boolean mustChangePassword
        Boolean mfaEnabled
        Boolean mfaEnforced
        String mfaSecret "optional"
        String mfaType
        DateTime lastLoginAt "optional"
        DateTime createdAt
    }
    UserSession {
        String id PK
        String userAccountId FK
        String refreshTokenHash UK
        String previousRefreshTokenHash "optional"
        DateTime rotatedAt "optional"
        String ipAddress "optional"
        String userAgent "optional"
        DateTime createdAt
        DateTime lastUsedAt
        DateTime expiresAt
        DateTime revokedAt "optional"
        String revokedReason "optional"
    }
    FileUpload {
        string id PK
    }
    FileUpload |o--o| Person : "profilePicture"
    Person ||--o| UserAccount : "person"
    UserAccount ||--o{ UserSession : "userAccount"
```

## Office hierarchy

Tables: `OfficeType`, `Office`, `OfficeHierarchyHistory`, `Position`, `OfficePerson`.

Defined in another part and shown only as a stub (id only), because a table here points to it: `Person`.

```mermaid
erDiagram
    OfficeType {
        String id PK
        String name UK
        String description "optional"
        Int levelOrder "optional"
        Boolean isActive
        DateTime createdAt
    }
    Office {
        String id PK
        String parentOfficeId FK "optional"
        String officeTypeId FK
        String name
        String code UK "optional"
        Boolean canAssignKpi
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }
    OfficeHierarchyHistory {
        String id PK
        String officeId FK
        String parentOfficeId FK "optional"
        DateTime validFrom
        DateTime validTo "optional"
        String reason "optional"
        String changedByPersonId FK "optional"
        DateTime createdAt
    }
    Position {
        String id PK
        String officeId FK
        String title
        Boolean isHead
        DateTime archivedAt "optional"
    }
    OfficePerson {
        String id PK
        String personId FK
        String officeId FK
        String positionId FK
        DateTime startDate
        DateTime endDate "optional"
        Boolean isPrimary
    }
    Person {
        string id PK
    }
    Office |o--o{ Office : "parent"
    OfficeType ||--o{ Office : "officeType"
    Office ||--o{ OfficeHierarchyHistory : "office"
    Office |o--o{ OfficeHierarchyHistory : "parent"
    Person |o--o{ OfficeHierarchyHistory : "changedBy"
    Office ||--o{ Position : "office"
    Person ||--o{ OfficePerson : "person"
    Office ||--o{ OfficePerson : "office"
    Position ||--o{ OfficePerson : "position"
```

## Dynamic roles

Tables: `Role`, `Permission`, `RolePermission`, `OfficePersonRole`.

Defined in another part and shown only as a stub (id only), because a table here points to it: `OfficePerson`, `Office`.

```mermaid
erDiagram
    Role {
        String id PK
        String name UK
        String description "optional"
        Boolean isSystem
        DateTime createdAt
    }
    Permission {
        String id PK
        String code UK
        String name "optional"
        String module "optional"
        String description "optional"
    }
    RolePermission {
        String id PK
        String roleId FK
        String permissionId FK
    }
    OfficePersonRole {
        String id PK
        String officePersonId FK
        String roleId FK
        String scopeOfficeId FK "optional"
        DateTime validFrom
        DateTime validTo "optional"
    }
    OfficePerson {
        string id PK
    }
    Office {
        string id PK
    }
    Role ||--o{ RolePermission : "role"
    Permission ||--o{ RolePermission : "permission"
    OfficePerson ||--o{ OfficePersonRole : "officePerson"
    Role ||--o{ OfficePersonRole : "role"
    Office |o--o{ OfficePersonRole : "scopeOffice"
```

## KPI definition

Tables: `KpiTheme`, `MeasurementUnit`, `KpiScale`, `KpiScaleLevel`, `Currency`, `ExchangeRate`, `Kpi`.

Defined in another part and shown only as a stub (id only), because a table here points to it: `Person`, `ReportingFrequency`, `Office`.

```mermaid
erDiagram
    KpiTheme {
        String id PK
        String parentThemeId FK "optional"
        String code UK "optional"
        String name
        String description "optional"
        Int sortOrder
        Boolean isActive
    }
    MeasurementUnit {
        String id PK
        String name UK
        String symbol "optional"
        String description "optional"
    }
    KpiScale {
        String id PK
        String name UK
        ScaleType scaleType
        Boolean isOrdered
        Boolean isBinary
        Boolean scoringApproved
        String approvedByPersonId FK "optional"
        DateTime approvedAt "optional"
    }
    KpiScaleLevel {
        String id PK
        String scaleId FK
        String name
        String description "optional"
        Int sortOrder
        Decimal score "optional"
        String assessmentCriteria "optional"
    }
    Currency {
        String id PK
        String code UK
        String name
        String symbol "optional"
        Boolean isReportingCurrency
    }
    ExchangeRate {
        String id PK
        String fromCurrencyId FK
        String toCurrencyId FK
        Decimal rate
        DateTime rateDate
        String source "optional"
    }
    Kpi {
        String id PK
        String name
        String description "optional"
        String remark "optional"
        String themeId FK
        MeasurementType measurementType
        String unitId FK "optional"
        String scaleId FK "optional"
        String currencyId FK "optional"
        KpiDirection direction
        TargetType targetType
        String numeratorLabel "optional"
        String denominatorLabel "optional"
        String formula "optional"
        String dataSource "optional"
        String defaultFrequencyId FK
        String evidenceRequirement "optional"
        AggregationMethod aggregationMethod
        PeriodRollupMethod periodRollupMethod
        ScoringBasis scoringMethod
        ZeroTargetRule zeroTargetRule
        Boolean isAdditive
        Int decimalPlaces
        Decimal maintenanceTolerance "optional"
        String coordinatingOfficeId FK "optional"
        String replacesKpiId FK "optional"
        Boolean isActive
        String createdByPersonId FK "optional"
        DateTime createdAt
        DateTime updatedAt
    }
    Person {
        string id PK
    }
    ReportingFrequency {
        string id PK
    }
    Office {
        string id PK
    }
    KpiTheme |o--o{ KpiTheme : "parent"
    Person |o--o{ KpiScale : "approvedBy"
    KpiScale ||--o{ KpiScaleLevel : "scale"
    Currency ||--o{ ExchangeRate : "fromCurrency"
    Currency ||--o{ ExchangeRate : "toCurrency"
    KpiTheme ||--o{ Kpi : "theme"
    MeasurementUnit |o--o{ Kpi : "unit"
    KpiScale |o--o{ Kpi : "scale"
    Currency |o--o{ Kpi : "currency"
    ReportingFrequency ||--o{ Kpi : "defaultFrequency"
    Office |o--o{ Kpi : "coordinatingOffice"
    Kpi |o--o{ Kpi : "replaces"
    Person |o--o{ Kpi : "createdBy"
```

## Periods

Tables: `ReportingFrequency`, `FiscalYear`, `ReportingPeriod`.

```mermaid
erDiagram
    ReportingFrequency {
        String id PK
        String name UK
        Int intervalMonths "optional"
        Boolean isCustom
    }
    FiscalYear {
        String id PK
        String name UK
        DateTime startDate
        DateTime endDate
        FiscalYearStatus status
    }
    ReportingPeriod {
        String id PK
        String fiscalYearId FK
        String frequencyId FK
        String name
        DateTime startDate
        DateTime endDate
        DateTime submissionDeadline "optional"
        Boolean isYearEnd
        Boolean isClosed
    }
    FiscalYear ||--o{ ReportingPeriod : "fiscalYear"
    ReportingFrequency ||--o{ ReportingPeriod : "frequency"
```

## Contracts and cascading

Tables: `PerformanceContract`, `ContractRejection`, `KpiAssignment`, `KpiWeight`, `KpiBaseline`, `KpiTarget`, `ResponsibilityAllocation`, `AssignmentChangeRequest`.

Defined in another part and shown only as a stub (id only), because a table here points to it: `FiscalYear`, `Office`, `Person`, `Kpi`, `ReportingFrequency`, `KpiScaleLevel`, `Currency`, `ReportingPeriod`.

```mermaid
erDiagram
    PerformanceContract {
        String id PK
        String fiscalYearId FK
        String officeId FK
        String assigningOfficeId FK "optional"
        String personId FK "optional"
        Int versionNo
        Decimal requiredTotalWeight
        ContractStatus status
        String signedByPersonId FK "optional"
        DateTime signedAt "optional"
        String approvedByPersonId FK "optional"
        DateTime approvedAt "optional"
        String reviewComment "optional"
        DateTime createdAt
    }
    ContractRejection {
        String id PK
        String contractId FK
        String rejectedByPersonId FK "optional"
        DateTime rejectedAt
        String note "optional"
        Json flaggedKpis
    }
    KpiAssignment {
        String id PK
        String contractId FK
        String kpiId FK
        String parentAssignmentId FK "optional"
        String sourceAssignmentId FK "optional"
        String reportingFrequencyId FK
        DistributionMethod distributionMethod
        ScopeRelation scopeRelation
        ReconciliationStatus reconciliationStatus
        String reconciliationNote "optional"
        Decimal maxOverAllocationPercent "optional"
        AssignmentStatus status
        String createdByPersonId FK "optional"
        DateTime createdAt
        String approvedByPersonId FK "optional"
        DateTime approvedAt "optional"
        String acknowledgedByPersonId FK "optional"
        DateTime acknowledgedAt "optional"
        String reviewComment "optional"
    }
    KpiWeight {
        String id PK
        String assignmentId FK
        Decimal weight
        Int versionNo
        Boolean isCurrent
        String reason "optional"
        String createdByPersonId FK "optional"
        String approvedByPersonId FK "optional"
        DateTime approvedAt "optional"
        DateTime createdAt
    }
    KpiBaseline {
        String id PK
        String assignmentId FK
        Int versionNo
        BaselineStatus baselineStatus
        Decimal value "optional"
        Decimal numerator "optional"
        Decimal denominator "optional"
        String scaleLevelId FK "optional"
        String currencyId FK "optional"
        String unknownJustification "optional"
        String effectiveFromPeriodId FK "optional"
        Boolean isCurrent
        String reason "optional"
        String createdByPersonId FK "optional"
        String verifiedByPersonId FK "optional"
        DateTime verifiedAt "optional"
        DateTime createdAt
    }
    KpiTarget {
        String id PK
        String assignmentId FK
        Int versionNo
        Decimal value "optional"
        Decimal numerator "optional"
        Decimal denominator "optional"
        String scaleLevelId FK "optional"
        String currencyId FK "optional"
        String effectiveFromPeriodId FK "optional"
        Boolean isCurrent
        String reason "optional"
        String createdByPersonId FK "optional"
        String approvedByPersonId FK "optional"
        DateTime approvedAt "optional"
        DateTime createdAt
    }
    ResponsibilityAllocation {
        String id PK
        String parentAssignmentId FK
        String childAssignmentId FK "optional"
        String childOfficeId FK "optional"
        AllocationType allocationType
        Decimal allocatedAmount
        String note "optional"
        String createdByPersonId FK "optional"
        DateTime createdAt
    }
    AssignmentChangeRequest {
        String id PK
        String assignmentId FK
        ChangeRequestType requestType
        String requestedByPersonId FK "optional"
        Json proposedValues "optional"
        String reason
        ChangeRequestStatus status
        String reviewedByPersonId FK "optional"
        DateTime reviewedAt "optional"
        String reviewComment "optional"
        String newBaselineId FK "optional"
        String newTargetId FK "optional"
        String newWeightId FK "optional"
        DateTime createdAt
    }
    FiscalYear {
        string id PK
    }
    Office {
        string id PK
    }
    Person {
        string id PK
    }
    Kpi {
        string id PK
    }
    ReportingFrequency {
        string id PK
    }
    KpiScaleLevel {
        string id PK
    }
    Currency {
        string id PK
    }
    ReportingPeriod {
        string id PK
    }
    FiscalYear ||--o{ PerformanceContract : "fiscalYear"
    Office ||--o{ PerformanceContract : "office"
    Office |o--o{ PerformanceContract : "assigningOffice"
    Person |o--o{ PerformanceContract : "person"
    Person |o--o{ PerformanceContract : "signedBy"
    Person |o--o{ PerformanceContract : "approvedBy"
    PerformanceContract ||--o{ ContractRejection : "contract"
    Person |o--o{ ContractRejection : "rejectedBy"
    PerformanceContract ||--o{ KpiAssignment : "contract"
    Kpi ||--o{ KpiAssignment : "kpi"
    KpiAssignment |o--o{ KpiAssignment : "parent"
    KpiAssignment |o--o{ KpiAssignment : "source"
    ReportingFrequency ||--o{ KpiAssignment : "reportingFrequency"
    Person |o--o{ KpiAssignment : "createdBy"
    Person |o--o{ KpiAssignment : "approvedBy"
    Person |o--o{ KpiAssignment : "acknowledgedBy"
    KpiAssignment ||--o{ KpiWeight : "assignment"
    Person |o--o{ KpiWeight : "createdBy"
    Person |o--o{ KpiWeight : "approvedBy"
    KpiAssignment ||--o{ KpiBaseline : "assignment"
    KpiScaleLevel |o--o{ KpiBaseline : "scaleLevel"
    Currency |o--o{ KpiBaseline : "currency"
    ReportingPeriod |o--o{ KpiBaseline : "effectiveFromPeriod"
    Person |o--o{ KpiBaseline : "createdBy"
    Person |o--o{ KpiBaseline : "verifiedBy"
    KpiAssignment ||--o{ KpiTarget : "assignment"
    KpiScaleLevel |o--o{ KpiTarget : "scaleLevel"
    Currency |o--o{ KpiTarget : "currency"
    ReportingPeriod |o--o{ KpiTarget : "effectiveFromPeriod"
    Person |o--o{ KpiTarget : "createdBy"
    Person |o--o{ KpiTarget : "approvedBy"
    KpiAssignment ||--o{ ResponsibilityAllocation : "parentAssignment"
    KpiAssignment |o--o{ ResponsibilityAllocation : "childAssignment"
    Office |o--o{ ResponsibilityAllocation : "childOffice"
    Person |o--o{ ResponsibilityAllocation : "createdBy"
    KpiAssignment ||--o{ AssignmentChangeRequest : "assignment"
    Person |o--o{ AssignmentChangeRequest : "requestedBy"
    Person |o--o{ AssignmentChangeRequest : "reviewedBy"
    KpiBaseline |o--o{ AssignmentChangeRequest : "newBaseline"
    KpiTarget |o--o{ AssignmentChangeRequest : "newTarget"
    KpiWeight |o--o{ AssignmentChangeRequest : "newWeight"
```

## Files and documents

Tables: `FileUpload`, `DocumentType`, `Document`, `BaselineEvidence`, `ChangeRequestEvidence`.

Defined in another part and shown only as a stub (id only), because a table here points to it: `Person`, `Office`, `KpiBaseline`, `AssignmentChangeRequest`.

```mermaid
erDiagram
    FileUpload {
        String id PK
        String originalName
        String storedPath
        String mimeType
        BigInt sizeBytes
        String checksum "optional"
        String uploadedByPersonId FK "optional"
        DateTime uploadedAt
    }
    DocumentType {
        String id PK
        String name UK
        String description "optional"
        String allowedExtensions "optional"
        Int maxSizeMb "optional"
        Boolean isActive
    }
    Document {
        String id PK
        String documentTypeId FK
        String fileId FK
        String ownerOfficeId FK "optional"
        String title
        String description "optional"
        String createdByPersonId FK "optional"
        DateTime createdAt
    }
    BaselineEvidence {
        String id PK
        String baselineId FK
        String documentId FK
        String sourceDescription "optional"
        DateTime sourceDate "optional"
        DateTime createdAt
    }
    ChangeRequestEvidence {
        String id PK
        String changeRequestId FK
        String documentId FK
        String comment "optional"
        DateTime createdAt
    }
    Person {
        string id PK
    }
    Office {
        string id PK
    }
    KpiBaseline {
        string id PK
    }
    AssignmentChangeRequest {
        string id PK
    }
    Person |o--o{ FileUpload : "uploadedBy"
    DocumentType ||--o{ Document : "documentType"
    FileUpload ||--o{ Document : "file"
    Office |o--o{ Document : "ownerOffice"
    Person |o--o{ Document : "createdBy"
    KpiBaseline ||--o{ BaselineEvidence : "baseline"
    Document ||--o{ BaselineEvidence : "document"
    AssignmentChangeRequest ||--o{ ChangeRequestEvidence : "changeRequest"
    Document ||--o{ ChangeRequestEvidence : "document"
```

## Reporting and evaluation

Tables: `PerformanceReport`, `PerformanceValue`, `PerformanceEvidence`, `PerformanceReview`, `PerformanceStatusThreshold`, `KpiAchievement`, `ContractScore`.

Defined in another part and shown only as a stub (id only), because a table here points to it: `PerformanceContract`, `ReportingPeriod`, `Person`, `KpiAssignment`, `KpiScaleLevel`, `Currency`, `ExchangeRate`, `Document`, `Office`, `KpiBaseline`, `KpiTarget`, `KpiWeight`.

```mermaid
erDiagram
    PerformanceReport {
        String id PK
        String contractId FK
        String reportingPeriodId FK
        ReportStatus status
        String preparedByPersonId FK "optional"
        String submittedByPersonId FK "optional"
        DateTime submittedAt "optional"
        Boolean isProvisional
        Boolean isLate
        DateTime lateAllowedUntil "optional"
        String lateAllowedReason "optional"
        String lateAllowedByPersonId FK "optional"
        DateTime createdAt
        DateTime updatedAt
    }
    PerformanceValue {
        String id PK
        String reportId FK
        String assignmentId FK
        ContributionType contributionType
        ReportingStatus reportingStatus
        Decimal value "optional"
        Decimal numerator "optional"
        Decimal denominator "optional"
        String scaleLevelId FK "optional"
        String currencyId FK "optional"
        Decimal convertedValue "optional"
        String exchangeRateId FK "optional"
        String note "optional"
        String enteredByPersonId FK "optional"
        DateTime createdAt
    }
    PerformanceEvidence {
        String id PK
        String performanceValueId FK
        String documentId FK
        VerificationStatus verificationStatus
        String verifiedByPersonId FK "optional"
        DateTime verifiedAt "optional"
        String comment "optional"
        DateTime createdAt
    }
    PerformanceReview {
        String id PK
        String reportId FK
        String reviewerPersonId FK
        String reviewerOfficeId FK "optional"
        ReviewDecision decision
        String comment "optional"
        DateTime reviewedAt
    }
    PerformanceStatusThreshold {
        String id PK
        String name UK
        Decimal minPercent
        Decimal maxPercent "optional"
        String color "optional"
        Int sortOrder
        Boolean isActive
    }
    KpiAchievement {
        String id PK
        String assignmentId FK
        String reportingPeriodId FK
        String baselineId FK
        String targetId FK
        String weightId FK
        Decimal actualValue "optional"
        Decimal actualNumerator "optional"
        Decimal actualDenominator "optional"
        String actualScaleLevelId FK "optional"
        Decimal requiredImprovement "optional"
        Decimal actualImprovement "optional"
        Boolean improvementCalculable
        String notCalculableReason "optional"
        Decimal improvementAchievementRaw "optional"
        Decimal improvementAchievementCapped "optional"
        Decimal targetAchievementRaw "optional"
        Decimal targetAchievementCapped "optional"
        Boolean targetMet "optional"
        AchievementStatus achievementStatus
        String statusThresholdId FK "optional"
        Decimal weightedImprovementScore "optional"
        Decimal weightedTargetScore "optional"
        Boolean isProvisional
        DateTime calculatedAt
    }
    ContractScore {
        String id PK
        String contractId FK
        String reportingPeriodId FK
        Decimal totalWeight
        Decimal reportedWeight
        Decimal weightedImprovementScore "optional"
        Decimal weightedTargetScore "optional"
        ScoringBasis officialBasis
        Boolean isProvisional
        DateTime calculatedAt
    }
    PerformanceContract {
        string id PK
    }
    ReportingPeriod {
        string id PK
    }
    Person {
        string id PK
    }
    KpiAssignment {
        string id PK
    }
    KpiScaleLevel {
        string id PK
    }
    Currency {
        string id PK
    }
    ExchangeRate {
        string id PK
    }
    Document {
        string id PK
    }
    Office {
        string id PK
    }
    KpiBaseline {
        string id PK
    }
    KpiTarget {
        string id PK
    }
    KpiWeight {
        string id PK
    }
    PerformanceContract ||--o{ PerformanceReport : "contract"
    ReportingPeriod ||--o{ PerformanceReport : "reportingPeriod"
    Person |o--o{ PerformanceReport : "preparedBy"
    Person |o--o{ PerformanceReport : "submittedBy"
    Person |o--o{ PerformanceReport : "lateAllowedBy"
    PerformanceReport ||--o{ PerformanceValue : "report"
    KpiAssignment ||--o{ PerformanceValue : "assignment"
    KpiScaleLevel |o--o{ PerformanceValue : "scaleLevel"
    Currency |o--o{ PerformanceValue : "currency"
    ExchangeRate |o--o{ PerformanceValue : "exchangeRate"
    Person |o--o{ PerformanceValue : "enteredBy"
    PerformanceValue ||--o{ PerformanceEvidence : "performanceValue"
    Document ||--o{ PerformanceEvidence : "document"
    Person |o--o{ PerformanceEvidence : "verifiedBy"
    PerformanceReport ||--o{ PerformanceReview : "report"
    Person ||--o{ PerformanceReview : "reviewer"
    Office |o--o{ PerformanceReview : "reviewerOffice"
    KpiAssignment ||--o{ KpiAchievement : "assignment"
    ReportingPeriod ||--o{ KpiAchievement : "reportingPeriod"
    KpiBaseline ||--o{ KpiAchievement : "baseline"
    KpiTarget ||--o{ KpiAchievement : "target"
    KpiWeight ||--o{ KpiAchievement : "weight"
    KpiScaleLevel |o--o{ KpiAchievement : "actualScaleLevel"
    PerformanceStatusThreshold |o--o{ KpiAchievement : "statusThreshold"
    PerformanceContract ||--o{ ContractScore : "contract"
    ReportingPeriod ||--o{ ContractScore : "reportingPeriod"
```

## System

Tables: `SystemSetting`, `Notification`, `NotificationRecipient`, `SupportRequest`, `Message`, `MessageAttachment`, `SystemBoot`, `SystemAlert`, `MetricRollup`, `AuditLog`.

Defined in another part and shown only as a stub (id only), because a table here points to it: `FileUpload`, `Person`, `Office`, `Permission`.

```mermaid
erDiagram
    SystemSetting {
        String id PK
        String groupName
        String key
        String value "optional"
        String valueType
        String fileId FK "optional"
        String description "optional"
        Boolean isPublic
        String updatedByPersonId FK "optional"
        DateTime updatedAt
    }
    Notification {
        String id PK
        String createdByPersonId FK "optional"
        String targetOfficeId FK "optional"
        Boolean includeSubOffices
        String requiredPermissionId FK "optional"
        String title
        String message
        String notificationType "optional"
        String entityType "optional"
        String entityId "optional"
        DateTime createdAt
    }
    NotificationRecipient {
        String id PK
        String notificationId FK
        String personId FK
        String channel
        Boolean isRead
        DateTime readAt "optional"
        DateTime deliveredAt "optional"
    }
    SupportRequest {
        String id PK
        String requesterName
        String requesterEmail
        String message
        SupportRequestStatus status
        String personId FK "optional"
        String handledByPersonId FK "optional"
        String resolutionNote "optional"
        DateTime resolvedAt "optional"
        String ipAddress "optional"
        DateTime createdAt
        DateTime updatedAt
    }
    Message {
        String id PK
        String senderPersonId FK
        String receiverPersonId FK
        String content "optional"
        DateTime readAt "optional"
        DateTime createdAt
    }
    MessageAttachment {
        String id PK
        String messageId FK
        String fileId FK,UK
    }
    SystemBoot {
        String id PK
        DateTime startedAt
        String version
        String commit "optional"
        String nodeVersion
        String hostname
        String environment
    }
    SystemAlert {
        String id PK
        String ruleKey
        AlertSeverity severity
        String title
        String message
        Float value "optional"
        AlertStatus status
        DateTime openedAt
        DateTime acknowledgedAt "optional"
        String acknowledgedByPersonId FK "optional"
        DateTime resolvedAt "optional"
    }
    MetricRollup {
        String id PK
        DateTime bucketStart UK
        Int requests
        Int status4xx
        Int status5xx
        Float p50Ms
        Float p95Ms
        Float p99Ms
        Float cpuPercent
        Float memoryPercent
        Float diskUsedPercent "optional"
        Float eventLoopLagMs
        Int dbConnections
    }
    AuditLog {
        String id PK
        String actorPersonId FK "optional"
        String action
        String entityType
        String entityId "optional"
        Json oldValues "optional"
        Json newValues "optional"
        String reason "optional"
        String ipAddress "optional"
        String userAgent "optional"
        DateTime createdAt
    }
    FileUpload {
        string id PK
    }
    Person {
        string id PK
    }
    Office {
        string id PK
    }
    Permission {
        string id PK
    }
    FileUpload |o--o{ SystemSetting : "file"
    Person |o--o{ SystemSetting : "updatedBy"
    Person |o--o{ Notification : "createdBy"
    Office |o--o{ Notification : "targetOffice"
    Permission |o--o{ Notification : "requiredPermission"
    Notification ||--o{ NotificationRecipient : "notification"
    Person ||--o{ NotificationRecipient : "person"
    Person |o--o{ SupportRequest : "person"
    Person |o--o{ SupportRequest : "handledBy"
    Person ||--o{ Message : "sender"
    Person ||--o{ Message : "receiver"
    Message ||--o{ MessageAttachment : "message"
    FileUpload ||--o| MessageAttachment : "file"
    Person |o--o{ SystemAlert : "acknowledgedBy"
    Person |o--o{ AuditLog : "actor"
```
