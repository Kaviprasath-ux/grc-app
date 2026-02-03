"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface EscalationConfig {
  id: string;
  responseSubmission: number;
  acknowledgement: number;
  clarification: number;
  issueResolution: number;
}

export default function EscalationConfigPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EscalationConfig | null>(null);
  const [formData, setFormData] = useState({
    responseSubmission: 5,
    acknowledgement: 1,
    clarification: 2,
    issueResolution: 3,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/internal-audit/escalation-config");
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setFormData({
          responseSubmission: data.responseSubmission,
          acknowledgement: data.acknowledgement,
          clarification: data.clarification,
          issueResolution: data.issueResolution,
        });
      }
    } catch (error) {
      console.error("Failed to fetch escalation config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/internal-audit/escalation-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseSubmission: Number(formData.responseSubmission) || 5,
          acknowledgement: Number(formData.acknowledgement) || 1,
          clarification: Number(formData.clarification) || 2,
          issueResolution: Number(formData.issueResolution) || 3,
        }),
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Escalation configuration saved successfully."),
        });
        router.push("/internal-audit/settings");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({
        title: t("Error"),
        description: t("Failed to save escalation configuration."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/internal-audit/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Escalation")}</span>
        </nav>

        <h1 className="text-2xl font-bold text-slate-800">{t("Escalation Configuration")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading configuration...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/internal-audit/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Escalation")}</span>
      </nav>

      {/* Page Header */}
      <h1 className="text-2xl font-bold text-slate-800">{t("Escalation Configuration")}</h1>

      {/* Content Card */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{t("Escalation Timeline Settings")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("Configure the number of days before escalation for each activity type")}</p>
        </div>

        {/* Card Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Response Submission")}</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  type="number"
                  min={1}
                  value={formData.responseSubmission}
                  onChange={(e) => setFormData({ ...formData, responseSubmission: parseInt(e.target.value) || 5 })}
                  className="bg-white w-24"
                />
                <span className="text-sm text-slate-500">{t("days")}</span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Acknowledgement")}</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  type="number"
                  min={1}
                  value={formData.acknowledgement}
                  onChange={(e) => setFormData({ ...formData, acknowledgement: parseInt(e.target.value) || 1 })}
                  className="bg-white w-24"
                />
                <span className="text-sm text-slate-500">{t("days")}</span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Clarification")}</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  type="number"
                  min={1}
                  value={formData.clarification}
                  onChange={(e) => setFormData({ ...formData, clarification: parseInt(e.target.value) || 2 })}
                  className="bg-white w-24"
                />
                <span className="text-sm text-slate-500">{t("days")}</span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Issue Resolution")}</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  type="number"
                  min={1}
                  value={formData.issueResolution}
                  onChange={(e) => setFormData({ ...formData, issueResolution: parseInt(e.target.value) || 3 })}
                  className="bg-white w-24"
                />
                <span className="text-sm text-slate-500">{t("days")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.push("/internal-audit/settings")}>
            {t("Cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("Saving...") : t("Save Changes")}
          </Button>
        </div>
      </div>
    </div>
  );
}
