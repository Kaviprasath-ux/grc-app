/**
 * ServiceNow connector using the Table API.
 * Pulls incidents, change requests, and CMDB data.
 */

import type {
  IntegrationConnector,
  CollectionResult,
  ConnectionTestResult,
  DataSourceDefinition,
} from "./base-connector";
import { PLATFORMS } from "./base-connector";

async function snowGet(
  instanceUrl: string,
  username: string,
  password: string,
  table: string,
  params?: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const baseUrl = instanceUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}/api/now/table/${table}`);

  url.searchParams.set("sysparm_limit", "1000");
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`ServiceNow API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { result?: Record<string, unknown>[] };
  return data.result || [];
}

const DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: "servicenow_incidents",
    displayName: "ServiceNow: Incidents",
    description: "Fetches active and recent incidents from the ServiceNow incident table.",
    platform: PLATFORMS.SERVICENOW,
  },
  {
    key: "servicenow_changes",
    displayName: "ServiceNow: Change Requests",
    description: "Fetches change requests to track infrastructure and application changes.",
    platform: PLATFORMS.SERVICENOW,
  },
  {
    key: "servicenow_cmdb",
    displayName: "ServiceNow: CMDB Configuration Items",
    description: "Fetches configuration items from the CMDB for asset and infrastructure evidence.",
    platform: PLATFORMS.SERVICENOW,
  },
];

export class ServiceNowConnector implements IntegrationConnector {
  platform = PLATFORMS.SERVICENOW;

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    try {
      const { instanceUrl, username, password } = credentials;
      if (!instanceUrl || !username || !password) {
        return { success: false, error: "Missing required fields: instanceUrl, username, password" };
      }

      // Test by fetching 1 incident
      await snowGet(instanceUrl, username, password, "incident", { sysparm_limit: "1" });
      return { success: true, details: "Successfully connected to ServiceNow" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async collectData(credentials: Record<string, string>, dataSource: string): Promise<CollectionResult> {
    const { instanceUrl, username, password } = credentials;

    try {
      let table: string;
      let params: Record<string, string> = {};

      switch (dataSource) {
        case "servicenow_incidents":
          table = "incident";
          params = {
            sysparm_fields: "number,short_description,priority,state,category,subcategory,assigned_to,opened_at,resolved_at,close_code,impact,urgency",
            sysparm_query: "stateIN1,2,3^ORDERBYDESCopened_at",
          };
          break;
        case "servicenow_changes":
          table = "change_request";
          params = {
            sysparm_fields: "number,short_description,type,state,priority,risk,category,requested_by,start_date,end_date,approval",
            sysparm_query: "ORDERBYDESCsys_created_on",
          };
          break;
        case "servicenow_cmdb":
          table = "cmdb_ci";
          params = {
            sysparm_fields: "name,sys_class_name,category,subcategory,operational_status,ip_address,os,manufacturer,model_id",
            sysparm_query: "operational_status=1^ORDERBYname",
          };
          break;
        default:
          throw new Error(`Unknown data source: ${dataSource}`);
      }

      const records = await snowGet(instanceUrl, username, password, table, params);
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
    return DATA_SOURCES;
  }
}
