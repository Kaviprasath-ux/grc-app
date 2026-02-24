import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT update a user document type
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      const docType = await prisma.userDocumentType.findUnique({
        where: { id },
      });

      if (!docType) {
        return NextResponse.json(
          { error: "User document type not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, docType.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const updated = await prisma.userDocumentType.update({
        where: { id },
        data: { name },
      });

      if (docType.customerAccountId) void translateRecord(docType.customerAccountId, 'UserDocumentType', updated.id, { name: updated.name });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Error updating user document type:", error);
      return NextResponse.json(
        { error: "Failed to update user document type" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "edit" }
);

// DELETE a user document type
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const docType = await prisma.userDocumentType.findUnique({
        where: { id },
      });

      if (!docType) {
        return NextResponse.json(
          { error: "User document type not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, docType.customerAccountId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      await prisma.userDocumentType.delete({ where: { id } });

      if (docType.customerAccountId) void deleteRecordTranslations(docType.customerAccountId, 'UserDocumentType', id);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting user document type:", error);
      return NextResponse.json(
        { error: "Failed to delete user document type" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "delete" }
);
