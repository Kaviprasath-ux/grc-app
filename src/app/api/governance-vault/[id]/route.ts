import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { unlink } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/governance-vault/[id] - Get a single vault document
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const document = await prisma.governanceVaultDocument.findUnique({
        where: { id },
        include: {
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
        documentCode: document.documentCode,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        filePath: document.filePath,
        status: document.status,
        uploadedAt: document.uploadedAt.toISOString(),
        linkedPolicies: document.linkedPolicies.map((lp) => ({
          id: lp.policy.id,
          code: lp.policy.code,
          name: lp.policy.name,
          documentType: lp.policy.documentType,
          linkedAt: lp.linkedAt.toISOString(),
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

// DELETE /api/governance-vault/[id] - Delete a vault document
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const document = await prisma.governanceVaultDocument.findUnique({
        where: { id },
        select: { customerAccountId: true, filePath: true },
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

      // Delete from database (cascade will delete links)
      await prisma.governanceVaultDocument.delete({
        where: { id },
      });

      // Try to delete file from disk
      try {
        const filePath = path.join(process.cwd(), document.filePath);
        await unlink(filePath);
      } catch {
        // File might not exist, ignore error
        console.warn("Could not delete file from disk:", document.filePath);
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

// PATCH /api/governance-vault/[id] - Update links for a vault document
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { policyIds } = body as { policyIds: string[] };

      const document = await prisma.governanceVaultDocument.findUnique({
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

      // Verify all policies belong to the same customer
      if (policyIds && policyIds.length > 0) {
        const policies = await prisma.policy.findMany({
          where: {
            id: { in: policyIds },
            customerAccountId: document.customerAccountId,
          },
          select: { id: true },
        });

        const validPolicyIds = policies.map((p) => p.id);
        const invalidIds = policyIds.filter((pid) => !validPolicyIds.includes(pid));

        if (invalidIds.length > 0) {
          return NextResponse.json(
            { error: "Some policies are invalid or not accessible" },
            { status: 400 }
          );
        }
      }

      // Delete existing links and create new ones
      await prisma.$transaction([
        prisma.governanceVaultDocumentLink.deleteMany({
          where: { documentId: id },
        }),
        ...(policyIds || []).map((policyId: string) =>
          prisma.governanceVaultDocumentLink.create({
            data: {
              documentId: id,
              policyId,
            },
          })
        ),
      ]);

      // Fetch updated document
      const updatedDocument = await prisma.governanceVaultDocument.findUnique({
        where: { id },
        include: {
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
        message: "Links updated successfully",
        document: updatedDocument
          ? {
              id: updatedDocument.id,
              documentCode: updatedDocument.documentCode,
              fileName: updatedDocument.fileName,
              linkedPolicies: updatedDocument.linkedPolicies.map((lp) => ({
                id: lp.policy.id,
                code: lp.policy.code,
                name: lp.policy.name,
                documentType: lp.policy.documentType,
                linkedAt: lp.linkedAt.toISOString(),
              })),
            }
          : null,
      });
    } catch (error) {
      console.error("Error updating vault document links:", error);
      return NextResponse.json(
        { error: "Failed to update links" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.governance", action: "edit" }
);
