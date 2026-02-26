import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single vault document
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const document = await prisma.governanceVaultDocument.findUnique({
        where: { id },
        select: {
          id: true,
          documentCode: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          filePath: true,
          status: true,
          uploadedAt: true,
          customerAccountId: true,
          linkedPolicies: {
            include: {
              policy: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  documentType: true,
                },
              },
            },
          },
        },
      });

      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, document.customerAccountId)) {
        return forbidden("Access denied to this document");
      }

      return NextResponse.json({
        id: document.id,
        documentId: document.documentCode,
        name: document.fileName,
        type: document.fileType,
        status: document.status,
        uploadedAt: document.uploadedAt.toISOString(),
        filePath: document.filePath,
        linkedGovernanceIds: document.linkedPolicies.map((link) => link.policyId),
        linkedPolicies: document.linkedPolicies.map((link) => ({
          id: link.policy.id,
          code: link.policy.code,
          name: link.policy.name,
          documentType: link.policy.documentType,
        })),
      });
    } catch (error) {
      console.error("Error fetching vault document:", error);
      return NextResponse.json(
        { error: "Failed to fetch document" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "view" }
);

// DELETE vault document
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First check if document exists and verify tenant access
      const document = await prisma.governanceVaultDocument.findUnique({
        where: { id },
        select: {
          customerAccountId: true,
          filePath: true,
          fileName: true,
          linkedPolicies: {
            select: { policyId: true },
          },
        },
      });

      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, document.customerAccountId)) {
        return forbidden("Access denied to this document");
      }

      // Also delete matching PolicyAttachments from linked policies (bidirectional sync)
      if (document.linkedPolicies.length > 0) {
        const linkedPolicyIds = document.linkedPolicies.map((lp) => lp.policyId);
        const matchingAttachments = await prisma.policyAttachment.findMany({
          where: {
            policyId: { in: linkedPolicyIds },
            fileName: document.fileName,
          },
        });

        // Delete physical files for matched attachments
        for (const att of matchingAttachments) {
          if (att.filePath) {
            try {
              const { unlink } = await import("fs/promises");
              const { join } = await import("path");
              const relativePath = att.filePath.startsWith("/") ? att.filePath.slice(1) : att.filePath;
              await unlink(join(process.cwd(), relativePath));
            } catch {
              // File may not exist, continue
            }
          }
        }

        // Delete attachment records
        await prisma.policyAttachment.deleteMany({
          where: {
            policyId: { in: linkedPolicyIds },
            fileName: document.fileName,
          },
        });
      }

      // Delete physical vault file
      if (document.filePath) {
        try {
          const { unlink } = await import("fs/promises");
          const { join } = await import("path");
          const relativePath = document.filePath.startsWith("/") ? document.filePath.slice(1) : document.filePath;
          await unlink(join(process.cwd(), relativePath));
        } catch {
          // File may not exist, continue
        }
      }

      // Collect linked policy IDs before deleting links
      const affectedPolicyIds = document.linkedPolicies.map((lp) => lp.policyId);

      // Delete linked policies first (due to foreign key constraints)
      await prisma.governanceVaultDocumentLink.deleteMany({
        where: { documentId: id },
      });

      // Delete the document record
      await prisma.governanceVaultDocument.delete({
        where: { id },
      });

      // Revert linked policies to "Not Uploaded" if they have no remaining documents
      for (const policyId of affectedPolicyIds) {
        const remainingAttachments = await prisma.policyAttachment.count({
          where: { policyId },
        });
        const remainingVaultLinks = await prisma.governanceVaultDocumentLink.count({
          where: { policyId },
        });

        if (remainingAttachments === 0 && remainingVaultLinks === 0) {
          await prisma.policy.updateMany({
            where: { id: policyId, status: "Draft" },
            data: { status: "Not Uploaded" },
          });
        }
      }

      return NextResponse.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting vault document:", error);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "delete" }
);
