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
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "logo" TEXT,
    "establishedDate" TEXT,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "branchCount" INTEGER NOT NULL DEFAULT 0,
    "headOfficeLocation" TEXT,
    "headOfficeAddress" TEXT,
    "website" TEXT,
    "description" TEXT,
    "vision" TEXT,
    "mission" TEXT,
    "value" TEXT,
    "ceoMessage" TEXT,
    "facebook" TEXT,
    "youtube" TEXT,
    "twitter" TEXT,
    "linkedin" TEXT,
    "brochure" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
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
    "customerCode" TEXT,
    "logoUrl" TEXT,
    "lastLogin" DATETIME,
    "departmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Stakeholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Internal',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "departmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stakeholder_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Issue" (
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
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "serviceUser" TEXT NOT NULL,
    "serviceCategory" TEXT,
    "serviceItem" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Framework" (
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
CREATE TABLE "Regulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "sa1Date" TEXT,
    "sa2Date" TEXT,
    "scope" TEXT,
    "exclusionJustification" TEXT,
    "document" TEXT,
    "certificate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Subscribed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ControlDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Control" (
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

-- CreateTable
CREATE TABLE "Process" (
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
CREATE TABLE "Policy" (
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

-- CreateTable
CREATE TABLE "Evidence" (
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
CREATE TABLE "Exception" (
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

-- CreateTable
CREATE TABLE "AssetClassification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Asset" (
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

-- CreateTable
CREATE TABLE "RiskCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    "threatId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskThreat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ThreatCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskVulnerability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vulnId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskVulnerability_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VulnerabilityCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE TABLE "Risk" (
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
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "auditType" TEXT,
    "departmentId" TEXT,
    "auditorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Audit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Audit_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "auditId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CAPA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "findingId" TEXT,
    "actionType" TEXT NOT NULL DEFAULT 'Corrective',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CAPA_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "engagementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalAuditRisk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalAuditRisk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AuditCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalAuditRisk_auditTypeId_fkey" FOREIGN KEY ("auditTypeId") REFERENCES "AuditType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalAuditRisk_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "changes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_EngagementTeamMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_EngagementTeamMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "AuditEngagement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EngagementTeamMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_scope_key" ON "Permission"("resource", "action", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IssueRegulation_issueId_regulationId_key" ON "IssueRegulation"("issueId", "regulationId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueProcess_issueId_processId_key" ON "IssueProcess"("issueId", "processId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueStakeholder_issueId_stakeholderId_key" ON "IssueStakeholder"("issueId", "stakeholderId");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_name_key" ON "Framework"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementCategory_frameworkId_name_key" ON "RequirementCategory"("frameworkId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_frameworkId_code_key" ON "Requirement"("frameworkId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementControl_requirementId_controlId_key" ON "RequirementControl"("requirementId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementException_code_key" ON "RequirementException"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Regulation_name_key" ON "Regulation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ControlDomain_name_key" ON "ControlDomain"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Control_controlCode_key" ON "Control"("controlCode");

-- CreateIndex
CREATE UNIQUE INDEX "Process_processCode_key" ON "Process"("processCode");

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
CREATE UNIQUE INDEX "Policy_code_key" ON "Policy"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_evidenceCode_key" ON "Evidence"("evidenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceControl_evidenceId_controlId_key" ON "EvidenceControl"("evidenceId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_artifactCode_key" ON "Artifact"("artifactCode");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceArtifact_evidenceId_artifactId_key" ON "EvidenceArtifact"("evidenceId", "artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "Exception_exceptionCode_key" ON "Exception"("exceptionCode");

-- CreateIndex
CREATE UNIQUE INDEX "KPI_code_key" ON "KPI"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyControl_policyId_controlId_key" ON "PolicyControl"("policyId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlRisk_controlId_riskId_key" ON "ControlRisk"("controlId", "riskId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyException_policyId_exceptionId_key" ON "PolicyException"("policyId", "exceptionId");

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

-- CreateIndex
CREATE UNIQUE INDEX "AssetClassification_name_key" ON "AssetClassification"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetId_key" ON "Asset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCategory_name_key" ON "RiskCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskType_name_key" ON "RiskType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskThreat_threatId_key" ON "RiskThreat"("threatId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskThreat_name_key" ON "RiskThreat"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskVulnerability_vulnId_key" ON "RiskVulnerability"("vulnId");

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
CREATE UNIQUE INDEX "Risk_riskId_key" ON "Risk"("riskId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_assessmentId_key" ON "RiskAssessment"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskResponse_responseId_key" ON "RiskResponse"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSetting_category_key_key" ON "RiskSetting"("category", "key");

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
CREATE UNIQUE INDEX "Audit_auditId_key" ON "Audit"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_findingId_key" ON "AuditFinding"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "CAPA_capaId_key" ON "CAPA"("capaId");

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

