/**
 * Acunetix connector for web application vulnerability scanning.
 * Uses Acunetix REST API with API key authentication.
 */

import type {
  IntegrationConnector,
  CollectionResult,
  ConnectionTestResult,
  DataSourceDefinition,
} from "./base-connector";
import { PLATFORMS } from "./base-connector";

async function acunetixGet(
  apiUrl: string,
  apiKey: string,
  path: string
): Promise<unknown> {
  const baseUrl = apiUrl.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: {
      "X-Auth": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Acunetix API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

const DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: "acunetix_scans",
    displayName: "Acunetix: Scan Results",
    description: "Fetches all web vulnerability scans and their status/results.",
    platform: PLATFORMS.ACUNETIX,
  },
  {
    key: "acunetix_vulnerabilities",
    displayName: "Acunetix: Vulnerabilities",
    description: "Fetches all discovered web application vulnerabilities with severity and details.",
    platform: PLATFORMS.ACUNETIX,
  },
  {
    key: "acunetix_targets",
    displayName: "Acunetix: Scan Targets",
    description: "Fetches all configured web application scan targets.",
    platform: PLATFORMS.ACUNETIX,
  },
];

export class AcunetixConnector implements IntegrationConnector {
  platform = PLATFORMS.ACUNETIX;

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    try {
      const { apiUrl, apiKey } = credentials;
      if (!apiUrl || !apiKey) {
        return { success: false, error: "Missing required fields: apiUrl, apiKey" };
      }

      await acunetixGet(apiUrl, apiKey, "/me");
      return { success: true, details: "Successfully connected to Acunetix" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async collectData(credentials: Record<string, string>, dataSource: string): Promise<CollectionResult> {
    const { apiUrl, apiKey } = credentials;

    try {
      switch (dataSource) {
        case "acunetix_scans": {
          const data = (await acunetixGet(apiUrl, apiKey, "/scans")) as {
            scans?: Record<string, unknown>[];
          };
          const records = data.scans || [];
          return { records, recordCount: records.length, collectedAt: new Date() };
        }

        case "acunetix_vulnerabilities": {
          const data = (await acunetixGet(apiUrl, apiKey, "/vulnerabilities")) as {
            vulnerabilities?: Record<string, unknown>[];
          };
          const records = data.vulnerabilities || [];
          return { records, recordCount: records.length, collectedAt: new Date() };
        }

        case "acunetix_targets": {
          const data = (await acunetixGet(apiUrl, apiKey, "/targets")) as {
            targets?: Record<string, unknown>[];
          };
          const records = data.targets || [];
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
