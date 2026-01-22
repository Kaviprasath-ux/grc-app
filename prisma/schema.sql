-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "maxFrameworksAllowed" INTEGER NOT NULL DEFAULT 0,
    "maxAccountsAllowed" INTEGER NOT NULL DEFAULT 0,
    "frameworksUsed" INTEGER NOT NULL DEFAULT 0,
    "accountsUsed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCenter" (
    "id" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "address" TEXT,
    "vendor" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
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
    "customerAccountId" TEXT,
    "customerCode" TEXT,
    "logoUrl" TEXT,
    "lastLogin" TIMESTAMP(3),
    "departmentId" TEXT,
    "auditHeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stakeholder" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Internal',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "issueType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "dueDate" TIMESTAMP(3),
    "departmentId" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueAction" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueActionComment" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueActionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueRegulation" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueRegulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueProcess" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueStakeholder" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "needExpectation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueStakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "serviceUser" TEXT NOT NULL,
    "serviceCategory" TEXT,
    "serviceItem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "code" TEXT,
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
    "compliancePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "policyPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidencePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Framework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementCategory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "frameworkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementControl" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementException" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Compliance',
    "requirementId" TEXT NOT NULL,
    "departmentId" TEXT,
    "requesterId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regulation" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "sa1Date" TEXT,
    "sa2Date" TEXT,
    "scope" TEXT,
    "exclusionJustification" TEXT,
    "document" TEXT,
    "certificate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Subscribed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Regulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlDomain" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "lastAuditDate" TIMESTAMP(3),
    "responsibleId" TEXT,
    "accountableId" TEXT,
    "consultedId" TEXT,
    "informedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BIACategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BIACategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BIARating" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BIARating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BIAScoringConfig" (
    "id" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'High of all',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BIAScoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BIAScoringRange" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lowValue" INTEGER NOT NULL DEFAULT 0,
    "highValue" INTEGER,
    "color" TEXT,
    "calculationType" TEXT NOT NULL DEFAULT 'High of all',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BIAScoringRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BCPLabel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BCPLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessBIA" (
    "id" TEXT NOT NULL,
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
    "approvedAt" TIMESTAMP(3),
    "comments" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessBIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessBIAComment" (
    "id" TEXT NOT NULL,
    "processBIAId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessBIAComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessBIARating" (
    "id" TEXT NOT NULL,
    "processBIAId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "rating" TEXT,
    "ratingScore" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessBIARating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "documentType" TEXT NOT NULL DEFAULT 'Policy',
    "recurrence" TEXT,
    "departmentId" TEXT,
    "assigneeId" TEXT,
    "approverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Uploaded',
    "effectiveDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "content" TEXT,
    "aiReviewStatus" TEXT DEFAULT 'Pending',
    "aiReviewScore" DOUBLE PRECISION DEFAULT 0,
    "aiReviewJustification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "evidenceCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "frameworkId" TEXT,
    "controlId" TEXT,
    "departmentId" TEXT,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "recurrence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Uploaded',
    "publishedAt" TIMESTAMP(3),
    "kpiRequired" BOOLEAN NOT NULL DEFAULT false,
    "kpiObjective" TEXT,
    "kpiDataSource" TEXT,
    "kpiExpectedScore" DOUBLE PRECISION,
    "kpiDescription" TEXT,
    "kpiCalculationFormula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceControl" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "artifactCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedById" TEXT,
    "aiReviewStatus" TEXT,
    "aiReviewScore" DOUBLE PRECISION,
    "aiReviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceArtifact" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "approvedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExceptionComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExceptionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPI" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "objective" TEXT,
    "description" TEXT,
    "dataSource" TEXT,
    "calculationFormula" TEXT,
    "expectedScore" DOUBLE PRECISION,
    "actualScore" DOUBLE PRECISION,
    "reviewDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "departmentId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIReview" (
    "id" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "actualScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "documentPath" TEXT,
    "documentName" TEXT,
    "kpiId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPIReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIActionPlan" (
    "id" TEXT NOT NULL,
    "plannedAction" TEXT NOT NULL,
    "description" TEXT,
    "percentageCompleted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'In-Progress',
    "kpiReviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPIActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAttachment" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "policyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAttachment" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyControl" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlRisk" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyException" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSubCategory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetSubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetGroup" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CIARating" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CIARating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSensitivity" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetSensitivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCIAClassification" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCIAClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetLifecycleStatus" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetLifecycleStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetClassification" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "value" DOUBLE PRECISION,
    "location" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskCategory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskType" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskThreat" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "threatId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskThreat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskVulnerability" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "vulnId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskVulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskCause" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskCause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskThreatMapping" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "threatId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskThreatMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskVulnerabilityMapping" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "vulnerabilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskVulnerabilityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskCauseMapping" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskCauseMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "riskSources" TEXT,
    "categoryId" TEXT,
    "typeId" TEXT,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "impactedAssetId" TEXT,
    "impactedProcessId" TEXT,
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
    "assessmentStatus" TEXT NOT NULL DEFAULT 'Open',
    "responseStatus" TEXT NOT NULL DEFAULT 'Open',
    "responseStrategy" TEXT,
    "treatmentPlan" TEXT,
    "treatmentDueDate" TIMESTAMP(3),
    "treatmentStatus" TEXT,
    "assessmentFormData" TEXT,
    "identifiedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAssessmentDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskControlMatrixEntry" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "riskId" TEXT,
    "matrixEntryId" TEXT NOT NULL,
    "riskCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "riskRating" TEXT,
    "residualRiskRating" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "ownerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskControlMatrixEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskControlMatrixControl" (
    "id" TEXT NOT NULL,
    "riskControlMatrixEntryId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskControlMatrixControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskResponse" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "responseType" TEXT NOT NULL DEFAULT 'Mitigate',
    "actionTitle" TEXT NOT NULL,
    "actionDescription" TEXT,
    "assignee" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Open',
    "completionDate" TIMESTAMP(3),
    "effectivenessRating" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSetting" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VulnerabilityCategory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VulnerabilityCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatCategory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreatCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlStrength" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlStrength_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskLikelihood" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "title" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "timeFrame" TEXT,
    "probability" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskLikelihood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactCategory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactRating" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VulnerabilityRating" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VulnerabilityRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSubCategory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskRange" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "title" TEXT NOT NULL,
    "color" TEXT,
    "lowRange" INTEGER NOT NULL DEFAULT 0,
    "highRange" INTEGER NOT NULL DEFAULT 0,
    "timelineDays" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScoreConfig" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "useLikelihood" BOOLEAN NOT NULL DEFAULT true,
    "useImpact" BOOLEAN NOT NULL DEFAULT true,
    "useAssetScore" BOOLEAN NOT NULL DEFAULT false,
    "useVulnerabilityScore" BOOLEAN NOT NULL DEFAULT false,
    "riskTolerance" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskScoreConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskActivityLog" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "description" TEXT,
    "actor" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "auditType" TEXT,
    "departmentId" TEXT,
    "auditorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "auditId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAPA" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "findingId" TEXT,
    "actionType" TEXT NOT NULL DEFAULT 'Corrective',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CAPA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditCategory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditNatureOfControl" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditNatureOfControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRiskFactor" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditRiskFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProbability" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditProbability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditImpact" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditScoringRange" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "label" TEXT NOT NULL,
    "lowValue" INTEGER NOT NULL DEFAULT 0,
    "highValue" INTEGER,
    "calculationType" TEXT NOT NULL DEFAULT 'High of all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditScoringRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditScoringConfig" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "probabilityImpactCalcType" TEXT NOT NULL DEFAULT 'Product of all',
    "riskRatingCalcType" TEXT NOT NULL DEFAULT 'High of all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditScoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditPeriodicity" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "interval" TEXT NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditPeriodicity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEscalationConfig" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "responseSubmission" INTEGER NOT NULL DEFAULT 5,
    "acknowledgement" INTEGER NOT NULL DEFAULT 1,
    "clarification" INTEGER NOT NULL DEFAULT 2,
    "issueResolution" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditEscalationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditType" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAuditRisk" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "creationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditComment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "evidenceFilePath" TEXT,
    "evidenceFileName" TEXT,
    "engagementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalAuditRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditableEntity" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "entityCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "plannedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastAuditDate" TIMESTAMP(3),
    "nextAuditDate" TIMESTAMP(3),
    "riskRating" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditableEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEngagement" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "plannedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "initialObservation" TEXT,
    "relatedPolicies" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "year" INTEGER NOT NULL DEFAULT 2026,
    "quarter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFieldwork" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "scope" TEXT,
    "objectives" TEXT,
    "methodology" TEXT,
    "observations" TEXT,
    "hoursSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFieldwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditWorkpaper" (
    "id" TEXT NOT NULL,
    "fieldworkId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "description" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditWorkpaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldworkEvidenceRequest" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sampleSize" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "aiReviewStatus" TEXT,
    "aiReviewComment" TEXT,
    "dueDate" TIMESTAMP(3),
    "category" TEXT,
    "documentType" TEXT,
    "auditeeId" TEXT,
    "auditeeName" TEXT,
    "clarificationComment" TEXT,
    "clarificationDocumentName" TEXT,
    "clarificationByUserId" TEXT,
    "clarificationByUserName" TEXT,
    "clarificationSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldworkEvidenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldworkEvidenceAttachment" (
    "id" TEXT NOT NULL,
    "evidenceRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldworkEvidenceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditReport" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "draftGeneratedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "auditeeId" TEXT,
    "auditeeName" TEXT,
    "auditeeComment" TEXT,
    "reportFilePath" TEXT,
    "reportFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAuditFinding" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
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
    "identifiedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" TIMESTAMP(3),
    "closedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalAuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingAttachment" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FindingAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAuditCAPA" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actionType" TEXT NOT NULL DEFAULT 'Corrective',
    "responsiblePerson" TEXT,
    "targetDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Open',
    "evidenceFilePath" TEXT,
    "evidenceFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalAuditCAPA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAuditDocument" (
    "id" TEXT NOT NULL,
    "documentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Policy',
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalAuditDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSearch" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "result" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Satisfactory',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "governanceType" TEXT NOT NULL DEFAULT 'Policy',
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "changes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EngagementTeamMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_code_key" ON "CustomerAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_scope_key" ON "Permission"("resource", "action", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "Organization_customerAccountId_idx" ON "Organization"("customerAccountId");

-- CreateIndex
CREATE INDEX "Department_customerAccountId_idx" ON "Department"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_customerAccountId_name_key" ON "Department"("customerAccountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Stakeholder_customerAccountId_idx" ON "Stakeholder"("customerAccountId");

-- CreateIndex
CREATE INDEX "Issue_customerAccountId_idx" ON "Issue"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueRegulation_issueId_regulationId_key" ON "IssueRegulation"("issueId", "regulationId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueProcess_issueId_processId_key" ON "IssueProcess"("issueId", "processId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueStakeholder_issueId_stakeholderId_key" ON "IssueStakeholder"("issueId", "stakeholderId");

-- CreateIndex
CREATE INDEX "Service_customerAccountId_idx" ON "Service"("customerAccountId");

-- CreateIndex
CREATE INDEX "Framework_customerAccountId_idx" ON "Framework"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_customerAccountId_name_key" ON "Framework"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "RequirementCategory_customerAccountId_idx" ON "RequirementCategory"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementCategory_frameworkId_name_key" ON "RequirementCategory"("frameworkId", "name");

-- CreateIndex
CREATE INDEX "Requirement_customerAccountId_idx" ON "Requirement"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_frameworkId_code_key" ON "Requirement"("frameworkId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementControl_requirementId_controlId_key" ON "RequirementControl"("requirementId", "controlId");

-- CreateIndex
CREATE INDEX "RequirementException_customerAccountId_idx" ON "RequirementException"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementException_customerAccountId_code_key" ON "RequirementException"("customerAccountId", "code");

-- CreateIndex
CREATE INDEX "Regulation_customerAccountId_idx" ON "Regulation"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Regulation_customerAccountId_name_key" ON "Regulation"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "ControlDomain_customerAccountId_idx" ON "ControlDomain"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlDomain_customerAccountId_name_key" ON "ControlDomain"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "Control_customerAccountId_idx" ON "Control"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Control_customerAccountId_controlCode_key" ON "Control"("customerAccountId", "controlCode");

-- CreateIndex
CREATE INDEX "Process_customerAccountId_idx" ON "Process"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Process_customerAccountId_processCode_key" ON "Process"("customerAccountId", "processCode");

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
CREATE INDEX "Policy_customerAccountId_idx" ON "Policy"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_customerAccountId_code_key" ON "Policy"("customerAccountId", "code");

-- CreateIndex
CREATE INDEX "Evidence_customerAccountId_idx" ON "Evidence"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_customerAccountId_evidenceCode_key" ON "Evidence"("customerAccountId", "evidenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceControl_evidenceId_controlId_key" ON "EvidenceControl"("evidenceId", "controlId");

-- CreateIndex
CREATE INDEX "Artifact_customerAccountId_idx" ON "Artifact"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_customerAccountId_artifactCode_key" ON "Artifact"("customerAccountId", "artifactCode");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceArtifact_evidenceId_artifactId_key" ON "EvidenceArtifact"("evidenceId", "artifactId");

-- CreateIndex
CREATE INDEX "Exception_customerAccountId_idx" ON "Exception"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Exception_customerAccountId_exceptionCode_key" ON "Exception"("customerAccountId", "exceptionCode");

-- CreateIndex
CREATE INDEX "KPI_customerAccountId_idx" ON "KPI"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "KPI_customerAccountId_code_key" ON "KPI"("customerAccountId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyControl_policyId_controlId_key" ON "PolicyControl"("policyId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlRisk_controlId_riskId_key" ON "ControlRisk"("controlId", "riskId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyException_policyId_exceptionId_key" ON "PolicyException"("policyId", "exceptionId");

-- CreateIndex
CREATE INDEX "AssetCategory_customerAccountId_idx" ON "AssetCategory"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_customerAccountId_name_key" ON "AssetCategory"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "AssetSubCategory_customerAccountId_idx" ON "AssetSubCategory"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSubCategory_customerAccountId_name_categoryId_key" ON "AssetSubCategory"("customerAccountId", "name", "categoryId");

-- CreateIndex
CREATE INDEX "AssetGroup_customerAccountId_idx" ON "AssetGroup"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetGroup_customerAccountId_name_key" ON "AssetGroup"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "CIARating_customerAccountId_idx" ON "CIARating"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CIARating_customerAccountId_type_label_key" ON "CIARating"("customerAccountId", "type", "label");

-- CreateIndex
CREATE INDEX "AssetSensitivity_customerAccountId_idx" ON "AssetSensitivity"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSensitivity_customerAccountId_name_key" ON "AssetSensitivity"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "AssetCIAClassification_customerAccountId_idx" ON "AssetCIAClassification"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCIAClassification_customerAccountId_subCategoryId_grou_key" ON "AssetCIAClassification"("customerAccountId", "subCategoryId", "groupId");

-- CreateIndex
CREATE INDEX "AssetLifecycleStatus_customerAccountId_idx" ON "AssetLifecycleStatus"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLifecycleStatus_customerAccountId_name_key" ON "AssetLifecycleStatus"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "AssetClassification_customerAccountId_idx" ON "AssetClassification"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetClassification_customerAccountId_name_key" ON "AssetClassification"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "Asset_customerAccountId_idx" ON "Asset"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_customerAccountId_assetId_key" ON "Asset"("customerAccountId", "assetId");

-- CreateIndex
CREATE INDEX "RiskCategory_customerAccountId_idx" ON "RiskCategory"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCategory_customerAccountId_name_key" ON "RiskCategory"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "RiskType_customerAccountId_idx" ON "RiskType"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskType_customerAccountId_name_key" ON "RiskType"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "RiskThreat_customerAccountId_idx" ON "RiskThreat"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskThreat_customerAccountId_name_key" ON "RiskThreat"("customerAccountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskThreat_customerAccountId_threatId_key" ON "RiskThreat"("customerAccountId", "threatId");

-- CreateIndex
CREATE INDEX "RiskVulnerability_customerAccountId_idx" ON "RiskVulnerability"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskVulnerability_customerAccountId_name_key" ON "RiskVulnerability"("customerAccountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskVulnerability_customerAccountId_vulnId_key" ON "RiskVulnerability"("customerAccountId", "vulnId");

-- CreateIndex
CREATE INDEX "RiskCause_customerAccountId_idx" ON "RiskCause"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCause_customerAccountId_name_key" ON "RiskCause"("customerAccountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RiskThreatMapping_riskId_threatId_key" ON "RiskThreatMapping"("riskId", "threatId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskVulnerabilityMapping_riskId_vulnerabilityId_key" ON "RiskVulnerabilityMapping"("riskId", "vulnerabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCauseMapping_riskId_causeId_key" ON "RiskCauseMapping"("riskId", "causeId");

-- CreateIndex
CREATE INDEX "Risk_customerAccountId_idx" ON "Risk"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_customerAccountId_riskId_key" ON "Risk"("customerAccountId", "riskId");

-- CreateIndex
CREATE INDEX "RiskControlMatrixEntry_customerAccountId_idx" ON "RiskControlMatrixEntry"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskControlMatrixEntry_customerAccountId_matrixEntryId_key" ON "RiskControlMatrixEntry"("customerAccountId", "matrixEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskControlMatrixControl_riskControlMatrixEntryId_controlId_key" ON "RiskControlMatrixControl"("riskControlMatrixEntryId", "controlId");

-- CreateIndex
CREATE INDEX "RiskAssessment_customerAccountId_idx" ON "RiskAssessment"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_customerAccountId_assessmentId_key" ON "RiskAssessment"("customerAccountId", "assessmentId");

-- CreateIndex
CREATE INDEX "RiskResponse_customerAccountId_idx" ON "RiskResponse"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskResponse_customerAccountId_responseId_key" ON "RiskResponse"("customerAccountId", "responseId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSetting_category_key_key" ON "RiskSetting"("category", "key");

-- CreateIndex
CREATE INDEX "VulnerabilityCategory_customerAccountId_idx" ON "VulnerabilityCategory"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilityCategory_customerAccountId_name_key" ON "VulnerabilityCategory"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "ThreatCategory_customerAccountId_idx" ON "ThreatCategory"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreatCategory_customerAccountId_name_key" ON "ThreatCategory"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "ControlStrength_customerAccountId_idx" ON "ControlStrength"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlStrength_customerAccountId_name_key" ON "ControlStrength"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "RiskLikelihood_customerAccountId_idx" ON "RiskLikelihood"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskLikelihood_customerAccountId_title_key" ON "RiskLikelihood"("customerAccountId", "title");

-- CreateIndex
CREATE INDEX "ImpactCategory_customerAccountId_idx" ON "ImpactCategory"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactCategory_customerAccountId_name_key" ON "ImpactCategory"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "ImpactRating_customerAccountId_idx" ON "ImpactRating"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactRating_customerAccountId_name_key" ON "ImpactRating"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "VulnerabilityRating_customerAccountId_idx" ON "VulnerabilityRating"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilityRating_customerAccountId_label_key" ON "VulnerabilityRating"("customerAccountId", "label");

-- CreateIndex
CREATE INDEX "RiskSubCategory_customerAccountId_idx" ON "RiskSubCategory"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSubCategory_customerAccountId_type_key" ON "RiskSubCategory"("customerAccountId", "type");

-- CreateIndex
CREATE INDEX "RiskRange_customerAccountId_idx" ON "RiskRange"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskRange_customerAccountId_title_key" ON "RiskRange"("customerAccountId", "title");

-- CreateIndex
CREATE INDEX "RiskScoreConfig_customerAccountId_idx" ON "RiskScoreConfig"("customerAccountId");

-- CreateIndex
CREATE INDEX "Audit_customerAccountId_idx" ON "Audit"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Audit_customerAccountId_auditId_key" ON "Audit"("customerAccountId", "auditId");

-- CreateIndex
CREATE INDEX "AuditFinding_customerAccountId_idx" ON "AuditFinding"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_customerAccountId_findingId_key" ON "AuditFinding"("customerAccountId", "findingId");

-- CreateIndex
CREATE INDEX "CAPA_customerAccountId_idx" ON "CAPA"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CAPA_customerAccountId_capaId_key" ON "CAPA"("customerAccountId", "capaId");

-- CreateIndex
CREATE INDEX "AuditCategory_customerAccountId_idx" ON "AuditCategory"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditCategory_customerAccountId_name_key" ON "AuditCategory"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "AuditNatureOfControl_customerAccountId_idx" ON "AuditNatureOfControl"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditNatureOfControl_customerAccountId_label_key" ON "AuditNatureOfControl"("customerAccountId", "label");

-- CreateIndex
CREATE INDEX "AuditRiskFactor_customerAccountId_idx" ON "AuditRiskFactor"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditRiskFactor_customerAccountId_label_key" ON "AuditRiskFactor"("customerAccountId", "label");

-- CreateIndex
CREATE INDEX "AuditProbability_customerAccountId_idx" ON "AuditProbability"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProbability_customerAccountId_label_key" ON "AuditProbability"("customerAccountId", "label");

-- CreateIndex
CREATE INDEX "AuditImpact_customerAccountId_idx" ON "AuditImpact"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditImpact_customerAccountId_label_key" ON "AuditImpact"("customerAccountId", "label");

-- CreateIndex
CREATE INDEX "AuditScoringRange_customerAccountId_idx" ON "AuditScoringRange"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditScoringRange_customerAccountId_label_calculationType_key" ON "AuditScoringRange"("customerAccountId", "label", "calculationType");

-- CreateIndex
CREATE INDEX "AuditScoringConfig_customerAccountId_idx" ON "AuditScoringConfig"("customerAccountId");

-- CreateIndex
CREATE INDEX "AuditPeriodicity_customerAccountId_idx" ON "AuditPeriodicity"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditPeriodicity_customerAccountId_interval_key" ON "AuditPeriodicity"("customerAccountId", "interval");

-- CreateIndex
CREATE INDEX "AuditEscalationConfig_customerAccountId_idx" ON "AuditEscalationConfig"("customerAccountId");

-- CreateIndex
CREATE INDEX "AuditType_customerAccountId_idx" ON "AuditType"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditType_customerAccountId_name_key" ON "AuditType"("customerAccountId", "name");

-- CreateIndex
CREATE INDEX "InternalAuditRisk_customerAccountId_idx" ON "InternalAuditRisk"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAuditRisk_customerAccountId_riskId_key" ON "InternalAuditRisk"("customerAccountId", "riskId");

-- CreateIndex
CREATE INDEX "AuditableEntity_customerAccountId_idx" ON "AuditableEntity"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditableEntity_customerAccountId_entityCode_key" ON "AuditableEntity"("customerAccountId", "entityCode");

-- CreateIndex
CREATE INDEX "AuditEngagement_customerAccountId_idx" ON "AuditEngagement"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEngagement_customerAccountId_auditId_key" ON "AuditEngagement"("customerAccountId", "auditId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFieldwork_engagementId_key" ON "AuditFieldwork"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReport_engagementId_key" ON "AuditReport"("engagementId");

-- CreateIndex
CREATE INDEX "AuditReport_customerAccountId_idx" ON "AuditReport"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReport_customerAccountId_reportCode_key" ON "AuditReport"("customerAccountId", "reportCode");

-- CreateIndex
CREATE INDEX "InternalAuditFinding_customerAccountId_idx" ON "InternalAuditFinding"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAuditFinding_customerAccountId_findingId_key" ON "InternalAuditFinding"("customerAccountId", "findingId");

-- CreateIndex
CREATE INDEX "InternalAuditCAPA_customerAccountId_idx" ON "InternalAuditCAPA"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAuditCAPA_customerAccountId_capaId_key" ON "InternalAuditCAPA"("customerAccountId", "capaId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAuditDocument_documentCode_key" ON "InternalAuditDocument"("documentCode");

-- CreateIndex
CREATE UNIQUE INDEX "_EngagementTeamMembers_AB_unique" ON "_EngagementTeamMembers"("A", "B");

-- CreateIndex
CREATE INDEX "_EngagementTeamMembers_B_index" ON "_EngagementTeamMembers"("B");

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataCenter" ADD CONSTRAINT "DataCenter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudProvider" ADD CONSTRAINT "CloudProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_auditHeadId_fkey" FOREIGN KEY ("auditHeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stakeholder" ADD CONSTRAINT "Stakeholder_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stakeholder" ADD CONSTRAINT "Stakeholder_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueAction" ADD CONSTRAINT "IssueAction_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueAction" ADD CONSTRAINT "IssueAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueActionComment" ADD CONSTRAINT "IssueActionComment_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "IssueAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueRegulation" ADD CONSTRAINT "IssueRegulation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueRegulation" ADD CONSTRAINT "IssueRegulation_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "Regulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueProcess" ADD CONSTRAINT "IssueProcess_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueProcess" ADD CONSTRAINT "IssueProcess_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueStakeholder" ADD CONSTRAINT "IssueStakeholder_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueStakeholder" ADD CONSTRAINT "IssueStakeholder_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Framework" ADD CONSTRAINT "Framework_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCategory" ADD CONSTRAINT "RequirementCategory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCategory" ADD CONSTRAINT "RequirementCategory_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RequirementCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementControl" ADD CONSTRAINT "RequirementControl_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementControl" ADD CONSTRAINT "RequirementControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementException" ADD CONSTRAINT "RequirementException_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementException" ADD CONSTRAINT "RequirementException_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementException" ADD CONSTRAINT "RequirementException_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Regulation" ADD CONSTRAINT "Regulation_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlDomain" ADD CONSTRAINT "ControlDomain_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ControlDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_accountableId_fkey" FOREIGN KEY ("accountableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_consultedId_fkey" FOREIGN KEY ("consultedId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_informedId_fkey" FOREIGN KEY ("informedId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessBIA" ADD CONSTRAINT "ProcessBIA_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessBIAComment" ADD CONSTRAINT "ProcessBIAComment_processBIAId_fkey" FOREIGN KEY ("processBIAId") REFERENCES "ProcessBIA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessBIARating" ADD CONSTRAINT "ProcessBIARating_processBIAId_fkey" FOREIGN KEY ("processBIAId") REFERENCES "ProcessBIA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceControl" ADD CONSTRAINT "EvidenceControl_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceControl" ADD CONSTRAINT "EvidenceControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceArtifact" ADD CONSTRAINT "EvidenceArtifact_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceArtifact" ADD CONSTRAINT "EvidenceArtifact_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionComment" ADD CONSTRAINT "ExceptionComment_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "Exception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPI" ADD CONSTRAINT "KPI_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPI" ADD CONSTRAINT "KPI_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPI" ADD CONSTRAINT "KPI_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIReview" ADD CONSTRAINT "KPIReview_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "KPI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIActionPlan" ADD CONSTRAINT "KPIActionPlan_kpiReviewId_fkey" FOREIGN KEY ("kpiReviewId") REFERENCES "KPIReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAttachment" ADD CONSTRAINT "PolicyAttachment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAttachment" ADD CONSTRAINT "EvidenceAttachment_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyControl" ADD CONSTRAINT "PolicyControl_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyControl" ADD CONSTRAINT "PolicyControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlRisk" ADD CONSTRAINT "ControlRisk_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlRisk" ADD CONSTRAINT "ControlRisk_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyException" ADD CONSTRAINT "PolicyException_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyException" ADD CONSTRAINT "PolicyException_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "Exception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSubCategory" ADD CONSTRAINT "AssetSubCategory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSubCategory" ADD CONSTRAINT "AssetSubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CIARating" ADD CONSTRAINT "CIARating_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSensitivity" ADD CONSTRAINT "AssetSensitivity_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCIAClassification" ADD CONSTRAINT "AssetCIAClassification_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCIAClassification" ADD CONSTRAINT "AssetCIAClassification_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "AssetSubCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCIAClassification" ADD CONSTRAINT "AssetCIAClassification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AssetGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLifecycleStatus" ADD CONSTRAINT "AssetLifecycleStatus_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetClassification" ADD CONSTRAINT "AssetClassification_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "AssetSubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AssetGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "AssetClassification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_sensitivityId_fkey" FOREIGN KEY ("sensitivityId") REFERENCES "AssetSensitivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_lifecycleStatusId_fkey" FOREIGN KEY ("lifecycleStatusId") REFERENCES "AssetLifecycleStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskCategory" ADD CONSTRAINT "RiskCategory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskType" ADD CONSTRAINT "RiskType_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskThreat" ADD CONSTRAINT "RiskThreat_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskThreat" ADD CONSTRAINT "RiskThreat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ThreatCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskVulnerability" ADD CONSTRAINT "RiskVulnerability_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskVulnerability" ADD CONSTRAINT "RiskVulnerability_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VulnerabilityCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskCause" ADD CONSTRAINT "RiskCause_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskThreatMapping" ADD CONSTRAINT "RiskThreatMapping_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskThreatMapping" ADD CONSTRAINT "RiskThreatMapping_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "RiskThreat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskVulnerabilityMapping" ADD CONSTRAINT "RiskVulnerabilityMapping_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskVulnerabilityMapping" ADD CONSTRAINT "RiskVulnerabilityMapping_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "RiskVulnerability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskCauseMapping" ADD CONSTRAINT "RiskCauseMapping_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskCauseMapping" ADD CONSTRAINT "RiskCauseMapping_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "RiskCause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RiskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "RiskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_impactedAssetId_fkey" FOREIGN KEY ("impactedAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_impactedProcessId_fkey" FOREIGN KEY ("impactedProcessId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControlMatrixEntry" ADD CONSTRAINT "RiskControlMatrixEntry_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControlMatrixEntry" ADD CONSTRAINT "RiskControlMatrixEntry_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControlMatrixControl" ADD CONSTRAINT "RiskControlMatrixControl_riskControlMatrixEntryId_fkey" FOREIGN KEY ("riskControlMatrixEntryId") REFERENCES "RiskControlMatrixEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControlMatrixControl" ADD CONSTRAINT "RiskControlMatrixControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskResponse" ADD CONSTRAINT "RiskResponse_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskResponse" ADD CONSTRAINT "RiskResponse_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VulnerabilityCategory" ADD CONSTRAINT "VulnerabilityCategory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatCategory" ADD CONSTRAINT "ThreatCategory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlStrength" ADD CONSTRAINT "ControlStrength_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskLikelihood" ADD CONSTRAINT "RiskLikelihood_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactCategory" ADD CONSTRAINT "ImpactCategory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactRating" ADD CONSTRAINT "ImpactRating_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VulnerabilityRating" ADD CONSTRAINT "VulnerabilityRating_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSubCategory" ADD CONSTRAINT "RiskSubCategory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRange" ADD CONSTRAINT "RiskRange_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScoreConfig" ADD CONSTRAINT "RiskScoreConfig_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskActivityLog" ADD CONSTRAINT "RiskActivityLog_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCategory" ADD CONSTRAINT "AuditCategory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditNatureOfControl" ADD CONSTRAINT "AuditNatureOfControl_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRiskFactor" ADD CONSTRAINT "AuditRiskFactor_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProbability" ADD CONSTRAINT "AuditProbability_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditImpact" ADD CONSTRAINT "AuditImpact_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScoringRange" ADD CONSTRAINT "AuditScoringRange_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScoringConfig" ADD CONSTRAINT "AuditScoringConfig_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPeriodicity" ADD CONSTRAINT "AuditPeriodicity_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEscalationConfig" ADD CONSTRAINT "AuditEscalationConfig_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditType" ADD CONSTRAINT "AuditType_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditRisk" ADD CONSTRAINT "InternalAuditRisk_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditRisk" ADD CONSTRAINT "InternalAuditRisk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditRisk" ADD CONSTRAINT "InternalAuditRisk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AuditCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditRisk" ADD CONSTRAINT "InternalAuditRisk_auditTypeId_fkey" FOREIGN KEY ("auditTypeId") REFERENCES "AuditType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditRisk" ADD CONSTRAINT "InternalAuditRisk_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditableEntity" ADD CONSTRAINT "AuditableEntity_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditableEntity" ADD CONSTRAINT "AuditableEntity_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEngagement" ADD CONSTRAINT "AuditEngagement_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEngagement" ADD CONSTRAINT "AuditEngagement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEngagement" ADD CONSTRAINT "AuditEngagement_auditableEntityId_fkey" FOREIGN KEY ("auditableEntityId") REFERENCES "AuditableEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEngagement" ADD CONSTRAINT "AuditEngagement_auditTypeId_fkey" FOREIGN KEY ("auditTypeId") REFERENCES "AuditType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEngagement" ADD CONSTRAINT "AuditEngagement_assignedAuditorId_fkey" FOREIGN KEY ("assignedAuditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEngagement" ADD CONSTRAINT "AuditEngagement_auditeeId_fkey" FOREIGN KEY ("auditeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFieldwork" ADD CONSTRAINT "AuditFieldwork_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditWorkpaper" ADD CONSTRAINT "AuditWorkpaper_fieldworkId_fkey" FOREIGN KEY ("fieldworkId") REFERENCES "AuditFieldwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldworkEvidenceRequest" ADD CONSTRAINT "FieldworkEvidenceRequest_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldworkEvidenceAttachment" ADD CONSTRAINT "FieldworkEvidenceAttachment_evidenceRequestId_fkey" FOREIGN KEY ("evidenceRequestId") REFERENCES "FieldworkEvidenceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditFinding" ADD CONSTRAINT "InternalAuditFinding_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditFinding" ADD CONSTRAINT "InternalAuditFinding_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditFinding" ADD CONSTRAINT "InternalAuditFinding_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingAttachment" ADD CONSTRAINT "FindingAttachment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "InternalAuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditCAPA" ADD CONSTRAINT "InternalAuditCAPA_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAuditCAPA" ADD CONSTRAINT "InternalAuditCAPA_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "InternalAuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EngagementTeamMembers" ADD CONSTRAINT "_EngagementTeamMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "AuditEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EngagementTeamMembers" ADD CONSTRAINT "_EngagementTeamMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

