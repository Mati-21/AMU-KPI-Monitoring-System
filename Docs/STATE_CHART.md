# AMU-KPI-Monitoring-System State Chart

## System Overview

This document outlines the key states and transitions in the AMU-KPI-Monitoring-System, focusing on the important business processes and user workflows.

---

## 1. Authentication & Session State

```mermaid
stateDiagram-v2
    [*] --> NotAuthenticated
    NotAuthenticated --> Authenticated: Login with Valid Credentials
    Authenticated --> NotAuthenticated: Logout / Session Expired
    Authenticated --> Authenticated: Refresh Token
```

### Key Actions:

- **NotAuthenticated**: User at login page, no valid token
- **Authenticated**: Valid JWT token, user logged in with assigned role(s)
- **Transitions**: Login (POST /api/auth/login) → Refresh → Logout

---

## 2. User Role & Permission System

```mermaid
stateDiagram-v2
    [*] --> NoRole
    NoRole --> AssignedRole: Admin assigns role to user
    AssignedRole --> ActiveRole: Role activation date reached
    ActiveRole --> ArchivedRole: Role end date reached OR manual archive
    ArchivedRole --> ActiveRole: Reactivate role
    ArchivedRole --> [*]

    ActiveRole --> MultipleRoles: User has multiple active roles
    MultipleRoles --> PrimaryRole: System selects primary role (System Admin > Others > Latest)
```

### Key Entities:

- **Role**: RoleName, RoleCategory, ParentRole (hierarchy)
- **UserRole**: Links User to Role with IsArchived, ToDate
- **RoleCategory**: Categorizes roles (Admin, Faculty, Staff, etc.)
- **Permissions**: Derived from role and RoleCategory

---

## 3. KPI Lifecycle

```mermaid
stateDiagram-v2
    [*] --> KPICreated
    KPICreated --> KPIActive: During active KPI cycle
    KPIActive --> KPIAssigned: Assigned to User via UserKPI
    KPIAssigned --> PerformanceSubmission: User submits result
    PerformanceSubmission --> EvidenceValidation: If evidence required (IsEvedenceRequired)
    EvidenceValidation --> ResultRecorded: Evidence approved
    ResultRecorded --> KPIClosed: KPI cycle ends
    KPIClosed --> [*]

    KPIAssigned --> PerformanceSubmission: Alternative: Submit without evidence
    PerformanceSubmission --> ResultRecorded: Direct approval
```

### Key Entities:

- **KPI**: KPICode, KPIName, Baseline, Target, IsEvedenceRequired
- **KPIType**: Type hierarchy (Parent/Child KPIs)
- **Unit**: Measurement unit for KPI
- **UserKPI**: Assignment of KPI to user with baseline/target/remarks
- **UserKPIResult**: Performance results with optional EvidenceURL, PerformanceTitle

### Key Fields:

- `KPI.IsEvedenceRequired`: Flag for whether evidence must be submitted
- `UserKPIResult.EvidenceURL`: URL to evidence document/file
- `UserKPIResult.PerformanceTitle`: Title of performance submission

---

## 4. KPI Allocation & Assignment Flow

```mermaid
stateDiagram-v2
    [*] --> SelectKPI
    SelectKPI --> DefinedBaseline: Set baseline for assignment
    DefinedBaseline --> DefinedTarget: Set target for assignment
    DefinedTarget --> AssignToRole: Select role/user for assignment
    AssignToRole --> AssignmentCreated: UserKPI record created
    AssignmentCreated --> SentKPITracker: Track sent assignments
    SentKPITracker --> UserReceives: User receives assigned KPI
    UserReceives --> AssignmentAccepted: User views/acknowledges assignment

    SentKPITracker --> EditAssignment: Modify baseline/target/remark
    EditAssignment --> AssignmentUpdated: PUT /api/user-kpis/:id

    SentKPITracker --> DeleteAssignment: Remove assignment
    DeleteAssignment --> AssignmentRemoved
    AssignmentRemoved --> [*]
```

### Key Operations:

- **Create Assignment**: POST /api/user-kpis (requires `create_kpi_allocation`)
- **Edit Assignment**: PUT /api/user-kpis/:id (requires `create_kpi_allocation` or `edit_kpi_allocation`)
- **Delete Assignment**: DELETE /api/user-kpis/:id (requires `create_kpi_allocation` or `delete_kpi_allocation`)
- **Batch Assignment**: Uses `AssignmentBatchId` (UUID) to group related assignments

---

## 5. Performance Result Submission & Tracking

```mermaid
stateDiagram-v2
    [*] --> AssignmentReceived
    AssignmentReceived --> ViewAssignmentDetails: User views assigned KPI
    ViewAssignmentDetails --> SubmitPerformance: Open edit modal to submit

    SubmitPerformance --> EnterPerformanceValue: Input actual value achieved
    EnterPerformanceValue --> AddEvidenceIfRequired: Check if evidence needed

    AddEvidenceIfRequired --> UploadEvidence: Upload file/document
    UploadEvidence --> EnterEvidenceTitle: Add PerformanceTitle
    EnterEvidenceTitle --> SubmitResult: Submit UserKPIResult

    AddEvidenceIfRequired --> NoEvidenceNeeded: Evidence not required
    NoEvidenceNeeded --> SubmitResult

    SubmitResult --> ResultRecorded: POST /api/user-kpi-results
    ResultRecorded --> TrackingVisible: Result shows in dashboard/tracking
    TrackingVisible --> [*]
```

### Key Fields in UserKPIResult:

- `UserId`: User who submitted
- `UserKPIId`: Reference to assignment
- `KPIId`: Reference to KPI
- `PerformanceValue`: Actual value achieved
- `EvidenceURL`: Document/file link (optional)
- `PerformanceTitle`: Title of submission
- `CreatedAt`: Submission timestamp

---

## 6. Complete System State Machine

```mermaid
graph TB
    subgraph Auth["Authentication Layer"]
        A1["Not Authenticated"]
        A2["Authenticated<br/>(Valid Token)"]
        A1 -->|Login| A2
        A2 -->|Logout| A1
    end

    subgraph Roles["Role & Permission Layer"]
        R1["User Assigned<br/>to Role"]
        R2["Role Active<br/>(Within Date Range)"]
        R3["Primary Role<br/>Selected"]
        R1 -->|Activate| R2
        R2 -->|Select| R3
    end

    subgraph KPIMgmt["KPI Management Layer"]
        K1["KPI Created<br/>in System"]
        K2["KPI Active<br/>in Cycle"]
        K3["KPI Assigned<br/>to User"]
        K1 -->|Active Cycle| K2
        K2 -->|Assign| K3
    end

    subgraph Submission["Result Submission Layer"]
        S1["Assignment<br/>Received"]
        S2["Performance<br/>Submitted"]
        S3["Evidence<br/>Uploaded"]
        S4["Result<br/>Recorded"]
        S1 -->|Submit| S2
        S2 -->|If Required| S3
        S3 -->|Confirm| S4
    end

    subgraph Tracking["Tracking & Reporting"]
        T1["Results in<br/>Dashboard"]
        T2["Performance<br/>Visible"]
        S4 -->|Track| T1
        T1 -->|Report| T2
    end

    A2 -->|Access| Roles
    R3 -->|View KPIs| KPIMgmt
    K3 -->|Submit| Submission
```

---

## 7. Key State Transitions & Permissions

| Transition         | Required Permission        | Source State          | Target State          |
| ------------------ | -------------------------- | --------------------- | --------------------- |
| User Login         | -                          | Not Authenticated     | Authenticated         |
| Assign KPI         | `create_kpi_allocation`    | KPI Active            | KPI Assigned          |
| Edit Assignment    | `edit_kpi_allocation`      | Assignment Created    | Assignment Updated    |
| Delete Assignment  | `delete_kpi_allocation`    | Assignment Created    | Assignment Removed    |
| Submit Performance | - (Assigned User)          | Assignment Received   | Performance Submitted |
| Upload Evidence    | - (Assigned User)          | Performance Submitted | Evidence Uploaded     |
| View Results       | `view_performance_results` | Result Recorded       | Tracking Visible      |
| Archive Role       | `manage_user_roles`        | Active Role           | Archived Role         |

---

## 8. Data Flow Summary

```
User (Authentication)
    ↓
UserRole (Authorization)
    ↓
Role + Permissions (Access Control)
    ↓
KPI (System Resources)
    ↓
UserKPI (Assignment/Allocation)
    ↓
UserKPIResult (Performance Tracking)
    ↓
KPIDocument + OfficeReportSubmission (Evidence & Reporting)
```

---

## 9. Critical State Conditions

### Active UserRole Conditions:

- `IsArchived = false`
- `ToDate IS NULL` OR `ToDate >= TODAY`

### Active KPI Cycle:

- KPI must be associated with current cycle
- Assignments created during active cycle window

### Valid Assignment:

- `UserKPI` record exists
- User has active role matching assignment role
- KPI is active and not archived

### Complete Performance Result:

- `PerformanceValue` recorded
- If `KPI.IsEvedenceRequired = true`, then `UserKPIResult.EvidenceURL` must exist
- `PerformanceTitle` provided if evidence uploaded

---

## 10. Key Entities & Relationships

```
User (1) ──→ (M) UserRole (1) ──→ (1) Role (1) ──→ (1) RoleCategory
     ↓                                    ↓
     └────────→ (M) UserKPI (1) ──→ (1) KPI (1) ──→ (1) KPIType
     │               ↓                    ↓
     │               ├─→ (M) UserKPIResult    └──→ (1) Unit
     │               └─→ (1) UserKPI
     │
     └────────→ (M) UserKPIResult
     │
     └────────→ (M) KPIDocument (1) ──→ (1) KPI
     │
     └────────→ (1) OfficeReportSubmission
```

---

## Notes

- **Session Management**: Uses JWT tokens; cleared on logout
- **Role Hierarchy**: Roles can have parent-child relationships
- **KPI Hierarchy**: KPITypes support parent-child relationships
- **Assignment Batching**: Multiple assignments can be grouped via `AssignmentBatchId`
- **Archiving**: Soft deletes using `IsArchived` flag
- **Audit Trail**: `CreatedBy`, `CreatedAt`, `UpdatedAt` tracked on key entities
