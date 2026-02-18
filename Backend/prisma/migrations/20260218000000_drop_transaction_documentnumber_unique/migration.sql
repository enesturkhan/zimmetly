-- Transaction.documentNumber üzerindeki UNIQUE constraint kaldırılır.
-- Aynı evrak numarası için birden fazla transaction (zimmet, iade, red) olabilmeli.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Transaction_documentNumber_key'
  ) THEN
    ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_documentNumber_key";
  END IF;
END $$;
