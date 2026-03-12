"use client";

import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { useSession } from "next-auth/react";
import { Home, ChevronRight, Loader2, Eye, Download, Trash2, ArrowLeft, X } from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx-js-style";

// ── Types (shared with Assessment Factory page) ──
interface AssessmentRow {
  sequenceNumber: number;
  domainName: string;
  question: string;
  response: string;
  comments: string;
  complianceStatus: string;
  verifAISummary: string;
  confidenceScore: number | null;
  verifAIPrompt: string;
  issue: string;
  risk: string;
  recommendation: string;
}

interface AssessmentReport {
  id: string;
  createdAt: string;
  rows: AssessmentRow[];
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("satisfactory") && !s.includes("unsatisfactory")) return "text-green-700";
  if (s.includes("unsatisfactory")) return "text-red-600";
  return "text-slate-700";
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function getSatisfactoryRatio(rows: AssessmentRow[]) {
  const total = rows.length;
  if (!total) return null;
  const sat = rows.filter(r => r.complianceStatus.toLowerCase().includes("satisfactory") && !r.complianceStatus.toLowerCase().includes("unsatisfactory")).length;
  return { sat, total, pct: Math.round((sat / total) * 100) };
}

export default function AsrFactoryReportsPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const isAuditor = useHasRole("TPRMAuditor");
  const storageKey = `assessment-factory-reports-${session?.user?.customerAccountId || session?.user?.id || "default"}`;

  const [reports, setReports] = useState<AssessmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewReport, setViewReport] = useState<AssessmentReport | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // Dynamic data translation (no vendor data on this page, but hook must be called unconditionally)
  useTranslatedData([], { modelName: 'TPRMVendor' });

  // Load from localStorage when session is available
  // Migrate ALL old user-scoped keys to the tenant-scoped key
  useEffect(() => {
    if (!session?.user) return;
    try {
      const prefix = "assessment-factory-reports-";
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && key !== storageKey) {
          const oldData = localStorage.getItem(key);
          if (!oldData) continue;
          const existingData = localStorage.getItem(storageKey);
          if (!existingData) {
            localStorage.setItem(storageKey, oldData);
          } else {
            try {
              const oldParsed = JSON.parse(oldData) as AssessmentReport[];
              const existParsed = JSON.parse(existingData) as AssessmentReport[];
              const ids = new Set(existParsed.map(r => r.id));
              const merged = [...existParsed, ...oldParsed.filter(r => !ids.has(r.id))];
              localStorage.setItem(storageKey, JSON.stringify(merged));
            } catch { /* ignore */ }
          }
          localStorage.removeItem(key);
        }
      }

      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as AssessmentReport[];
        if (Array.isArray(parsed)) setReports(parsed);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [storageKey, session?.user]);

  const deleteReport = useCallback((id: string) => {
    setReports(prev => {
      const updated = prev.filter(r => r.id !== id);
      if (updated.length) {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } else {
        localStorage.removeItem(storageKey);
      }
      return updated;
    });
    if (viewReport?.id === id) setViewReport(null);
  }, [storageKey, viewReport?.id]);

  // Download Excel report
  const downloadReport = useCallback((report: AssessmentReport) => {
    const headers = [
      t("Sequence Number"), t("Domain Name"), t("Questions"), t("Response"), t("Comments"),
      t("Compliance Status"), t("VerifAI Summary"), t("Confidence Score"),
      t("Issue"), t("Risk"), t("Recommendation"),
    ];
    const data = report.rows.map(r => [
      r.sequenceNumber, r.domainName, r.question, r.response, r.comments,
      r.complianceStatus, r.verifAISummary,
      r.confidenceScore != null ? r.confidenceScore : "",
      r.issue, r.risk, r.recommendation,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Auto-fit columns
    const colWidths = headers.map((h, i) => {
      let max = h.length;
      for (const row of data) {
        const val = String(row[i] ?? "");
        max = Math.max(max, ...val.split("\n").map(l => l.length));
      }
      return { wch: Math.min(max + 2, 60) };
    });
    ws["!cols"] = colWidths;

    // Style: bold headers, wrap text
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let C = range.s.c; C <= range.e.c; C++) {
      const headerAddr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[headerAddr]) {
        ws[headerAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: "F0F0F0" } }, alignment: { wrapText: true, vertical: "top" } };
      }
      for (let R = 1; R <= range.e.r; R++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[addr]) {
          ws[addr].s = { alignment: { wrapText: true, vertical: "top" } };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("Assessment Report"));
    const dateStr = new Date(report.createdAt).toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Assessment_Report_${dateStr}.xlsx`);
  }, [t]);

  const filteredRows = viewReport
    ? statusFilter === "all"
      ? viewReport.rows
      : viewReport.rows.filter(r => r.complianceStatus.toLowerCase().includes(statusFilter.toLowerCase()))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Detail view of a single assessment
  if (viewReport) {
    const ratio = getSatisfactoryRatio(viewReport.rows);
    return (
      <div className="space-y-6 p-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Assessment History")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{viewReport.id}</span>
        </nav>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setViewReport(null); setStatusFilter("all"); }}>
              <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Back")}
            </Button>
            <h1 className="text-xl font-bold">{viewReport.id}</h1>
            <span className="text-sm text-muted-foreground">{formatDateTime(viewReport.createdAt)}</span>
            {ratio && (
              <Badge variant="outline" className={ratio.pct >= 70 ? "text-green-700 border-green-300" : "text-red-600 border-red-300"}>
                {ratio.sat}/{ratio.total} ({ratio.pct}%)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Statuses")}</SelectItem>
                <SelectItem value="satisfactory">{t("Satisfactory")}</SelectItem>
                <SelectItem value="unsatisfactory">{t("Unsatisfactory")}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => downloadReport(viewReport)}>
              <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Download Report")}
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{t("Number of Questions")} ({filteredRows.length})</p>

        <div className="space-y-4">
          {filteredRows.map((row) => (
            <div key={row.sequenceNumber} className="grid grid-cols-2 gap-4 border rounded-lg p-4">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("Ingested Questionnaire")}</div>
                <div><span className="font-semibold text-sm">{t("Sequence Number")}</span><br />{row.sequenceNumber}</div>
                <div><span className="font-semibold text-sm">{t("Domain Name")}</span><br />{row.domainName}</div>
                <div><span className="font-semibold text-sm">{t("Question Title")}</span><br />{row.question}</div>
                <div><span className="font-semibold text-sm">{t("Response")}</span><br />{row.response || "-"}</div>
                <div><span className="font-semibold text-sm">{t("Vendor Comments")}</span><br />{row.comments || "-"}</div>
              </div>
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("VerifAI Results")}</div>
                <div>
                  <span className="font-semibold text-sm">{t("VerifAI Summary")}</span><br />
                  <span className={`font-semibold ${statusColor(row.complianceStatus)}`}>{row.complianceStatus}</span>
                  {row.verifAISummary && <p className="mt-1 text-sm">{row.verifAISummary}</p>}
                </div>
                {row.confidenceScore != null && (
                  <div><span className="font-semibold text-sm">{t("Confidence Score")}</span><br />{row.confidenceScore.toFixed(2)}</div>
                )}
                {row.issue && <div><span className="font-semibold text-sm">{t("Issue")}</span><br />{row.issue}</div>}
                {row.risk && <div><span className="font-semibold text-sm">{t("Risk")}</span><br />{row.risk}</div>}
                {row.recommendation && <div><span className="font-semibold text-sm">{t("Recommendation")}</span><br />{row.recommendation}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6 p-6">
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessment History")}</span>
      </nav>

      <h1 className="text-2xl font-bold">{t("Assessment History")}</h1>

      {reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">{t("No assessments yet")}</p>
          <p className="text-sm mt-1">{t("Run an assessment from the Assessment Factory to see results here")}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="ltr:text-left rtl:text-right px-4 py-3 text-sm font-semibold">{t("Assessment")}</th>
                <th className="ltr:text-left rtl:text-right px-4 py-3 text-sm font-semibold">{t("Date")}</th>
                <th className="ltr:text-left rtl:text-right px-4 py-3 text-sm font-semibold">{t("Questions")}</th>
                <th className="ltr:text-left rtl:text-right px-4 py-3 text-sm font-semibold">{t("Compliance")}</th>
                <th className="ltr:text-right rtl:text-left px-4 py-3 text-sm font-semibold">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const ratio = getSatisfactoryRatio(report.rows);
                return (
                  <tr key={report.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{report.id}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateTime(report.createdAt)}</td>
                    <td className="px-4 py-3 text-sm">{report.rows.length}</td>
                    <td className="px-4 py-3 text-sm">
                      {ratio && (
                        <Badge variant="outline" className={ratio.pct >= 70 ? "text-green-700 border-green-300" : "text-red-600 border-red-300"}>
                          {ratio.sat}/{ratio.total} ({ratio.pct}%)
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 ltr:text-right rtl:text-left">
                      <div className="flex items-center ltr:justify-end rtl:justify-start gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewReport(report)} title={t("View")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadReport(report)} title={t("Download")}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {!isAuditor && (
                          <Button variant="ghost" size="sm" onClick={() => deleteReport(report.id)} title={t("Delete")} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
