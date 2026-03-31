/**
 * Base interfaces for all platform integration connectors.
 */

export interface CollectionResult {
  records: Record<string, unknown>[];
  recordCount: number;
  collectedAt: Date;
  error?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  details?: string;
}

export interface DataSourceDefinition {
  key: string; // e.g., "azure_entra_all_users"
  displayName: string; // e.g., "Azure Entra: All User Accounts"
  description: string;
  platform: string;
}

export interface IntegrationConnector {
  platform: string;
  testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult>;
  collectData(
    credentials: Record<string, string>,
    dataSource: string
  ): Promise<CollectionResult>;
  getAvailableDataSources(): DataSourceDefinition[];
}

/** All supported platform identifiers */
export const PLATFORMS = {
  AZURE_ENTRA: "azure_entra",
  AZURE_SECURITY: "azure_security",
  GOOGLE_CLOUD: "google_cloud",
  NETWORK_CISCO: "network_cisco",
  NETWORK_PALOALTO: "network_paloalto",
  NETWORK_FORTIGATE: "network_fortigate",
  SERVICENOW: "servicenow",
  TENABLE: "tenable",
  ACUNETIX: "acunetix",
} as const;

export type PlatformKey = (typeof PLATFORMS)[keyof typeof PLATFORMS];

/** Platform display metadata */
export const PLATFORM_INFO: Record<
  PlatformKey,
  { label: string; category: string; authType: string; requiredFields: string[] }
> = {
  [PLATFORMS.AZURE_ENTRA]: {
    label: "Azure Entra (AD)",
    category: "Microsoft Azure & Defender",
    authType: "oauth2",
    requiredFields: ["tenantId", "clientId", "clientSecret"],
  },
  [PLATFORMS.AZURE_SECURITY]: {
    label: "Azure Security",
    category: "Microsoft Azure & Defender",
    authType: "oauth2",
    requiredFields: ["tenantId", "clientId", "clientSecret", "subscriptionId"],
  },
  [PLATFORMS.GOOGLE_CLOUD]: {
    label: "Google Cloud Platform",
    category: "Google Cloud Platform",
    authType: "service_account",
    requiredFields: ["projectId", "serviceAccountJson"],
  },
  [PLATFORMS.NETWORK_CISCO]: {
    label: "Cisco",
    category: "Network Security",
    authType: "basic_auth",
    requiredFields: ["hostUrl", "username", "password"],
  },
  [PLATFORMS.NETWORK_PALOALTO]: {
    label: "Palo Alto Networks",
    category: "Network Security",
    authType: "api_key",
    requiredFields: ["hostUrl", "apiKey"],
  },
  [PLATFORMS.NETWORK_FORTIGATE]: {
    label: "FortiGate",
    category: "Network Security",
    authType: "api_key",
    requiredFields: ["hostUrl", "apiToken"],
  },
  [PLATFORMS.SERVICENOW]: {
    label: "ServiceNow",
    category: "Service Desk",
    authType: "basic_auth",
    requiredFields: ["instanceUrl", "username", "password"],
  },
  [PLATFORMS.TENABLE]: {
    label: "Tenable",
    category: "Tenable",
    authType: "api_key",
    requiredFields: ["accessKey", "secretKey"],
  },
  [PLATFORMS.ACUNETIX]: {
    label: "Acunetix",
    category: "Acunetix",
    authType: "api_key",
    requiredFields: ["apiUrl", "apiKey"],
  },
};

/** Group platforms by their UI tab category */
export const PLATFORM_CATEGORIES = [
  {
    key: "azure_entra",
    label: "Microsoft Azure & Defender",
    platforms: [PLATFORMS.AZURE_ENTRA, PLATFORMS.AZURE_SECURITY],
  },
  {
    key: "network",
    label: "Network Security",
    platforms: [PLATFORMS.NETWORK_CISCO, PLATFORMS.NETWORK_PALOALTO, PLATFORMS.NETWORK_FORTIGATE],
  },
  {
    key: "tenable",
    label: "Tenable",
    platforms: [PLATFORMS.TENABLE],
  },
  {
    key: "acunetix",
    label: "Acunetix",
    platforms: [PLATFORMS.ACUNETIX],
  },
  {
    key: "servicenow",
    label: "Service Desk",
    platforms: [PLATFORMS.SERVICENOW],
  },
  {
    key: "google_cloud",
    label: "Google Cloud Platform",
    platforms: [PLATFORMS.GOOGLE_CLOUD],
  },
];
