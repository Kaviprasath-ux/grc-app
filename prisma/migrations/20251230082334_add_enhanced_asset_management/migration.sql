-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssetSubCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetSubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CIARating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssetSensitivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssetCIAClassification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subCategoryId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "confidentiality" TEXT NOT NULL DEFAULT 'low',
    "confidentialityScore" INTEGER NOT NULL DEFAULT 1,
    "integrity" TEXT NOT NULL DEFAULT 'low',
    "integrityScore" INTEGER NOT NULL DEFAULT 1,
    "availability" TEXT NOT NULL DEFAULT 'low',
    "availabilityScore" INTEGER NOT NULL DEFAULT 0,
    "assetCriticality" TEXT NOT NULL DEFAULT 'low',
    "assetCriticalityScore" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetCIAClassification_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "AssetSubCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetCIAClassification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AssetGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetLifecycleStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "subCategoryId" TEXT,
    "groupId" TEXT,
    "assetType" TEXT,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "custodianId" TEXT,
    "classificationId" TEXT,
    "sensitivityId" TEXT,
    "lifecycleStatusId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "value" REAL,
    "location" TEXT,
    "acquisitionDate" DATETIME,
    "nextReviewDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "AssetSubCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AssetGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "AssetClassification" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_sensitivityId_fkey" FOREIGN KEY ("sensitivityId") REFERENCES "AssetSensitivity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_lifecycleStatusId_fkey" FOREIGN KEY ("lifecycleStatusId") REFERENCES "AssetLifecycleStatus" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("assetId", "assetType", "classificationId", "createdAt", "departmentId", "description", "id", "location", "name", "ownerId", "status", "updatedAt", "value") SELECT "assetId", "assetType", "classificationId", "createdAt", "departmentId", "description", "id", "location", "name", "ownerId", "status", "updatedAt", "value" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_assetId_key" ON "Asset"("assetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_name_key" ON "AssetCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSubCategory_name_categoryId_key" ON "AssetSubCategory"("name", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetGroup_name_key" ON "AssetGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CIARating_type_label_key" ON "CIARating"("type", "label");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSensitivity_name_key" ON "AssetSensitivity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCIAClassification_subCategoryId_groupId_key" ON "AssetCIAClassification"("subCategoryId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLifecycleStatus_name_key" ON "AssetLifecycleStatus"("name");
