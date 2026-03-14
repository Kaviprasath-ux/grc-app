"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Home, ChevronRight, Shield, BarChart3, Loader2, Check } from "lucide-react";
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

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Critical:  { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  High:      { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  Moderate:  { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  Low:       { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  Nominal:   { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
  Excellent: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Good:      { bg: "bg-teal-50",   text: "text-teal-700",   dot: "bg-teal-500" },
};

export default function ControlCenterPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dueDiligence, setDueDiligence] = useState<DueDiligenceConfig[]>([]);
  const [scorecard, setScorecard] = useState<ScorecardConfig[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
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
          setSaveStatus("idle");
        } else {
          setSaveStatus("saved");
          statusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
        }
      } catch {
        toast({
          title: t("Error"),
          description: t("Failed to save configuration"),
          variant: "destructive",
        });
        setSaveStatus("idle");
      }
    }, 800);
  }, [toast, t]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const handleDDChange = (
    catIndex: number,
    field: keyof DueDiligenceConfig,
    value: string
  ) => {
    const num = Math.max(0, parseInt(value) || 0);
    const updated = [...dueDiligence];
    updated[catIndex] = { ...updated[catIndex], [field]: num };
    setDueDiligence(updated);
  };

  const handleDDCommit = (
    catIndex: number,
    field: keyof DueDiligenceConfig,
  ) => {
    // VRR validation on commit: Critical(0) >= High(1) >= Moderate(2) >= Low(3) >= Nominal(4)
    if (field === "vrr") {
      const num = dueDiligence[catIndex]?.vrr ?? 0;
      const prev = dueDiligence[catIndex - 1]?.vrr;
      const next = dueDiligence[catIndex + 1]?.vrr;
      if (prev !== undefined && num > prev) {
        toast({ title: t("Validation"), description: t("VRR value cannot exceed the category above"), variant: "destructive" });
        return;
      }
      if (next !== undefined && num < next) {
        toast({ title: t("Validation"), description: t("VRR value cannot be less than the category below"), variant: "destructive" });
        return;
      }
    }
    scheduleAutoSave(dueDiligence, scorecard);
  };

  const handleSCChange = (catIndex: number, value: string) => {
    const updated = [...scorecard];
    updated[catIndex] = { ...updated[catIndex], securityScore: Math.max(0, Math.min(10, parseInt(value) || 0)) };
    setScorecard(updated);
  };

  const handleSCCommit = (catIndex: number) => {
    // Scorecard validation: Excellent(0) >= Good(1) >= Moderate(2) >= Low(3) >= Nominal(4)
    const num = scorecard[catIndex]?.securityScore ?? 0;
    const prev = scorecard[catIndex - 1]?.securityScore;
    const next = scorecard[catIndex + 1]?.securityScore;
    if (prev !== undefined && num > prev) {
      toast({ title: t("Validation"), description: t("Score cannot exceed the category above"), variant: "destructive" });
      return;
    }
    if (next !== undefined && num < next) {
      toast({ title: t("Validation"), description: t("Score cannot be less than the category below"), variant: "destructive" });
      return;
    }
    scheduleAutoSave(dueDiligence, scorecard);
  };

  const getCatStyle = (cat: string) => CATEGORY_COLORS[cat] || { bg: "bg-slate-50", text: "text-slate-700", dot: "bg-slate-500" };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Control Center")}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Control Center")}</h1>
        {/* Auto-save status */}
        {saveStatus !== "idle" && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{t("Saving...")}</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600">{t("Saved")}</span>
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="due-diligence">
          <TabsList className="ltr:justify-start rtl:justify-end">
            <TabsTrigger value="due-diligence" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              {t("Due Diligence")}
            </TabsTrigger>
            <TabsTrigger value="scorecard" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              {t("Scorecard")}
            </TabsTrigger>
          </TabsList>

          {/* Due Diligence Tab */}
          <TabsContent value="due-diligence" className="mt-6">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="ltr:text-left rtl:text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[200px]">
                        {t("Parameter")}
                      </th>
                      {DD_CATEGORIES.map((cat) => {
                        const style = getCatStyle(cat);
                        return (
                          <th key={cat} className="px-3 py-3.5 text-center min-w-[110px]">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${style.bg} ${style.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                              {t(cat)}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {DD_FIELDS.map((field, fi) => (
                      <tr key={field.key} className={`border-b border-slate-100 last:border-0 ${fi % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                        <td className="px-5 py-4 text-sm font-medium text-slate-700">{t(field.label)}</td>
                        {DD_CATEGORIES.map((cat, catIndex) => (
                          <td key={cat} className="px-3 py-3 text-center">
                            <Input
                              type="number"
                              min={0}
                              className="w-[72px] mx-auto text-center h-9 text-sm border-slate-200 focus-visible:ring-primary-500"
                              value={dueDiligence[catIndex]?.[field.key] ?? 0}
                              onChange={(e) =>
                                handleDDChange(catIndex, field.key, e.target.value)
                              }
                              onBlur={() => handleDDCommit(catIndex, field.key)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleDDCommit(catIndex, field.key); }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Scorecard Tab */}
          <TabsContent value="scorecard" className="mt-6">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="ltr:text-left rtl:text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[200px]">
                        {t("Parameter")}
                      </th>
                      {SC_CATEGORIES.map((cat) => {
                        const style = getCatStyle(cat);
                        return (
                          <th key={cat} className="px-3 py-3.5 text-center min-w-[110px]">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${style.bg} ${style.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                              {t(cat)}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-5 py-4 text-sm font-medium text-slate-700">{t("Security Score")}</td>
                      {SC_CATEGORIES.map((cat, catIndex) => (
                        <td key={cat} className="px-3 py-3 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            className="w-[72px] mx-auto text-center h-9 text-sm border-slate-200 focus-visible:ring-primary-500"
                            value={scorecard[catIndex]?.securityScore ?? 0}
                            onChange={(e) =>
                              handleSCChange(catIndex, e.target.value)
                            }
                            onBlur={() => handleSCCommit(catIndex)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSCCommit(catIndex); }}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
