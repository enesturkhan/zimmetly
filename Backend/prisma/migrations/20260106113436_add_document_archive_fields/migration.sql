-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
-- AlterTable: Document tablosunda büyük değişiklikler yapılıyor
-- Önce yeni kolonları ekleyelim
ALTER TABLE "Document"
ADD COLUMN IF NOT EXISTS "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "archiveDepartment" TEXT,
    ADD COLUMN IF NOT EXISTS "archiveNote" TEXT,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- archivedByUserId için foreign key constraint ekle (eğer yoksa)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Document_archivedByUserId_fkey'
) THEN
ALTER TABLE "Document"
ADD CONSTRAINT "Document_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE
SET NULL ON UPDATE CASCADE;
END IF;
END $$;
-- id kolonunu kaldırmak için önce bağımlılıkları kontrol etmeliyiz
-- Transaction tablosunda documentNumber kullanılıyor, o yüzden sorun yok
-- NOT: id'den number'a primary key değişikliği için:
-- 1. Önce mevcut primary key constraint'i kaldır
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Document_pkey'
        AND conrelid = 'Document'::regclass
) THEN
ALTER TABLE "Document" DROP CONSTRAINT "Document_pkey";
END IF;
END $$;
-- 2. id kolonunu kaldır (eğer varsa ve artık kullanılmıyorsa)
-- DİKKAT: Bu işlem veri kaybına neden olabilir!
-- Eğer id kolonunda veri varsa, önce yedek alınmalı
ALTER TABLE "Document" DROP COLUMN IF EXISTS "id";
-- 3. number'ı primary key yap (eğer zaten değilse)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Document_pkey'
        AND conrelid = 'Document'::regclass
) THEN
ALTER TABLE "Document"
ADD CONSTRAINT "Document_pkey" PRIMARY KEY ("number");
END IF;
END $$;
-- updatedAt için trigger ekle (otomatik güncelleme için)
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';
-- Trigger'ı sadece yoksa oluştur
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_document_updated_at'
) THEN CREATE TRIGGER update_document_updated_at BEFORE
UPDATE ON "Document" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END IF;
END $$;