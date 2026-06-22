"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, ChevronRight, Loader2, Home, RotateCcw } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface InternalAuditRisk {
  id: string;
  riskId: string;
  riskName: string;
  riskDescription: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  auditTypeId?: string | null;
  auditType?: { id: string; name: string } | null;
  riskDrivers?: string | null;
  riskLevel: string | null;
  assessmentStatus: string;
  strategicImpact: number | null;
  financialImpact: number | null;
  complianceRisk: number | null;
  operationalRisk: number | null;
  itDataRisk: number | null;
  controlEffectivenessScore: number | null;
  assessmentLikelihood: number | null;
  assessmentResidualScore: number | null;
}

interface AssessmentRow {
  strategicImpact: string;
  financialImpact: string;
  complianceRisk: string;
  operationalRisk: string;
  itDataRisk: string;
  assessmentLikelihood: string;
  controlEffectivenessScore: string;
}

interface Probability { id: string; label: string; value: number; }
interface Impact { id: string; label: string; value: number; }

function RiskAssessmentContent() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canView, canEdit, isLoading: permissionsLoading } = usePermissions("audit.risk-register");
  const searchParams = useSearchParams();
  const autoOpenRiskId = searchParams.get("riskId");

  // Data state
  const [risks, setRisks] = useState<InternalAuditRisk[]>([]);
  const [probabilities, setProbabilities] = useState<Probability[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [inProgressRisks, setInProgressRisks] = useState<Set<string>>(new Set());

  // Translated
  const { data: translatedCategories } = useTranslatedData(categories, { modelName: "AuditCategory" });

  // Assessment wizard state
  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [selectedAssessmentRisk, setSelectedAssessmentRisk] = useState<InternalAuditRisk | null>(null);
  const [assessmentStep, setAssessmentStep] = useState(1);
  const [singleAssessmentRow, setSingleAssessmentRow] = useState<AssessmentRow>({
    strategicImpact: "",
    financialImpact: "",
    complianceRisk: "",
    operationalRisk: "",
    itDataRisk: "",
    assessmentLikelihood: "",
    controlEffectivenessScore: "",
  });
  const [savingAssessment, setSavingAssessment] = useState(false);

  // ── Lookup helpers ──────────────────────────────────────────────────────────
  const tCat = useCallback(
    (id: string | null) => translatedCategories.find((c) => c.id === id)?.name,
    [translatedCategories]
  );
  const tDept = useCallback(
    (id: string | null) => departments.find((d) => d.id === id)?.name,
    [departments]
  );

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchRisks = async () => {
    try {
      const response = await fetch("/api/internal-audit/risks");
      if (response.ok) {
        const data = await response.json();
        setRisks(data);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    try {
      const [risksRes, probRes, impactRes, catRes] = await Promise.all([
        fetch("/api/internal-audit/risks"),
        fetch("/api/internal-audit/probability"),
        fetch("/api/internal-audit/impact"),
        fetch("/api/internal-audit/categories"),
      ]);
      if (risksRes.ok) setRisks(await risksRes.json());
      if (probRes.ok) setProbabilities(await probRes.json());
      if (impactRes.ok) setImpacts(await impactRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchAllData(), fetchDepartments()]);
      setLoading(false);
    };
    init();
  }, []);

  // Auto-open assessment dialog when navigated from Risk Register with a riskId
  const autoOpenFired = useRef(false);
  useEffect(() => {
    if (!autoOpenRiskId || loading || risks.length === 0 || autoOpenFired.current) return;
    const risk = risks.find((r) => r.id === autoOpenRiskId);
    if (!risk) return;
    autoOpenFired.current = true;
    const saved = typeof window !== "undefined" ? localStorage.getItem(`ia-assess-${risk.id}`) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSingleAssessmentRow(parsed.row ?? {
          strategicImpact: risk.strategicImpact?.toString() ?? "",
          financialImpact: risk.financialImpact?.toString() ?? "",
          complianceRisk: risk.complianceRisk?.toString() ?? "",
          operationalRisk: risk.operationalRisk?.toString() ?? "",
          itDataRisk: risk.itDataRisk?.toString() ?? "",
          assessmentLikelihood: risk.assessmentLikelihood?.toString() ?? "",
          controlEffectivenessScore: risk.controlEffectivenessScore?.toString() ?? "",
        });
        setAssessmentStep(parsed.step ?? 1);
      } catch {
        setSingleAssessmentRow({
          strategicImpact: risk.strategicImpact?.toString() ?? "",
          financialImpact: risk.financialImpact?.toString() ?? "",
          complianceRisk: risk.complianceRisk?.toString() ?? "",
          operationalRisk: risk.operationalRisk?.toString() ?? "",
          itDataRisk: risk.itDataRisk?.toString() ?? "",
          assessmentLikelihood: risk.assessmentLikelihood?.toString() ?? "",
          controlEffectivenessScore: risk.controlEffectivenessScore?.toString() ?? "",
        });
        setAssessmentStep(1);
      }
    } else {
      setSingleAssessmentRow({
        strategicImpact: risk.strategicImpact?.toString() ?? "",
        financialImpact: risk.financialImpact?.toString() ?? "",
        complianceRisk: risk.complianceRisk?.toString() ?? "",
        operationalRisk: risk.operationalRisk?.toString() ?? "",
        itDataRisk: risk.itDataRisk?.toString() ?? "",
        assessmentLikelihood: risk.assessmentLikelihood?.toString() ?? "",
        controlEffectivenessScore: risk.controlEffectivenessScore?.toString() ?? "",
      });
      setAssessmentStep(1);
    }
    setSelectedAssessmentRisk(risk);
    setAssessmentDialogOpen(true);
  }, [autoOpenRiskId, loading, risks]);

  // Recompute inProgressRisks whenever the risks list changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const inProgress = new Set<string>();
      risks.forEach((risk) => {
        if (localStorage.getItem(`ia-assess-${risk.id}`)) inProgress.add(risk.id);
      });
      setInProgressRisks(inProgress);
    }
  }, [risks]);

  const refreshInProgress = useCallback(() => {
    if (typeof window !== "undefined") {
      const inProgress = new Set<string>();
      risks.forEach((risk) => {
        if (localStorage.getItem(`ia-assess-${risk.id}`)) inProgress.add(risk.id);
      });
      setInProgressRisks(inProgress);
    }
  }, [risks]);

  // ── localStorage helpers ──────────────────────────────────────────────────
  const saveProgress = (step: number, row: AssessmentRow, riskId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`ia-assess-${riskId}`, JSON.stringify({ step, row }));
    }
  };

  // ── Assessment wizard helpers ──────────────────────────────────────────────
  const calcAssessmentMeanImpact = (row: AssessmentRow): number => {
    const vals = [
      parseFloat(row.strategicImpact),
      parseFloat(row.financialImpact),
      parseFloat(row.complianceRisk),
      parseFloat(row.operationalRisk),
      parseFloat(row.itDataRisk),
    ];
    const sum = vals.reduce((acc, v) => acc + (isNaN(v) ? 0 : v), 0);
    return sum / 5;
  };

  const calcAssessmentScore = (row: AssessmentRow): number => {
    const meanProbability = parseFloat(row.assessmentLikelihood) || 0;
    const meanImpact = calcAssessmentMeanImpact(row);
    const ce = parseFloat(row.controlEffectivenessScore) || 0;
    if (!meanProbability || !meanImpact || !ce) return 0;
    return meanProbability * meanImpact * ((6 - ce) / 5);
  };

  const deriveAssessmentRating = (score: number): { label: string; color: string } => {
    if (score <= 0) return { label: "-", color: "" };
    if (score >= 15) return { label: "Critical", color: "bg-risk-critical-bg text-risk-critical" };
    if (score >= 10) return { label: "High", color: "bg-risk-high-bg text-risk-high" };
    if (score >= 5) return { label: "Medium", color: "bg-risk-medium-bg text-risk-medium" };
    return { label: "Low", color: "bg-risk-low-bg text-risk-low" };
  };

  const calcSettingsMeanProbability = (): number => {
    if (probabilities.length === 0) return 0;
    return probabilities.reduce((acc, p) => acc + p.value, 0) / probabilities.length;
  };

  const calcSettingsMeanImpact = (): number => {
    if (impacts.length === 0) return 0;
    return impacts.reduce((acc, i) => acc + i.value, 0) / impacts.length;
  };

  const calcScoreFromSettings = (row: AssessmentRow): number => {
    const meanP = calcSettingsMeanProbability();
    const meanI = calcSettingsMeanImpact();
    const ce = parseFloat(row.controlEffectivenessScore) || 0;
    if (!meanP || !meanI || !ce) return 0;
    return meanP * meanI * ((6 - ce) / 5);
  };

  const CE_LABELS: Record<string, string> = {
    "1": t("Very Ineffective"),
    "2": t("Ineffective"),
    "3": t("Moderately Effective"),
    "4": t("Effective"),
    "5": t("Highly Effective"),
  };

  const updateSingleAssessmentField = (field: keyof AssessmentRow, value: string) => {
    setSingleAssessmentRow((prev) => {
      const updated = { ...prev, [field]: value };
      if (selectedAssessmentRisk) saveProgress(assessmentStep, updated, selectedAssessmentRisk.id);
      return updated;
    });
  };

  const openAssessmentDialog = (risk: InternalAuditRisk) => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(`ia-assess-${risk.id}`) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSingleAssessmentRow(
          parsed.row ?? {
            strategicImpact: risk.strategicImpact?.toString() ?? "",
            financialImpact: risk.financialImpact?.toString() ?? "",
            complianceRisk: risk.complianceRisk?.toString() ?? "",
            operationalRisk: risk.operationalRisk?.toString() ?? "",
            itDataRisk: risk.itDataRisk?.toString() ?? "",
            assessmentLikelihood: risk.assessmentLikelihood?.toString() ?? "",
            controlEffectivenessScore: risk.controlEffectivenessScore?.toString() ?? "",
          }
        );
        setAssessmentStep(parsed.step ?? 1);
      } catch {
        setSingleAssessmentRow({
          strategicImpact: risk.strategicImpact?.toString() ?? "",
          financialImpact: risk.financialImpact?.toString() ?? "",
          complianceRisk: risk.complianceRisk?.toString() ?? "",
          operationalRisk: risk.operationalRisk?.toString() ?? "",
          itDataRisk: risk.itDataRisk?.toString() ?? "",
          assessmentLikelihood: risk.assessmentLikelihood?.toString() ?? "",
          controlEffectivenessScore: risk.controlEffectivenessScore?.toString() ?? "",
        });
        setAssessmentStep(1);
      }
    } else {
      setSingleAssessmentRow({
        strategicImpact: risk.strategicImpact?.toString() ?? "",
        financialImpact: risk.financialImpact?.toString() ?? "",
        complianceRisk: risk.complianceRisk?.toString() ?? "",
        operationalRisk: risk.operationalRisk?.toString() ?? "",
        itDataRisk: risk.itDataRisk?.toString() ?? "",
        assessmentLikelihood: risk.assessmentLikelihood?.toString() ?? "",
        controlEffectivenessScore: risk.controlEffectivenessScore?.toString() ?? "",
      });
      setAssessmentStep(1);
    }
    setSelectedAssessmentRisk(risk);
    setAssessmentDialogOpen(true);
  };

  const handleSaveAssessment = async () => {
    if (!selectedAssessmentRisk) return;
    setSavingAssessment(true);
    const row = singleAssessmentRow;
    const preCalcScore = calcScoreFromSettings(row);
    try {
      const res = await fetch(`/api/internal-audit/risks/${selectedAssessmentRisk.id}/assess`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategicImpact: row.strategicImpact ? parseInt(row.strategicImpact) : null,
          financialImpact: row.financialImpact ? parseInt(row.financialImpact) : null,
          complianceRisk: row.complianceRisk ? parseInt(row.complianceRisk) : null,
          operationalRisk: row.operationalRisk ? parseInt(row.operationalRisk) : null,
          itDataRisk: row.itDataRisk ? parseInt(row.itDataRisk) : null,
          assessmentLikelihood: row.assessmentLikelihood ? parseInt(row.assessmentLikelihood) : null,
          controlEffectivenessScore: row.controlEffectivenessScore
            ? parseInt(row.controlEffectivenessScore)
            : null,
          assessmentResidualScore: preCalcScore > 0 ? Math.round(preCalcScore * 100) / 100 : null,
        }),
      });
      if (res.ok) {
        if (typeof window !== "undefined")
          localStorage.removeItem(`ia-assess-${selectedAssessmentRisk.id}`);
        toast({ title: t("Success"), description: t("Risk assessed successfully") });
        fetchRisks();
        setAssessmentDialogOpen(false);
        // Remove from inProgress set
        setInProgressRisks((prev) => {
          const next = new Set(prev);
          next.delete(selectedAssessmentRisk.id);
          return next;
        });
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to save assessment"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("Error"),
        description: t("Failed to save assessment"),
        variant: "destructive",
      });
    }
    setSavingAssessment(false);
  };

  // ── Badge helpers ──────────────────────────────────────────────────────────
  const getRiskLevelBadge = (level: string | null) => {
    const colors: Record<string, string> = {
      Critical: "bg-red-100 text-red-700",
      High: "bg-orange-100 text-orange-700",
      Medium: "bg-yellow-100 text-yellow-700",
      Low: "bg-green-100 text-green-700",
    };
    const colorClass = colors[level ?? ""] ?? "bg-slate-100 text-slate-500";
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      >
        {t(level ?? "–")}
      </span>
    );
  };

  // ── Permission guard ──────────────────────────────────────────────────────
  if (!permissionsLoading && !canView) {
    return (
      <div className="p-6 flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-slate-500 text-sm">{t("You do not have permission to view this page.")}</p>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || permissionsLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200" />
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-[#7c3f2f] border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading risks...")}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <Link href="/internal-audit/dashboard" className="hover:text-[#7c3f2f] transition-colors">
            {t("Internal Audit")}
          </Link>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link
          href="/internal-audit/dashboard"
          className="text-slate-500 hover:text-[#7c3f2f] transition-colors"
        >
          {t("Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-[#7c3f2f] font-medium">{t("Risk Assessment")}</span>
      </nav>

      {/* Page Title */}
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Risk Assessment")}</h1>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap ltr:pl-5 rtl:pr-5 min-w-[100px]">
                  {t("Risk ID")}
                </TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[200px]">
                  {t("Risk Name")}
                </TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[130px]">
                  {t("Department")}
                </TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[120px]">
                  {t("Category")}
                </TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[110px]">
                  {t("Risk Level")}
                </TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[120px]">
                  {t("Status")}
                </TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[110px]">
                  {t("Residual Score")}
                </TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap ltr:pr-5 rtl:pl-5 min-w-[180px]">
                  {t("Action")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((risk) => {
                const hasProgress = inProgressRisks.has(risk.id);
                const isAssessed = risk.assessmentStatus === "Assessed";
                return (
                  <TableRow key={risk.id} className="border-b border-slate-100 last:border-0">
                    <TableCell className="py-3 ltr:pl-5 rtl:pr-5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-xs font-mono font-semibold text-slate-600">
                        {risk.riskId}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-800 max-w-[250px] truncate font-medium">
                      {risk.riskName}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-600 whitespace-nowrap">
                      {tDept(risk.departmentId) || risk.department?.name || "–"}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-600 whitespace-nowrap">
                      {tCat(risk.categoryId) || risk.category?.name || "–"}
                    </TableCell>
                    <TableCell className="py-3 whitespace-nowrap">
                      {getRiskLevelBadge(risk.riskLevel)}
                    </TableCell>
                    <TableCell className="py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isAssessed
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {t(risk.assessmentStatus ?? "Not Assessed")}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">
                      {isAssessed && risk.assessmentResidualScore != null
                        ? risk.assessmentResidualScore.toFixed(2)
                        : "–"}
                    </TableCell>
                    <TableCell className="py-3 ltr:pr-5 rtl:pl-5 whitespace-nowrap">
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          {hasProgress && !isAssessed && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              {t("In Progress")}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant={isAssessed ? "outline" : "default"}
                            className={
                              isAssessed
                                ? "border-[#c4896e] text-[#7c3f2f] hover:bg-[#fdf6f2] gap-1.5 text-xs h-8"
                                : "bg-[#7c3f2f] hover:bg-[#6a3528] text-white gap-1.5 text-xs h-8"
                            }
                            onClick={() => openAssessmentDialog(risk)}
                          >
                            {isAssessed ? (
                              <>
                                <RotateCcw className="h-3 w-3" />
                                {t("Re-assess")}
                              </>
                            ) : (
                              <>
                                <ClipboardList className="h-3 w-3" />
                                {hasProgress ? t("Resume") : t("Initiate Assessment")}
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {risks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-sm text-slate-500">
                    {t("No risks found.")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Risk Assessment Wizard Dialog */}
      <Dialog
        open={assessmentDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssessmentDialogOpen(false);
            refreshInProgress();
          }
        }}
      >
        <DialogContent
          className="max-w-[780px] w-full p-0 gap-0 overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {selectedAssessmentRisk &&
            (() => {
              const row = singleAssessmentRow;
              const meanImpact = calcAssessmentMeanImpact(row);
              const score = calcAssessmentScore(row);
              const rating = deriveAssessmentRating(score);
              const settingsMeanProbability = calcSettingsMeanProbability();
              const settingsMeanImpact = calcSettingsMeanImpact();
              const settingsScore = calcScoreFromSettings(row);
              const settingsRating = deriveAssessmentRating(settingsScore);
              const TOTAL_STEPS = 5;
              const STEPS = [
                t("Risk Context"),
                t("Likelihood"),
                t("Impact"),
                t("Risk Rating"),
                t("Summary"),
              ];
              const impactFields: { field: keyof AssessmentRow; label: string }[] = [
                { field: "strategicImpact", label: t("Strategic Impact") },
                { field: "financialImpact", label: t("Financial Impact") },
                { field: "complianceRisk", label: t("Compliance Risk") },
                { field: "operationalRisk", label: t("Operational Risk") },
                { field: "itDataRisk", label: t("IT / Data Risk") },
              ];
              return (
                <div className="flex flex-col" style={{ maxHeight: "90vh" }}>
                  {/* Header */}
                  <div className="px-8 pt-7 pb-5 flex-shrink-0">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-slate-800">
                        {t("Risk Assessment")}
                      </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-500 mt-1">
                      {selectedAssessmentRisk.riskId} – {selectedAssessmentRisk.riskName}
                    </p>

                    {/* Step Progress */}
                    <div className="flex items-start justify-between mt-6 mb-1">
                      {STEPS.map((label, idx) => {
                        const step = idx + 1;
                        const isActive = step === assessmentStep;
                        const isDone = step < assessmentStep;
                        return (
                          <div key={step} className="flex items-center flex-1">
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                                  isActive
                                    ? "bg-[#7c3f2f] border-[#7c3f2f] text-white shadow-md"
                                    : isDone
                                    ? "bg-[#ead5c8] border-[#c4896e] text-[#7c3f2f]"
                                    : "bg-white border-[#e8d5cc] text-[#c4896e]"
                                }`}
                              >
                                {step}
                              </div>
                              <span
                                className={`text-[10px] font-medium text-center leading-tight whitespace-nowrap ${
                                  isActive ? "text-[#7c3f2f] font-semibold" : "text-slate-400"
                                }`}
                              >
                                {label}
                              </span>
                            </div>
                            {idx < STEPS.length - 1 && (
                              <div
                                className={`flex-1 h-px mx-2 mb-5 ${
                                  isDone ? "bg-[#c4896e]" : "bg-[#e8d5cc]"
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 flex-shrink-0" />

                  {/* Step Content – scrollable */}
                  <div className="flex-1 overflow-y-auto px-8 py-6 min-h-[320px]">
                    {/* Step 1: Risk Context */}
                    {assessmentStep === 1 && (
                      <div>
                        <div className="flex items-baseline gap-3 mb-5 pb-4 border-b border-slate-100">
                          <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-xs font-mono font-semibold text-slate-600">
                            {selectedAssessmentRisk.riskId}
                          </span>
                          <span className="text-xl font-bold text-slate-800">
                            {selectedAssessmentRisk.riskName}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-3">
                          {t("RISK CONTEXT")}
                        </p>
                        <div className="divide-y divide-slate-100">
                          <div className="flex items-center py-3 gap-4">
                            <span className="w-28 text-sm text-slate-400 flex-shrink-0">
                              {t("Category")}
                            </span>
                            <span className="flex-1 text-sm font-bold text-slate-800">
                              {tCat(selectedAssessmentRisk.categoryId) ||
                                selectedAssessmentRisk.category?.name ||
                                "–"}
                            </span>
                            <span className="w-16 text-sm text-[#c4896e] flex-shrink-0 text-right">
                              {t("Type")}
                            </span>
                            <span className="w-28 text-sm font-bold text-slate-800 text-right">
                              {selectedAssessmentRisk.auditType?.name || "–"}
                            </span>
                          </div>
                          <div className="flex items-center py-3 gap-4">
                            <span className="w-28 text-sm text-slate-400 flex-shrink-0">
                              {t("Owner")}
                            </span>
                            <span className="flex-1 text-sm font-bold text-slate-800">–</span>
                            <span className="w-24 text-sm text-[#c4896e] flex-shrink-0 text-right">
                              {t("Department")}
                            </span>
                            <span className="w-28 text-sm font-bold text-slate-800 text-right">
                              {tDept(selectedAssessmentRisk.departmentId) ||
                                selectedAssessmentRisk.department?.name ||
                                "–"}
                            </span>
                          </div>
                          <div className="flex items-center py-3 gap-4">
                            <span className="w-28 text-sm text-slate-400 flex-shrink-0">
                              {t("Risk Sources")}
                            </span>
                            <span className="flex-1 text-sm font-bold text-slate-800 text-right">
                              {selectedAssessmentRisk.riskDrivers ||
                                selectedAssessmentRisk.riskDescription ||
                                "–"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Likelihood */}
                    {assessmentStep === 2 && (
                      <div>
                        <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-3">
                          {t("LIKELIHOOD")}
                        </p>
                        <p className="text-sm text-slate-500 mb-5">
                          {t(
                            "Select the probability that this risk will occur based on historical data and current controls."
                          )}
                        </p>
                        <div className="space-y-3">
                          {[1, 2, 3, 4, 5].map((v) => {
                            const selected = row.assessmentLikelihood === v.toString();
                            return (
                              <label
                                key={v}
                                className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 cursor-pointer transition-all ${
                                  selected
                                    ? "border-[#c4896e] bg-[#fdf6f2]"
                                    : "border-slate-200 bg-white hover:border-[#e8d5cc]"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="likelihood"
                                  value={v.toString()}
                                  checked={selected}
                                  onChange={(e) =>
                                    updateSingleAssessmentField(
                                      "assessmentLikelihood",
                                      e.target.value
                                    )
                                  }
                                  className="accent-[#7c3f2f] w-4 h-4"
                                />
                                <span
                                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                                    selected ? "bg-[#7c3f2f] text-white" : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {v}
                                </span>
                                <span
                                  className={`text-sm font-semibold ${
                                    selected ? "text-[#7c3f2f]" : "text-slate-700"
                                  }`}
                                >
                                  {v}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Step 3: Impact */}
                    {assessmentStep === 3 && (
                      <div>
                        <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-3">
                          {t("IMPACT")}
                        </p>
                        <p className="text-sm text-slate-500 mb-5">
                          {t(
                            "Rate the impact across each dimension if this risk were to materialise."
                          )}
                        </p>
                        <div className="space-y-5">
                          {impactFields.map(({ field, label }) => (
                            <div key={field}>
                              <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
                              <div className="flex gap-2 flex-wrap">
                                {[1, 2, 3, 4, 5].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() =>
                                      updateSingleAssessmentField(field, v.toString())
                                    }
                                    className={`px-5 py-2.5 rounded-full text-sm font-semibold border-2 transition-all ${
                                      row[field] === v.toString()
                                        ? "bg-[#7c3f2f] border-[#7c3f2f] text-white shadow-sm"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-[#c4896e]"
                                    }`}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step 4: Risk Rating */}
                    {assessmentStep === 4 && (
                      <div>
                        <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-4">
                          {t("RISK RATING")}
                        </p>
                        <div className="mb-6">
                          <label className="text-sm font-semibold text-slate-700 block mb-1">
                            {t("Control Effectiveness")}
                          </label>
                          <p className="text-xs text-slate-400 mb-3">
                            1 = {t("Very Ineffective")} · 2 = {t("Ineffective")} · 3 ={" "}
                            {t("Moderately Effective")} · 4 = {t("Effective")} · 5 ={" "}
                            {t("Highly Effective")}
                          </p>
                          <div className="flex gap-2">
                            {["1", "2", "3", "4", "5"].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() =>
                                  updateSingleAssessmentField("controlEffectivenessScore", v)
                                }
                                className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                                  row.controlEffectivenessScore === v
                                    ? "bg-[#7c3f2f] border-[#7c3f2f] text-white"
                                    : "border-slate-200 text-slate-600 hover:border-[#c4896e] hover:bg-[#fdf6f2]"
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">{t("Mean Probability")}</span>
                            <span className="font-semibold text-slate-800">
                              {settingsMeanProbability > 0
                                ? settingsMeanProbability.toFixed(2)
                                : "–"}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">{t("Mean Impact")}</span>
                            <span className="font-semibold text-slate-800">
                              {settingsMeanImpact > 0 ? settingsMeanImpact.toFixed(2) : "–"}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">{t("Control Effectiveness")}</span>
                            <span className="font-semibold text-slate-800">
                              {row.controlEffectivenessScore
                                ? `${row.controlEffectivenessScore} – ${
                                    CE_LABELS[row.controlEffectivenessScore] ?? ""
                                  }`
                                : "–"}
                            </span>
                          </div>
                          <div className="border-t border-slate-200 pt-3 flex justify-between">
                            <span className="text-sm font-semibold text-slate-700">
                              {t("Calculated Risk Score")}
                            </span>
                            <span className="text-lg font-bold text-slate-900">
                              {settingsScore > 0 ? settingsScore.toFixed(2) : "–"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-slate-700">
                              {t("Risk Rating")}
                            </span>
                            {settingsRating.label !== "-" ? (
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${settingsRating.color}`}
                              >
                                {t(settingsRating.label)}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-sm">–</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 5: Summary */}
                    {assessmentStep === 5 && (
                      <div>
                        <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-4">
                          {t("SUMMARY")}
                        </p>
                        <div className="bg-slate-50 rounded-2xl p-5 space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t("Likelihood")}</span>
                            <span className="font-semibold text-slate-800">
                              {row.assessmentLikelihood || "–"}
                            </span>
                          </div>
                          {impactFields.map(({ field, label }) => (
                            <div key={field} className="flex justify-between">
                              <span className="text-slate-500">{label}</span>
                              <span className="font-semibold text-slate-800">
                                {row[field] || "–"}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t("Mean Impact")}</span>
                            <span className="font-semibold text-slate-800">
                              {meanImpact > 0 ? meanImpact.toFixed(2) : "–"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t("Control Effectiveness")}</span>
                            <span className="font-semibold text-slate-800">
                              {row.controlEffectivenessScore
                                ? `${row.controlEffectivenessScore} – ${
                                    CE_LABELS[row.controlEffectivenessScore] ?? ""
                                  }`
                                : "–"}
                            </span>
                          </div>
                          <div className="border-t border-slate-200 pt-3 flex justify-between">
                            <span className="font-semibold text-slate-700">{t("Risk Score")}</span>
                            <span className="text-lg font-bold text-slate-900">
                              {score > 0 ? score.toFixed(2) : "–"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-700">{t("Risk Rating")}</span>
                            {rating.label !== "-" ? (
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${rating.color}`}
                              >
                                {t(rating.label)}
                              </span>
                            ) : (
                              <span className="text-slate-400">–</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-100 bg-[#faf8f6] px-8 py-5 flex items-center justify-between flex-shrink-0">
                    <span className="text-sm text-[#c4896e] font-semibold">
                      {t("Step")} {assessmentStep} {t("of")} {TOTAL_STEPS}
                    </span>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="border-slate-200 text-slate-600 px-6"
                        onClick={() => {
                          if (assessmentStep > 1) {
                            const prevStep = assessmentStep - 1;
                            setAssessmentStep(prevStep);
                            saveProgress(prevStep, singleAssessmentRow, selectedAssessmentRisk.id);
                          } else {
                            setAssessmentDialogOpen(false);
                          }
                        }}
                      >
                        {assessmentStep === 1 ? t("Cancel") : t("Back")}
                      </Button>
                      {assessmentStep < TOTAL_STEPS ? (
                        <Button
                          className="bg-[#7c3f2f] hover:bg-[#6a3528] text-white px-6 gap-1"
                          onClick={() => {
                            const nextStep = assessmentStep + 1;
                            setAssessmentStep(nextStep);
                            saveProgress(nextStep, singleAssessmentRow, selectedAssessmentRisk.id);
                          }}
                        >
                          {t("Next")} <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          className="bg-[#7c3f2f] hover:bg-[#6a3528] text-white px-6"
                          onClick={handleSaveAssessment}
                          disabled={savingAssessment}
                        >
                          {savingAssessment ? (
                            <>
                              <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                              {t("Saving...")}
                            </>
                          ) : (
                            t("Save Assessment")
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InternalAuditRiskAssessmentPage() {
  return (
    <Suspense>
      <RiskAssessmentContent />
    </Suspense>
  );
}
