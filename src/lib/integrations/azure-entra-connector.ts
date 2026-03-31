/**
 * Azure Entra (Azure AD) connector using Microsoft Graph API.
 * Uses OAuth 2.0 client credentials flow.
 */

import type {
  IntegrationConnector,
  CollectionResult,
  ConnectionTestResult,
  DataSourceDefinition,
} from "./base-connector";
import { PLATFORMS } from "./base-connector";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";

interface GraphTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const url = TOKEN_URL.replace("{tenantId}", tenantId);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to acquire token: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as GraphTokenResponse;
  return data.access_token;
}

async function graphGet(
  token: string,
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${GRAPH_BASE_URL}${path}`);
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Graph API error: ${res.status} ${errText}`);
  }

  return res.json();
}

/** Paginate through all Graph API results */
async function graphGetAll(
  token: string,
  path: string,
  params?: Record<string, string>,
  maxRecords = 5000
): Promise<Record<string, unknown>[]> {
  const allRecords: Record<string, unknown>[] = [];
  let url: string | null = `${GRAPH_BASE_URL}${path}`;

  if (params) {
    const u = new URL(url);
    for (const [key, val] of Object.entries(params)) {
      u.searchParams.set(key, val);
    }
    url = u.toString();
  }

  while (url && allRecords.length < maxRecords) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Graph API error: ${res.status} ${errText}`);
    }

    const data = (await res.json()) as {
      value?: Record<string, unknown>[];
      "@odata.nextLink"?: string;
    };

    if (data.value) {
      allRecords.push(...data.value);
    }

    url = data["@odata.nextLink"] || null;
  }

  return allRecords;
}

const DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: "azure_entra_all_users",
    displayName: "Azure Entra: All User Accounts",
    description:
      "Fetches a complete list of user accounts, including their MFA status and last sign-in data.",
    platform: PLATFORMS.AZURE_ENTRA,
  },
  {
    key: "azure_entra_dormant_users",
    displayName: "Azure Entra: Dormant User Accounts",
    description:
      "Fetches a list of user accounts that have not signed in for over 90 days. This is crucial evidence for user access reviews.",
    platform: PLATFORMS.AZURE_ENTRA,
  },
  {
    key: "azure_entra_mfa_status",
    displayName: "Azure Entra: Users without MFA",
    description:
      "Fetches a list of all user accounts that do not have Multi-Factor Authentication (MFA) enabled.",
    platform: PLATFORMS.AZURE_ENTRA,
  },
  {
    key: "azure_entra_password_policies",
    displayName: "Azure Entra: Authentication & Password Policy",
    description:
      "Fetches tenant-wide policies for SSPR, MFA campaigns, and password complexity (length, character requirements).",
    platform: PLATFORMS.AZURE_ENTRA,
  },
];

async function collectAllUsers(token: string): Promise<CollectionResult> {
  const users = await graphGetAll(token, "/users", {
    $select:
      "id,displayName,userPrincipalName,mail,accountEnabled,createdDateTime,signInActivity,userType,assignedLicenses",
    $top: "999",
  });

  return {
    records: users,
    recordCount: users.length,
    collectedAt: new Date(),
  };
}

async function collectDormantUsers(token: string): Promise<CollectionResult> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const isoDate = ninetyDaysAgo.toISOString();

  // Get all users with signInActivity, then filter client-side for dormant
  const users = await graphGetAll(token, "/users", {
    $select:
      "id,displayName,userPrincipalName,mail,accountEnabled,signInActivity,createdDateTime",
    $top: "999",
  });

  const dormant = users.filter((u) => {
    const signInActivity = u.signInActivity as
      | { lastSignInDateTime?: string }
      | undefined;
    if (!signInActivity?.lastSignInDateTime) return true; // Never signed in
    return new Date(signInActivity.lastSignInDateTime) < ninetyDaysAgo;
  });

  return {
    records: dormant.map((u) => ({
      ...u,
      dormantSince: (
        (u.signInActivity as { lastSignInDateTime?: string } | undefined)
          ?.lastSignInDateTime || "Never"
      ),
      _filterDate: isoDate,
    })),
    recordCount: dormant.length,
    collectedAt: new Date(),
  };
}

async function collectMfaStatus(token: string): Promise<CollectionResult> {
  // Use authentication methods registration details
  try {
    const report = await graphGetAll(
      token,
      "/reports/authenticationMethods/userRegistrationDetails",
      { $top: "999" }
    );

    const usersWithoutMfa = report.filter((r) => {
      const methods = r.methodsRegistered as string[] | undefined;
      // Users who haven't registered any strong auth method
      return (
        !methods ||
        methods.length === 0 ||
        (!methods.includes("microsoftAuthenticator") &&
          !methods.includes("phoneAuthentication") &&
          !methods.includes("fido2") &&
          !methods.includes("softwareOneTimePasscode"))
      );
    });

    return {
      records: usersWithoutMfa,
      recordCount: usersWithoutMfa.length,
      collectedAt: new Date(),
    };
  } catch {
    // Fallback: fetch all users and flag those without strong auth
    const users = await graphGetAll(token, "/users", {
      $select: "id,displayName,userPrincipalName,accountEnabled",
      $top: "999",
    });

    return {
      records: users.map((u) => ({
        ...u,
        mfaStatus: "Unable to determine - requires Reports.Read.All permission",
      })),
      recordCount: users.length,
      collectedAt: new Date(),
    };
  }
}

async function collectPasswordPolicies(
  token: string
): Promise<CollectionResult> {
  const records: Record<string, unknown>[] = [];

  // Fetch authentication methods policy
  try {
    const authPolicy = await graphGet(
      token,
      "/policies/authenticationMethodsPolicy"
    );
    records.push({
      type: "authenticationMethodsPolicy",
      data: authPolicy,
    });
  } catch {
    records.push({
      type: "authenticationMethodsPolicy",
      error: "Insufficient permissions or policy not found",
    });
  }

  // Fetch authorization policy (password settings)
  try {
    const authzPolicy = await graphGet(token, "/policies/authorizationPolicy");
    records.push({
      type: "authorizationPolicy",
      data: authzPolicy,
    });
  } catch {
    records.push({
      type: "authorizationPolicy",
      error: "Insufficient permissions or policy not found",
    });
  }

  // Fetch conditional access policies
  try {
    const caPolicies = await graphGetAll(
      token,
      "/identity/conditionalAccess/policies"
    );
    records.push({
      type: "conditionalAccessPolicies",
      count: caPolicies.length,
      data: caPolicies,
    });
  } catch {
    records.push({
      type: "conditionalAccessPolicies",
      error: "Insufficient permissions - requires Policy.Read.All",
    });
  }

  return {
    records,
    recordCount: records.length,
    collectedAt: new Date(),
  };
}

export class AzureEntraConnector implements IntegrationConnector {
  platform = PLATFORMS.AZURE_ENTRA;

  async testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    try {
      const { tenantId, clientId, clientSecret } = credentials;
      if (!tenantId || !clientId || !clientSecret) {
        return {
          success: false,
          error: "Missing required fields: tenantId, clientId, clientSecret",
        };
      }

      const token = await getAccessToken(tenantId, clientId, clientSecret);
      // Verify we can read at least the org info
      await graphGet(token, "/organization");

      return {
        success: true,
        details: "Successfully connected to Azure Entra ID",
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
    const { tenantId, clientId, clientSecret } = credentials;
    const token = await getAccessToken(tenantId, clientId, clientSecret);

    switch (dataSource) {
      case "azure_entra_all_users":
        return collectAllUsers(token);
      case "azure_entra_dormant_users":
        return collectDormantUsers(token);
      case "azure_entra_mfa_status":
        return collectMfaStatus(token);
      case "azure_entra_password_policies":
        return collectPasswordPolicies(token);
      default:
        throw new Error(`Unknown data source: ${dataSource}`);
    }
  }

  getAvailableDataSources(): DataSourceDefinition[] {
    return DATA_SOURCES;
  }
}
