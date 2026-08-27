-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "enum_KPIYearPlans_Status" AS ENUM ('ACTIVE', 'LOCKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "enum_KPIs_LifecycleType" AS ENUM ('RECURRING', 'PROGRESSIVE', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "enum_Notifications_Priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "enum_UserKPIResults_Status" AS ENUM ('pending', 'approved', 'adjusted');

-- CreateTable
CREATE TABLE "AuditLogs" (
    "Id" UUID NOT NULL,
    "UserId" UUID,
    "Action" VARCHAR(255) NOT NULL,
    "Resource" VARCHAR(255),
    "Description" TEXT,
    "Status" VARCHAR(255) DEFAULT 'Success',
    "IpAddress" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AuditLogs_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ContactMessages" (
    "Id" UUID NOT NULL,
    "Username" VARCHAR(255) NOT NULL,
    "Email" VARCHAR(255) NOT NULL,
    "Subject" VARCHAR(255),
    "Message" TEXT NOT NULL,
    "Status" VARCHAR(255) NOT NULL DEFAULT 'Unread',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ContactMessages_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "KPIDocuments" (
    "Id" UUID NOT NULL,
    "UserId" UUID NOT NULL,
    "KPIId" UUID NOT NULL,
    "DOCTitle" VARCHAR(255) NOT NULL,
    "FileURL" VARCHAR(255) NOT NULL,
    "Remark" TEXT,
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,

    CONSTRAINT "KPIDocuments_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "KPITypes" (
    "Id" UUID NOT NULL,
    "KPIName" VARCHAR(255) NOT NULL,
    "ParentKPIID" UUID,
    "Description" TEXT,
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,

    CONSTRAINT "KPITypes_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "KPIYearPlans" (
    "Id" UUID NOT NULL,
    "KPIId" UUID NOT NULL,
    "CycleYear" VARCHAR(255) NOT NULL,
    "Baseline" DECIMAL(10,2) DEFAULT 0,
    "Target" DECIMAL(10,2) NOT NULL,
    "FinalPerformance" DECIMAL(10,2),
    "Status" "enum_KPIYearPlans_Status" DEFAULT 'ACTIVE',
    "IsLocked" BOOLEAN DEFAULT false,
    "CreatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "KPIYearPlans_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "KPIs" (
    "Id" UUID NOT NULL,
    "KPITypeId" UUID NOT NULL,
    "UnitId" UUID NOT NULL,
    "Weight" DECIMAL(5,2) NOT NULL,
    "Description" TEXT,
    "IsEvedenceRequired" BOOLEAN DEFAULT false,
    "Remark" TEXT,
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,
    "LifecycleType" "enum_KPIs_LifecycleType" NOT NULL DEFAULT 'RECURRING',
    "DefaultBaseline" DECIMAL(10,2) DEFAULT 0,
    "IsActive" BOOLEAN DEFAULT true,

    CONSTRAINT "KPIs_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Messages" (
    "Id" UUID NOT NULL,
    "SenderId" UUID NOT NULL,
    "ReceiverId" UUID NOT NULL,
    "Content" TEXT,
    "IsRead" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "FileUrl" VARCHAR(255),
    "FileName" VARCHAR(255),
    "FileType" VARCHAR(255),
    "Attachments" JSON,

    CONSTRAINT "Messages_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "Id" UUID NOT NULL,
    "RecipientUserId" UUID NOT NULL,
    "ActorUserId" UUID,
    "Type" VARCHAR(255),
    "Title" VARCHAR(255),
    "Message" TEXT,
    "Priority" "enum_Notifications_Priority" NOT NULL DEFAULT 'medium',
    "Data" JSONB,
    "IsRead" BOOLEAN NOT NULL DEFAULT false,
    "ReadAt" TIMESTAMPTZ(6),
    "CreatedAt" TIMESTAMPTZ(6),
    "IsArchived" BOOLEAN DEFAULT false,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "OfficeReportSubmissions" (
    "Id" UUID NOT NULL,
    "CycleYear" VARCHAR(255) NOT NULL,
    "SourceRoleId" UUID NOT NULL,
    "ParentRoleId" UUID NOT NULL,
    "ReportPayload" JSONB NOT NULL DEFAULT '{}',
    "SubmittedAt" TIMESTAMPTZ(6) NOT NULL,
    "SubmittedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,

    CONSTRAINT "OfficeReportSubmissions_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "RoleCategories" (
    "Id" UUID NOT NULL,
    "CategoryName" VARCHAR(255) NOT NULL,
    "Description" TEXT,
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,

    CONSTRAINT "RoleCategories_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Roles" (
    "Id" UUID NOT NULL,
    "RoleCategoryId" UUID,
    "RoleName" VARCHAR(255) NOT NULL,
    "ParentRoleId" UUID,
    "Description" TEXT,
    "HasExtraMeasures" BOOLEAN DEFAULT false,
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,
    "Permissions" JSONB,
    "PermissionVersion" INTEGER NOT NULL DEFAULT 0,
    "IsDistributable" BOOLEAN DEFAULT true,

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "Id" UUID NOT NULL,
    "Key" VARCHAR(255) NOT NULL,
    "Value" TEXT,
    "Type" VARCHAR(255) DEFAULT 'string',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Units" (
    "Id" UUID NOT NULL,
    "Name" VARCHAR(255) NOT NULL,
    "Code" VARCHAR(255) NOT NULL,
    "Description" TEXT,
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,

    CONSTRAINT "Units_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "UserActivityLogs" (
    "Id" UUID NOT NULL,
    "UserId" UUID NOT NULL,
    "ActivityDate" DATE NOT NULL,
    "LastActiveAt" TIMESTAMPTZ(6),

    CONSTRAINT "UserActivityLogs_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "UserKPIResults" (
    "Id" UUID NOT NULL,
    "KPIId" UUID NOT NULL,
    "UserId" UUID NOT NULL,
    "KPIResult" VARCHAR(255) NOT NULL,
    "Description" TEXT,
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,
    "CycleYear" VARCHAR(255) NOT NULL,
    "Quarter" VARCHAR(255) NOT NULL,
    "PerformanceTitle" VARCHAR(255),
    "EvidenceURL" VARCHAR(255),
    "UserKPIId" UUID,
    "Status" "enum_UserKPIResults_Status" NOT NULL DEFAULT 'pending',
    "AdjustedResult" VARCHAR(255),
    "ApproverRemark" TEXT,

    CONSTRAINT "UserKPIResults_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "UserKPIs" (
    "Id" UUID NOT NULL,
    "KPIId" UUID NOT NULL,
    "UserId" UUID NOT NULL,
    "Remark" TEXT,
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,
    "CycleYear" VARCHAR(255) NOT NULL,
    "Baseline" DECIMAL(10,2),
    "AssignedTarget" DECIMAL(10,2),
    "IsTargetIndividual" BOOLEAN NOT NULL DEFAULT false,
    "IncludeCurrentOffice" BOOLEAN NOT NULL DEFAULT false,
    "AssignmentBatchId" UUID,
    "Name" VARCHAR(255),
    "KPIYearPlanId" UUID,

    CONSTRAINT "UserKPIs_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "UserRoles" (
    "Id" UUID NOT NULL,
    "UserId" UUID NOT NULL,
    "RoleId" UUID NOT NULL,
    "FromDate" TIMESTAMPTZ(6) NOT NULL,
    "ToDate" TIMESTAMPTZ(6),
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,

    CONSTRAINT "UserRoles_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Users" (
    "Id" UUID NOT NULL,
    "FirstName" VARCHAR(255) NOT NULL,
    "FatherName" VARCHAR(255) NOT NULL,
    "GrandFatherName" VARCHAR(255) NOT NULL,
    "Email" VARCHAR(255) NOT NULL,
    "UserName" VARCHAR(255) NOT NULL,
    "Phone" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6),
    "CreatedBy" UUID,
    "IsArchived" BOOLEAN DEFAULT false,
    "LastActiveAt" TIMESTAMPTZ(6),
    "ProfilePicture" VARCHAR(255),

    CONSTRAINT "Users_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "notifications__recipient_user_id__is_archived__created_at" ON "Notifications"("RecipientUserId", "IsArchived", "CreatedAt");

-- CreateIndex
CREATE INDEX "notifications__recipient_user_id__is_read__is_archived" ON "Notifications"("RecipientUserId", "IsRead", "IsArchived");

-- CreateIndex
CREATE INDEX "notifications__type" ON "Notifications"("Type");

-- CreateIndex
CREATE UNIQUE INDEX "RoleCategories_CategoryName_key" ON "RoleCategories"("CategoryName");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_Key_key" ON "SystemSettings"("Key");

-- CreateIndex
CREATE UNIQUE INDEX "Units_Code_key" ON "Units"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "user_activity_logs__user_id__activity_date" ON "UserActivityLogs"("UserId", "ActivityDate");

-- CreateIndex
CREATE UNIQUE INDEX "Users_Email_key" ON "Users"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "Users_UserName_key" ON "Users"("UserName");

-- AddForeignKey
ALTER TABLE "AuditLogs" ADD CONSTRAINT "AuditLogs_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIDocuments" ADD CONSTRAINT "KPIDocuments_KPIId_fkey" FOREIGN KEY ("KPIId") REFERENCES "KPIs"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIDocuments" ADD CONSTRAINT "KPIDocuments_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPITypes" ADD CONSTRAINT "KPITypes_ParentKPIID_fkey" FOREIGN KEY ("ParentKPIID") REFERENCES "KPITypes"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIYearPlans" ADD CONSTRAINT "KPIYearPlans_KPIId_fkey" FOREIGN KEY ("KPIId") REFERENCES "KPIs"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIs" ADD CONSTRAINT "KPIs_KPITypeId_fkey" FOREIGN KEY ("KPITypeId") REFERENCES "KPITypes"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIs" ADD CONSTRAINT "KPIs_UnitId_fkey" FOREIGN KEY ("UnitId") REFERENCES "Units"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_ReceiverId_fkey" FOREIGN KEY ("ReceiverId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_SenderId_fkey" FOREIGN KEY ("SenderId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_ActorUserId_fkey" FOREIGN KEY ("ActorUserId") REFERENCES "Users"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_RecipientUserId_fkey" FOREIGN KEY ("RecipientUserId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roles" ADD CONSTRAINT "Roles_ParentRoleId_fkey" FOREIGN KEY ("ParentRoleId") REFERENCES "Roles"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roles" ADD CONSTRAINT "Roles_RoleCategoryId_fkey" FOREIGN KEY ("RoleCategoryId") REFERENCES "RoleCategories"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivityLogs" ADD CONSTRAINT "UserActivityLogs_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKPIResults" ADD CONSTRAINT "UserKPIResults_KPIId_fkey" FOREIGN KEY ("KPIId") REFERENCES "KPIs"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKPIResults" ADD CONSTRAINT "UserKPIResults_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKPIResults" ADD CONSTRAINT "UserKPIResults_UserKPIId_fkey" FOREIGN KEY ("UserKPIId") REFERENCES "UserKPIs"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKPIs" ADD CONSTRAINT "UserKPIs_KPIId_fkey" FOREIGN KEY ("KPIId") REFERENCES "KPIs"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKPIs" ADD CONSTRAINT "UserKPIs_KPIYearPlanId_fkey" FOREIGN KEY ("KPIYearPlanId") REFERENCES "KPIYearPlans"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKPIs" ADD CONSTRAINT "UserKPIs_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoles" ADD CONSTRAINT "UserRoles_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "Roles"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoles" ADD CONSTRAINT "UserRoles_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
