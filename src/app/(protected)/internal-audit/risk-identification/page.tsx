"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Send, Upload, X } from "lucide-react";
import { toast } from "sonner";

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
  specific_audit_focus?: string;
}

const STORAGE_KEY = "riskIdentificationSearches";
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";
const MAX_FILES = 10;

export default function RiskIdentificationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [auditFocus, setAuditFocus] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

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
    if (!selectedDepartment) {
      toast.error("Please select a department first");
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
          ? `Generated ${total_risks} risk(s) for ${deptName}.`
          : `No risks generated for ${deptName}.`,
        generatedRisks: generatedRisks.length ? generatedRisks : undefined,
        total_risks,
        department: data.department ?? deptName,
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
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-900 mb-6">Risk Identification</h1>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-900">Risk Identification</h1>
        <Button
          variant="link"
          className="text-blue-600"
          onClick={() => router.push("/internal-audit/risk-register")}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          AI-Powered Risk Assessment
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div>
            <label className="text-sm font-medium text-blue-800 mb-2 block">
              Select a Department to Assess
            </label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-blue-800 mb-2 block">
              Specific Audit Focus (Optional)
            </label>
            <Textarea
              placeholder="e.g. Payroll processing, Third-party management..."
              value={auditFocus}
              onChange={(e) => setAuditFocus(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-blue-800 mb-2 block">
              Supporting Documents (Optional)
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
              className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-500 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>Drag and drop files here or click to upload</p>
              <p className="text-xs mt-1">
                PDF, DOC, DOCX, XLS, XLSX, CSV, TXT (max {MAX_FILES} files)
              </p>
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1"
                  >
                    <span className="truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeFile(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button
            onClick={handleSuggestRisks}
            disabled={loading || !selectedDepartment}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Suggest Risks with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {recentSearches.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-blue-800 mb-4">Recent Searches</h3>
            <div className="space-y-3">
              {recentSearches.map((search) => (
                <div key={search.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-medium">{search.query}</p>
                        <span className="text-xs text-gray-500 shrink-0">
                          {formatDate(search.timestamp)}
                        </span>
                      </div>
                      {search.result && (
                        <p className="text-sm text-gray-600 mt-2">{search.result}</p>
                      )}
                      {search.generatedRisks && search.generatedRisks.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {search.generatedRisks.map((r, idx) => (
                            <div
                              key={idx}
                              className="text-sm border-l-2 border-blue-200 pl-3 py-1 bg-blue-50/50 rounded-r"
                            >
                              <p className="font-medium">{r.title}</p>
                              {r.description && (
                                <p className="text-gray-600 mt-0.5">{r.description}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                                <span>Level: {r.level}</span>
                                <span>Likelihood: {r.inherent_likelihood}</span>
                                <span>Impact: {r.inherent_impact}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
