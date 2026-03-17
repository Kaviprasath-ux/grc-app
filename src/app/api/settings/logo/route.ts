import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/settings/logo
 * Get the logo URL for the current customer account
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customerAccountId = session.user.customerAccountId;
    if (!customerAccountId) {
      return NextResponse.json({ logoUrl: null });
    }

    const account = await prisma.customerAccount.findUnique({
      where: { id: customerAccountId },
      select: { logoUrl: true },
    });

    return NextResponse.json({ logoUrl: account?.logoUrl || null });
  } catch (error) {
    console.error("Error fetching logo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/settings/logo
 * Upload/change logo — CustomerAdministrator only
 * Stores logo as base64 data URL in DB (works on serverless/cloud)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user.roles as string[]) || [];
    if (!roles.includes("CustomerAdministrator")) {
      return NextResponse.json({ error: "Only Customer Administrator can change the logo" }, { status: 403 });
    }

    const customerAccountId = session.user.customerAccountId;
    if (!customerAccountId) {
      return NextResponse.json({ error: "No customer account" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
      where: { id: customerAccountId },
      data: { logoUrl },
    });

    return NextResponse.json({ success: true, logoUrl });
  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/logo
 * Remove logo — CustomerAdministrator only
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user.roles as string[]) || [];
    if (!roles.includes("CustomerAdministrator")) {
      return NextResponse.json({ error: "Only Customer Administrator can remove the logo" }, { status: 403 });
    }

    const customerAccountId = session.user.customerAccountId;
    if (!customerAccountId) {
      return NextResponse.json({ error: "No customer account" }, { status: 400 });
    }

    await prisma.customerAccount.update({
      where: { id: customerAccountId },
      data: { logoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting logo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
