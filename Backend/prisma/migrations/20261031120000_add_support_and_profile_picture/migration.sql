-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');

-- AlterTable
ALTER TABLE "person" ADD COLUMN     "profile_picture_file_id" UUID;

-- CreateTable
CREATE TABLE "support_request" (
    "id" UUID NOT NULL,
    "requester_name" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'NEW',
    "person_id" UUID,
    "handled_by_person_id" UUID,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_request_status_created_at_idx" ON "support_request"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "person_profile_picture_file_id_key" ON "person"("profile_picture_file_id");

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_profile_picture_file_id_fkey" FOREIGN KEY ("profile_picture_file_id") REFERENCES "file_upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_request" ADD CONSTRAINT "support_request_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_request" ADD CONSTRAINT "support_request_handled_by_person_id_fkey" FOREIGN KEY ("handled_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

