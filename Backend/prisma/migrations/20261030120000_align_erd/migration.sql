-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('NUMBER', 'PERCENTAGE', 'RATIO', 'STAGE', 'CATEGORY', 'MONEY');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'MAINTAIN');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('MINIMUM', 'MAXIMUM', 'EXACT');

-- CreateEnum
CREATE TYPE "AggregationMethod" AS ENUM ('SUM', 'RATIO_OF_SUMS', 'WEIGHTED_SCORE', 'SHARE_MEETING_TARGET', 'WEAKEST_LINK', 'STAGE_DISTRIBUTION', 'DIRECT');

-- CreateEnum
CREATE TYPE "PeriodRollupMethod" AS ENUM ('SUM', 'RATIO_OF_SUMS', 'LATEST', 'AVERAGE');

-- CreateEnum
CREATE TYPE "ZeroTargetRule" AS ENUM ('NOT_CALCULABLE', 'FULL_IF_MET');

-- CreateEnum
CREATE TYPE "ScoringBasis" AS ENUM ('IMPROVEMENT', 'TARGET');

-- CreateEnum
CREATE TYPE "ScaleType" AS ENUM ('STAGE', 'CATEGORY');

-- CreateEnum
CREATE TYPE "FiscalYearStatus" AS ENUM ('PLANNING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'SIGNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACKNOWLEDGED', 'REJECTED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DistributionMethod" AS ENUM ('EQUAL', 'CUSTOM', 'FULL', 'NONE');

-- CreateEnum
CREATE TYPE "ScopeRelation" AS ENUM ('EXCLUSIVE_COMPLETE', 'OVERLAPPING', 'INSTITUTION_WIDE');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('NOT_REQUIRED', 'BALANCED', 'UNDER_ALLOCATED', 'OVER_ALLOCATED', 'JUSTIFIED');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('DISTRIBUTED', 'RETAINED');

-- CreateEnum
CREATE TYPE "BaselineStatus" AS ENUM ('KNOWN', 'UNKNOWN', 'PENDING_VERIFICATION', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ChangeRequestType" AS ENUM ('CLARIFICATION', 'CORRECTION', 'MODIFICATION');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('DIRECT', 'AGGREGATED', 'TOTAL');

-- CreateEnum
CREATE TYPE "ReportingStatus" AS ENUM ('REPORTED', 'NOT_REPORTED', 'AUTO_FILLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "AchievementStatus" AS ENUM ('BELOW_TARGET', 'AT_TARGET', 'ABOVE_TARGET', 'NOT_REPORTED', 'NOT_CALCULABLE', 'PENDING_VERIFICATION');

-- DropForeignKey
ALTER TABLE "cycle_report" DROP CONSTRAINT "cycle_report_eval_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "cycle_report" DROP CONSTRAINT "cycle_report_office_id_fkey";

-- DropForeignKey
ALTER TABLE "cycle_report" DROP CONSTRAINT "cycle_report_reviewed_by_person_id_fkey";

-- DropForeignKey
ALTER TABLE "cycle_report" DROP CONSTRAINT "cycle_report_submitted_by_person_id_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_document_type_id_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_file_id_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_uploaded_by_person_id_fkey";

-- DropForeignKey
ALTER TABLE "document_link" DROP CONSTRAINT "document_link_document_id_fkey";

-- DropForeignKey
ALTER TABLE "eval_cycle" DROP CONSTRAINT "eval_cycle_fiscal_year_id_fkey";

-- DropForeignKey
ALTER TABLE "file" DROP CONSTRAINT "file_uploaded_by_person_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi" DROP CONSTRAINT "kpi_kpi_theme_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_evaluation" DROP CONSTRAINT "kpi_evaluation_cycle_report_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_evaluation" DROP CONSTRAINT "kpi_evaluation_eval_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_evaluation" DROP CONSTRAINT "kpi_evaluation_evaluator_person_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_evaluation" DROP CONSTRAINT "kpi_evaluation_kpi_target_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_target" DROP CONSTRAINT "kpi_target_assigned_by_person_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_target" DROP CONSTRAINT "kpi_target_fiscal_year_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_target" DROP CONSTRAINT "kpi_target_kpi_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_target" DROP CONSTRAINT "kpi_target_office_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_target" DROP CONSTRAINT "kpi_target_parent_target_id_fkey";

-- DropForeignKey
ALTER TABLE "kpi_target" DROP CONSTRAINT "kpi_target_person_id_fkey";

-- DropForeignKey
ALTER TABLE "notification" DROP CONSTRAINT "notification_required_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "office" DROP CONSTRAINT "office_office_type_id_fkey";

-- DropForeignKey
ALTER TABLE "office_person_role" DROP CONSTRAINT "office_person_role_role_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permission" DROP CONSTRAINT "role_permission_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permission" DROP CONSTRAINT "role_permission_role_id_fkey";

-- DropForeignKey
ALTER TABLE "system_setting" DROP CONSTRAINT "system_setting_file_id_fkey";

-- DropIndex
DROP INDEX "document_type_code_key";

-- DropIndex
DROP INDEX "fiscal_year_label_key";

-- DropIndex
DROP INDEX "kpi_kpi_theme_id_idx";

-- DropIndex
DROP INDEX "kpi_target_fiscal_year_id_idx";

-- DropIndex
DROP INDEX "kpi_target_kpi_id_idx";

-- DropIndex
DROP INDEX "kpi_target_office_id_idx";

-- DropIndex
DROP INDEX "kpi_target_parent_target_id_idx";

-- DropIndex
DROP INDEX "kpi_target_person_id_idx";

-- DropIndex
DROP INDEX "notification_recipient_notification_id_person_id_key";

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "document" DROP COLUMN "is_confidential",
DROP COLUMN "uploaded_by_person_id",
ADD COLUMN     "created_by_person_id" UUID,
DROP COLUMN "document_type_id",
ADD COLUMN     "document_type_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "document_type" DROP CONSTRAINT "document_type_pkey",
DROP COLUMN "code",
ADD COLUMN     "description" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "document_type_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "fiscal_year" DROP CONSTRAINT "fiscal_year_pkey",
DROP COLUMN "label",
ADD COLUMN     "name" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "FiscalYearStatus" NOT NULL DEFAULT 'PLANNING',
ADD CONSTRAINT "fiscal_year_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "kpi" DROP COLUMN "cascade_mode",
DROP COLUMN "kpi_theme_id",
DROP COLUMN "max_over_allocation_percent",
DROP COLUMN "sort_order",
DROP COLUMN "unit_of_measure",
ADD COLUMN     "aggregation_method" "AggregationMethod" NOT NULL,
ADD COLUMN     "coordinating_office_id" UUID,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by_person_id" UUID,
ADD COLUMN     "currency_id" UUID,
ADD COLUMN     "data_source" TEXT,
ADD COLUMN     "decimal_places" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "default_frequency_id" UUID NOT NULL,
ADD COLUMN     "denominator_label" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "evidence_requirement" TEXT,
ADD COLUMN     "formula" TEXT,
ADD COLUMN     "is_additive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenance_tolerance" DECIMAL(9,4),
ADD COLUMN     "measurement_type" "MeasurementType" NOT NULL,
ADD COLUMN     "numerator_label" TEXT,
ADD COLUMN     "period_rollup_method" "PeriodRollupMethod" NOT NULL,
ADD COLUMN     "replaces_kpi_id" UUID,
ADD COLUMN     "scale_id" UUID,
ADD COLUMN     "scoring_method" "ScoringBasis" NOT NULL,
ADD COLUMN     "strategic_objective_id" UUID NOT NULL,
ADD COLUMN     "target_type" "TargetType" NOT NULL,
ADD COLUMN     "theme_id" UUID NOT NULL,
ADD COLUMN     "unit_id" UUID,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
ADD COLUMN     "zero_target_rule" "ZeroTargetRule" NOT NULL DEFAULT 'NOT_CALCULABLE',
DROP COLUMN "direction",
ADD COLUMN     "direction" "KpiDirection" NOT NULL;

-- AlterTable
ALTER TABLE "kpi_target" DROP COLUMN "assigned_at",
DROP COLUMN "assigned_by_person_id",
DROP COLUMN "baseline_value",
DROP COLUMN "fiscal_year_id",
DROP COLUMN "kpi_id",
DROP COLUMN "office_id",
DROP COLUMN "parent_target_id",
DROP COLUMN "person_id",
DROP COLUMN "status",
DROP COLUMN "target_value",
DROP COLUMN "weight",
ADD COLUMN     "approved_at" TIMESTAMPTZ(6),
ADD COLUMN     "approved_by_person_id" UUID,
ADD COLUMN     "assignment_id" UUID NOT NULL,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by_person_id" UUID,
ADD COLUMN     "currency_id" UUID,
ADD COLUMN     "denominator" DECIMAL(18,4),
ADD COLUMN     "effective_from_period_id" UUID,
ADD COLUMN     "is_current" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "numerator" DECIMAL(18,4),
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "scale_level_id" UUID,
ADD COLUMN     "value" DECIMAL(18,4),
ADD COLUMN     "version_no" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "kpi_theme" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "notification" DROP COLUMN "channel",
ADD COLUMN     "notification_type" TEXT,
DROP COLUMN "required_permission_id",
ADD COLUMN     "required_permission_id" UUID;

-- AlterTable
ALTER TABLE "notification_recipient" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'in_app';

-- AlterTable
ALTER TABLE "office" ADD COLUMN     "can_assign_kpi" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
DROP COLUMN "office_type_id",
ADD COLUMN     "office_type_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "office_person_role" DROP COLUMN "role_id",
ADD COLUMN     "role_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "office_type" DROP CONSTRAINT "office_type_pkey",
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "office_type_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "permission" DROP CONSTRAINT "permission_pkey",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "module" TEXT,
ADD COLUMN     "name" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "permission_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "person" DROP COLUMN "birth_date",
DROP COLUMN "gender",
DROP COLUMN "status",
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "staff_number" TEXT,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "role" DROP CONSTRAINT "role_pkey",
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "role_permission" DROP CONSTRAINT "role_permission_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "role_id",
ADD COLUMN     "role_id" UUID NOT NULL,
DROP COLUMN "permission_id",
ADD COLUMN     "permission_id" UUID NOT NULL,
ADD CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_account" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "cycle_report";

-- DropTable
DROP TABLE "document_link";

-- DropTable
DROP TABLE "eval_cycle";

-- DropTable
DROP TABLE "file";

-- DropTable
DROP TABLE "kpi_evaluation";

-- CreateTable
CREATE TABLE "office_hierarchy_history" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "parent_office_id" UUID,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "reason" TEXT,
    "changed_by_person_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "office_hierarchy_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategic_objective" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "strategic_objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_unit" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "description" TEXT,

    CONSTRAINT "measurement_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_scale" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scale_type" "ScaleType" NOT NULL,
    "is_ordered" BOOLEAN NOT NULL DEFAULT true,
    "is_binary" BOOLEAN NOT NULL DEFAULT false,
    "scoring_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_person_id" UUID,
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "kpi_scale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_scale_level" (
    "id" UUID NOT NULL,
    "scale_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL,
    "score" DECIMAL(9,4),
    "assessment_criteria" TEXT,

    CONSTRAINT "kpi_scale_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "is_reporting_currency" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate" (
    "id" UUID NOT NULL,
    "from_currency_id" UUID NOT NULL,
    "to_currency_id" UUID NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "rate_date" DATE NOT NULL,
    "source" TEXT,

    CONSTRAINT "exchange_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_frequency" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "interval_months" INTEGER,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "reporting_frequency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_period" (
    "id" UUID NOT NULL,
    "fiscal_year_id" UUID NOT NULL,
    "frequency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "submission_deadline" DATE,
    "is_year_end" BOOLEAN NOT NULL DEFAULT false,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "reporting_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_contract" (
    "id" UUID NOT NULL,
    "fiscal_year_id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "assigning_office_id" UUID,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "required_total_weight" DECIMAL(7,4) NOT NULL DEFAULT 100,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "signed_by_person_id" UUID,
    "signed_at" TIMESTAMPTZ(6),
    "approved_by_person_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_assignment" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "kpi_id" UUID NOT NULL,
    "parent_assignment_id" UUID,
    "reporting_frequency_id" UUID NOT NULL,
    "distribution_method" "DistributionMethod" NOT NULL DEFAULT 'NONE',
    "scope_relation" "ScopeRelation" NOT NULL,
    "reconciliation_status" "ReconciliationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "reconciliation_note" TEXT,
    "max_over_allocation_percent" DECIMAL(6,2),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_person_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_person_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "acknowledged_by_person_id" UUID,
    "acknowledged_at" TIMESTAMPTZ(6),

    CONSTRAINT "kpi_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_weight" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "weight" DECIMAL(7,4) NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "created_by_person_id" UUID,
    "approved_by_person_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_weight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_baseline" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "baseline_status" "BaselineStatus" NOT NULL,
    "value" DECIMAL(18,4),
    "numerator" DECIMAL(18,4),
    "denominator" DECIMAL(18,4),
    "scale_level_id" UUID,
    "currency_id" UUID,
    "unknown_justification" TEXT,
    "effective_from_period_id" UUID,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "created_by_person_id" UUID,
    "verified_by_person_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_baseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsibility_allocation" (
    "id" UUID NOT NULL,
    "parent_assignment_id" UUID NOT NULL,
    "child_assignment_id" UUID,
    "allocation_type" "AllocationType" NOT NULL,
    "allocated_amount" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "created_by_person_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responsibility_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_change_request" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "request_type" "ChangeRequestType" NOT NULL,
    "requested_by_person_id" UUID,
    "proposed_values" JSONB,
    "reason" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_person_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_comment" TEXT,
    "new_baseline_id" UUID,
    "new_target_id" UUID,
    "new_weight_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_change_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_upload" (
    "id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "uploaded_by_person_id" UUID,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_evidence" (
    "id" UUID NOT NULL,
    "baseline_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "source_description" TEXT,
    "source_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baseline_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_request_evidence" (
    "id" UUID NOT NULL,
    "change_request_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_request_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_report" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "reporting_period_id" UUID NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "prepared_by_person_id" UUID,
    "submitted_by_person_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "is_provisional" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "performance_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_value" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "contribution_type" "ContributionType" NOT NULL,
    "reporting_status" "ReportingStatus" NOT NULL DEFAULT 'REPORTED',
    "value" DECIMAL(18,4),
    "numerator" DECIMAL(18,4),
    "denominator" DECIMAL(18,4),
    "scale_level_id" UUID,
    "currency_id" UUID,
    "converted_value" DECIMAL(18,4),
    "exchange_rate_id" UUID,
    "note" TEXT,
    "entered_by_person_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_evidence" (
    "id" UUID NOT NULL,
    "performance_value_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by_person_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_review" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "reviewer_person_id" UUID NOT NULL,
    "reviewer_office_id" UUID,
    "decision" "ReviewDecision" NOT NULL,
    "comment" TEXT,
    "reviewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_status_threshold" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "min_percent" DECIMAL(9,4) NOT NULL,
    "max_percent" DECIMAL(9,4),
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "performance_status_threshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_achievement" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "reporting_period_id" UUID NOT NULL,
    "baseline_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "weight_id" UUID NOT NULL,
    "actual_value" DECIMAL(18,4),
    "actual_numerator" DECIMAL(18,4),
    "actual_denominator" DECIMAL(18,4),
    "actual_scale_level_id" UUID,
    "required_improvement" DECIMAL(18,4),
    "actual_improvement" DECIMAL(18,4),
    "improvement_calculable" BOOLEAN NOT NULL DEFAULT true,
    "not_calculable_reason" TEXT,
    "improvement_achievement_raw" DECIMAL(12,4),
    "improvement_achievement_capped" DECIMAL(12,4),
    "target_achievement_raw" DECIMAL(12,4),
    "target_achievement_capped" DECIMAL(12,4),
    "target_met" BOOLEAN,
    "achievement_status" "AchievementStatus" NOT NULL,
    "status_threshold_id" UUID,
    "weighted_improvement_score" DECIMAL(12,4),
    "weighted_target_score" DECIMAL(12,4),
    "is_provisional" BOOLEAN NOT NULL DEFAULT true,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_score" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "reporting_period_id" UUID NOT NULL,
    "total_weight" DECIMAL(7,4) NOT NULL,
    "reported_weight" DECIMAL(7,4) NOT NULL,
    "weighted_improvement_score" DECIMAL(12,4),
    "weighted_target_score" DECIMAL(12,4),
    "official_basis" "ScoringBasis" NOT NULL,
    "is_provisional" BOOLEAN NOT NULL DEFAULT true,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "office_hierarchy_history_office_id_idx" ON "office_hierarchy_history"("office_id");

-- CreateIndex
CREATE INDEX "office_hierarchy_history_parent_office_id_idx" ON "office_hierarchy_history"("parent_office_id");

-- CreateIndex
CREATE UNIQUE INDEX "strategic_objective_code_key" ON "strategic_objective"("code");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_unit_name_key" ON "measurement_unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_scale_name_key" ON "kpi_scale"("name");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_scale_level_scale_id_name_key" ON "kpi_scale_level"("scale_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_scale_level_scale_id_sort_order_key" ON "kpi_scale_level"("scale_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "currency_code_key" ON "currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_from_currency_id_to_currency_id_rate_date_key" ON "exchange_rate"("from_currency_id", "to_currency_id", "rate_date");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_frequency_name_key" ON "reporting_frequency"("name");

-- CreateIndex
CREATE INDEX "reporting_period_fiscal_year_id_idx" ON "reporting_period"("fiscal_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_period_fiscal_year_id_frequency_id_name_key" ON "reporting_period"("fiscal_year_id", "frequency_id", "name");

-- CreateIndex
CREATE INDEX "performance_contract_office_id_idx" ON "performance_contract"("office_id");

-- CreateIndex
CREATE INDEX "performance_contract_assigning_office_id_idx" ON "performance_contract"("assigning_office_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_contract_fiscal_year_id_office_id_version_no_key" ON "performance_contract"("fiscal_year_id", "office_id", "version_no");

-- CreateIndex
CREATE INDEX "kpi_assignment_kpi_id_idx" ON "kpi_assignment"("kpi_id");

-- CreateIndex
CREATE INDEX "kpi_assignment_parent_assignment_id_idx" ON "kpi_assignment"("parent_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_assignment_contract_id_kpi_id_key" ON "kpi_assignment"("contract_id", "kpi_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_weight_assignment_id_version_no_key" ON "kpi_weight"("assignment_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_baseline_assignment_id_version_no_key" ON "kpi_baseline"("assignment_id", "version_no");

-- CreateIndex
CREATE INDEX "responsibility_allocation_child_assignment_id_idx" ON "responsibility_allocation"("child_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "responsibility_allocation_parent_assignment_id_child_assign_key" ON "responsibility_allocation"("parent_assignment_id", "child_assignment_id");

-- CreateIndex
CREATE INDEX "assignment_change_request_assignment_id_idx" ON "assignment_change_request"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "baseline_evidence_baseline_id_document_id_key" ON "baseline_evidence"("baseline_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_request_evidence_change_request_id_document_id_key" ON "change_request_evidence"("change_request_id", "document_id");

-- CreateIndex
CREATE INDEX "performance_report_reporting_period_id_idx" ON "performance_report"("reporting_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_report_contract_id_reporting_period_id_key" ON "performance_report"("contract_id", "reporting_period_id");

-- CreateIndex
CREATE INDEX "performance_value_assignment_id_idx" ON "performance_value"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_value_report_id_assignment_id_contribution_type_key" ON "performance_value"("report_id", "assignment_id", "contribution_type");

-- CreateIndex
CREATE UNIQUE INDEX "performance_evidence_performance_value_id_document_id_key" ON "performance_evidence"("performance_value_id", "document_id");

-- CreateIndex
CREATE INDEX "performance_review_report_id_idx" ON "performance_review"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_status_threshold_name_key" ON "performance_status_threshold"("name");

-- CreateIndex
CREATE INDEX "kpi_achievement_reporting_period_id_idx" ON "kpi_achievement"("reporting_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_achievement_assignment_id_reporting_period_id_key" ON "kpi_achievement"("assignment_id", "reporting_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_score_contract_id_reporting_period_id_key" ON "contract_score"("contract_id", "reporting_period_id");

-- CreateIndex
CREATE INDEX "document_document_type_id_idx" ON "document"("document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_type_name_key" ON "document_type"("name");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_year_name_key" ON "fiscal_year"("name");

-- CreateIndex
CREATE INDEX "kpi_theme_id_idx" ON "kpi"("theme_id");

-- CreateIndex
CREATE INDEX "kpi_strategic_objective_id_idx" ON "kpi"("strategic_objective_id");

-- CreateIndex
CREATE INDEX "kpi_replaces_kpi_id_idx" ON "kpi"("replaces_kpi_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_target_assignment_id_version_no_key" ON "kpi_target"("assignment_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_theme_code_key" ON "kpi_theme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipient_notification_id_person_id_channel_key" ON "notification_recipient"("notification_id", "person_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "office_person_role_office_person_id_role_id_scope_office_id_key" ON "office_person_role"("office_person_id", "role_id", "scope_office_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "person_staff_number_key" ON "person"("staff_number");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_role_id_permission_id_key" ON "role_permission"("role_id", "permission_id");

-- AddForeignKey
ALTER TABLE "office" ADD CONSTRAINT "office_office_type_id_fkey" FOREIGN KEY ("office_type_id") REFERENCES "office_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_hierarchy_history" ADD CONSTRAINT "office_hierarchy_history_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_hierarchy_history" ADD CONSTRAINT "office_hierarchy_history_parent_office_id_fkey" FOREIGN KEY ("parent_office_id") REFERENCES "office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_hierarchy_history" ADD CONSTRAINT "office_hierarchy_history_changed_by_person_id_fkey" FOREIGN KEY ("changed_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_person_role" ADD CONSTRAINT "office_person_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_scale" ADD CONSTRAINT "kpi_scale_approved_by_person_id_fkey" FOREIGN KEY ("approved_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_scale_level" ADD CONSTRAINT "kpi_scale_level_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "kpi_scale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_from_currency_id_fkey" FOREIGN KEY ("from_currency_id") REFERENCES "currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_to_currency_id_fkey" FOREIGN KEY ("to_currency_id") REFERENCES "currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "kpi_theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_strategic_objective_id_fkey" FOREIGN KEY ("strategic_objective_id") REFERENCES "strategic_objective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "measurement_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "kpi_scale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_default_frequency_id_fkey" FOREIGN KEY ("default_frequency_id") REFERENCES "reporting_frequency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_coordinating_office_id_fkey" FOREIGN KEY ("coordinating_office_id") REFERENCES "office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_replaces_kpi_id_fkey" FOREIGN KEY ("replaces_kpi_id") REFERENCES "kpi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_created_by_person_id_fkey" FOREIGN KEY ("created_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_period" ADD CONSTRAINT "reporting_period_fiscal_year_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_period" ADD CONSTRAINT "reporting_period_frequency_id_fkey" FOREIGN KEY ("frequency_id") REFERENCES "reporting_frequency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_contract" ADD CONSTRAINT "performance_contract_fiscal_year_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_contract" ADD CONSTRAINT "performance_contract_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_contract" ADD CONSTRAINT "performance_contract_assigning_office_id_fkey" FOREIGN KEY ("assigning_office_id") REFERENCES "office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_contract" ADD CONSTRAINT "performance_contract_signed_by_person_id_fkey" FOREIGN KEY ("signed_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_contract" ADD CONSTRAINT "performance_contract_approved_by_person_id_fkey" FOREIGN KEY ("approved_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_assignment" ADD CONSTRAINT "kpi_assignment_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "performance_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_assignment" ADD CONSTRAINT "kpi_assignment_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_assignment" ADD CONSTRAINT "kpi_assignment_parent_assignment_id_fkey" FOREIGN KEY ("parent_assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_assignment" ADD CONSTRAINT "kpi_assignment_reporting_frequency_id_fkey" FOREIGN KEY ("reporting_frequency_id") REFERENCES "reporting_frequency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_assignment" ADD CONSTRAINT "kpi_assignment_created_by_person_id_fkey" FOREIGN KEY ("created_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_assignment" ADD CONSTRAINT "kpi_assignment_approved_by_person_id_fkey" FOREIGN KEY ("approved_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_assignment" ADD CONSTRAINT "kpi_assignment_acknowledged_by_person_id_fkey" FOREIGN KEY ("acknowledged_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_weight" ADD CONSTRAINT "kpi_weight_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_weight" ADD CONSTRAINT "kpi_weight_created_by_person_id_fkey" FOREIGN KEY ("created_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_weight" ADD CONSTRAINT "kpi_weight_approved_by_person_id_fkey" FOREIGN KEY ("approved_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_baseline" ADD CONSTRAINT "kpi_baseline_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_baseline" ADD CONSTRAINT "kpi_baseline_scale_level_id_fkey" FOREIGN KEY ("scale_level_id") REFERENCES "kpi_scale_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_baseline" ADD CONSTRAINT "kpi_baseline_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_baseline" ADD CONSTRAINT "kpi_baseline_effective_from_period_id_fkey" FOREIGN KEY ("effective_from_period_id") REFERENCES "reporting_period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_baseline" ADD CONSTRAINT "kpi_baseline_created_by_person_id_fkey" FOREIGN KEY ("created_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_baseline" ADD CONSTRAINT "kpi_baseline_verified_by_person_id_fkey" FOREIGN KEY ("verified_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_scale_level_id_fkey" FOREIGN KEY ("scale_level_id") REFERENCES "kpi_scale_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_effective_from_period_id_fkey" FOREIGN KEY ("effective_from_period_id") REFERENCES "reporting_period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_created_by_person_id_fkey" FOREIGN KEY ("created_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_target" ADD CONSTRAINT "kpi_target_approved_by_person_id_fkey" FOREIGN KEY ("approved_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsibility_allocation" ADD CONSTRAINT "responsibility_allocation_parent_assignment_id_fkey" FOREIGN KEY ("parent_assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsibility_allocation" ADD CONSTRAINT "responsibility_allocation_child_assignment_id_fkey" FOREIGN KEY ("child_assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsibility_allocation" ADD CONSTRAINT "responsibility_allocation_created_by_person_id_fkey" FOREIGN KEY ("created_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_change_request" ADD CONSTRAINT "assignment_change_request_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_change_request" ADD CONSTRAINT "assignment_change_request_requested_by_person_id_fkey" FOREIGN KEY ("requested_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_change_request" ADD CONSTRAINT "assignment_change_request_reviewed_by_person_id_fkey" FOREIGN KEY ("reviewed_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_change_request" ADD CONSTRAINT "assignment_change_request_new_baseline_id_fkey" FOREIGN KEY ("new_baseline_id") REFERENCES "kpi_baseline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_change_request" ADD CONSTRAINT "assignment_change_request_new_target_id_fkey" FOREIGN KEY ("new_target_id") REFERENCES "kpi_target"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_change_request" ADD CONSTRAINT "assignment_change_request_new_weight_id_fkey" FOREIGN KEY ("new_weight_id") REFERENCES "kpi_weight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_upload" ADD CONSTRAINT "file_upload_uploaded_by_person_id_fkey" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_created_by_person_id_fkey" FOREIGN KEY ("created_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_evidence" ADD CONSTRAINT "baseline_evidence_baseline_id_fkey" FOREIGN KEY ("baseline_id") REFERENCES "kpi_baseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_evidence" ADD CONSTRAINT "baseline_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request_evidence" ADD CONSTRAINT "change_request_evidence_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "assignment_change_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request_evidence" ADD CONSTRAINT "change_request_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_report" ADD CONSTRAINT "performance_report_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "performance_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_report" ADD CONSTRAINT "performance_report_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_report" ADD CONSTRAINT "performance_report_prepared_by_person_id_fkey" FOREIGN KEY ("prepared_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_report" ADD CONSTRAINT "performance_report_submitted_by_person_id_fkey" FOREIGN KEY ("submitted_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_value" ADD CONSTRAINT "performance_value_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "performance_report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_value" ADD CONSTRAINT "performance_value_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_value" ADD CONSTRAINT "performance_value_scale_level_id_fkey" FOREIGN KEY ("scale_level_id") REFERENCES "kpi_scale_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_value" ADD CONSTRAINT "performance_value_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_value" ADD CONSTRAINT "performance_value_exchange_rate_id_fkey" FOREIGN KEY ("exchange_rate_id") REFERENCES "exchange_rate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_value" ADD CONSTRAINT "performance_value_entered_by_person_id_fkey" FOREIGN KEY ("entered_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evidence" ADD CONSTRAINT "performance_evidence_performance_value_id_fkey" FOREIGN KEY ("performance_value_id") REFERENCES "performance_value"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evidence" ADD CONSTRAINT "performance_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_evidence" ADD CONSTRAINT "performance_evidence_verified_by_person_id_fkey" FOREIGN KEY ("verified_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_review" ADD CONSTRAINT "performance_review_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "performance_report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_review" ADD CONSTRAINT "performance_review_reviewer_person_id_fkey" FOREIGN KEY ("reviewer_person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_review" ADD CONSTRAINT "performance_review_reviewer_office_id_fkey" FOREIGN KEY ("reviewer_office_id") REFERENCES "office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_achievement" ADD CONSTRAINT "kpi_achievement_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "kpi_assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_achievement" ADD CONSTRAINT "kpi_achievement_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_achievement" ADD CONSTRAINT "kpi_achievement_baseline_id_fkey" FOREIGN KEY ("baseline_id") REFERENCES "kpi_baseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_achievement" ADD CONSTRAINT "kpi_achievement_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "kpi_target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_achievement" ADD CONSTRAINT "kpi_achievement_weight_id_fkey" FOREIGN KEY ("weight_id") REFERENCES "kpi_weight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_achievement" ADD CONSTRAINT "kpi_achievement_actual_scale_level_id_fkey" FOREIGN KEY ("actual_scale_level_id") REFERENCES "kpi_scale_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_achievement" ADD CONSTRAINT "kpi_achievement_status_threshold_id_fkey" FOREIGN KEY ("status_threshold_id") REFERENCES "performance_status_threshold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_score" ADD CONSTRAINT "contract_score_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "performance_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_score" ADD CONSTRAINT "contract_score_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_setting" ADD CONSTRAINT "system_setting_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_required_permission_id_fkey" FOREIGN KEY ("required_permission_id") REFERENCES "permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Rules Prisma cannot express in the schema: at most one current row, one active year, one reporting currency.
CREATE UNIQUE INDEX "kpi_weight_one_current" ON "kpi_weight"("assignment_id") WHERE "is_current";
CREATE UNIQUE INDEX "kpi_baseline_one_current" ON "kpi_baseline"("assignment_id") WHERE "is_current";
CREATE UNIQUE INDEX "kpi_target_one_current" ON "kpi_target"("assignment_id") WHERE "is_current";
CREATE UNIQUE INDEX "fiscal_year_one_active" ON "fiscal_year"((true)) WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "currency_one_reporting" ON "currency"((true)) WHERE "is_reporting_currency";
CREATE UNIQUE INDEX "office_hierarchy_history_one_current" ON "office_hierarchy_history"("office_id") WHERE "valid_to" IS NULL;
CREATE UNIQUE INDEX "responsibility_allocation_one_retained" ON "responsibility_allocation"("parent_assignment_id") WHERE "child_assignment_id" IS NULL;
