"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Home, ChevronRight, Sliders } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DueDiligenceConfig {
  category: string;
  vrr: number;
  cadenceMonths: number;
  remediationDays: number;
  reminderDays: number;
  dueDateDays: number;
}

interface ScorecardConfig {
  category: string;
  securityScore: number;
}

const DD_CATEGORIES = ["Critical", "High", "Moderate", "Low", "Nominal"];
const SC_CATEGORIES = ["Excellent", "Good", "Moderate", "Low", "Nominal"];

const DD_FIELDS = [
  { key: "vrr" as const, label: "VRR" },
  { key: "cadenceMonths" as const, label: "Cadence (months)" },
  { key: "remediationDays" as const, label: "Remediation (days)" },
  { key: "reminderDays" as const, label: "Reminder (days)" },
  { key: "dueDateDays" as const, label: "Due Date (days)" },
];

export default function ControlCenterPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dueDiligence, setDueDiligence] = useState<DueDiligenceConfig[]>([]);
  const [scorecard, setScorecard] = useState<ScorecardConfig[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<{ dueDiligence: DueDiligenceConfig[]; scorecard: ScorecardConfig[] } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/tprm/control-center");
      if (res.ok) {
        const json = await res.json();

        const ddData: DueDiligenceConfig[] = DD_CATEGORIES.map((cat) => {
          const found = json.dueDiligence.find(
            (d: { category: string }) => d.category === cat
          );
          return {
            category: cat,
            vrr: found?.vrr ?? 0,
            cadenceMonths: found?.cadenceMonths ?? 0,
            remediationDays: found?.remediationDays ?? 0,
            reminderDays: found?.reminderDays ?? 0,
            dueDateDays: found?.dueDateDays ?? 0,
          };
        });

        const scData: ScorecardConfig[] = SC_CATEGORIES.map((cat) => {
          const found = json.scorecard.find(
            (s: { category: string }) => s.category === cat
          );
          return {
            category: cat,
            securityScore: found?.securityScore ?? 0,
          };
        });

        setDueDiligence(ddData);
        setScorecard(scData);
      }
    } catch (error) {
      console.error("Failed to fetch control center data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback((dd: DueDiligenceConfig[], sc: ScorecardConfig[]) => {
    latestDataRef.current = { dueDiligence: dd, scorecard: sc };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const data = latestDataRef.current;
      if (!data) return;
      try {
        const res = await fetch("/api/tprm/control-center", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json();
          toast({
            title: t("Error"),
            description: err.error || t("Failed to save configuration"),
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: t("Error"),
          description: t("Failed to save configuration"),
          variant: "destructive",
        });
      }
    }, 800);
  }, [toast, t]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleDDChange = (
    catIndex: number,
    field: keyof DueDiligenceConfig,
    value: string
  ) => {
    const updated = [...dueDiligence];
    updated[catIndex] = { ...updated[catIndex], [field]: parseInt(value) || 0 };
    setDueDiligence(updated);
    scheduleAutoSave(updated, scorecard);
  };

  const handleSCChange = (catIndex: number, value: string) => {
    const updated = [...scorecard];
    updated[catIndex] = { ...updated[catIndex], securityScore: parseInt(value) || 0 };
    setScorecard(updated);
    scheduleAutoSave(dueDiligence, updated);
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("TPRM")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Control Center")}</span>
        </nav>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Control Center")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Control Center")}</h1>
        <p className="text-sm text-slate-500">
          {t("Configure due diligence and scorecard thresholds")}
        </p>
      </div>

      {/* Due Diligence Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <Sliders className="h-4 w-4 text-primary" />
            </div>
            {t("DueDiligence Configuration")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="h-11 border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("Category")}
                    </th>
                    {DD_CATEGORIES.map((cat) => (
                      <th
                        key={cat}
                        className="text-center px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[100px]"
                      >
                        {t(cat)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DD_FIELDS.map((field) => (
                    <tr key={field.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-slate-700">{t(field.label)}</td>
                      {DD_CATEGORIES.map((cat, catIndex) => (
                        <td key={cat} className="px-3 py-3 text-center">
                          <Input
                            type="number"
                            min={0}
                            className="w-20 mx-auto text-center"
                            value={dueDiligence[catIndex]?.[field.key] ?? 0}
                            onChange={(e) =>
                              handleDDChange(catIndex, field.key, e.target.value)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scorecard Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <Sliders className="h-4 w-4 text-primary" />
            </div>
            {t("Scorecard Configuration")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="h-11 border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("Category")}
                    </th>
                    {SC_CATEGORIES.map((cat) => (
                      <th
                        key={cat}
                        className="text-center px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[100px]"
                      >
                        {t(cat)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-slate-700">{t("Security Score")}</td>
                    {SC_CATEGORIES.map((cat, catIndex) => (
                      <td key={cat} className="px-3 py-3 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          className="w-20 mx-auto text-center"
                          value={scorecard[catIndex]?.securityScore ?? 0}
                          onChange={(e) =>
                            handleSCChange(catIndex, e.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
