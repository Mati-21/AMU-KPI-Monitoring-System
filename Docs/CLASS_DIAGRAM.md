# Class Diagram - AMU-KPI-Monitoring-System

## Overview

Class diagram of the **Arba Minch University (AMU) KPI Monitoring System**, generated from
[Backend/prisma/schema.prisma](../Backend/prisma/schema.prisma) (46 models, 24 enums, PostgreSQL). Table names are shown in `<<brackets>>`.

| Module | Models |
|---|---|
| 10 System Governance | `SystemSetting`, `AuditLog` |
| 11 Dashboards | None: reads results saved by Module 07 |
| 01 Identity & Authentication | `Person`, `UserAccount`, `UserSession` |
| 02 Organizational Hierarchy | `OfficeType`, `Office`, `OfficeHierarchyHistory`, `Position`, `OfficePerson` |
| 03 Scoped Access Control | `Role`, `Permission`, `RolePermission`, `OfficePersonRole` |
| 04 KPI Catalog & Fiscal Planning | `FiscalYear`, `StrategicObjective`, `KpiTheme`, `MeasurementUnit`, `ReportingFrequency`, `KpiScale`, `KpiScaleLevel`, `Currency`, `ExchangeRate`, `Kpi` |
| 05 Contracts & KPI Cascading | `PerformanceContract`, `KpiAssignment`, `KpiWeight`, `KpiBaseline`, `KpiTarget`, `ResponsibilityAllocation`, `AssignmentChangeRequest`, `BaselineEvidence`, `ChangeRequestEvidence` |
| 06 Reporting Periods | `ReportingPeriod` |
| 07 Performance Reporting & Scoring | `PerformanceReport`, `PerformanceValue`, `PerformanceReview`, `PerformanceStatusThreshold`, `KpiAchievement`, `ContractScore` |
| 08 Evidence & Documents | `FileUpload`, `DocumentType`, `Document`, `PerformanceEvidence` |
| 09 Notifications | `Notification`, `NotificationRecipient` |

---

## 1. Domain Description

### Identity (Module 01)
A `Person` is anyone known to the university. A `UserAccount` lets them log in, and each device they use holds a `UserSession`.

### Organization (Module 02)
`Office` records form one tree under the university, each of a configurable `OfficeType`. `OfficePerson` places a person in an office and `Position`. `OfficeHierarchyHistory` keeps past parents.

### Access control (Module 03)
A `Role` is a set of `Permission` records. `OfficePersonRole` grants a role to a placement, optionally scoped to an office and everything under it.

### KPI catalog (Module 04)
A `Kpi` is a master definition that is not tied to a year. It belongs to a `KpiTheme` and `StrategicObjective`, and is measured with a `MeasurementUnit`, `KpiScale` or `Currency`. Once in use it is locked, and a real change means a new KPI that points back through `replacesKpiId`.

### Contracts and cascading (Module 05)
Each office has one `PerformanceContract` per `FiscalYear`. A `KpiAssignment` puts a KPI on a contract, cascaded from the assignment above. `KpiWeight`, `KpiBaseline` and `KpiTarget` are versioned, so old values are never overwritten. `ResponsibilityAllocation` records what was retained and distributed, and `AssignmentChangeRequest` is how approved values change.

### Reporting and scoring (Modules 06-07)
A `ReportingPeriod` says when offices report. A `PerformanceReport` holds `PerformanceValue` rows (direct, aggregated and total) and `PerformanceReview` decisions. Each `KpiAchievement` keeps improvement and target achievement separately and records the exact baseline, target and weight versions it used. `ContractScore` is the weighted result per period, and `PerformanceStatusThreshold` holds the university's bands.

### Evidence (Module 08)
A `FileUpload` is a stored file, a `Document` describes it, and `PerformanceEvidence`, `BaselineEvidence` and `ChangeRequestEvidence` link documents to what they prove.

### Notifications and governance (Modules 09-10)
`Notification` and `NotificationRecipient` hold in-app messages. `SystemSetting` stores configuration declared in `config/settings.json`, and `AuditLog` is the immutable trail.

### Dashboards (Module 11)
Dashboards have no tables of their own. They read `KpiAchievement`, `ContractScore` and `PerformanceReport`.

---

## 2. PlantUML Class Diagram

```plantuml
@startuml
hide methods
skinparam classAttributeIconSize 0
skinparam packageStyle rectangle

package "10 System Governance" {
  class SystemSetting <<system_setting>> {
    + id : String
      groupName : String
      key : String
      value : String?
      valueType : String
      fileId : String?
      description : String?
      isPublic : Boolean
      updatedByPersonId : String?
      updatedAt : DateTime
  }
  class AuditLog <<audit_log>> {
    + id : String
      actorPersonId : String?
      action : String
      entityType : String
      entityId : String?
      oldValues : Json?
      newValues : Json?
      reason : String?
      ipAddress : String?
      userAgent : String?
      createdAt : DateTime
  }
}

package "01 Identity & Authentication" {
  class Person <<person>> {
    + id : String
      staffNumber : String?
      firstName : String
      middleName : String?
      lastName : String
      email : String?
      phone : String?
      isActive : Boolean
      createdAt : DateTime
      updatedAt : DateTime
  }
  class UserAccount <<user_account>> {
    + id : String
      personId : String
      username : String
      passwordHash : String
      isActive : Boolean
      mustChangePassword : Boolean
      mfaEnabled : Boolean
      mfaEnforced : Boolean
      mfaSecret : String?
      mfaType : String
      lastLoginAt : DateTime?
      createdAt : DateTime
  }
  class UserSession <<user_session>> {
    + id : String
      userAccountId : String
      refreshTokenHash : String
      previousRefreshTokenHash : String?
      rotatedAt : DateTime?
      ipAddress : String?
      userAgent : String?
      createdAt : DateTime
      lastUsedAt : DateTime
      expiresAt : DateTime
      revokedAt : DateTime?
      revokedReason : String?
  }
}

package "02 Organizational Hierarchy" {
  class OfficeType <<office_type>> {
    + id : String
      name : String
      description : String?
      levelOrder : Int?
      isActive : Boolean
      createdAt : DateTime
  }
  class Office <<office>> {
    + id : String
      parentOfficeId : String?
      officeTypeId : String
      name : String
      code : String?
      canAssignKpi : Boolean
      isActive : Boolean
      createdAt : DateTime
      updatedAt : DateTime
  }
  class OfficeHierarchyHistory <<office_hierarchy_history>> {
    + id : String
      officeId : String
      parentOfficeId : String?
      validFrom : DateTime
      validTo : DateTime?
      reason : String?
      changedByPersonId : String?
      createdAt : DateTime
  }
  class Position <<position>> {
    + id : String
      officeId : String
      title : String
      isHead : Boolean
  }
  class OfficePerson <<office_person>> {
    + id : String
      personId : String
      officeId : String
      positionId : String
      startDate : DateTime
      endDate : DateTime?
      isPrimary : Boolean
  }
}

package "03 Scoped Access Control" {
  class Role <<role>> {
    + id : String
      name : String
      description : String?
      isSystem : Boolean
      createdAt : DateTime
  }
  class Permission <<permission>> {
    + id : String
      code : String
      name : String?
      module : String?
      description : String?
  }
  class RolePermission <<role_permission>> {
    + id : String
      roleId : String
      permissionId : String
  }
  class OfficePersonRole <<office_person_role>> {
    + id : String
      officePersonId : String
      roleId : String
      scopeOfficeId : String?
      validFrom : DateTime
      validTo : DateTime?
  }
}

package "04 KPI Catalog & Fiscal Planning" {
  class FiscalYear <<fiscal_year>> {
    + id : String
      name : String
      startDate : DateTime
      endDate : DateTime
      status : FiscalYearStatus
  }
  class StrategicObjective <<strategic_objective>> {
    + id : String
      code : String
      name : String
      description : String?
      isActive : Boolean
  }
  class KpiTheme <<kpi_theme>> {
    + id : String
      parentThemeId : String?
      code : String?
      name : String
      description : String?
      sortOrder : Int
      isActive : Boolean
  }
  class MeasurementUnit <<measurement_unit>> {
    + id : String
      name : String
      symbol : String?
      description : String?
  }
  class ReportingFrequency <<reporting_frequency>> {
    + id : String
      name : String
      intervalMonths : Int?
      isCustom : Boolean
  }
  class KpiScale <<kpi_scale>> {
    + id : String
      name : String
      scaleType : ScaleType
      isOrdered : Boolean
      isBinary : Boolean
      scoringApproved : Boolean
      approvedByPersonId : String?
      approvedAt : DateTime?
  }
  class KpiScaleLevel <<kpi_scale_level>> {
    + id : String
      scaleId : String
      name : String
      description : String?
      sortOrder : Int
      score : Decimal?
      assessmentCriteria : String?
  }
  class Currency <<currency>> {
    + id : String
      code : String
      name : String
      symbol : String?
      isReportingCurrency : Boolean
  }
  class ExchangeRate <<exchange_rate>> {
    + id : String
      fromCurrencyId : String
      toCurrencyId : String
      rate : Decimal
      rateDate : DateTime
      source : String?
  }
  class Kpi <<kpi>> {
    + id : String
      code : String
      name : String
      description : String?
      themeId : String
      strategicObjectiveId : String
      measurementType : MeasurementType
      unitId : String?
      scaleId : String?
      currencyId : String?
      direction : KpiDirection
      targetType : TargetType
      numeratorLabel : String?
      denominatorLabel : String?
      formula : String?
      dataSource : String?
      defaultFrequencyId : String
      evidenceRequirement : String?
      aggregationMethod : AggregationMethod
      periodRollupMethod : PeriodRollupMethod
      scoringMethod : ScoringBasis
      zeroTargetRule : ZeroTargetRule
      isAdditive : Boolean
      decimalPlaces : Int
      maintenanceTolerance : Decimal?
      coordinatingOfficeId : String?
      replacesKpiId : String?
      isActive : Boolean
      createdByPersonId : String?
      createdAt : DateTime
      updatedAt : DateTime
  }
}

package "05 Contracts & KPI Cascading" {
  class PerformanceContract <<performance_contract>> {
    + id : String
      fiscalYearId : String
      officeId : String
      assigningOfficeId : String?
      versionNo : Int
      requiredTotalWeight : Decimal
      status : ContractStatus
      signedByPersonId : String?
      signedAt : DateTime?
      approvedByPersonId : String?
      approvedAt : DateTime?
      reviewComment : String?
      createdAt : DateTime
  }
  class KpiAssignment <<kpi_assignment>> {
    + id : String
      contractId : String
      kpiId : String
      parentAssignmentId : String?
      reportingFrequencyId : String
      distributionMethod : DistributionMethod
      scopeRelation : ScopeRelation
      reconciliationStatus : ReconciliationStatus
      reconciliationNote : String?
      maxOverAllocationPercent : Decimal?
      status : AssignmentStatus
      createdByPersonId : String?
      createdAt : DateTime
      approvedByPersonId : String?
      approvedAt : DateTime?
      acknowledgedByPersonId : String?
      acknowledgedAt : DateTime?
      reviewComment : String?
  }
  class KpiWeight <<kpi_weight>> {
    + id : String
      assignmentId : String
      weight : Decimal
      versionNo : Int
      isCurrent : Boolean
      reason : String?
      createdByPersonId : String?
      approvedByPersonId : String?
      approvedAt : DateTime?
      createdAt : DateTime
  }
  class KpiBaseline <<kpi_baseline>> {
    + id : String
      assignmentId : String
      versionNo : Int
      baselineStatus : BaselineStatus
      value : Decimal?
      numerator : Decimal?
      denominator : Decimal?
      scaleLevelId : String?
      currencyId : String?
      unknownJustification : String?
      effectiveFromPeriodId : String?
      isCurrent : Boolean
      reason : String?
      createdByPersonId : String?
      verifiedByPersonId : String?
      verifiedAt : DateTime?
      createdAt : DateTime
  }
  class KpiTarget <<kpi_target>> {
    + id : String
      assignmentId : String
      versionNo : Int
      value : Decimal?
      numerator : Decimal?
      denominator : Decimal?
      scaleLevelId : String?
      currencyId : String?
      effectiveFromPeriodId : String?
      isCurrent : Boolean
      reason : String?
      createdByPersonId : String?
      approvedByPersonId : String?
      approvedAt : DateTime?
      createdAt : DateTime
  }
  class ResponsibilityAllocation <<responsibility_allocation>> {
    + id : String
      parentAssignmentId : String
      childAssignmentId : String?
      allocationType : AllocationType
      allocatedAmount : Decimal
      note : String?
      createdByPersonId : String?
      createdAt : DateTime
  }
  class AssignmentChangeRequest <<assignment_change_request>> {
    + id : String
      assignmentId : String
      requestType : ChangeRequestType
      requestedByPersonId : String?
      proposedValues : Json?
      reason : String
      status : ChangeRequestStatus
      reviewedByPersonId : String?
      reviewedAt : DateTime?
      reviewComment : String?
      newBaselineId : String?
      newTargetId : String?
      newWeightId : String?
      createdAt : DateTime
  }
  class BaselineEvidence <<baseline_evidence>> {
    + id : String
      baselineId : String
      documentId : String
      sourceDescription : String?
      sourceDate : DateTime?
      createdAt : DateTime
  }
  class ChangeRequestEvidence <<change_request_evidence>> {
    + id : String
      changeRequestId : String
      documentId : String
      comment : String?
      createdAt : DateTime
  }
}

package "06 Reporting Periods" {
  class ReportingPeriod <<reporting_period>> {
    + id : String
      fiscalYearId : String
      frequencyId : String
      name : String
      startDate : DateTime
      endDate : DateTime
      submissionDeadline : DateTime?
      isYearEnd : Boolean
      isClosed : Boolean
  }
}

package "07 Performance Reporting & Scoring" {
  class PerformanceReport <<performance_report>> {
    + id : String
      contractId : String
      reportingPeriodId : String
      status : ReportStatus
      preparedByPersonId : String?
      submittedByPersonId : String?
      submittedAt : DateTime?
      isProvisional : Boolean
      createdAt : DateTime
      updatedAt : DateTime
  }
  class PerformanceValue <<performance_value>> {
    + id : String
      reportId : String
      assignmentId : String
      contributionType : ContributionType
      reportingStatus : ReportingStatus
      value : Decimal?
      numerator : Decimal?
      denominator : Decimal?
      scaleLevelId : String?
      currencyId : String?
      convertedValue : Decimal?
      exchangeRateId : String?
      note : String?
      enteredByPersonId : String?
      createdAt : DateTime
  }
  class PerformanceReview <<performance_review>> {
    + id : String
      reportId : String
      reviewerPersonId : String
      reviewerOfficeId : String?
      decision : ReviewDecision
      comment : String?
      reviewedAt : DateTime
  }
  class PerformanceStatusThreshold <<performance_status_threshold>> {
    + id : String
      name : String
      minPercent : Decimal
      maxPercent : Decimal?
      color : String?
      sortOrder : Int
      isActive : Boolean
  }
  class KpiAchievement <<kpi_achievement>> {
    + id : String
      assignmentId : String
      reportingPeriodId : String
      baselineId : String
      targetId : String
      weightId : String
      actualValue : Decimal?
      actualNumerator : Decimal?
      actualDenominator : Decimal?
      actualScaleLevelId : String?
      requiredImprovement : Decimal?
      actualImprovement : Decimal?
      improvementCalculable : Boolean
      notCalculableReason : String?
      improvementAchievementRaw : Decimal?
      improvementAchievementCapped : Decimal?
      targetAchievementRaw : Decimal?
      targetAchievementCapped : Decimal?
      targetMet : Boolean?
      achievementStatus : AchievementStatus
      statusThresholdId : String?
      weightedImprovementScore : Decimal?
      weightedTargetScore : Decimal?
      isProvisional : Boolean
      calculatedAt : DateTime
  }
  class ContractScore <<contract_score>> {
    + id : String
      contractId : String
      reportingPeriodId : String
      totalWeight : Decimal
      reportedWeight : Decimal
      weightedImprovementScore : Decimal?
      weightedTargetScore : Decimal?
      officialBasis : ScoringBasis
      isProvisional : Boolean
      calculatedAt : DateTime
  }
}

package "08 Evidence & Documents" {
  class FileUpload <<file_upload>> {
    + id : String
      originalName : String
      storedPath : String
      mimeType : String
      sizeBytes : BigInt
      checksum : String?
      uploadedByPersonId : String?
      uploadedAt : DateTime
  }
  class DocumentType <<document_type>> {
    + id : String
      name : String
      description : String?
      allowedExtensions : String?
      maxSizeMb : Int?
      isActive : Boolean
  }
  class Document <<document>> {
    + id : String
      documentTypeId : String
      fileId : String
      ownerOfficeId : String?
      title : String
      description : String?
      createdByPersonId : String?
      createdAt : DateTime
  }
  class PerformanceEvidence <<performance_evidence>> {
    + id : String
      performanceValueId : String
      documentId : String
      verificationStatus : VerificationStatus
      verifiedByPersonId : String?
      verifiedAt : DateTime?
      comment : String?
      createdAt : DateTime
  }
}

package "09 Notifications" {
  class Notification <<notification>> {
    + id : String
      createdByPersonId : String?
      targetOfficeId : String?
      includeSubOffices : Boolean
      requiredPermissionId : String?
      title : String
      message : String
      notificationType : String?
      entityType : String?
      entityId : String?
      createdAt : DateTime
  }
  class NotificationRecipient <<notification_recipient>> {
    + id : String
      notificationId : String
      personId : String
      channel : String
      isRead : Boolean
      readAt : DateTime?
      deliveredAt : DateTime?
  }
}

Person "1" -- "*" UserAccount : personId
UserAccount "1" -- "*" UserSession : userAccountId
Office "0..1" -- "*" Office : parentOfficeId
OfficeType "1" -- "*" Office : officeTypeId
Office "1" -- "*" OfficeHierarchyHistory : officeId
Office "0..1" -- "*" OfficeHierarchyHistory : parentOfficeId
Person "0..1" -- "*" OfficeHierarchyHistory : changedByPersonId
Office "1" -- "*" Position : officeId
Person "1" -- "*" OfficePerson : personId
Office "1" -- "*" OfficePerson : officeId
Position "1" -- "*" OfficePerson : positionId
Role "1" -- "*" RolePermission : roleId
Permission "1" -- "*" RolePermission : permissionId
OfficePerson "1" -- "*" OfficePersonRole : officePersonId
Role "1" -- "*" OfficePersonRole : roleId
Office "0..1" -- "*" OfficePersonRole : scopeOfficeId
KpiTheme "0..1" -- "*" KpiTheme : parentThemeId
Person "0..1" -- "*" KpiScale : approvedByPersonId
KpiScale "1" -- "*" KpiScaleLevel : scaleId
Currency "1" -- "*" ExchangeRate : fromCurrencyId
Currency "1" -- "*" ExchangeRate : toCurrencyId
KpiTheme "1" -- "*" Kpi : themeId
StrategicObjective "1" -- "*" Kpi : strategicObjectiveId
MeasurementUnit "0..1" -- "*" Kpi : unitId
KpiScale "0..1" -- "*" Kpi : scaleId
Currency "0..1" -- "*" Kpi : currencyId
ReportingFrequency "1" -- "*" Kpi : defaultFrequencyId
Office "0..1" -- "*" Kpi : coordinatingOfficeId
Kpi "0..1" -- "*" Kpi : replacesKpiId
Person "0..1" -- "*" Kpi : createdByPersonId
FiscalYear "1" -- "*" ReportingPeriod : fiscalYearId
ReportingFrequency "1" -- "*" ReportingPeriod : frequencyId
FiscalYear "1" -- "*" PerformanceContract : fiscalYearId
Office "1" -- "*" PerformanceContract : officeId
Office "0..1" -- "*" PerformanceContract : assigningOfficeId
Person "0..1" -- "*" PerformanceContract : signedByPersonId
Person "0..1" -- "*" PerformanceContract : approvedByPersonId
PerformanceContract "1" -- "*" KpiAssignment : contractId
Kpi "1" -- "*" KpiAssignment : kpiId
KpiAssignment "0..1" -- "*" KpiAssignment : parentAssignmentId
ReportingFrequency "1" -- "*" KpiAssignment : reportingFrequencyId
Person "0..1" -- "*" KpiAssignment : createdByPersonId
Person "0..1" -- "*" KpiAssignment : approvedByPersonId
Person "0..1" -- "*" KpiAssignment : acknowledgedByPersonId
KpiAssignment "1" -- "*" KpiWeight : assignmentId
Person "0..1" -- "*" KpiWeight : createdByPersonId
Person "0..1" -- "*" KpiWeight : approvedByPersonId
KpiAssignment "1" -- "*" KpiBaseline : assignmentId
KpiScaleLevel "0..1" -- "*" KpiBaseline : scaleLevelId
Currency "0..1" -- "*" KpiBaseline : currencyId
ReportingPeriod "0..1" -- "*" KpiBaseline : effectiveFromPeriodId
Person "0..1" -- "*" KpiBaseline : createdByPersonId
Person "0..1" -- "*" KpiBaseline : verifiedByPersonId
KpiAssignment "1" -- "*" KpiTarget : assignmentId
KpiScaleLevel "0..1" -- "*" KpiTarget : scaleLevelId
Currency "0..1" -- "*" KpiTarget : currencyId
ReportingPeriod "0..1" -- "*" KpiTarget : effectiveFromPeriodId
Person "0..1" -- "*" KpiTarget : createdByPersonId
Person "0..1" -- "*" KpiTarget : approvedByPersonId
KpiAssignment "1" -- "*" ResponsibilityAllocation : parentAssignmentId
KpiAssignment "0..1" -- "*" ResponsibilityAllocation : childAssignmentId
Person "0..1" -- "*" ResponsibilityAllocation : createdByPersonId
KpiAssignment "1" -- "*" AssignmentChangeRequest : assignmentId
Person "0..1" -- "*" AssignmentChangeRequest : requestedByPersonId
Person "0..1" -- "*" AssignmentChangeRequest : reviewedByPersonId
KpiBaseline "0..1" -- "*" AssignmentChangeRequest : newBaselineId
KpiTarget "0..1" -- "*" AssignmentChangeRequest : newTargetId
KpiWeight "0..1" -- "*" AssignmentChangeRequest : newWeightId
Person "0..1" -- "*" FileUpload : uploadedByPersonId
DocumentType "1" -- "*" Document : documentTypeId
FileUpload "1" -- "*" Document : fileId
Office "0..1" -- "*" Document : ownerOfficeId
Person "0..1" -- "*" Document : createdByPersonId
KpiBaseline "1" -- "*" BaselineEvidence : baselineId
Document "1" -- "*" BaselineEvidence : documentId
AssignmentChangeRequest "1" -- "*" ChangeRequestEvidence : changeRequestId
Document "1" -- "*" ChangeRequestEvidence : documentId
PerformanceContract "1" -- "*" PerformanceReport : contractId
ReportingPeriod "1" -- "*" PerformanceReport : reportingPeriodId
Person "0..1" -- "*" PerformanceReport : preparedByPersonId
Person "0..1" -- "*" PerformanceReport : submittedByPersonId
PerformanceReport "1" -- "*" PerformanceValue : reportId
KpiAssignment "1" -- "*" PerformanceValue : assignmentId
KpiScaleLevel "0..1" -- "*" PerformanceValue : scaleLevelId
Currency "0..1" -- "*" PerformanceValue : currencyId
ExchangeRate "0..1" -- "*" PerformanceValue : exchangeRateId
Person "0..1" -- "*" PerformanceValue : enteredByPersonId
PerformanceValue "1" -- "*" PerformanceEvidence : performanceValueId
Document "1" -- "*" PerformanceEvidence : documentId
Person "0..1" -- "*" PerformanceEvidence : verifiedByPersonId
PerformanceReport "1" -- "*" PerformanceReview : reportId
Person "1" -- "*" PerformanceReview : reviewerPersonId
Office "0..1" -- "*" PerformanceReview : reviewerOfficeId
KpiAssignment "1" -- "*" KpiAchievement : assignmentId
ReportingPeriod "1" -- "*" KpiAchievement : reportingPeriodId
KpiBaseline "1" -- "*" KpiAchievement : baselineId
KpiTarget "1" -- "*" KpiAchievement : targetId
KpiWeight "1" -- "*" KpiAchievement : weightId
KpiScaleLevel "0..1" -- "*" KpiAchievement : actualScaleLevelId
PerformanceStatusThreshold "0..1" -- "*" KpiAchievement : statusThresholdId
PerformanceContract "1" -- "*" ContractScore : contractId
ReportingPeriod "1" -- "*" ContractScore : reportingPeriodId
FileUpload "0..1" -- "*" SystemSetting : fileId
Person "0..1" -- "*" SystemSetting : updatedByPersonId
Person "0..1" -- "*" Notification : createdByPersonId
Office "0..1" -- "*" Notification : targetOfficeId
Permission "0..1" -- "*" Notification : requiredPermissionId
Notification "1" -- "*" NotificationRecipient : notificationId
Person "1" -- "*" NotificationRecipient : personId
Person "0..1" -- "*" AuditLog : actorPersonId

enum MeasurementType {
  NUMBER
  PERCENTAGE
  RATIO
  STAGE
  CATEGORY
  MONEY
}
enum KpiDirection {
  HIGHER_IS_BETTER
  LOWER_IS_BETTER
  MAINTAIN
}
enum TargetType {
  MINIMUM
  MAXIMUM
  EXACT
}
enum AggregationMethod {
  SUM
  RATIO_OF_SUMS
  WEIGHTED_SCORE
  SHARE_MEETING_TARGET
  WEAKEST_LINK
  STAGE_DISTRIBUTION
  DIRECT
}
enum PeriodRollupMethod {
  SUM
  RATIO_OF_SUMS
  LATEST
  AVERAGE
}
enum ZeroTargetRule {
  NOT_CALCULABLE
  FULL_IF_MET
}
enum ScoringBasis {
  IMPROVEMENT
  TARGET
}
enum ScaleType {
  STAGE
  CATEGORY
}
enum FiscalYearStatus {
  PLANNING
  ACTIVE
  CLOSED
}
enum ContractStatus {
  DRAFT
  SUBMITTED
  APPROVED
  SIGNED
  CLOSED
}
enum AssignmentStatus {
  DRAFT
  SUBMITTED
  APPROVED
  ACKNOWLEDGED
  REJECTED
  SUPERSEDED
  CANCELLED
}
enum DistributionMethod {
  EQUAL
  CUSTOM
  FULL
  NONE
}
enum ScopeRelation {
  EXCLUSIVE_COMPLETE
  OVERLAPPING
  INSTITUTION_WIDE
}
enum ReconciliationStatus {
  NOT_REQUIRED
  BALANCED
  UNDER_ALLOCATED
  OVER_ALLOCATED
  JUSTIFIED
}
enum AllocationType {
  DISTRIBUTED
  RETAINED
}
enum BaselineStatus {
  KNOWN
  UNKNOWN
  PENDING_VERIFICATION
  VERIFIED
}
enum ChangeRequestType {
  CLARIFICATION
  CORRECTION
  MODIFICATION
}
enum ChangeRequestStatus {
  PENDING
  APPROVED
  REJECTED
}
enum ReportStatus {
  NOT_STARTED
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  REVISION_REQUIRED
  APPROVED
  REJECTED
  OVERDUE
}
enum ContributionType {
  DIRECT
  AGGREGATED
  TOTAL
}
enum ReportingStatus {
  REPORTED
  NOT_REPORTED
  AUTO_FILLED
}
enum VerificationStatus {
  PENDING
  VERIFIED
  REJECTED
}
enum ReviewDecision {
  APPROVED
  REJECTED
  REVISION_REQUIRED
}
enum AchievementStatus {
  BELOW_TARGET
  AT_TARGET
  ABOVE_TARGET
  NOT_REPORTED
  NOT_CALCULABLE
  PENDING_VERIFICATION
}
@enduml
```

---

## 3. Key Constraints

- `RolePermission`: one row per `[roleId, permissionId]`
- `OfficePersonRole`: one row per `[officePersonId, roleId, scopeOfficeId, validFrom]`
- `KpiScaleLevel`: one row per `[scaleId, name]`
- `KpiScaleLevel`: one row per `[scaleId, sortOrder]`
- `ExchangeRate`: one row per `[fromCurrencyId, toCurrencyId, rateDate]`
- `ReportingPeriod`: one row per `[fiscalYearId, frequencyId, name]`
- `PerformanceContract`: one row per `[fiscalYearId, officeId, versionNo]`
- `KpiAssignment`: one row per `[contractId, kpiId]`
- `KpiWeight`: one row per `[assignmentId, versionNo]`
- `KpiBaseline`: one row per `[assignmentId, versionNo]`
- `KpiTarget`: one row per `[assignmentId, versionNo]`
- `ResponsibilityAllocation`: one row per `[parentAssignmentId, childAssignmentId]`
- `BaselineEvidence`: one row per `[baselineId, documentId]`
- `ChangeRequestEvidence`: one row per `[changeRequestId, documentId]`
- `PerformanceReport`: one row per `[contractId, reportingPeriodId]`
- `PerformanceValue`: one row per `[reportId, assignmentId, contributionType]`
- `PerformanceEvidence`: one row per `[performanceValueId, documentId]`
- `KpiAchievement`: one row per `[assignmentId, reportingPeriodId]`
- `ContractScore`: one row per `[contractId, reportingPeriodId]`
- `SystemSetting`: one row per `[groupName, key]`
- `NotificationRecipient`: one row per `[notificationId, personId, channel]`
- Partial unique indexes in the migrations allow one current baseline, target and weight per assignment, one active fiscal year, one reporting currency, one retained allocation per assignment and one year-end period per fiscal year.
- A closed fiscal year is read-only until a Super Admin reopens it.
