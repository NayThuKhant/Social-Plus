-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "is_request" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "conversations" ADD COLUMN "requester_id" TEXT;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
