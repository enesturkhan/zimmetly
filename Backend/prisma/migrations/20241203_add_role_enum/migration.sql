-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable: Department'i nullable yap
ALTER TABLE "User" ALTER COLUMN "department" DROP NOT NULL;

-- AlterTable: Role kolonunu enum'a çevir
-- Mevcut değerleri dönüştür: 'user' -> 'USER', 'admin' -> 'ADMIN', diğerleri -> 'USER'
ALTER TABLE "User" 
  ALTER COLUMN "role" TYPE "Role" 
  USING CASE 
    WHEN LOWER("role") = 'user' THEN 'USER'::"Role"
    WHEN LOWER("role") = 'admin' THEN 'ADMIN'::"Role"
    ELSE 'USER'::"Role"
  END;

-- Default değeri ayarla
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

