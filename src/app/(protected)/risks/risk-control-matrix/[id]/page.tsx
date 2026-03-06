"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Home,
  ChevronRight,
  Pencil,
  AlertTriangle,
  Shield,
  Building2,
  User,
  Calendar,
  Plus,
  Trash2,
  Link2,
  FileText,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedRecord, useTranslatedData } from "@/hooks/useTranslatedData";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  likelihood: number;
  impact: number;
  riskRating: string | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualRiskRating: string | null;
  category: { id: string; name: string; color?: string; status?: string } | null;
  status: string;
  mitigationStatus: string | null;
  owner: { id: string; fullName: string; email: string } | null;
  dueDate: string | null;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  controlRisks?: Array<{
    id: string;
    control: {
      id: string;
      controlId: string;
      name: string;
      status: string;
      domain?: { name: string } | null;
    };
  }>;
}

interface Department {
  id: string;
  name: string;
}

interface Control {
  id: string;
  controlId: string;
  name: string;
  status: string;
}

const riskRatingColors: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border-red-200",
  Catastrophic: "bg-red-50 text-red-700 border-red-200",
  "Very High": "bg-red-50 text-red-700 border-red-200",
  High: "bg-amber-50 text-amber-700 border-amber-200",
  Medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Low Risk": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const statusColors: Record<string, string> = {
  Open: "bg-primary-50 text-primary-700 border-primary-200",
  "In-Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const controlStatusColors: Record<string, string> = {
  Implemented: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Planned: "bg-primary-50 text-primary-700 border-primary-200",
  "Not Implemented": "bg-slate-50 text-slate-600 border-slate-200",
};

const defaultMitigationStatuses = [
  "Not Started",
  "In Progress",
  "Implemented",
  "Verified",
];

interface RiskSettingOption {
  key: string;
  label: string;
  description?: string;
  value: string;
}

interface RiskSettings {
  likelihood_scale: RiskSettingOption[];
  impact_scale: RiskSettingOption[];
}

interface RiskCategory {
  id: string;
  name: string;
}

export default function RiskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { canView, isLoading: permissionsLoading } = usePermissions('risk.risk-matrix');
  const { t } = useLanguage();

  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    likelihood: "",
    impact: "",
    residualLikelihood: "",
    residualImpact: "",
    category: "",
    status: "",
    mitigationStatus: "",
    owner: "",
    dueDate: "",
    departmentId: "",
  });

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableControls, setAvailableControls] = useState<Control[]>([]);
  const [selectedControlId, setSelectedControlId] = useState("");

  // Dynamic settings from API
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [likelihoodOptions, setLikelihoodOptions] = useState<{ label: string; value: number }[]>([]);
  const [impactOptions, setImpactOptions] = useState<{ label: string; value: number }[]>([]);
  const [mitigationStatuses] = useState(defaultMitigationStatuses);

  const getLikelihoodLabel = (value: number): string => {
    const option = likelihoodOptions.find(o => o.value === value);
    return option?.label || `Level ${value}`;
  };

  const getImpactLabel = (value: number): string => {
    const option = impactOptions.find(o => o.value === value);
    return option?.label || `Level ${value}`;
  };

  const fetchRisk = useCallback(async () => {
    try {
      const response = await fetch(`/api/risks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRisk(data);
        setEditForm({
          name: data.name || "",
          description: data.description || "",
          likelihood: data.likelihood?.toString() || "",
          impact: data.impact?.toString() || "",
          residualLikelihood: data.residualLikelihood?.toString() || "",
          residualImpact: data.residualImpact?.toString() || "",
          category: data.category?.name || "",
          status: data.status || "",
          mitigationStatus: data.mitigationStatus || "",
          owner: data.owner?.fullName || "",
          dueDate: data.dueDate?.split("T")[0] || "",
          departmentId: data.departmentId || "",
        });
      }
    } catch (error) {
      console.error("Error fetching risk:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [departmentsRes, controlsRes, categoriesRes, settingsRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/controls"),
        fetch("/api/risk-categories"),
        fetch("/api/risk-settings"),
      ]);

      if (departmentsRes.ok) {
        const deptData = await departmentsRes.json();
        setDepartments(Array.isArray(deptData) ? deptData : deptData.data || []);
      }
      if (controlsRes.ok) {
        const ctrlData = await controlsRes.json();
        const allControls = Array.isArray(ctrlData) ? ctrlData : ctrlData.data || [];
        // Only show Compliant controls for linking
        setAvailableControls(allControls.filter((c: { status?: string }) => c.status === "Compliant"));
      }
      if (categoriesRes.ok) {
        const catData = await categoriesRes.json();
        setCategories(Array.isArray(catData) ? catData : catData.data || []);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const defaults = settingsData.defaults as RiskSettings | undefined;

        if (defaults) {
          if (defaults.likelihood_scale && defaults.likelihood_scale.length > 0) {
            setLikelihoodOptions(defaults.likelihood_scale.map(opt => ({
              label: opt.label,
              value: parseInt(opt.value) || parseInt(opt.key),
            })));
          }
          if (defaults.impact_scale && defaults.impact_scale.length > 0) {
            setImpactOptions(defaults.impact_scale.map(opt => ({
              label: opt.label,
              value: parseInt(opt.value) || parseInt(opt.key),
            })));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchRisk();
    fetchReferenceData();
  }, [fetchRisk, fetchReferenceData]);

  // Translate dynamic data
  const { data: translatedRisk } = useTranslatedRecord(risk, { modelName: 'Risk' });
  const { data: translatedCategories } = useTranslatedData(categories, { modelName: 'RiskCategory' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const controlsList = useMemo(() =>
    risk?.controlRisks?.map(cr => ({ id: cr.control.id, name: cr.control.name })) || [],
    [risk?.controlRisks]
  );
  const { data: translatedControls } = useTranslatedData(controlsList, { modelName: 'Control' });

  const calculateRiskRating = (likelihood: number, impact: number): string => {
    const score = likelihood * impact;
    if (score >= 20) return "Critical";
    if (score >= 12) return "High";
    if (score >= 6) return "Medium";
    return "Low";
  };

  const handleSave = async () => {
    try {
      const likelihood = parseInt(editForm.likelihood);
      const impact = parseInt(editForm.impact);
      const riskRating = calculateRiskRating(likelihood, impact);

      const residualLikelihood = editForm.residualLikelihood ? parseInt(editForm.residualLikelihood) : null;
      const residualImpact = editForm.residualImpact ? parseInt(editForm.residualImpact) : null;
      const residualRiskRating = residualLikelihood && residualImpact
        ? calculateRiskRating(residualLikelihood, residualImpact)
        : null;

      const response = await fetch(`/api/risks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          likelihood,
          impact,
          riskRating,
          residualLikelihood,
          residualImpact,
          residualRiskRating,
          departmentId: editForm.departmentId || null,
          dueDate: editForm.dueDate || null,
        }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        fetchRisk();
      }
    } catch (error) {
      console.error("Error updating risk:", error);
    }
  };

  const handleLinkControl = async () => {
    if (!selectedControlId) return;
    setLinkControlDialogOpen(false);
    setSelectedControlId("");
    fetchRisk();
  };

  const handleUnlinkControl = async (controlRiskId: string) => {
    console.log("Unlink control risk:", controlRiskId);
    fetchRisk();
  };

  // Loading state
  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Risk Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Risk Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/risk-control-matrix" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Risk Control Matrix")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Loading...")}</span>
        </nav>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Risk Control Matrix.")} />;
  }

  if (!risk) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Risk Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Risk Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/risk-control-matrix" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Risk Control Matrix")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Not Found")}</span>
        </nav>
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <AlertTriangle className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">{t("Risk not found")}</p>
        </div>
      </div>
    );
  }

  const linkedControls = risk.controlRisks || [];
  const riskScore = risk.likelihood * risk.impact;
  const residualRiskScore = (risk.residualLikelihood && risk.residualImpact)
    ? risk.residualLikelihood * risk.residualImpact
    : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/risk-control-matrix" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Control Matrix")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{risk.riskId}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{risk.riskId}</h1>
          <Badge variant="outline" className={riskRatingColors[risk.riskRating || "Low"]}>
            {t(risk.riskRating || "Low")}
          </Badge>
          <Badge variant="outline" className={statusColors[risk.status] || "bg-slate-50 text-slate-600 border-slate-200"}>
            {t(risk.status)}
          </Badge>
        </div>

        <PermissionGate resource="risk.risk-matrix" action="edit">
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary-600 hover:bg-primary-700">
                <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Edit")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader className="px-4 sm:px-6 py-5 border-b border-slate-100">
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Risk")}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Name")}</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Description")}</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Likelihood")}</Label>
                    <Select
                      value={editForm.likelihood}
                      onValueChange={(value) => setEditForm({ ...editForm, likelihood: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select likelihood")} />
                      </SelectTrigger>
                      <SelectContent>
                        {likelihoodOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.value} - {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Impact")}</Label>
                    <Select
                      value={editForm.impact}
                      onValueChange={(value) => setEditForm({ ...editForm, impact: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select impact")} />
                      </SelectTrigger>
                      <SelectContent>
                        {impactOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.value} - {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Residual Risk Section */}
                  <div className="pt-4 mt-2">
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-sm font-semibold text-slate-700">{t("Residual Risk Assessment")}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{t("After applying controls/mitigations")}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Residual Likelihood")}</Label>
                    <Select
                      value={editForm.residualLikelihood}
                      onValueChange={(value) => setEditForm({ ...editForm, residualLikelihood: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select likelihood")} />
                      </SelectTrigger>
                      <SelectContent>
                        {likelihoodOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.value} - {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Residual Impact")}</Label>
                    <Select
                      value={editForm.residualImpact}
                      onValueChange={(value) => setEditForm({ ...editForm, residualImpact: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select impact")} />
                      </SelectTrigger>
                      <SelectContent>
                        {impactOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.value} - {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Other Details Section */}
                  <div className="pt-4 mt-2">
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-sm font-semibold text-slate-700">{t("Other Details")}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Category")}</Label>
                    <Select
                      value={editForm.category}
                      onValueChange={(value) => setEditForm({ ...editForm, category: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Status")}</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select status")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">{t("Open")}</SelectItem>
                        <SelectItem value="In-Progress">{t("In-Progress")}</SelectItem>
                        <SelectItem value="Completed">{t("Completed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Mitigation Status")}</Label>
                    <Select
                      value={editForm.mitigationStatus}
                      onValueChange={(value) => setEditForm({ ...editForm, mitigationStatus: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select status")} />
                      </SelectTrigger>
                      <SelectContent>
                        {mitigationStatuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Owner")}</Label>
                    <Input
                      value={editForm.owner}
                      onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Department")}</Label>
                    <Select
                      value={editForm.departmentId}
                      onValueChange={(value) => setEditForm({ ...editForm, departmentId: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Due Date")}</Label>
                    <DatePicker
                      value={editForm.dueDate || undefined}
                      onChange={(date) => setEditForm({ ...editForm, dueDate: date ? date.toISOString().split("T")[0] : "" })}
                      placeholder={t("Select due date")}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="flex flex-row items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  {t("Cancel")}
                </Button>
                <Button onClick={handleSave} className="bg-primary-600 hover:bg-primary-700">
                  {t("Save Changes")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {/* Risk Assessment Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Inherent Risk Assessment */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            
            <h3 className="text-sm font-semibold text-slate-800">{t("Inherent Risk Assessment")}</h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Likelihood")}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{risk.likelihood}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{getLikelihoodLabel(risk.likelihood)}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Impact")}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{risk.impact}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{getImpactLabel(risk.impact)}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Score")}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{riskScore}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{t("L x I")}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Rating")}</p>
                <div className="mt-2">
                  <Badge variant="outline" className={riskRatingColors[risk.riskRating || "Low"]}>
                    {t(risk.riskRating || "Low")}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Residual Risk Assessment */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            
            <h3 className="text-sm font-semibold text-slate-800">{t("Residual Risk Assessment")}</h3>
          </div>
          <div className="p-5">
            {risk.residualLikelihood && risk.residualImpact ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Likelihood")}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{risk.residualLikelihood}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{getLikelihoodLabel(risk.residualLikelihood)}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Impact")}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{risk.residualImpact}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{getImpactLabel(risk.residualImpact)}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Score")}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{residualRiskScore}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t("L x I")}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Rating")}</p>
                  <div className="mt-2">
                    <Badge variant="outline" className={riskRatingColors[risk.residualRiskRating || "Low"]}>
                      {t(risk.residualRiskRating || "Low")}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-primary-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">{t("No residual risk assessment available")}</p>
                <p className="text-xs text-slate-400">{t("Edit the risk to add residual risk values")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Risk Details */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            
            <h3 className="text-sm font-semibold text-slate-800">{t("Risk Details")}</h3>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">{t("Category")}</span>
                <span className="text-sm font-medium text-slate-800">{risk.category ? (translatedCategories.find(c => c.id === risk.category?.id)?.name || risk.category.name) : "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">{t("Mitigation Status")}</span>
                <span className="text-sm font-medium text-slate-800">{risk.mitigationStatus ? t(risk.mitigationStatus) : "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <div className="flex items-center gap-2 text-sm text-slate-500">

                  <span>{t("Owner")}</span>
                </div>
                <span className="text-sm font-medium text-slate-800">{translatedRisk?.owner?.fullName || risk.owner?.fullName || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <div className="flex items-center gap-2 text-sm text-slate-500">

                  <span>{t("Department")}</span>
                </div>
                <span className="text-sm font-medium text-slate-800">{risk.department ? (translatedDepartments.find(d => d.id === risk.department?.id)?.name || risk.department.name) : "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  
                  <span>{t("Due Date")}</span>
                </div>
                <span className="text-sm font-medium text-slate-800 ">
                  {risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description + Matrix */}
        <div className="space-y-5">
          {/* Description */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              
              <h3 className="text-sm font-semibold text-slate-800">{t("Description")}</h3>
            </div>
            <div className="p-5">
              {(translatedRisk?.description || risk.description) ? (
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{translatedRisk?.description || risk.description}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">{t("No description provided")}</p>
              )}
            </div>
          </div>

          {/* Risk Matrix Position */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              
              <h3 className="text-sm font-semibold text-slate-800">{t("Matrix Position")}</h3>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <table className="border-collapse">
                    <tbody>
                      {[5, 4, 3, 2, 1].map((l) => (
                        <tr key={l}>
                          {[1, 2, 3, 4, 5].map((i) => {
                            const score = l * i;
                            const isCurrentPosition = l === risk.likelihood && i === risk.impact;
                            let bgColor = "bg-emerald-400";
                            if (score >= 20) bgColor = "bg-red-400";
                            else if (score >= 12) bgColor = "bg-amber-400";
                            else if (score >= 6) bgColor = "bg-yellow-300";

                            return (
                              <td
                                key={i}
                                className={`w-10 h-10 border border-white/40 ${bgColor} ${
                                  isCurrentPosition
                                    ? "ring-2 ring-slate-800 ring-inset"
                                    : "opacity-60"
                                }`}
                              >
                                {isCurrentPosition && (
                                  <div className="flex items-center justify-center h-full">
                                    <div className="w-3 h-3 rounded-full bg-slate-800" />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="absolute ltr:-left-11 rtl:-right-11 top-1/2 -translate-y-1/2 ltr:-rotate-90 rtl:rotate-90 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    {t("Likelihood")}
                  </div>
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    {t("Impact")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mitigating Controls */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            
            <h3 className="text-sm font-semibold text-slate-800">{t("Mitigating Controls")}</h3>
            <span className="text-xs text-slate-400 ltr:ml-1 rtl:mr-1">({linkedControls.length})</span>
          </div>
          <PermissionGate resource="risk.risk-matrix" action="edit">
            <Dialog open={linkControlDialogOpen} onOpenChange={setLinkControlDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-slate-200">
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Link Control")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[600px] p-0 gap-0">
                <DialogHeader className="px-4 sm:px-6 py-5 border-b border-slate-100">
                  <DialogTitle className="text-lg font-semibold text-slate-800">{t("Link Control to Risk")}</DialogTitle>
                </DialogHeader>
                <div className="px-4 sm:px-6 py-4 sm:py-5">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">{t("Select Control")}</Label>
                    <Select value={selectedControlId} onValueChange={setSelectedControlId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select a control")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableControls
                          .filter((c) => !linkedControls.find((lc) => lc.control.id === c.id))
                          .map((control) => (
                            <SelectItem key={control.id} value={control.id}>
                              {control.controlId} - {control.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="flex flex-row items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                  <Button variant="outline" onClick={() => setLinkControlDialogOpen(false)}>
                    {t("Cancel")}
                  </Button>
                  <Button onClick={handleLinkControl} className="bg-primary-600 hover:bg-primary-700">
                    {t("Link")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>

        {linkedControls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
              <Link2 className="h-6 w-6 text-primary-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">{t("No controls linked to this risk")}</p>
            <p className="text-xs text-slate-400">{t("Link controls to show how this risk is being mitigated")}</p>
          </div>
        ) : (
          <>
            {/* Controls Table Header */}
            <div className="overflow-x-auto">
            <div className="grid grid-cols-[100px_1.5fr_1fr_100px_60px] gap-2 sm:gap-4 px-3 sm:px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider min-w-[500px]">
              <span>{t("Control ID")}</span>
              <span>{t("Name")}</span>
              <span>{t("Domain")}</span>
              <span>{t("Status")}</span>
              <span></span>
            </div>
            {/* Controls Rows */}
            <div className="divide-y divide-slate-100">
              {linkedControls.map((cr) => (
                <div
                  key={cr.id}
                  className="grid grid-cols-[100px_1.5fr_1fr_100px_60px] gap-2 sm:gap-4 px-3 sm:px-5 py-3 items-center hover:bg-slate-50/60 transition-colors min-w-[500px]"
                >
                  <span className="text-sm font-medium text-slate-800">{cr.control.controlId}</span>
                  <span className="text-sm text-slate-600 truncate">{translatedControls.find(c => c.id === cr.control.id)?.name || cr.control.name}</span>
                  <span className="text-sm text-slate-500 truncate">{cr.control.domain?.name || "-"}</span>
                  <div>
                    <Badge variant="outline" className={`text-[11px] ${controlStatusColors[cr.control.status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {t(cr.control.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/compliance/control/${cr.control.id}`)}
                      className="h-7 w-7 text-slate-400 hover:text-primary-600"
                    >
                      <Shield className="h-3.5 w-3.5" />
                    </Button>
                    <PermissionGate resource="risk.risk-matrix" action="edit">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUnlinkControl(cr.id)}
                        className="h-7 w-7 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
