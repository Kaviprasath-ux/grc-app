import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// GET documents organized by category with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const where = category ? { category } : {};

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
        where: { category: "Policy" },
        orderBy: { uploadedAt: "desc" },
      });
      const regulations = await prisma.internalAuditDocument.findMany({
        where: { category: "Regulation" },
        orderBy: { uploadedAt: "desc" },
      });
      const auditReports = await prisma.internalAuditDocument.findMany({
        where: { category: "PreviousReport" },
        orderBy: { uploadedAt: "desc" },
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
}

// POST - Upload a new document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string || "Policy";
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

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

    // Generate document code
    const count = await prisma.internalAuditDocument.count();
    const documentCode = `DOC-${String(count + 1).padStart(4, "0")}`;

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
}
