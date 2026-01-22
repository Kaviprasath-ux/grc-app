"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2, Send, Check } from "lucide-react";
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-900">Risk Identification</h1>
        <Button
          variant="link"
          className="text-blue-600"
          onClick={() => router.push("/internal-audit/risk-register")}
        >
          AI-Powered Risk Assessment
        </Button>
      </div>

      {/* Main Form Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Department Selection */}
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

          {/* Specific Audit Focus */}
          <div>
            <label className="text-sm font-medium text-blue-800 mb-2 block">
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

          {/* File Upload Area - Placeholder */}
          <div>
            <label className="text-sm font-medium text-blue-800 mb-2 block">
              Supporting Documents (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-500">
              <p>Drag and drop files here or click to upload</p>
              <p className="text-xs mt-1">Supported formats: PDF, DOC, DOCX, XLS, XLSX</p>
            </div>
          </div>

          {/* Submit Button */}
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

      {/* AI Suggested Risks */}
      {suggestedRisks.length > 0 && (
        <div className="space-y-0">
          {suggestedRisks.map((risk, index) => (
            <div
              key={risk.id}
              className={`flex items-center justify-between gap-4 p-4 bg-white ${
                index !== suggestedRisks.length - 1 ? "border-b" : ""
              }`}
            >
              {/* Risk Description */}
              <div className="flex-1">
                <p className="text-sm text-gray-800 leading-relaxed">
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {addingRisk === risk.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add to Register"
                  )}
                </Button>
              </div>
            </div>
          ))}

          {/* Summary when all risks are added */}
          {addedRisks.size === suggestedRisks.length && suggestedRisks.length > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
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
