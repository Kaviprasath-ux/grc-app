/**
 * Google Cloud Platform connector using GCP REST APIs.
 * Uses Service Account JSON key for authentication.
 */

import crypto from "crypto";
import type {
  IntegrationConnector,
  CollectionResult,
  ConnectionTestResult,
  DataSourceDefinition,
} from "./base-connector";
import { PLATFORMS } from "./base-connector";

const GCP_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Create a JWT and exchange it for an access token using service account credentials */
async function getGcpToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  // Create JWT header and claims
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: GCP_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const signInput = `${header}.${claims}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(sa.private_key, "base64url");

  const jwt = `${signInput}.${signature}`;

  const res = await fetch(GCP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GCP token error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function gcpGet(token: string, url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GCP API error: ${res.status} ${errText}`);
  }

  return res.json();
}

const DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: "gcp_security_findings",
    displayName: "GCP: Security Findings",
    description:
      "Fetches security findings from Security Command Center including vulnerabilities, misconfigurations, and threats.",
    platform: PLATFORMS.GOOGLE_CLOUD,
  },
  {
    key: "gcp_asset_inventory",
    displayName: "GCP: Cloud Asset Inventory",
    description:
      "Fetches a complete inventory of all cloud resources across the project (VMs, storage, databases, networks).",
    platform: PLATFORMS.GOOGLE_CLOUD,
  },
  {
    key: "gcp_iam_policies",
    displayName: "GCP: IAM Policies",
    description:
      "Fetches IAM policies and role bindings for the project to review access control configurations.",
    platform: PLATFORMS.GOOGLE_CLOUD,
  },
  {
    key: "gcp_service_accounts",
    displayName: "GCP: Service Accounts",
    description:
      "Fetches all service accounts and their keys to identify over-privileged or unused accounts.",
    platform: PLATFORMS.GOOGLE_CLOUD,
  },
];

async function collectSecurityFindings(
  token: string,
  projectId: string
): Promise<CollectionResult> {
  try {
    // Security Command Center findings
    const data = (await gcpGet(
      token,
      `https://securitycenter.googleapis.com/v1/projects/${projectId}/sources/-/findings?pageSize=1000`
    )) as { listFindingsResults?: Record<string, unknown>[] };

    const records = (data.listFindingsResults || []).map((f) => f.finding || f) as Record<string, unknown>[];
    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    // Fallback: try organization-level SCC if project-level fails
    return {
      records: [{ note: "Security Command Center API may require organization-level access or SCC to be enabled" }],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch security findings",
    };
  }
}

async function collectAssetInventory(
  token: string,
  projectId: string
): Promise<CollectionResult> {
  try {
    const data = (await gcpGet(
      token,
      `https://cloudasset.googleapis.com/v1/projects/${projectId}/assets?contentType=RESOURCE&pageSize=1000`
    )) as { assets?: Record<string, unknown>[] };

    const records = data.assets || [];
    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch asset inventory",
    };
  }
}

async function collectIamPolicies(
  token: string,
  projectId: string
): Promise<CollectionResult> {
  try {
    const res = await fetch(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }),
      }
    );

    if (!res.ok) throw new Error(`IAM API error: ${res.status}`);

    const data = (await res.json()) as { bindings?: Record<string, unknown>[] };
    const records = data.bindings || [];

    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch IAM policies",
    };
  }
}

async function collectServiceAccounts(
  token: string,
  projectId: string
): Promise<CollectionResult> {
  try {
    const data = (await gcpGet(
      token,
      `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts?pageSize=100`
    )) as { accounts?: Record<string, unknown>[] };

    const records = data.accounts || [];
    return { records, recordCount: records.length, collectedAt: new Date() };
  } catch (err) {
    return {
      records: [],
      recordCount: 0,
      collectedAt: new Date(),
      error: err instanceof Error ? err.message : "Failed to fetch service accounts",
    };
  }
}

export class GoogleCloudConnector implements IntegrationConnector {
  platform = PLATFORMS.GOOGLE_CLOUD;

  async testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    try {
      const { projectId, serviceAccountJson } = credentials;
      if (!projectId || !serviceAccountJson) {
        return {
          success: false,
          error: "Missing required fields: projectId, serviceAccountJson",
        };
      }

      const token = await getGcpToken(serviceAccountJson);
      // Verify project access
      await gcpGet(
        token,
        `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`
      );

      return {
        success: true,
        details: "Successfully connected to Google Cloud Platform",
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
    const { projectId, serviceAccountJson } = credentials;
    const token = await getGcpToken(serviceAccountJson);

    switch (dataSource) {
      case "gcp_security_findings":
        return collectSecurityFindings(token, projectId);
      case "gcp_asset_inventory":
        return collectAssetInventory(token, projectId);
      case "gcp_iam_policies":
        return collectIamPolicies(token, projectId);
      case "gcp_service_accounts":
        return collectServiceAccounts(token, projectId);
      default:
        throw new Error(`Unknown data source: ${dataSource}`);
    }
  }

  getAvailableDataSources(): DataSourceDefinition[] {
    return DATA_SOURCES;
  }
}
