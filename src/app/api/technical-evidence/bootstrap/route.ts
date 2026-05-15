import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { getConnector, isConnectorAvailable } from "@/lib/integrations/connector-registry";
import type { PlatformKey } from "@/lib/integrations/base-connector";

// POST - Initialize default collections for a credential
// Called after creating a credential to set up the available data sources
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
      const { credentialId } = body;

      if (!credentialId) {
        return NextResponse.json(
          { error: "credentialId is required" },
          { status: 400 }
        );
      }

      // Verify credential belongs to tenant
      const credential = await prisma.integrationCredential.findFirst({
        where: { id: credentialId, customerAccountId },
      });

      if (!credential) {
        return NextResponse.json(
          { error: "Credential not found" },
          { status: 404 }
        );
      }

      if (!isConnectorAvailable(credential.platform)) {
        return NextResponse.json(
          { error: `Connector for ${credential.platform} is not yet available` },
          { status: 400 }
        );
      }

      const connector = await getConnector(credential.platform as PlatformKey);
      const dataSources = connector.getAvailableDataSources();

      // Upsert collections for each data source
      const created = [];
      for (const ds of dataSources) {
        const collection = await prisma.technicalEvidenceCollection.upsert({
          where: {
            customerAccountId_credentialId_dataSource: {
              customerAccountId,
              credentialId,
              dataSource: ds.key,
            },
          },
          create: {
            customerAccountId,
            credentialId,
            platform: ds.platform,
            dataSource: ds.key,
            displayName: ds.displayName,
            description: ds.description,
          },
          update: {
            displayName: ds.displayName,
            description: ds.description,
          },
        });
        created.push(collection);
      }

      return NextResponse.json(
        { data: created, message: `${created.length} collections initialized` },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error bootstrapping collections:", error);
      return NextResponse.json(
        { error: "Failed to bootstrap collections" },
        { status: 500 }
      );
    }
  },
  { resource: "technical-evidence.dashboard", action: "create" }
);
