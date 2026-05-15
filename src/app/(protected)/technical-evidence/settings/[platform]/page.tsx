"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Home,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PLATFORM_INFO, type PlatformKey } from "@/lib/integrations/base-connector";

interface ExistingCredential {
  id: string;
  platform: string;
  name: string;
  authType: string;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  credentials: Record<string, string>;
}

const FIELD_LABELS: Record<string, string> = {
  tenantId: "Tenant ID",
  clientId: "Client ID",
  clientSecret: "Client Secret",
  subscriptionId: "Subscription ID",
  projectId: "Project ID",
  serviceAccountJson: "Service Account JSON",
  hostUrl: "Host URL",
  username: "Username",
  password: "Password",
  apiKey: "API Key",
  apiToken: "API Token",
  instanceUrl: "Instance URL",
  accessKey: "Access Key",
  secretKey: "Secret Key",
  apiUrl: "API URL",
};

export default function PlatformCredentialPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
  const { canCreate, canEdit, canDelete, isLoading: permLoading } = usePermissions(
    "compliance.integration-credentials"
  );
  const [existing, setExisting] = useState<ExistingCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [credName, setCredName] = useState("");

  const platformInfo = PLATFORM_INFO[platform as PlatformKey];

  useEffect(() => {
    async function fetchExisting() {
      try {
        const res = await fetch(
          `/api/integration-credentials?platform=${platform}`
        );
        const json = await res.json();
        if (res.ok && json.data?.length > 0) {
          const cred = json.data[0];
          setExisting(cred);
          setCredName(cred.name);
          // Pre-fill masked values
          if (cred.credentials) {
            setFormValues(
              Object.fromEntries(
                Object.keys(cred.credentials).map((k) => [k, ""])
              )
            );
          }
        } else {
          // Initialize empty form
          const fields = platformInfo?.requiredFields || [];
          setFormValues(
            Object.fromEntries(fields.map((f) => [f, ""]))
          );
          setCredName(platformInfo?.label || platform);
        }
      } catch (err) {
        console.error("Error fetching credential:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchExisting();
  }, [platform, platformInfo]);

  const handleSave = async () => {
    // Validate required fields are filled (for new) or at least one changed (for update)
    const requiredFields = platformInfo?.requiredFields || [];
    const isNew = !existing;

    if (isNew) {
      const missing = requiredFields.filter((f) => !formValues[f]?.trim());
      if (missing.length > 0) {
        toast.error(
          `${t("Missing required fields")}: ${missing.map((f) => FIELD_LABELS[f] || f).join(", ")}`
        );
        return;
      }
    }

    setSaving(true);
    try {
      if (isNew) {
        // Create
        const res = await fetch("/api/integration-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            name: credName || platformInfo?.label || platform,
            authType: platformInfo?.authType || "oauth2",
            credentials: formValues,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || t("Failed to save"));
          return;
        }

        // Bootstrap collections
        await fetch("/api/technical-evidence/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credentialId: json.data.id }),
        });

        toast.success(t("Credential saved and data sources initialized"));
        router.push("/technical-evidence/settings");
      } else {
        // Update - only send non-empty fields
        const updatedCreds: Record<string, string> = {};
        for (const [k, v] of Object.entries(formValues)) {
          if (v.trim()) updatedCreds[k] = v;
        }

        const body: Record<string, unknown> = { name: credName };
        if (Object.keys(updatedCreds).length > 0) {
          body.credentials = updatedCreds;
        }

        const res = await fetch(
          `/api/integration-credentials/${existing.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || t("Failed to update"));
          return;
        }
        toast.success(t("Credential updated"));
        // Refresh existing credential data without navigating away
        const refreshRes = await fetch(`/api/integration-credentials?platform=${platform}`);
        const refreshJson = await refreshRes.json();
        if (refreshRes.ok && refreshJson.data?.length > 0) {
          const cred = refreshJson.data[0];
          setExisting(cred);
          setCredName(cred.name);
          setFormValues(Object.fromEntries(Object.keys(cred.credentials).map((k) => [k, ""])));
        }
      }
    } catch {
      toast.error(t("Failed to save credential"));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!existing) {
      toast.error(t("Save the credential first before testing"));
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(
        `/api/integration-credentials/${existing.id}/test`,
        { method: "POST" }
      );
      const json = await res.json();
      if (res.ok && json.data?.success) {
        toast.success(t("Connection successful"));
        setExisting((prev) =>
          prev
            ? { ...prev, lastTestStatus: "success", lastTestedAt: new Date().toISOString() }
            : prev
        );
      } else {
        toast.error(json.data?.error || json.error || t("Connection failed"));
        setExisting((prev) =>
          prev ? { ...prev, lastTestStatus: "failed" } : prev
        );
      }
    } catch {
      toast.error(t("Connection test failed"));
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm(t("Are you sure you want to delete this credential? All associated collections and data will be removed."))) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/integration-credentials/${existing.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success(t("Credential deleted"));
        router.push("/technical-evidence/settings");
      } else {
        const json = await res.json();
        toast.error(json.error || t("Failed to delete"));
      }
    } catch {
      toast.error(t("Failed to delete credential"));
    } finally {
      setDeleting(false);
    }
  };

  if (permLoading || loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Configure Credential")}</span>
        </nav>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!canCreate && !canEdit) {
    return <Unauthorized description={t("You don't have permission to manage credentials.")} />;
  }

  if (!platformInfo) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">{t("Unknown platform")}: {platform}</p>
      </div>
    );
  }

  const requiredFields = platformInfo.requiredFields;

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
        <Link href="/technical-evidence/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Credential Vault")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t(platformInfo.label)}</span>
      </nav>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          {t(platformInfo.label)}
        </h1>
        {existing && (
          <div className="flex items-center gap-2">
            {existing.lastTestStatus === "success" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                {t("Connected")}
              </span>
            )}
            {existing.lastTestStatus === "failed" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                <XCircle className="h-3 w-3" />
                {t("Connection Failed")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Credential Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-4 max-w-2xl">
        <div className="space-y-2">
          <Label htmlFor="credName">{t("Credential Name")}</Label>
          <Input
            id="credName"
            value={credName}
            onChange={(e) => setCredName(e.target.value)}
            placeholder={t(platformInfo.label)}
          />
        </div>

        {requiredFields.map((field) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={field}>
              {t(FIELD_LABELS[field] || field)}
              <span className="text-red-500 ltr:ml-0.5 rtl:mr-0.5">*</span>
            </Label>
            {field === "serviceAccountJson" ? (
              <textarea
                id={field}
                className="w-full min-h-[120px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={formValues[field] || ""}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, [field]: e.target.value }))
                }
                placeholder={
                  existing
                    ? t("Leave empty to keep current value")
                    : t("Paste service account JSON here")
                }
              />
            ) : (
              <Input
                id={field}
                type={
                  field.toLowerCase().includes("secret") ||
                  field.toLowerCase().includes("password") ||
                  field.toLowerCase().includes("key") ||
                  field.toLowerCase().includes("token")
                    ? "password"
                    : "text"
                }
                value={formValues[field] || ""}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, [field]: e.target.value }))
                }
                placeholder={
                  existing
                    ? existing.credentials?.[field] || t("Leave empty to keep current value")
                    : ""
                }
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 pt-4 flex-wrap">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5 animate-spin" />}
            {existing ? t("Update Credential") : t("Save Credential")}
          </Button>

          {existing && (
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing && <Loader2 className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5 animate-spin" />}
              {t("Test Connection")}
            </Button>
          )}

          {existing && canDelete && (
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
              )}
              {t("Delete")}
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => router.push("/technical-evidence/settings")}
          >
            {t("Cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
