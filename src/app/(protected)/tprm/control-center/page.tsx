"use client";

import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, RotateCcw } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [dueDiligence, setDueDiligence] = useState<DueDiligenceConfig[]>([]);
  const [scorecard, setScorecard] = useState<ScorecardConfig[]>([]);
  const [originalDD, setOriginalDD] = useState<DueDiligenceConfig[]>([]);
  const [originalSC, setOriginalSC] = useState<ScorecardConfig[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/tprm/control-center");
      if (res.ok) {
        const json = await res.json();

        // Map API response to local state
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
        setOriginalDD(JSON.parse(JSON.stringify(ddData)));
        setOriginalSC(JSON.parse(JSON.stringify(scData)));
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

  const handleDDChange = (
    catIndex: number,
    field: keyof DueDiligenceConfig,
    value: string
  ) => {
    const updated = [...dueDiligence];
    updated[catIndex] = { ...updated[catIndex], [field]: parseInt(value) || 0 };
    setDueDiligence(updated);
  };

  const handleSCChange = (catIndex: number, value: string) => {
    const updated = [...scorecard];
    updated[catIndex].securityScore = parseInt(value) || 0;
    setScorecard(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/tprm/control-center", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDiligence, scorecard }),
      });

      if (res.ok) {
        toast({
          title: t("Configuration saved"),
          description: t("Control center settings have been updated successfully."),
        });
        setOriginalDD(JSON.parse(JSON.stringify(dueDiligence)));
        setOriginalSC(JSON.parse(JSON.stringify(scorecard)));
      } else {
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
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDueDiligence(JSON.parse(JSON.stringify(originalDD)));
    setScorecard(JSON.parse(JSON.stringify(originalSC)));
  };

  const hasChanges =
    JSON.stringify(dueDiligence) !== JSON.stringify(originalDD) ||
    JSON.stringify(scorecard) !== JSON.stringify(originalSC);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("Control Center")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("Configure due diligence and scorecard thresholds")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Reset")}
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
            ) : (
              <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            )}
            {t("Save")}
          </Button>
        </div>
      </div>

      {/* Due Diligence Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t("DueDiligence Configuration")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    {t("Category")}
                  </th>
                  {DD_CATEGORIES.map((cat) => (
                    <th
                      key={cat}
                      className="text-center p-3 font-medium text-muted-foreground min-w-[100px]"
                    >
                      {t(cat)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DD_FIELDS.map((field) => (
                  <tr key={field.key} className="border-b">
                    <td className="p-3 font-medium">{t(field.label)}</td>
                    {DD_CATEGORIES.map((cat, catIndex) => (
                      <td key={cat} className="p-3 text-center">
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
        </CardContent>
      </Card>

      {/* Scorecard Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Scorecard Configuration")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    {t("Category")}
                  </th>
                  {SC_CATEGORIES.map((cat) => (
                    <th
                      key={cat}
                      className="text-center p-3 font-medium text-muted-foreground min-w-[100px]"
                    >
                      {t(cat)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3 font-medium">{t("Security Score")}</td>
                  {SC_CATEGORIES.map((cat, catIndex) => (
                    <td key={cat} className="p-3 text-center">
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
        </CardContent>
      </Card>
    </div>
  );
}
