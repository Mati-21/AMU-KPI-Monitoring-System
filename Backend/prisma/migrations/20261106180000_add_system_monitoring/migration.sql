-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('P1', 'P2');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "system_boot" (
    "id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT NOT NULL,
    "commit" TEXT,
    "node_version" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "environment" TEXT NOT NULL,

    CONSTRAINT "system_boot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_alert" (
    "id" UUID NOT NULL,
    "rule_key" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "acknowledged_by_person_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "system_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_rollup" (
    "id" UUID NOT NULL,
    "bucket_start" TIMESTAMPTZ(6) NOT NULL,
    "requests" INTEGER NOT NULL,
    "status_4xx" INTEGER NOT NULL,
    "status_5xx" INTEGER NOT NULL,
    "p50_ms" DOUBLE PRECISION NOT NULL,
    "p95_ms" DOUBLE PRECISION NOT NULL,
    "p99_ms" DOUBLE PRECISION NOT NULL,
    "cpu_percent" DOUBLE PRECISION NOT NULL,
    "memory_percent" DOUBLE PRECISION NOT NULL,
    "disk_used_percent" DOUBLE PRECISION,
    "event_loop_lag_ms" DOUBLE PRECISION NOT NULL,
    "db_connections" INTEGER NOT NULL,

    CONSTRAINT "metric_rollup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_boot_started_at_idx" ON "system_boot"("started_at");

-- CreateIndex
CREATE INDEX "system_alert_status_opened_at_idx" ON "system_alert"("status", "opened_at");

-- CreateIndex
CREATE INDEX "system_alert_rule_key_status_idx" ON "system_alert"("rule_key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "metric_rollup_bucket_start_key" ON "metric_rollup"("bucket_start");

-- AddForeignKey
ALTER TABLE "system_alert" ADD CONSTRAINT "system_alert_acknowledged_by_person_id_fkey" FOREIGN KEY ("acknowledged_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
