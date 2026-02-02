-- AlterTable: Add customerAccountId to AssetSensitivity
ALTER TABLE "AssetSensitivity" ADD COLUMN "customerAccountId" TEXT;

-- DropIndex: Remove old unique constraint on name only
DROP INDEX IF EXISTS "AssetSensitivity_name_key";

-- CreateIndex: Add new unique constraint on customerAccountId + name
CREATE UNIQUE INDEX "AssetSensitivity_customerAccountId_name_key" ON "AssetSensitivity"("customerAccountId", "name");

-- CreateIndex: Add index on customerAccountId
CREATE INDEX "AssetSensitivity_customerAccountId_idx" ON "AssetSensitivity"("customerAccountId");

-- AddForeignKey
ALTER TABLE "AssetSensitivity" ADD CONSTRAINT "AssetSensitivity_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
