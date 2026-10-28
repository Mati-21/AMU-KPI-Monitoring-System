-- CreateTable
CREATE TABLE "user_session" (
    "id" UUID NOT NULL,
    "user_account_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "previous_refresh_token_hash" TEXT,
    "rotated_at" TIMESTAMPTZ(6),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" TEXT,

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_session_refresh_token_hash_key" ON "user_session"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_session_user_account_id_revoked_at_idx" ON "user_session"("user_account_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_session_expires_at_idx" ON "user_session"("expires_at");

-- AddForeignKey
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
