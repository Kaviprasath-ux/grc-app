import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadId } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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
        }),
        prisma.internalAuditDocument.count({ where }),
      ]);

      // If no category filter, organize by category
      if (!category) {
        const policies = await prisma.internalAuditDocument.findMany({
          where: { ...baseWhere, category: "Policy" },
          orderBy: { uploadedAt: "desc" },
          include: {
            ingestJobs: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                runpodJobId: true,
                status: true,
                error: true,
                completedAt: true,
              },
            },
          },
        });
        const regulations = await prisma.internalAuditDocument.findMany({
          where: { ...baseWhere, category: "Regulation" },
          orderBy: { uploadedAt: "desc" },
          include: {
            ingestJobs: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                runpodJobId: true,
                status: true,
                error: true,
                completedAt: true,
              },
            },
          },
        });
        const auditReports = await prisma.internalAuditDocument.findMany({
          where: { ...baseWhere, category: "PreviousReport" },
          orderBy: { uploadedAt: "desc" },
          include: {
            ingestJobs: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                runpodJobId: true,
                status: true,
                error: true,
                completedAt: true,
              },
            },
          },
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

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), "uploads", "documents");
      await mkdir(uploadsDir, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const originalName = file.name;
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      const uniqueFileName = `${baseName}-${timestamp}${ext}`;
      const filePath = path.join(uploadsDir, uniqueFileName);

      // Write file to disk
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

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
          filePath: `/uploads/documents/${uniqueFileName}`,
          uploadedAt: new Date(),
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

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
