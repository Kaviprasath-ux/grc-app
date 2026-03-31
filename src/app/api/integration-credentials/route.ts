import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import {
  encryptCredentials,
  maskCredentials,
  decryptCredentials,
} from "@/lib/credential-encryption";

// GET - List all integration credentials for the tenant (masked secrets)
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const platform = searchParams.get("platform");
      const tenantFilter = getTenantFilter(session);

      const where: Record<string, unknown> = { ...tenantFilter };
      if (platform) where.platform = platform;

      const credentials = await prisma.integrationCredential.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          platform: true,
          name: true,
          authType: true,
          isActive: true,
          lastTestedAt: true,
          lastTestStatus: true,
          credentialsEncrypted: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { collections: true } },
        },
      });

      // Mask credentials for display
      const masked = credentials.map((cred) => {
        let maskedCreds: Record<string, string> = {};
        try {
          const decrypted = decryptCredentials(cred.credentialsEncrypted);
          maskedCreds = maskCredentials(decrypted);
        } catch {
          maskedCreds = { error: "Unable to decrypt" };
        }
        return {
          ...cred,
          credentialsEncrypted: undefined,
          credentials: maskedCreds,
        };
      });

      return NextResponse.json({ data: masked });
    } catch (error) {
      console.error("Error fetching integration credentials:", error);
      return NextResponse.json(
        { error: "Failed to fetch integration credentials" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.integration-credentials", action: "view" }
);

// POST - Create a new integration credential
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 400 }
        );
      }

      const body = await req.json();
      const { platform, name, authType, credentials: rawCredentials } = body;

      if (!platform || !name || !rawCredentials) {
        return NextResponse.json(
          { error: "Missing required fields: platform, name, credentials" },
          { status: 400 }
        );
      }

      // Encrypt credentials before storage
      const credentialsEncrypted = encryptCredentials(rawCredentials);

      const credential = await prisma.integrationCredential.create({
        data: {
          customerAccountId,
          platform,
          name,
          authType: authType || "oauth2",
          credentialsEncrypted,
        },
        select: {
          id: true,
          platform: true,
          name: true,
          authType: true,
          isActive: true,
          createdAt: true,
        },
      });

      return NextResponse.json({ data: credential }, { status: 201 });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "A credential with this platform and name already exists" },
          { status: 409 }
        );
      }
      console.error("Error creating integration credential:", error);
      return NextResponse.json(
        { error: "Failed to create integration credential" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.integration-credentials", action: "create" }
);
