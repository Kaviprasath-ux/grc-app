import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single QPost vault document
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const document = await prisma.qPostGovernanceVaultDocument.findUnique({
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
      console.error("Error fetching QPost vault document:", error);
      return NextResponse.json(
        { error: "Failed to fetch document" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.governance", action: "view" }
);

// DELETE QPost vault document
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const document = await prisma.qPostGovernanceVaultDocument.findUnique({
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

      // Delete matching QPost policy attachments from linked policies
      if (document.linkedPolicies.length > 0) {
        const linkedPolicyIds = document.linkedPolicies.map((lp) => lp.policyId);
        const matchingAttachments = await prisma.qPostPolicyAttachment.findMany({
          where: {
            policyId: { in: linkedPolicyIds },
            fileName: document.fileName,
          },
        });

        for (const att of matchingAttachments) {
          if (att.filePath) {
            try {
              const { unlink } = await import("fs/promises");
              const { join } = await import("path");
              const relativePath = att.filePath.startsWith("/") ? att.filePath.slice(1) : att.filePath;
              await unlink(join(process.cwd(), relativePath));
            } catch {
              // File may not exist
            }
          }
        }

        await prisma.qPostPolicyAttachment.deleteMany({
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
          // File may not exist
        }
      }

      const affectedPolicyIds = document.linkedPolicies.map((lp) => lp.policyId);

      await prisma.qPostGovernanceVaultDocumentLink.deleteMany({
        where: { documentId: id },
      });

      await prisma.qPostGovernanceVaultDocument.delete({
        where: { id },
      });

      // Revert linked policies to "Not Uploaded" if no remaining documents
      for (const policyId of affectedPolicyIds) {
        const remainingAttachments = await prisma.qPostPolicyAttachment.count({
          where: { policyId },
        });
        const remainingVaultLinks = await prisma.qPostGovernanceVaultDocumentLink.count({
          where: { policyId },
        });

        if (remainingAttachments === 0 && remainingVaultLinks === 0) {
          await prisma.qPostPolicy.updateMany({
            where: { id: policyId, status: "Draft" },
            data: { status: "Not Uploaded" },
          });
        }
      }

      return NextResponse.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting QPost vault document:", error);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.governance", action: "delete" }
);
