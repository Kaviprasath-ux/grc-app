-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "brochure" TEXT;
ALTER TABLE "Organization" ADD COLUMN "ceoMessage" TEXT;
ALTER TABLE "Organization" ADD COLUMN "email" TEXT;
ALTER TABLE "Organization" ADD COLUMN "facebook" TEXT;
ALTER TABLE "Organization" ADD COLUMN "linkedin" TEXT;
ALTER TABLE "Organization" ADD COLUMN "logo" TEXT;
ALTER TABLE "Organization" ADD COLUMN "phone" TEXT;
ALTER TABLE "Organization" ADD COLUMN "twitter" TEXT;
ALTER TABLE "Organization" ADD COLUMN "value" TEXT;
ALTER TABLE "Organization" ADD COLUMN "youtube" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "customerCode" TEXT;
ALTER TABLE "User" ADD COLUMN "lastLogin" DATETIME;
ALTER TABLE "User" ADD COLUMN "logoUrl" TEXT;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "location" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataCenter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationType" TEXT NOT NULL,
    "address" TEXT,
    "vendor" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataCenter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CloudProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CloudProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "completion" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "fileName" TEXT,
    "fileType" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IssueAction_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueActionComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueActionComment_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "IssueAction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueRegulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueRegulation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueRegulation_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "Regulation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueProcess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueProcess_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueProcess_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueStakeholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "needExpectation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueStakeholder_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueStakeholder_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessBIAComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processBIAId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessBIAComment_processBIAId_fkey" FOREIGN KEY ("processBIAId") REFERENCES "ProcessBIA" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VulnerabilityCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ThreatCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ControlStrength" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskLikelihood" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "timeFrame" TEXT,
    "probability" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImpactCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImpactRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VulnerabilityRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskSubCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskRange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "color" TEXT,
    "lowRange" INTEGER NOT NULL DEFAULT 0,
    "highRange" INTEGER NOT NULL DEFAULT 0,
    "timelineDays" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskScoreConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "useLikelihood" BOOLEAN NOT NULL DEFAULT true,
    "useImpact" BOOLEAN NOT NULL DEFAULT true,
    "useAssetScore" BOOLEAN NOT NULL DEFAULT false,
    "useVulnerabilityScore" BOOLEAN NOT NULL DEFAULT false,
    "riskTolerance" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditableEntity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "plannedHours" REAL NOT NULL DEFAULT 0,
    "actualHours" REAL NOT NULL DEFAULT 0,
    "lastAuditDate" DATETIME,
    "nextAuditDate" DATETIME,
    "riskRating" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditableEntity_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEngagement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "engagementTitle" TEXT NOT NULL,
    "engagementObjective" TEXT,
    "engagementScope" TEXT,
    "description" TEXT,
    "departmentId" TEXT,
    "auditableEntityId" TEXT,
    "auditTypeId" TEXT,
    "auditType" TEXT,
    "auditRating" TEXT,
    "assignedAuditorId" TEXT,
    "auditeeId" TEXT,
    "plannedStartDate" DATETIME,
    "plannedEndDate" DATETIME,
    "actualStartDate" DATETIME,
    "actualEndDate" DATETIME,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "plannedHours" REAL NOT NULL DEFAULT 0,
    "actualHours" REAL NOT NULL DEFAULT 0,
    "initialObservation" TEXT,
    "relatedPolicies" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "year" INTEGER NOT NULL DEFAULT 2026,
    "quarter" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditEngagement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEngagement_auditableEntityId_fkey" FOREIGN KEY ("auditableEntityId") REFERENCES "AuditableEntity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEngagement_auditTypeId_fkey" FOREIGN KEY ("auditTypeId") REFERENCES "AuditType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEngagement_assignedAuditorId_fkey" FOREIGN KEY ("assignedAuditorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEngagement_auditeeId_fkey" FOREIGN KEY ("auditeeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditFieldwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engagementId" TEXT NOT NULL,
    "startDate" DATETIME,
    "targetDate" DATETIME,
    "completionDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "scope" TEXT,
    "objectives" TEXT,
    "methodology" TEXT,
    "observations" TEXT,
    "hoursSpent" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditFieldwork_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditWorkpaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldworkId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "description" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditWorkpaper_fieldworkId_fkey" FOREIGN KEY ("fieldworkId") REFERENCES "AuditFieldwork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldworkEvidenceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engagementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sampleSize" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "aiReviewStatus" TEXT,
    "aiReviewComment" TEXT,
    "dueDate" DATETIME,
    "category" TEXT,
    "documentType" TEXT,
    "auditeeId" TEXT,
    "auditeeName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FieldworkEvidenceRequest_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldworkEvidenceAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FieldworkEvidenceAttachment_evidenceRequestId_fkey" FOREIGN KEY ("evidenceRequestId") REFERENCES "FieldworkEvidenceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportCode" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "executiveSummary" TEXT,
    "scope" TEXT,
    "objectives" TEXT,
    "methodology" TEXT,
    "observations" TEXT,
    "recommendations" TEXT,
    "managementResponse" TEXT,
    "conclusion" TEXT,
    "overallResult" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "draftGeneratedAt" DATETIME,
    "reviewedAt" DATETIME,
    "publishedAt" DATETIME,
    "reviewedBy" TEXT,
    "auditeeId" TEXT,
    "auditeeName" TEXT,
    "auditeeComment" TEXT,
    "reportFilePath" TEXT,
    "reportFileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditReport_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InternalAuditFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "departmentId" TEXT,
    "responsiblePerson" TEXT,
    "responsiblePersonId" TEXT,
    "criteria" TEXT,
    "condition" TEXT,
    "cause" TEXT,
    "effect" TEXT,
    "recommendation" TEXT,
    "identifiedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" DATETIME,
    "closedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalAuditFinding_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InternalAuditFinding_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InternalAuditCAPA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capaId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actionType" TEXT NOT NULL DEFAULT 'Corrective',
    "responsiblePerson" TEXT,
    "targetDate" DATETIME,
    "completedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "evidenceFilePath" TEXT,
    "evidenceFileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalAuditCAPA_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "InternalAuditFinding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InternalAuditDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Policy',
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_EngagementTeamMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_EngagementTeamMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "AuditEngagement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EngagementTeamMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InternalAuditRisk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riskId" TEXT NOT NULL,
    "riskName" TEXT NOT NULL,
    "departmentId" TEXT,
    "sectionProcess" TEXT,
    "subProcess" TEXT,
    "activity" TEXT,
    "categoryId" TEXT,
    "auditTypeId" TEXT,
    "riskDescription" TEXT,
    "inherentLikelihood" INTEGER,
    "inherentImpact" INTEGER,
    "inherentScore" INTEGER,
    "controlDescription" TEXT,
    "controlEffectiveness" TEXT,
    "residualLikelihood" INTEGER,
    "residualImpact" INTEGER,
    "residualScore" INTEGER,
    "riskLevel" TEXT,
    "creationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditComment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "evidenceFilePath" TEXT,
    "evidenceFileName" TEXT,
    "engagementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalAuditRisk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalAuditRisk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AuditCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalAuditRisk_auditTypeId_fkey" FOREIGN KEY ("auditTypeId") REFERENCES "AuditType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalAuditRisk_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InternalAuditRisk" ("activity", "auditComment", "auditTypeId", "categoryId", "controlDescription", "controlEffectiveness", "createdAt", "creationDate", "departmentId", "evidenceFileName", "evidenceFilePath", "id", "inherentImpact", "inherentLikelihood", "inherentScore", "residualImpact", "residualLikelihood", "residualScore", "riskDescription", "riskId", "riskLevel", "riskName", "sectionProcess", "status", "subProcess", "updatedAt") SELECT "activity", "auditComment", "auditTypeId", "categoryId", "controlDescription", "controlEffectiveness", "createdAt", "creationDate", "departmentId", "evidenceFileName", "evidenceFilePath", "id", "inherentImpact", "inherentLikelihood", "inherentScore", "residualImpact", "residualLikelihood", "residualScore", "riskDescription", "riskId", "riskLevel", "riskName", "sectionProcess", "status", "subProcess", "updatedAt" FROM "InternalAuditRisk";
DROP TABLE "InternalAuditRisk";
ALTER TABLE "new_InternalAuditRisk" RENAME TO "InternalAuditRisk";
CREATE UNIQUE INDEX "InternalAuditRisk_riskId_key" ON "InternalAuditRisk"("riskId");
CREATE TABLE "new_Issue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "issueType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "dueDate" DATETIME,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Issue_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Issue_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Issue" ("category", "createdAt", "departmentId", "description", "domain", "dueDate", "id", "issueType", "status", "title", "updatedAt") SELECT "category", "createdAt", "departmentId", "description", "domain", "dueDate", "id", "issueType", "status", "title", "updatedAt" FROM "Issue";
DROP TABLE "Issue";
ALTER TABLE "new_Issue" RENAME TO "Issue";
CREATE TABLE "new_Process" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "processType" TEXT NOT NULL DEFAULT 'Primary',
    "departmentId" TEXT,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "processFrequency" TEXT,
    "natureOfImplementation" TEXT,
    "riskRating" TEXT,
    "assetDependency" BOOLEAN NOT NULL DEFAULT false,
    "externalDependency" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "kpiMeasurementRequired" BOOLEAN NOT NULL DEFAULT false,
    "piiCapture" BOOLEAN NOT NULL DEFAULT false,
    "operationalComplexity" TEXT,
    "lastAuditDate" DATETIME,
    "responsibleId" TEXT,
    "accountableId" TEXT,
    "consultedId" TEXT,
    "informedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Process_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Process_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Process_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Process_accountableId_fkey" FOREIGN KEY ("accountableId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Process_consultedId_fkey" FOREIGN KEY ("consultedId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Process_informedId_fkey" FOREIGN KEY ("informedId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Process" ("accountableId", "assetDependency", "consultedId", "createdAt", "departmentId", "description", "externalDependency", "id", "informedId", "kpiMeasurementRequired", "lastAuditDate", "location", "name", "natureOfImplementation", "operationalComplexity", "ownerId", "piiCapture", "processCode", "processFrequency", "processType", "responsibleId", "riskRating", "status", "updatedAt") SELECT "accountableId", "assetDependency", "consultedId", "createdAt", "departmentId", "description", "externalDependency", "id", "informedId", "kpiMeasurementRequired", "lastAuditDate", "location", "name", "natureOfImplementation", "operationalComplexity", "ownerId", "piiCapture", "processCode", "processFrequency", "processType", "responsibleId", "riskRating", "status", "updatedAt" FROM "Process";
DROP TABLE "Process";
ALTER TABLE "new_Process" RENAME TO "Process";
CREATE UNIQUE INDEX "Process_processCode_key" ON "Process"("processCode");
CREATE TABLE "new_RiskCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RiskCategory" ("color", "createdAt", "description", "id", "name", "updatedAt") SELECT "color", "createdAt", "description", "id", "name", "updatedAt" FROM "RiskCategory";
DROP TABLE "RiskCategory";
ALTER TABLE "new_RiskCategory" RENAME TO "RiskCategory";
CREATE UNIQUE INDEX "RiskCategory_name_key" ON "RiskCategory"("name");
CREATE TABLE "new_RiskThreat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threatId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskThreat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ThreatCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RiskThreat" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "RiskThreat";
DROP TABLE "RiskThreat";
ALTER TABLE "new_RiskThreat" RENAME TO "RiskThreat";
CREATE UNIQUE INDEX "RiskThreat_threatId_key" ON "RiskThreat"("threatId");
CREATE UNIQUE INDEX "RiskThreat_name_key" ON "RiskThreat"("name");
CREATE TABLE "new_RiskVulnerability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vulnId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskVulnerability_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VulnerabilityCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RiskVulnerability" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "RiskVulnerability";
DROP TABLE "RiskVulnerability";
ALTER TABLE "new_RiskVulnerability" RENAME TO "RiskVulnerability";
CREATE UNIQUE INDEX "RiskVulnerability_vulnId_key" ON "RiskVulnerability"("vulnId");
CREATE UNIQUE INDEX "RiskVulnerability_name_key" ON "RiskVulnerability"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "IssueRegulation_issueId_regulationId_key" ON "IssueRegulation"("issueId", "regulationId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueProcess_issueId_processId_key" ON "IssueProcess"("issueId", "processId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueStakeholder_issueId_stakeholderId_key" ON "IssueStakeholder"("issueId", "stakeholderId");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilityCategory_name_key" ON "VulnerabilityCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ThreatCategory_name_key" ON "ThreatCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ControlStrength_name_key" ON "ControlStrength"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskLikelihood_title_key" ON "RiskLikelihood"("title");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactCategory_name_key" ON "ImpactCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactRating_name_key" ON "ImpactRating"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilityRating_label_key" ON "VulnerabilityRating"("label");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSubCategory_type_key" ON "RiskSubCategory"("type");

-- CreateIndex
CREATE UNIQUE INDEX "RiskRange_title_key" ON "RiskRange"("title");

-- CreateIndex
CREATE UNIQUE INDEX "AuditableEntity_entityCode_key" ON "AuditableEntity"("entityCode");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEngagement_auditId_key" ON "AuditEngagement"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFieldwork_engagementId_key" ON "AuditFieldwork"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReport_reportCode_key" ON "AuditReport"("reportCode");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReport_engagementId_key" ON "AuditReport"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAuditFinding_findingId_key" ON "InternalAuditFinding"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAuditCAPA_capaId_key" ON "InternalAuditCAPA"("capaId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAuditDocument_documentCode_key" ON "InternalAuditDocument"("documentCode");

-- CreateIndex
CREATE UNIQUE INDEX "_EngagementTeamMembers_AB_unique" ON "_EngagementTeamMembers"("A", "B");

-- CreateIndex
CREATE INDEX "_EngagementTeamMembers_B_index" ON "_EngagementTeamMembers"("B");
