"use client";

import { useEffect, useState, useCallback } from "react";
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
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHasRole } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";

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
  const isGRCReviewer = useHasRole("GRCReviewer");
  const isDepartmentReviewer = useHasRole("DepartmentReviewer");
  const isReviewerRole = isGRCReviewer || isDepartmentReviewer;
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  // Filter states
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

  // Form state
  const [formData, setFormData] = useState<NewFramework>({
    code: "",
    name: "",
    description: "",
    type: "",
    country: "",
    industry: "",
  });

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
    setUploadedFile(null);
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportErrors([]);
    setImportSuccess(null);
    setIsImporting(false);
  };

  const openAICreateDialog = () => {
    resetForm();
    setIsAICreateDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleAICreate = async () => {
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
        setIsAICreateDialogOpen(false);
        resetForm();
        fetchFrameworks();
        toast({
          title: "Success",
          description: "Framework created successfully",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create framework",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating framework:", error);
      toast({
        title: "Error",
        description: "Failed to create framework",
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
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
          title: "Error",
          description: error.error || "Failed to create framework",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating framework:", error);
      toast({
        title: "Error",
        description: "Failed to create framework",
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
          title: "Already Subscribed",
          description: `You are already subscribed to "${masterFramework.name}"`,
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
            title: "Already Subscribed",
            description: `Framework "${masterData.name}" already exists in your account`,
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
        title: "Subscribed Successfully",
        description: `Subscribed to "${masterData.name}" with ${clonedRequirementsCount} requirements and ${clonedControlsCount} controls`,
      });

      // Refresh frameworks list
      await fetchFrameworks();

    } catch (error) {
      console.error("Error subscribing to framework:", error);
      toast({
        title: "Subscription Failed",
        description: error instanceof Error ? error.message : "Failed to subscribe to framework",
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
          title: "Invalid File",
          description: "Please upload an Excel file (.xlsx)",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

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
          title: "Invalid File",
          description: "Please upload an Excel file (.xlsx)",
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
        title: "Template Downloaded",
        description: "Sample template has been downloaded successfully",
      });
    } catch (error) {
      console.error("Error generating template:", error);
      toast({
        title: "Error",
        description: "Failed to download template",
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
          title: "Import Successful",
          description: result.message,
        });
        // Auto-close the dialog after successful import
        handleCloseImportDialog();
      } else {
        if (result.details) {
          setImportErrors(result.details);
        }
        toast({
          title: "Import Failed",
          description: result.error || "Failed to import requirements",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error importing file:", error);
      toast({
        title: "Error",
        description: "Failed to import requirements",
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
  }, [subscriptionFilter, typeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading frameworks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Integrated Frameworks</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Subscription Type Filter - hidden for GRC Reviewer */}
          {!isReviewerRole && (
            <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="Subscription" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Subscriptions</SelectItem>
                <SelectItem value="Subscribed">Subscribed</SelectItem>
                <SelectItem value="Not Subscribed">Not Subscribed</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Framework">Framework</SelectItem>
              <SelectItem value="Standard">Standard</SelectItem>
              <SelectItem value="Regulation">Regulation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        {!isReviewerRole && (
          <div className="flex items-center gap-2">
            <Button
              onClick={openAICreateDialog}
              variant="outline"
              size="sm"
              className="bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              New Framework (AI)
            </Button>
            <Button
              onClick={openCreateDialog}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Framework
            </Button>
          </div>
        )}
      </div>

      {/* Framework Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentFrameworks.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500">No frameworks found.</p>
          </div>
        ) : (
          currentFrameworks.map((framework) => {
            const isLocked = framework.status !== "Subscribed";
            return (
            <div
              key={framework.id}
              className={`bg-white rounded-xl border border-slate-200 p-4 ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => handleFrameworkClick(framework)}
            >
              {/* Framework Name with Lock Icon and Subscribe Button */}
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-semibold text-slate-800 truncate flex-1">
                  {framework.name}
                </h4>
                {isLocked && (
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => handleSubscribe(framework.id, e)}
                      disabled={subscribingId === framework.id}
                    >
                      {subscribingId === framework.id ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Subscribing...
                        </>
                      ) : (
                        "Subscribe"
                      )}
                    </Button>
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Compliance Circle - Clickable only if subscribed */}
              <div className="flex justify-center mb-4">
                <div
                  className={`relative w-28 h-28 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    router.push(`/roles/customer-administrator/compliance/framework/${framework.id}/controls`);
                  }}
                  title={isLocked ? "Framework not subscribed" : "Click to view controls"}
                >
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="8"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${framework.compliancePercentage * 2.51} 251`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-slate-800">
                      {framework.compliancePercentage.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-500">Compliance</span>
                  </div>
                </div>
              </div>

              {/* Policy and Evidence Progress Bars - Clickable only if subscribed */}
              <div className="space-y-3">
                {/* Policy - Clickable only if subscribed */}
                <div
                  className={`flex items-center gap-2 p-1 -m-1 rounded ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    router.push(`/roles/customer-administrator/compliance/framework/${framework.id}/policies`);
                  }}
                  title={isLocked ? "Framework not subscribed" : "Click to view policies"}
                >
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success-500 rounded-full"
                      style={{ width: `${framework.policyPercentage}%` }}
                    />
                  </div>
                  <div className="text-right min-w-[80px]">
                    <span className="text-sm font-medium text-slate-700">{framework.policyPercentage.toFixed(1)}%</span>
                    <span className="text-xs text-slate-500 ml-1">Policy</span>
                  </div>
                </div>

                {/* Evidence - Clickable only if subscribed */}
                <div
                  className={`flex items-center gap-2 p-1 -m-1 rounded ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    router.push(`/roles/customer-administrator/compliance/framework/${framework.id}/evidence`);
                  }}
                  title={isLocked ? "Framework not subscribed" : "Click to view evidence"}
                >
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success-500 rounded-full"
                      style={{ width: `${framework.evidencePercentage}%` }}
                    />
                  </div>
                  <div className="text-right min-w-[80px]">
                    <span className="text-sm font-medium text-slate-700">{framework.evidencePercentage.toFixed(1)}%</span>
                    <span className="text-xs text-slate-500 ml-1">Evidence</span>
                  </div>
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* Pagination */}
      {filteredFrameworks.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Showing {startIndex + 1} to {endIndex} of {filteredFrameworks.length} frameworks
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              className="h-8 w-8"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* AI Create Framework Dialog */}
      <Dialog open={isAICreateDialogOpen} onOpenChange={setIsAICreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="text-lg font-semibold text-slate-800">Create Integrated Framework (AI)</DialogTitle>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
              Note: Custom framework will be automatically added in grey color to
              differentiate between Subscribed Frameworks.
            </p>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Integrated Framework Name <span className="text-semantic-error">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter framework name"
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Framework Type <span className="text-semantic-error">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Framework">Framework</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Regulation">Regulation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Country <span className="text-semantic-error">*</span>
                </Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Enter country"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Industry <span className="text-semantic-error">*</span>
                </Label>
                <Input
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="Enter industry"
                  className="bg-white"
                />
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Upload Support Document</Label>
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
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">Click here, or drop files here to upload.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Sticky Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsAICreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAICreate}
              disabled={!formData.name || !formData.type || !formData.country || !formData.industry}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 1: Create Framework Dialog (Manual with Excel Import) */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="text-lg font-semibold text-slate-800">Create Integrated Framework</DialogTitle>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
              Create a new framework and import requirements from an Excel file.
              Note: Custom framework will be automatically added in grey color to
              differentiate between Subscribed Frameworks.
            </p>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Enter code"
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Integrated Framework Name <span className="text-semantic-error">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter framework name"
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Framework Type <span className="text-semantic-error">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Framework">Framework</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Regulation">Regulation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Country <span className="text-semantic-error">*</span>
                </Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Enter country"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Industry <span className="text-semantic-error">*</span>
                </Label>
                <Input
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="Enter industry"
                  className="bg-white"
                />
              </div>
            </div>
          </div>
          {/* Sticky Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!formData.name || !formData.type || !formData.country || !formData.industry}
            >
              Create & Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: Import Requirements Dialog (same as GRC Admin) */}
      <Dialog open={isImportDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <FileSpreadsheet className="h-5 w-5 text-success-500" />
              Import Framework Requirements
            </DialogTitle>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            <p className="text-sm text-slate-600">
              Upload an Excel file (.xlsx) containing your framework requirements.
              You can download the sample template to see the required format.
            </p>

            {/* Download Template Button */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Sample Template
              </Button>
              <span className="text-xs text-slate-500">
                Use this template to ensure correct column headers
              </span>
            </div>

            {/* File Upload Area */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Upload Document</Label>
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
                        Click to upload or drag and drop
                      </span>
                      <p className="text-xs mt-1">Excel files only (.xlsx)</p>
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
                      Some warnings occurred during import. See details below.
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
                    {importSuccess ? "Warnings" : "Validation Errors"}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-error-200 rounded-lg bg-error-50">
                  {importErrors.map((error, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 text-sm text-semantic-error border-b border-error-100 last:border-b-0"
                    >
                      {error.row > 0 && <span className="font-medium">Row {error.row}: </span>}
                      {error.column && <span className="font-medium">{error.column} - </span>}
                      {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required Columns Info */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-2">Required Column Headers:</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_COLUMNS.map((col) => (
                  <span
                    key={col}
                    className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-600"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {/* Sticky Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleCloseImportDialog}>
              {importSuccess ? "Close" : "Skip"}
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!importFile || isImporting}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
