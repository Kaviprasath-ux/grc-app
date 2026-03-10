"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NotFound } from "@/components/ui/unauthorized";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Edit,
  AlertTriangle,
  Shield,
  Building2,
  User,
  Calendar,
  Plus,
  Trash2,
  Link2,
  Home,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, useTranslatedRecord, triggerTranslation } from "@/hooks/useTranslatedData";

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
  category: string | null;
  status: string;
  mitigationStatus: string | null;
  owner: string | null;
  dueDate: string | null;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  requirementRisks?: Array<{
    id: string;
    requirement: {
      id: string;
      code: string;
      name: string;
      status: string;
      framework?: { name: string } | null;
    };
  }>;
}

interface Department {
  id: string;
  name: string;
}

interface Requirement {
  id: string;
  code: string;
  name: string;
  status: string;
}

const statusColors: Record<string, string> = {
  Open: "bg-primary-50 text-primary-700",
  "In-Progress": "bg-yellow-100 text-yellow-800",
  Completed: "bg-green-100 text-green-800",
};

const riskRatingColors: Record<string, string> = {
  Catastrophic: "bg-red-600 text-white",
  "Very High": "bg-red-500 text-white",
  High: "bg-orange-500 text-white",
  Medium: "bg-yellow-500 text-black",
  Low: "bg-green-500 text-white",
  "Low Risk": "bg-green-500 text-white",
};

const requirementStatusColors: Record<string, string> = {
  Compliant: "bg-green-100 text-green-800",
  "Partially Compliant": "bg-yellow-100 text-yellow-800",
  "Non Compliant": "bg-red-100 text-red-800",
  "Not Applicable": "bg-slate-100 text-slate-800",
};

const categories = [
  "Strategic",
  "Operational",
  "Financial",
  "Compliance",
  "Technology",
  "Reputational",
];

const mitigationStatuses = [
  "Not Started",
  "In Progress",
  "Implemented",
  "Verified",
];

export default function RiskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { t } = useLanguage();

  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [linkRequirementDialogOpen, setLinkRequirementDialogOpen] = useState(false);

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
  const [availableRequirements, setAvailableRequirements] = useState<Requirement[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState("");

  const { data: tRisk } = useTranslatedRecord(risk, { modelName: 'Risk' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedRequirements } = useTranslatedData(availableRequirements, { modelName: 'QPostRequirement' });

  const fetchRisk = useCallback(async () => {
    try {
      const response = await fetch(`/api/qpost-compliance/risks/${id}`);
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
          category: data.category || "",
          status: data.status || "",
          mitigationStatus: data.mitigationStatus || "",
          owner: data.owner || "",
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
      const [departmentsRes, requirementsRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/qpost-compliance/requirements"),
      ]);

      if (departmentsRes.ok) {
        const deptData = await departmentsRes.json();
        setDepartments(Array.isArray(deptData) ? deptData : deptData.data || []);
      }
      if (requirementsRes.ok) {
        const reqData = await requirementsRes.json();
        setAvailableRequirements(Array.isArray(reqData) ? reqData : reqData.data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchRisk();
    fetchReferenceData();
  }, [fetchRisk, fetchReferenceData]);

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

      const response = await fetch(`/api/qpost-compliance/risks/${id}`, {
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
        triggerTranslation('Risk', id, { name: editForm.name, description: editForm.description });
        setEditDialogOpen(false);
        fetchRisk();
      }
    } catch (error) {
      console.error("Error updating risk:", error);
    }
  };

  const handleLinkRequirement = async () => {
    if (!selectedRequirementId) return;
    // This would need a dedicated API endpoint for linking
    setLinkRequirementDialogOpen(false);
    setSelectedRequirementId("");
    fetchRisk();
  };

  const handleUnlinkRequirement = async (requirementRiskId: string) => {
    // This would need a dedicated API endpoint for unlinking
    console.log("Unlink requirement risk:", requirementRiskId);
    fetchRisk();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!risk) {
    return <NotFound title={t("Risk Not Found")} backHref="/qpost-compliance/risk-matrix" />;
  }

  const linkedRequirements = risk.requirementRisks || [];
  const riskScore = risk.likelihood * risk.impact;
  const residualRiskScore = (risk.residualLikelihood && risk.residualImpact)
    ? risk.residualLikelihood * risk.residualImpact
    : null;

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/qpost-compliance/risk-matrix" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Requirement Matrix")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{tRisk?.riskId || risk.riskId}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold">{tRisk?.riskId || risk.riskId}</h1>
          <Badge
            className={riskRatingColors[risk.riskRating || "Low"]}
          >
            {risk.riskRating || "Low"}
          </Badge>
          <Badge className={statusColors[risk.status] || "bg-slate-100"}>
            {risk.status}
          </Badge>
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              {t("Edit")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("Edit Risk")}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label>{t("Name")}</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label>{t("Description")}</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label>{t("Likelihood (1-5)")}</Label>
                <Select
                  value={editForm.likelihood}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, likelihood: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t("1 - Rare")}</SelectItem>
                    <SelectItem value="2">{t("2 - Unlikely")}</SelectItem>
                    <SelectItem value="3">{t("3 - Possible")}</SelectItem>
                    <SelectItem value="4">{t("4 - Likely")}</SelectItem>
                    <SelectItem value="5">{t("5 - Almost Certain")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Impact (1-5)")}</Label>
                <Select
                  value={editForm.impact}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, impact: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t("1 - Insignificant")}</SelectItem>
                    <SelectItem value="2">{t("2 - Minor")}</SelectItem>
                    <SelectItem value="3">{t("3 - Moderate")}</SelectItem>
                    <SelectItem value="4">{t("4 - Major")}</SelectItem>
                    <SelectItem value="5">{t("5 - Catastrophic")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Residual Risk Section */}
              <div className="col-span-2 border-t pt-4 mt-2">
                <Label className="text-base font-semibold">{t("Residual Risk Assessment")}</Label>
                <p className="text-sm text-slate-500 mb-3">{t("After applying controls/mitigations")}</p>
              </div>
              <div>
                <Label>{t("Residual Likelihood (1-5)")}</Label>
                <Select
                  value={editForm.residualLikelihood}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, residualLikelihood: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select likelihood")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t("1 - Rare")}</SelectItem>
                    <SelectItem value="2">{t("2 - Unlikely")}</SelectItem>
                    <SelectItem value="3">{t("3 - Possible")}</SelectItem>
                    <SelectItem value="4">{t("4 - Likely")}</SelectItem>
                    <SelectItem value="5">{t("5 - Almost Certain")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Residual Impact (1-5)")}</Label>
                <Select
                  value={editForm.residualImpact}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, residualImpact: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select impact")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t("1 - Insignificant")}</SelectItem>
                    <SelectItem value="2">{t("2 - Minor")}</SelectItem>
                    <SelectItem value="3">{t("3 - Moderate")}</SelectItem>
                    <SelectItem value="4">{t("4 - Major")}</SelectItem>
                    <SelectItem value="5">{t("5 - Catastrophic")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 border-t pt-4 mt-2">
                <Label className="text-base font-semibold">{t("Other Details")}</Label>
              </div>
              <div>
                <Label>{t("Category")}</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Status")}</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">{t("Open")}</SelectItem>
                    <SelectItem value="In-Progress">{t("In-Progress")}</SelectItem>
                    <SelectItem value="Completed">{t("Completed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Mitigation Status")}</Label>
                <Select
                  value={editForm.mitigationStatus}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, mitigationStatus: value })
                  }
                >
                  <SelectTrigger>
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
              <div>
                <Label>{t("Owner")}</Label>
                <Input
                  value={editForm.owner}
                  onChange={(e) =>
                    setEditForm({ ...editForm, owner: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("Department")}</Label>
                <Select
                  value={editForm.departmentId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, departmentId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent>
                    {translatedDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Due Date")}</Label>
                <Input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, dueDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex ltr:justify-end rtl:justify-start gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                {t("Cancel")}
              </Button>
              <Button onClick={handleSave}>{t("Save Changes")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Inherent Risk Assessment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t("Inherent Risk Assessment")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <div className="text-center p-3 sm:p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">{t("Likelihood")}</p>
              <p className="text-2xl sm:text-3xl font-bold">{risk.likelihood}</p>
              <p className="text-xs text-slate-400">
                {risk.likelihood === 1
                  ? t("Rare")
                  : risk.likelihood === 2
                  ? t("Unlikely")
                  : risk.likelihood === 3
                  ? t("Possible")
                  : risk.likelihood === 4
                  ? t("Likely")
                  : t("Almost Certain")}
              </p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">{t("Impact")}</p>
              <p className="text-2xl sm:text-3xl font-bold">{risk.impact}</p>
              <p className="text-xs text-slate-400">
                {risk.impact === 1
                  ? t("Insignificant")
                  : risk.impact === 2
                  ? t("Minor")
                  : risk.impact === 3
                  ? t("Moderate")
                  : risk.impact === 4
                  ? t("Major")
                  : t("Catastrophic")}
              </p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">{t("Risk Score")}</p>
              <p className="text-2xl sm:text-3xl font-bold">{riskScore}</p>
              <p className="text-xs text-slate-400">{t("L x I")}</p>
            </div>
            <div
              className={`text-center p-3 sm:p-4 rounded-lg ${
                riskRatingColors[risk.riskRating || "Low"]
              } bg-opacity-20`}
            >
              <p className="text-sm opacity-80">{t("Risk Rating")}</p>
              <Badge className={riskRatingColors[risk.riskRating || "Low"]}>
                {risk.riskRating || t("Low")}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Residual Risk Assessment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("Residual Risk Assessment")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {risk.residualLikelihood && risk.residualImpact ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="text-center p-3 sm:p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">{t("Likelihood")}</p>
                <p className="text-2xl sm:text-3xl font-bold">{risk.residualLikelihood}</p>
                <p className="text-xs text-slate-400">
                  {risk.residualLikelihood === 1
                    ? t("Rare")
                    : risk.residualLikelihood === 2
                    ? t("Unlikely")
                    : risk.residualLikelihood === 3
                    ? t("Possible")
                    : risk.residualLikelihood === 4
                    ? t("Likely")
                    : t("Almost Certain")}
                </p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">{t("Impact")}</p>
                <p className="text-2xl sm:text-3xl font-bold">{risk.residualImpact}</p>
                <p className="text-xs text-slate-400">
                  {risk.residualImpact === 1
                    ? t("Insignificant")
                    : risk.residualImpact === 2
                    ? t("Minor")
                    : risk.residualImpact === 3
                    ? t("Moderate")
                    : risk.residualImpact === 4
                    ? t("Major")
                    : t("Catastrophic")}
                </p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">{t("Risk Score")}</p>
                <p className="text-2xl sm:text-3xl font-bold">{residualRiskScore}</p>
                <p className="text-xs text-slate-400">{t("L x I")}</p>
              </div>
              <div
                className={`text-center p-3 sm:p-4 rounded-lg ${
                  riskRatingColors[risk.residualRiskRating || "Low"]
                } bg-opacity-20`}
              >
                <p className="text-sm opacity-80">{t("Risk Rating")}</p>
                <Badge className={riskRatingColors[risk.residualRiskRating || "Low"]}>
                  {risk.residualRiskRating || t("Low")}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p>{t("No residual risk assessment available")}</p>
              <p className="text-sm mt-1">{t("Edit the risk to add residual risk values")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Risk Details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-500">{t("Category")}</Label>
                <p className="font-medium">{(tRisk?.category || risk.category) ? t(tRisk?.category || risk.category!) : "-"}</p>
              </div>
              <div>
                <Label className="text-slate-500">{t("Mitigation Status")}</Label>
                <p className="font-medium">{(tRisk?.mitigationStatus || risk.mitigationStatus) ? t(tRisk?.mitigationStatus || risk.mitigationStatus!) : "-"}</p>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <div>
                  <Label className="text-slate-500">{t("Owner")}</Label>
                  <p className="font-medium">{tRisk?.owner || risk.owner || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                <div>
                  <Label className="text-slate-500">{t("Department")}</Label>
                  <p className="font-medium">{tRisk?.department?.name || risk.department?.name || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <div>
                  <Label className="text-slate-500">{t("Due Date")}</Label>
                  <p className="font-medium">
                    {(tRisk?.dueDate || risk.dueDate)
                      ? new Date((tRisk?.dueDate || risk.dueDate)!).toLocaleDateString()
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Description")}</CardTitle>
          </CardHeader>
          <CardContent>
            {(tRisk?.description || risk.description) ? (
              <p className="whitespace-pre-wrap">{tRisk?.description || risk.description}</p>
            ) : (
              <p className="text-slate-500 italic">{t("No description provided")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linked Requirements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("Linked Requirements")}
          </CardTitle>
          <Dialog
            open={linkRequirementDialogOpen}
            onOpenChange={setLinkRequirementDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("Link Requirement")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("Link Requirement to Risk")}</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Label>{t("Select Requirement")}</Label>
                <Select
                  value={selectedRequirementId}
                  onValueChange={setSelectedRequirementId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select a requirement")} />
                  </SelectTrigger>
                  <SelectContent>
                    {translatedRequirements
                      .filter(
                        (r) =>
                          !linkedRequirements.find((lr) => lr.requirement.id === r.id)
                      )
                      .map((requirement) => (
                        <SelectItem key={requirement.id} value={requirement.id}>
                          {requirement.code} - {requirement.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex ltr:justify-end rtl:justify-start gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLinkRequirementDialogOpen(false)}
                >
                  {t("Cancel")}
                </Button>
                <Button onClick={handleLinkRequirement}>{t("Link")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {linkedRequirements.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t("No requirements linked to this risk")}</p>
              <p className="text-sm mt-1">
                {t("Link requirements to show how this risk is being mitigated")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Requirement Code")}</TableHead>
                  <TableHead>{t("Name")}</TableHead>
                  <TableHead>{t("Framework")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead className="w-[80px]">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedRequirements.map((rr) => (
                  <TableRow key={rr.id}>
                    <TableCell className="font-medium">
                      {rr.requirement.code}
                    </TableCell>
                    <TableCell>{rr.requirement.name}</TableCell>
                    <TableCell>{rr.requirement.framework?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          requirementStatusColors[rr.requirement.status] ||
                          "bg-slate-100"
                        }
                      >
                        {rr.requirement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            router.push(`/qpost-compliance/requirements/${rr.requirement.id}`)
                          }
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnlinkRequirement(rr.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Matrix Position */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Position in Risk Matrix")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <div className="relative">
              <table className="border-collapse">
                <tbody>
                  {[5, 4, 3, 2, 1].map((l) => (
                    <tr key={l}>
                      {[1, 2, 3, 4, 5].map((i) => {
                        const score = l * i;
                        const isCurrentPosition =
                          l === risk.likelihood && i === risk.impact;
                        let bgColor = "bg-green-500";
                        if (score >= 20) bgColor = "bg-red-600";
                        else if (score >= 12) bgColor = "bg-orange-500";
                        else if (score >= 6) bgColor = "bg-yellow-400";

                        return (
                          <td
                            key={i}
                            className={`w-12 h-12 border ${bgColor} ${
                              isCurrentPosition
                                ? "ring-4 ring-black ring-inset"
                                : "bg-opacity-60"
                            }`}
                          >
                            {isCurrentPosition && (
                              <div className="flex items-center justify-center h-full">
                                <AlertTriangle className="h-6 w-6 text-white drop-shadow" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-sm text-slate-500">
                {t("Likelihood")}
              </div>
              <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 text-sm text-slate-500">
                {t("Impact")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
