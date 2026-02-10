-- CreateEnum
CREATE TYPE "DocumentActionType" AS ENUM ('CREATE', 'SEND', 'ACCEPT', 'RETURN', 'ARCHIVE', 'UNARCHIVE');

-- CreateTable
CREATE TABLE "DocumentNote" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "transactionId" TEXT,
    "actionType" "DocumentActionType" NOT NULL,
    "note" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentNote_documentNumber_idx" ON "DocumentNote"("documentNumber");

-- CreateIndex
CREATE INDEX "DocumentNote_transactionId_idx" ON "DocumentNote"("transactionId");

-- AddForeignKey
ALTER TABLE "DocumentNote" ADD CONSTRAINT "DocumentNote_documentNumber_fkey" FOREIGN KEY ("documentNumber") REFERENCES "Document"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNote" ADD CONSTRAINT "DocumentNote_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNote" ADD CONSTRAINT "DocumentNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
