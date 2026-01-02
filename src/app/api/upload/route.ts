import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Get file details
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "artifacts");
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    const uniqueFileName = `${baseName}-${timestamp}${extension}`;

    // Save file
    const filePath = path.join(uploadsDir, uniqueFileName);
    await writeFile(filePath, buffer);

    // Return file info
    const fileType = extension.replace(".", "").toLowerCase();

    return NextResponse.json({
      success: true,
      file: {
        originalName,
        fileName: uniqueFileName,
        fileType,
        fileSize: file.size,
        filePath: `/uploads/artifacts/${uniqueFileName}`,
      },
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
