/**
 * Azure Security connector for Defender, Sentinel, Secure Score, and CSPM.
 * Uses Azure REST APIs with OAuth 2.0 client credentials flow.
 */

import type {
  IntegrationConnector,
  CollectionResult,
  ConnectionTestResult,
  DataSourceDefinition,
} from "./base-connector";
import { PLATFORMS } from "./base-connector";

const AZURE_MGMT_URL = "https://management.azure.com";
const TOKEN_URL = "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";

async function getAzureToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const url = TOKEN_URL.replace("{tenantId}", tenantId);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://management.azure.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to acquire Azure management token: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function azureGet(
  token: string,
  path: string,
  apiVersion: string
): Promise<unknown> {
  const url = `${AZURE_MGMT_URL}${path}?api-version=${apiVersion}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Azure API error: ${res.status} ${errText}`);
  }

  return res.json();
}

const DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: "azure_security_defender_compliance",
    displayName: "Microsoft Defender: Device Compliance",
    description:
      "Fetches a list of all computers, their onboarding status to Defender, and their current risk score.",
    platform: PLATFORMS.AZURE_SECURITY,
  },
  {
    key: "azure_security_sentinel_incidents",
    displayName: "Microsoft Sentinel: Security Incidents",
    description:
      "Fetches the latest security events and incidents, including details on source, destination, and event severity.",
    platform: PLATFORMS.AZURE_SECURITY,
  },
  {
    key: "azure_security_secure_score",
    displayName: "Azure Secure Score Controls",
    description:
      "Fetches a list of all security controls and their remediation steps from your Microsoft Secure Score profile.",
    platform: PLATFORMS.AZURE_SECURITY,
  },
  {
    key: "azure_security_posture",
    displayName: "Azure Cloud Security Posture",
    description:
      "Fetches your Microsoft Azure Secure Score breakdown by control category, providing insights into your cloud security posture.",
    platform: PLATFORMS.AZURE_SECURITY,
  },
  {
    key: "azure_security_recommendations",
    displayName: "Defender for Cloud Recommendations",
    description:
      "Fetches active security hardening recommendations directly from Azure Resource Graph.",
    platform: PLATFORMS.AZURE_SECURITY,
  },
  {
    key: "azure_cspm_vulnerabilities",
    displayName: "Azure CSPM: Vulnerabilities",
    description:
      "Fetches specific vulnerability sub-assessments (e.g., CVEs, SQL vulnerabilities) from Defender for Cloud for all surfaces.",
    platform: PLATFORMS.AZURE_SECURITY,
  },
  {
    key: "azure_cspm_inventory",
    displayName: "Azure CSPM: Cloud Inventory",
    description:
      "Fetches a complete inventory of Azure resources (VMs, SQL, Storage, etc.) to map the cloud attack surface.",
    platform: PLATFORMS.AZURE_SECURITY,
  },
  {
    key: "azure_cspm_hardening",
    displayName: "Azure CSPM: Hardening Recommendations",
    description:
      "Converts detailed security hardening recommendations from Azure Defender for Cloud for all resources in a subscription.",
    platform: PLATFORMS.AZURE_SECURITY,
  },
];

async function collectDefenderCompliance(
  token: string,
  subscriptionId: string
): Promise<CollectionResult> {
  try {
    const data = (await azureGet(
      token,
      `/subscriptions/${subscriptionId}/providers/Microsoft.Security/assessments`,
      "2021-06-01"
    )) as { value?: Record<string, unknown>[] };

    const records = data.value || [];
    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [{ error: err instanceof Error ? err.message : "Unknown error", type: "defender_compliance" }],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch Defender compliance",
    };
  }
}

async function collectSentinelIncidents(
  token: string,
  subscriptionId: string
): Promise<CollectionResult> {
  try {
    // List resource groups to find Sentinel workspace
    const rgData = (await azureGet(
      token,
      `/subscriptions/${subscriptionId}/resourcegroups`,
      "2021-04-01"
    )) as { value?: { name: string }[] };

    const allIncidents: Record<string, unknown>[] = [];

    for (const rg of rgData.value || []) {
      try {
        // Try to find Log Analytics workspaces in each resource group
        const workspaces = (await azureGet(
          token,
          `/subscriptions/${subscriptionId}/resourceGroups/${rg.name}/providers/Microsoft.OperationalInsights/workspaces`,
          "2021-06-01"
        )) as { value?: { name: string }[] };

        for (const ws of workspaces.value || []) {
          try {
            const incidents = (await azureGet(
              token,
              `/subscriptions/${subscriptionId}/resourceGroups/${rg.name}/providers/Microsoft.OperationalInsights/workspaces/${ws.name}/providers/Microsoft.SecurityInsights/incidents`,
              "2023-11-01"
            )) as { value?: Record<string, unknown>[] };

            if (incidents.value) {
              allIncidents.push(...incidents.value);
            }
          } catch {
            // Workspace may not have Sentinel enabled
          }
        }
      } catch {
        // Skip resource groups without workspaces
      }
    }

    return { records: allIncidents, recordCount: allIncidents.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch Sentinel incidents",
    };
  }
}

async function collectSecureScore(
  token: string,
  subscriptionId: string
): Promise<CollectionResult> {
  try {
    const data = (await azureGet(
      token,
      `/subscriptions/${subscriptionId}/providers/Microsoft.Security/secureScoreControls`,
      "2020-01-01"
    )) as { value?: Record<string, unknown>[] };

    const records = data.value || [];
    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch Secure Score",
    };
  }
}

async function collectSecurityPosture(
  token: string,
  subscriptionId: string
): Promise<CollectionResult> {
  try {
    const data = (await azureGet(
      token,
      `/subscriptions/${subscriptionId}/providers/Microsoft.Security/secureScores`,
      "2020-01-01"
    )) as { value?: Record<string, unknown>[] };

    const records = data.value || [];
    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch security posture",
    };
  }
}

async function collectRecommendations(
  token: string,
  subscriptionId: string
): Promise<CollectionResult> {
  try {
    const data = (await azureGet(
      token,
      `/subscriptions/${subscriptionId}/providers/Microsoft.Security/recommendations`,
      "2020-01-01"
    )) as { value?: Record<string, unknown>[] };

    const records = data.value || [];
    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch recommendations",
    };
  }
}

async function collectVulnerabilities(
  token: string,
  subscriptionId: string
): Promise<CollectionResult> {
  try {
    const data = (await azureGet(
      token,
      `/subscriptions/${subscriptionId}/providers/Microsoft.Security/subAssessments`,
      "2019-01-01-preview"
    )) as { value?: Record<string, unknown>[] };

    const records = data.value || [];
    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch vulnerabilities",
    };
  }
}

async function collectCloudInventory(
  token: string,
  subscriptionId: string
): Promise<CollectionResult> {
  try {
    const data = (await azureGet(
      token,
      `/subscriptions/${subscriptionId}/resources`,
      "2021-04-01"
    )) as { value?: Record<string, unknown>[] };

    const records = data.value || [];
    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch cloud inventory",
    };
  }
}

async function collectHardeningRecommendations(
  token: string,
  subscriptionId: string
): Promise<CollectionResult> {
  try {
    const data = (await azureGet(
      token,
      `/subscriptions/${subscriptionId}/providers/Microsoft.Security/assessments`,
      "2021-06-01"
    )) as { value?: Record<string, unknown>[] };

    // Filter for hardening-related assessments
    const records = (data.value || []).filter((a) => {
      const status = (a.properties as Record<string, unknown>)?.status as Record<string, unknown> | undefined;
      return status?.code === "Unhealthy";
    });

    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch hardening recommendations",
    };
  }
}

export class AzureSecurityConnector implements IntegrationConnector {
  platform = PLATFORMS.AZURE_SECURITY;

  async testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    try {
      const { tenantId, clientId, clientSecret, subscriptionId } = credentials;
      if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
        return {
          success: false,
          error: "Missing required fields: tenantId, clientId, clientSecret, subscriptionId",
        };
      }

      const token = await getAzureToken(tenantId, clientId, clientSecret);
      // Verify subscription access
      await azureGet(token, `/subscriptions/${subscriptionId}`, "2021-04-01");

      return {
        success: true,
        details: "Successfully connected to Azure Security APIs",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async collectData(
    credentials: Record<string, string>,
    dataSource: string
  ): Promise<CollectionResult> {
    const { tenantId, clientId, clientSecret, subscriptionId } = credentials;
    const token = await getAzureToken(tenantId, clientId, clientSecret);

    switch (dataSource) {
      case "azure_security_defender_compliance":
        return collectDefenderCompliance(token, subscriptionId);
      case "azure_security_sentinel_incidents":
        return collectSentinelIncidents(token, subscriptionId);
      case "azure_security_secure_score":
        return collectSecureScore(token, subscriptionId);
      case "azure_security_posture":
        return collectSecurityPosture(token, subscriptionId);
      case "azure_security_recommendations":
        return collectRecommendations(token, subscriptionId);
      case "azure_cspm_vulnerabilities":
        return collectVulnerabilities(token, subscriptionId);
      case "azure_cspm_inventory":
        return collectCloudInventory(token, subscriptionId);
      case "azure_cspm_hardening":
        return collectHardeningRecommendations(token, subscriptionId);
      default:
        throw new Error(`Unknown data source: ${dataSource}`);
    }
  }

  getAvailableDataSources(): DataSourceDefinition[] {
    return DATA_SOURCES;
  }
}
