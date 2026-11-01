-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'REJECTED';

-- CreateTable
CREATE TABLE "contract_rejection" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "rejected_by_person_id" UUID,
    "rejected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "flagged_kpis" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "contract_rejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_rejection_contract_id_idx" ON "contract_rejection"("contract_id");

-- AddForeignKey
ALTER TABLE "contract_rejection" ADD CONSTRAINT "contract_rejection_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "performance_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_rejection" ADD CONSTRAINT "contract_rejection_rejected_by_person_id_fkey" FOREIGN KEY ("rejected_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
