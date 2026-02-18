-- Supabase SQL Editor'da manuel çalıştırma için.
-- Transaction.documentNumber UNIQUE constraint'ini kaldırır.
-- Aynı evrak numarası için birden fazla transaction olabilmeli (zimmet zinciri).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Transaction_documentNumber_key'
  ) THEN
    ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_documentNumber_key";
  END IF;
END $$;
