"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Loader2,
  Sparkles,
  Upload,
  Plus,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Home,
  Search,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHasRole } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { isValidName } from "@/lib/validations";

interface Framework {
  id: string;
  code?: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  country?: string;
  industry?: string;
  isCustom: boolean;
  compliancePercentage: number;
  policyPercentage: number;
  evidencePercentage: number;
}

interface NewFramework {
  code: string;
  name: string;
  description: string;
  type: string;
  country: string;
  industry: string;
}

interface ImportError {
  row: number;
  column: string;
  message: string;
}

const ITEMS_PER_PAGE = 6;

// Template columns for framework requirements (same as GRC Admin)
const TEMPLATE_COLUMNS = [
  "Requirement Code",
  "Requirement Name",
  "Description",
  "Category",
  "Control Mapping",
];

export default function CustomerAdminFrameworkPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const isGRCReviewer = useHasRole("GRCReviewer");
  const isDepartmentReviewer = useHasRole("DepartmentReviewer");
  const isReviewerRole = isGRCReviewer || isDepartmentReviewer;
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  // Subscription error dialog
  const [showSubscriptionErrorDialog, setShowSubscriptionErrorDialog] = useState(false);
  const [subscriptionErrorMessage, setSubscriptionErrorMessage] = useState("");

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>("Subscribed");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // Dialog states - AI Create
  const [isAICreateDialogOpen, setIsAICreateDialogOpen] = useState(false);

  // Dialog states - Manual Create (Step 1: Basic Info)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Dialog states - Step 2 (Excel Import)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [newlyCreatedFrameworkId, setNewlyCreatedFrameworkId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isDraggingImport, setIsDraggingImport] = useState(false);

  // File upload state for AI version
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // AI Create flow state (RunPod job + client-side polling)
  const [isAISubmitting, setIsAISubmitting] = useState(false);
  const [aiJobStatus, setAiJobStatus] = useState<string | null>(null);
  const aiPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [formData, setFormData] = useState<NewFramework>({
    code: "",
    name: "",
    description: "",
    type: "",
    country: "",
    industry: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchFrameworks();
  }, []);

  const fetchFrameworks = async () => {
    try {
      const response = await fetch("/api/frameworks");
      if (response.ok) {
        const data = await response.json();
        setFrameworks(data);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filteredFrameworks = frameworks.filter((fw) => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!fw.name.toLowerCase().includes(q) && !(fw.description || "").toLowerCase().includes(q) && !fw.type.toLowerCase().includes(q)) return false;
    }

    // Subscription filter
    if (subscriptionFilter === "Subscribed" && fw.status !== "Subscribed") return false;
    if (subscriptionFilter === "Not Subscribed" && fw.status === "Subscribed") return false;

    // Type filter
    if (typeFilter && typeFilter !== "all" && fw.type !== typeFilter) return false;

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredFrameworks.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredFrameworks.length);
  const currentFrameworks = filteredFrameworks.slice(startIndex, endIndex);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      type: "",
      country: "",
      industry: "",
    });
    setFormErrors({});
    setUploadedFile(null);
  };

  const validateFrameworkForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name?.trim()) {
      errors.name = t("Please enter name");
    } else if (!isValidName(formData.name.trim())) {
      errors.name = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!formData.type) {
      errors.type = t("Please Select Framework Type");
    }
    if (!formData.country?.trim()) {
      errors.country = t("Please enter Country");
    }
    if (!formData.industry?.trim()) {
      errors.industry = t("Please enter Industry");
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFrameworkFieldChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: "" });
    }
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportErrors([]);
    setImportSuccess(null);
    setIsImporting(false);
  };

  const openAICreateDialog = () => {
    resetForm();
    setAiJobStatus(null);
    setIsAISubmitting(false);
    if (aiPollIntervalRef.current) {
      clearInterval(aiPollIntervalRef.current);
      aiPollIntervalRef.current = null;
    }
    setIsAICreateDialogOpen(true);
  };

  useEffect(() => {
    return () => {
      if (aiPollIntervalRef.current) clearInterval(aiPollIntervalRef.current);
    };
  }, []);

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleAICreate = async () => {
    if (isAISubmitting) return;
    if (!validateFrameworkForm()) return;

    setIsAISubmitting(true);
    setAiJobStatus("submitting");

    try {
      const fd = new FormData();
      fd.append("framework_name", formData.name.trim());
      if (formData.description) fd.append("description", formData.description);
      if (formData.type) fd.append("type", formData.type);
      if (formData.country) fd.append("country", formData.country);
      if (formData.industry) fd.append("industry", formData.industry);
      if (formData.code) fd.append("code", formData.code);
      if (uploadedFile) fd.append("attachment", uploadedFile);

      const createRes = await fetch("/api/ai/generate-framework", {
        method: "POST",
        body: fd,
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to start AI framework generation");
      }

      const { job_id } = await createRes.json();
      if (!job_id) throw new Error("No job ID returned");

      setAiJobStatus("queued");

      const poll = async () => {
        try {
          const statusRes = await fetch(`/api/ai/framework-status/${job_id}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();
          const status = (statusData.status || "").toLowerCase();
          setAiJobStatus(status);

          const isTerminalFailure = status === "failed" || status === "error";
          if (status === "completed" || isTerminalFailure) {
            if (aiPollIntervalRef.current) {
              clearInterval(aiPollIntervalRef.current);
              aiPollIntervalRef.current = null;
            }
          }

          if (status === "completed") {
            const resultRes = await fetch(`/api/ai/framework-result/${job_id}`);
            if (!resultRes.ok) throw new Error("Failed to fetch result");
            const result = await resultRes.json();
            console.log("[AI Framework] Result:", result);
            const frameworkId = result.frameworkId;

            setIsAICreateDialogOpen(false);
            resetForm();
            setAiJobStatus(null);
            setIsAISubmitting(false);
            fetchFrameworks();
            toast({
              title: t("Success"),
              description: t("Framework created successfully"),
            });
            if (frameworkId) {
              router.push(`/roles/customer-administrator/compliance/framework/${frameworkId}`);
            }
          } else if (isTerminalFailure) {
            setIsAISubmitting(false);
            setAiJobStatus(null);
            const errorMsg =
              statusData.error ||
              statusData.message ||
              statusData.error_message ||
              statusData.detail ||
              t("AI framework generation failed");
            console.error("[AI Framework] Job failed:", statusData);
            toast({
              title: t("Error"),
              description: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
              variant: "destructive",
            });
          }
        } catch (e) {
          if (aiPollIntervalRef.current) {
            clearInterval(aiPollIntervalRef.current);
            aiPollIntervalRef.current = null;
          }
          setIsAISubmitting(false);
          setAiJobStatus(null);
          toast({
            title: t("Error"),
            description: e instanceof Error ? e.message : t("Polling failed"),
            variant: "destructive",
          });
        }
      };

      poll();
      aiPollIntervalRef.current = setInterval(poll, 5000);
    } catch (error) {
      setIsAISubmitting(false);
      setAiJobStatus(null);
      toast({
        title: t("Error"),
        description: error instanceof Error ? error.message : t("Failed to create framework"),
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    if (!validateFrameworkForm()) return;
    try {
      const response = await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          isCustom: true,
          status: "Subscribed",
        }),
      });

      if (response.ok) {
        const newFramework = await response.json();
        setIsCreateDialogOpen(false);
        resetForm();
        fetchFrameworks();

        // Open the import dialog for the newly created framework
        setNewlyCreatedFrameworkId(newFramework.id);
        resetImportState();
        setIsImportDialogOpen(true);
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to create framework"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating framework:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create framework"),
        variant: "destructive",
      });
    }
  };

  const handleFrameworkClick = (framework: Framework) => {
    // Prevent navigation for not-subscribed frameworks
    if (framework.status !== "Subscribed") {
      return;
    }
    router.push(`/roles/customer-administrator/compliance/framework/${framework.id}`);
  };

  // Subscribe to a master framework (clone it to customer account)
  const handleSubscribe = async (masterFrameworkId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (subscribingId) return; // Prevent double clicks

    // Check subscription status before subscribing
    try {
      const statusRes = await fetch("/api/subscription-status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (!statusData.allowed) {
          if (statusData.reason === "expired") {
            setSubscriptionErrorMessage(t("Subscription plan has expired, kindly contact VerifAI support"));
          } else {
            setSubscriptionErrorMessage(t("You don't have an active Subscription plan, kindly contact VerifAI support"));
          }
          setShowSubscriptionErrorDialog(true);
          return;
        }
        if (statusData.maxFrameworksAllowed !== undefined && statusData.frameworksUsed >= statusData.maxFrameworksAllowed) {
          setSubscriptionErrorMessage(t("Maximum frameworks limit reached. Your plan allows") + ` ${statusData.maxFrameworksAllowed} ` + t("frameworks") + `. ` + t("Kindly contact VerifAI support to upgrade your plan."));
          setShowSubscriptionErrorDialog(true);
          return;
        }
      }
    } catch (error) {
      console.error("Error checking subscription status:", error);
    }

    setSubscribingId(masterFrameworkId);

    try {
      // Step 1: Check if already subscribed (by name)
      const masterFramework = frameworks.find(f => f.id === masterFrameworkId);
      if (!masterFramework) {
        throw new Error("Framework not found");
      }

      const existingSubscribed = frameworks.find(
        f => f.status === "Subscribed" && f.name.toLowerCase() === masterFramework.name.toLowerCase()
      );

      if (existingSubscribed) {
        toast({
          title: t("Already Subscribed"),
          description: `${t("You are already subscribed to")} "${masterFramework.name}"`,
          variant: "default",
        });
        setSubscribingId(null);
        return;
      }

      // Step 2: Fetch full master framework details
      const detailResponse = await fetch(`/api/frameworks/${masterFrameworkId}`);
      if (!detailResponse.ok) {
        throw new Error("Failed to fetch framework details");
      }
      const masterData = await detailResponse.json();

      // Step 3: Create customer framework copy
      const frameworkResponse = await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: masterData.name,
          description: masterData.description,
          version: masterData.version,
          type: masterData.type || "Framework",
          status: "Subscribed",
          country: masterData.country,
          industry: masterData.industry,
          isCustom: false,
          logo: masterData.logo,
          supportDocumentUrl: masterData.supportDocumentUrl,
        }),
      });

      if (!frameworkResponse.ok) {
        const error = await frameworkResponse.json();
        if (error.error?.includes("already exists")) {
          toast({
            title: t("Already Subscribed"),
            description: `${t("Framework")} "${masterData.name}" ${t("already exists in your account")}`,
            variant: "default",
          });
          setSubscribingId(null);
          await fetchFrameworks();
          return;
        }
        throw new Error(error.error || "Failed to create framework");
      }

      const newFramework = await frameworkResponse.json();
      const newFrameworkId = newFramework.id;

      // Step 4: Collect ALL unique controls from both direct framework controls AND requirement-linked controls
      const controlIdMap: Record<string, string> = {};
      const allControlsMap: Record<string, unknown> = {};

      // Collect controls directly linked to framework
      if (masterData.controls && masterData.controls.length > 0) {
        for (const control of masterData.controls) {
          allControlsMap[control.id] = control;
        }
      }

      // Collect controls linked through requirements (via RequirementControl)
      if (masterData.requirements && masterData.requirements.length > 0) {
        for (const requirement of masterData.requirements) {
          if (requirement.controls && requirement.controls.length > 0) {
            for (const rc of requirement.controls) {
              // rc is RequirementControl with { controlId, control }
              if (rc.control && rc.control.id && !allControlsMap[rc.control.id]) {
                allControlsMap[rc.control.id] = rc.control;
              }
            }
          }
        }
      }

      // Clone all unique controls
      const allControls = Object.values(allControlsMap) as Array<{
        id: string;
        controlCode: string;
        name: string;
        description?: string;
        controlQuestion?: string;
        functionalGrouping?: string;
        entities?: string;
        isControlList?: boolean;
        relativeControlWeighting?: number;
        scope?: string;
        notPerformed?: string;
        performedInformally?: string;
        plannedAndTracked?: string;
        wellDefined?: string;
        quantitativelyControlled?: string;
        continuouslyImproving?: string;
      }>;

      for (const control of allControls) {
        try {
          const controlResponse = await fetch("/api/controls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              controlCode: control.controlCode,
              name: control.name,
              description: control.description,
              controlQuestion: control.controlQuestion || control.name, // Use name as fallback
              functionalGrouping: control.functionalGrouping || "Govern",
              status: "Non Compliant", // Reset status for customer
              entities: control.entities,
              isControlList: control.isControlList,
              relativeControlWeighting: control.relativeControlWeighting,
              scope: control.scope,
              notPerformed: control.notPerformed,
              performedInformally: control.performedInformally,
              plannedAndTracked: control.plannedAndTracked,
              wellDefined: control.wellDefined,
              quantitativelyControlled: control.quantitativelyControlled,
              continuouslyImproving: control.continuouslyImproving,
              frameworkId: newFrameworkId,
            }),
          });

          if (controlResponse.ok) {
            const newControl = await controlResponse.json();
            controlIdMap[control.id] = newControl.id;
          }
        } catch (err) {
          console.error("Error cloning control:", err);
        }
      }

      // Step 5: Clone requirements and create control mappings
      // Note: RequirementCategories are not cloned since no API exists; requirements will be linked directly to framework
      const requirementIdMap: Record<string, string> = {};

      if (masterData.requirements && masterData.requirements.length > 0) {
        // Sort requirements by level to handle parent-child relationships
        const sortedRequirements = [...masterData.requirements].sort(
          (a: { level: number }, b: { level: number }) => (a.level || 1) - (b.level || 1)
        );

        for (const requirement of sortedRequirements) {
          try {
            // Determine parent ID (if any)
            let newParentId = null;
            if (requirement.parentId && requirementIdMap[requirement.parentId]) {
              newParentId = requirementIdMap[requirement.parentId];
            }

            const reqResponse = await fetch("/api/requirements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: requirement.code,
                name: requirement.name,
                description: requirement.description,
                frameworkId: newFrameworkId,
                parentId: newParentId,
                sortOrder: requirement.sortOrder,
                requirementType: requirement.requirementType,
                chapterType: requirement.chapterType,
                level: requirement.level,
                applicability: requirement.applicability,
                justification: requirement.justification,
                implementationStatus: requirement.implementationStatus,
              }),
            });

            if (reqResponse.ok) {
              const newRequirement = await reqResponse.json();
              requirementIdMap[requirement.id] = newRequirement.id;

              // Step 7: Create requirement-control mappings
              if (requirement.controls && requirement.controls.length > 0) {
                const newControlIds = requirement.controls
                  .map((rc: { controlId: string }) => controlIdMap[rc.controlId])
                  .filter((id: string | undefined): id is string => !!id);

                if (newControlIds.length > 0) {
                  try {
                    const linkResponse = await fetch(`/api/requirements/${newRequirement.id}/controls`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ controlIds: newControlIds }),
                    });
                    if (!linkResponse.ok) {
                      console.error(`Failed to link controls to requirement ${requirement.code}:`, await linkResponse.text());
                    }
                  } catch (err) {
                    console.error("Error linking controls to requirement:", err);
                  }
                }
              }
            }
          } catch (err) {
            console.error("Error cloning requirement:", err);
          }
        }
      }

      // Build summary message
      const clonedControlsCount = Object.keys(controlIdMap).length;
      const clonedRequirementsCount = Object.keys(requirementIdMap).length;

      toast({
        title: t("Subscribed Successfully"),
        description: `${t("Subscribed to")} "${masterData.name}" ${t("with")} ${clonedRequirementsCount} ${t("requirements and")} ${clonedControlsCount} ${t("controls")}`,
      });

      // Refresh frameworks list
      await fetchFrameworks();

    } catch (error) {
      console.error("Error subscribing to framework:", error);
      toast({
        title: t("Subscription Failed"),
        description: error instanceof Error ? error.message : t("Failed to subscribe to framework"),
        variant: "destructive",
      });
    } finally {
      setSubscribingId(null);
    }
  };

  // File upload handlers for AI version
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setUploadedFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
    }
  };

  // Import dialog file handlers
  const handleImportDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImport(true);
  }, []);

  const handleImportDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImport(false);
  }, []);

  const handleImportDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImport(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        setImportFile(file);
        setImportErrors([]);
        setImportSuccess(null);
      } else {
        toast({
          title: t("Invalid File"),
          description: t("Please upload an Excel file (.xlsx)"),
          variant: "destructive",
        });
      }
    }
  }, [toast, t]);

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        setImportFile(file);
        setImportErrors([]);
        setImportSuccess(null);
      } else {
        toast({
          title: t("Invalid File"),
          description: t("Please upload an Excel file (.xlsx)"),
          variant: "destructive",
        });
      }
    }
  };

  // Download sample template (same as GRC Admin)
  const handleDownloadTemplate = async () => {
    try {
      // Dynamically import xlsx for client-side template generation
      const XLSX = await import("xlsx");

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheetData = [TEMPLATE_COLUMNS];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths
      const colWidths = TEMPLATE_COLUMNS.map((col) => ({ wch: Math.max(col.length + 5, 20) }));
      worksheet["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, "Requirements");

      // Generate and download
      XLSX.writeFile(workbook, "framework_requirements_template.xlsx");

      toast({
        title: t("Template Downloaded"),
        description: t("Sample template has been downloaded successfully"),
      });
    } catch (error) {
      console.error("Error generating template:", error);
      toast({
        title: t("Error"),
        description: t("Failed to download template"),
        variant: "destructive",
      });
    }
  };

  // Import Excel file (same as GRC Admin - API already handles customer scoping)
  const handleImport = async () => {
    if (!importFile || !newlyCreatedFrameworkId) return;

    setIsImporting(true);
    setImportErrors([]);
    setImportSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch(`/api/frameworks/${newlyCreatedFrameworkId}/import`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setImportSuccess(result.message);
        fetchFrameworks();
        toast({
          title: t("Import Successful"),
          description: result.message,
        });
        // Auto-close the dialog after successful import
        handleCloseImportDialog();
      } else {
        if (result.details) {
          setImportErrors(result.details);
        }
        toast({
          title: t("Import Failed"),
          description: result.error || t("Failed to import requirements"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error importing file:", error);
      toast({
        title: t("Error"),
        description: t("Failed to import requirements"),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseImportDialog = () => {
    setIsImportDialogOpen(false);
    resetImportState();
    setNewlyCreatedFrameworkId(null);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [subscriptionFilter, typeFilter, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/roles/customer-administrator/compliance" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Integrated Frameworks")}</span>
        </nav>

        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Frameworks")}</h1>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500 ">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Integrated Frameworks")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Frameworks")}</h1>
        {isCustomerAdmin && (
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={openAICreateDialog}
              variant="outline"
              size="sm"
              className="bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200"
            >
              <Sparkles className="h-4 w-4 me-2" />
              {t("New Framework (AI)")}
            </Button>
            <Button
              onClick={openCreateDialog}
              size="sm"
            >
              <Plus className="h-4 w-4 me-2" />
              {t("New Framework")}
            </Button>
          </div>
        )}
      </div>

      {/* Card Container */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar: Search + Filters */}
        <div className="flex flex-wrap items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative w-full sm:w-64">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search frameworks...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto sm:ms-auto">
            {isCustomerAdmin && (
              <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t("Subscription")} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">{t("All Subscriptions")}</SelectItem>
                  <SelectItem value="Subscribed">{t("Subscribed")}</SelectItem>
                  <SelectItem value="Not Subscribed">{t("Not Subscribed")}</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("All Types")} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">{t("All Types")}</SelectItem>
                <SelectItem value="Framework">{t("Framework")}</SelectItem>
                <SelectItem value="Standard">{t("Standard")}</SelectItem>
                <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Framework Cards Grid */}
        <div className="p-3 sm:p-5">
          {currentFrameworks.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <Search className="h-6 w-6 text-primary-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">{t("No frameworks found")}</p>
              <p className="text-xs text-slate-400 mt-1">{t("Try adjusting your search or filters")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {currentFrameworks.map((framework) => {
                const isLocked = framework.status !== "Subscribed";
                const typeBadge = framework.type === "Regulation" ? "bg-purple-50 text-purple-700 border-purple-200" : framework.type === "Standard" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200";
                return (
                  <div
                    key={framework.id}
                    className={`rounded-xl border overflow-hidden ${isLocked ? "opacity-50 border-slate-200 bg-slate-50/30" : "border-slate-200 bg-white"}`}
                  >
                    {/* Header: Name + Type + Lock */}
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4
                            className={`text-sm font-semibold text-slate-800 leading-snug line-clamp-2 ${!isLocked ? "cursor-pointer hover:text-primary-600 transition-colors" : ""}`}
                            onClick={() => {
                              if (isLocked || !framework.id) return;
                              router.push(`/roles/customer-administrator/compliance/framework/${framework.id}`);
                            }}
                          >
                            {framework.name}
                          </h4>
                          {framework.type && (
                            <span className={`inline-flex mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${typeBadge}`}>
                              {t(framework.type)}
                            </span>
                          )}
                        </div>
                        {isLocked && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              onClick={(e) => handleSubscribe(framework.id, e)}
                              disabled={subscribingId === framework.id}
                            >
                              {subscribingId === framework.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 me-1 animate-spin" />
                                  {t("Subscribing...")}
                                </>
                              ) : (
                                t("Subscribe")
                              )}
                            </Button>
                            <Lock className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Navigable Rows */}
                    <div className="border-t border-slate-100">
                      {/* Controls Row */}
                      <div
                        className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 ${isLocked ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-50 transition-colors"}`}
                        onClick={() => {
                          if (isLocked || !framework.id) return;
                          router.push(`/roles/customer-administrator/compliance/framework/${framework.id}/controls`);
                        }}
                      >
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                            <circle
                              cx="50" cy="50" r="40" fill="none" stroke="#22c55e" strokeWidth="10"
                              strokeLinecap="round"
                              strokeDasharray={`${framework.compliancePercentage * 2.51} 251`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-slate-800">{framework.compliancePercentage.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-slate-700">{t("Controls")}</span>
                          <p className="text-[11px] text-slate-400">{t("Compliance")}</p>
                        </div>
                        {!isLocked && <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />}
                      </div>

                      {/* Policies Row */}
                      <div
                        className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 ${isLocked ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-50 transition-colors"}`}
                        onClick={() => {
                          if (isLocked || !framework.id) return;
                          router.push(`/roles/customer-administrator/compliance/framework/${framework.id}/policies`);
                        }}
                      >
                        <div className="w-10 flex-shrink-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary-600">{framework.policyPercentage.toFixed(0)}%</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-slate-700">{t("Policies")}</span>
                          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${framework.policyPercentage}%` }}
                            />
                          </div>
                        </div>
                        {!isLocked && <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />}
                      </div>

                      {/* Evidence Row */}
                      <div
                        className={`flex items-center gap-3 px-4 py-3 ${isLocked ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-50 transition-colors"}`}
                        onClick={() => {
                          if (isLocked || !framework.id) return;
                          router.push(`/roles/customer-administrator/compliance/framework/${framework.id}/evidence`);
                        }}
                      >
                        <div className="w-10 flex-shrink-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-amber-600">{framework.evidencePercentage.toFixed(0)}%</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-slate-700">{t("Evidence")}</span>
                          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${framework.evidencePercentage}%` }}
                            />
                          </div>
                        </div>
                        {!isLocked && <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredFrameworks.length > 0 && (
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              {t("Showing")} {startIndex + 1} {t("to")} {endIndex} {t("of")} {filteredFrameworks.length} {t("frameworks")}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* AI Create Framework Dialog */}
      <Dialog open={isAICreateDialogOpen} onOpenChange={setIsAICreateDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()} style={isRTL ? { direction: 'rtl' } : undefined}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Create Integrated Framework (AI)")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            <div className="flex items-start gap-2.5 p-3 bg-primary-50/50 border border-primary-100 rounded-lg">
              <Info className="h-4 w-4 text-primary-500 mt-0.5 shrink-0" />
              <p className="text-sm text-primary-700">
                {t("Custom framework will be automatically added in grey color to differentiate between Subscribed Frameworks.")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Integrated Framework Name")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleFrameworkFieldChange("name", e.target.value)}
                  placeholder={t("Enter framework name")}
                  className={`bg-white ${formErrors.name ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Framework Type")} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => handleFrameworkFieldChange("type", value)}
                >
                  <SelectTrigger className={`w-full bg-white ${formErrors.type ? "border-red-400 bg-red-50" : ""}`}>
                    <SelectValue placeholder={t("Select type")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Framework">{t("Framework")}</SelectItem>
                    <SelectItem value="Standard">{t("Standard")}</SelectItem>
                    <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.type && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.type}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={3}
                className="bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Country")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.country}
                  onChange={(e) => handleFrameworkFieldChange("country", e.target.value)}
                  placeholder={t("Enter country")}
                  className={`bg-white ${formErrors.country ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                />
                {formErrors.country && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.country}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Industry")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.industry}
                  onChange={(e) => handleFrameworkFieldChange("industry", e.target.value)}
                  placeholder={t("Enter industry")}
                  className={`bg-white ${formErrors.industry ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                />
                {formErrors.industry && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.industry}</p>
                )}
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Upload Support Document")}</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary-500 bg-primary-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("ai-file-upload")?.click()}
              >
                <input
                  id="ai-file-upload"
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xlsx,.xls"
                />
                {uploadedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-success-500" />
                    <span className="text-sm font-medium text-success-600">
                      {uploadedFile.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFile(null);
                      }}
                      className="text-slate-400 hover:text-semantic-error"
                    >
                      {t("Remove")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">{t("Click here, or drop files here to upload.")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Sticky Footer */}
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAICreateDialogOpen(false)}
              disabled={isAISubmitting}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleAICreate}
              disabled={isAISubmitting}
            >
              {isAISubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                  {aiJobStatus === "submitting"
                    ? t("Submitting...")
                    : aiJobStatus === "queued" || aiJobStatus === "processing"
                      ? t("Generating... (AI)")
                      : t("Processing...")}
                </>
              ) : (
                t("Save")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 1: Create Framework Dialog (Manual with Excel Import) */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()} style={isRTL ? { direction: 'rtl' } : undefined}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Create Integrated Framework")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            <div className="flex items-start gap-2.5 p-3 bg-primary-50/50 border border-primary-100 rounded-lg">
              <Info className="h-4 w-4 text-primary-500 mt-0.5 shrink-0" />
              <p className="text-sm text-primary-700">
                {t("Custom framework will be automatically added in grey color to differentiate between Subscribed Frameworks.")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Code")}</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder={t("Enter code")}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Framework Type")} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => handleFrameworkFieldChange("type", value)}
                >
                  <SelectTrigger className={`w-full bg-white ${formErrors.type ? "border-red-400 bg-red-50" : ""}`}>
                    <SelectValue placeholder={t("Select type")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Framework">{t("Framework")}</SelectItem>
                    <SelectItem value="Standard">{t("Standard")}</SelectItem>
                    <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.type && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.type}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                {t("Integrated Framework Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => handleFrameworkFieldChange("name", e.target.value)}
                placeholder={t("Enter framework name")}
                className={`bg-white ${formErrors.name ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={3}
                className="bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Country")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.country}
                  onChange={(e) => handleFrameworkFieldChange("country", e.target.value)}
                  placeholder={t("Enter country")}
                  className={`bg-white ${formErrors.country ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                />
                {formErrors.country && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.country}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Industry")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.industry}
                  onChange={(e) => handleFrameworkFieldChange("industry", e.target.value)}
                  placeholder={t("Enter industry")}
                  className={`bg-white ${formErrors.industry ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                />
                {formErrors.industry && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.industry}</p>
                )}
              </div>
            </div>
          </div>
          {/* Sticky Footer */}
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
            >
              {t("Create & Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: Import Requirements Dialog (same as GRC Admin) */}
      <Dialog open={isImportDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()} style={isRTL ? { direction: 'rtl' } : undefined}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Import Framework Requirements")}
              </DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            <p className="text-sm text-slate-600">
              {t("Upload an Excel file (.xlsx) containing your framework requirements.")}
              {" "}{t("You can download the sample template to see the required format.")}
            </p>

            {/* Download Template Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4 me-2" />
                {t("Download Sample Template")}
              </Button>
              <span className="text-xs text-slate-500">
                {t("Use this template to ensure correct column headers")}
              </span>
            </div>

            {/* File Upload Area */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Upload Document")}</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDraggingImport
                    ? "border-success-500 bg-success-50"
                    : importFile
                    ? "border-success-500 bg-success-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onDragOver={handleImportDragOver}
                onDragLeave={handleImportDragLeave}
                onDrop={handleImportDrop}
                onClick={() => document.getElementById("import-file-upload")?.click()}
              >
                <input
                  id="import-file-upload"
                  type="file"
                  className="hidden"
                  onChange={handleImportFileSelect}
                  accept=".xlsx,.xls"
                />
                {importFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="h-12 w-12 text-success-500" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-success-600">
                        {importFile.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImportFile(null);
                          setImportErrors([]);
                          setImportSuccess(null);
                        }}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-semantic-error"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-xs text-slate-500">
                      {(importFile.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Upload className="h-12 w-12" />
                    <div>
                      <span className="text-sm font-medium">
                        {t("Click to upload or drag and drop")}
                      </span>
                      <p className="text-xs mt-1">{t("Excel files only (.xlsx)")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Success Message */}
            {importSuccess && (
              <div className="flex items-start gap-2 p-3 bg-success-50 border border-success-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-success-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-success-800">{importSuccess}</p>
                  {importErrors.length > 0 && (
                    <p className="text-xs text-success-600 mt-1">
                      {t("Some warnings occurred during import. See details below.")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Error Messages */}
            {importErrors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-semantic-error">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {importSuccess ? t("Warnings") : t("Validation Errors")}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-error-200 rounded-lg bg-error-50">
                  {importErrors.map((error, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 text-sm text-semantic-error border-b border-error-100 last:border-b-0"
                    >
                      {error.row > 0 && <span className="font-medium">{t("Row")} {error.row}: </span>}
                      {error.column && <span className="font-medium">{error.column} - </span>}
                      {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required Columns Info */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-2">{t("Required Column Headers:")}</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_COLUMNS.map((col) => (
                  <span
                    key={col}
                    className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-600"
                  >
                    {t(col)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {/* Sticky Footer */}
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg shrink-0">
            <Button variant="outline" size="sm" onClick={handleCloseImportDialog}>
              {importSuccess ? t("Close") : t("Skip")}
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!importFile || isImporting}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent me-2" />
                  {t("Importing...")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 me-2" />
                  {t("Import")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Error Dialog */}
      <Dialog open={showSubscriptionErrorDialog} onOpenChange={setShowSubscriptionErrorDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()} style={isRTL ? { direction: 'rtl' } : undefined}>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-red-600">{t("Error")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5">
            <p className="text-slate-600">{subscriptionErrorMessage}</p>
          </div>
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex justify-end">
            <Button size="sm" onClick={() => setShowSubscriptionErrorDialog(false)}>
              {t("OK")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
