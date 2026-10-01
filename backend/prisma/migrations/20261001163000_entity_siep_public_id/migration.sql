-- AlterTable
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "siep_public_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "entities_siep_public_id_idx" ON "entities"("siep_public_id");
