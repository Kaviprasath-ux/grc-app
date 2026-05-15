"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Home,
  ChevronRight,
  ShieldCheck,
  Shield,
  Cloud,
  Network,
  Globe,
  Briefcase,
  Bug,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { PLATFORMS, PLATFORM_INFO, type PlatformKey } from "@/lib/integrations/base-connector";

interface CredentialSummary {
  id: string;
  platform: string;
  name: string;
  isActive: boolean;
  lastTestStatus: string | null;
}

interface PlatformCard {
  platform: PlatformKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

const platformCards: PlatformCard[] = [
  {
    platform: PLATFORMS.AZURE_ENTRA,
    label: "Azure Entra (AD)",
    description: "Connect to Azure Active Directory for user accounts, MFA status, dormant users, and password policies.",
    icon: ShieldCheck,
  },
  {
    platform: PLATFORMS.AZURE_SECURITY,
    label: "Azure Security",
    description: "Connect to Azure Defender, Sentinel, Secure Score, and Cloud Security Posture Management.",
    icon: Shield,
  },
  {
    platform: PLATFORMS.GOOGLE_CLOUD,
    label: "Google Cloud Platform",
    description: "Connect to GCP Security Command Center for posture, findings, IAM, and cloud inventory.",
    icon: Cloud,
  },
  {
    platform: PLATFORMS.NETWORK_CISCO,
    label: "Cisco",
    description: "Connect to Cisco ASA/FTD firewalls for configuration analysis and compliance checks.",
    icon: Network,
  },
  {
    platform: PLATFORMS.NETWORK_PALOALTO,
    label: "Palo Alto Networks",
    description: "Connect to Palo Alto firewalls for security policy and configuration evidence.",
    icon: Network,
  },
  {
    platform: PLATFORMS.NETWORK_FORTIGATE,
    label: "FortiGate",
    description: "Connect to FortiGate firewalls for network security compliance evidence.",
    icon: Network,
  },
  {
    platform: PLATFORMS.SERVICENOW,
    label: "ServiceNow",
    description: "Connect to ServiceNow for incidents, change requests, and service desk evidence.",
    icon: Briefcase,
  },
  {
    platform: PLATFORMS.TENABLE,
    label: "Tenable",
    description: "Connect to Tenable for vulnerability scan results and security assessment data.",
    icon: Bug,
  },
  {
    platform: PLATFORMS.ACUNETIX,
    label: "Acunetix",
    description: "Connect to Acunetix for web application vulnerability scanning evidence.",
    icon: Globe,
  },
];

export default function TechnicalEvidenceSettingsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { canView, isLoading: permLoading } = usePermissions("compliance.integration-credentials");
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCredentials() {
      try {
        const res = await fetch("/api/integration-credentials");
        const json = await res.json();
        if (res.ok) {
          setCredentials(json.data || []);
        }
      } catch (err) {
        console.error("Error fetching credentials:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCredentials();
  }, []);

  if (permLoading || loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <Link href="/technical-evidence/dashboard" className="hover:text-primary-600 transition-colors">
              {t("Technical Evidence")}
            </Link>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Credential Vault")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Credential Vault")}</h1>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to manage integration credentials.")} />;
  }

  const getCredentialForPlatform = (platform: string) =>
    credentials.find((c) => c.platform === platform);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <Link href="/technical-evidence/dashboard" className="hover:text-primary-600 transition-colors">
            {t("Technical Evidence")}
          </Link>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Credential Vault")}</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Credential Vault")}</h1>
      <p className="text-sm text-slate-500">
        {t("Manage credentials for connecting to external platforms. Credentials are encrypted and stored securely.")}
      </p>

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {platformCards.map((card) => {
          const Icon = card.icon;
          const cred = getCredentialForPlatform(card.platform);
          const isConnected = cred?.isActive && cred?.lastTestStatus === "success";
          const hasCred = !!cred;

          return (
            <button
              key={card.platform}
              className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-3 ltr:text-left rtl:text-right cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all"
              onClick={() => router.push(`/technical-evidence/settings/${card.platform}`)}
            >
              <div className="flex items-center justify-between">
                <div className="p-3 bg-primary-50 rounded-xl">
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                {hasCred && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      isConnected
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {isConnected ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {isConnected ? t("Connected") : t("Disconnected")}
                  </span>
                )}
                {!hasCred && (
                  <span className="text-xs text-slate-400 font-medium">
                    {t("Not Configured")}
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">
                  {t(card.label)}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {t(card.description)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 self-end ltr:rotate-0 rtl:rotate-180" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
