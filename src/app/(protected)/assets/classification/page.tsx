"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Sparkles, Search, Download, Upload, Home, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataGrid } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface AssetCategory {
  id: string;
  name: string;
}

interface AssetSubCategory {
  id: string;
  name: string;
  categoryId: string;
  category: AssetCategory;
}

interface AssetGroup {
  id: string;
  name: string;
}

interface AssetSensitivity {
  id: string;
  name: string;
}

interface CIARating {
  id: string;
  type: string;
  label: string;
  value: number;
}

interface CIAClassification {
  id: string;
  subCategoryId: string;
  subCategory: AssetSubCategory;
  groupId: string;
  group: AssetGroup;
  sensitivityId?: string;
  sensitivity?: AssetSensitivity;
  confidentiality: string;
  confidentialityScore: number;
  integrity: string;
  integrityScore: number;
  availability: string;
  availabilityScore: number;
  assetCriticality: string;
  assetCriticalityScore: number;
}

export default function AssetClassificationPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [classifications, setCIAClassifications] = useState<CIAClassification[]>([]);
  const [subCategories, setSubCategories] = useState<AssetSubCategory[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [sensitivities, setSensitivities] = useState<AssetSensitivity[]>([]);
  const [ciaRatings, setCIARatings] = useState<CIARating[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<CIAClassification | null>(null);

  // Inline add dialogs
  const [isAddSensitivityOpen, setIsAddSensitivityOpen] = useState(false);
  const [isAddCIARatingOpen, setIsAddCIARatingOpen] = useState(false);
  const [newCIARatingType, setNewCIARatingType] = useState<"Confidentiality" | "Integrity" | "Availability">("Confidentiality");
  const [newSensitivityName, setNewSensitivityName] = useState("");
  const [newCIARatingLabel, setNewCIARatingLabel] = useState("");
  const [newCIARatingValue, setNewCIARatingValue] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    subCategoryId: "",
    groupId: "",
    sensitivityId: "",
    confidentiality: "low",
    confidentialityScore: 1,
    integrity: "low",
    integrityScore: 1,
    availability: "low",
    availabilityScore: 0,
  });

  // AI Risk Evaluation state
  const [isAIRiskDialogOpen, setIsAIRiskDialogOpen] = useState(false);
  const [aiRiskJobId, setAiRiskJobId] = useState<string | null>(null);
  const [aiRiskStatus, setAiRiskStatus] = useState<"queued" | "processing" | "completed" | "error" | null>(null);
  const [aiRiskResults, setAiRiskResults] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [currentClassificationForAI, setCurrentClassificationForAI] = useState<CIAClassification | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classRes, subCatRes, groupRes, sensRes, ciaRes] = await Promise.all([
        fetch("/api/asset-cia-classifications"),
        fetch("/api/asset-sub-categories"),
        fetch("/api/asset-groups"),
        fetch("/api/asset-sensitivities"),
        fetch("/api/cia-ratings"),
      ]);

      if (classRes.ok) setCIAClassifications(await classRes.json());
      if (subCatRes.ok) setSubCategories(await subCatRes.json());
      if (groupRes.ok) setGroups(await groupRes.json());
      if (sensRes.ok) setSensitivities(await sensRes.json());
      if (ciaRes.ok) setCIARatings(await ciaRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Get ratings by type
  const getRatingsByType = (type: string) => {
    return ciaRatings.filter(r => r.type === type);
  };

  const handleAdd = async () => {
    if (!formData.subCategoryId || !formData.groupId) {
      toast({ title: t("Error"), description: t("Please select both Sub Category and Group"), variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/asset-cia-classifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const created = await res.json();
        setCIAClassifications([...classifications, created]);
        resetForm();
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create classification"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding classification:", error);
    }
  };

  const handleEdit = async () => {
    if (!selectedClassification) return;
    try {
      const res = await fetch(`/api/asset-cia-classifications/${selectedClassification.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const updated = await res.json();
        setCIAClassifications(classifications.map((c) => (c.id === updated.id ? updated : c)));
        resetForm();
        setSelectedClassification(null);
        setIsEditOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update classification"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating classification:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedClassification) return;
    try {
      const res = await fetch(`/api/asset-cia-classifications/${selectedClassification.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCIAClassifications(classifications.filter((c) => c.id !== selectedClassification.id));
        setSelectedClassification(null);
        setIsDeleteOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete classification"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting classification:", error);
    }
  };

  const openEditDialog = (classification: CIAClassification) => {
    setSelectedClassification(classification);
    setFormData({
      subCategoryId: classification.subCategoryId,
      groupId: classification.groupId,
      sensitivityId: classification.sensitivityId || "",
      confidentiality: classification.confidentiality,
      confidentialityScore: classification.confidentialityScore,
      integrity: classification.integrity,
      integrityScore: classification.integrityScore,
      availability: classification.availability,
      availabilityScore: classification.availabilityScore,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (classification: CIAClassification) => {
    setSelectedClassification(classification);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      subCategoryId: "",
      groupId: "",
      sensitivityId: "",
      confidentiality: "low",
      confidentialityScore: 1,
      integrity: "low",
      integrityScore: 1,
      availability: "low",
      availabilityScore: 0,
    });
  };

  const updateCIAValue = (field: "confidentiality" | "integrity" | "availability", value: string) => {
    const typeMap = {
      confidentiality: "Confidentiality",
      integrity: "Integrity",
      availability: "Availability",
    };
    const rating = ciaRatings.find(r => r.type === typeMap[field] && r.label === value);
    if (rating) {
      setFormData({
        ...formData,
        [field]: value,
        [`${field}Score`]: rating.value,
      });
    }
  };

  // Handle adding new sensitivity
  const handleAddSensitivity = async () => {
    if (!newSensitivityName.trim()) return;
    try {
      const res = await fetch("/api/asset-sensitivities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSensitivityName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setSensitivities([...sensitivities, created]);
        setFormData({ ...formData, sensitivityId: created.id });
        setNewSensitivityName("");
        setIsAddSensitivityOpen(false);
      }
    } catch (error) {
      console.error("Error adding sensitivity:", error);
    }
  };

  // Handle adding new CIA rating
  const handleAddCIARating = async () => {
    if (!newCIARatingLabel.trim()) return;
    try {
      const res = await fetch("/api/cia-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newCIARatingType,
          label: newCIARatingLabel.trim().toLowerCase(),
          value: newCIARatingValue,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCIARatings([...ciaRatings, created]);
        // Update form with new rating
        const fieldMap: Record<string, "confidentiality" | "integrity" | "availability"> = {
          Confidentiality: "confidentiality",
          Integrity: "integrity",
          Availability: "availability",
        };
        const field = fieldMap[newCIARatingType];
        setFormData({
          ...formData,
          [field]: created.label,
          [`${field}Score`]: created.value,
        });
        setNewCIARatingLabel("");
        setNewCIARatingValue(0);
        setIsAddCIARatingOpen(false);
      }
    } catch (error) {
      console.error("Error adding CIA rating:", error);
    }
  };

  // Filter classifications based on search
  const filteredClassifications = classifications.filter((c) => {
    const search = searchTerm.toLowerCase();
    return (
      c.subCategory?.name?.toLowerCase().includes(search) ||
      c.group?.name?.toLowerCase().includes(search) ||
      c.confidentiality?.toLowerCase().includes(search) ||
      c.integrity?.toLowerCase().includes(search) ||
      c.availability?.toLowerCase().includes(search) ||
      c.assetCriticality?.toLowerCase().includes(search)
    );
  });

  // Export handler
  const handleExport = () => {
    const headers = ["Sub Category", "Asset Group", "Confidentiality", "Integrity", "Availability", "Asset Criticality", "Asset Criticality Score"];
    const rows = filteredClassifications.map(c => [
      c.subCategory?.name || "",
      c.group?.name || "",
      c.confidentiality || "",
      c.integrity || "",
      c.availability || "",
      c.assetCriticality || "",
      c.assetCriticalityScore?.toString() || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `asset_classifications_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // AI Risk Evaluation handlers
  const handleAIRiskEvaluation = async (classification: CIAClassification) => {
    setCurrentClassificationForAI(classification);
    setIsAIRiskDialogOpen(true);
    setAiRiskStatus("queued");
    setAiRiskResults(null);
    setAiRiskJobId(null);

    try {
      // Step 1: Submit job
      const submitResponse = await fetch("/api/assets/classification/aiRisk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classificationId: classification.id }),
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.json();
        throw new Error(error.error || "Failed to start AI risk evaluation");
      }

      const submitData = await submitResponse.json();
      const jobId = submitData.job_id || submitData.jobId;

      if (!jobId) {
        throw new Error("No job ID returned from server");
      }

      setAiRiskJobId(jobId);
      setAiRiskStatus("processing");
      setIsPolling(true);

      // Step 2: Poll for status and result
      await pollJobStatus(jobId);
    } catch (error: any) {
      console.error("Error starting AI risk evaluation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start AI risk evaluation",
        variant: "destructive",
      });
      setAiRiskStatus("error");
      setIsPolling(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setIsPolling(false);
        setAiRiskStatus("error");
        toast({
          title: "Timeout",
          description: "AI risk evaluation timed out. Please try again.",
          variant: "destructive",
        });
        return;
      }

      try {
        const response = await fetch(`/api/assets/classification/aiRisk?jobId=${jobId}`);
        const data = await response.json();

        if (data.status === "completed") {
          setAiRiskStatus("completed");
          setAiRiskResults(data);
          setIsPolling(false);
          toast({
            title: "Success",
            description: "AI risk evaluation completed successfully",
          });
        } else if (data.status === "error") {
          setAiRiskStatus("error");
          setIsPolling(false);
          toast({
            title: "Error",
            description: data.error || "AI risk evaluation failed",
            variant: "destructive",
          });
        } else {
          // Still processing, poll again
          setAiRiskStatus(data.status || "processing");
          attempts++;
          setTimeout(poll, 2000); // Poll every 2 seconds
        }
      } catch (error: any) {
        console.error("Error polling job status:", error);
        setIsPolling(false);
        setAiRiskStatus("error");
        toast({
          title: "Error",
          description: "Failed to check job status",
          variant: "destructive",
        });
      }
    };

    poll();
  };

  // Grid Columns matching UAT
  const ciaColumns: ColumnDef<CIAClassification>[] = [
    {
      accessorKey: "subCategory.name",
      header: t("Sub Category"),
      cell: ({ row }) => row.original.subCategory?.name || "-",
    },
    {
      accessorKey: "group.name",
      header: t("Asset Group"),
      cell: ({ row }) => row.original.group?.name || "-",
    },
    {
      accessorKey: "confidentiality",
      header: t("Confidentiality"),
      cell: ({ row }) => row.original.confidentiality || "-",
    },
    {
      accessorKey: "integrity",
      header: t("Integrity"),
      cell: ({ row }) => row.original.integrity || "-",
    },
    {
      accessorKey: "availability",
      header: t("Availability"),
      cell: ({ row }) => row.original.availability || "-",
    },
    {
      accessorKey: "assetCriticality",
      header: t("Asset Criticality"),
      cell: ({ row }) => row.original.assetCriticality || "-",
    },
    {
      accessorKey: "assetCriticalityScore",
      header: t("Asset Criticality Score"),
      cell: ({ row }) => row.original.assetCriticalityScore,
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAIRiskEvaluation(row.original)}
            disabled={isPolling}
          >
            {isPolling && currentClassificationForAI?.id === row.original.id ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {t("AI Risk Evaluation")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
            onClick={() => openEditDialog(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
            onClick={() => openDeleteDialog(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading classifications...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Asset Management")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Classification")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Asset Classification")}</h1>
      </div>

      {/* Search and Actions - aligned on same row */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("Search by Group, Sub Category, Confidentiality, Availability, Integrity, Criticality")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-[500px] bg-white border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Upload className="h-4 w-4 mr-2" />
            {t("Export")}
          </Button>
          <Button size="sm" onClick={() => {
            resetForm();
            setIsAddOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            {t("New Asset Classification")}
          </Button>
        </div>
      </div>

      {/* Asset Classification Grid */}
      <DataGrid
        columns={ciaColumns}
        data={filteredClassifications}
        hideSearch={true}
      />

      {/* Add Classification Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Asset Classification")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              {/* Asset Sub Category & Asset Group */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={formData.subCategoryId}
                    onValueChange={(value) => setFormData({ ...formData, subCategoryId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue placeholder={t("Select Sub Category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {subCategories.map((sc) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Group")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={formData.groupId}
                    onValueChange={(value) => setFormData({ ...formData, groupId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue placeholder={t("Select Group")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Asset Sensitivity with inline add */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Asset Sensitivity")}</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={formData.sensitivityId}
                    onValueChange={(value) => setFormData({ ...formData, sensitivityId: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t("Select Sensitivity")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {sensitivities.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsAddSensitivityOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Confidentiality & Integrity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Confidentiality")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={formData.confidentiality}
                      onValueChange={(value) => updateCIAValue("confidentiality", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("Select")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {getRatingsByType("Confidentiality").map((r) => (
                          <SelectItem key={r.id} value={r.label}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setNewCIARatingType("Confidentiality");
                        setIsAddCIARatingOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Integrity")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={formData.integrity}
                      onValueChange={(value) => updateCIAValue("integrity", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("Select")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {getRatingsByType("Integrity").map((r) => (
                          <SelectItem key={r.id} value={r.label}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setNewCIARatingType("Integrity");
                        setIsAddCIARatingOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Availability */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Availability")}</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={formData.availability}
                    onValueChange={(value) => updateCIAValue("availability", value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t("Select")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {getRatingsByType("Availability").map((r) => (
                        <SelectItem key={r.id} value={r.label}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setNewCIARatingType("Availability");
                      setIsAddCIARatingOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleAdd}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Classification Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Asset Classification")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              {/* Asset Sub Category & Asset Group */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={formData.subCategoryId}
                    onValueChange={(value) => setFormData({ ...formData, subCategoryId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue placeholder={t("Select Sub Category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {subCategories.map((sc) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Group")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={formData.groupId}
                    onValueChange={(value) => setFormData({ ...formData, groupId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue placeholder={t("Select Group")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Asset Sensitivity with inline add */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Asset Sensitivity")}</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={formData.sensitivityId}
                    onValueChange={(value) => setFormData({ ...formData, sensitivityId: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t("Select Sensitivity")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {sensitivities.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsAddSensitivityOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Confidentiality & Integrity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Confidentiality")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={formData.confidentiality}
                      onValueChange={(value) => updateCIAValue("confidentiality", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("Select")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {getRatingsByType("Confidentiality").map((r) => (
                          <SelectItem key={r.id} value={r.label}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setNewCIARatingType("Confidentiality");
                        setIsAddCIARatingOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Integrity")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={formData.integrity}
                      onValueChange={(value) => updateCIAValue("integrity", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("Select")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {getRatingsByType("Integrity").map((r) => (
                          <SelectItem key={r.id} value={r.label}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setNewCIARatingType("Integrity");
                        setIsAddCIARatingOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Availability */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Availability")}</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={formData.availability}
                    onValueChange={(value) => updateCIAValue("availability", value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t("Select")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {getRatingsByType("Availability").map((r) => (
                        <SelectItem key={r.id} value={r.label}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setNewCIARatingType("Availability");
                      setIsAddCIARatingOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleEdit}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t("Are you sure you want to delete this classification? This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("Delete")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Asset Sensitivity Dialog - inline add */}
      <Dialog open={isAddSensitivityOpen} onOpenChange={setIsAddSensitivityOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Asset Sensitivity")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-6">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Name")} <span className="text-semantic-error">*</span></Label>
              <Input
                value={newSensitivityName}
                onChange={(e) => setNewSensitivityName(e.target.value)}
                placeholder={t("Enter sensitivity name")}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => {
              setNewSensitivityName("");
              setIsAddSensitivityOpen(false);
            }}>{t("Cancel")}</Button>
            <Button onClick={handleAddSensitivity}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add CIA Rating Dialog - inline add */}
      <Dialog open={isAddCIARatingOpen} onOpenChange={setIsAddCIARatingOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add")} {t(newCIARatingType)}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Label")} <span className="text-semantic-error">*</span></Label>
              <Input
                value={newCIARatingLabel}
                onChange={(e) => setNewCIARatingLabel(e.target.value)}
                placeholder={t("e.g., high, medium, low")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Value")} <span className="text-semantic-error">*</span></Label>
              <Input
                type="number"
                value={newCIARatingValue}
                onChange={(e) => setNewCIARatingValue(parseInt(e.target.value) || 0)}
                placeholder={t("Score value")}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => {
              setNewCIARatingLabel("");
              setNewCIARatingValue(0);
              setIsAddCIARatingOpen(false);
            }}>{t("Cancel")}</Button>
            <Button onClick={handleAddCIARating}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Risk Evaluation Results Dialog */}
      <Dialog open={isAIRiskDialogOpen} onOpenChange={setIsAIRiskDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Sparkles className="h-5 w-5 text-primary-600" />
                AI Risk Evaluation
              </DialogTitle>
              {currentClassificationForAI && (
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  Asset: {currentClassificationForAI.subCategory?.name} - {currentClassificationForAI.group?.name}
                </DialogDescription>
              )}
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Loading State */}
            {(aiRiskStatus === "queued" || aiRiskStatus === "processing") && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-200"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  {aiRiskStatus === "queued" ? "Starting AI analysis..." : "Processing risk evaluation..."}
                </p>
                {aiRiskJobId && (
                  <p className="text-xs text-slate-400">Job ID: {aiRiskJobId}</p>
                )}
              </div>
            )}

            {/* Error State */}
            {aiRiskStatus === "error" && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900 mb-2">Error</h4>
                <p className="text-sm text-red-700">Failed to complete AI risk evaluation. Please try again.</p>
              </div>
            )}

            {/* Results State */}
            {aiRiskStatus === "completed" && aiRiskResults && (
              <div className="space-y-4">
                <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <h4 className="font-medium text-primary-900 mb-2">Risk Assessment Summary</h4>
                  <p className="text-sm text-primary-700">
                    AI analysis completed for {currentClassificationForAI?.subCategory?.name} - {currentClassificationForAI?.group?.name}
                  </p>
                </div>

                {aiRiskResults.results?.risks && aiRiskResults.results.risks.length > 0 ? (
                  <div className="space-y-3">
                    {aiRiskResults.results.risks.map((risk: any, index: number) => (
                      <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-medium text-sm text-slate-800">{risk.Risk_name}</h5>
                          <Badge
                            variant={
                              risk.Inherent_risk_rating === 'High'
                                ? 'destructive'
                                : risk.Inherent_risk_rating === 'Medium'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {risk.Inherent_risk_rating || 'N/A'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 mb-2">{risk.Risk_description}</p>
                        {risk.Is_Matched && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-medium">Matched:</span>
                            <span>{risk.Matched_Risk_Code}</span>
                            <span className="text-primary-600">
                              ({(risk.Similarity_Score * 100).toFixed(0)}% match)
                            </span>
                          </div>
                        )}
                        {risk.Threats && risk.Threats.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs font-medium text-slate-500 mb-1">Threats:</p>
                            <div className="flex flex-wrap gap-1">
                              {risk.Threats.map((threat: any, tIndex: number) => (
                                <Badge key={tIndex} variant="outline" className="text-xs">
                                  {threat.threat_name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No risks identified for this asset classification.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAIRiskDialogOpen(false)}>
              Close
            </Button>
            {aiRiskStatus === "completed" && (
              <Button onClick={() => currentClassificationForAI && handleAIRiskEvaluation(currentClassificationForAI)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
