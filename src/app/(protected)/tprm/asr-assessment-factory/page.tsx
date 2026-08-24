"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Home, ChevronRight, Download, Upload, Paperclip, FileBarChart, Check, ArrowRight, ArrowLeft, X, FileDown, Loader2, History, Trash2 } from "lucide-react";
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
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx-js-style";

import { FileInput } from "@/components/shared/file-input";
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
  // Optional because reports saved to localStorage before severity was
  // captured have no such key — every read must tolerate undefined.
  severity?: string;
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

// Normalise the backend's severity ("HIGH", "high", "High") to Title case,
// matching what applyAIResult() in src/lib/tprm-ai-evaluation.ts stores.
function normalizeSeverity(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

function severityColor(severity: string) {
  const s = severity.toLowerCase();
  if (s === "high") return "text-red-600";
  if (s === "medium") return "text-amber-600";
  if (s === "low") return "text-green-700";
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
          // Template-provided severity. Used as the fallback when the AI
          // returns a finding but no severity of its own.
          severity: normalizeSeverity(r["Severity"]),
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
  const { data: session } = useSession();
  const storageKey = `assessment-factory-reports-${session?.user?.customerAccountId || session?.user?.id || "default"}`;
  const isFactoryRole = session?.user?.roles?.some((r: string) => r === "FactoryAdmin" || r === "FactoryAssessor");
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
  const [jobStatus, setJobStatus] = useState("");
  // AbortController for the entire generation run — lets users
  // cancel mid-run instead of waiting for the 10-min ingest timeout.
  const abortRef = useRef<AbortController | null>(null);

  // Report state
  const [reports, setReports] = useState<AssessmentReport[]>([]);
  const [activeReport, setActiveReport] = useState<AssessmentReport | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Load saved reports from localStorage when session is available
  // Migrate ALL old user-scoped keys to the tenant-scoped key
  useEffect(() => {
    if (!session?.user) return;
    try {
      // Find and merge all old user-scoped keys into the tenant key
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
        if (Array.isArray(parsed) && parsed.length) setReports(parsed);
      }
    } catch { /* ignore */ }
  }, [storageKey, session?.user]);

  // Persist reports to localStorage whenever they change
  useEffect(() => {
    if (!session?.user) return;
    if (reports.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(reports));
    }
  }, [reports, storageKey, session?.user]);

  const deleteReport = (id: string) => {
    setReports(prev => {
      const updated = prev.filter(r => r.id !== id);
      if (!updated.length) localStorage.removeItem(storageKey);
      return updated;
    });
    if (activeReport?.id === id) setActiveReport(null);
  };

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

    // Artifacts are mandatory — the AI needs supporting evidence to
    // verify each questionnaire answer against. Without them the report
    // would be generated with no basis, so block generation here.
    if (artifactFiles.length === 0) {
      toast({
        title: t("Artifacts required"),
        description: t("Please upload at least one supporting artifact before generating the report."),
        variant: "destructive",
      });
      return;
    }

    // Pre-flight size check. The DO App Platform / proxy / Python
    // ingest backend collectively choke on very large multipart
    // bundles — beyond a certain point the polling spins forever
    // and the user just sees the dialog hang. Cap at 25 MB total,
    // which comfortably handles a template + several PDFs while
    // staying inside typical reverse-proxy limits.
    const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
    const totalBytes = (templateFile.size || 0) + artifactFiles.reduce((s, f) => s + (f.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      toast({
        title: t("Files too large"),
        description: `${t("The combined upload is")} ${(totalBytes / 1024 / 1024).toFixed(1)} MB. ${t("Please keep the template + artifacts under 25 MB total, or split into multiple runs.")}`,
        variant: "destructive",
      });
      return;
    }

    // Zero-byte files confuse the Python ingest backend (it 500s
    // mid-pipeline with no useful error). Catch the template and every
    // artifact upfront.
    if ((templateFile.size || 0) === 0) {
      toast({
        title: t("Empty file"),
        description: `"${templateFile.name}" ${t("is empty (0 bytes). Please re-attach or remove it.")}`,
        variant: "destructive",
      });
      return;
    }
    const emptyArtifact = artifactFiles.find((f) => (f.size || 0) === 0);
    if (emptyArtifact) {
      toast({
        title: t("Empty file"),
        description: `"${emptyArtifact.name}" ${t("is empty (0 bytes). Please re-attach or remove it.")}`,
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setJobStatus(t("Parsing template..."));

    // Fresh AbortController for this run; aborted by handleCancel or
    // by unmount. Every fetch inside the run passes its signal so a
    // cancel doesn't leave orphaned in-flight requests.
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    // Cancellable sleep — resolves on timeout OR rejects on abort.
    // Prevents cancel from having to wait up to 5s for the next
    // poll tick.
    const sleep = (ms: number) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      const onAbort = () => { clearTimeout(timer); reject(new DOMException("aborted", "AbortError")); };
      if (signal.aborted) { clearTimeout(timer); return reject(new DOMException("aborted", "AbortError")); }
      signal.addEventListener("abort", onAbort, { once: true });
    });

    try {
      // Step 1: Parse the template locally to get question rows
      const parsedRows = await parseXlsRows(templateFile);
      console.log("[Assessment Factory] Parsed rows:", parsedRows.length, "First row:", parsedRows[0]);
      if (!parsedRows.length) {
        toast({ title: t("Error"), description: t("No data found in the uploaded file"), variant: "destructive" });
        return;
      }

      // Step 2: Ingest files into AI backend
      setJobStatus(t("Uploading files to AI..."));
      const assessmentId = crypto.randomUUID();
      const formData = new FormData();
      formData.append("assessment_id", assessmentId);
      formData.append("files", templateFile);
      for (const af of artifactFiles) {
        formData.append("files", af);
      }

      const ingestRes = await fetch("/api/tprm/assessment-factory", { method: "POST", body: formData, signal });
      const ingestData = await ingestRes.json();
      if (!ingestRes.ok) {
        throw new Error(ingestData.error || "Failed to ingest files");
      }
      console.log("[Assessment Factory] Ingest response:", ingestData);

      // Step 3: Wait for ingestion to complete (poll status)
      const jobId = ingestData.job_id || ingestData.id || ingestData.jobId;
      if (jobId) {
        setJobStatus(t("Waiting for AI to process documents..."));
        let ingested = false;
        for (let attempt = 0; attempt < 120; attempt++) {
          await sleep(5000);
          try {
            const statusRes = await fetch(`/api/tprm/assessment-factory/status/${encodeURIComponent(jobId)}`, { signal });
            const statusData = await statusRes.json();
            console.log(`[Assessment Factory] Status poll #${attempt + 1}:`, statusData);
            const status = (statusData.status || "").toString().toUpperCase();
            if (status === "COMPLETED" || status === "DONE" || status === "SUCCESS" || status === "READY") {
              ingested = true;
              break;
            }
            if (status === "FAILED" || status === "ERROR") {
              throw new Error(statusData.error || statusData.message || "Document ingestion failed");
            }
            setJobStatus(`${t("Waiting for AI to process documents...")} (${(attempt + 1) * 5}s)`);
          } catch (pollErr) {
            // Propagate a genuine abort so the outer catch handles
            // it as a cancel; also propagate confirmed FAILED/ERROR
            // errors from the branch above. Everything else is a
            // transient network hiccup — log and keep polling.
            if (pollErr instanceof Error && pollErr.name === "AbortError") throw pollErr;
            if (pollErr instanceof Error && (pollErr.message.includes("failed") || pollErr.message.includes("Failed"))) throw pollErr;
            console.warn("[Assessment Factory] Status poll error:", pollErr);
          }
        }
        if (!ingested) {
          throw new Error("Document ingestion timed out");
        }

        // Verify the ingest result to check if files were actually processed
        try {
          const resultRes = await fetch(`/api/tprm/assessment-factory/result/${encodeURIComponent(jobId)}`, { signal });
          const resultData = await resultRes.json();
          console.log("[Assessment Factory] Ingest result:", resultData);
          if (resultData.result?.messages) {
            resultData.result.messages.forEach((msg: string) => console.log("[Assessment Factory]", msg));
          }
        } catch { /* non-critical */ }
        console.log("[Assessment Factory] Documents ingested successfully");
      } else {
        // No job_id returned — give the backend some time to index
        setJobStatus(t("Waiting for AI to index documents..."));
        await sleep(10000);
      }

      // Step 4: Query each question against the AI.
      //
      // Prior implementation ran queries strictly sequentially with
      // `await` inside a for-loop. For a 20-question template, each
      // ~5-15s query added up to 3-5 minutes wall-clock in the best
      // case, and a single hung query stalled every remaining
      // question. We now:
      //   - fan out with a concurrency cap (5 at a time) so the AI
      //     backend isn't hammered but wall-clock drops ~5x.
      //   - impose a per-query timeout via AbortController so a hung
      //     backend can't wedge the whole report.
      //   - retry once on a timeout / network error before giving up.
      //   - track success/failure and surface it in the completion
      //     toast instead of misleadingly reporting "N questions
      //     processed" when most were actually empty.
      const questionsWithContent = parsedRows.filter(r => r.question?.trim());
      const CONCURRENCY = 5;
      const QUERY_TIMEOUT_MS = 90_000;
      let completedCount = 0;
      let successCount = 0;

      const queryOne = async (row: AssessmentRow, attempt = 0): Promise<AssessmentRow> => {
        // Per-query controller: aborts on timeout OR when the outer
        // run-cancel fires. This way clicking Cancel while queries
        // are in-flight actually kills the in-flight requests instead
        // of letting them race to completion first.
        const perQuery = new AbortController();
        const timer = setTimeout(() => perQuery.abort(), QUERY_TIMEOUT_MS);
        const outerCancel = () => perQuery.abort();
        signal.addEventListener("abort", outerCancel, { once: true });
        try {
          const queryRes = await fetch("/api/tprm/assessment-factory/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: row.question, assessment_id: assessmentId }),
            signal: perQuery.signal,
          });
          clearTimeout(timer);
          signal.removeEventListener("abort", outerCancel);
          if (!queryRes.ok) {
            console.warn(`[Assessment Factory] Query failed for #${row.sequenceNumber}:`, await queryRes.text());
            return { ...row, complianceStatus: "", verifAISummary: "", confidenceScore: null };
          }
          const ai = await queryRes.json();
          // Field extraction mirrors applyAIResult() in
          // src/lib/tprm-ai-evaluation.ts — both paths hit the same
          // /api/query backend, so they must read the same shape. This
          // previously read only `ai.answer` and ignored `ai.severity`
          // entirely, which is why the report showed a blank AI summary
          // and no severity at all.
          const irr = (ai.issue_risk_recommendation && typeof ai.issue_risk_recommendation === "object")
            ? ai.issue_risk_recommendation
            : {};
          const status = ai.status ? String(ai.status).charAt(0).toUpperCase() + String(ai.status).slice(1) : "";
          // Fall back to the template's severity when the AI flags a
          // finding without grading it, same as the assessment path does.
          const aiSeverity = normalizeSeverity(ai.severity);
          const severity = aiSeverity
            || (status.toLowerCase() === "unsatisfactory" ? (row.severity || "") : "");
          successCount++;
          return {
            sequenceNumber: row.sequenceNumber,
            domainName: row.domainName,
            question: ai.question || row.question,
            response: row.response,
            comments: row.comments,
            complianceStatus: status,
            verifAISummary: ai.answer || ai.response || "",
            confidenceScore: ai.score != null ? Number(ai.score) * 100 : null,
            verifAIPrompt: row.verifAIPrompt,
            issue: irr.issue || ai.issue || "",
            risk: irr.risk || ai.risk || "",
            recommendation: irr.recommendation || ai.recommendation || "",
            severity,
          };
        } catch (qErr) {
          clearTimeout(timer);
          signal.removeEventListener("abort", outerCancel);
          const isAbort = qErr instanceof Error && qErr.name === "AbortError";
          // Outer run-cancel: propagate so the whole run unwinds.
          if (isAbort && signal.aborted) throw qErr;
          if (attempt === 0) {
            console.warn(`[Assessment Factory] Retrying #${row.sequenceNumber} after ${isAbort ? "timeout" : "error"}`);
            return queryOne(row, 1);
          }
          console.warn(`[Assessment Factory] Query error for #${row.sequenceNumber} after retry:`, qErr);
          return { ...row, complianceStatus: "", verifAISummary: "", confidenceScore: null };
        }
      };

      // Run in fixed-size waves; simpler than a proper pool and enough
      // for the numbers we see here (typically 20-60 questions).
      const rows: AssessmentRow[] = [];
      for (let i = 0; i < questionsWithContent.length; i += CONCURRENCY) {
        const batch = questionsWithContent.slice(i, i + CONCURRENCY);
        setJobStatus(`${t("Processing question")} ${Math.min(i + CONCURRENCY, questionsWithContent.length)}/${questionsWithContent.length}...`);
        const batchResults = await Promise.all(batch.map((row) => queryOne(row)));
        rows.push(...batchResults);
        completedCount += batchResults.length;
        setJobStatus(`${t("Processing question")} ${completedCount}/${questionsWithContent.length}...`);
      }

      // Add back any rows without questions (headers/empty rows)
      const emptyRows = parsedRows.filter(r => !r.question?.trim());
      const allRows = [...rows, ...emptyRows].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      // Generate sequential ID like AS-0001
      const nextNum = reports.reduce((max, r) => {
        const m = r.id.match(/^AS-(\d+)$/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0) + 1;
      const reportId = `AS-${String(nextNum).padStart(4, "0")}`;

      const report: AssessmentReport = {
        id: reportId,
        createdAt: new Date().toISOString(),
        rows: allRows,
      };
      setReports(prev => [report, ...prev]);
      setActiveReport(report);
      setImportOpen(false);
      // Honest completion toast: report only genuine AI answers, not
      // rows that were added with empty data after a failed query.
      // Otherwise a run where the AI backend was down still said
      // "20 questions processed" while every row was blank.
      if (successCount === questionsWithContent.length) {
        toast({ title: t("Success"), description: `${successCount} ${t("questions processed")}` });
      } else if (successCount === 0) {
        toast({
          title: t("Report generated with no AI results"),
          description: t("The AI backend didn't return any answers. Check ingest diagnostics or retry with fewer / smaller artifacts."),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("Report generated with partial results"),
          description: `${successCount} ${t("of")} ${questionsWithContent.length} ${t("questions returned AI answers; the remainder failed and were left blank.")}`,
        });
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort) {
        // User-initiated cancel via the Cancel button. Not a real
        // error — just close the run quietly with a neutral toast.
        console.log("[Assessment Factory] Run cancelled by user");
        toast({ title: t("Cancelled"), description: t("Report generation was cancelled.") });
      } else {
        console.error("[Assessment Factory] Error:", err);
        toast({ title: t("Error"), description: err instanceof Error ? err.message : t("Failed to generate report"), variant: "destructive" });
      }
    } finally {
      setGenerating(false);
      setJobStatus("");
      abortRef.current = null;
    }
  };

  // Cancel button handler — aborts the current run's controller.
  // Every fetch and every sleep inside handleGenerateReport takes the
  // controller's signal, so this unwinds cleanly without waiting for
  // the next 5s poll tick.
  const handleCancelGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleDownloadReport = () => {
    if (!activeReport) return;
    const wsData = activeReport.rows.map(r => ({
      "Sequence Number": r.sequenceNumber,
      "Domain Name": r.domainName,
      "Questions": r.question,
      "Comments": r.comments,
      "Compliance Status": r.complianceStatus
        ? r.complianceStatus.charAt(0).toUpperCase() + r.complianceStatus.slice(1)
        : "",
      "VerifAI Summary": r.verifAISummary,
      "Confidence Score": r.confidenceScore,
      "VerifAI Prompt": r.verifAIPrompt,
      "Issue": r.issue,
      "Risk": r.risk,
      "Severity": r.severity || "",
      "Recommendation": r.recommendation,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsData);

    // Auto-fit column widths
    const colKeys = Object.keys(wsData[0] || {});
    ws["!cols"] = colKeys.map((key) => {
      let maxLen = key.length;
      for (const row of wsData) {
        const val = String((row as Record<string, unknown>)[key] ?? "");
        maxLen = Math.max(maxLen, val.length);
      }
      return { wch: Math.min(maxLen + 2, 60) };
    });

    // Style all cells: wrap text + vertical top, bold headers
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        ws[addr].s = {
          alignment: { wrapText: true, vertical: "top" },
          ...(r === 0 ? { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } } : {}),
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Assessment Factory Report");
    XLSX.writeFile(wb, "Assessment_Factory_Report.xlsx");
  };

  const filteredRows = activeReport?.rows.filter(r => {
    if (statusFilter === "all") return true;
    // Strict equality (case-insensitive). Was using .includes(), which
    // matched "Unsatisfactory" when the filter was "Satisfactory"
    // because "unsatisfactory" contains "satisfactory" as a substring.
    return (r.complianceStatus || "").trim().toLowerCase() === statusFilter.trim().toLowerCase();
  }) || [];

  // Dedupe statuses case-insensitively after trim, so backend
  // inconsistencies like "Satisfactory" vs "satisfactory " don't show
  // up as two separate filter options. Display value is the first
  // canonical-cased seen.
  const uniqueStatuses = activeReport
    ? Array.from(
        activeReport.rows.reduce((acc, r) => {
          const raw = (r.complianceStatus || '').trim();
          if (!raw) return acc;
          const key = raw.toLowerCase();
          if (!acc.has(key)) acc.set(key, raw);
          return acc;
        }, new Map<string, string>()).values()
      )
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
                  <SelectItem key={s} value={s}>{t(s)}</SelectItem>
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
                      <p className={`text-sm font-bold ${statusColor(row.complianceStatus)}`}>{t(row.complianceStatus)}</p>
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
                  {row.severity && (
                    <div>
                      <p className="text-xs font-bold text-slate-700">{t("Severity")}</p>
                      <p className={`text-sm font-semibold ${severityColor(row.severity)}`}>{t(row.severity)}</p>
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
        <Dialog open={importOpen} onOpenChange={(open) => { if (generating && !open) return; setImportOpen(open); }}>
          <DialogContent className="!max-w-lg" showCloseButton={!generating} onPointerDownOutside={(e) => { if (generating) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (generating) e.preventDefault(); }}>
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
            <FileInput
              ref={templateInputRef}
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
        <FileInput
          ref={artifactInputRef}
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
                <button onClick={() => removeArtifact(i)} className="text-muted-foreground hover:text-destructive ltr:ml-2 rtl:mr-2">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setImportStep(1)} disabled={generating}>
            <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Previous")}
          </Button>
          <div className="flex items-center gap-2">
            {generating && (
              <Button variant="outline" onClick={handleCancelGeneration}>
                <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Cancel")}
              </Button>
            )}
            <Button onClick={handleGenerateReport} disabled={generating}>
              {generating && <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" />}
              {generating && jobStatus ? jobStatus : t("Generate Report")}
            </Button>
          </div>
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

      <div className="flex items-center justify-between">
        <div />
        <h1 className="text-2xl font-bold">{t("Assessment Factory")}</h1>
        {!isFactoryRole && (
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} disabled={!reports.length}>
            <History className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
            {t("Previous Assessments")} {reports.length > 0 && `(${reports.length})`}
          </Button>
        )}
        {isFactoryRole && <div />}
      </div>

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

      {/* Previous Assessments Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="!max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Previous Assessments")}</DialogTitle>
          </DialogHeader>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("No previous assessments found.")}</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {reports.map((r, i) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => { setActiveReport(r); setHistoryOpen(false); }}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {t("Assessment")} {reports.length - i}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString()} — {r.rows.length} {t("questions")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {r.rows.filter(row => row.complianceStatus?.toLowerCase().includes("satisfactory") && !row.complianceStatus?.toLowerCase().includes("unsatisfactory")).length}/{r.rows.length} {t("Satisfactory")}
                    </Badge>
                    <button
                      className="text-muted-foreground hover:text-destructive p-1"
                      onClick={(e) => { e.stopPropagation(); deleteReport(r.id); }}
                      title={t("Delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Template Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (generating && !open) return; setImportOpen(open); }}>
        <DialogContent className="!max-w-lg" showCloseButton={!generating} onPointerDownOutside={(e) => { if (generating) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (generating) e.preventDefault(); }}>
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
