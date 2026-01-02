import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// GET all governance templates
export async function GET() {
  try {
    const templates = await prisma.governanceTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching governance templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch governance templates" },
      { status: 500 }
    );
  }
}

// POST create new governance template (with file upload)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const governanceType = formData.get("governanceType") as string || "Policy";

    if (!file) {
      return NextResponse.json(
        { error: "Template file is required" },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), "public", "uploads", "governance-templates");
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = path.join(uploadDir, fileName);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Get file extension
    const fileType = file.name.split(".").pop()?.toLowerCase() || "";

    // Create database record
    const template = await prisma.governanceTemplate.create({
      data: {
        name: file.name,
        governanceType,
        fileName,
        fileType,
        fileSize: file.size,
        filePath: `/uploads/governance-templates/${fileName}`,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating governance template:", error);
    return NextResponse.json(
      { error: "Failed to create governance template" },
      { status: 500 }
    );
  }
}
