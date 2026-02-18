-- =============================================================================
-- ZORUNLU: Bu SQL Supabase SQL Editor'da BİR KEZ çalıştırılmalı
-- =============================================================================
-- SORUN: Transaction tablosunda documentNumber UNIQUE constraint var.
--        Aynı evrak için 2+ transaction (iade, red, tekrar zimmet) P2002 hatası veriyor.
--
-- ÇÖZÜM: UNIQUE constraint kaldır, index koru.
-- =============================================================================

-- 1) UNIQUE constraint'i kaldır (varsa)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Transaction_documentNumber_key'
  ) THEN
    ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_documentNumber_key";
    RAISE NOTICE 'Transaction_documentNumber_key UNIQUE constraint kaldırıldı.';
  ELSE
    RAISE NOTICE 'Transaction_documentNumber_key zaten yok.';
  END IF;
END $$;

-- 2) Index varsa korunur (Prisma @@index zaten oluşturur). Yoksa ekle:
CREATE INDEX IF NOT EXISTS "Transaction_documentNumber_idx" ON "Transaction"("documentNumber");
