/**
 * Tenable connector for vulnerability scan data.
 * Uses Tenable.io REST API with API key authentication.
 */

import type {
  IntegrationConnector,
  CollectionResult,
  ConnectionTestResult,
  DataSourceDefinition,
} from "./base-connector";
import { PLATFORMS } from "./base-connector";

const TENABLE_BASE_URL = "https://cloud.tenable.com";

async function tenableGet(
  accessKey: string,
  secretKey: string,
  path: string
): Promise<unknown> {
  const res = await fetch(`${TENABLE_BASE_URL}${path}`, {
    headers: {
      "X-ApiKeys": `accessKey=${accessKey};secretKey=${secretKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Tenable API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

const DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: "tenable_scans",
    displayName: "Tenable: Scan Results",
    description: "Fetches all vulnerability scans and their summary results.",
    platform: PLATFORMS.TENABLE,
  },
  {
    key: "tenable_vulnerabilities",
    displayName: "Tenable: Vulnerabilities",
    description: "Fetches detailed vulnerability findings across all assets.",
    platform: PLATFORMS.TENABLE,
  },
  {
    key: "tenable_assets",
    displayName: "Tenable: Asset Inventory",
    description: "Fetches all assets discovered and tracked by Tenable.",
    platform: PLATFORMS.TENABLE,
  },
];

export class TenableConnector implements IntegrationConnector {
  platform = PLATFORMS.TENABLE;

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    try {
      const { accessKey, secretKey } = credentials;
      if (!accessKey || !secretKey) {
        return { success: false, error: "Missing required fields: accessKey, secretKey" };
      }

      await tenableGet(accessKey, secretKey, "/scans");
      return { success: true, details: "Successfully connected to Tenable.io" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async collectData(credentials: Record<string, string>, dataSource: string): Promise<CollectionResult> {
    const { accessKey, secretKey } = credentials;

    try {
      switch (dataSource) {
        case "tenable_scans": {
          const data = (await tenableGet(accessKey, secretKey, "/scans")) as {
            scans?: Record<string, unknown>[];
          };
          const records = data.scans || [];
          return { records, recordCount: records.length, collectedAt: new Date() };
        }

        case "tenable_vulnerabilities": {
          const data = (await tenableGet(
            accessKey,
            secretKey,
            "/workbenches/vulnerabilities?date_range=30"
          )) as { vulnerabilities?: Record<string, unknown>[] };
          const records = data.vulnerabilities || [];
          return { records, recordCount: records.length, collectedAt: new Date() };
        }

        case "tenable_assets": {
          const data = (await tenableGet(
            accessKey,
            secretKey,
            "/workbenches/assets"
          )) as { assets?: Record<string, unknown>[] };
          const records = data.assets || [];
          return { records, recordCount: records.length, collectedAt: new Date() };
        }

        default:
          throw new Error(`Unknown data source: ${dataSource}`);
      }
    } catch (err) {
      return {
        records: [],
        recordCount: 0,
        collectedAt: new Date(),
        error: err instanceof Error ? err.message : "Collection failed",
      };
    }
  }

  getAvailableDataSources(): DataSourceDefinition[] {
    return DATA_SOURCES;
  }
}
