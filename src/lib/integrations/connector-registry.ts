/**
 * Registry that maps platform identifiers to their connector implementations.
 * Uses lazy loading to avoid importing all connectors upfront.
 */

import type { IntegrationConnector } from "./base-connector";
import { PLATFORMS, type PlatformKey } from "./base-connector";

const connectorCache = new Map<PlatformKey, IntegrationConnector>();

export async function getConnector(
  platform: PlatformKey
): Promise<IntegrationConnector> {
  if (connectorCache.has(platform)) {
    return connectorCache.get(platform)!;
  }

  let connector: IntegrationConnector;

  switch (platform) {
    case PLATFORMS.AZURE_ENTRA: {
      const { AzureEntraConnector } = await import("./azure-entra-connector");
      connector = new AzureEntraConnector();
      break;
    }
    case PLATFORMS.AZURE_SECURITY: {
      const { AzureSecurityConnector } = await import("./azure-security-connector");
      connector = new AzureSecurityConnector();
      break;
    }
    case PLATFORMS.GOOGLE_CLOUD: {
      const { GoogleCloudConnector } = await import("./google-cloud-connector");
      connector = new GoogleCloudConnector();
      break;
    }
    case PLATFORMS.NETWORK_CISCO: {
      const { CiscoConnector } = await import("./network-connector");
      connector = new CiscoConnector();
      break;
    }
    case PLATFORMS.NETWORK_PALOALTO: {
      const { PaloAltoConnector } = await import("./network-connector");
      connector = new PaloAltoConnector();
      break;
    }
    case PLATFORMS.NETWORK_FORTIGATE: {
      const { FortiGateConnector } = await import("./network-connector");
      connector = new FortiGateConnector();
      break;
    }
    case PLATFORMS.SERVICENOW: {
      const { ServiceNowConnector } = await import("./servicenow-connector");
      connector = new ServiceNowConnector();
      break;
    }
    case PLATFORMS.TENABLE: {
      const { TenableConnector } = await import("./tenable-connector");
      connector = new TenableConnector();
      break;
    }
    case PLATFORMS.ACUNETIX: {
      const { AcunetixConnector } = await import("./acunetix-connector");
      connector = new AcunetixConnector();
      break;
    }
    default:
      throw new Error(
        `No connector available for platform: ${platform}.`
      );
  }

  connectorCache.set(platform, connector);
  return connector;
}

/** Check if a connector is implemented for a given platform */
export function isConnectorAvailable(platform: string): boolean {
  const available: string[] = [
    PLATFORMS.AZURE_ENTRA,
    PLATFORMS.AZURE_SECURITY,
    PLATFORMS.GOOGLE_CLOUD,
    PLATFORMS.NETWORK_CISCO,
    PLATFORMS.NETWORK_PALOALTO,
    PLATFORMS.NETWORK_FORTIGATE,
    PLATFORMS.SERVICENOW,
    PLATFORMS.TENABLE,
    PLATFORMS.ACUNETIX,
  ];
  return available.includes(platform);
}
