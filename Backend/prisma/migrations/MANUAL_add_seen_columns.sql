-- Backend bildirim (unread) sistemi için Transaction tablosuna alan ekleme
-- Bu script'i veritabanınızda çalıştırın: psql $DATABASE_URL -f prisma/migrations/MANUAL_add_seen_columns.sql

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "seenByToUser" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "seenByFromUser" BOOLEAN NOT NULL DEFAULT false;
