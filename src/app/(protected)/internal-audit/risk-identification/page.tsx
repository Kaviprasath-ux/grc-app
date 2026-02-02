"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Check, Sparkles, Upload, X, Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
}

interface SuggestedRisk {
  id: string;
  description: string;
  severity: "High" | "Medium" | "Low";
  category?: string;
}

export default function RiskIdentificationPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [auditFocus, setAuditFocus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [suggestedRisks, setSuggestedRisks] = useState<SuggestedRisk[]>([]);
  const [addedRisks, setAddedRisks] = useState<Set<string>>(new Set());
  const [addingRisk, setAddingRisk] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchDepartments();
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

  const handleSuggestRisks = async () => {
    if (!selectedDepartment) {
      toast.error("Please select a department first");
      return;
    }

    setLoading(true);
    setSuggestedRisks([]);
    setAddedRisks(new Set());

    try {
      // Simulate AI risk suggestion (in a real app, this would call an AI API)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const deptName = departments.find(d => d.id === selectedDepartment)?.name || "Unknown";

      // Generate AI-suggested risks based on department
      const aiSuggestedRisks: SuggestedRisk[] = [
        {
          id: `risk-${Date.now()}-1`,
          description: `Inadequate access controls for ${deptName} systems may lead to unauthorized data access or modification, potentially resulting in data breaches or compliance violations.`,
          severity: "High",
          category: "Information Security"
        },
        {
          id: `risk-${Date.now()}-2`,
          description: `Insufficient documentation of ${deptName} processes and procedures could result in operational inconsistencies, knowledge gaps during staff turnover, and audit findings.`,
          severity: "Medium",
          category: "Operational"
        },
        {
          id: `risk-${Date.now()}-3`,
          description: `Lack of regular compliance monitoring in ${deptName} may result in regulatory non-compliance and potential penalties or legal issues.`,
          severity: "High",
          category: "Compliance"
        },
        {
          id: `risk-${Date.now()}-4`,
          description: `Inadequate segregation of duties within ${deptName} could lead to fraud, errors going undetected, or conflicts of interest in critical business processes.`,
          severity: "High",
          category: "Control Environment"
        },
        {
          id: `risk-${Date.now()}-5`,
          description: `Absence of business continuity planning for ${deptName} operations may result in extended downtime and financial losses during disruptions.`,
          severity: "Medium",
          category: "Business Continuity"
        }
      ];

      // Add focus-specific risks if audit focus is provided
      if (auditFocus) {
        aiSuggestedRisks.push({
          id: `risk-${Date.now()}-6`,
          description: `Based on the audit focus "${auditFocus}": There may be control gaps or process inefficiencies that require detailed assessment and remediation.`,
          severity: "Medium",
          category: "Process Specific"
        });
      }

      setSuggestedRisks(aiSuggestedRisks);
      toast.success(`${aiSuggestedRisks.length} risk suggestions generated successfully`);
    } catch (error) {
      toast.error("Failed to generate risk suggestions");
    } finally {
      setLoading(false);
    }
  };

  // File upload handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file =>
      /\.(pdf|doc|docx|xls|xlsx)$/i.test(file.name)
    );
    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
    }
    if (validFiles.length < files.length) {
      toast.error("Some files were skipped. Only PDF, DOC, DOCX, XLS, XLSX are supported.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const validFiles = Array.from(files).filter(file =>
        /\.(pdf|doc|docx|xls|xlsx)$/i.test(file.name)
      );
      if (validFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...validFiles]);
      }
    }
    // Reset input to allow selecting the same file again
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddToRegister = async (risk: SuggestedRisk) => {
    setAddingRisk(risk.id);

    try {
      // Map severity to risk level
      let riskLevel = "Low";
      let residualScore = 25;
      if (risk.severity === "High") {
        riskLevel = "High";
        residualScore = 100;
      } else if (risk.severity === "Medium") {
        riskLevel = "Medium";
        residualScore = 50;
      }

      const response = await fetch("/api/internal-audit/risks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          riskName: risk.description.substring(0, 100),
          riskDescription: risk.description,
          departmentId: selectedDepartment,
          riskLevel,
          residualScore,
          status: "Open",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add risk to register");
      }

      setAddedRisks(prev => new Set([...prev, risk.id]));
      toast.success("Risk added to register successfully");
    } catch (error) {
      console.error("Error adding risk:", error);
      toast.error("Failed to add risk to register");
    } finally {
      setAddingRisk(null);
    }
  };

  if (pageLoading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/internal-audit/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>Internal Audit</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">Risk Identification</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">Risk Identification</h1>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">Loading...</p>
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
          <span>Internal Audit</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Risk Identification</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Risk Identification</h1>
        <Button
          variant="outline"
          size="sm"
          className="bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200"
          onClick={() => router.push("/internal-audit/risk-register")}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          AI Integrated
        </Button>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 space-y-6">
          {/* Department Selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
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

          {/* Specific Audit Focus */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Specific Audit Focus (Optional)
            </label>
            <Textarea
              placeholder="Describe specific areas or processes to focus on..."
              value={auditFocus}
              onChange={(e) => setAuditFocus(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* File Upload Area */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Supporting Documents (Optional)
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary-500 bg-primary-50"
                  : "border-slate-200"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                id="file-upload"
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
              />
              <Upload className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 mb-2">Drag and drop files here, or</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                Click to Upload
              </Button>
              <p className="text-xs text-slate-400 mt-3">Supported formats: PDF, DOC, DOCX, XLS, XLSX</p>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-slate-700 truncate flex-1">
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-400 mx-2">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSuggestRisks}
              disabled={loading || !selectedDepartment}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Suggest Risks with AI
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* AI Suggested Risks */}
      {suggestedRisks.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {suggestedRisks.map((risk, index) => (
            <div
              key={risk.id}
              className={`flex items-center justify-between gap-4 p-4 ${
                index !== suggestedRisks.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              {/* Risk Description */}
              <div className="flex-1">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {risk.description}
                </p>
              </div>

              {/* Severity Badge */}
              <div className="flex-shrink-0">
                <Badge
                  className={
                    risk.severity === "High"
                      ? "bg-red-500 text-white hover:bg-red-500 rounded-full px-3"
                      : risk.severity === "Medium"
                      ? "bg-yellow-500 text-white hover:bg-yellow-500 rounded-full px-3"
                      : "bg-green-500 text-white hover:bg-green-500 rounded-full px-3"
                  }
                >
                  {risk.severity}
                </Badge>
              </div>

              {/* Green Tick + Add to Register Button */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {addedRisks.has(risk.id) && (
                  <Check className="h-5 w-5 text-green-500" />
                )}
                <Button
                  size="sm"
                  onClick={() => handleAddToRegister(risk)}
                  disabled={addingRisk === risk.id || addedRisks.has(risk.id)}
                >
                  {addingRisk === risk.id ? (
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  ) : (
                    "Add to Register"
                  )}
                </Button>
              </div>
            </div>
          ))}

          {/* Summary when all risks are added */}
          {addedRisks.size === suggestedRisks.length && suggestedRisks.length > 0 && (
            <div className="p-4 bg-green-50 border-t border-green-200">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="h-5 w-5" />
                <span className="font-medium">
                  All {suggestedRisks.length} risks have been added to the register
                </span>
              </div>
              <Button
                variant="link"
                className="text-green-700 p-0 mt-2"
                onClick={() => router.push("/internal-audit/risk-register")}
              >
                View Risk Register &rarr;
              </Button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
