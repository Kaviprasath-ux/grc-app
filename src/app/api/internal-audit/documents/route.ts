import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadId } from "@/lib/api-auth";
import path from "path";
import { saveUploadedFile } from "@/lib/file-upload";
import { translateRecord, isTranslationConfigured } from "@/lib/translation-service";
import { maybeEncryptBytes } from "@/lib/encryption";

// GET documents organized by category with pagination
export const GET = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(request.url);
      const category = searchParams.get("category");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const skip = (page - 1) * limit;

      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const baseWhere = { ...tenantFilter, ...(auditHeadId ? { auditHeadId } : {}) };

      const where = category ? { ...baseWhere, category } : baseWhere;

      const [documents, total] = await Promise.all([
        prisma.internalAuditDocument.findMany({
          where,
          orderBy: { uploadedAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true, documentCode: true, name: true, description: true,
            category: true, fileName: true, fileType: true, fileSize: true,
            filePath: true, uploadedBy: true, uploadedAt: true,
            customerAccountId: true, auditHeadId: true,
            createdAt: true, updatedAt: true,
          },
        }),
        prisma.internalAuditDocument.count({ where }),
      ]);

      // If no category filter, organize by category
      if (!category) {
        // Shared select to exclude large fileData binary from list queries
        const docSelect = {
          id: true, documentCode: true, name: true, description: true,
          category: true, fileName: true, fileType: true, fileSize: true,
          filePath: true, uploadedBy: true, uploadedAt: true,
          customerAccountId: true, auditHeadId: true,
          createdAt: true, updatedAt: true,
          ingestJobs: {
            orderBy: { createdAt: "desc" as const },
            take: 1,
            select: {
              id: true,
              runpodJobId: true,
              status: true,
              error: true,
              completedAt: true,
            },
          },
        };
        const policies = await prisma.internalAuditDocument.findMany({
          where: { ...baseWhere, category: "Policy" },
          orderBy: { uploadedAt: "desc" },
          select: docSelect,
        });
        const regulations = await prisma.internalAuditDocument.findMany({
          where: { ...baseWhere, category: "Regulation" },
          orderBy: { uploadedAt: "desc" },
          select: docSelect,
        });
        const auditReports = await prisma.internalAuditDocument.findMany({
          where: { ...baseWhere, category: "PreviousReport" },
          orderBy: { uploadedAt: "desc" },
          select: docSelect,
        });

        return NextResponse.json({
          policies,
          regulations,
          auditReports,
          policiesCount: policies.length,
          regulationsCount: regulations.length,
          auditReportsCount: auditReports.length,
        });
      }

      return NextResponse.json({
        documents,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching documents:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.documents", action: "view" }
);

// Helper function to generate unique document code
// NOTE: documentCode has a GLOBAL unique constraint, so we check ALL documents (not per-tenant)
async function generateUniqueDocumentCode(): Promise<string> {
  // Find the highest existing document code number GLOBALLY
  const allDocs = await prisma.internalAuditDocument.findMany({
    select: { documentCode: true },
    orderBy: { createdAt: 'desc' },
  });

  let maxNum = 0;
  for (const doc of allDocs) {
    const match = doc.documentCode.match(/^DOC-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  // Generate next sequential code
  const nextNum = maxNum + 1;
  const code = `DOC-${String(nextNum).padStart(4, "0")}`;

  // Verify code doesn't exist globally (final check)
  const exists = await prisma.internalAuditDocument.findFirst({
    where: { documentCode: code },
    select: { id: true },
  });

  if (!exists) {
    return code;
  }

  // If code exists (race condition), use timestamp-based code for guaranteed uniqueness
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `DOC-${timestamp}${randomSuffix}`;
}

// POST - Upload a new document
export const POST = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const category = formData.get("category") as string || "Policy";
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;

      // Get tenant ID and audit head for data isolation
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // Save file to disk (uses /tmp on Vercel)
      const { urlPath, buffer } = await saveUploadedFile(file, "documents");
      const originalName = file.name;
      const ext = path.extname(originalName);

      // Generate unique document code (globally unique, not per-tenant)
      // Create document record in database with retry on unique constraint violation
      let document;
      let createAttempts = 0;
      const maxCreateAttempts = 3;

      while (createAttempts < maxCreateAttempts) {
        try {
          const codeToUse = await generateUniqueDocumentCode();

          document = await prisma.internalAuditDocument.create({
            data: {
              documentCode: codeToUse,
              name: name || originalName,
              description: description || null,
              category,
              fileName: originalName,
              fileType: ext.replace(".", "").toLowerCase(),
              fileSize: buffer.length,
              filePath: urlPath,
              uploadedAt: new Date(),
              ...(customerAccountId ? { customerAccountId } : {}),
              ...(auditHeadId ? { auditHeadId } : {}),
            },
          });
          break; // Success - exit retry loop
        } catch (createError: unknown) {
          createAttempts++;
          // Check if it's a unique constraint violation (P2002)
          if (
            createError &&
            typeof createError === 'object' &&
            'code' in createError &&
            createError.code === 'P2002' &&
            createAttempts < maxCreateAttempts
          ) {
            console.log(`[Document Upload] Unique constraint collision, retrying (attempt ${createAttempts + 1}/${maxCreateAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 100 * createAttempts));
            continue;
          }
          throw createError; // Re-throw if not a unique constraint error or max retries reached
        }
      }

      if (!document) {
        throw new Error('Failed to create document after multiple attempts');
      }

      // Store file binary via raw SQL (bypasses Prisma client cache on Vercel).
      // Raw SQL bypasses the Prisma extension; encrypt manually.
      const encryptedFileData = maybeEncryptBytes(Buffer.from(buffer));
      await prisma.$executeRaw`UPDATE "InternalAuditDocument" SET "fileData" = ${encryptedFileData} WHERE "id" = ${document.id}`;

      console.log(`[Document Upload] Created document ${document.documentCode} (${document.fileName}), fileData stored`);

      // Translate document name and file name
      if (customerAccountId && isTranslationConfigured()) {
        void translateRecord(customerAccountId, 'InternalAuditDocument', document.id, {
          name: document.name,
          fileName: originalName,
        }).catch(() => {});
      }

      return NextResponse.json(document, { status: 201 });
    } catch (error) {
      console.error("Error uploading document:", error);
      return NextResponse.json(
        { error: "Failed to upload document" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.documents", action: "create" }
);
