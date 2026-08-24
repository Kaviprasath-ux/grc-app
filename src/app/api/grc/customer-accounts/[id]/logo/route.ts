import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateUploadedFile } from "@/lib/upload-validation";

/**
 * GET /api/grc/customer-accounts/[id]/logo
 * Get the logo URL for a customer account
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

    const account = await prisma.customerAccount.findUnique({
      where: { id },
      select: { id: true, logoUrl: true, name: true },
    });

    if (!account) {
      return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
    }

    return NextResponse.json({
      logoUrl: account.logoUrl,
      customerName: account.name,
    });
  } catch (error) {
    console.error("Error fetching logo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/grc/customer-accounts/[id]/logo
 * Upload a logo for a customer (GRC Administrator)
 * Stores logo as base64 data URL in DB (works on serverless/cloud)
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

    const account = await prisma.customerAccount.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const check = validateUploadedFile(file);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed." }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB." }, { status: 400 });
    }

    // Convert to base64 data URL and store in DB
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const logoUrl = `data:${file.type};base64,${base64}`;

    await prisma.customerAccount.update({
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

    const account = await prisma.customerAccount.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
    }

    await prisma.customerAccount.update({
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
