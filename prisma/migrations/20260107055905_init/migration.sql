/*
  Warnings:

  - You are about to drop the column `exceptionType` on the `Exception` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Exception` table. All the data in the column will be lost.
  - Added the required column `evidenceCode` to the `Evidence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `Exception` table without a default value. This is not possible if the table is not empty.
  - Added the required column `exceptionCode` to the `Exception` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Exception` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `Policy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ControlDomain" ADD COLUMN "code" TEXT;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN "description" TEXT;
ALTER TABLE "Department" ADD COLUMN "headId" TEXT;

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "issueType" TEXT;

-- AlterTable
ALTER TABLE "Regulation" ADD COLUMN "certificate" TEXT;
ALTER TABLE "Regulation" ADD COLUMN "document" TEXT;
ALTER TABLE "Regulation" ADD COLUMN "exclusionJustification" TEXT;
ALTER TABLE "Regulation" ADD COLUMN "sa1Date" TEXT;
ALTER TABLE "Regulation" ADD COLUMN "sa2Date" TEXT;
ALTER TABLE "Regulation" ADD COLUMN "scope" TEXT;
ALTER TABLE "Regulation" ADD COLUMN "version" TEXT;

-- AlterTable
ALTER TABLE "RiskCategory" ADD COLUMN "color" TEXT;

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequirementCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "frameworkId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RequirementCategory_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requirementType" TEXT NOT NULL DEFAULT 'Mandatory',
    "chapterType" TEXT NOT NULL DEFAULT 'Domain',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "frameworkId" TEXT NOT NULL,
    "categoryId" TEXT,
    "applicability" TEXT,
    "justification" TEXT,
    "implementationStatus" TEXT,
    "controlCompliance" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Requirement_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Requirement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Requirement_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Requirement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RequirementCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequirementControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requirementId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequirementControl_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequirementControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequirementException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Compliance',
    "requirementId" TEXT NOT NULL,
    "departmentId" TEXT,
    "requesterId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RequirementException_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequirementException_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BIACategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BIARating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BIAScoringConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calculationType" TEXT NOT NULL DEFAULT 'High of all',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BIAScoringRange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "lowValue" INTEGER NOT NULL DEFAULT 0,
    "highValue" INTEGER,
    "color" TEXT,
    "calculationType" TEXT NOT NULL DEFAULT 'High of all',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BCPLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProcessBIA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "impactRating" INTEGER,
    "processCriticality" TEXT,
    "rtoHours" INTEGER NOT NULL DEFAULT 0,
    "rpoHours" INTEGER NOT NULL DEFAULT 0,
    "rtoLabel" TEXT,
    "rpoLabel" TEXT,
    "approverId" TEXT,
    "approverName" TEXT,
    "approvedAt" DATETIME,
    "comments" TEXT,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessBIA_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessBIARating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processBIAId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "rating" TEXT,
    "ratingScore" INTEGER,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessBIARating_processBIAId_fkey" FOREIGN KEY ("processBIAId") REFERENCES "ProcessBIA" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceControl_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidenceControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artifactCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedById" TEXT,
    "aiReviewStatus" TEXT,
    "aiReviewScore" REAL,
    "aiReviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Artifact_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceArtifact_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidenceArtifact_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExceptionComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExceptionComment_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "Exception" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KPI" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "objective" TEXT,
    "description" TEXT,
    "dataSource" TEXT,
    "calculationFormula" TEXT,
    "expectedScore" REAL,
    "actualScore" REAL,
    "reviewDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "departmentId" TEXT,
    "evidenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KPI_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KPI_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KPIReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewDate" DATETIME NOT NULL,
    "actualScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "documentPath" TEXT,
    "documentName" TEXT,
    "kpiId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KPIReview_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "KPI" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KPIActionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plannedAction" TEXT NOT NULL,
    "description" TEXT,
    "percentageCompleted" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'In-Progress',
    "kpiReviewId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KPIActionPlan_kpiReviewId_fkey" FOREIGN KEY ("kpiReviewId") REFERENCES "KPIReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "policyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PolicyAttachment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvidenceAttachment_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyControl_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolicyControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ControlRisk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "controlId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControlRisk_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControlRisk_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyId" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyException_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolicyException_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "Exception" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskThreat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskVulnerability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskCause" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskThreatMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riskId" TEXT NOT NULL,
    "threatId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskThreatMapping_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiskThreatMapping_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "RiskThreat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskVulnerabilityMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riskId" TEXT NOT NULL,
    "vulnerabilityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskVulnerabilityMapping_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiskVulnerabilityMapping_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "RiskVulnerability" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskCauseMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riskId" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskCauseMapping_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiskCauseMapping_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "RiskCause" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL DEFAULT 'Periodic',
    "assessorName" TEXT,
    "likelihood" INTEGER NOT NULL DEFAULT 1,
    "likelihoodRationale" TEXT,
    "impact" INTEGER NOT NULL DEFAULT 1,
    "impactRationale" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 1,
    "riskRating" TEXT NOT NULL DEFAULT 'Low',
    "threatsIdentified" TEXT,
    "vulnerabilitiesIdentified" TEXT,
    "causesIdentified" TEXT,
    "recommendations" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "assessmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskAssessment_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "responseType" TEXT NOT NULL DEFAULT 'Mitigate',
    "actionTitle" TEXT NOT NULL,
    "actionDescription" TEXT,
    "assignee" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "completionDate" DATETIME,
    "effectivenessRating" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskResponse_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riskId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "description" TEXT,
    "actor" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskActivityLog_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditNatureOfControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditRiskFactor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditProbability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditImpact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditScoringRange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "lowValue" INTEGER NOT NULL DEFAULT 0,
    "highValue" INTEGER,
    "calculationType" TEXT NOT NULL DEFAULT 'High of all',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditScoringConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "probabilityImpactCalcType" TEXT NOT NULL DEFAULT 'Product of all',
    "riskRatingCalcType" TEXT NOT NULL DEFAULT 'High of all',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditPeriodicity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interval" TEXT NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditEscalationConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseSubmission" INTEGER NOT NULL DEFAULT 5,
    "acknowledgement" INTEGER NOT NULL DEFAULT 1,
    "clarification" INTEGER NOT NULL DEFAULT 2,
    "issueResolution" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InternalAuditRisk" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalAuditRisk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalAuditRisk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AuditCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalAuditRisk_auditTypeId_fkey" FOREIGN KEY ("auditTypeId") REFERENCES "AuditType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GovernanceTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "governanceType" TEXT NOT NULL DEFAULT 'Policy',
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Control_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ControlDomain" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Control_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Control_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Control_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Control_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Control" ("assigneeId", "controlCode", "controlQuestion", "createdAt", "departmentId", "description", "domainId", "frameworkId", "functionalGrouping", "id", "name", "ownerId", "status", "updatedAt") SELECT "assigneeId", "controlCode", "controlQuestion", "createdAt", "departmentId", "description", "domainId", "frameworkId", "functionalGrouping", "id", "name", "ownerId", "status", "updatedAt" FROM "Control";
DROP TABLE "Control";
ALTER TABLE "new_Control" RENAME TO "Control";
CREATE UNIQUE INDEX "Control_controlCode_key" ON "Control"("controlCode");
CREATE TABLE "new_Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "frameworkId" TEXT,
    "controlId" TEXT,
    "departmentId" TEXT,
    "assigneeId" TEXT,
    "dueDate" DATETIME,
    "reviewDate" DATETIME,
    "recurrence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Uploaded',
    "publishedAt" DATETIME,
    "kpiRequired" BOOLEAN NOT NULL DEFAULT false,
    "kpiObjective" TEXT,
    "kpiDataSource" TEXT,
    "kpiExpectedScore" REAL,
    "kpiDescription" TEXT,
    "kpiCalculationFormula" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Evidence_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evidence_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evidence_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evidence_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Evidence" ("assigneeId", "controlId", "createdAt", "departmentId", "description", "dueDate", "frameworkId", "id", "name", "status", "updatedAt") SELECT "assigneeId", "controlId", "createdAt", "departmentId", "description", "dueDate", "frameworkId", "id", "name", "status", "updatedAt" FROM "Evidence";
DROP TABLE "Evidence";
ALTER TABLE "new_Evidence" RENAME TO "Evidence";
CREATE UNIQUE INDEX "Evidence_evidenceCode_key" ON "Evidence"("evidenceCode");
CREATE TABLE "new_Exception" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exceptionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "departmentId" TEXT,
    "controlId" TEXT,
    "policyId" TEXT,
    "riskId" TEXT,
    "requesterId" TEXT,
    "approverId" TEXT,
    "approvedBy" TEXT,
    "approvedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Exception_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exception_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exception_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exception_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exception_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exception_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Exception" ("controlId", "createdAt", "departmentId", "description", "endDate", "id", "startDate", "status", "updatedAt") SELECT "controlId", "createdAt", "departmentId", "description", "endDate", "id", "startDate", "status", "updatedAt" FROM "Exception";
DROP TABLE "Exception";
ALTER TABLE "new_Exception" RENAME TO "Exception";
CREATE UNIQUE INDEX "Exception_exceptionCode_key" ON "Exception"("exceptionCode");
CREATE TABLE "new_Framework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Framework',
    "status" TEXT NOT NULL DEFAULT 'Subscribed',
    "country" TEXT,
    "industry" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "logo" TEXT,
    "supportDocumentUrl" TEXT,
    "compliancePercentage" REAL NOT NULL DEFAULT 0,
    "policyPercentage" REAL NOT NULL DEFAULT 0,
    "evidencePercentage" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Framework" ("createdAt", "description", "id", "logo", "name", "status", "updatedAt", "version") SELECT "createdAt", "description", "id", "logo", "name", "status", "updatedAt", "version" FROM "Framework";
DROP TABLE "Framework";
ALTER TABLE "new_Framework" RENAME TO "Framework";
CREATE UNIQUE INDEX "Framework_name_key" ON "Framework"("name");
CREATE TABLE "new_Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "documentType" TEXT NOT NULL DEFAULT 'Policy',
    "recurrence" TEXT,
    "departmentId" TEXT,
    "assigneeId" TEXT,
    "approverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Uploaded',
    "effectiveDate" DATETIME,
    "reviewDate" DATETIME,
    "content" TEXT,
    "aiReviewStatus" TEXT DEFAULT 'Pending',
    "aiReviewScore" REAL DEFAULT 0,
    "aiReviewJustification" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Policy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Policy_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Policy_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Policy" ("content", "createdAt", "departmentId", "documentType", "effectiveDate", "id", "name", "reviewDate", "status", "updatedAt", "version") SELECT "content", "createdAt", "departmentId", "documentType", "effectiveDate", "id", "name", "reviewDate", "status", "updatedAt", "version" FROM "Policy";
DROP TABLE "Policy";
ALTER TABLE "new_Policy" RENAME TO "Policy";
CREATE UNIQUE INDEX "Policy_code_key" ON "Policy"("code");
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
    CONSTRAINT "Process_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Process" ("createdAt", "departmentId", "description", "id", "name", "ownerId", "processCode", "processType", "status", "updatedAt") SELECT "createdAt", "departmentId", "description", "id", "name", "ownerId", "processCode", "processType", "status", "updatedAt" FROM "Process";
DROP TABLE "Process";
ALTER TABLE "new_Process" RENAME TO "Process";
CREATE UNIQUE INDEX "Process_processCode_key" ON "Process"("processCode");
CREATE TABLE "new_Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "riskSources" TEXT,
    "categoryId" TEXT,
    "typeId" TEXT,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "likelihood" INTEGER NOT NULL DEFAULT 1,
    "impact" INTEGER NOT NULL DEFAULT 1,
    "riskScore" INTEGER NOT NULL DEFAULT 1,
    "riskRating" TEXT NOT NULL DEFAULT 'Low',
    "inherentLikelihood" INTEGER,
    "inherentImpact" INTEGER,
    "inherentRiskScore" INTEGER,
    "residualLikelihood" INTEGER,
    "residualImpact" INTEGER,
    "residualRiskScore" INTEGER,
    "targetLikelihood" INTEGER,
    "targetImpact" INTEGER,
    "targetRiskScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "responseStrategy" TEXT,
    "treatmentPlan" TEXT,
    "treatmentDueDate" DATETIME,
    "treatmentStatus" TEXT,
    "identifiedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAssessmentDate" DATETIME,
    "nextReviewDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Risk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RiskCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Risk_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "RiskType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Risk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Risk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Risk" ("categoryId", "createdAt", "departmentId", "description", "id", "impact", "likelihood", "name", "ownerId", "responseStrategy", "riskId", "riskRating", "status", "updatedAt") SELECT "categoryId", "createdAt", "departmentId", "description", "id", "impact", "likelihood", "name", "ownerId", "responseStrategy", "riskId", "riskRating", "status", "updatedAt" FROM "Risk";
DROP TABLE "Risk";
ALTER TABLE "new_Risk" RENAME TO "Risk";
CREATE UNIQUE INDEX "Risk_riskId_key" ON "Risk"("riskId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "designation" TEXT,
    "function" TEXT,
    "role" TEXT NOT NULL DEFAULT 'User',
    "language" TEXT NOT NULL DEFAULT 'English',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "departmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "departmentId", "designation", "email", "firstName", "fullName", "function", "id", "isActive", "isBlocked", "language", "lastName", "password", "role", "timezone", "updatedAt", "userName") SELECT "createdAt", "departmentId", "designation", "email", "firstName", "fullName", "function", "id", "isActive", "isBlocked", "language", "lastName", "password", "role", "timezone", "updatedAt", "userName" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_scope_key" ON "Permission"("resource", "action", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementCategory_frameworkId_name_key" ON "RequirementCategory"("frameworkId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_frameworkId_code_key" ON "Requirement"("frameworkId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementControl_requirementId_controlId_key" ON "RequirementControl"("requirementId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementException_code_key" ON "RequirementException"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BIACategory_name_key" ON "BIACategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BIARating_label_key" ON "BIARating"("label");

-- CreateIndex
CREATE UNIQUE INDEX "BIAScoringRange_label_calculationType_key" ON "BIAScoringRange"("label", "calculationType");

-- CreateIndex
CREATE UNIQUE INDEX "BCPLabel_name_key" ON "BCPLabel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessBIA_processId_key" ON "ProcessBIA"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessBIARating_processBIAId_categoryName_key" ON "ProcessBIARating"("processBIAId", "categoryName");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceControl_evidenceId_controlId_key" ON "EvidenceControl"("evidenceId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_artifactCode_key" ON "Artifact"("artifactCode");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceArtifact_evidenceId_artifactId_key" ON "EvidenceArtifact"("evidenceId", "artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "KPI_code_key" ON "KPI"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyControl_policyId_controlId_key" ON "PolicyControl"("policyId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlRisk_controlId_riskId_key" ON "ControlRisk"("controlId", "riskId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyException_policyId_exceptionId_key" ON "PolicyException"("policyId", "exceptionId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskType_name_key" ON "RiskType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskThreat_name_key" ON "RiskThreat"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskVulnerability_name_key" ON "RiskVulnerability"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCause_name_key" ON "RiskCause"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskThreatMapping_riskId_threatId_key" ON "RiskThreatMapping"("riskId", "threatId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskVulnerabilityMapping_riskId_vulnerabilityId_key" ON "RiskVulnerabilityMapping"("riskId", "vulnerabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCauseMapping_riskId_causeId_key" ON "RiskCauseMapping"("riskId", "causeId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_assessmentId_key" ON "RiskAssessment"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskResponse_responseId_key" ON "RiskResponse"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSetting_category_key_key" ON "RiskSetting"("category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AuditCategory_name_key" ON "AuditCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AuditNatureOfControl_label_key" ON "AuditNatureOfControl"("label");

-- CreateIndex
CREATE UNIQUE INDEX "AuditRiskFactor_label_key" ON "AuditRiskFactor"("label");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProbability_label_key" ON "AuditProbability"("label");

-- CreateIndex
CREATE UNIQUE INDEX "AuditImpact_label_key" ON "AuditImpact"("label");

-- CreateIndex
CREATE UNIQUE INDEX "AuditScoringRange_label_calculationType_key" ON "AuditScoringRange"("label", "calculationType");

-- CreateIndex
CREATE UNIQUE INDEX "AuditPeriodicity_interval_key" ON "AuditPeriodicity"("interval");

-- CreateIndex
CREATE UNIQUE INDEX "AuditType_name_key" ON "AuditType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAuditRisk_riskId_key" ON "InternalAuditRisk"("riskId");
