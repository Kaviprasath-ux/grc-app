import { PLATFORMS, type PlatformKey } from "@/lib/integrations/base-connector";

const PLATFORM_DOMAIN_MAP: Record<string, string> = {
  [PLATFORMS.AZURE_ENTRA]: "Access Management",
  [PLATFORMS.AZURE_SECURITY]: "Security Monitoring",
  [PLATFORMS.GOOGLE_CLOUD]: "Cloud Security",
  [PLATFORMS.NETWORK_CISCO]: "Network Security",
  [PLATFORMS.NETWORK_PALOALTO]: "Network Security",
  [PLATFORMS.NETWORK_FORTIGATE]: "Network Security",
  [PLATFORMS.SERVICENOW]: "Change Management",
  [PLATFORMS.TENABLE]: "Vulnerability Management",
  [PLATFORMS.ACUNETIX]: "Vulnerability Management",
};

export function getDomainForPlatform(platform: string): string {
  return PLATFORM_DOMAIN_MAP[platform] || "Technical Evidence";
}

export function formatEvidenceName(
  displayName: string,
  collectedAt: Date
): string {
  const monthYear = collectedAt.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return `${displayName} - ${monthYear}`;
}
