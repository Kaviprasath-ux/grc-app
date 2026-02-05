import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * GET /api/governance-templates
 * Fetch governance templates for the current user's customer account
 * Query params: governanceType (optional) - "Policy", "Standard", "Procedure"
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const governanceType = searchParams.get("governanceType");

    // Build where clause with multi-tenant filter
    const where: Record<string, unknown> = {};

    // Filter by customer account (or show global templates where customerAccountId is null)
    if (session.user.customerAccountId) {
      where.OR = [
        { customerAccountId: session.user.customerAccountId },
        { customerAccountId: null }, // Global templates
      ];
    }

    // Filter by governance type if provided
    if (governanceType) {
      where.governanceType = governanceType;
    }

    // Only show .docx templates (required for AI generation)
    where.fileType = "docx";

    const templates = await prisma.governanceTemplate.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching governance templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/governance-templates
 * Upload a new governance template (.docx only for AI generation)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const governanceType = (formData.get("governanceType") as string) || "Policy";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Validate file type - only .docx allowed for AI generation
    const originalFileName = file.name;
    const fileExtension = originalFileName.split(".").pop()?.toLowerCase();

    if (fileExtension !== "docx") {
      return NextResponse.json(
        { error: "Only .docx files are supported for AI policy generation" },
        { status: 400 }
      );
    }

    // Use provided name or original filename
    const templateName = name || originalFileName.replace(/\.[^/.]+$/, "");

    // Save file to disk
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "governance-templates");
    await mkdir(uploadsDir, { recursive: true });

    const timestamp = Date.now();
    const sanitizedName = templateName.replace(/[^a-zA-Z0-9-_]/g, "-");
    const finalFileName = `${sanitizedName}-${timestamp}.${fileExtension}`;
    const filePath = path.join(uploadsDir, finalFileName);
    const publicPath = `/uploads/governance-templates/${finalFileName}`;

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create database record
    const template = await prisma.governanceTemplate.create({
      data: {
        name: templateName,
        governanceType,
        fileName: finalFileName,
        fileType: fileExtension,
        fileSize: buffer.length,
        filePath: publicPath,
        uploadedById: session.user.id,
        customerAccountId: session.user.customerAccountId || null,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error uploading governance template:", error);
    return NextResponse.json(
      { error: "Failed to upload template" },
      { status: 500 }
    );
  }
}
