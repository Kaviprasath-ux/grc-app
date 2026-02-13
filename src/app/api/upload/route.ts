import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { saveUploadedFile } from "@/lib/file-upload";

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

    const { urlPath, fileName } = await saveUploadedFile(file, "artifacts");

    // Return file info
    const extension = path.extname(file.name);
    const fileType = extension.replace(".", "").toLowerCase();

    return NextResponse.json({
      success: true,
      file: {
        originalName: file.name,
        fileName,
        fileType,
        fileSize: file.size,
        filePath: urlPath,
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
