# AMU-KPI-Monitoring System - Comprehensive Collaboration Diagrams

This document contains 8 detailed collaboration diagrams showcasing different interactions and workflows within the AMU-KPI-Monitoring System. Each diagram includes a detailed description and PlantUML code.

---

## Diagram 1: Authentication & Authorization Flow

### Detailed Description

The Authentication & Authorization Flow diagram illustrates how users authenticate into the system and obtain role-based permissions. This is the entry point for all system interactions.

**Key Components**:

- **User**: System user attempting to access the application
- **Frontend Application**: React/Vite-based client interface
- **API Gateway**: Express.js server handling HTTP requests
- **Authentication Service**: Validates credentials and generates JWT tokens
- **Database**: PostgreSQL storing user credentials and role mappings
- **Role Service**: Retrieves role permissions for the authenticated user

**Process Flow**:

1. User enters credentials on the login page
2. Frontend sends login request to API Gateway
3. Authentication Service validates credentials against database
4. Upon successful validation, JWT token is generated
5. Token is returned to frontend and stored in browser memory/localStorage
6. User's primary role is determined (System Admin has highest priority)
7. Role permissions are cached on frontend for quick access
8. User is redirected to appropriate dashboard based on role
9. All subsequent requests include JWT token in Authorization header
10. Token is validated on each request by Authentication Middleware

**Security Features**:

- Password hashing using bcrypt (salt rounds: 10)
- JWT token expiration (typically 24-72 hours)
- Token stored securely in HTTP-only cookies (if available)
- Role-based access control prevents unauthorized data access

### PlantUML Code

```plantuml
@startuml Diagram1-AuthenticationFlow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam classBackgroundColor #E1F5FE
skinparam classBorderColor #0277BD
skinparam actorBackgroundColor #FFF9C4
skinparam participantBackgroundColor #E1F5FE
skinparam noteBackgroundColor #FFFACD
skinparam noteBorderColor #FF6B6B

actor "User\n(Browser)" as User
participant "Frontend\nApplication\n(React)" as Frontend
participant "API Gateway\n(Express)" as Gateway
participant "Auth\nMiddleware" as AuthMid
participant "Auth\nController" as AuthCtrl
participant "User\nModel" as UserModel
participant "Role\nService" as RoleService
database "PostgreSQL\nDatabase" as DB

User -> Frontend: 1. Enter Credentials\n(Email/Username + Password)
Frontend -> Gateway: 2. POST /auth/login\n{email, password}
Gateway -> AuthMid: 3. Check Request Format
AuthMid -> AuthCtrl: 4. Process Login Request
AuthCtrl -> DB: 5. Query: SELECT User WHERE email=?
DB -> AuthCtrl: 6. Return User Record\nwith Password Hash
AuthCtrl -> AuthCtrl: 7. Verify Password\nusing bcrypt.compare()
AuthCtrl -> UserModel: 8. Load User Relations\n(Roles, Units, Permissions)
UserModel -> DB: 9. JOIN User-Role-Permission\nTables
DB -> UserModel: 10. Return Complete\nUser Profile
AuthCtrl -> RoleService: 11. Determine Primary Role\n(Priority: SystemAdmin > Others > Latest)
RoleService -> DB: 12. Fetch Role Permissions\nfor Primary Role
DB -> RoleService: 13. Return Permission Set
RoleService -> AuthCtrl: 14. Return Role with Permissions
AuthCtrl -> AuthCtrl: 15. Generate JWT Token\nincluding {userId, roles, permissions}
AuthCtrl -> Gateway: 16. Return {token, user, roles, permissions}
Gateway -> Frontend: 17. HTTP 200 OK\nwith Token & User Data
Frontend -> Frontend: 18. Store Token in State\n& localStorage
Frontend -> Frontend: 19. Cache Role Permissions\nfor Quick Access
Frontend -> User: 20. Redirect to Role-Appropriate\nDashboard

note over User, DB
  **Security Validation Steps**:
  ✓ Email format validation
  ✓ Password hashing verification
  ✓ Account active status check
  ✓ Role expiration validation
  ✓ JWT signature verification on subsequent requests
end note
@enduml
```

---

## Diagram 2: KPI Assignment & Allocation Flow

### Detailed Description

The KPI Assignment & Allocation Flow demonstrates how KPIs are assigned from the organizational level down to individual users. This is critical for performance management.

**Key Components**:

- **System Administrator**: Creates and allocates KPIs
- **Frontend Application**: UI for KPI management
- **KPI Service**: Business logic for KPI operations
- **UserKPI Controller**: Manages user-KPI relationships
- **KPI Model**: Data structure for KPIs
- **UserKPI Model**: Tracks KPI assignment to users
- **Notification Service**: Alerts users of new KPI assignments

**Process Flow**:

1. System Admin/Manager navigates to KPI allocation section
2. Frontend fetches available KPIs from database
3. Admin selects target users/roles for KPI assignment
4. System validates KPI-user compatibility (role-based)
5. KPI allocation records are created in UserKPI table
6. System calculates timeline (start date, deadline)
7. Notification is sent to assigned users
8. Users receive notification in real-time
9. Dashboard updates to show newly assigned KPIs
10. Assignment history is logged for audit purposes

**Assignment Rules**:

- KPI must match user's role permissions
- Only active users can receive KPI assignments
- KPI cannot be assigned to archived users
- Assignment dates must fall within active cycle
- Multiple users can share the same KPI with different targets

### PlantUML Code

```plantuml
@startuml Diagram2-KPIAllocationFlow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam classBackgroundColor #FFE0B2
skinparam classBorderColor #E65100
skinparam actorBackgroundColor #FFF9C4
skinparam participantBackgroundColor #FFE0B2
skinparam noteBackgroundColor #FFFACD
skinparam noteBorderColor #E65100

actor "System Admin\nManager" as Admin
participant "Frontend\nApplication" as Frontend
participant "API Gateway\n(Express)" as Gateway
participant "KPI\nController" as KPICtrl
participant "UserKPI\nController" as UserKPICtrl
participant "KPI\nService" as KPIService
participant "Validation\nService" as ValidSvc
participant "Role\nService" as RoleSvc
database "PostgreSQL\nDatabase" as DB
participant "Notification\nQueue\n(Real-time)" as Queue

Admin -> Frontend: 1. Navigate to KPI\nAllocation Page
Frontend -> Gateway: 2. GET /api/kpis\n?status=active
Gateway -> KPICtrl: 3. Fetch Available KPIs
KPICtrl -> DB: 4. Query KPI WHERE\nstatus=active & isArchived=false
DB -> KPICtrl: 5. Return KPI List with\nMetadata (targets, baselines, types)
KPICtrl -> Gateway: 6. Return KPI Data\nwith Constraints
Gateway -> Frontend: 7. Return KPIs to UI
Frontend -> Admin: 8. Display KPI Selection\nInterface & User Search

Admin -> Frontend: 9. Select KPIs & Users\n(e.g., 5 KPIs, 10 users)
Frontend -> Gateway: 10. POST /api/user-kpis/allocate\n{kpiIds[], userIds[], cycle}

Gateway -> UserKPICtrl: 11. Initiate Batch\nAllocation Process
UserKPICtrl -> ValidSvc: 12. Validate Each\nKPI-User Combination
ValidSvc -> RoleSvc: 13. Check User Role\nMatches KPI Requirements
RoleSvc -> DB: 14. Fetch User Roles\n& KPI Permissions
DB -> RoleSvc: 15. Return Role-Permission\nMappings
RoleSvc -> ValidSvc: 16. Confirm Role\nCompatibility
ValidSvc -> DB: 17. Check User Active Status\n& Cycle Eligibility
DB -> ValidSvc: 18. Return User\nStatus & Cycle Info
ValidSvc -> UserKPICtrl: 19. Return Validation\nResults (Pass/Fail)

UserKPICtrl -> DB: 20. BEGIN TRANSACTION
UserKPICtrl -> DB: 21. INSERT Multiple UserKPI\nRecords in Batch
DB -> DB: 22. Verify No Duplicate\nAssignments
DB -> UserKPICtrl: 23. Confirm Batch Insert\n(e.g., 50 records)
UserKPICtrl -> DB: 24. COMMIT TRANSACTION

UserKPICtrl -> Queue: 25. Publish Allocation\nNotifications\n{userId, kpiId, allocation_date}
Queue -> Queue: 26. Queue Messages for\nReal-time Delivery
UserKPICtrl -> DB: 27. Log Allocation Action\n(Admin, Timestamp, Count)
UserKPICtrl -> Gateway: 28. Return Success Response\n{allocated_count: 50, failed_count: 0}

Gateway -> Frontend: 29. HTTP 200 OK\nwith Allocation Summary
Frontend -> Admin: 30. Display Success Message\n& Updated Statistics

note over Admin, Queue
  **Batch Allocation Example**:
  - 5 KPIs × 10 users = 50 UserKPI records
  - Validation runs on each combination
  - All-or-nothing transaction (rollback on any failure)
  - Notifications queued for real-time delivery to users
  - Assignment appears in user dashboard within 1-2 seconds
end note
@enduml
```

---

## Diagram 3: KPI Evidence Submission & Tracking

### Detailed Description

The KPI Evidence Submission & Tracking Flow illustrates how users submit performance evidence and how the system tracks, validates, and approves submissions.

**Key Components**:

- **User/Faculty**: Submits performance evidence
- **Frontend Application**: Evidence upload interface
- **File Storage Service**: Stores uploaded documents
- **UserKPIResult Controller**: Records evidence submissions
- **Approval Workflow**: Route evidence to appropriate approvers
- **Chat Service**: Enables feedback communication
- **Audit Logger**: Tracks all submission activities

**Process Flow**:

1. User navigates to KPI with evidence requirement
2. User uploads supporting evidence (documents, images, URLs)
3. Frontend validates file type and size (max 50MB typically)
4. File is uploaded to local/cloud storage
5. UserKPIResult record is created with submission metadata
6. Evidence review notification is sent to department chair/manager
7. Approver reviews evidence with performance metrics
8. Approver can approve, reject, or request modifications
9. Feedback is provided through integrated chat system
10. User receives notification of approval decision
11. Evidence is linked to final KPI rating/score
12. Complete audit trail is maintained

**Evidence Requirements**:

- Document types: PDF, DOC, DOCX, XLS, XLSX, Images
- Maximum file size: 50MB per document
- At least one evidence item required if KPI is evidence-requiring
- Evidence must be submitted before cycle deadline
- Revisions allowed with update tracking

### PlantUML Code

```plantuml
@startuml Diagram3-EvidenceSubmissionFlow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam classBackgroundColor #C8E6C9
skinparam classBorderColor #2E7D32
skinparam actorBackgroundColor #FFF9C4
skinparam participantBackgroundColor #C8E6C9
skinparam noteBackgroundColor #FFFACD
skinparam noteBorderColor #2E7D32

actor "User\n(Faculty)" as User
participant "Frontend\nApplication" as Frontend
participant "File Upload\nHandler" as FileHandler
participant "API Gateway\n(Express)" as Gateway
participant "Validation\nMiddleware" as ValidMid
participant "File Storage\nService" as FileStore
participant "UserKPIResult\nController" as ResultCtrl
database "PostgreSQL\nDatabase" as DB
participant "Chat\nService" as Chat
participant "Notification\nService" as Notif
actor "Approver\n(Dept Chair)" as Approver

User -> Frontend: 1. Open KPI Details\n(Evidence-Required)
Frontend -> User: 2. Display Evidence\nUpload Form
User -> Frontend: 3. Select & Attach\nFile (PDF, 2.5MB)
Frontend -> Frontend: 4. Client-side Validation:\n- File Type Check\n- Size Check (<50MB)\n- Name Sanitization
Frontend -> Frontend: 5. Create FormData with\nFile & Metadata
User -> Frontend: 6. Click Submit Evidence
Frontend -> Gateway: 7. POST /api/kpi-results\n{kpiId, userId, file, description}
Gateway -> ValidMid: 8. Validate Request\n& JWT Token
ValidMid -> ValidMid: 9. Check if KPI\nRequires Evidence
ValidMid -> DB: 10. Fetch KPI & UserKPI\nRecords
DB -> ValidMid: 11. Return KPI Details\n& Assignment Status
ValidMid -> Gateway: 12. Validation Passed
Gateway -> FileHandler: 13. Process File Upload
FileHandler -> Frontend: 14. Show Upload Progress\n(0-100%)
FileHandler -> FileStore: 15. Save File to Storage\n/uploads/performance-evidence/\n{userId}/{kpiId}/{timestamp}-filename
FileStore -> FileStore: 16. Generate Unique File ID\n& Create Folder Structure
FileStore -> FileHandler: 17. Return File Path\n& URL
FileHandler -> ResultCtrl: 18. Create UserKPIResult\nRecord
ResultCtrl -> DB: 19. INSERT UserKPIResult\n{userId, kpiId, filePath, status: SUBMITTED,\nsubmittedDate: NOW()}
DB -> ResultCtrl: 20. Return Record ID\n& Timestamps
ResultCtrl -> DB: 21. LOG Activity:\nACTION=EVIDENCE_SUBMITTED,\nUSER={userId}, FILE={filename}
ResultCtrl -> Notif: 22. Trigger Notification\nfor Approvers
Notif -> DB: 23. Fetch Approvers\nfor User's Unit
DB -> Notif: 24. Return Approver List\n(Dept Chair, Manager)
Notif -> Approver: 25. Send Real-time Alert\n"New Evidence for Review: KPI-{id}"
Approver -> Frontend: 26. Receive Notification\n& Navigate to Review
Frontend -> Gateway: 27. GET /api/kpi-results/{resultId}\n/with-details
Gateway -> ResultCtrl: 28. Fetch Result with\nKPI & User Info
ResultCtrl -> DB: 29. Query JOIN with\nKPI, User, Comments
DB -> ResultCtrl: 30. Return Complete\nResult Context
ResultCtrl -> Gateway: 31. Return Result Data
Gateway -> Frontend: 32. Display Evidence\nReview Page

Approver -> Frontend: 33. Review Evidence &\nEnter Assessment Score (0-100)
Approver -> Frontend: 34. Add Comments\n(Approve/Reject)
Approver -> Frontend: 35. Click Approve
Frontend -> Gateway: 36. POST /api/kpi-results/{resultId}/approve\n{score, comment, approvalStatus: APPROVED}
Gateway -> ResultCtrl: 37. Update Result\nStatus & Score
ResultCtrl -> DB: 38. UPDATE UserKPIResult\nSET status=APPROVED, score={score},\napprovedDate=NOW(), approvedBy={approverId}
DB -> ResultCtrl: 39. Confirm Update
ResultCtrl -> Chat: 40. Create Approval\nComment in Chat Thread
Chat -> DB: 41. INSERT Comment\nwith Approval Details
Chat -> Frontend: 42. Broadcast Message\nto User & Approver
Frontend -> User: 43. Real-time Alert:\n"Your Evidence Approved!\nScore: 95/100"
ResultCtrl -> Notif: 44. Send Email Notification\nto User
Notif -> User: 45. Email: "Evidence Approved\nfor KPI: {kpiName}"
ResultCtrl -> DB: 46. LOG Activity:\nACTION=EVIDENCE_APPROVED,\nAPPROVER={approverId}, SCORE={score}

note over User, Notif
  **Evidence Submission Workflow**:
  1. User uploads evidence document
  2. File validation (type, size, format)
  3. File stored with organized naming
  4. UserKPIResult record created (status: SUBMITTED)
  5. Approver notified in real-time
  6. Approver reviews & provides score + feedback
  7. User receives real-time approval notification
  8. Complete audit trail maintained
  9. Evidence linked to final KPI performance rating
end note
@enduml
```

---

## Diagram 4: Role-Based Access Control (RBAC) & Permission Validation

### Detailed Description

The Role-Based Access Control Flow shows how the system enforces permissions based on user roles and ensures users can only access authorized features and data.

**Key Components**:

- **User**: Attempting to access a resource
- **Frontend Router**: Protects routes based on roles
- **Auth Middleware**: Validates JWT and user permissions
- **Role Service**: Retrieves role permissions
- **Permission Cache**: Speeds up permission checks
- **Access Control List**: Defines which roles access which resources
- **Audit Logger**: Logs access attempts and failures

**Process Flow**:

1. User attempts to access a protected resource or feature
2. Frontend checks if user has required role (client-side)
3. Frontend sends request with JWT token
4. Auth Middleware extracts token and validates signature
5. Middleware fetches cached permissions or queries database
6. System checks if user's role has required permission
7. If authorized, request proceeds to controller
8. If unauthorized, system returns 403 Forbidden
9. Detailed logs capture all access attempts (success & failure)
10. Dashboard reflects only accessible features based on role

**Role Hierarchy**:

- **System Admin**: Full system access, can manage all aspects
- **Department Chair**: Department-level access, manage faculty KPIs
- **Unit Head**: Unit-level access, manage unit staff KPIs
- **Faculty**: Personal KPI access, submission capabilities
- **Staff**: Limited access, task completion only

### PlantUML Code

```plantuml
@startuml Diagram4-RBACPermissionFlow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam classBackgroundColor #BBDEFB
skinparam classBorderColor #0D47A1
skinparam actorBackgroundColor #FFF9C4
skinparam participantBackgroundColor #BBDEFB
skinparam noteBackgroundColor #FFFACD
skinparam noteBorderColor #0D47A1

actor "User\n(Various Roles)" as User
participant "Frontend\nApplication" as Frontend
participant "Route\nGuard" as RouteGuard
participant "API Gateway\n(Express)" as Gateway
participant "Auth\nMiddleware" as AuthMid
participant "Permission\nCache\n(Redis)" as Cache
participant "Role\nService" as RoleSvc
database "PostgreSQL\nDatabase" as DB
participant "Audit\nLogger" as Logger
participant "Error\nHandler" as ErrorHandler

User -> Frontend: 1. Click on Feature/Link\n(e.g., \"View All Users\")

Frontend -> RouteGuard: 2. Route Change Triggered\nto /users
RouteGuard -> Frontend: 3. Check Stored User\nRoles from localStorage
Frontend -> Frontend: 4. Match Required Role\nfor /users route\n(Requires: System Admin)
Frontend -> Frontend: 5. User Role:\n\"System Admin\" ✓

Frontend -> Frontend: 6. Route Guard Passes\nClient-side Check
Frontend -> Gateway: 7. GET /api/users\nHeader: Authorization: Bearer {JWT}

Gateway -> AuthMid: 8. Middleware Intercepts\nRequest
AuthMid -> AuthMid: 9. Extract JWT Token\nfrom Headers
AuthMid -> AuthMid: 10. Verify JWT Signature\n& Expiration
AuthMid -> AuthMid: 11. Token Valid ✓\nExtract {userId, roleId, permissions[]}

AuthMid -> Cache: 12. Query Permission Cache\nKey: {userId}:{roleId}
Cache -> AuthMid: 13. Return Cached\nPermissions (Hit)\nOR Cache Miss

alt Cache Miss
  AuthMid -> RoleSvc: 14a. Fetch Role Details\nfrom Database
  RoleSvc -> DB: 15a. SELECT Role Permissions\nWHERE roleId = ?
  DB -> RoleSvc: 16a. Return Permission Set\n& Constraints
  RoleSvc -> AuthMid: 17a. Return Full Permissions
  AuthMid -> Cache: 18a. Store in Cache\nTTL: 1 hour
  Cache -> AuthMid: 19a. Permissions Cached
else Cache Hit
  AuthMid -> AuthMid: 14b. Use Cached\nPermissions
end

AuthMid -> AuthMid: 20. Check Required Permission\nfor GET /api/users\nNeeded: \"VIEW_ALL_USERS\"\nUser Has: [\"VIEW_ALL_USERS\", \"MANAGE_ROLES\", ...]

AuthMid -> AuthMid: 21. Permission Match ✓\nAuthorization Granted

AuthMid -> Logger: 22. Log Access Attempt\nACTION=AUTHORIZED, USER={userId},\nRESOURCE=/api/users, TIMESTAMP=NOW()

AuthMid -> Gateway: 23. Attach User Context\nto Request: req.user = {userId, roleId, permissions}
Gateway -> Gateway: 24. Proceed to Controller\nUserController.getAll()

alt Different User Type - Unauthorized
  AuthMid -> AuthMid: X1. Permission Check Fails ✗\nUser Role: \"Faculty\"\nRequired: \"System Admin\"\nUser Permissions: [\"VIEW_OWN_KPIS\", \"SUBMIT_EVIDENCE\"]
  AuthMid -> Logger: X2. Log Access Denial\nACTION=DENIED, USER={userId},\nRESOURCE=/api/users,\nREASON=insufficient_permissions
  AuthMid -> ErrorHandler: X3. Trigger Error Handler
  ErrorHandler -> Gateway: X4. Return 403 Forbidden\n{error: \"Access Denied\",\nmessage: \"You don't have permission\nto view all users\"}
  Gateway -> Frontend: X5. HTTP 403 Response
  Frontend -> ErrorHandler: X6. Display Error Alert\n\"Insufficient Permissions\"
  Frontend -> User: X7. Show Restricted Content\nOR Redirect to Dashboard
end

note over User, Logger
  **RBAC Validation Process**:
  1. Client-side route guard (first filter)
  2. JWT token validation (signature, expiration)
  3. Permission cache lookup (performance optimization)
  4. Permission comparison with required access level
  5. Audit logging (all attempts recorded)
  6. Response with/without 403 error

  **Role Examples**:
  • System Admin: All permissions
  • Dept Chair: [VIEW_UNIT_KPIS, ALLOCATE_KPIS, APPROVE_EVIDENCE]
  • Faculty: [VIEW_OWN_KPIS, SUBMIT_EVIDENCE, VIEW_OWN_RESULTS]
  • Staff: [VIEW_ASSIGNED_TASKS, SUBMIT_PROGRESS]
end note
@enduml
```

---

## Diagram 5: Real-time Chat & Feedback System Integration

### Detailed Description

The Real-time Chat & Feedback System Integration demonstrates how users communicate about KPI performance, provide feedback, and collaborate asynchronously.

**Key Components**:

- **User Interface**: Chat interface for messaging
- **WebSocket Server**: Real-time message delivery
- **Message Queue**: Buffers messages for offline users
- **Chat Service**: Processes and stores messages
- **Notification Engine**: Sends alerts for new messages
- **Message Database**: Persists chat history
- **Thread Linking**: Associates messages with KPI contexts

**Process Flow**:

1. User opens KPI feedback section
2. User types message about KPI progress/issues
3. Message is sent to WebSocket server
4. System validates message content and KPI context
5. Message is stored in database with timestamp
6. Message is broadcasted to relevant users in real-time
7. Notification is sent to other participants
8. Chat history is loaded for context
9. Read receipts are tracked
10. Messages are searchable and archivable

**Chat Features**:

- One-to-one and group conversations per KPI
- Threaded discussions for organized feedback
- @mentions to notify specific users
- File attachments in chat messages
- Message reactions/emoji responses
- Read status indicators
- Message timestamps and user avatars

### PlantUML Code

```plantuml
@startuml Diagram5-RealtimeChatFlow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam classBackgroundColor #F8BBD0
skinparam classBorderColor #C2185B
skinparam actorBackgroundColor #FFF9C4
skinparam participantBackgroundColor #F8BBD0
skinparam noteBackgroundColor #FFFACD
skinparam noteBorderColor #C2185B

actor "User A\n(Faculty)" as UserA
participant "Frontend\nApplication" as Frontend
participant "WebSocket\nClient" as WSClient
participant "WebSocket\nServer\n(Socket.IO)" as WSServer
participant "Chat\nService" as ChatService
participant "Message\nValidation" as Validation
database "Message\nDatabase" as DB
participant "Notification\nEngine" as NotifEngine
actor "User B\n(Dept Chair)" as UserB
actor "User C\n(Manager)" as UserC

UserA -> Frontend: 1. Navigate to KPI\nFeedback Section\n(KPI-#2456)

Frontend -> Frontend: 2. Load Chat History\nGET /api/chat/{kpiId}/messages
Frontend -> UserA: 3. Display 20 Previous\nMessages (Paginated)

UserA -> Frontend: 4. Type Message:\n\"Need clarification on\nbaseline calculation\"

Frontend -> Frontend: 5. Enable Send Button\nMessage Preview

UserA -> Frontend: 6. Press Enter/Send

Frontend -> WSClient: 7. Emit \"message:send\"\nEvent with {kpiId, userId,\nmessage, timestamp}

WSClient -> WSServer: 8. WebSocket Send\n(TCP Connection)\n{event: \"message:send\",\npayload: {...}}

WSServer -> ChatService: 9. Forward Message\nto Chat Service

ChatService -> Validation: 10. Validate Message\n- Content length check\n- Profanity filter\n- KPI context verification\n- User permissions check

Validation -> DB: 11. Check User Access\nto KPI Discussion
DB -> Validation: 12. Return Access\nPermissions ✓

Validation -> ChatService: 13. Validation Passed

ChatService -> DB: 14. Store Message\nINSERT INTO ChatMessages\n(kpiId, userId, content,\ntimestamp, status: SENT)

DB -> ChatService: 15. Return Message ID\n& Stored Timestamp

ChatService -> WSServer: 16. Message Stored\nSuccessfully

WSServer -> Frontend: 17. Acknowledge Receipt\n\"message:sent_ack\"\n{messageId, timestamp}\n(emit to UserA)

Frontend -> UserA: 18. Update UI:\nShow \"Message Sent\" ✓\nAdd Message to Chat

ChatService -> NotifEngine: 19. Trigger Notifications\nfor Other Participants\n{kpiId, participants: [UserB, UserC],\nmessagePreview: \"Need clarification...\"}

NotifEngine -> DB: 20. Query KPI Subscribers\n(Users assigned to this KPI)

DB -> NotifEngine: 21. Return Subscriber List\n& Notification Preferences\n[UserB: in_app+email,\nUserC: in_app]

NotifEngine -> WSServer: 22. Broadcast Message\nto All Connected Clients\nof KPI-#2456\n\"message:new\"\n{from: UserA, content: ...,\navatar, timestamp}

WSServer -> Frontend: 23. Deliver Real-time\nMessage to UserB\n& UserC (if connected)

Frontend -> UserB: 24. Message Appears\nInstantly in Chat\nwith User Avatar & Timestamp

WSServer -> NotifEngine: 25. User C Status:\nOffline (Not Connected)

NotifEngine -> NotifEngine: 26. Queue Notification\nfor Offline Delivery

NotifEngine -> UserC: 27a. Send In-app Alert:\n\"You have a new message\nin KPI-#2456\"\n(when user returns online)

NotifEngine -> UserC: 27b. Send Email:\n\"New feedback on your KPI\nby {UserA}: 'Need clarification...'\"\n(with link to KPI)

Frontend -> Frontend: 28. Optional: UserB\nClicks \"Reply\" Button

UserB -> Frontend: 29. Type Response:\n\"The baseline is calculated\nas average of last 3 years\"\n\nFrontend -> WSClient: 30. Emit \"message:send\"\n(similar flow repeats)

note over UserA, NotifEngine
  **Real-time Chat Features**:
  1. Instant message delivery via WebSocket
  2. Acknowledgment (message sent, delivered, read)
  3. Message persistence for history
  4. Real-time notifications for subscribers
  5. Offline message queuing
  6. Multi-channel delivery (in-app + email)
  7. User presence indicators
  8. Thread organization by KPI
  9. @mention notifications
  10. Message search across conversations
end note
@enduml
```

---

## Diagram 6: Reporting & Performance Dashboard Generation

### Detailed Description

The Reporting & Performance Dashboard Generation Flow illustrates how the system aggregates KPI data, calculates performance metrics, and generates dashboards for various user levels.

**Key Components**:

- **Dashboard Service**: Aggregates KPI data
- **Calculation Engine**: Performs performance calculations
- **Data Aggregation**: Combines results from multiple sources
- **Cache Layer**: Stores computed metrics for fast access
- **Report Generator**: Creates exportable reports
- **Chart Service**: Generates visualizations
- **Analytics Database**: Optimized for reporting queries

**Process Flow**:

1. User requests dashboard
2. System determines user role and access level
3. Dashboard Service queries relevant KPI data
4. Calculation Engine computes performance metrics
5. Data is aggregated at appropriate hierarchy levels
6. Results are cached for performance
7. Charts and visualizations are generated
8. Dashboard is rendered with role-specific views
9. User can filter and drill-down into details
10. Export options available (PDF, Excel, CSV)

**Dashboard Levels**:

- **System Admin**: Organization-wide performance overview
- **Department Chair**: Department performance by KPI
- **Faculty**: Individual KPI progress and evidence
- **Manager**: Team-level KPI achievement tracking

### PlantUML Code

```plantuml
@startuml Diagram6-DashboardGenerationFlow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam classBackgroundColor #D1C4E9
skinparam classBorderColor #512DA8
skinparam actorBackgroundColor #FFF9C4
skinparam participantBackgroundColor #D1C4E9
skinparam noteBackgroundColor #FFFACD
skinparam noteBorderColor #512DA8

actor "User\n(Multiple Roles)" as User
participant "Frontend\nApplication" as Frontend
participant "API Gateway\n(Express)" as Gateway
participant "Dashboard\nService" as DashSvc
participant "Auth Service\n(Role Check)" as AuthSvc
participant "Calculation\nEngine" as CalcEngine
database "Analytics\nDatabase" as AnalyticsDB
database "Primary\nDatabase" as PrimaryDB
participant "Cache\nLayer\n(Redis)" as Cache
participant "Chart\nGenerator" as ChartGen

User -> Frontend: 1. Load Dashboard Page
Frontend -> Gateway: 2. GET /api/dashboard?period=Q1&year=2026
Gateway -> AuthSvc: 3. Validate User Role\n& Permissions
AuthSvc -> PrimaryDB: 4. Fetch User Role\n& Department/Unit
PrimaryDB -> AuthSvc: 5. Return User\nOrganizational Context\n{role: \"System Admin\",\norganization: \"AMU\"}
AuthSvc -> Gateway: 6. Authorization Granted\n+ Role Context

Gateway -> DashSvc: 7. Forward Request with\nUser Context\n{userId, roleId, orgContext,\nperiod, filters}

DashSvc -> Cache: 8. Query Cache\nKey: \"dashboard:{userId}:{period}\"\nTTL check

alt Cache Hit & Valid
  Cache -> DashSvc: 9a. Return Cached\nDashboard Data\n(populated < 5 min ago)
  DashSvc -> Gateway: 9b. Return Cached Data
else Cache Miss or Expired
  DashSvc -> DashSvc: 10a. Cache Invalid/Missing\nStart Computation

  DashSvc -> AuthSvc: 10b. Get Accessible\nOrganizational Units\n(based on role)
  AuthSvc -> PrimaryDB: 10c. Fetch User Role\nHierarchy Permissions
  PrimaryDB -> AuthSvc: 10d. Return Authorized\nOrgUnits: [Unit1, Unit2, Unit3]
  AuthSvc -> DashSvc: 10e. Return Unit\nAccess List

  DashSvc -> AnalyticsDB: 11. Query Aggregated\nKPI Data for Period\nSELECT kpiId, userId,\nstatus, score, target\nWHERE period={period}\nAND unit IN (Unit1, Unit2, Unit3)

  AnalyticsDB -> DashSvc: 12. Return 500+ KPI\nResult Records

  DashSvc -> CalcEngine: 13. Calculate Key Metrics\n- Avg KPI Achievement: 87%\n- Total KPIs: 250\n- On-Track: 185\n- At-Risk: 45\n- Not-Started: 20

  CalcEngine -> CalcEngine: 14. Formula: Achievement =\n(Score / Target) × 100\nfor each KPI

  CalcEngine -> CalcEngine: 15. Aggregate by\nDimension:\n- By KPI Type (Operational,\nStrategic, Financial)\n- By Department\n- By Status (Active, Completed,\nArchived)

  CalcEngine -> CalcEngine: 16. Trend Calculation\n(Q1 vs Q2 vs Q3 vs Q4)\nYear-over-Year comparison

  CalcEngine -> DashSvc: 17. Return Calculated\nMetrics Object\n{totalKPIs: 250, achieved: 217,\npendingReview: 33, notStarted: 0,\naverageScore: 86.8, trend: +2.3%}

  DashSvc -> ChartGen: 18. Generate Chart\nConfigurations\n- KPI Achievement Bar Chart\n- Status Distribution Pie Chart\n- Trend Line Graph\n- Heatmap by Department

  ChartGen -> ChartGen: 19. Create Chart\nJSON Data\n{type: \"bar\", labels: [\"Q1\", \"Q2\", ..],\ndata: [82, 85, 87],\ncolors: [\"#4CAF50\", \"#FFC107\", ...]}\n(repeated for 6 charts)

  ChartGen -> DashSvc: 20. Return Chart\nDefinitions

  DashSvc -> Cache: 21. Store Complete\nDashboard Data in Cache\nKey: \"dashboard:{userId}:{period}\"\nTTL: 10 minutes
  Cache -> DashSvc: 22. Data Cached ✓

  DashSvc -> Gateway: 23. Return Complete\nDashboard Data\n{metrics, charts, summary,\nfilters, exportOptions}
end

Gateway -> Frontend: 24. HTTP 200 OK\nwith Dashboard Data

Frontend -> Frontend: 25. Render Components:\n- Summary Cards (KPI Counts)\n- Achievement Gauge Chart\n- Status Distribution Chart\n- Performance Trend Line\n- KPI Table (Top 10)\n- Filter Panel

Frontend -> User: 26. Display Interactive\nDashboard

User -> Frontend: 27. Apply Filter:\n\"Show Only At-Risk KPIs\"\nFrontend -> Frontend: 28. Filter Client-side Data\nDisplay 45 at-risk KPIs

User -> Frontend: 29. Click \"Export as PDF\"\nFrontend -> Gateway: 30. POST /api/reports/export\n{format: \"pdf\", period, filters}

Gateway -> ChartGen: 31. Generate PDF\nwith Charts & Tables

ChartGen -> Frontend: 32. Return PDF\nFile Stream

Frontend -> User: 33. Download:\n\"KPI-Dashboard-Q1-2026.pdf\"\n(10 pages, formatted)

note over User, Cache
  **Dashboard Caching Strategy**:
  - Dashboard data cached for 10 minutes
  - Cache invalidated on KPI score update
  - Separate cache for each user (role-based)
  - Real-time metrics (red/green status) not cached

  **Role-Based Dashboard Views**:
  - System Admin: Org-wide KPI overview + all units
  - Dept Chair: Department KPI performance
  - Faculty: Personal KPI progress
  - Manager: Team member KPI tracking

  **Export Formats**:
  - PDF: Formatted with charts and branding
  - Excel: Data in spreadsheet format
  - CSV: Raw data for analysis tools
end note
@enduml
```

---

## Diagram 7: KPI Cycle Management & Performance Tracking

### Detailed Description

The KPI Cycle Management & Performance Tracking Flow demonstrates how annual KPI cycles are created, managed, and tracked through quarterly reviews.

**Key Components**:

- **Cycle Service**: Manages KPI cycle lifecycle
- **Cycle Controller**: Handles cycle operations
- **Quarterly Review Service**: Tracks quarterly milestones
- **Performance Aggregator**: Compiles performance data
- **Deadline Manager**: Enforces cycle deadlines
- **Status Tracker**: Monitors cycle phases

**Process Flow**:

1. System Administrator creates annual KPI cycle
2. Cycle details: start date, end date, target deadline
3. Quarterly milestones are automatically generated
4. KPIs are linked to the cycle
5. Users are notified of cycle start
6. System tracks progress through quarters
7. Deadline reminders are sent to users
8. Quarter closes on specified date
9. System locks KPI submissions for closed quarter
10. Annual cycle completion triggers performance evaluation

**Cycle Phases**:

- **Planning**: KPI definition and target setting
- **Q1-Q4**: Active tracking and evidence submission
- **Review**: Performance evaluation and scoring
- **Closure**: Final results recording and archival
- **Analysis**: Performance trend analysis

### PlantUML Code

```plantuml
@startuml Diagram7-KPICycleManagementFlow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam classBackgroundColor #C8E6C9
skinparam classBorderColor #1B5E20
skinparam actorBackgroundColor #FFF9C4
skinparam participantBackgroundColor #C8E6C9
skinparam noteBackgroundColor #FFFACD
skinparam noteBorderColor #1B5E20

actor "System\nAdministrator" as Admin
participant "Frontend\nApplication" as Frontend
participant "API Gateway\n(Express)" as Gateway
participant "Cycle\nService" as CycleSvc
participant "Cycle\nController" as CycleCtrl
participant "Milestone\nGenerator" as MilestoneGen
database "PostgreSQL\nDatabase" as DB
participant "Notification\nScheduler" as NotifSched
participant "Deadline\nManager" as DeadlineMgr
participant "Performance\nAggregator" as PerfAgg

Admin -> Frontend: 1. Navigate to\nKPI Cycle Management

Frontend -> Gateway: 2. GET /api/cycles
Gateway -> CycleCtrl: 3. Fetch All Cycles
CycleCtrl -> DB: 4. SELECT * FROM KPICycles\nORDER BY startDate DESC
DB -> CycleCtrl: 5. Return 5 Previous Cycles\n(2022-2026)
CycleCtrl -> Gateway: 6. Return Cycle List
Gateway -> Frontend: 7. Display Cycles
Frontend -> Admin: 8. Show Cycle Timeline\nwith Status (Active, Closed, Upcoming)

Admin -> Frontend: 9. Click \"Create New Cycle\"\nfor Year 2026

Frontend -> Frontend: 10. Open Cycle\nCreation Form

Admin -> Frontend: 11. Enter Cycle Details:\n- Cycle Name: \"2026 Performance Cycle\"\n- Start Date: 2026-01-01\n- End Date: 2026-12-31\n- Target Deadline: 2026-12-15\n- Description: \"Annual KPI evaluation cycle\"

Admin -> Frontend: 12. Click \"Create Cycle\"

Frontend -> Gateway: 13. POST /api/cycles\n{name, startDate, endDate,\ntargetDeadline, description}

Gateway -> CycleCtrl: 14. Initiate Cycle Creation

CycleCtrl -> CycleSvc: 15. Create Cycle\nwith Validations

CycleSvc -> DB: 16. Check for Overlapping\nCycles in Date Range

DB -> CycleSvc: 17. Confirm No Conflicts ✓

CycleSvc -> DB: 18. INSERT INTO KPICycles\n{name: \"2026 Performance Cycle\",\nstartDate: 2026-01-01,\nendDate: 2026-12-31,\nstatus: PLANNING,\ncreatedBy: {adminId},\ntimestamp: NOW()}

DB -> CycleSvc: 19. Return Cycle ID: cycle_2026

CycleSvc -> MilestoneGen: 20. Generate Quarterly\nMilestones

MilestoneGen -> MilestoneGen: 21. Calculate Dates:\n- Q1: 2026-01-01 to 2026-03-31\n- Q2: 2026-04-01 to 2026-06-30\n- Q3: 2026-07-01 to 2026-09-30\n- Q4: 2026-10-01 to 2026-12-31

MilestoneGen -> DB: 22. INSERT 4 Milestone\nRecords\nINSERT INTO CycleMilestones\n(cycleId, quarterNumber, startDate,\nendDate, reviewDeadline, status: PENDING)

DB -> MilestoneGen: 23. Confirm 4 Milestones\nCreated ✓

MilestoneGen -> CycleSvc: 24. Return Milestone\nConfiguration

CycleSvc -> DB: 25. UPDATE KPICycle\nSET status: ACTIVE,\nmilestonesCreated: true

DB -> CycleSvc: 26. Cycle Updated ✓

CycleSvc -> NotifSched: 27. Schedule Notifications:\n- Q1 Start Alert\n- Monthly Reminders\n- Q1 End Reminder (7 days before)\n- Q1 Close Alert

NotifSched -> DB: 28. INSERT Into\nNotificationSchedule\n(event: \"cycle_milestone_reminder\",\ntargetDate: [dates],\nrecipients: ALL_USERS,\npriority: HIGH)

NotifSched -> CycleSvc: 29. Scheduling Complete

CycleSvc -> Gateway: 30. Return Success\n{cycleId: cycle_2026,\nstatus: ACTIVE,\nquarters: 4,\nmilestonesCreated: true}

Gateway -> Frontend: 31. HTTP 200 OK\nwith Cycle Details

Frontend -> Admin: 32. Display Success Message\n\"Cycle 2026 Created Successfully\"\nShow Cycle Timeline Visualization

alt Quarter End Approaches
  DeadlineMgr -> DB: 33. Query Pending KPIs\nfor Q1 (7 days before end)

  DB -> DeadlineMgr: 34. Return 500 KPIs\nwith status: IN_PROGRESS

  DeadlineMgr -> NotifSched: 35. Queue Reminders\n\"Q1 Review Due in 7 Days\"\nto 500 users

  NotifSched -> Frontend: 36. Real-time Alert\nto Users:\n\"Please submit Q1 Evidence\"

  DeadlineMgr -> DB: 37. On Q1 End Date:\nUPDATE ALL KPI Results\nstatus: SUBMITTED (if not done)\nLock for further edits

  PerfAgg -> DB: 38. Aggregate Q1 Performance\nCELECT AVG(score)\nGROUP BY userId, departmentId

  PerfAgg -> PerfAgg: 39. Calculate:\n- Overall Org Achievement: 87%\n- By Department: [95%, 82%, 79%]\n- By KPI Type: [Operational: 90%, Strategic: 84%]

  PerfAgg -> DB: 40. Store Q1 Summary\nIN QuarterlyPerformanceSummary

  DB -> DeadlineMgr: 41. Summary Stored ✓
end

note over Admin, DB
  **KPI Cycle Structure**:
  - 1 Cycle = 1 Year
  - Each Cycle has 4 Quarters
  - Each Quarter has milestones & deadlines
  - KPIs linked to cycles for tracking
  - Evidence submitted per quarter
  - Performance aggregated per quarter
  - Annual score calculated at cycle end

  **Cycle Status Flow**:
  PLANNING → ACTIVE → Q1_REVIEW → Q2_REVIEW →
  Q3_REVIEW → Q4_REVIEW → CLOSED → ARCHIVED

  **Deadline Management**:
  - Q1 Review: 2026-03-31 (23:59 UTC)
  - Q2 Review: 2026-06-30
  - Q3 Review: 2026-09-30
  - Q4 Review: 2026-12-15 (Final)
end note
@enduml
```

---

## Diagram 8: Multi-Level Hierarchical KPI Assignment & Cascading

### Detailed Description

The Multi-Level Hierarchical KPI Assignment & Cascading Flow shows how organization-level KPIs cascade down through departments, units, and ultimately to individual employees, with each level having specific targets and accountabilities.

**Key Components**:

- **Hierarchy Service**: Manages organizational structure
- **Cascade Engine**: Distributes KPIs through hierarchy
- **Target Allocation**: Sets targets at each level
- **Permission Validator**: Ensures proper assignment rights
- **Weight Calculator**: Distributes weights proportionally
- **Dependency Tracker**: Tracks KPI relationships

**Process Flow**:

1. System Admin creates organization-level KPIs
2. Department Chairs cascade KPIs to departments
3. Unit Heads break down KPIs for units
4. Individual targets are set for employees
5. Each level has specific targets and weights
6. Progress rolls up through hierarchy
7. Parent KPI status reflects child KPI performance
8. System detects cascading failures early
9. Bottlenecks are identified through hierarchy
10. Performance reports show hierarchical view

**Hierarchy Levels**:

- **Organization**: Strategic KPIs (5-10 total KPIs)
- **Department**: Departmental targets (10-20 KPIs)
- **Unit**: Unit-specific KPIs (15-30 KPIs)
- **Individual**: Personal performance goals (3-5 KPIs)

### PlantUML Code

```plantuml
@startuml Diagram8-HierarchicalKPICascadeFlow
!theme plain
skinparam backgroundColor #FFFFFF
skinparam classBackgroundColor #FFE0B2
skinparam classBorderColor #E65100
skinparam actorBackgroundColor #FFF9C4
skinparam participantBackgroundColor #FFE0B2
skinparam noteBackgroundColor #FFFACD
skinparam noteBorderColor #E65100

actor "System\nAdministrator" as SysAdmin
participant "Frontend\nApplication" as Frontend
participant "API Gateway\n(Express)" as Gateway
participant "Cascade\nService" as CascSvc
participant "Hierarchy\nService" as HierSvc
participant "Target\nAllocator" as TargetAllocator
participant "Permission\nValidator" as PermValidator
database "PostgreSQL\nDatabase" as DB
participant "Audit\nLogger" as Logger

SysAdmin -> Frontend: 1. Navigate to\nHierarchical KPI Assignment

Frontend -> Gateway: 2. GET /api/hierarchy?expand=units,roles
Gateway -> HierSvc: 3. Fetch Organizational\nHierarchy
HierSvc -> DB: 4. SELECT Organizational\nStructure (Units, Roles)\nWITH hierarchy depth

DB -> HierSvc: 5. Return Tree Structure:\n- Organization (Root)\n  ├── Academic Affairs (Dept)\n  │   ├── Engineering (Unit)\n  │   ├── Sciences (Unit)\n  │   └── Humanities (Unit)\n  └── Administration (Dept)\n      ├── Finance (Unit)\n      └── HR (Unit)

HierSvc -> Gateway: 6. Return Hierarchy\nStructure with IDs

Gateway -> Frontend: 7. Render Hierarchy\nTree View

Frontend -> SysAdmin: 8. Display Organization\nHierarchy Diagram with\n6 Units at different levels

SysAdmin -> Frontend: 9. Select KPI to Cascade:\n\"Student Graduation Rate\"\n(Org-level KPI, Target: 90%)

Frontend -> Frontend: 10. Show Cascade\nPlanning Interface

SysAdmin -> Frontend: 11. Map KPI Allocation:\n- Academic Affairs Target: 92%\n- Engg Unit Target: 95%\n- Sciences Unit Target: 90%\n- Humanities Unit Target: 88%\n- Admin Dept: N/A (Not applicable)\n\nWeight Distribution:\n- Engg: 40% (high importance)\n- Sciences: 35%\n- Humanities: 25%

Frontend -> Gateway: 12. POST /api/kpis/cascade\n{kpiId: \"KPI-1001\",\ncascadeMap: {\nAcad_Affairs: {target: 92%},\nEngg: {target: 95%, weight: 40},\nSciences: {target: 90%, weight: 35},\nHumanities: {target: 88%, weight: 25}\n}\n}

Gateway -> CascSvc: 13. Initiate Cascade\nOperation

CascSvc -> PermValidator: 14. Validate Permissions:\nCan SysAdmin cascade\nthis KPI?\nCheck Role Hierarchy

PermValidator -> DB: 15. Query Role\nPermissions & Hierarchy\nfor Current User

DB -> PermValidator: 16. Return Permissions:\nSysAdmin has\n\"CASCADE_KPIS\" ✓

PermValidator -> CascSvc: 17. Permission\nValidation Passed ✓

CascSvc -> HierSvc: 18. Validate Target\nAllocation Logic:\n- Child targets ≥ Parent target?\n- Weight sum = 100%?\n- All required levels mapped?

HierSvc -> HierSvc: 19. Validation Logic:\n- Parent: 90% → Children: [95, 90, 88]\n  - Weighted Avg = (95×0.4 + 90×0.35 + 88×0.25)\n             = 38 + 31.5 + 22 = 91.5% ✓\n- Weights: [40 + 35 + 25 = 100%] ✓\n- All depts assigned ✓\n\nHierSvc -> CascSvc: 20. Validation Passed ✓\nAll constraints satisfied

CascSvc -> DB: 21. BEGIN TRANSACTION\nBatch Insert Cascaded KPIs

CascSvc -> DB: 22. CREATE KPI Copy for\nAcademic Affairs\nINSERT INTO KPI\n{parentKpiId: KPI-1001,\nname: \"Student Graduation Rate\",\ntarget: 92%,\nunit: \"Academic Affairs\",\nstatus: ACTIVE,\nhierarchyLevel: 1}\n→ Returns KPI-1001-AA

CascSvc -> DB: 23. CREATE KPI Copy for\nEngineering Unit\nINSERT INTO KPI\n{parentKpiId: KPI-1001-AA,\nname: \"Engg Student Graduation Rate\",\ntarget: 95%,\nunit: \"Engineering\",\nstatus: ACTIVE,\nhierarchyLevel: 2,\nweight: 40%}\n→ Returns KPI-1001-ENG

CascSvc -> DB: 24. CREATE KPI Copy for\nSciences Unit\nINSERT INTO KPI {...}\n→ Returns KPI-1001-SCI

CascSvc -> DB: 25. CREATE KPI Copy for\nHumanities Unit\nINSERT INTO KPI {...}\n→ Returns KPI-1001-HUM

CascSvc -> DB: 26. CREATE KPI Hierarchy\nLinks\nINSERT INTO KPIHierarchy\n{parentKpiId: KPI-1001,\nchildKpiIds: [KPI-1001-AA, ...],\ncascadeDate: NOW(),\ntargetAlignment: \"ALIGNED\",\nweightDistribution: {...}}\n\nDB -> CascSvc: 27. Confirm Batch Insert\nSuccess (4 new KPIs created)\nTransaction Committed ✓

CascSvc -> TargetAllocator: 28. Allocate Targets\nto Individual Users

TargetAllocator -> DB: 29. Query Users Assigned\nto Each Unit\nSELECT UserId FROM UserRole\nWHERE unitId IN (Engg, Sci, Hum)\nAND roleId NOT IN (SystemAdmin, DeptChair)

DB -> TargetAllocator: 30. Return User List:\n- Engg Unit: 15 Faculty + 5 Staff\n- Sci Unit: 12 Faculty + 4 Staff\n- Hum Unit: 8 Faculty + 3 Staff\nTotal: 47 users

TargetAllocator -> TargetAllocator: 31. Calculate Individual\nTargets:\nFor Engg Unit (95% target,\n20 people):\nEach person gets same base target\n(95%) with role-based adjustments:\n- Professors: 98% (higher expectation)\n- Associate Prof: 95%\n- Lecturers: 92%\n- Staff: 80% (support role)\n\nTargetAllocator -> DB: 32. INSERT User-KPI\nAssignments (47 records)\nINSERT INTO UserKPI\n{userId, kpiId: KPI-1001-ENG,\ntarget: 95-98% (role-based),\nstartDate: NOW(),\nstatus: ASSIGNED}\n\nDB -> TargetAllocator: 33. Confirm 47 Records\nInserted ✓\n\nTargetAllocator -> CascSvc: 34. Assignment\nComplete\n\nCascSvc -> Logger: 35. Log Cascade\nOperation\nACTION=KPI_CASCADED,\nSOURCE_KPI=KPI-1001,\nTARGET_UNITS=3,\nAFFECTED_USERS=47,\nADMIN={SysAdminId},\nTIMESTAMP=NOW()\n\nLogger -> DB: 36. INSERT Audit Log\nEntry\n\nCascSvc -> Gateway: 37. Return Success\nResponse\n{cascaded: true,\nkpisCreated: 4,\nusersAssigned: 47,\ntotalWeight: 100%,\nweightedAvg: 91.5%,\nhierarchyDepth: 2}\n\nGateway -> Frontend: 38. HTTP 200 OK\n\nFrontend -> SysAdmin: 39. Display Success\nMessage:\n\"KPI Cascaded Successfully!\"\nShow Summary:\n- 4 KPIs created\n- 47 users assigned\n- Hierarchy validated\n\nalt Performance Aggregation\n  DB -> DB: 40a. During Performance\n  Aggregation:\n  Calculate Weighted Score\n  = (KPI-1001-ENG_score × 0.40) +\n    (KPI-1001-SCI_score × 0.35) +\n    (KPI-1001-HUM_score × 0.25)\n  \n  Example:\n  - Engg achieved: 96% (weight 40%)\n  - Sciences achieved: 88% (weight 35%)\n  - Humanities achieved: 85% (weight 25%)\n  = (96×0.4) + (88×0.35) + (85×0.25)\n  = 38.4 + 30.8 + 21.25\n  = 90.45% → Org KPI Status: MET ✓\nend

note over SysAdmin, Logger
  **Hierarchical KPI Cascading**:

  Structure:
  Organization (KPI: 90%)
    ├─ Academic Affairs (92%)
    │  ├─ Engineering (95%, weight: 40%)
    │  ├─ Sciences (90%, weight: 35%)
    │  └─ Humanities (88%, weight: 25%)
    └─ Administration (N/A)

  Weighted Calculation:
  Org KPI Score = 91.5% (when all children achieved targets)

  Individual Assignment:
  - Each unit member gets unit KPI
  - Individual targets adjusted by role
  - Performance rolls up to parent level
  - Bottlenecks identified at each level

  Use Cases:
  1. Strategic objective cascading
  2. Department-level planning
  3. Unit coordination
  4. Individual accountability
  5. Performance prediction
end note
@enduml
```

---

## Summary of All Collaboration Diagrams

| #   | Diagram Name                   | Purpose                                      | Key Users          | Flow Steps |
| --- | ------------------------------ | -------------------------------------------- | ------------------ | ---------- |
| 1   | Authentication & Authorization | User login and permission validation         | Users, Admins      | 20 steps   |
| 2   | KPI Assignment & Allocation    | Bulk KPI assignment to users                 | Admins, Managers   | 30 steps   |
| 3   | Evidence Submission & Tracking | Evidence upload and approval workflow        | Faculty, Approvers | 46 steps   |
| 4   | Role-Based Access Control      | Permission validation and access enforcement | All Users          | 23 steps   |
| 5   | Real-time Chat & Feedback      | Instant messaging and notifications          | All Users          | 33 steps   |
| 6   | Dashboard Generation           | Performance metrics and visualization        | All Users          | 33 steps   |
| 7   | KPI Cycle Management           | Annual cycle planning and quarterly tracking | Admins             | 40+ steps  |
| 8   | Hierarchical KPI Cascade       | Multi-level KPI distribution                 | Admins, Managers   | 40+ steps  |

---

## Implementation Notes

### Technologies Used

- **Frontend**: React + Vite
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL
- **Real-time**: Socket.IO WebSockets
- **Cache**: Redis (optional)
- **File Storage**: Local filesystem or Cloud storage

### Key Design Patterns

- **MVC Architecture**: Models, Controllers, Services
- **Middleware Pattern**: Authentication, validation, error handling
- **Observer Pattern**: Real-time notifications
- **Strategy Pattern**: Multiple calculation methods for metrics
- **Factory Pattern**: User creation based on roles

### Performance Considerations

- Cache dashboard data to reduce database queries
- Batch insert operations for bulk assignments
- Lazy load chat history (paginated)
- Index frequently queried columns (userId, kpiId, cycleId)
- Consider denormalization for reporting queries

### Security Best Practices

- Validate all inputs server-side
- Use JWT for stateless authentication
- Hash passwords with bcrypt
- Implement rate limiting on API endpoints
- Audit log all sensitive operations
- Encrypt sensitive data at rest
  Gateway -> Frontend: 15. Return KPI List
  Frontend -> User: 16. Display KPI Assignment Table

note over User, Storage
=== Performance Submission Flow ===
end note

User -> Frontend: 17. Click Submit Performance
Frontend -> Frontend: 18. Open Performance Modal
User -> Frontend: 19. Enter Performance Value & Evidence
Frontend -> Gateway: 20. POST /api/user-kpi-results
Gateway -> KPI: 21. Validate Performance Data
KPI -> DB: 22. Check KPI Evidence Requirements
DB -> KPI: 23. Return KPI Details
User -> Frontend: 24. Upload Evidence File
Frontend -> Storage: 25. Upload File (Multipart)
Storage -> Storage: 26. Store File & Generate URL
Storage -> Frontend: 27. Return File URL

note over User, Storage
=== Evidence Storage ===
end note

Frontend -> Gateway: 28. Submit Result with Evidence URL
Gateway -> KPI: 29. Create UserKPIResult Record
KPI -> DB: 30. INSERT Result with EvidenceURL
DB -> KPI: 31. Success Confirmation
KPI -> Gateway: 32. Return Result ID
Gateway -> Frontend: 33. Show Success Message
Frontend -> User: 34. Update UI with New Result

note over User, Storage
=== Chat Communication Flow ===
end note

User -> Frontend: 35. Open Chat Channel
Frontend -> Gateway: 36. GET /api/chat/channels/:id
Gateway -> Chat: 37. Fetch Channel Messages
Chat -> DB: 38. Query ChatMessage Records
DB -> Chat: 39. Return Messages
Chat -> Gateway: 40. Format Response
Gateway -> Frontend: 41. Return Messages
Frontend -> User: 42. Display Chat History

User -> Frontend: 43. Type Message
Frontend -> Gateway: 44. POST /api/chat/messages
Gateway -> Chat: 45. Create Message Record
Chat -> DB: 46. INSERT ChatMessage
DB -> Chat: 47. Success Confirmation
Chat -> Chat: 48. Broadcast to Connected Clients (WebSocket)
Chat -> Frontend: 49. Real-time Message Update
Frontend -> User: 50. Display Message Immediately

@enduml

````

---

## 1.2 Mermaid Collaboration Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Frontend<br/>(Vue/React)
    participant Gateway as API Gateway<br/>(Express)
    participant Auth as Auth Service
    participant KPI as KPI Service
    participant Chat as Chat Service
    participant DB as PostgreSQL
    participant Storage as File Storage

    rect rgb(200, 230, 255)
    Note over User,Storage: Authentication & Session
    User->>Frontend: Open Application
    Frontend->>Gateway: POST /auth/login
    Gateway->>Auth: Validate Credentials
    Auth->>DB: Query User & UserRoles
    DB-->>Auth: User + Roles Data
    Auth->>Gateway: Generate JWT Token
    Gateway-->>Frontend: Token + User Profile
    Frontend-->>User: Authenticated Dashboard
    end

    rect rgb(200, 255, 230)
    Note over User,Storage: KPI Assignment Display
    User->>Frontend: View Assigned KPIs
    Frontend->>Gateway: GET /api/user-kpis
    Gateway->>KPI: Fetch UserKPI Records
    KPI->>DB: Query UserKPI + KPI Details
    DB-->>KPI: Return Data with Relations
    KPI-->>Gateway: Format Response
    Gateway-->>Frontend: KPI List
    Frontend-->>User: Display KPI Table
    end

    rect rgb(255, 240, 200)
    Note over User,Storage: Performance Submission
    User->>Frontend: Submit Performance Result
    Frontend->>Frontend: Open Modal Form
    User->>Frontend: Enter Value & Select Evidence
    Frontend->>Storage: Upload Evidence File
    Storage->>Storage: Store File
    Storage-->>Frontend: File URL
    Frontend->>Gateway: POST /api/user-kpi-results
    Gateway->>KPI: Validate Result Data
    KPI->>DB: Check KPI Requirements
    DB-->>KPI: KPI Config
    KPI->>DB: INSERT UserKPIResult
    DB-->>KPI: Confirmation
    KPI-->>Gateway: Result Created
    Gateway-->>Frontend: Success
    Frontend-->>User: Result Saved
    end

    rect rgb(255, 200, 200)
    Note over User,Storage: Real-time Chat
    User->>Frontend: Open Chat Channel
    Frontend->>Gateway: GET /api/chat/channels/:id
    Gateway->>Chat: Fetch Messages
    Chat->>DB: Query ChatMessages
    DB-->>Chat: Messages
    Chat-->>Gateway: Formatted Messages
    Gateway-->>Frontend: Messages
    Frontend-->>User: Display Chat

    User->>Frontend: Type & Send Message
    Frontend->>Gateway: POST /api/chat/messages
    Gateway->>Chat: Create Message
    Chat->>DB: INSERT ChatMessage
    DB-->>Chat: Confirmation
    Chat->>Chat: WebSocket Broadcast
    Chat-->>Frontend: Real-time Update
    Frontend-->>User: Message Appears
    end
````

---

## 2. Deployment Diagram

### Overview

The deployment diagram shows how the system components are distributed across different environments (Development, Staging, Production).

---

## 2.1 PlantUML Deployment Diagram

```plantuml
@startuml AMU-KPI-Deployment

!theme plain
skinparam backgroundColor #FFFFFF
skinparam componentBackgroundColor #E1F5FE
skinparam componentBorderColor #0277BD
skinparam nodeBackgroundColor #FFF9C4
skinparam nodeBorderColor #F57F17

package "Client Tier" {
    node "Client Devices" as Clients {
        component [Web Browser\n(Chrome/Firefox/Edge)] as Browser
    }
}

package "Network" {
    component [HTTPS/WebSocket\nCommunication] as Network
}

package "Production Server" {
    node "Web Server" as WebServer {
        component [Node.js Runtime] as NodeJS
        component [Express Server\n(Port 5000)] as Express
    }

    node "Application Services" as AppServices {
        component [Authentication\nService] as AuthSvc
        component [KPI Management\nService] as KPISvc
        component [Chat Service\n(Socket.io)] as ChatSvc
        component [File Upload\nService] as UploadSvc
    }

    node "Cache Layer" as Cache {
        component [Redis Cache\n(Session/Query Cache)] as Redis
    }

    node "Database Server" as DBServer {
        component [PostgreSQL\nDatabase] as PostgreSQL
        component [Connection Pool] as ConnPool
    }

    node "File Storage" as FileStorage {
        component [Evidence Files\nRepository] as EvidenceRepo
        component [KPI Documents\nRepository] as DocRepo
    }
}

package "External Services" {
    node "Email Service" as EmailSvc {
        component [Email Notifications\n(SMTP)] as SMTP
    }

    node "Cloud Storage" as CloudStorage {
        component [AWS S3/Google Cloud\nStorage (Optional)] as CloudStore
    }
}

package "Development/Staging" {
    node "Dev Environment" as DevEnv {
        component [Local PostgreSQL] as DevDB
        component [Local Node Server] as DevServer
    }
}

package "Monitoring & Logging" {
    node "Logging Server" as Logging {
        component [Application Logs] as AppLogs
        component [Error Tracking\n(Sentry/etc)] as ErrorTracking
    }
}

Clients --> Browser
Browser --> Network
Network --> Express

Express --> AuthSvc
Express --> KPISvc
Express --> ChatSvc
Express --> UploadSvc

AuthSvc --> Redis
AuthSvc --> PostgreSQL

KPISvc --> PostgreSQL
KPISvc --> Redis
KPISvc --> EvidenceRepo

ChatSvc --> PostgreSQL
ChatSvc --> Redis

UploadSvc --> EvidenceRepo
UploadSvc --> DocRepo
UploadSvc --> CloudStore

PostgreSQL --> ConnPool
PostgreSQL --> Logging

ChatSvc --> SMTP
AuthSvc --> SMTP

Express --> Logging
Express --> ErrorTracking

DevEnv --> DevDB
DevEnv --> DevServer

legend
  |<#E1F5FE> Components in Use |
  |<#FFF9C4> Servers/Nodes |
  |<#FFE0B2> External Services |
endlegend

@enduml
```

---

## 2.2 Mermaid Deployment Diagram

```mermaid
graph TB
    subgraph Client["🖥️ Client Tier"]
        Browser["Web Browser<br/>(Chrome/Firefox/Safari)"]
    end

    subgraph Network["🌐 Network Layer"]
        HTTPS["HTTPS/WebSocket<br/>Secure Communication"]
    end

    subgraph Prod["🚀 Production Environment"]
        subgraph WebTier["Web Server Tier"]
            NodeJS["Node.js Runtime<br/>(v18+)"]
            Express["Express Server<br/>(Port 5000)"]
        end

        subgraph AppTier["Application Services Tier"]
            Auth["Authentication<br/>Service"]
            KPI["KPI Management<br/>Service"]
            Chat["Chat Service<br/>(Socket.io)"]
            Upload["File Upload<br/>Service"]
        end

        subgraph Cache["Cache Layer"]
            Redis["Redis Cache<br/>(Sessions/Query Cache)"]
        end

        subgraph DB["Data Layer"]
            PostgreSQL["PostgreSQL<br/>Database"]
            ConnPool["Connection Pool<br/>(Sequelize)"]
        end

        subgraph Storage["Storage Layer"]
            LocalStorage["Local Storage<br/>(Evidence/Docs)"]
        end
    end

    subgraph External["☁️ External Services"]
        Email["Email Service<br/>(SMTP)"]
        CloudStore["Cloud Storage<br/>(AWS S3/GCP)"]
    end

    subgraph Monitoring["📊 Monitoring & Logging"]
        Logs["Application Logs"]
        Errors["Error Tracking<br/>(Sentry)"]
    end

    subgraph Dev["👨‍💻 Development Environment"]
        DevDB["Local PostgreSQL"]
        DevServer["Local Node Server"]
    end

    Browser -->|HTTPS| HTTPS
    HTTPS -->|Request/Response| Express

    Express --> NodeJS
    Express --> Auth
    Express --> KPI
    Express --> Chat
    Express --> Upload

    Auth --> Redis
    Auth --> PostgreSQL
    Auth --> Email

    KPI --> PostgreSQL
    KPI --> Redis
    KPI --> LocalStorage

    Chat --> PostgreSQL
    Chat --> Redis
    Chat --> Email

    Upload --> LocalStorage
    Upload --> CloudStore

    PostgreSQL --> ConnPool
    PostgreSQL --> Logs

    Express --> Logs
    Express --> Errors

    Auth -.->|Query| DevDB
    KPI -.->|Sync| Dev

    style Browser fill:#E1F5FE
    style Express fill:#E1F5FE
    style PostgreSQL fill:#E1F5FE
    style Redis fill:#E1F5FE
    style Auth fill:#C8E6C9
    style KPI fill:#C8E6C9
    style Chat fill:#C8E6C9
    style Email fill:#FFE0B2
    style CloudStore fill:#FFE0B2
```

---

## 3. Component Interaction Diagram

### 3.1 PlantUML Component Diagram

```plantuml
@startuml AMU-KPI-Components

!theme plain
skinparam backgroundColor #FFFFFF
skinparam componentBackgroundColor #E1F5FE
skinparam componentBorderColor #0277BD

package "Frontend Application" {
    component [Vue.js / React\nApplication] as Frontend
    component [State Management\n(Redux/Pinia)] as StateM
    component [HTTP Client\n(Axios)] as HTTPClient
    component [WebSocket Client\n(Socket.io)] as WebSocket
}

package "Backend Services" {
    component [Express.js\nServer] as Express

    package "Core Services" {
        component [Auth Service\n(JWT/Passport)] as Auth
        component [KPI Service\n(Business Logic)] as KPI
        component [Chat Service\n(Real-time)] as Chat
        component [File Service\n(Multer)] as FileService
    }

    package "Data Layer" {
        component [Sequelize ORM] as ORM
        component [Database\nQueries] as DBQueries
    }

    package "Utilities" {
        component [Permission\nEngine] as PermEngine
        component [KPI Cycle\nManager] as CycleManager
        component [Token\nGenerator] as TokenGen
    }
}

package "Data Storage" {
    component [PostgreSQL\nDatabase] as PostgreSQL
    component [Redis\nCache] as Redis
    component [File\nStorage] as FileStorage
}

package "External Services" {
    component [Email\nService] as EmailService
    component [Cloud\nStorage] as CloudService
}

Frontend --> StateM : updates state
StateM --> HTTPClient : dispatches API calls
StateM --> WebSocket : dispatches events
HTTPClient --> Express : REST API calls

WebSocket --> Chat : WebSocket connection
WebSocket --> Express : hybrid protocol

Express --> Auth : route handler
Express --> KPI : route handler
Express --> Chat : route handler
Express --> FileService : route handler

Auth --> PermEngine : check permissions
Auth --> TokenGen : generate tokens
Auth --> ORM : query users/roles

KPI --> PermEngine : check permissions
KPI --> CycleManager : manage cycles
KPI --> ORM : query KPI data

Chat --> ORM : query messages
Chat --> Redis : cache messages

FileService --> FileStorage : store files
FileService --> CloudService : sync files

ORM --> PostgreSQL : SQL queries
ORM --> Redis : cache queries

Auth --> EmailService : send notifications
Chat --> EmailService : send notifications

PostgreSQL <--> Redis : cache invalidation

@enduml
```

---

## 3.2 Mermaid Component Diagram

```mermaid
graph LR
    subgraph Frontend["Frontend Layer"]
        Vue["Vue.js / React<br/>Components"]
        State["State Management<br/>(Redux/Pinia)"]
        HTTP["HTTP Client<br/>(Axios)"]
        Socket["WebSocket Client<br/>(Socket.io)"]
    end

    subgraph Backend["Backend Services Layer"]
        Express["Express.js<br/>Server"]
        Auth["Auth Service<br/>(JWT)"]
        KPI["KPI Service<br/>(Core Logic)"]
        Chat["Chat Service<br/>(Real-time)"]
        File["File Service<br/>(Multer)"]
    end

    subgraph Data["Data Layer"]
        ORM["Sequelize ORM"]
        DB["PostgreSQL"]
        Cache["Redis Cache"]
        Storage["File Storage"]
    end

    subgraph Utils["Utilities & Helpers"]
        Perm["Permission<br/>Engine"]
        Cycle["KPI Cycle<br/>Manager"]
        Token["Token<br/>Generator"]
    end

    subgraph External["External Services"]
        Email["Email Service<br/>(SMTP)"]
        Cloud["Cloud Storage<br/>(S3/GCP)"]
    end

    Vue -->|Interact| State
    State -->|Dispatch| HTTP
    State -->|Dispatch| Socket
    HTTP -->|API Calls| Express
    Socket -->|Events| Chat

    Express -->|Route| Auth
    Express -->|Route| KPI
    Express -->|Route| Chat
    Express -->|Route| File

    Auth -->|Check| Perm
    Auth -->|Generate| Token
    Auth -->|Query| ORM

    KPI -->|Check| Perm
    KPI -->|Manage| Cycle
    KPI -->|Query| ORM

    Chat -->|Query| ORM
    Chat -->|Cache| Cache

    File -->|Store| Storage
    File -->|Sync| Cloud

    ORM -->|SQL| DB
    ORM -->|Cache| Cache

    Auth -->|Notify| Email
    Chat -->|Notify| Email

    File -->|Upload| Cloud
```

---

## 4. User Workflow Deployment

### 4.1 System Admin Flow

```
System Admin
    ↓
[Manage Roles & Permissions]
    ↓
Role Service → Permission Engine
    ↓
PostgreSQL (Update Roles)
    ↓
Redis (Invalidate Cache)
    ↓
Permissions Updated for All Users
```

### 4.2 Department Chair Flow

```
Department Chair
    ↓
[Create/Assign KPIs]
    ↓
KPI Service → Permission Check
    ↓
Validate KPI Data
    ↓
PostgreSQL (Create KPI/UserKPI)
    ↓
Chat Service → Send Notifications
    ↓
Email Service → Notify Users
    ↓
Users Receive KPI Assignment
```

### 4.3 User Performance Submission Flow

```
Assigned User
    ↓
[View Assigned KPI]
    ↓
KPI Service → Fetch UserKPI
    ↓
[Submit Performance + Evidence]
    ↓
File Service → Upload Evidence
    ↓
Store in File Storage
    ↓
Get File URL
    ↓
Create UserKPIResult Record
    ↓
PostgreSQL (Insert Result)
    ↓
Chat Notification → Other Users
    ↓
Result Visible in Dashboard
```

### 4.4 Real-time Chat Flow

```
User Types Message
    ↓
Frontend → Chat Service (Socket.io)
    ↓
Validate Message
    ↓
PostgreSQL (Insert ChatMessage)
    ↓
Redis (Cache Message)
    ↓
WebSocket Broadcast to Channel Members
    ↓
All Connected Users Receive Message in Real-time
```

---

## 5. Scaling Architecture

### Horizontal Scaling Strategy

```
Load Balancer (Nginx/HAProxy)
    ↓
    ├─→ Node Server Instance 1 (Port 5000)
    ├─→ Node Server Instance 2 (Port 5001)
    ├─→ Node Server Instance 3 (Port 5002)
    └─→ Node Server Instance N

All Instances Share:
    ├─ PostgreSQL Database (Replicated)
    ├─ Redis Cluster (Session/Cache)
    ├─ Shared File Storage (NFS/S3)
    └─ Message Queue (For async tasks)
```

### Database Replication

```
Primary PostgreSQL
    ↓ (Streaming Replication)
Replica PostgreSQL (Read-only)

Write Operations → Primary
Read Operations → Primary or Replica
```

### Session Management

```
User Login → JWT Token (Stateless)
    ↓
Redis Session Store (Optional, for token blacklist)
    ↓
All Servers Can Verify Token
```

---

## 6. Disaster Recovery & Backup

### Backup Strategy

- **Database Backups**: Daily incremental, weekly full backups
- **File Storage**: Replicated to cloud storage (AWS S3/Google Cloud)
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 1 hour

### High Availability

- Database replication with automatic failover
- Multiple application server instances
- Load balancing across servers
- Session persistence via Redis

---

## 7. Security in Deployment

### Network Security

- HTTPS/TLS for all communications
- WebSocket Secure (WSS) for chat
- CORS configuration
- Rate limiting on API endpoints

### Application Security

- JWT authentication with expiration
- Password hashing (bcrypt)
- SQL injection prevention (Parameterized queries)
- XSS protection (Content Security Policy)
- CSRF tokens for state-changing operations

### Data Security

- Encrypted file storage
- Sensitive data fields encrypted at rest
- Access logs and audit trails
- Role-based access control (RBAC)

---

## 8. Infrastructure Requirements

### Development Environment

- Node.js v18+
- PostgreSQL 12+
- Redis 6+
- 4GB RAM minimum
- 20GB storage

### Production Environment

- Node.js v18+ (Multiple instances)
- PostgreSQL 12+ (with replication)
- Redis 6+ (Cluster mode)
- 16GB+ RAM per instance
- 100GB+ storage (with backups)
- Load balancer (Nginx/HAProxy)
- SSL certificate

### Monitoring Stack

- Application Performance Monitoring (APM)
- Log aggregation (ELK Stack / Datadog)
- Alerting system
- Health check endpoints
- Database monitoring
