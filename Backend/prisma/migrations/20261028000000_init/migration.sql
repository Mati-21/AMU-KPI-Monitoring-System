-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "person" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "gender" TEXT,
    "birth_date" DATE,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_account" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enforced" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "mfa_type" TEXT NOT NULL DEFAULT 'totp',
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_type" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "level_order" INTEGER,

    CONSTRAINT "office_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office" (
    "id" UUID NOT NULL,
    "parent_office_id" UUID,
    "office_type_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "is_head" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_person" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "office_person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_person_role" (
    "id" UUID NOT NULL,
    "office_person_id" UUID NOT NULL,
    "role_id" INTEGER NOT NULL,
    "scope_office_id" UUID,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,

    CONSTRAINT "office_person_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_year" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',

    CONSTRAINT "fiscal_year_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_theme" (
    "id" UUID NOT NULL,
    "parent_theme_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "kpi_theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi" (
    "id" UUID NOT NULL,
    "kpi_theme_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit_of_measure" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'higher_is_better',
    "cascade_mode" TEXT NOT NULL DEFAULT 'split',
    "max_over_allocation_percent" DECIMAL(6,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_target" (
    "id" UUID NOT NULL,
    "fiscal_year_id" INTEGER NOT NULL,
    "kpi_id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "person_id" UUID,
    "assigned_by_person_id" UUID,
    "assigned_at" DATE,
    "parent_target_id" UUID,
    "baseline_value" DECIMAL(18,4),
    "target_value" DECIMAL(18,4) NOT NULL,
    "weight" DECIMAL(7,4) NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',

    CONSTRAINT "kpi_target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_cycle" (
    "id" UUID NOT NULL,
    "fiscal_year_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'planned',

    CONSTRAINT "eval_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_report" (
    "id" UUID NOT NULL,
    "eval_cycle_id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "submitted_by_person_id" UUID,
    "reviewed_by_person_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submission_type" TEXT DEFAULT 'normal',
    "auto_filled_count" INTEGER NOT NULL DEFAULT 0,
    "review_note" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_evaluation" (
    "id" UUID NOT NULL,
    "kpi_target_id" UUID NOT NULL,
    "eval_cycle_id" UUID NOT NULL,
    "cycle_report_id" UUID,
    "evaluator_person_id" UUID,
    "reported_value" DECIMAL(18,4),
    "actual_value" DECIMAL(18,4),
    "value_source" TEXT,
    "score" DECIMAL(7,2),
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "kpi_evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file" (
    "id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "uploaded_by_person_id" UUID,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_type" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "allowed_extensions" TEXT,
    "max_size_mb" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL,
    "document_type_id" INTEGER NOT NULL,
    "file_id" UUID NOT NULL,
    "owner_office_id" UUID,
    "uploaded_by_person_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_confidential" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_link" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,

    CONSTRAINT "document_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "id" UUID NOT NULL,
    "group_name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "value_type" TEXT NOT NULL DEFAULT 'text',
    "file_id" UUID,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_person_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "created_by_person_id" UUID,
    "target_office_id" UUID,
    "include_sub_offices" BOOLEAN NOT NULL DEFAULT false,
    "required_permission_id" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "entity_type" TEXT,
    "entity_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipient" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_person_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "person_email_key" ON "person"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_person_id_key" ON "user_account"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_username_key" ON "user_account"("username");

-- CreateIndex
CREATE UNIQUE INDEX "office_type_name_key" ON "office_type"("name");

-- CreateIndex
CREATE UNIQUE INDEX "office_code_key" ON "office"("code");

-- CreateIndex
CREATE INDEX "office_parent_office_id_idx" ON "office"("parent_office_id");

-- CreateIndex
CREATE INDEX "position_office_id_idx" ON "position"("office_id");

-- CreateIndex
CREATE INDEX "office_person_person_id_idx" ON "office_person"("person_id");

-- CreateIndex
CREATE INDEX "office_person_office_id_idx" ON "office_person"("office_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_role_id_permission_id_key" ON "role_permission"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "office_person_role_office_person_id_role_id_scope_office_id_key" ON "office_person_role"("office_person_id", "role_id", "scope_office_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_year_label_key" ON "fiscal_year"("label");

-- CreateIndex
CREATE INDEX "kpi_theme_parent_theme_id_idx" ON "kpi_theme"("parent_theme_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_code_key" ON "kpi"("code");

-- CreateIndex
CREATE INDEX "kpi_kpi_theme_id_idx" ON "kpi"("kpi_theme_id");

-- CreateIndex
CREATE INDEX "kpi_target_fiscal_year_id_idx" ON "kpi_target"("fiscal_year_id");

-- CreateIndex
CREATE INDEX "kpi_target_kpi_id_idx" ON "kpi_target"("kpi_id");

-- CreateIndex
CREATE INDEX "kpi_target_office_id_idx" ON "kpi_target"("office_id");

-- CreateIndex
CREATE INDEX "kpi_target_person_id_idx" ON "kpi_target"("person_id");

-- CreateIndex
CREATE INDEX "kpi_target_parent_target_id_idx" ON "kpi_target"("parent_target_id");

-- CreateIndex
CREATE INDEX "eval_cycle_fiscal_year_id_idx" ON "eval_cycle"("fiscal_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_report_eval_cycle_id_office_id_key" ON "cycle_report"("eval_cycle_id", "office_id");

-- CreateIndex
CREATE INDEX "kpi_evaluation_cycle_report_id_idx" ON "kpi_evaluation"("cycle_report_id");

-- CreateIndex
CREATE INDEX "kpi_evaluation_evaluator_person_id_idx" ON "kpi_evaluation"("evaluator_person_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_evaluation_kpi_target_id_eval_cycle_id_key" ON "kpi_evaluation"("kpi_target_id", "eval_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_type_code_key" ON "document_type"("code");

-- CreateIndex
CREATE INDEX "document_document_type_id_idx" ON "document"("document_type_id");

-- CreateIndex
CREATE INDEX "document_owner_office_id_idx" ON "document"("owner_office_id");

-- CreateIndex
CREATE INDEX "document_link_entity_type_entity_id_idx" ON "document_link"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_link_document_id_entity_type_entity_id_key" ON "document_link"("document_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_setting_group_name_key_key" ON "system_setting"("group_name", "key");

-- CreateIndex
CREATE INDEX "notification_recipient_person_id_is_read_idx" ON "notification_recipient"("person_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_notification_id_person_id_key" ON "notification_recipient"("notification_id", "person_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_person_id_idx" ON "audit_log"("actor_person_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office" ADD CONSTRAINT "office_parent_office_id_fkey" FOREIGN KEY ("parent_office_id") REFERENCES "office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office" ADD CONSTRAINT "office_office_type_id_fkey" FOREIGN KEY ("office_type_id") REFERENCES "office_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position" ADD CONSTRAINT "position_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_person" ADD CONSTRAINT "office_person_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_person" ADD CONSTRAINT "office_person_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_person" ADD CONSTRAINT "office_person_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_person_role" ADD CONSTRAINT "office_person_role_office_person_id_fkey" FOREIGN KEY ("office_person_id") REFERENCES "office_person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_person_role" ADD CONSTRAINT "office_person_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_person_role" ADD CONSTRAINT "office_person_role_scope_office_id_fkey" FOREIGN KEY ("scope_office_id") REFERENCES "office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_theme" ADD CONSTRAINT "kpi_theme_parent_theme_id_fkey" FOREIGN KEY ("parent_theme_id") REFERENCES "kpi_theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_kpi_theme_id_fkey" FOREIGN KEY ("kpi_theme_id") REFERENCES "kpi_theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_fiscal_year_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_assigned_by_person_id_fkey" FOREIGN KEY ("assigned_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_parent_target_id_fkey" FOREIGN KEY ("parent_target_id") REFERENCES "kpi_target"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_cycle" ADD CONSTRAINT "eval_cycle_fiscal_year_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_report" ADD CONSTRAINT "cycle_report_eval_cycle_id_fkey" FOREIGN KEY ("eval_cycle_id") REFERENCES "eval_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_report" ADD CONSTRAINT "cycle_report_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_report" ADD CONSTRAINT "cycle_report_submitted_by_person_id_fkey" FOREIGN KEY ("submitted_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_report" ADD CONSTRAINT "cycle_report_reviewed_by_person_id_fkey" FOREIGN KEY ("reviewed_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_evaluation" ADD CONSTRAINT "kpi_evaluation_kpi_target_id_fkey" FOREIGN KEY ("kpi_target_id") REFERENCES "kpi_target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_evaluation" ADD CONSTRAINT "kpi_evaluation_eval_cycle_id_fkey" FOREIGN KEY ("eval_cycle_id") REFERENCES "eval_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_evaluation" ADD CONSTRAINT "kpi_evaluation_cycle_report_id_fkey" FOREIGN KEY ("cycle_report_id") REFERENCES "cycle_report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_evaluation" ADD CONSTRAINT "kpi_evaluation_evaluator_person_id_fkey" FOREIGN KEY ("evaluator_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_uploaded_by_person_id_fkey" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_owner_office_id_fkey" FOREIGN KEY ("owner_office_id") REFERENCES "office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_uploaded_by_person_id_fkey" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_link" ADD CONSTRAINT "document_link_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_setting" ADD CONSTRAINT "system_setting_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_setting" ADD CONSTRAINT "system_setting_updated_by_person_id_fkey" FOREIGN KEY ("updated_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_created_by_person_id_fkey" FOREIGN KEY ("created_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_target_office_id_fkey" FOREIGN KEY ("target_office_id") REFERENCES "office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_required_permission_id_fkey" FOREIGN KEY ("required_permission_id") REFERENCES "permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient" ADD CONSTRAINT "notification_recipient_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipient" ADD CONSTRAINT "notification_recipient_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_person_id_fkey" FOREIGN KEY ("actor_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
