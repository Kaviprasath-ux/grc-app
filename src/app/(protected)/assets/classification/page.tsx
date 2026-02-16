"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Sparkles, Search, Upload, Home, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const RISKS_REGISTER_PATH = "/risks/register";

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
  description?: string;
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
  const router = useRouter();
  const [classifications, setCIAClassifications] = useState<CIAClassification[]>([]);
  const [subCategories, setSubCategories] = useState<AssetSubCategory[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<AssetGroup[]>([]);
  const [sensitivities, setSensitivities] = useState<AssetSensitivity[]>([]);
  const [ciaRatings, setCIARatings] = useState<CIARating[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<CIAClassification | null>(null);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

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
    confidentiality: "",
    confidentialityScore: 0,
    integrity: "",
    integrityScore: 0,
    availability: "",
    availabilityScore: 0,
  });

  // AI Risk Evaluation state
  const [isAIRiskDialogOpen, setIsAIRiskDialogOpen] = useState(false);
  const [aiRiskJobId, setAiRiskJobId] = useState<string | null>(null);
  const [aiRiskStatus, setAiRiskStatus] = useState<"queued" | "processing" | "completed" | "error" | null>(null);
  const [aiRiskResults, setAiRiskResults] = useState<any>(null);
  /** Risks to show in the popup; user can remove some before sending to next step */
  const [displayedRisks, setDisplayedRisks] = useState<any[] | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isAddingToRegister, setIsAddingToRegister] = useState(false);
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
    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation: Asset Sub Category
    if (!formData.subCategoryId) {
      errors.subCategoryId = t("Please select asset sub category");
    }

    // Validation: Asset Group
    if (!formData.groupId) {
      errors.groupId = t("Please select asset group");
    }

    // Validation: Asset Sensitivity
    if (!formData.sensitivityId) {
      errors.sensitivityId = t("Please select sensitivity rating");
    }

    // Validation: Confidentiality
    if (!formData.confidentiality) {
      errors.confidentiality = t("Please select confidentiality rating");
    }

    // Validation: Integrity
    if (!formData.integrity) {
      errors.integrity = t("Please select integrity rating");
    }

    // Validation: Availability
    if (!formData.availability) {
      errors.availability = t("Please select availability rating");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});

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

    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation: Asset Sub Category
    if (!formData.subCategoryId) {
      errors.subCategoryId = t("Please select asset sub category");
    }

    // Validation: Asset Group
    if (!formData.groupId) {
      errors.groupId = t("Please select asset group");
    }

    // Validation: Asset Sensitivity
    if (!formData.sensitivityId) {
      errors.sensitivityId = t("Please select sensitivity rating");
    }

    // Validation: Confidentiality
    if (!formData.confidentiality) {
      errors.confidentiality = t("Please select confidentiality rating");
    }

    // Validation: Integrity
    if (!formData.integrity) {
      errors.integrity = t("Please select integrity rating");
    }

    // Validation: Availability
    if (!formData.availability) {
      errors.availability = t("Please select availability rating");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});

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

  const openEditDialog = async (classification: CIAClassification) => {
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
    setFieldErrors({});

    // Fetch filtered groups for the existing subCategoryId
    if (classification.subCategoryId) {
      try {
        const res = await fetch(`/api/asset-groups?subCategoryId=${classification.subCategoryId}`);
        if (res.ok) {
          const groups = await res.json();
          setFilteredGroups(groups);
        }
      } catch (error) {
        console.error("Error fetching filtered groups:", error);
      }
    }

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
      confidentiality: "",
      confidentialityScore: 0,
      integrity: "",
      integrityScore: 0,
      availability: "",
      availabilityScore: 0,
    });
    setFilteredGroups([]);
    setFieldErrors({});
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
      // Clear field error when value changes
      if (fieldErrors[field]) {
        setFieldErrors({ ...fieldErrors, [field]: "" });
      }
    }
  };

  // Handle sub-category change - fetch filtered groups
  const handleSubCategoryChange = async (subCategoryId: string) => {
    // Reset groupId when sub-category changes
    setFormData(prev => ({ ...prev, subCategoryId, groupId: "" }));

    if (!subCategoryId) {
      setFilteredGroups([]);
      return;
    }

    try {
      const res = await fetch(`/api/asset-groups?subCategoryId=${subCategoryId}`);
      if (res.ok) {
        const groups = await res.json();
        setFilteredGroups(groups);
      } else {
        setFilteredGroups([]);
      }
    } catch (error) {
      console.error("Error fetching filtered groups:", error);
      setFilteredGroups([]);
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

  // Pagination logic
  const totalPages = Math.ceil(filteredClassifications.length / itemsPerPage);
  const paginatedClassifications = filteredClassifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

  // AI Risk Evaluation handlers (uses Generate Risks V2 — synchronous response)
  const handleAIRiskEvaluation = async (classification: CIAClassification) => {
    setCurrentClassificationForAI(classification);
    setIsAIRiskDialogOpen(true);
    setAiRiskStatus("queued");
    setAiRiskResults(null);
    setDisplayedRisks(null);
    setAiRiskJobId(null);

    try {
      const payload = { classificationId: classification.id };
      console.log("[AI Risk] Calling API: POST /api/assets/classification/aiRisk");
      console.log("[AI Risk] Payload:", payload);

      const response = await fetch("/api/assets/classification/aiRisk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start AI risk evaluation");
      }

      const data = await response.json();
      console.log("[AI Risk] Result:", data);

      // Sync flow (Generate Risks V2): response has risks directly — no job ID, no polling
      const hasRisks = Array.isArray(data.risks) || (data.results?.risks != null && Array.isArray(data.results.risks));
      if (hasRisks) {
        const risksList = data.risks ?? data.results?.risks ?? [];
        setAiRiskStatus("completed");
        setAiRiskResults(data);
        setDisplayedRisks(Array.isArray(risksList) ? [...risksList] : []);
        toast({
          title: "Success",
          description: "AI risk evaluation completed successfully",
        });
        return;
      }

      // Async flow (Semantic Match): job_id + polling — only when API returns a job ID
      const jobId = data.job_id || data.jobId;
      if (jobId) {
        setAiRiskJobId(jobId);
        setAiRiskStatus("processing");
        setIsPolling(true);
        await pollJobStatus(jobId);
        return;
      }

      throw new Error("No risks or job ID returned from server");
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
        console.log("[AI Risk] Calling API: GET /api/assets/classification/aiRisk", { jobId });
        const response = await fetch(`/api/assets/classification/aiRisk?jobId=${jobId}`);
        const data = await response.json();
        console.log("[AI Risk] Result (poll):", data);

        if (data.status === "completed") {
          const risksList = data.results?.risks ?? data.risks ?? [];
          setAiRiskStatus("completed");
          setAiRiskResults(data);
          setDisplayedRisks(Array.isArray(risksList) ? [...risksList] : []);
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

  const handleAddToRiskRegister = async () => {
    if (!currentClassificationForAI) return;
    const risks = displayedRisks ?? aiRiskResults?.results?.risks ?? aiRiskResults?.risks ?? [];
    if (!Array.isArray(risks) || risks.length === 0) {
      toast({
        title: t("No risks to add"),
        description: t("Keep at least one risk before adding to the register."),
        variant: "destructive",
      });
      return;
    }

    setIsAddingToRegister(true);
    try {
      const payload = {
        classificationId: currentClassificationForAI.id,
        generatedRisks: risks,
      };
      console.log("[AI Risk] Calling API: POST /api/assets/classification/aiRisk/semantic");
      console.log("[AI Risk] Payload:", payload);

      const res = await fetch("/api/assets/classification/aiRisk/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start adding to risk register");
      }

      const result = await res.json();
      console.log("[AI Risk] Result (semantic start):", result);

      const { job_id, jobId } = result;
      const sid = job_id ?? jobId;
      if (!sid) throw new Error("No job ID returned");

      const maxAttempts = 45;
      let attempts = 0;

      const pollSemantic = async () => {
        if (attempts >= maxAttempts) {
          setIsAddingToRegister(false);
          toast({
            title: t("Timeout"),
            description: t("Adding to risk register timed out. Please try again."),
            variant: "destructive",
          });
          return;
        }
        try {
          console.log("[AI Risk] Calling API: GET /api/assets/classification/aiRisk (semantic poll)", { jobId: sid, attempt: attempts + 1 });
          const statusRes = await fetch(`/api/assets/classification/aiRisk?jobId=${sid}`);
          const data = await statusRes.json();
          console.log("[AI Risk] Result (semantic poll):", data);

          if (data.status === "completed") {
            setIsAddingToRegister(false);

            try {
              const registerRes = await fetch("/api/assets/classification/aiRisk/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ semanticResult: data }),
              });

              if (!registerRes.ok) {
                const err = await registerRes.json().catch(() => ({}));
                toast({
                  title: t("Error"),
                  description: err.error || t("Failed to register risks"),
                  variant: "destructive",
                });
                return;
              }

              toast({
                title: t("Success"),
                description: t("Risks have been added to the Risk Register."),
              });
              setIsAIRiskDialogOpen(false);
              router.push(RISKS_REGISTER_PATH);
            } catch (e: any) {
              toast({
                title: t("Error"),
                description: e.message || t("Failed to register risks"),
                variant: "destructive",
              });
            }
            return;
          }
          if (data.status === "error") {
            setIsAddingToRegister(false);
            toast({
              title: t("Error"),
              description: data.error || t("Failed to add risks to register"),
              variant: "destructive",
            });
            return;
          }
          attempts++;
          setTimeout(pollSemantic, 2000);
        } catch (e: any) {
          setIsAddingToRegister(false);
          toast({
            title: t("Error"),
            description: e.message || t("Failed to check status"),
            variant: "destructive",
          });
        }
      };

      pollSemantic();
    } catch (error: any) {
      setIsAddingToRegister(false);
      toast({
        title: t("Error"),
        description: error.message || t("Failed to add to risk register"),
        variant: "destructive",
      });
    }
  };

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
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500 ">
          <Home className="h-4 w-4" />
          <span>{t("Asset Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Classification")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Asset Classification")}</h1>
        </div>
      </div>

      {/* Action Buttons - Above the card */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Export")}
        </Button>
        <Button size="sm" onClick={() => {
          resetForm();
          setIsAddOpen(true);
        }}>
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("New Asset Classification")}
        </Button>
      </div>

      {/* Card with Search Toolbar + Table + Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search Toolbar */}
        <div className="flex items-center px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search classifications...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-56 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        {filteredClassifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-primary-500" />
            </div>
            <h3 className="text-sm font-medium text-slate-800 mb-1">{t("No classifications found")}</h3>
            <p className="text-xs text-slate-500">{searchTerm ? t("Try adjusting your search") : t("Add your first asset classification")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Sub Category")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Asset Group")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Confidentiality")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Integrity")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Availability")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Asset Criticality")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Score")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pr-5">{t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClassifications.map((c) => (
                <TableRow key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{c.subCategory?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{c.group?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{c.confidentiality || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{c.integrity || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{c.availability || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{c.assetCriticality || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{c.assetCriticalityScore}</TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-primary-600 border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                        onClick={() => handleAIRiskEvaluation(c)}
                        disabled={isPolling}
                      >
                        {isPolling && currentClassificationForAI?.id === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                        )}
                        {t("AI Risk Evaluation")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => openEditDialog(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                        onClick={() => openDeleteDialog(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}

        {/* Pagination */}
        {filteredClassifications.length > 0 && (
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              {t("Showing")} {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredClassifications.length)} {t("of")} {filteredClassifications.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Classification Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Asset Classification")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
            <div className="space-y-5">
              {/* Asset Sub Category & Asset Group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={formData.subCategoryId}
                    onValueChange={(value) => {
                      handleSubCategoryChange(value);
                      if (fieldErrors.subCategoryId) {
                        setFieldErrors({ ...fieldErrors, subCategoryId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${fieldErrors.subCategoryId ? "border-red-500" : ""}`}>
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
                  {fieldErrors.subCategoryId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryId}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Group")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={formData.groupId}
                    onValueChange={(value) => {
                      setFormData({ ...formData, groupId: value });
                      if (fieldErrors.groupId) {
                        setFieldErrors({ ...fieldErrors, groupId: "" });
                      }
                    }}
                    disabled={!formData.subCategoryId}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${fieldErrors.groupId ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={formData.subCategoryId ? t("Select Group") : t("Select Sub Category first")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {filteredGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.groupId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.groupId}</p>
                  )}
                </div>
              </div>

              {/* Asset Sensitivity with inline add */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Asset Sensitivity")} <span className="text-semantic-error">*</span></Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={formData.sensitivityId}
                    onValueChange={(value) => {
                      setFormData({ ...formData, sensitivityId: value });
                      if (fieldErrors.sensitivityId) {
                        setFieldErrors({ ...fieldErrors, sensitivityId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`flex-1 ${fieldErrors.sensitivityId ? "border-red-500" : ""}`}>
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
                {fieldErrors.sensitivityId && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.sensitivityId}</p>
                )}
              </div>

              {/* Confidentiality & Integrity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Confidentiality")} <span className="text-semantic-error">*</span></Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={formData.confidentiality}
                      onValueChange={(value) => updateCIAValue("confidentiality", value)}
                    >
                      <SelectTrigger className={`flex-1 ${fieldErrors.confidentiality ? "border-red-500" : ""}`}>
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
                  {fieldErrors.confidentiality && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.confidentiality}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Integrity")} <span className="text-semantic-error">*</span></Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={formData.integrity}
                      onValueChange={(value) => updateCIAValue("integrity", value)}
                    >
                      <SelectTrigger className={`flex-1 ${fieldErrors.integrity ? "border-red-500" : ""}`}>
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
                  {fieldErrors.integrity && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.integrity}</p>
                  )}
                </div>
              </div>

              {/* Availability */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Availability")} <span className="text-semantic-error">*</span></Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={formData.availability}
                    onValueChange={(value) => updateCIAValue("availability", value)}
                  >
                    <SelectTrigger className={`flex-1 ${fieldErrors.availability ? "border-red-500" : ""}`}>
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
                {fieldErrors.availability && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.availability}</p>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsAddOpen(false);
              setFieldErrors({});
            }}>{t("Cancel")}</Button>
            <Button onClick={handleAdd}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Classification Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Asset Classification")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
            <div className="space-y-5">
              {/* Asset Sub Category & Asset Group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={formData.subCategoryId}
                    onValueChange={(value) => {
                      handleSubCategoryChange(value);
                      if (fieldErrors.subCategoryId) {
                        setFieldErrors({ ...fieldErrors, subCategoryId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${fieldErrors.subCategoryId ? "border-red-500" : ""}`}>
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
                  {fieldErrors.subCategoryId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryId}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Group")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={formData.groupId}
                    onValueChange={(value) => {
                      setFormData({ ...formData, groupId: value });
                      if (fieldErrors.groupId) {
                        setFieldErrors({ ...fieldErrors, groupId: "" });
                      }
                    }}
                    disabled={!formData.subCategoryId}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${fieldErrors.groupId ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={formData.subCategoryId ? t("Select Group") : t("Select Sub Category first")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {filteredGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.groupId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.groupId}</p>
                  )}
                </div>
              </div>

              {/* Asset Sensitivity with inline add */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Asset Sensitivity")} <span className="text-semantic-error">*</span></Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={formData.sensitivityId}
                    onValueChange={(value) => {
                      setFormData({ ...formData, sensitivityId: value });
                      if (fieldErrors.sensitivityId) {
                        setFieldErrors({ ...fieldErrors, sensitivityId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`flex-1 ${fieldErrors.sensitivityId ? "border-red-500" : ""}`}>
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
                {fieldErrors.sensitivityId && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.sensitivityId}</p>
                )}
              </div>

              {/* Confidentiality & Integrity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Confidentiality")} <span className="text-semantic-error">*</span></Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={formData.confidentiality}
                      onValueChange={(value) => updateCIAValue("confidentiality", value)}
                    >
                      <SelectTrigger className={`flex-1 ${fieldErrors.confidentiality ? "border-red-500" : ""}`}>
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
                  {fieldErrors.confidentiality && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.confidentiality}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Integrity")} <span className="text-semantic-error">*</span></Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={formData.integrity}
                      onValueChange={(value) => updateCIAValue("integrity", value)}
                    >
                      <SelectTrigger className={`flex-1 ${fieldErrors.integrity ? "border-red-500" : ""}`}>
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
                  {fieldErrors.integrity && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.integrity}</p>
                  )}
                </div>
              </div>

              {/* Availability */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Availability")} <span className="text-semantic-error">*</span></Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={formData.availability}
                    onValueChange={(value) => updateCIAValue("availability", value)}
                  >
                    <SelectTrigger className={`flex-1 ${fieldErrors.availability ? "border-red-500" : ""}`}>
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
                {fieldErrors.availability && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.availability}</p>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsEditOpen(false);
              setFieldErrors({});
            }}>{t("Cancel")}</Button>
            <Button onClick={handleEdit}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t("Are you sure you want to delete this classification? This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("Delete")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Asset Sensitivity Dialog - inline add */}
      <Dialog open={isAddSensitivityOpen} onOpenChange={setIsAddSensitivityOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Asset Sensitivity")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
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
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
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
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Add")} {t(newCIARatingType)}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
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
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setNewCIARatingLabel("");
              setNewCIARatingValue(0);
              setIsAddCIARatingOpen(false);
            }}>{t("Cancel")}</Button>
            <Button onClick={handleAddCIARating}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Risk Evaluation Results Dialog (Generate Risks V2 response) */}
      <Dialog open={isAIRiskDialogOpen} onOpenChange={setIsAIRiskDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Sparkles className="h-5 w-5 text-primary-600" />
                {t("AI Risk Evaluation")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">
                {t("Asset")}: {currentClassificationForAI?.subCategory?.name} - {currentClassificationForAI?.group?.name}
              </p>
              {currentClassificationForAI?.group?.description && (
                <p className="text-xs text-slate-500 line-clamp-2">{currentClassificationForAI.group.description}</p>
              )}
            </div>

            {(aiRiskStatus === "queued" || aiRiskStatus === "processing") && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 text-primary-600 animate-spin" />
                <p className="text-sm text-slate-600 font-medium">{t("AI is identifying potential risks...")}</p>
                <p className="text-xs text-slate-400">{t("This may take up to 30 seconds")}</p>
                {aiRiskJobId && (
                  <p className="text-xs text-slate-400">{t("Job ID")}: {aiRiskJobId}</p>
                )}
              </div>
            )}

            {aiRiskStatus === "error" && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900 mb-2">{t("Error")}</h4>
                <p className="text-sm text-red-700">{t("Failed to complete AI risk evaluation. Please try again.")}</p>
              </div>
            )}

            {aiRiskStatus === "completed" && aiRiskResults && (() => {
              const risks = displayedRisks ?? aiRiskResults.results?.risks ?? aiRiskResults.risks ?? [];
              const hasRisks = Array.isArray(risks) && risks.length > 0;

              const removeRisk = (index: number) => {
                setDisplayedRisks((prev) => {
                  const list = prev ?? aiRiskResults?.results?.risks ?? aiRiskResults?.risks ?? [];
                  return list.filter((_: unknown, i: number) => i !== index);
                });
              };

              return hasRisks ? (
                <div className="space-y-6">
                  <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                    <h4 className="font-medium text-primary-900 mb-2">{t("Detected Risks")} ({risks.length})</h4>
                    <p className="text-sm text-primary-700">
                      {t("The AI has identified the following risks, threats, and suggested controls. These are now persisted in your Risk Register.")}
                    </p>
                    <p className="text-xs text-primary-600 mt-1">
                      {t("Remove risks you do not need; only the remaining risks will be sent to the next step.")}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {risks.map((risk: any, idx: number) => {
                      const threatList = risk.Threats ?? [];
                      const allControls = threatList.flatMap((t: any) => t.controls ?? []);
                      const allVulnerabilities = threatList.flatMap((t: any) => (t.Vulnerabilities ?? []));
                      return (
                        <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <h5 className="font-semibold text-slate-900 truncate">{risk.Risk_name}</h5>
                              <Badge
                                className={`shrink-0 ${
                                  risk.Inherent_risk_rating === "High"
                                    ? "bg-error-light text-error-dark"
                                    : risk.Inherent_risk_rating === "Medium"
                                      ? "bg-warning-light text-warning-dark"
                                      : "bg-success-light text-success-dark"
                                }`}
                              >
                                {risk.Inherent_risk_rating || "N/A"}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                              onClick={() => removeRisk(idx)}
                              title={t("Remove risk")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-sm text-slate-600">{risk.Risk_description}</p>
                          {risk.Risk_category && (
                            <p className="text-xs text-slate-500">{t("Category")}: {risk.Risk_category}</p>
                          )}

                          {threatList.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">{t("Threats")}</p>
                              <div className="flex flex-wrap gap-2">
                                {threatList.map((tm: any, tIdx: number) => (
                                  <Badge key={tIdx} variant="outline" className="text-[10px] py-0">
                                    {tm.threat_name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {allControls.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">{t("Suggested Controls")}</p>
                              <div className="space-y-1">
                                {allControls.map((c: any, cIdx: number) => (
                                  <div key={cIdx} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded">
                                    <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">
                                      {c.control_functionalGrouping ?? ""}
                                    </span>
                                    <span className="flex-1">{c.ControlName ?? c.controlName ?? ""}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {allVulnerabilities.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">{t("Vulnerabilities")}</p>
                              <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                                {allVulnerabilities.map((v: string, vIdx: number) => (
                                  <li key={vIdx}>{v}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Sparkles className="h-12 w-12 mb-4 opacity-20" />
                  <p>{t("No risks identified for this asset classification.")}</p>
                </div>
              );
            })()}
          </div>
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAIRiskDialogOpen(false)}>
              {t("Close")}
            </Button>
            {aiRiskStatus === "completed" && (
              <>
                <Button
                  onClick={handleAddToRiskRegister}
                  disabled={
                    isAddingToRegister ||
                    (displayedRisks ?? aiRiskResults?.results?.risks ?? aiRiskResults?.risks ?? []).length === 0
                  }
                >
                  {isAddingToRegister ? (
                    <>
                      <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                      {t("Adding...")}
                    </>
                  ) : (
                    t("Add to Risk Register")
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => currentClassificationForAI && handleAIRiskEvaluation(currentClassificationForAI)}
                  disabled={isAddingToRegister}
                >
                  <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Regenerate")}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
