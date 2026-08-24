import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { validateUploadedFile } from "@/lib/upload-validation";

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
        include: {
          uploadedBy: { select: { id: true, fullName: true } },
        },
      });

      return NextResponse.json(
        attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          uploadedAt: att.uploadedAt.toISOString(),
          uploadedByName: att.uploadedBy?.fullName || null,
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

      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      const originalName = file.name;
      const ext = originalName.split(".").pop()?.toLowerCase() || "";
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileType = ext || file.type;

      // Save file to disk
      const timestamp = Date.now();
      const uniqueFileName = `${originalName.replace(/\.[^/.]+$/, "")}_${timestamp}.${ext}`;
      const uploadDir = join(process.cwd(), "uploads", "governance", id);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, uniqueFileName), buffer);
      const relativePath = `/uploads/governance/${id}/${uniqueFileName}`;

      // Create attachment record
      const attachment = await prisma.policyAttachment.create({
        data: {
          policyId: id,
          fileName: originalName,
          fileType,
          fileSize: file.size,
          filePath: relativePath,
          uploadedById: session.id,
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

      // Delete physical file from disk
      if (attachment.filePath) {
        try {
          const relativePath = attachment.filePath.startsWith("/")
            ? attachment.filePath.slice(1)
            : attachment.filePath;
          const absolutePath = join(process.cwd(), relativePath);
          await unlink(absolutePath);
        } catch {
          console.warn(`Could not delete file: ${attachment.filePath}`);
        }
      }

      // Delete attachment record
      await prisma.policyAttachment.delete({
        where: { id: attachmentId },
      });

      // Also delete matching vault document (bidirectional sync)
      try {
        const matchingVaultDoc = await prisma.governanceVaultDocument.findFirst({
          where: {
            customerAccountId: policy.customerAccountId,
            fileName: attachment.fileName,
          },
        });
        if (matchingVaultDoc) {
          // Delete vault file from disk
          if (matchingVaultDoc.filePath) {
            try {
              const vaultRelPath = matchingVaultDoc.filePath.startsWith("/")
                ? matchingVaultDoc.filePath.slice(1)
                : matchingVaultDoc.filePath;
              await unlink(join(process.cwd(), vaultRelPath));
            } catch {
              // File may not exist
            }
          }
          await prisma.governanceVaultDocumentLink.deleteMany({
            where: { documentId: matchingVaultDoc.id },
          });
          await prisma.governanceVaultDocument.delete({
            where: { id: matchingVaultDoc.id },
          });
        }
      } catch (vaultError) {
        console.warn("Could not sync vault document deletion:", vaultError);
      }

      // Revert policy to "Not Uploaded" if no documents remain
      const remainingAttachments = await prisma.policyAttachment.count({
        where: { policyId: id },
      });
      const remainingVaultLinks = await prisma.governanceVaultDocumentLink.count({
        where: { policyId: id },
      });

      if (remainingAttachments === 0 && remainingVaultLinks === 0) {
        await prisma.policy.updateMany({
          where: { id, status: "Draft" },
          data: { status: "Not Uploaded" },
        });
      }

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
