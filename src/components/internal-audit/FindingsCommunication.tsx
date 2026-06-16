"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Share2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Megaphone,
  Undo2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type ReportingMode = "Continuous" | "Aggregated";

interface Finding {
  id: string;
  findingId: string;
  finding: string;
  severity: string;
  status: string;
  sharedWithAuditeeAt: string | null;
}

interface FindingsResponse {
  reportingMode: ReportingMode;
  findings: Finding[];
}

interface FindingsCommunicationProps {
  engagementId: string;
  canEdit: boolean;
}

export default function FindingsCommunication({
  engagementId,
  canEdit,
}: FindingsCommunicationProps) {
  const { t } = useLanguage();

  const [reportingMode, setReportingMode] =
    useState<ReportingMode>("Continuous");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingMode, setSavingMode] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const formatDate = useCallback((iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  }, []);

  const loadFindings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/findings`
      );
      if (!res.ok) throw new Error("Failed");
      const data: FindingsResponse = await res.json();
      setReportingMode(
        data.reportingMode === "Aggregated" ? "Aggregated" : "Continuous"
      );
      setFindings(Array.isArray(data.findings) ? data.findings : []);
    } catch {
      toast.error(t("Failed to load findings"));
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, [engagementId, t]);

  useEffect(() => {
    void loadFindings();
  }, [loadFindings]);

  const handleModeChange = async (mode: ReportingMode) => {
    if (mode === reportingMode) return;
    const previous = reportingMode;
    setReportingMode(mode);
    setSavingMode(true);
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportingMode: mode }),
        }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Communication mode updated"));
      await loadFindings();
    } catch {
      setReportingMode(previous);
      toast.error(t("Failed to update communication mode"));
    } finally {
      setSavingMode(false);
    }
  };

  const handleShare = async (finding: Finding) => {
    setBusyId(finding.id);
    try {
      const res = await fetch(
        `/api/internal-audit/findings/${finding.id}/share`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Finding shared with auditee"));
      await loadFindings();
    } catch {
      toast.error(t("Failed to share finding"));
    } finally {
      setBusyId(null);
    }
  };

  const handleUnshare = async (finding: Finding) => {
    setBusyId(finding.id);
    try {
      const res = await fetch(
        `/api/internal-audit/findings/${finding.id}/share`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Finding unshared"));
      await loadFindings();
    } catch {
      toast.error(t("Failed to unshare finding"));
    } finally {
      setBusyId(null);
    }
  };

  const severityBadgeClass = (severity: string): string => {
    switch (severity) {
      case "Critical":
      case "High":
        return "bg-red-100 text-red-700";
      case "Medium":
        return "bg-amber-100 text-amber-700";
      case "Low":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const modeHelper =
    reportingMode === "Continuous"
      ? t(
          "Findings are shared with the auditee individually as they are identified."
        )
      : t("Findings are consolidated into the draft detailed report.");

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-slate-500" />
              {t("Findings Communication")}
            </CardTitle>
            <Link href={`/internal-audit/fieldwork/${engagementId}`}>
              <Button size="sm" variant="outline">
                <ExternalLink className="h-4 w-4 mr-1" />
                {t("Open in Fieldwork")}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-2">
            <Label>{t("Communication Mode")}</Label>
            {canEdit ? (
              <Select
                value={reportingMode}
                onValueChange={(v) => handleModeChange(v as ReportingMode)}
                disabled={savingMode}
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Continuous">{t("Continuous")}</SelectItem>
                  <SelectItem value="Aggregated">{t("Aggregated")}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className="bg-slate-100 text-slate-600 w-fit">
                {t(reportingMode)}
              </Badge>
            )}
          </div>
          <Separator />
          <p className="text-slate-500 flex items-center gap-2">
            {savingMode && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            )}
            {modeHelper}
          </p>
        </CardContent>
      </Card>

      {/* Findings list */}
      {findings.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-slate-500">
          <p>{t("No findings recorded yet.")}</p>
          <p className="mt-1 text-xs text-slate-400">
            {t("Add findings in Fieldwork to communicate them here.")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => {
            const shared = !!f.sharedWithAuditeeAt;
            const isBusy = busyId === f.id;
            return (
              <Card key={f.id} className="overflow-hidden">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          {f.findingId}
                        </span>
                        <Badge className={severityBadgeClass(f.severity)}>
                          {t(f.severity)}
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-600">
                          {t(f.status)}
                        </Badge>
                      </div>
                      <p className="font-medium text-slate-700 break-words">
                        {f.finding}
                      </p>
                    </div>

                    {reportingMode === "Continuous" && (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {shared ? (
                          <>
                            <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t("Shared")} · {formatDate(f.sharedWithAuditeeAt)}
                            </Badge>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-slate-500"
                                disabled={isBusy}
                                onClick={() => handleUnshare(f)}
                              >
                                {isBusy ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                                )}
                                {t("Unshare")}
                              </Button>
                            )}
                          </>
                        ) : (
                          canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleShare(f)}
                            >
                              {isBusy ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Share2 className="h-4 w-4 mr-1" />
                              )}
                              {t("Share with auditee")}
                            </Button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
