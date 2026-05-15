import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { decryptCredentials } from "@/lib/credential-encryption";
import { getConnector, isConnectorAvailable } from "@/lib/integrations/connector-registry";
import type { PlatformKey } from "@/lib/integrations/base-connector";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - Test connection for a credential
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const credential = await prisma.integrationCredential.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!credential) {
        return NextResponse.json({ error: "Credential not found" }, { status: 404 });
      }

      if (!isConnectorAvailable(credential.platform)) {
        return NextResponse.json(
          { error: `Connector for ${credential.platform} is not yet available` },
          { status: 400 }
        );
      }

      const decrypted = decryptCredentials(credential.credentialsEncrypted);
      const connector = await getConnector(credential.platform as PlatformKey);
      const result = await connector.testConnection(decrypted);

      // Update last test status
      await prisma.integrationCredential.update({
        where: { id },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: result.success ? "success" : "failed",
        },
      });

      return NextResponse.json({ data: result });
    } catch (error) {
      console.error("Error testing connection:", error);
      return NextResponse.json(
        { error: "Failed to test connection" },
        { status: 500 }
      );
    }
  },
  { resource: "technical-evidence.integration-credentials", action: "edit" }
);
