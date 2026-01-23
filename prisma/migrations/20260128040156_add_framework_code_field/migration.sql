-- AlterTable
ALTER TABLE "Framework" ADD COLUMN "code" TEXT;

-- CreateTable
CREATE TABLE "PolicyAIReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyId" TEXT NOT NULL,
    "documentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "complianceSummary" TEXT,
    "riskScore" REAL,
    "matchedControls" TEXT,
    "gaps" TEXT,
    "recommendations" TEXT,
    "reviewedAt" DATETIME,
    "aiOperationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PolicyAIReview_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolicyAIReview_aiOperationId_fkey" FOREIGN KEY ("aiOperationId") REFERENCES "AIOperation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceAIReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "critique" TEXT,
    "similarityScore" REAL,
    "recommendations" TEXT,
    "aiOperationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvidenceAIReview_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidenceAIReview_aiOperationId_fkey" FOREIGN KEY ("aiOperationId") REFERENCES "AIOperation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "result" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Satisfactory',
    "userId" TEXT,
    "aiOperationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentSearch_aiOperationId_fkey" FOREIGN KEY ("aiOperationId") REFERENCES "AIOperation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerJobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "userId" TEXT,
    "resultPath" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "requestBody" TEXT,
    "responseBody" TEXT,
    "statusCode" INTEGER,
    "latencyMs" INTEGER,
    "error" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIOperation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AIJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAIReview_aiOperationId_key" ON "PolicyAIReview"("aiOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceAIReview_aiOperationId_key" ON "EvidenceAIReview"("aiOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSearch_aiOperationId_key" ON "DocumentSearch"("aiOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "AIJob_providerJobId_key" ON "AIJob"("providerJobId");
