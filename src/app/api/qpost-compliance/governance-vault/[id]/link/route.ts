import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST link QPost policies to vault document
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { governanceIds } = body;

      if (!Array.isArray(governanceIds)) {
        return NextResponse.json(
          { error: "governanceIds must be an array" },
          { status: 400 }
        );
      }

      const document = await prisma.qPostGovernanceVaultDocument.findUnique({
        where: { id },
        select: { customerAccountId: true },
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

      // Delete existing links
      await prisma.qPostGovernanceVaultDocumentLink.deleteMany({
        where: { documentId: id },
      });

      // Create new links
      if (governanceIds.length > 0) {
        await prisma.qPostGovernanceVaultDocumentLink.createMany({
          data: governanceIds.map((policyId: string) => ({
            documentId: id,
            policyId,
          })),
        });

        // Update status of linked policies from "Not Uploaded" to "Draft"
        await prisma.qPostPolicy.updateMany({
          where: {
            id: { in: governanceIds },
            status: "Not Uploaded",
          },
          data: {
            status: "Draft",
          },
        });
      }

      const updatedDocument = await prisma.qPostGovernanceVaultDocument.findUnique({
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

      return NextResponse.json({
        id: updatedDocument!.id,
        documentId: updatedDocument!.documentCode,
        name: updatedDocument!.fileName,
        type: updatedDocument!.fileType,
        status: updatedDocument!.status,
        uploadedAt: updatedDocument!.uploadedAt.toISOString(),
        filePath: updatedDocument!.filePath,
        linkedGovernanceIds: updatedDocument!.linkedPolicies.map((link) => link.policyId),
        linkedPolicies: updatedDocument!.linkedPolicies.map((link) => ({
          id: link.policy.id,
          code: link.policy.code,
          name: link.policy.name,
          documentType: link.policy.documentType,
        })),
      });
    } catch (error) {
      console.error("Error linking QPost governance to document:", error);
      return NextResponse.json(
        { error: "Failed to link governance" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.governance", action: "edit" }
);
