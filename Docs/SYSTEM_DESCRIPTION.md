# AMU-KPI-Monitoring-System - Detailed System Description

## 1. Executive Summary

The **AMU-KPI-Monitoring-System** is a comprehensive web-based Key Performance Indicator (KPI) management and monitoring platform designed for organizational performance tracking. The system enables institutions to define, allocate, track, and evaluate KPIs across different organizational hierarchies, departments, and individual roles. It provides real-time performance monitoring, evidence submission capabilities, and integrated communication features to support collaborative performance management.

---

## 2. System Purpose & Objectives

### Primary Objectives

1. **Centralized KPI Management**: Create a single source of truth for all organizational KPIs
2. **Performance Tracking**: Monitor and track KPI achievement across organizational levels
3. **Evidence Management**: Collect and store performance evidence for accountability
4. **Role-Based Access Control**: Ensure appropriate visibility and control based on user roles
5. **Real-Time Collaboration**: Enable seamless communication regarding KPI performance and feedback
6. **Cycle Management**: Support annual KPI cycles with quarterly tracking and reporting

### Key Benefits

- **Transparency**: Clear visibility of performance targets and achievements
- **Accountability**: Documented evidence of KPI accomplishment
- **Data-Driven Decisions**: Comprehensive dashboards for performance analysis
- **Efficient Communication**: Integrated chat system for KPI-related discussions
- **Scalability**: Supports organizational growth with hierarchical role structures

---

## 3. Core System Components

### 3.1 Authentication & Authorization Module

**Purpose**: Secure user access and manage permissions

**Features**:

- User registration and login with email/username
- JWT token-based authentication
- Session management with token expiration
- Password hashing with bcrypt for security
- Role-based access control (RBAC)

**Key Entities**:

- **User**: System users with personal information and credentials
- **Role**: Defines permissions and access levels (System Admin, Department Chair, Faculty, Staff)
- **RoleCategory**: Categorizes roles for organizational structure
- **UserRole**: Maps users to roles with date-based activation/archiving

**Workflows**:

```
1. User registers with email, username, phone, and names (First/Father/GrandFather)
2. System hashes password and stores user record
3. User logs in with credentials
4. System validates credentials and generates JWT token
5. Frontend stores token for subsequent authenticated requests
6. Token validated on each request to verify user identity and permissions
7. System determines primary role (System Admin > Others > Latest Created)
8. User gains access based on role permissions
```

---

### 3.2 KPI Management Module

**Purpose**: Define, categorize, and manage Key Performance Indicators

**Features**:

- Create and organize KPIs with hierarchical structure
- Define measurement units and target/baseline values
- Attach supporting documents to KPIs
- Link KPIs to organizational units and roles
- Archive KPIs for historical record keeping

**Key Entities**:

- **KPI**: Individual performance indicators with targets, baselines, and weights
- **KPIType**: Hierarchical categorization of KPIs (Parent-Child relationships)
- **Unit**: Measurement units (%, Count, Amount, Days, etc.)
- **KPIDocument**: Supporting documentation for KPIs

**Attributes Explained**:

- `Weight`: Importance percentage (0-100) of KPI relative to others
- `Baseline`: Historical or reference performance level
- `Target`: Expected or desired performance level
- `IsEvedenceRequired`: Boolean flag indicating if physical proof is needed
- `Remark`: Additional notes or contextual information

**Workflows**:

```
1. System Administrator creates KPI in system
2. Assigns KPI Type (e.g., Financial, Operational, Strategic)
3. Sets measurement Unit (e.g., Percentage, Count)
4. Defines Baseline (current state) and Target (goal)
5. Optionally marks as requiring evidence
6. Uploads supporting documents if applicable
7. KPI becomes available for assignment to users/roles
8. During active KPI cycle, KPI can be assigned to users
9. After cycle ends, KPI archived but retained for historical analysis
```

---

### 3.3 KPI Allocation & Assignment Module

**Purpose**: Assign KPIs to users and track their performance targets

**Features**:

- Allocate KPIs to individual users or roles
- Customize baseline and target values per user
- Support batch assignments with tracking ID
- Manage assignment metadata (remarks, names)
- Track assignment history and modifications
- Support for office-level or individual-level targets

**Key Entities**:

- **UserKPI**: Assignment of KPI to a user with custom parameters
- **UserKPIResult**: Individual performance results submitted by users

**Attributes Explained**:

- `CycleYear`: Annual KPI cycle (e.g., "2024", "2025")
- `Baseline`: User-specific baseline (may differ from KPI baseline)
- `AssignedTarget`: User-specific target (may differ from KPI target)
- `IsTargetIndividual`: Whether target is individual or office-wide
- `IncludeCurrentOffice`: Include current office in calculations
- `AssignmentBatchId`: UUID grouping related assignments
- `Remark`: Assignment-specific notes

**Workflows**:

```
1. Department Chair/Manager navigates to KPI Allocation
2. Selects KPI from available pool
3. Customizes Baseline and Target for specific user/role
4. Selects target recipient (user or role group)
5. Adds remarks or special instructions
6. Submits assignment (POST /api/user-kpis)
7. System creates UserKPI record with all details
8. Assigned user receives notification via chat
9. User can see assigned KPI in "Assigned KPIs" tab
10. User can edit assignment (if permissions allow)
11. User can delete assignment (if creator or has permission)
12. Assignment appears in "Sent KPI Tracker" for manager review
```

---

### 3.4 Performance Result Submission Module

**Purpose**: Collect and track actual KPI performance results

**Features**:

- Submit performance results with quantitative values
- Attach evidence (files, URLs, documents)
- Support for quarterly result tracking
- Result history and modification tracking
- Evidence validation for compliance

**Key Entities**:

- **UserKPIResult**: Performance result submission
  - `KPIResult`: Actual value achieved (string or numeric)
  - `PerformanceTitle`: Title/description of submission
  - `EvidenceURL`: Link to evidence (file or external document)
  - `Description`: Additional details about the result
  - `Quarter`: Tracking by quarters (Q1, Q2, Q3, Q4)

**Key Features**:

- **Evidence Support**: If KPI requires evidence (`IsEvedenceRequired = true`), user must upload file
- **File Storage**: Evidence stored locally or cloud (AWS S3, Google Cloud)
- **URL Support**: Direct link submission for online documents/dashboards
- **Quarterly Tracking**: Results tracked per quarter for detailed analysis
- **Audit Trail**: All submissions timestamped and linked to submitting user

**Workflows**:

```
1. User navigates to "Assigned KPIs" section
2. Clicks "Edit" on assigned KPI
3. Performance Submission modal opens
4. User sees KPI details: Name, Baseline, Target, IsEvedenceRequired flag
5. User enters "Actual Performance Value" achieved
6. User enters "Performance Title" (e.g., "Q1 2024 Results")
7. If IsEvedenceRequired = true:
   - User uploads evidence file (PDF, Image, Document)
   - OR provides evidence URL (Google Drive, SharePoint)
   - System validates file/URL
   - File stored with generated URL
8. If IsEvedenceRequired = false:
   - User can optionally attach evidence
9. User submits form (POST /api/user-kpi-results)
10. System validates:
    - KPI exists and is active
    - User has assignment (UserKPI record)
    - If evidence required, evidence URL present
11. System creates UserKPIResult record
12. Result appears in user's Dashboard
13. Performance visible to supervisors in Reports
14. Optional: Chat notification sent to relevant stakeholders
```

---

### 3.5 Role-Based Access Control Module

**Purpose**: Implement fine-grained permission system

**Features**:

- Define roles with specific permissions
- Support role hierarchies (Parent-Child)
- Permission versioning for audit trails
- Archive roles while maintaining history
- Flexible permission distribution

**Permissions System**:

```
Permission Types:
- create_kpi: Create new KPIs
- edit_kpi: Modify existing KPIs
- delete_kpi: Archive/delete KPIs
- create_kpi_allocation: Assign KPIs to users
- edit_kpi_allocation: Modify existing assignments
- delete_kpi_allocation: Remove KPI assignments
- view_performance_results: View user performance submissions
- create_user_role: Assign roles to users
- manage_user_roles: Manage all user role assignments
- manage_chat_channels: Create/moderate chat channels
- create_announcement: Send system announcements
- view_reports: Access dashboard and reports
```

**Permission Storage**:

- Permissions stored as JSONB in Role entity
- Format: `{"permission_name": true/false}`
- Example: `{"create_kpi": true, "edit_kpi": false, "view_performance_results": true}`

**Access Control Flow**:

```
1. User logs in → System determines primary role
2. Primary role loaded with permissions
3. For each action request:
   - Extract required permission from request
   - Check user's role permissions
   - If permission = true, allow action
   - If permission = false, deny with 403 Forbidden
4. Some actions check creator:
   - Users can edit/delete own assignments
   - Regardless of global permission settings
```

---

### 3.6 Chat & Collaboration Module

**Purpose**: Enable real-time communication about KPI performance

**Features** (NEW):

- Direct messages between users
- Group chat channels (role-based, office-based)
- Announcement channels (broadcast)
- Real-time message delivery via WebSocket
- File attachment support
- Message reactions (emoji)
- Message editing and deletion (soft delete)
- Muted channels (user can disable notifications)
- Member roles (Owner, Admin, Moderator, Member)

**Key Entities**:

- **ChatChannel**: Communication channel (Direct, Group, Announcement)
- **ChatMessage**: Individual message with content and metadata
- **ChannelMember**: Maps users to channels with roles
- **MessageAttachment**: Files attached to messages
- **MessageReaction**: Emoji reactions to messages

**Features**:

- **Channel Types**:
  - Direct: 1:1 private messaging
  - Group: Multiple participants (Department discussions, project teams)
  - Announcement: Broadcast (KPI updates, system notifications)

- **Real-Time Communication**:
  - WebSocket connection (Socket.io) for instant message delivery
  - Message appears immediately for sender
  - Broadcast to all channel members in real-time

- **File Sharing**:
  - Share KPI evidence, reports, documents
  - File uploaded to local or cloud storage
  - Link embedded in message

- **Reactions**:
  - Quick feedback with emoji (👍, ❤️, etc.)
  - Aggregate reaction counts

**Workflows**:

```
1. KPI RESULT DISCUSSION CHANNEL
   - Manager assigns KPI to user
   - Private group channel created: "KPI_[KPICode]_Team"
   - Manager, User, and Stakeholders added
   - User submits result
   - Channel message: "Performance submitted: 95%"
   - Stakeholders discuss result in channel
   - Manager provides feedback

2. DIRECT MESSAGE FOR CLARIFICATION
   - User has question about KPI
   - Opens direct chat with Manager
   - Sends message with screenshot
   - Manager responds with guidance
   - Real-time conversation flow

3. ANNOUNCEMENT CHANNEL
   - System Admin creates "KPI_Updates" announcement channel
   - Posts: "New KPI cycle starting: July 1, 2024"
   - All users see announcement
   - Users can react but not reply (readonly for members)

4. QUARTERLY REVIEW DISCUSSION
   - Department meeting to review Q1 results
   - Group channel "Q1_2024_Review" created
   - Multiple users share results
   - Department Chair facilitates discussion
   - Summary shared in channel
   - Records maintained for audit
```

**Real-Time Flow**:

```
User A Types Message
    ↓
Frontend sends via Socket.io
    ↓
Chat Service receives (Socket connection)
    ↓
Validates message (length, permissions)
    ↓
Stores in PostgreSQL (ChatMessage record)
    ↓
Caches in Redis (quick retrieval)
    ↓
Broadcasts via WebSocket to channel subscribers
    ↓
User B receives message in real-time
    ↓
Message rendered immediately in chat interface
```

---

## 4. System Workflows & User Journeys

### 4.1 System Administrator Journey

**Objective**: Set up and manage system configuration

**Steps**:

```
1. System Admin logs in
2. Navigates to Admin Panel
3. Creates role categories (e.g., "Academic", "Administrative")
4. Creates roles within categories:
   - "System Admin" (all permissions)
   - "Department Chair" (manage KPIs in dept)
   - "Faculty" (submit performance)
5. Defines permissions for each role
6. Creates organizational units/departments
7. Bulk imports or manually creates users
8. Assigns users to initial roles
9. Creates announcement channels for system-wide comms
10. Monitors system health and user activity
```

### 4.2 Department Chair Journey

**Objective**: Create KPIs and allocate to team members

**Steps**:

```
1. Department Chair logs in
2. Views dashboard with team overview
3. Creates KPIs for department:
   - "Graduation Rate" (Unit: %)
   - "Research Publications" (Unit: Count)
   - "Student Satisfaction" (Unit: Score)
4. Sets baselines and targets
5. Uploads supporting documents
6. Navigates to KPI Allocation tab
7. Bulk assigns KPIs to faculty members:
   - Select KPI
   - Choose recipients
   - Customize targets per faculty
   - Add remarks
   - Submit batch assignment
8. Monitors "Sent KPI Tracker":
   - Views all assignments sent
   - Can edit baseline/target if needed
   - Can delete assignments
9. Receives performance submissions from faculty
10. Reviews results in department dashboard
11. Provides feedback via chat
12. Generates quarterly reports
13. Archives completed KPIs
```

### 4.3 Faculty Member Journey

**Objective**: Receive KPIs and submit performance results

**Steps**:

```
1. Faculty logs in → Dashboard shows assigned KPIs
2. Reviews "Assigned KPIs" tab:
   - Sees KPI name, baseline, target, remark
   - Sees evidence requirement status
3. Clicks "Edit" on KPI to submit performance:
   - Views KPI details
   - Sees deadline (if set)
   - Opens Performance Modal
4. Submits quarterly results:
   - Enters actual value achieved
   - If evidence required: uploads document or provides URL
   - Enters performance title/description
   - Submits form
5. Participates in KPI discussion channel:
   - Sees feedback from department chair
   - Responds to questions
   - Shares supporting documents
   - Receives real-time notifications
6. Views historical performance:
   - Sees trends over quarters
   - Compares actual vs target
   - Downloads evidence
7. Updates information as year progresses
```

### 4.4 Real-Time Collaboration Journey

**Scenario**: KPI Result Review with Chat Discussion

**Steps**:

```
1. Faculty submits Q1 KPI result (95% achievement)
2. System creates/posts in "KPI_Result_Review" group channel:
   - Message: "Faculty: Q1 results submitted - 95%"
   - Attachment: Evidence document
3. Department Chair receives notification
4. Opens chat channel
5. Reviews submission details
6. Provides feedback in channel:
   - "Great performance! Can you detail the methodology?"
7. Faculty responds in real-time:
   - "Used data from X, Y, Z sources"
   - Attaches detailed report
8. Other team members add reactions (👍)
9. Discussion captured for records
10. Department Chair marks result approved
11. Notification sent to Faculty
```

---

## 5. Technical Architecture

### 5.1 Frontend Architecture

**Technology Stack**:

- Framework: Vue.js or React
- State Management: Redux or Pinia
- HTTP Client: Axios
- WebSocket: Socket.io Client
- UI Components: Custom or Material Design
- Build Tool: Vite

**Key Modules**:

- **Authentication**: Login/Register pages, Session management
- **Dashboard**: Overview of KPIs, results, progress
- **KPI Management**: Create/Edit KPIs, manage metadata
- **KPI Allocation**: Assign KPIs, batch operations
- **Performance Tracking**: Submit results, view history
- **Chat Interface**: Real-time messaging, channels
- **Reports**: Charts, graphs, export functionality
- **User Management**: Admin interface for user/role management

### 5.2 Backend Architecture

**Technology Stack**:

- Runtime: Node.js v18+
- Framework: Express.js
- Database: PostgreSQL 12+
- ORM: Sequelize
- Authentication: JWT, Passport.js
- Real-time: Socket.io
- File Upload: Multer
- Email: Nodemailer

**Core Services**:

1. **Auth Service**: Login, registration, token generation
2. **KPI Service**: CRUD operations for KPIs, assignments
3. **Performance Service**: Result submission and tracking
4. **Chat Service**: Message management, real-time delivery
5. **File Service**: Upload, storage, retrieval
6. **Notification Service**: Email/chat notifications

### 5.3 Database Schema

**Core Tables**:

```
Users
├─ Id (UUID, PK)
├─ FirstName, FatherName, GrandFatherName
├─ Email (Unique)
├─ UserName (Unique)
├─ Phone
├─ password (Hashed)
└─ Metadata: CreatedAt, CreatedBy, IsArchived

Roles
├─ Id (UUID, PK)
├─ RoleName
├─ RoleCategory (FK)
├─ ParentRole (Self FK, for hierarchy)
├─ Permissions (JSONB)
└─ Metadata: CreatedAt, CreatedBy, IsArchived

UserRoles (Junction)
├─ Id (UUID, PK)
├─ UserId (FK)
├─ RoleId (FK)
├─ ToDate (Expiration)
└─ Metadata: CreatedAt, IsArchived

KPIs
├─ Id (UUID, PK)
├─ KPIType (FK)
├─ Unit (FK)
├─ Baseline, Target, Weight
├─ IsEvedenceRequired (Boolean)
└─ Metadata: CreatedAt, CreatedBy, IsArchived

UserKPIs
├─ Id (UUID, PK)
├─ KPI (FK)
├─ User (FK)
├─ CycleYear
├─ Baseline, AssignedTarget (Customizable)
├─ AssignmentBatchId (For grouping)
└─ Metadata: CreatedAt, CreatedBy, IsArchived

UserKPIResults
├─ Id (UUID, PK)
├─ UserKPI (FK)
├─ KPI (FK)
├─ User (FK)
├─ KPIResult (Actual value)
├─ PerformanceTitle
├─ EvidenceURL
├─ Quarter, CycleYear
└─ Metadata: CreatedAt, CreatedBy, IsArchived

ChatChannels
├─ Id (UUID, PK)
├─ ChannelName
├─ ChannelType (Direct, Group, Announcement)
├─ CreatedBy (FK to User)
└─ Metadata: CreatedAt, IsPrivate, IsArchived

ChatMessages
├─ Id (UUID, PK)
├─ Channel (FK)
├─ SenderUser (FK)
├─ MessageContent
├─ MessageType (Text, Image, File, System)
├─ IsEdited, IsDeleted
└─ Metadata: CreatedAt, UpdatedAt, DeletedAt

ChannelMembers (Junction)
├─ Id (UUID, PK)
├─ Channel (FK)
├─ User (FK)
├─ MemberRole (Owner, Admin, Moderator, Member)
├─ IsMuted
└─ JoinedAt, LastReadAt

MessageAttachments
├─ Id (UUID, PK)
├─ Message (FK)
├─ FileName, FileURL
├─ FileType, FileSize
└─ UploadedAt

MessageReactions
├─ Id (UUID, PK)
├─ Message (FK)
├─ User (FK)
├─ ReactionEmoji
└─ CreatedAt
```

---

## 6. Key Features & Capabilities

### 6.1 KPI Management Features

- ✅ Hierarchical KPI organization
- ✅ Flexible measurement units
- ✅ Custom baseline/target per assignment
- ✅ Evidence requirement tracking
- ✅ Supporting document attachments
- ✅ Soft-delete with archiving
- ✅ Audit trail (CreatedBy, timestamps)

### 6.2 Performance Tracking Features

- ✅ Quarterly result submission
- ✅ Evidence upload (local or cloud storage)
- ✅ Performance history tracking
- ✅ Individual vs office-level targets
- ✅ Batch assignment support
- ✅ Result modification with audit trail

### 6.3 Access Control Features

- ✅ Role-based permissions
- ✅ Role hierarchy support
- ✅ Permission versioning
- ✅ Creator-based access (user owns their assignments)
- ✅ Per-role customizable permissions

### 6.4 Chat & Collaboration Features

- ✅ Real-time messaging (Socket.io)
- ✅ Direct and group channels
- ✅ File attachments in messages
- ✅ Emoji reactions
- ✅ Message editing and deletion
- ✅ Muted channels
- ✅ Channel member roles
- ✅ Message history

### 6.5 Reporting & Analytics

- ✅ Dashboard with performance overview
- ✅ Quarterly performance trends
- ✅ Achievement vs target visualizations
- ✅ Department-level summaries
- ✅ Export to PDF/Excel
- ✅ Historical data analysis

---

## 7. Data Security & Privacy

### 7.1 Authentication Security

- Passwords hashed with bcrypt (salt rounds: 10)
- JWT tokens with expiration
- Token refresh mechanism
- Session timeout on inactivity

### 7.2 Authorization Security

- Role-based access control
- Permission-based endpoint protection
- User can only access own data (with admin override)
- Query-level filtering by user role

### 7.3 Data Protection

- HTTPS/TLS for all communications
- WSS (WebSocket Secure) for real-time comms
- SQL injection prevention (parameterized queries)
- XSS protection (output encoding)
- CSRF tokens for state-changing requests

### 7.4 Audit & Compliance

- All changes tracked (CreatedBy, CreatedAt, UpdatedAt)
- Soft deletes maintain historical record
- Chat messages retained (not truly deleted)
- Evidence preservation for accountability
- Activity logs for compliance reporting

---

## 8. System Scalability & Performance

### 8.1 Performance Optimizations

- Redis caching for frequently accessed data
- Database connection pooling
- Query optimization with indexes
- Pagination for large datasets
- Lazy loading in frontend

### 8.2 Horizontal Scaling

- Stateless API design (JWT tokens)
- Shared database (PostgreSQL replication)
- Shared session store (Redis)
- Shared file storage (NFS/S3)
- Load balancer for traffic distribution

### 8.3 High Availability

- Database failover with streaming replication
- Multiple API server instances
- Message queue for async tasks
- CDN for static assets
- Health check monitoring

---

## 9. Deployment & Operations

### 9.1 Development Environment

- Local Node.js server
- PostgreSQL on localhost
- Redis for caching
- Hot module reloading

### 9.2 Production Environment

- Multiple Node.js instances behind load balancer
- PostgreSQL with replication and backups
- Redis cluster for distributed caching
- Cloud storage (AWS S3 or Google Cloud)
- Monitoring and alerting
- Centralized logging

### 9.3 CI/CD Pipeline

- Code repository (Git)
- Automated testing
- Code quality checks (ESLint)
- Build optimization
- Automated deployment
- Smoke tests post-deployment

---

## 10. Future Enhancements

### Planned Features

1. **Advanced Analytics**: Machine learning for KPI trend prediction
2. **Mobile App**: Native iOS/Android applications
3. **Integration APIs**: Connect with external systems (ERP, HR)
4. **Advanced Reporting**: Custom report builder
5. **Workflow Automation**: Automated approvals based on thresholds
6. **Video Conferencing**: Integrated video calls for KPI discussions
7. **Multilingual Support**: Support for multiple languages
8. **Advanced Chat**: Threads, mentions, scheduled messages
9. **Performance Benchmarking**: Compare against industry standards
10. **Predictive Analytics**: Forecast KPI achievement based on trends

---

## 11. Success Metrics & KPIs for the System

### System Usage Metrics

- User adoption rate (% active users)
- Average session duration
- KPI submission rate
- Evidence submission rate
- Chat engagement level

### Performance Metrics

- Page load time (target: < 2s)
- API response time (target: < 500ms)
- Real-time message delivery latency (target: < 100ms)
- System uptime (target: 99.9%)

### Business Metrics

- KPI achievement rate across organization
- Improvement in performance transparency
- Reduction in performance review cycle time
- User satisfaction score

---

## 12. Support & Maintenance

### User Support

- In-app help documentation
- Chat support for urgent issues
- Email support for complex issues
- FAQ and troubleshooting guides

### System Maintenance

- Regular security updates
- Database optimization
- Backup verification
- Performance monitoring
- User feedback incorporation

### Version Management

- Semantic versioning (MAJOR.MINOR.PATCH)
- Changelog documentation
- Breaking change notifications
- Gradual feature rollout

---

## Conclusion

The **AMU-KPI-Monitoring-System** is a modern, scalable platform designed to streamline organizational performance management. By combining robust KPI tracking with real-time collaboration features, it enables institutions to achieve their strategic goals while maintaining transparency and accountability across all levels. The system's flexible architecture supports growth and future enhancements, making it a sustainable solution for long-term use.
