import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

/**
 * GET /api/grc/customer-accounts/[id]/logo
 * Get the logo URL for a customer
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const customer = await prisma.user.findUnique({
      where: { id },
      select: { id: true, logoUrl: true, fullName: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({
      logoUrl: customer.logoUrl,
      customerName: customer.fullName,
    });
  } catch (error) {
    console.error("Error fetching logo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/grc/customer-accounts/[id]/logo
 * Upload a logo for a customer
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const { id } = await params;

    // Verify the customer exists
    const customer = await prisma.user.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Parse the form data
    const formData = await req.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB." }, { status: 400 });
    }

    // Create the uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), "public", "uploads", "logos");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Delete old logo if exists
    if (customer.logoUrl) {
      const oldFilePath = path.join(process.cwd(), "public", customer.logoUrl);
      if (existsSync(oldFilePath)) {
        try {
          await unlink(oldFilePath);
        } catch (err) {
          console.error("Error deleting old logo:", err);
        }
      }
    }

    // Generate unique filename
    const ext = path.extname(file.name) || `.${file.type.split("/")[1]}`;
    const filename = `${id}-${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, filename);

    // Write the file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Update the customer's logoUrl in the database
    const logoUrl = `/uploads/logos/${filename}`;
    await prisma.user.update({
      where: { id },
      data: { logoUrl },
    });

    return NextResponse.json({
      success: true,
      message: "Logo uploaded successfully",
      logoUrl,
    });
  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/grc/customer-accounts/[id]/logo
 * Delete the logo for a customer
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const { id } = await params;

    // Get the customer
    const customer = await prisma.user.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Delete the logo file if it exists
    if (customer.logoUrl) {
      const filePath = path.join(process.cwd(), "public", customer.logoUrl);
      if (existsSync(filePath)) {
        try {
          await unlink(filePath);
        } catch (err) {
          console.error("Error deleting logo file:", err);
        }
      }
    }

    // Clear the logoUrl in the database
    await prisma.user.update({
      where: { id },
      data: { logoUrl: null },
    });

    return NextResponse.json({
      success: true,
      message: "Logo deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting logo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
