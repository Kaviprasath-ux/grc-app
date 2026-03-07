"use client";

import { useState, useRef, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Home, ChevronRight, Download, Upload, Paperclip, FileBarChart, Check, ArrowRight, ArrowLeft, X, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────
function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("satisfactory") && !s.includes("unsatisfactory")) return "text-green-700";
  if (s.includes("unsatisfactory")) return "text-red-600";
  return "text-slate-700";
}

function parseXlsRows(file: File): Promise<AssessmentRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        const rows: AssessmentRow[] = json.map((r, i) => ({
          sequenceNumber: (r["Sequence Number"] as number) || i + 1,
          domainName: (r["Domain Name"] as string) || "",
          question: (r["Questions"] as string) || "",
          response: (r["Response"] as string) || "",
          comments: (r["Comments"] as string) || "",
          complianceStatus: (r["Compliance Status"] as string) || "",
          verifAISummary: (r["VerifAI Summary"] as string) || "",
          confidenceScore: r["Confidence Score"] != null ? Number(r["Confidence Score"]) : null,
          verifAIPrompt: (r["VerifAI Prompt"] as string) || "",
          issue: (r["Issue"] as string) || "",
          risk: (r["Risk"] as string) || "",
          recommendation: (r["Recommendation"] as string) || "",
        }));
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ==================== MAIN PAGE ====================

export default function AsrAssessmentFactoryPage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [artifactFiles, setArtifactFiles] = useState<File[]>([]);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const artifactInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Report state
  const [reports, setReports] = useState<AssessmentReport[]>([]);
  const [activeReport, setActiveReport] = useState<AssessmentReport | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const openImportDialog = () => {
    setImportStep(1);
    setTemplateFile(null);
    setArtifactFiles([]);
    setImportOpen(true);
  };

  const handleArtifactDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) setArtifactFiles(prev => [...prev, ...files]);
  }, []);

  const removeArtifact = (index: number) => {
    setArtifactFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateReport = async () => {
    if (!templateFile) return;
    setGenerating(true);
    try {
      const rows = await parseXlsRows(templateFile);
      if (!rows.length) {
        toast({ title: t("Error"), description: t("No data found in the uploaded file"), variant: "destructive" });
        return;
      }
      const report: AssessmentReport = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        rows,
      };
      setReports(prev => [report, ...prev]);
      setActiveReport(report);
      setImportOpen(false);
      toast({ title: t("Success"), description: `${rows.length} ${t("questions processed")}` });
    } catch {
      toast({ title: t("Error"), description: t("Failed to parse the uploaded file"), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    if (!activeReport) return;
    const wsData = activeReport.rows.map(r => ({
      "Sequence Number": r.sequenceNumber,
      "Domain Name": r.domainName,
      "Questions": r.question,
      "Response": r.response,
      "Comments": r.comments,
      "Compliance Status": r.complianceStatus,
      "VerifAI Summary": r.verifAISummary,
      "Confidence Score": r.confidenceScore,
      "VerifAI Prompt": r.verifAIPrompt,
      "Issue": r.issue,
      "Risk": r.risk,
      "Recommendation": r.recommendation,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Assessment Factory Report");
    XLSX.writeFile(wb, "Assessment_Factory_Report.xlsx");
  };

  const filteredRows = activeReport?.rows.filter(r => {
    if (statusFilter === "all") return true;
    return r.complianceStatus.toLowerCase().includes(statusFilter.toLowerCase());
  }) || [];

  const uniqueStatuses = activeReport
    ? [...new Set(activeReport.rows.map(r => r.complianceStatus).filter(Boolean))]
    : [];

  // ── Report Results View ──────────────────────────
  if (activeReport) {
    return (
      <div className="space-y-4 p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setActiveReport(null)}>
            <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Back")}
          </Button>
          <div className="flex items-center gap-2">
            {reports.length > 1 && (
              <Select
                value={activeReport.id}
                onValueChange={(id) => {
                  const r = reports.find(rep => rep.id === id);
                  if (r) setActiveReport(r);
                }}
              >
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reports.map((r, i) => (
                    <SelectItem key={r.id} value={r.id}>
                      {t("Assessment")} {reports.length - i} — {new Date(r.createdAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <a href="/templates/Assessment_Factory_Template.xlsx" download="Assessment_Factory_Template.xlsx">
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" /> {t("Download Template")}
              </Button>
            </a>
            <Button variant="outline" size="sm" onClick={openImportDialog}>
              <Upload className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" /> {t("Ingest Questionnaire")}
            </Button>
            <Button size="sm" onClick={handleDownloadReport}>
              <FileDown className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" /> {t("Download Report")}
            </Button>
          </div>
        </div>

        {/* Question count */}
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">
            {t("Number of Questions")} ({activeReport.rows.length})
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("Filter")}</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Clear Filter")}</SelectItem>
                {uniqueStatuses.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results cards */}
        <div className="space-y-4">
          {filteredRows.map((row) => (
            <div key={row.sequenceNumber} className="border rounded-lg bg-indigo-50/40 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
                {/* Left: Ingested Questionnaire */}
                <div className="p-5 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("Ingested Questionnaire")}</p>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{t("Sequence Number")}</p>
                    <p className="text-sm">{row.sequenceNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{t("Domain Name")}</p>
                    <p className="text-sm">{row.domainName || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{t("Question Title")}</p>
                    <p className="text-sm">{row.question || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{t("Response")}</p>
                    <p className="text-sm">{row.response || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{t("Vendor Comments")}</p>
                    <p className="text-sm">{row.comments || "\u2014"}</p>
                  </div>
                </div>

                {/* Right: VerifAI Results */}
                <div className="p-5 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("VerifAI Results")}</p>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{t("VerifAI Summary")}</p>
                    {row.complianceStatus && (
                      <p className={`text-sm font-bold ${statusColor(row.complianceStatus)}`}>{row.complianceStatus}</p>
                    )}
                    <p className="text-sm mt-1">{row.verifAISummary || "\u2014"}</p>
                  </div>
                  {row.confidenceScore != null && (
                    <div>
                      <p className="text-xs font-bold text-slate-700">{t("Confidence Score")}</p>
                      <p className="text-sm">{row.confidenceScore.toFixed(2)}</p>
                    </div>
                  )}
                  {row.issue && (
                    <div>
                      <p className="text-xs font-bold text-slate-700">{t("Issue")}</p>
                      <p className="text-sm">{row.issue}</p>
                    </div>
                  )}
                  {row.risk && (
                    <div>
                      <p className="text-xs font-bold text-slate-700">{t("Risk")}</p>
                      <p className="text-sm">{row.risk}</p>
                    </div>
                  )}
                  {row.recommendation && (
                    <div>
                      <p className="text-xs font-bold text-slate-700">{t("Recommendation")}</p>
                      <p className="text-sm">{row.recommendation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredRows.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg bg-white">
              {t("No results match the selected filter.")}
            </div>
          )}
        </div>

        {/* Import dialog (also available from report view) */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="!max-w-lg">
            <DialogHeader>
              <DialogTitle>{importStep === 1 ? t("Import Template") : t("Upload Artifacts")}</DialogTitle>
            </DialogHeader>
            {renderStepper()}
            {renderStepContent()}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Stepper renderer ─────────────────────────────
  function renderStepper() {
    return (
      <div className="flex items-center justify-between px-4 pt-2">
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
            importStep > 1 ? "bg-slate-900 text-white" : importStep === 1 ? "bg-slate-900 text-white" : "border-2 border-slate-300 text-slate-400"
          }`}>
            {importStep > 1 ? <Check className="h-5 w-5" /> : "1"}
          </div>
          <span className={`text-xs font-medium ${importStep >= 1 ? "text-primary" : "text-muted-foreground"}`}>
            {t("Upload File")}
          </span>
        </div>
        <div className="flex-1 h-0.5 bg-slate-200 mx-4 mt-[-20px]" />
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
            importStep === 2 ? "bg-slate-900 text-white" : "border-2 border-slate-300 text-slate-400"
          }`}>
            2
          </div>
          <span className={`text-xs font-medium ${importStep === 2 ? "text-primary" : "text-muted-foreground"}`}>
            {t("Upload Artifacts")}
          </span>
        </div>
      </div>
    );
  }

  // ── Step content renderer ────────────────────────
  function renderStepContent() {
    if (importStep === 1) {
      return (
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            * {t("Upload your spreadsheet with the populated questionnaire.")}
          </p>
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0">{t("File")}</Label>
            <Input
              readOnly
              value={templateFile?.name || "..."}
              className="flex-1 bg-muted/30 cursor-pointer"
              onClick={() => templateInputRef.current?.click()}
            />
            <Button variant="outline" size="sm" onClick={() => templateInputRef.current?.click()}>
              {t("Browse...")}
            </Button>
            <input
              ref={templateInputRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setTemplateFile(file);
              }}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setImportStep(2)} disabled={!templateFile}>
              <ArrowRight className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Next")}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          * {t("Upload all the respective artifacts as valid file types i.e., word, image, pdf.")}
        </p>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-slate-300 hover:border-slate-400"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleArtifactDrop}
          onClick={() => artifactInputRef.current?.click()}
        >
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t("Upload Artifacts")}</p>
        </div>
        <input
          ref={artifactInputRef}
          type="file"
          multiple
          accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.gif,.bmp"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) setArtifactFiles(prev => [...prev, ...files]);
            e.target.value = "";
          }}
        />
        {artifactFiles.length > 0 && (
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {artifactFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-1.5">
                <span className="truncate">{f.name}</span>
                <button onClick={() => removeArtifact(i)} className="text-muted-foreground hover:text-destructive ml-2">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setImportStep(1)}>
            <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Previous")}
          </Button>
          <Button onClick={handleGenerateReport} disabled={generating}>
            {generating && <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" />}
            {t("Generate Report")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Default View (workflow steps) ────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessment Factory")}</span>
      </nav>

      <h1 className="text-2xl font-bold text-center">{t("Assessment Factory")}</h1>

      {/* Previous assessments link */}
      {reports.length > 0 && (
        <div className="flex justify-end">
          <Button variant="link" size="sm" onClick={() => setActiveReport(reports[0])}>
            {t("Previous assessments")} ({reports.length})
          </Button>
        </div>
      )}

      {/* 4-step workflow */}
      <div className="flex flex-wrap items-start justify-center gap-4 mt-8">
        {/* Step 1: Download Template */}
        <a href="/templates/Assessment_Factory_Template.xlsx" download="Assessment_Factory_Template.xlsx" className="flex flex-col items-center text-center max-w-[200px] group cursor-pointer hover:opacity-80 transition-opacity no-underline">
          <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center mb-3 group-hover:bg-primary/5">
            <Download className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{t("Download Template")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("Download the template and fill it up with your own questionnaire.")}
          </p>
        </a>

        <div className="hidden md:flex items-center pt-8">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Step 2: Upload Template */}
        <button onClick={openImportDialog} className="flex flex-col items-center text-center max-w-[200px] group cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center mb-3 group-hover:bg-primary/5">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{t("Upload the Completed Template")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("Once the template is populated, upload the spreadsheet by clicking here.")}
          </p>
        </button>

        <div className="hidden md:flex items-center pt-8">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Step 3: Attach Artifacts */}
        <div className="flex flex-col items-center text-center max-w-[200px]">
          <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-3">
            <Paperclip className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-sm">{t("Attach Supporting Artifacts")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("Attach the necessary artifacts, which may include word documents, PDF's or image files.")}
          </p>
        </div>

        <div className="hidden md:flex items-center pt-8">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Step 4: Generate Report */}
        <div className="flex flex-col items-center text-center max-w-[200px]">
          <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-3">
            <FileBarChart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-sm">{t("Generate Report")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("The results will be displayed on the overview page and downloaded as a spreadsheet.")}
          </p>
        </div>
      </div>

      {/* Import Template Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="!max-w-lg">
          <DialogHeader>
            <DialogTitle>{importStep === 1 ? t("Import Template") : t("Upload Artifacts")}</DialogTitle>
          </DialogHeader>
          {renderStepper()}
          {renderStepContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
