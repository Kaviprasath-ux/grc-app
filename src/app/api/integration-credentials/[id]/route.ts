import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import {
  encryptCredentials,
  maskCredentials,
  decryptCredentials,
} from "@/lib/credential-encryption";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Get single credential (masked)
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const credential = await prisma.integrationCredential.findFirst({
        where: { id, ...tenantFilter },
        include: { collections: { select: { id: true, dataSource: true, displayName: true, lastCollectionStatus: true, recordCount: true } } },
      });

      if (!credential) {
        return NextResponse.json({ error: "Credential not found" }, { status: 404 });
      }

      let maskedCreds: Record<string, string> = {};
      try {
        const decrypted = decryptCredentials(credential.credentialsEncrypted);
        maskedCreds = maskCredentials(decrypted);
      } catch {
        maskedCreds = { error: "Unable to decrypt" };
      }

      return NextResponse.json({
        data: {
          ...credential,
          credentialsEncrypted: undefined,
          credentials: maskedCreds,
        },
      });
    } catch (error) {
      console.error("Error fetching credential:", error);
      return NextResponse.json({ error: "Failed to fetch credential" }, { status: 500 });
    }
  },
  { resource: "technical-evidence.integration-credentials", action: "view" }
);

// PATCH - Update credential
export const PATCH = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const existing = await prisma.integrationCredential.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json({ error: "Credential not found" }, { status: 404 });
      }

      const body = await req.json();
      const updateData: Record<string, unknown> = {};

      if (body.name) updateData.name = body.name;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.credentials) {
        // Merge new fields into existing credentials (don't replace all)
        const existingDecrypted = decryptCredentials(existing.credentialsEncrypted);
        const merged = { ...existingDecrypted, ...body.credentials };
        updateData.credentialsEncrypted = encryptCredentials(merged);
      }

      const updated = await prisma.integrationCredential.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          platform: true,
          name: true,
          authType: true,
          isActive: true,
          lastTestedAt: true,
          lastTestStatus: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({ data: updated });
    } catch (error) {
      console.error("Error updating credential:", error);
      return NextResponse.json({ error: "Failed to update credential" }, { status: 500 });
    }
  },
  { resource: "technical-evidence.integration-credentials", action: "edit" }
);

// DELETE - Remove credential
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      const existing = await prisma.integrationCredential.findFirst({
        where: { id, customerAccountId },
      });

      if (!existing) {
        return NextResponse.json({ error: "Credential not found" }, { status: 404 });
      }

      await prisma.integrationCredential.delete({ where: { id } });

      return NextResponse.json({ message: "Credential deleted successfully" });
    } catch (error) {
      console.error("Error deleting credential:", error);
      return NextResponse.json({ error: "Failed to delete credential" }, { status: 500 });
    }
  },
  { resource: "technical-evidence.integration-credentials", action: "delete" }
);
