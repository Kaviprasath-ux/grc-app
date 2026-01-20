import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { unlink } from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single document
export const GET = withAuth(
  async (request: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const document = await prisma.internalAuditDocument.findUnique({
        where: { id },
      });

      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      return NextResponse.json(
        { error: "Failed to fetch document" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.documents", action: "view" }
);

// DELETE document
export const DELETE = withAuth(
  async (request: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const document = await prisma.internalAuditDocument.findUnique({
        where: { id },
      });

      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      // Delete file from disk
      try {
        const filePath = path.join(process.cwd(), document.filePath);
        await unlink(filePath);
      } catch (err) {
        // File might not exist, continue with database deletion
        console.warn("File not found on disk:", err);
      }

      // Delete from database
      await prisma.internalAuditDocument.delete({
        where: { id },
      });

      return NextResponse.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.documents", action: "delete" }
);
