-- CreateTable
CREATE TABLE "message" (
    "id" UUID NOT NULL,
    "sender_person_id" UUID NOT NULL,
    "receiver_person_id" UUID NOT NULL,
    "content" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachment" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,

    CONSTRAINT "message_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_sender_person_id_receiver_person_id_created_at_idx" ON "message"("sender_person_id", "receiver_person_id", "created_at");

-- CreateIndex
CREATE INDEX "message_receiver_person_id_read_at_idx" ON "message"("receiver_person_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_attachment_file_id_key" ON "message_attachment"("file_id");

-- CreateIndex
CREATE INDEX "message_attachment_message_id_idx" ON "message_attachment"("message_id");

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sender_person_id_fkey" FOREIGN KEY ("sender_person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_receiver_person_id_fkey" FOREIGN KEY ("receiver_person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
