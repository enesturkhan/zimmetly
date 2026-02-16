-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('NORMAL', 'RETURN_REQUEST');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "kind" "TransactionKind" NOT NULL DEFAULT 'NORMAL';
