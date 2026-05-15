import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { decryptCredentials } from "@/lib/credential-encryption";
import { getConnector, isConnectorAvailable } from "@/lib/integrations/connector-registry";
import type { PlatformKey } from "@/lib/integrations/base-connector";
import { publishTechnicalEvidence } from "@/lib/technical-evidence/publish-evidence";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - Trigger data collection for a specific collection
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const collection = await prisma.technicalEvidenceCollection.findFirst({
        where: { id, ...tenantFilter },
        include: { credential: true },
      });

      if (!collection) {
        return NextResponse.json(
          { error: "Collection not found" },
          { status: 404 }
        );
      }

      if (!isConnectorAvailable(collection.platform)) {
        return NextResponse.json(
          { error: `Connector for ${collection.platform} is not yet available` },
          { status: 400 }
        );
      }

      // Mark as collecting
      await prisma.technicalEvidenceCollection.update({
        where: { id },
        data: { lastCollectionStatus: "collecting" },
      });

      try {
        const decrypted = decryptCredentials(
          collection.credential.credentialsEncrypted
        );
        const connector = await getConnector(collection.platform as PlatformKey);
        const result = await connector.collectData(decrypted, collection.dataSource);

        if (result.error) {
          await prisma.technicalEvidenceCollection.update({
            where: { id },
            data: {
              lastCollectionStatus: "failed",
              lastError: result.error,
              lastCollectedAt: new Date(),
              collectedById: session.id,
            },
          });
          return NextResponse.json(
            { error: result.error },
            { status: 500 }
          );
        }

        // Delete old records and insert new ones
        await prisma.technicalEvidenceRecord.deleteMany({
          where: { collectionId: id },
        });

        // Insert new records in batches of 100
        const batchSize = 100;
        for (let i = 0; i < result.records.length; i += batchSize) {
          const batch = result.records.slice(i, i + batchSize);
          await prisma.technicalEvidenceRecord.createMany({
            data: batch.map((record) => {
              const jsonStr = JSON.stringify(record);
              return {
                collectionId: id,
                data: jsonStr,
                recordHash: crypto
                  .createHash("sha256")
                  .update(jsonStr)
                  .digest("hex"),
                collectedAt: result.collectedAt,
              };
            }),
          });
        }

        // Update collection status
        await prisma.technicalEvidenceCollection.update({
          where: { id },
          data: {
            lastCollectionStatus: "success",
            lastError: null,
            lastCollectedAt: result.collectedAt,
            recordCount: result.recordCount,
            collectedById: session.id,
          },
        });

        // Auto-publish as compliance Evidence (best-effort, don't fail collect)
        let evidencePublished = false;
        let evidenceCode: string | null = null;
        try {
          const customerAccountId = getCustomerAccountId(session);
          if (customerAccountId) {
            const publishResult = await publishTechnicalEvidence(id, {
              id: session.id,
              customerAccountId,
            });
            evidencePublished = true;
            evidenceCode = publishResult.evidenceCode;
          }
        } catch (publishError) {
          console.error("Auto-publish evidence failed (non-blocking):", publishError);
        }

        return NextResponse.json({
          data: {
            recordCount: result.recordCount,
            collectedAt: result.collectedAt,
            evidencePublished,
            evidenceCode,
          },
          message: `Successfully collected ${result.recordCount} records${evidencePublished ? ` → Evidence ${evidenceCode}` : ""}`,
        });
      } catch (collectionError) {
        const errorMessage =
          collectionError instanceof Error
            ? collectionError.message
            : "Unknown collection error";

        await prisma.technicalEvidenceCollection.update({
          where: { id },
          data: {
            lastCollectionStatus: "failed",
            lastError: errorMessage,
            lastCollectedAt: new Date(),
            collectedById: session.id,
          },
        });

        return NextResponse.json(
          { error: `Collection failed: ${errorMessage}` },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("Error collecting technical evidence:", error);
      return NextResponse.json(
        { error: "Failed to collect technical evidence" },
        { status: 500 }
      );
    }
  },
  { resource: "technical-evidence.dashboard", action: "create" }
);
