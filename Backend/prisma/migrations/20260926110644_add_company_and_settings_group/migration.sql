-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "description" TEXT,
ADD COLUMN     "group" VARCHAR(100) DEFAULT 'general';

-- CreateTable
CREATE TABLE "company" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "legal_name" VARCHAR(255),
    "logo_url" TEXT,
    "address" TEXT,
    "city" VARCHAR(100),
    "country" VARCHAR(100),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "website" VARCHAR(255),
    "tax_number" VARCHAR(100),
    "registration_number" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);
