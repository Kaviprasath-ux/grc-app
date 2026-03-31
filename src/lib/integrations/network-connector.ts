/**
 * Network device connectors for Cisco, Palo Alto, and FortiGate firewalls.
 * Uses REST APIs for configuration retrieval and compliance checks.
 */

import type {
  IntegrationConnector,
  CollectionResult,
  ConnectionTestResult,
  DataSourceDefinition,
} from "./base-connector";
import { PLATFORMS } from "./base-connector";

// ============================================================
// CISCO CONNECTOR
// ============================================================

const CISCO_DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: "cisco_running_config",
    displayName: "Cisco: Running Configuration",
    description: "Fetches the running configuration from Cisco ASA/FTD for compliance analysis.",
    platform: PLATFORMS.NETWORK_CISCO,
  },
  {
    key: "cisco_access_rules",
    displayName: "Cisco: Access Rules",
    description: "Fetches firewall access control rules and policies.",
    platform: PLATFORMS.NETWORK_CISCO,
  },
  {
    key: "cisco_interfaces",
    displayName: "Cisco: Network Interfaces",
    description: "Fetches network interface status and configuration.",
    platform: PLATFORMS.NETWORK_CISCO,
  },
];

async function ciscoApiGet(
  hostUrl: string,
  path: string,
  username: string,
  password: string
): Promise<unknown> {
  const baseUrl = hostUrl.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/api${path}`, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
      "Content-Type": "application/json",
    },
    // Allow self-signed certs in network devices
  });

  if (!res.ok) {
    throw new Error(`Cisco API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export class CiscoConnector implements IntegrationConnector {
  platform = PLATFORMS.NETWORK_CISCO;

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    try {
      const { hostUrl, username, password } = credentials;
      if (!hostUrl || !username || !password) {
        return { success: false, error: "Missing required fields: hostUrl, username, password" };
      }
      await ciscoApiGet(hostUrl, "/monitoring/serialnumber", username, password);
      return { success: true, details: "Successfully connected to Cisco device" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async collectData(credentials: Record<string, string>, dataSource: string): Promise<CollectionResult> {
    const { hostUrl, username, password } = credentials;

    try {
      let path: string;
      switch (dataSource) {
        case "cisco_running_config":
          path = "/cli";
          // For CLI-based config retrieval, use a POST with command
          const configRes = await fetch(`${hostUrl.replace(/\/$/, "")}/api/cli`, {
            method: "POST",
            headers: {
              Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ commands: ["show running-config"] }),
          });
          if (!configRes.ok) throw new Error(`Cisco API error: ${configRes.status}`);
          const configData = await configRes.json();
          return {
            records: [{ type: "running_config", data: configData }],
            recordCount: 1,
            collectedAt: new Date(),
          };

        case "cisco_access_rules":
          path = "/access/in/InterfaceName/rules";
          break;
        case "cisco_interfaces":
          path = "/monitoring/interfaces";
          break;
        default:
          throw new Error(`Unknown data source: ${dataSource}`);
      }

      const data = (await ciscoApiGet(hostUrl, path, username, password)) as {
        items?: Record<string, unknown>[];
      };
      const records = data.items || [data as Record<string, unknown>];
      return { records, recordCount: records.length, collectedAt: new Date() };
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
    return CISCO_DATA_SOURCES;
  }
}

// ============================================================
// PALO ALTO CONNECTOR
// ============================================================

const PALOALTO_DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: "paloalto_security_rules",
    displayName: "Palo Alto: Security Rules",
    description: "Fetches all security policy rules configured on the Palo Alto firewall.",
    platform: PLATFORMS.NETWORK_PALOALTO,
  },
  {
    key: "paloalto_system_info",
    displayName: "Palo Alto: System Information",
    description: "Fetches device system information including software version, uptime, and serial number.",
    platform: PLATFORMS.NETWORK_PALOALTO,
  },
  {
    key: "paloalto_threat_logs",
    displayName: "Palo Alto: Threat Logs",
    description: "Fetches recent threat detection logs from the firewall.",
    platform: PLATFORMS.NETWORK_PALOALTO,
  },
];

async function paloAltoGet(
  hostUrl: string,
  apiKey: string,
  type: string,
  cmd: string
): Promise<unknown> {
  const baseUrl = hostUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/?type=${type}&cmd=${encodeURIComponent(cmd)}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Palo Alto API error: ${res.status}`);
  }

  const text = await res.text();
  // PA API returns XML; store as text for now
  return { rawResponse: text };
}

export class PaloAltoConnector implements IntegrationConnector {
  platform = PLATFORMS.NETWORK_PALOALTO;

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    try {
      const { hostUrl, apiKey } = credentials;
      if (!hostUrl || !apiKey) {
        return { success: false, error: "Missing required fields: hostUrl, apiKey" };
      }
      await paloAltoGet(hostUrl, apiKey, "op", "<show><system><info></info></system></show>");
      return { success: true, details: "Successfully connected to Palo Alto device" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async collectData(credentials: Record<string, string>, dataSource: string): Promise<CollectionResult> {
    const { hostUrl, apiKey } = credentials;

    try {
      let cmd: string;
      let type = "op";

      switch (dataSource) {
        case "paloalto_security_rules":
          type = "config";
          cmd = "<show><config><running><xpath>devices/entry/vsys/entry/rulebase/security/rules</xpath></running></config></show>";
          break;
        case "paloalto_system_info":
          cmd = "<show><system><info></info></system></show>";
          break;
        case "paloalto_threat_logs":
          type = "log";
          cmd = "<show><log><threat><last-n-logs>100</last-n-logs></threat></log></show>";
          break;
        default:
          throw new Error(`Unknown data source: ${dataSource}`);
      }

      const data = await paloAltoGet(hostUrl, apiKey, type, cmd);
      return {
        records: [data as Record<string, unknown>],
        recordCount: 1,
        collectedAt: new Date(),
      };
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
    return PALOALTO_DATA_SOURCES;
  }
}

// ============================================================
// FORTIGATE CONNECTOR
// ============================================================

const FORTIGATE_DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: "fortigate_firewall_policies",
    displayName: "FortiGate: Firewall Policies",
    description: "Fetches all firewall policies configured on the FortiGate device.",
    platform: PLATFORMS.NETWORK_FORTIGATE,
  },
  {
    key: "fortigate_system_status",
    displayName: "FortiGate: System Status",
    description: "Fetches device system status including firmware version, serial, and resource usage.",
    platform: PLATFORMS.NETWORK_FORTIGATE,
  },
  {
    key: "fortigate_security_events",
    displayName: "FortiGate: Security Events",
    description: "Fetches recent IPS and antivirus security events from the FortiGate.",
    platform: PLATFORMS.NETWORK_FORTIGATE,
  },
];

async function fortiGateGet(
  hostUrl: string,
  apiToken: string,
  path: string
): Promise<unknown> {
  const baseUrl = hostUrl.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/api/v2${path}?access_token=${apiToken}`);

  if (!res.ok) {
    throw new Error(`FortiGate API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export class FortiGateConnector implements IntegrationConnector {
  platform = PLATFORMS.NETWORK_FORTIGATE;

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    try {
      const { hostUrl, apiToken } = credentials;
      if (!hostUrl || !apiToken) {
        return { success: false, error: "Missing required fields: hostUrl, apiToken" };
      }
      await fortiGateGet(hostUrl, apiToken, "/monitor/system/status");
      return { success: true, details: "Successfully connected to FortiGate device" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async collectData(credentials: Record<string, string>, dataSource: string): Promise<CollectionResult> {
    const { hostUrl, apiToken } = credentials;

    try {
      let path: string;
      switch (dataSource) {
        case "fortigate_firewall_policies":
          path = "/cmdb/firewall/policy";
          break;
        case "fortigate_system_status":
          path = "/monitor/system/status";
          break;
        case "fortigate_security_events":
          path = "/monitor/log/event";
          break;
        default:
          throw new Error(`Unknown data source: ${dataSource}`);
      }

      const data = (await fortiGateGet(hostUrl, apiToken, path)) as {
        results?: Record<string, unknown>[];
      };
      const records = data.results || [data as Record<string, unknown>];
      return { records, recordCount: records.length, collectedAt: new Date() };
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
    return FORTIGATE_DATA_SOURCES;
  }
}
