-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN "qualityScore" REAL DEFAULT 0;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Control" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "controlCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "controlQuestion" TEXT,
    "functionalGrouping" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Non Compliant',
    "entities" TEXT NOT NULL DEFAULT 'Organization Wide',
    "isControlList" BOOLEAN NOT NULL DEFAULT false,
    "relativeControlWeighting" INTEGER,
    "scope" TEXT,
    "notPerformed" TEXT,
    "performedInformally" TEXT,
    "plannedAndTracked" TEXT,
    "wellDefined" TEXT,
    "quantitativelyControlled" TEXT,
    "continuouslyImproving" TEXT,
    "domainId" TEXT,
    "frameworkId" TEXT,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "assigneeId" TEXT,
    "effectivenessScore" REAL DEFAULT 0,
    "lastReviewDate" DATETIME,
    "nextReviewDate" DATETIME,
    "qualityScore" REAL DEFAULT 0,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overrideBy" TEXT,
    "overrideAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Control_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ControlDomain" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Control_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Control_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Control_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Control_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Control" ("assigneeId", "continuouslyImproving", "controlCode", "controlQuestion", "createdAt", "departmentId", "description", "domainId", "entities", "frameworkId", "functionalGrouping", "id", "isControlList", "name", "notPerformed", "ownerId", "performedInformally", "plannedAndTracked", "quantitativelyControlled", "relativeControlWeighting", "scope", "status", "updatedAt", "wellDefined") SELECT "assigneeId", "continuouslyImproving", "controlCode", "controlQuestion", "createdAt", "departmentId", "description", "domainId", "entities", "frameworkId", "functionalGrouping", "id", "isControlList", "name", "notPerformed", "ownerId", "performedInformally", "plannedAndTracked", "quantitativelyControlled", "relativeControlWeighting", "scope", "status", "updatedAt", "wellDefined" FROM "Control";
DROP TABLE "Control";
ALTER TABLE "new_Control" RENAME TO "Control";
CREATE UNIQUE INDEX "Control_controlCode_key" ON "Control"("controlCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
