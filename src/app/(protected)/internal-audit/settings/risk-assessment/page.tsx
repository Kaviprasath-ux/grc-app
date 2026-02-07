"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ArrowUpDown, Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RiskFactor {
  id: string;
  label: string;
}

interface Probability {
  id: string;
  label: string;
  value: number;
}

interface Impact {
  id: string;
  label: string;
  value: number;
}

interface ScoringRange {
  id: string;
  label: string;
  lowValue: number;
  highValue: number | null;
  calculationType: string;
}

interface ScoringConfig {
  id: string;
  probabilityImpactCalcType: string;
  riskRatingCalcType: string;
}

const CALCULATION_TYPES = [
  { value: "High of all", label: "High of all" },
  { value: "Addition of all", label: "Addition of all" },
  { value: "Product of all", label: "Product of all" },
];

export default function RiskAssessmentConfigPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [loading, setLoading] = useState(true);

  // Data states
  const [factors, setFactors] = useState<RiskFactor[]>([]);
  const [probabilities, setProbabilities] = useState<Probability[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const [scoringRanges, setScoringRanges] = useState<ScoringRange[]>([]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig | null>(null);

  // Sort states
  const [factorSortOrder, setFactorSortOrder] = useState<"asc" | "desc">("asc");
  const [probabilitySortOrder, setProbabilitySortOrder] = useState<"asc" | "desc">("asc");
  const [impactSortOrder, setImpactSortOrder] = useState<"asc" | "desc">("asc");
  const [scoringRangeSortOrder, setScoringRangeSortOrder] = useState<"asc" | "desc">("asc");

  // Dialog states
  const [dialogType, setDialogType] = useState<"factor" | "probability" | "impact" | "scoringRange" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; item: any } | null>(null);

  // Validation error
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [factorsRes, probabilitiesRes, impactsRes, scoringRangesRes, configRes] = await Promise.all([
        fetch("/api/internal-audit/risk-factors"),
        fetch("/api/internal-audit/probability"),
        fetch("/api/internal-audit/impact"),
        fetch("/api/internal-audit/scoring-ranges"),
        fetch("/api/internal-audit/scoring-config"),
      ]);

      if (factorsRes.ok) setFactors(await factorsRes.json());
      if (probabilitiesRes.ok) setProbabilities(await probabilitiesRes.json());
      if (impactsRes.ok) setImpacts(await impactsRes.json());
      if (scoringRangesRes.ok) setScoringRanges(await scoringRangesRes.json());
      if (configRes.ok) setScoringConfig(await configRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Sort handlers
  const handleSortFactors = () => {
    const newOrder = factorSortOrder === "asc" ? "desc" : "asc";
    setFactorSortOrder(newOrder);
    const sorted = [...factors].sort((a, b) =>
      newOrder === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)
    );
    setFactors(sorted);
  };

  const handleSortProbabilities = () => {
    const newOrder = probabilitySortOrder === "asc" ? "desc" : "asc";
    setProbabilitySortOrder(newOrder);
    const sorted = [...probabilities].sort((a, b) =>
      newOrder === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)
    );
    setProbabilities(sorted);
  };

  const handleSortImpacts = () => {
    const newOrder = impactSortOrder === "asc" ? "desc" : "asc";
    setImpactSortOrder(newOrder);
    const sorted = [...impacts].sort((a, b) =>
      newOrder === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)
    );
    setImpacts(sorted);
  };

  const handleSortScoringRanges = () => {
    const newOrder = scoringRangeSortOrder === "asc" ? "desc" : "asc";
    setScoringRangeSortOrder(newOrder);
    const sorted = [...scoringRanges].sort((a, b) =>
      newOrder === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)
    );
    setScoringRanges(sorted);
  };

  // Dialog handlers
  const openAddDialog = (type: "factor" | "probability" | "impact" | "scoringRange") => {
    setDialogType(type);
    setEditItem(null);
    setValidationError(null);
    if (type === "factor") {
      setFormData({ label: "" });
    } else if (type === "probability" || type === "impact") {
      setFormData({ label: "", value: 0 });
    } else if (type === "scoringRange") {
      setFormData({ label: "", lowValue: 0, highValue: 0 });
    }
    setDialogOpen(true);
  };

  const openEditDialog = (type: "factor" | "probability" | "impact" | "scoringRange", item: any) => {
    setDialogType(type);
    setEditItem(item);
    setValidationError(null);
    if (type === "factor") {
      setFormData({ label: item.label });
    } else if (type === "probability" || type === "impact") {
      setFormData({ label: item.label, value: item.value });
    } else if (type === "scoringRange") {
      setFormData({ label: item.label, lowValue: item.lowValue, highValue: item.highValue || 0 });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.label?.trim()) return;

    // Validate scoring range: highest value must be greater than lowest value
    if (dialogType === "scoringRange") {
      const lowValue = Number(formData.lowValue) || 0;
      const highValue = Number(formData.highValue) || 0;
      if (highValue <= lowValue) {
        setValidationError(t("Highest value must be greater than lowest value"));
        return;
      }
    }

    setValidationError(null);
    setSaving(true);
    try {
      let url = "";
      let method = editItem ? "PUT" : "POST";
      let body: any = {};

      switch (dialogType) {
        case "factor":
          url = editItem ? `/api/internal-audit/risk-factors/${editItem.id}` : "/api/internal-audit/risk-factors";
          body = { label: formData.label };
          break;
        case "probability":
          url = editItem ? `/api/internal-audit/probability/${editItem.id}` : "/api/internal-audit/probability";
          body = { label: formData.label, value: Number(formData.value) || 0 };
          break;
        case "impact":
          url = editItem ? `/api/internal-audit/impact/${editItem.id}` : "/api/internal-audit/impact";
          body = { label: formData.label, value: Number(formData.value) || 0 };
          break;
        case "scoringRange":
          url = editItem ? `/api/internal-audit/scoring-ranges/${editItem.id}` : "/api/internal-audit/scoring-ranges";
          body = {
            label: formData.label,
            lowValue: Number(formData.lowValue) || 0,
            highValue: Number(formData.highValue) || 0,
            calculationType: scoringConfig?.riskRatingCalcType || "High of all",
          };
          break;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchAllData();
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (type: string, item: any) => {
    setItemToDelete({ type, item });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      let url = "";
      switch (itemToDelete.type) {
        case "factor":
          url = `/api/internal-audit/risk-factors/${itemToDelete.item.id}`;
          break;
        case "probability":
          url = `/api/internal-audit/probability/${itemToDelete.item.id}`;
          break;
        case "impact":
          url = `/api/internal-audit/impact/${itemToDelete.item.id}`;
          break;
        case "scoringRange":
          url = `/api/internal-audit/scoring-ranges/${itemToDelete.item.id}`;
          break;
      }

      const response = await fetch(url, { method: "DELETE" });

      if (response.ok) {
        fetchAllData();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleConfigChange = async (field: string, value: string) => {
    try {
      const response = await fetch("/api/internal-audit/scoring-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        const updated = await response.json();
        setScoringConfig(updated);
      }
    } catch (error) {
      console.error("Failed to update config:", error);
    }
  };

  const getDialogTitle = () => {
    switch (dialogType) {
      case "factor": return editItem ? t("Edit Factor") : t("Add Factor");
      case "probability": return editItem ? t("Edit Probability") : t("Add Probability");
      case "impact": return editItem ? t("Edit Impact") : t("Add Impact");
      case "scoringRange": return editItem ? t("Edit Risk Score Range") : t("Add Scoring Range");
      default: return "";
    }
  };

  if (loading) {
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
          <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Risk Assessment")}</span>
        </nav>

        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Assessment Configuration")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading configuration...")}</p>
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
        <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Risk Assessment")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Assessment Configuration")}</h1>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Factors Section */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Factors")}</h3>
            <Button size="sm" onClick={() => openAddDialog("factor")}>
              <Plus className="h-4 w-4 mr-2" />
              {t("New Factor")}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Label")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 w-[80px]">{t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factors.map((item) => (
                <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm text-slate-800 pl-5">{item.label}</TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openEditDialog("factor", item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => openDeleteDialog("factor", item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {factors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center text-sm text-slate-500">
                    {t("No factors found")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Probability Section */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Probability")}</h3>
            <Button size="sm" onClick={() => openAddDialog("probability")}>
              <Plus className="h-4 w-4 mr-2" />
              {t("New Probability")}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Label")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Value")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 w-[80px]">{t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {probabilities.map((item) => (
                <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm text-slate-800 pl-5">{item.label}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{item.value}</TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openEditDialog("probability", item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => openDeleteDialog("probability", item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {probabilities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-sm text-slate-500">
                    {t("No probabilities found")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Impact Section */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Impact")}</h3>
            <Button size="sm" onClick={() => openAddDialog("impact")}>
              <Plus className="h-4 w-4 mr-2" />
              {t("New Impact")}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Label")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Value")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 w-[80px]">{t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {impacts.map((item) => (
                <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm text-slate-800 pl-5">{item.label}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{item.value}</TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openEditDialog("impact", item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => openDeleteDialog("impact", item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {impacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-sm text-slate-500">
                    {t("No impacts found")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Scoring Configuration Section */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Scoring Configuration")}</h3>
          </div>
          <div className="p-5 space-y-6">
            {/* Probability-Impact Scoring Calculation */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Probability-Impact Calculation")}</Label>
              <Select
                value={scoringConfig?.probabilityImpactCalcType || "Product of all"}
                onValueChange={(value) => handleConfigChange("probabilityImpactCalcType", value)}
              >
                <SelectTrigger className="w-full max-w-sm bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALCULATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(type.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Risk Rating Scoring Calculation */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Risk Rating Calculation")}</Label>
              <Select
                value={scoringConfig?.riskRatingCalcType || "Product of all"}
                onValueChange={(value) => handleConfigChange("riskRatingCalcType", value)}
              >
                <SelectTrigger className="w-full max-w-sm bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALCULATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(type.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scoring Range */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-slate-700">{t("Scoring Range")}</Label>
                <Button size="sm" onClick={() => openAddDialog("scoringRange")}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("New Range")}
                </Button>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Label")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Low")}</TableHead>
                      {scoringConfig?.riskRatingCalcType !== "High of all" && (
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("High")}</TableHead>
                      )}
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 w-[80px]">{t("Action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoringRanges
                      .filter((item) => item.calculationType === scoringConfig?.riskRatingCalcType)
                      .map((item) => (
                        <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                          <TableCell className="py-3 text-sm text-slate-800 pl-5">{item.label}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-600">{item.lowValue}</TableCell>
                          {scoringConfig?.riskRatingCalcType !== "High of all" && (
                            <TableCell className="py-3 text-sm text-slate-600">{item.highValue ?? "-"}</TableCell>
                          )}
                          <TableCell className="py-3 pr-5">
                            <div className="flex items-center gap-0.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openEditDialog("scoringRange", item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => openDeleteDialog("scoringRange", item)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {scoringRanges.filter((item) => item.calculationType === scoringConfig?.riskRatingCalcType).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={scoringConfig?.riskRatingCalcType === "High of all" ? 3 : 4} className="h-24 text-center text-sm text-slate-500">
                          {t("No scoring ranges found")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{getDialogTitle()}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            {dialogType === "factor" && (
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.label || ""}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder={t("Enter factor label")}
                  className="mt-1.5 w-full bg-white"
                  autoFocus
                />
              </div>
            )}
            {(dialogType === "probability" || dialogType === "impact") && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.label || ""}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder={t("Enter label")}
                    className="mt-1.5 w-full bg-white"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Value")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={formData.value || 0}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder={t("Enter value")}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>
            )}
            {dialogType === "scoringRange" && (
              <>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.label || ""}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder={t("Enter scoring range label")}
                    className="mt-1.5 w-full bg-white"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Lowest Value")} <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={formData.lowValue || 0}
                      onChange={(e) => {
                        setFormData({ ...formData, lowValue: e.target.value });
                        setValidationError(null);
                      }}
                      placeholder={t("Enter lowest value")}
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Highest Value")} <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={formData.highValue || 0}
                      onChange={(e) => {
                        setFormData({ ...formData, highValue: e.target.value });
                        setValidationError(null);
                      }}
                      placeholder={t("Enter highest value")}
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                </div>
                {validationError && (
                  <p className="text-sm text-red-500">{validationError}</p>
                )}
              </>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.label?.trim()}>
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[400px] p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete this item? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel className="mt-0">{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
