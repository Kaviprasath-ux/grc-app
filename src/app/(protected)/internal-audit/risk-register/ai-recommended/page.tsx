"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Department {
  id: string;
  name: string;
}

interface InternalAuditRisk {
  id: string;
  riskId: string;
  riskName: string;
  riskDescription: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  riskLevel: string | null;
}

interface AuditTask {
  task_name: string;
  audit_steps: string[];
  audit_checklist_questions: string[];
  evidence_to_collect: string[];
}

interface AuditPlanItem {
  audit_code: string;
  audit_title: string;
  audit_objective: string;
  audit_scope: string;
  associated_risks: string[];
  audit_tasks: AuditTask[];
}

interface FieldworkAuditPlanResponse {
  department_name: string;
  audit_plan: AuditPlanItem[];
}

const RISK_LEVEL_MAP: Record<string, string> = {
  Extreme: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
};

export default function AIRecommendedRisksPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planResult, setPlanResult] = useState<FieldworkAuditPlanResponse | null>(null);
  const [addingToPlanning, setAddingToPlanning] = useState<number | null>(null);
  const [currentDepartmentId, setCurrentDepartmentId] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (e) {
      console.error("Failed to fetch departments:", e);
      toast.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  const fetchRisksForDepartment = async (departmentId: string): Promise<InternalAuditRisk[]> => {
    const res = await fetch(`/api/internal-audit/risks?departmentId=${departmentId}`);
    if (!res.ok) return [];
    return res.json();
  };

  const handleGenerateAuditPlan = async (dept: Department) => {
    setGenerating(dept.id);
    try {
      const risks = await fetchRisksForDepartment(dept.id);
      const risksPayload = risks.length
        ? risks.map((r) => ({
            associated_risk: (r.riskDescription || r.riskName || "").trim() || r.riskId,
            risks_level: RISK_LEVEL_MAP[r.riskLevel ?? ""] || "medium",
          }))
        : [{ associated_risk: `General audit focus for ${dept.name}`, risks_level: "medium" as const }];

      const payload = { department_name: dept.name, risks: risksPayload };
      console.log("[RunPod fieldwork-audit-plan] Client request:", JSON.stringify(payload, null, 2));

      const res = await fetch("/api/internal-audit/fieldwork-audit-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("[RunPod fieldwork-audit-plan] Client response status:", res.status);
      console.log("[RunPod fieldwork-audit-plan] Client response body:", JSON.stringify(data, null, 2));

      if (!res.ok) {
        toast.error(data?.error || "Failed to generate audit plan");
        return;
      }

      setPlanResult(data as FieldworkAuditPlanResponse);
      setCurrentDepartmentId(dept.id); // Store department ID for adding to planning
      setPlanDialogOpen(true);
      toast.success("Audit plan generated");
    } catch (e) {
      console.error("Generate audit plan error:", e);
      toast.error("Failed to generate audit plan");
    } finally {
      setGenerating(null);
    }
  };

  const handleAddToAuditPlan = async (plan: AuditPlanItem, planIndex: number) => {
    if (!currentDepartmentId) {
      toast.error("Department information missing");
      return;
    }

    setAddingToPlanning(planIndex);
    try {
      const res = await fetch("/api/internal-audit/audit-planning/from-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_code: plan.audit_code,
          audit_title: plan.audit_title,
          audit_objective: plan.audit_objective,
          audit_scope: plan.audit_scope,
          associated_risks: plan.associated_risks,
          audit_tasks: plan.audit_tasks,
          department_name: planResult?.department_name,
          departmentId: currentDepartmentId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle duplicate (409 Conflict) with warning message
        if (res.status === 409) {
          toast.warning(data?.error || "This audit plan has already been added to Audit Planning.");
        } else {
          toast.error(data?.error || "Failed to add to audit plan");
        }
        return;
      }

      toast.success("Successfully added to Audit Planning!");

      // Optionally navigate to audit planning
      // router.push("/internal-audit/audit-planning");
    } catch (e) {
      console.error("Add to audit plan error:", e);
      toast.error("Failed to add to audit plan");
    } finally {
      setAddingToPlanning(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Internal Audit</p>
          <h1 className="text-2xl font-semibold">AI Recommended Risks</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Internal Audit</p>
          <h1 className="text-2xl font-semibold">AI Recommended Risks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate audit plans per department from AI‑recommended risks.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/internal-audit/risk-register")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Risk Register
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <Card key={dept.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                {dept.name}
              </CardTitle>
              <CardDescription>Generate an audit plan for this department.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => handleGenerateAuditPlan(dept)}
                disabled={!!generating}
              >
                {generating === dept.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Audit Plan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {departments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No departments found. Add departments in Settings to generate audit plans.
          </CardContent>
        </Card>
      )}

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generated Audit Plan</DialogTitle>
            <DialogDescription>
              {planResult?.department_name && `Department: ${planResult.department_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {planResult?.audit_plan?.length ? (
              planResult.audit_plan.map((plan, idx) => (
                <Card key={idx}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {plan.audit_code} – {plan.audit_title}
                        </CardTitle>
                        {plan.audit_objective && (
                          <CardDescription className="mt-1">Objective: {plan.audit_objective}</CardDescription>
                        )}
                        {plan.audit_scope && (
                          <p className="text-sm text-muted-foreground mt-1">Scope: {plan.audit_scope}</p>
                        )}
                        {plan.associated_risks?.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Associated risks: {plan.associated_risks.join("; ")}
                          </p>
                        )}
                      </div>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 shrink-0"
                        onClick={() => handleAddToAuditPlan(plan, idx)}
                        disabled={addingToPlanning !== null}
                      >
                        {addingToPlanning === idx ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          "Add to Audit Plan"
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {plan.audit_tasks?.map((task, ti) => (
                      <div key={ti} className="rounded border p-3 text-sm">
                        <p className="font-medium">{task.task_name}</p>
                        {task.audit_steps?.length > 0 && (
                          <ul className="list-disc list-inside mt-1 text-muted-foreground">
                            {task.audit_steps.slice(0, 3).map((s, si) => (
                              <li key={si}>{s}</li>
                            ))}
                            {task.audit_steps.length > 3 && (
                              <li>…and {task.audit_steps.length - 3} more</li>
                            )}
                          </ul>
                        )}
                        {task.evidence_to_collect?.length > 0 && (
                          <p className="mt-1 text-xs">Evidence: {task.evidence_to_collect.slice(0, 2).join(", ")}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground">No audit plans in response.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
