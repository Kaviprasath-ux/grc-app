import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadId } from "@/lib/api-auth";
import path from "path";
import { saveUploadedFile } from "@/lib/file-upload";

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

      // Generate document code - find the highest existing code and increment
      const lastDoc = await prisma.internalAuditDocument.findFirst({
        orderBy: { documentCode: "desc" },
        select: { documentCode: true },
      });

      let nextNum = 1;
      if (lastDoc?.documentCode) {
        const match = lastDoc.documentCode.match(/DOC-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      const documentCode = `DOC-${String(nextNum).padStart(4, "0")}`;

      // Create document record in database
      const document = await prisma.internalAuditDocument.create({
        data: {
          documentCode,
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

      // Store file binary via raw SQL (bypasses Prisma client cache on Vercel)
      await prisma.$executeRaw`UPDATE "InternalAuditDocument" SET "fileData" = ${Buffer.from(buffer)} WHERE "id" = ${document.id}`;

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
