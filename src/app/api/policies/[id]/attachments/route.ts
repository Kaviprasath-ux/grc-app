import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/policies/[id]/attachments - Get attachments for a policy
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify policy exists and user has access
      const policy = await prisma.policy.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!policy) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, policy.customerAccountId)) {
        return forbidden("Access denied to this policy");
      }

      const attachments = await prisma.policyAttachment.findMany({
        where: { policyId: id },
        orderBy: { uploadedAt: "desc" },
      });

      return NextResponse.json(
        attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          uploadedAt: att.uploadedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error("Error fetching policy attachments:", error);
      return NextResponse.json(
        { error: "Failed to fetch attachments" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);

// POST /api/policies/[id]/attachments - Upload attachment for a policy
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify policy exists and user has access
      const policy = await prisma.policy.findUnique({
        where: { id },
        select: { customerAccountId: true, status: true },
      });

      if (!policy) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, policy.customerAccountId)) {
        return forbidden("Access denied to this policy");
      }

      // Parse form data
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // Read file into buffer for database storage
      const originalName = file.name;
      const ext = originalName.split(".").pop()?.toLowerCase() || "";
      const buffer = Buffer.from(await file.arrayBuffer());

      // Get file type from extension
      const fileType = ext || file.type;

      // Generate a virtual path for reference
      const timestamp = Date.now();
      const virtualPath = `/uploads/governance/${id}/${originalName.replace(/\.[^/.]+$/, "")}_${timestamp}.${ext}`;

      // Create attachment record with file data stored in DB
      const attachment = await prisma.policyAttachment.create({
        data: {
          policyId: id,
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: virtualPath,
          fileData: buffer,
        },
      });

      // Auto-transition from "Not Uploaded" to "Draft" when first attachment is added
      if (policy.status === "Not Uploaded") {
        await prisma.policy.update({
          where: { id },
          data: { status: "Draft" },
        });
      }

      return NextResponse.json(
        {
          message: "File uploaded successfully",
          attachment: {
            id: attachment.id,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            filePath: attachment.filePath,
            uploadedAt: attachment.uploadedAt.toISOString(),
          },
          statusUpdated: policy.status === "Not Uploaded",
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error uploading policy attachment:", error);
      return NextResponse.json(
        { error: "Failed to upload attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "edit" }
);

// DELETE /api/policies/[id]/attachments?attachmentId=xxx - Delete an attachment
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const attachmentId = searchParams.get("attachmentId");

      if (!attachmentId) {
        return NextResponse.json(
          { error: "Attachment ID is required" },
          { status: 400 }
        );
      }

      // Verify policy exists and user has access
      const policy = await prisma.policy.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!policy) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, policy.customerAccountId)) {
        return forbidden("Access denied to this policy");
      }

      // Verify attachment belongs to this policy
      const attachment = await prisma.policyAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment || attachment.policyId !== id) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      // Delete attachment record from database (file data is stored in DB, no disk cleanup needed)
      await prisma.policyAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({
        message: "Attachment deleted successfully",
        fileName: attachment.fileName,
      });
    } catch (error) {
      console.error("Error deleting policy attachment:", error);
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "delete" }
);
