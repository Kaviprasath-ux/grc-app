"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Upload, X, Home, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface Department {
  id: string;
  name: string;
}

interface GeneratedRisk {
  title: string;
  description: string;
  level: string;
  inherent_likelihood: string;
  inherent_impact: string;
}

interface RecentSearch {
  id: string;
  query: string;
  timestamp: Date;
  result?: string;
  generatedRisks?: GeneratedRisk[];
  total_risks?: number;
  department?: string;
  departmentId?: string; // Store department ID for adding risks
  specific_audit_focus?: string;
}

const STORAGE_KEY = "riskIdentificationSearches";
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";
const MAX_FILES = 10;

export default function RiskIdentificationPage() {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [auditFocus, setAuditFocus] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // Track which risks have been added to register (key: "searchId-riskIndex")
  const [addedRisks, setAddedRisks] = useState<Set<string>>(new Set());
  // Track which risks are currently being added (loading state)
  const [addingRisks, setAddingRisks] = useState<Set<string>>(new Set());

  // Check if user is Audit Head (only Audit Head can add risks)
  const isAuditHead = session?.user?.roles?.some(
    (role) => role === "AuditHead"
  ) ?? false;

  useEffect(() => {
    fetchDepartments();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Array<Omit<RecentSearch, "timestamp"> & { timestamp: string }>;
        setRecentSearches(
          parsed.map((s) => ({ ...s, timestamp: new Date(s.timestamp) }))
        );
      } catch {
        setRecentSearches([]);
      }
    }
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    } finally {
      setPageLoading(false);
    }
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const list = Array.from(newFiles);
    setFiles((prev) => {
      const combined = [...prev];
      for (const f of list) {
        if (combined.length >= MAX_FILES) break;
        if (f.size > 0 && !combined.some((x) => x === f || (x.name === f.name && x.size === f.size)))
          combined.push(f);
      }
      return combined.slice(0, MAX_FILES);
    });
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    if (target.files?.length) addFiles(target.files);
    target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSuggestRisks = async () => {
    // Validation: Check department
    if (!selectedDepartment) {
      toast.error(t("Please select a department first"));
      return;
    }

    // Validation: Check if user has permission (only Audit Head can suggest risks)
    if (!isAuditHead) {
      toast.error(t("Only Audit Head can suggest risks with AI"));
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("departmentId", selectedDepartment);
      if (auditFocus.trim()) formData.append("auditFocus", auditFocus.trim());
      files.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/internal-audit/risk-identification/suggest", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || "Failed to generate risk suggestions");
        return;
      }

      const deptName = departments.find((d) => d.id === selectedDepartment)?.name ?? "Unknown";
      const generatedRisks = (data.generated_risks ?? []) as GeneratedRisk[];
      const total_risks = typeof data.total_risks === "number" ? data.total_risks : generatedRisks.length;
      const query = `${deptName}${auditFocus.trim() ? ` - ${auditFocus.trim()}` : ""}`;

      const newSearch: RecentSearch = {
        id: Date.now().toString(),
        query,
        timestamp: new Date(),
        result: total_risks
          ? `${t("Generated")} ${total_risks} ${t("risk(s) for")} ${deptName}.`
          : `${t("No risks generated for")} ${deptName}.`,
        generatedRisks: generatedRisks.length ? generatedRisks : undefined,
        total_risks,
        department: data.department ?? deptName,
        departmentId: selectedDepartment, // Store department ID for adding risks
        specific_audit_focus: data.specific_audit_focus || undefined,
      };

      const updated = [newSearch, ...recentSearches].slice(0, 10);
      setRecentSearches(updated);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          updated.map((s) => ({ ...s, timestamp: s.timestamp.toISOString() }))
        )
      );

      toast.success(
        total_risks
          ? `Generated ${total_risks} risk(s) successfully`
          : "Risk assessment completed (no risks generated)"
      );
    } catch (error) {
      console.error("Suggest risks error:", error);
      toast.error("Failed to generate risk suggestions");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToRegister = async (
    risk: GeneratedRisk,
    searchId: string,
    riskIndex: number,
    departmentId: string | undefined
  ) => {
    // Create unique key for tracking
    const riskKey = `${searchId}-${riskIndex}`;

    // Check if already added or currently adding
    if (addedRisks.has(riskKey) || addingRisks.has(riskKey)) {
      return;
    }

    // Check permission
    if (!isAuditHead) {
      toast.error(t("Only Audit Head can add risks to register"));
      return;
    }

    // Validate department
    if (!departmentId) {
      toast.error(t("Department information missing. Please regenerate risks."));
      return;
    }

    // Set loading state
    setAddingRisks((prev) => new Set(prev).add(riskKey));

    try {
      // Map risk level to residual score for the API
      let riskLevel = "Low";
      let residualScore = 25;
      if (risk.level === "High") {
        riskLevel = "High";
        residualScore = 100;
      } else if (risk.level === "Medium") {
        riskLevel = "Medium";
        residualScore = 50;
      }

      const response = await fetch("/api/internal-audit/risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          riskName: risk.title.substring(0, 100),
          riskDescription: risk.description,
          departmentId: departmentId,
          riskLevel,
          residualScore,
          status: "Open",
          // Source tracking (stored in auditComment for now)
          auditComment: "Source: AI Suggested Risk",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add risk to register");
      }

      // Mark as added
      setAddedRisks((prev) => new Set(prev).add(riskKey));
      toast.success(t("Risk added to register successfully"));
    } catch (error) {
      console.error("Error adding risk:", error);
      toast.error(t("Failed to add risk. Please try again."));
    } finally {
      // Remove loading state
      setAddingRisks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(riskKey);
        return newSet;
      });
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (pageLoading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          {canViewDashboard && (
            <>
              <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
                {t("Dashboard")}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            </>
          )}
          <span className="text-primary-700 font-medium">{t("Risk Identification")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("Risk Identification")}</h1>
        </div>
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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <span className="text-primary-700 font-medium">{t("Risk Identification")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Identification")}</h1>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{t("Risk Assessment Parameters")}</h3>
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
            <Sparkles className="h-3 w-3" />
            <span>{t("AI-Powered")}</span>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* Department & Audit Focus - 2 column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Department Selection */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                {t("Department")} <span className="text-red-500">*</span>
              </label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-full h-9 bg-white border-slate-300">
                  <SelectValue placeholder={t("Select department...")} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Specific Audit Focus */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                {t("Specific Audit Focus")}
                <span className="text-slate-400 font-normal ml-1">({t("Optional")})</span>
              </label>
              <Textarea
                placeholder={t("e.g. Payroll processing, Third-party management...")}
                value={auditFocus}
                onChange={(e) => setAuditFocus(e.target.value)}
                rows={1}
                className="resize-none bg-white border-slate-300 min-h-[36px]"
              />
            </div>
          </div>

          {/* File Upload Area */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              {t("Supporting Documents")}
              <span className="text-slate-400 font-normal ml-1">({t("Optional")})</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={handleFileInputChange}
            />
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center border-slate-200 hover:border-primary-300 hover:bg-primary-50/30 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Upload className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm text-slate-600 mb-1">{t("Drag and drop files here, or click to upload")}</p>
              <p className="text-xs text-slate-400">
                {t("PDF, DOC, DOCX, XLS, XLSX, CSV, TXT")} ({t("max")} {MAX_FILES} {t("files")})
              </p>
            </div>

            {/* Uploaded Files List */}
            {files.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-slate-700 truncate flex-1">
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-400 mx-3 shrink-0">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer with Submit */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex justify-end">
          <Button
            size="sm"
            onClick={handleSuggestRisks}
            disabled={loading}
            className={!isAuditHead ? "opacity-50" : ""}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                {t("Analyzing...")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Suggest Risks with AI")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Recent Searches / Generated Risks */}
      {recentSearches.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">{t("Recent Searches")}</h3>
            <span className="text-xs text-slate-400">{recentSearches.length} {t("result(s)")}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {recentSearches.map((search) => (
              <div key={search.id} className="px-6 py-5">
                {/* Search Header */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                      <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{search.query}</p>
                      {search.result && (
                        <p className="text-xs text-slate-500 mt-0.5">{search.result}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                    {formatDate(search.timestamp)}
                  </span>
                </div>

                {/* Generated Risks */}
                {search.generatedRisks && search.generatedRisks.length > 0 && (
                  <div className="space-y-2 ltr:ml-11 rtl:mr-11">
                    {search.generatedRisks.map((r, idx) => {
                      const riskKey = `${search.id}-${idx}`;
                      const isAdded = addedRisks.has(riskKey);
                      const isAdding = addingRisks.has(riskKey);

                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">{r.title}</p>
                              {r.description && (
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{r.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <Badge
                                  className={`text-xs ${
                                    r.level === "High"
                                      ? "bg-red-100 text-red-700"
                                      : r.level === "Medium"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {r.level}
                                </Badge>
                                {r.inherent_likelihood && (
                                  <span className="text-xs text-slate-500">{t("Likelihood")}: <span className="font-medium text-slate-700">{r.inherent_likelihood}</span></span>
                                )}
                                {r.inherent_impact && (
                                  <span className="text-xs text-slate-500">{t("Impact")}: <span className="font-medium text-slate-700">{r.inherent_impact}</span></span>
                                )}
                              </div>
                            </div>
                            {/* Only show Add to Register for Audit Head and High/Medium risks */}
                            {isAuditHead && (r.level === "High" || r.level === "Medium") && (
                              <div className="shrink-0">
                                {isAdded ? (
                                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium px-2.5 py-1.5 bg-green-50 rounded-md border border-green-200">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>{t("Added")}</span>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    disabled={isAdding}
                                    onClick={() => handleAddToRegister(r, search.id, idx, search.departmentId)}
                                  >
                                    {isAdding ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1 animate-spin" />
                                        {t("Adding...")}
                                      </>
                                    ) : (
                                      t("Add to Register")
                                    )}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
