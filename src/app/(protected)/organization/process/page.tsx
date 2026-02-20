"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Download, Upload, Search, Sparkles, FileText, Eye, BarChart3, ChevronLeft, Loader2, ChevronRight, Home, X, CheckCircle2, AlertCircle, Settings2 } from "lucide-react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatLocalDate } from "@/lib/utils";
import { DataGrid } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { useUserRoles } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { useRiskSemanticMatch } from "@/hooks/useRiskSemanticMatch";
import { DatePicker } from "@/components/ui/date-picker";
import { isValidName } from "@/lib/validations";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId?: string | null;
  userRoles?: { role: { name: string } }[];
}

interface BIAData {
  ratings: BIARating[];
  rto: string;
  rpo: string;
  lowValue: string;
  criticalValue: string;
  highValue: string;
  mediumValue: string;
  approver: string;
}

interface Process {
  id: string;
  processCode: string;
  name: string;
  description: string | null;
  processType: string;
  departmentId: string | null;
  department: Department | null;
  ownerId: string | null;
  owner: User | null;
  status: string;
  processFrequency?: string | null;
  frequency?: string;
  natureOfImplementation?: string;
  assetDependency?: boolean;
  assetId?: string | null;
  externalDependency?: boolean;
  location?: string | string[];
  kpiMeasurementRequired?: boolean;
  piiCapture?: boolean;
  operationalComplexity?: string;
  lastAuditDate?: string;
  responsibleId?: string | null;
  accountableId?: string | null;
  consultedId?: string | null;
  informedId?: string | null;
  responsible?: string;
  accountable?: string;
  consulted?: string;
  informed?: string;
  biaCompleted?: boolean;
  processCriticality?: string;
  recurrence?: string;
  reviewDate?: string;
  biaData?: BIAData;
}

interface BIARating {
  category: string;
  rating: "High" | "Medium" | "Low" | "";
  description: string;
  ratingScore?: number;
}

interface ProcessBIAStatus {
  processId: string;
  status: string;
  impactRating?: number;
  processCriticality?: string;
  rtoHours?: number;
  rpoHours?: number;
  lowValue?: number | null;
  criticalValue?: number | null;
  highValue?: number | null;
  mediumValue?: number | null;
  approverId?: string | null;
  approverName?: string | null;
  categoryRatings?: Array<{
    categoryName: string;
    rating: string | null;
    ratingScore: number | null;
    description: string | null;
  }>;
}

interface BIACategory {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

interface BIARatingOption {
  id: string;
  label: string;
  score: number;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

const processTypes = ["Primary", "Management", "Supporting"];
// natureOfImplementations fetched from API
const operationalComplexities = ["Low", "Medium", "High"];
// BIA rating descriptions are now fetched from /api/bia-ratings

export default function ProcessPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { t, isRTL } = useLanguage();

  // Check if user is DepartmentReviewer (needs to see assigned processes and approve)
  const isDepartmentReviewer = userRoles.some((role) => role === "DepartmentReviewer");
  // Check if user is DepartmentContributor (can add processes with their department pre-selected)
  const isDepartmentContributor = userRoles.some((role) => role === "DepartmentContributor");
  // Check if user is Reviewer (hide Actions and AI Risk columns)
  const isReviewer = userRoles.some((role) => role === "Reviewer");
  // Check if user has roles that can add new processes
  const isCustomerAdministrator = userRoles.some((role) => role === "CustomerAdministrator");
  const isContributor = userRoles.some((role) => role === "Contributor");
  // Only these roles can add new processes
  const canAddProcess = isCustomerAdministrator || isContributor || isDepartmentContributor;
  const userDepartmentId = session?.user?.departmentId;

  const [activeTab, setActiveTab] = useState("repository");
  const [processes, setProcesses] = useState<Process[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<{ id: string; assetId: string; name: string }[]>([]);
  const [processBIAStatuses, setProcessBIAStatuses] = useState<ProcessBIAStatus[]>([]);
  const [processFrequencies, setProcessFrequencies] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<MultiSelectOption[]>([]);
  const [natureOfImplementations, setNatureOfImplementations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [kpiDepartmentFilter, setKpiDepartmentFilter] = useState("all");
  const [biaColumnVisibility, setBiaColumnVisibility] = useState<Record<string, boolean>>({
    processCode: true,
    name: true,
    "department.name": true,
    "owner.fullName": true,
    processFrequency: true,
    processCriticality: true,
    actions: true,
  });

  // Dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingProcessId, setDeletingProcessId] = useState<string | null>(null);
  const [isAIEvaluationOpen, setIsAIEvaluationOpen] = useState(false);
  const [evaluatingProcess, setEvaluatingProcess] = useState<Process | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiRisks, setAiRisks] = useState<any[]>([]);
  const [semanticMatchStats, setSemanticMatchStats] = useState<{
    created?: number;
    updated?: number;
    skipped?: number;
    risks?: { total: number; created: number; matched: number; skipped: number; errors: number };
  } | null>(null);
  const [showMatchResults, setShowMatchResults] = useState(false);

  // Semantic matching hook - decoupled flow with explicit registration
  const {
    submitJob: submitSemanticMatch,
    registerRisks,
    status: semanticStatus,
    result: semanticResult,
    isLoading: isSemanticLoading,
    isPolling: isSemanticPolling,
    isRegistering: isSemanticRegistering,
    error: semanticError,
    reset: resetSemanticMatch,
  } = useRiskSemanticMatch({
    onComplete: (result) => {
      // Results received - show preview to user
      console.log("[Process] Semantic matching completed - showing preview");
      console.log("[Process] Preview stats:", JSON.stringify(result.stats, null, 2));
      setShowMatchResults(true);
      toast({
        title: t("Matching Complete"),
        description: t("Review the matched results below before registering."),
      });
    },
    onRegistered: (result) => {
      // Registration complete - update stats and refresh
      console.log("[Process] Risks registered:", result);
      setSemanticMatchStats(result.stats ?? null);
      fetchData();
      toast({
        title: t("Risk Library Updated"),
        description: `${t("Created")}: ${result.stats?.risks?.created || 0}, ${t("Linked")}: ${result.stats?.risks?.matched || 0}`,
      });
    },
    onError: (error) => {
      console.error("[Process] Semantic matching error:", error);
      toast({
        title: t("Operation Failed"),
        description: error,
        variant: "destructive",
      });
    },
  });
  const [isBIAFormOpen, setIsBIAFormOpen] = useState(false);
  const [biaProcess, setBiaProcess] = useState<Process | null>(null);
  const [biaCategories, setBiaCategories] = useState<BIACategory[]>([]);
  const [biaRatingOptions, setBiaRatingOptions] = useState<BIARatingOption[]>([]);
  const [biaRatings, setBiaRatings] = useState<BIARating[]>([]);
  const [biaApprover, setBiaApprover] = useState("");
  const [biaDepartment, setBiaDepartment] = useState("");
  const [rto, setRto] = useState("0");
  const [rpo, setRpo] = useState("0");
  const [lowValue, setLowValue] = useState("");
  const [criticalValue, setCriticalValue] = useState("");
  const [highValue, setHighValue] = useState("");
  const [mediumValue, setMediumValue] = useState("");

  // Add/Edit Process Dialog states
  const [isAddProcessOpen, setIsAddProcessOpen] = useState(false);
  const [isEditProcessOpen, setIsEditProcessOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);

  const handleEvaluateAI = async (process: Process) => {
    setEvaluatingProcess(process);
    setIsAiGenerating(true);
    setAiRisks([]);
    setSemanticMatchStats(null);
    setShowMatchResults(false);
    resetSemanticMatch();
    setIsAIEvaluationOpen(true);

    try {
      // Step 1: Generate risks without persisting (user will review first)
      const response = await fetch("/api/ai/risk-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: process.id, persist: false }),
      });

      const result = await response.json();
      if (response.ok) {
        const generatedRisks = result.risks || [];
        setAiRisks(generatedRisks);

        if (generatedRisks.length > 0) {
          toast({
            title: t("AI Risks Generated"),
            description: `${t("Generated")} ${generatedRisks.length} ${t("risks")}. ${t("Review and remove unwanted risks before proceeding.")}`,
          });
          // Note: Semantic matching will be triggered when user clicks "Go to Risk Register"
        } else {
          toast({
            title: t("No Risks Found"),
            description: t("AI did not identify any risks for this process."),
          });
        }
      } else {
        // Use user-friendly error message if available
        const errorTitle = result.userError?.title || t("AI Generation Failed");
        const errorDescription = result.userMessage || result.error || t("Please try again later.");
        toast({
          title: t(errorTitle),
          description: errorDescription,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[Process] AI evaluation error:", error);
      toast({
        title: t("Connection Error"),
        description: t("Unable to reach the AI service. Please check your connection and try again."),
        variant: "destructive",
      });
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Delete an AI-generated risk from the review list
  const handleDeleteAiRisk = (indexToDelete: number) => {
    setAiRisks(prev => prev.filter((_, idx) => idx !== indexToDelete));
    toast({
      title: t("Risk Removed"),
      description: t("The risk has been removed from the review list."),
    });
  };

  // Start semantic matching process (Step 1 of new flow)
  const handleStartSemanticMatch = () => {
    if (aiRisks.length > 0) {
      console.log("[Process] Starting semantic matching for", aiRisks.length, "risks");
      submitSemanticMatch(aiRisks, evaluatingProcess?.id || "").catch((error) => {
        console.error("[Process] Semantic matching error:", error);
      });
    }
  };

  // Register risks and navigate to risk register (Step 2 of new flow)
  const handleRegisterAndNavigate = async () => {
    console.log("[Process] Registering risks...");
    const result = await registerRisks(evaluatingProcess?.id);
    if (result?.success) {
      // Close the dialog and navigate to risk register
      setIsAIEvaluationOpen(false);
      router.push("/risks/register");
    }
  };

  // Legacy: Navigate directly without semantic matching (for quick access)
  const handleGoToRiskRegister = () => {
    setIsAIEvaluationOpen(false);
    router.push("/risks/register");
  };
  const [saving, setSaving] = useState(false);

  // KPI Modal states
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [selectedKPIProcess, setSelectedKPIProcess] = useState<Process | null>(null);
  const [kpiSearchTerm, setKpiSearchTerm] = useState("");
  const [selectedKPIYear, setSelectedKPIYear] = useState("2026");
  const [kpiConfig, setKpiConfig] = useState({ objective: "", description: "", dataSource: "", formula: "", expectedValue: 0, targetedAchievedValue: 0 });
  const [kpiErrors, setKpiErrors] = useState<Record<string, string>>({});
  const [kpiSaving, setKpiSaving] = useState(false);

  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process Form state
  const [processForm, setProcessForm] = useState({
    name: "",
    description: "",
    processType: "",
    departmentId: "",
    ownerId: "",
    frequency: "",
    natureOfImplementation: "",
    assetDependency: false,
    assetId: "",
    externalDependency: false,
    location: [] as string[],
    kpiMeasurementRequired: false,
    kpiRecurrence: "",
    kpiReviewDate: "",
    piiCapture: false,
    operationalComplexity: "",
    responsible: "",
    accountable: "",
    consulted: "",
    informed: "",
  });

  // Process Form errors
  const [processFormErrors, setProcessFormErrors] = useState<Record<string, string>>({});

  const resetProcessForm = () => {
    setProcessForm({
      name: "",
      description: "",
      processType: "",
      departmentId: "",
      ownerId: "",
      frequency: "",
      natureOfImplementation: "",
      assetDependency: false,
      assetId: "",
      externalDependency: false,
      location: [],
      kpiMeasurementRequired: false,
      kpiRecurrence: "",
      kpiReviewDate: "",
      piiCapture: false,
      operationalComplexity: "",
      responsible: "",
      accountable: "",
      consulted: "",
      informed: "",
    });
    setProcessFormErrors({});
    setPendingOnboardingFiles([]);
  };

  // Employee Onboarding file states (for Add dialog)
  const [pendingOnboardingFiles, setPendingOnboardingFiles] = useState<File[]>([]);
  const onboardingFileInputRef = useRef<HTMLInputElement>(null);

  // Employee Onboarding file states (for Edit dialog)
  const [editOnboardingFiles, setEditOnboardingFiles] = useState<File[]>([]);
  const editOnboardingFileInputRef = useRef<HTMLInputElement>(null);
  const [editExistingOnboardingFiles, setEditExistingOnboardingFiles] = useState<{ id: string; fileName: string; fileSize?: number | null; filePath?: string }[]>([]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const kpiYears = ["2029", "2028", "2027", "2026", "2025", "2024", "2023"];
  const kpiMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  useEffect(() => {
    fetchData();
  }, []);

  // Initialize BIA ratings when dialog opens with categories available
  // This fixes the stale closure issue where handleOpenBIAForm may capture empty biaCategories
  useEffect(() => {
    if (isBIAFormOpen && biaProcess && biaCategories.length > 0) {
      // Only initialize if we don't have existing BIA data and ratings are empty
      if (!biaProcess.biaCompleted && biaRatings.length === 0) {
        const initialRatings = biaCategories.map((cat) => ({
          category: cat.name,
          rating: "" as "High" | "Medium" | "Low" | "",
          description: "",
        }));
        setBiaRatings(initialRatings);
      }
    }
  }, [isBIAFormOpen, biaProcess, biaCategories, biaRatings.length]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [processRes, deptRes, userRes, biaRes, freqRes, locRes, implRes, assetsRes, biaCatRes, biaRatingsRes] = await Promise.all([
        fetch("/api/processes"),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/process-bia"),
        fetch("/api/organization-settings/process-frequency"),
        fetch("/api/organization-settings/location"),
        fetch("/api/organization-settings/nature-of-implementation"),
        fetch("/api/assets"),
        fetch("/api/bia-categories"),
        fetch("/api/bia-ratings"),
      ]);

      if (processRes.ok) setProcesses(await processRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        setAssets(assetsData.map((a: { id: string; assetId: string; name: string }) => ({ id: a.id, assetId: a.assetId, name: a.name })));
      }
      if (biaRes.ok) {
        const biaData = await biaRes.json();
        setProcessBIAStatuses(biaData.map((bia: ProcessBIAStatus & {
          categoryRatings?: Array<{
            categoryName: string;
            rating: string | null;
            ratingScore: number | null;
            description: string | null;
          }>;
        }) => ({
          processId: bia.processId,
          status: bia.status,
          impactRating: bia.impactRating,
          processCriticality: bia.processCriticality,
          rtoHours: bia.rtoHours,
          rpoHours: bia.rpoHours,
          lowValue: bia.lowValue,
          criticalValue: bia.criticalValue,
          highValue: bia.highValue,
          mediumValue: bia.mediumValue,
          approverId: bia.approverId,
          approverName: bia.approverName,
          categoryRatings: bia.categoryRatings,
        })));
      }
      if (freqRes.ok) {
        const freqData = await freqRes.json();
        setProcessFrequencies(freqData.map((f: { name: string }) => f.name));
      }
      if (locRes.ok) {
        const locData = await locRes.json();
        setLocationOptions(locData.map((l: { id: string; name: string }) => ({ value: l.name, label: l.name })));
      }
      if (implRes.ok) {
        const implData = await implRes.json();
        setNatureOfImplementations(implData.map((i: { name: string }) => i.name));
      }
      // BIA Categories from organization settings
      if (biaCatRes.ok) {
        const catData = await biaCatRes.json();
        setBiaCategories(catData.filter((c: BIACategory) => c.isActive));
      }
      // BIA Rating options from organization settings
      if (biaRatingsRes.ok) {
        const ratingsData = await biaRatingsRes.json();
        setBiaRatingOptions(ratingsData.filter((r: BIARatingOption) => r.isActive));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Filter processes - DepartmentReviewer and DepartmentContributor can only see processes in their department
  const departmentFilteredProcesses = (isDepartmentReviewer || isDepartmentContributor) && userDepartmentId
    ? processes.filter((p) => p.departmentId === userDepartmentId)
    : processes;

  // Only show users who are assigned as owners to at least one process
  const processOwners = useMemo(() =>
    users.filter((user) => processes.some((process) => process.ownerId === user.id)),
    [users, processes]
  );

  const filteredProcesses = departmentFilteredProcesses.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.processCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === "all" || p.departmentId === departmentFilter;
    const matchesOwner = ownerFilter === "all" || p.ownerId === ownerFilter;
    return matchesSearch && matchesDepartment && matchesOwner;
  });

  // Process CRUD
  const handleDeleteProcess = async () => {
    if (!deletingProcessId) return;
    try {
      const res = await fetch(`/api/processes/${deletingProcessId}`, { method: "DELETE" });
      if (res.ok) {
        setProcesses(processes.filter((p) => p.id !== deletingProcessId));
      }
    } catch (error) {
      console.error("Error deleting process:", error);
    }
    setIsDeleteDialogOpen(false);
    setDeletingProcessId(null);
  };

  // BIA functions
  const handleBiaRatingChange = (index: number, ratingLabel: string) => {
    const ratingOption = biaRatingOptions.find((r) => r.label === ratingLabel);
    const newRatings = [...biaRatings];
    newRatings[index] = {
      ...newRatings[index],
      rating: ratingLabel as "High" | "Medium" | "Low" | "",
      description: ratingOption?.description || "",
    };
    setBiaRatings(newRatings);
  };

  const calculateImpactRating = () => {
    // Use dynamic scores from rating options
    const scores = biaRatings.map((r) => {
      const option = biaRatingOptions.find((opt) => opt.label === r.rating);
      return option?.score || 0;
    });
    return Math.max(...scores, 0);
  };

  const getProcessCriticality = () => {
    const rating = calculateImpactRating();
    if (rating >= 100) return "High";
    if (rating >= 50) return "Medium";
    if (rating >= 25) return "Low";
    return "";
  };

  const handleOpenBIAForm = (process: Process) => {
    setBiaProcess(process);
    // Initialize department from process
    setBiaDepartment(process.departmentId || "");

    // Load existing BIA data from processBIAStatuses (fetched from database)
    const existingBIA = processBIAStatuses.find((b) => b.processId === process.id);

    if (existingBIA) {
      // Load ratings from database
      if (existingBIA.categoryRatings && existingBIA.categoryRatings.length > 0) {
        const ratings = existingBIA.categoryRatings.map((cr) => ({
          category: cr.categoryName,
          rating: (cr.rating || "") as "High" | "Medium" | "Low" | "",
          description: cr.description || "",
          ratingScore: cr.ratingScore || 0,
        }));
        setBiaRatings(ratings);
      } else {
        // Initialize from BIA categories if no ratings exist
        const initialRatings = biaCategories.map((cat) => ({
          category: cat.name,
          rating: "" as "High" | "Medium" | "Low" | "",
          description: "",
        }));
        setBiaRatings(initialRatings);
      }

      setBiaApprover(existingBIA.approverId || "");
      setRto(existingBIA.rtoHours?.toString() || "0");
      setRpo(existingBIA.rpoHours?.toString() || "0");
      setLowValue(existingBIA.lowValue != null ? existingBIA.lowValue.toString() : "");
      setCriticalValue(existingBIA.criticalValue != null ? existingBIA.criticalValue.toString() : "");
      setHighValue(existingBIA.highValue != null ? existingBIA.highValue.toString() : "");
      setMediumValue(existingBIA.mediumValue != null ? existingBIA.mediumValue.toString() : "");
    } else if (process.biaCompleted && process.biaData) {
      // Fallback to local biaData (for unsaved changes in current session)
      setBiaRatings(process.biaData.ratings);
      setBiaApprover(process.biaData.approver);
      setRto(process.biaData.rto);
      setRpo(process.biaData.rpo);
      setLowValue(process.biaData.lowValue ?? "");
      setCriticalValue(process.biaData.criticalValue ?? "");
      setHighValue(process.biaData.highValue ?? "");
      setMediumValue(process.biaData.mediumValue ?? "");
    } else {
      // Initialize ratings from dynamic BIA categories from organization settings
      const initialRatings = biaCategories.map((cat) => ({
        category: cat.name,
        rating: "" as "High" | "Medium" | "Low" | "",
        description: "",
      }));
      setBiaRatings(initialRatings);
      setBiaApprover("");
      setRto("0");
      setRpo("0");
      setLowValue("");
      setCriticalValue("");
      setHighValue("");
      setMediumValue("");
    }
    setIsBIAFormOpen(true);
  };

  const handleSaveBIA = async () => {
    if (!biaProcess) return;
    const criticality = getProcessCriticality();

    setSaving(true);
    try {
      // Update process department if changed
      if (biaDepartment !== biaProcess.departmentId) {
        await fetch(`/api/processes/${biaProcess.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: biaDepartment || null,
          }),
        });
      }

      // Save BIA data to the database
      const res = await fetch(`/api/process-bia/${biaProcess.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryRatings: biaRatings.map((r) => ({
            categoryId: biaCategories.find((c) => c.name === r.category)?.id || "",
            categoryName: r.category,
            rating: r.rating,
            ratingScore: r.ratingScore || 0,
            description: r.description || "",
          })),
          rtoHours: parseInt(rto) || 0,
          rpoHours: parseInt(rpo) || 0,
          lowValue: lowValue ? parseInt(lowValue) : null,
          criticalValue: criticalValue ? parseInt(criticalValue) : null,
          highValue: highValue ? parseInt(highValue) : null,
          mediumValue: mediumValue ? parseInt(mediumValue) : null,
        }),
      });

      if (res.ok) {
        toast({
          title: t("Saved"),
          description: t("BIA data has been saved successfully"),
        });

        // Store BIA data in the process
        const biaData: BIAData = {
          ratings: biaRatings,
          rto,
          rpo,
          lowValue,
          criticalValue,
          highValue,
          mediumValue,
          approver: biaApprover,
        };

        setProcesses(processes.map((p) =>
          p.id === biaProcess.id
            ? { ...p, biaCompleted: true, processCriticality: criticality, biaData }
            : p
        ));

        // Refresh BIA statuses
        const statusRes = await fetch("/api/process-bia");
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setProcessBIAStatuses(statusData);
        }

        setIsBIAFormOpen(false);
        setBiaProcess(null);
      } else {
        const error = await res.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to save BIA data"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving BIA:", error);
      toast({
        title: t("Error"),
        description: t("Failed to save BIA data"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Submit For Approval
  const handleSubmitForApproval = async () => {
    if (!biaProcess) return;

    if (!biaApprover) {
      toast({
        title: t("Error"),
        description: t("Please select an approver"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const approver = users.find((u) => u.id === biaApprover);
      const criticality = getProcessCriticality();

      // Update process department if changed
      if (biaDepartment !== biaProcess.departmentId) {
        await fetch(`/api/processes/${biaProcess.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: biaDepartment || null,
          }),
        });
      }

      // Save BIA data and submit for approval
      const res = await fetch(`/api/process-bia/${biaProcess.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryRatings: biaRatings.map((r) => ({
            categoryId: biaCategories.find((c) => c.name === r.category)?.id || "",
            categoryName: r.category,
            rating: r.rating,
          })),
          rtoHours: parseInt(rto) || 0,
          rpoHours: parseInt(rpo) || 0,
          lowValue: lowValue ? parseInt(lowValue) : null,
          criticalValue: criticalValue ? parseInt(criticalValue) : null,
          highValue: highValue ? parseInt(highValue) : null,
          mediumValue: mediumValue ? parseInt(mediumValue) : null,
          approverId: biaApprover,
          approverName: approver?.fullName || null,
          status: "Pending Approval",
        }),
      });

      if (res.ok) {
        // Add a comment for the submission
        await fetch(`/api/process-bia/${biaProcess.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            comment: "BIA submitted for approval",
            createdBy: session?.user?.id,
            createdByName: session?.user?.name,
            action: "Submit",
          }),
        });

        toast({
          title: t("Submitted"),
          description: t("BIA has been submitted for approval"),
        });

        // Update local state
        setProcesses(processes.map((p) =>
          p.id === biaProcess.id
            ? { ...p, biaCompleted: true, processCriticality: criticality, biaData: {
                ratings: biaRatings,
                rto,
                rpo,
                lowValue,
                criticalValue,
                highValue,
                mediumValue,
                approver: biaApprover,
              }}
            : p
        ));

        // Refresh BIA statuses
        const statusRes = await fetch("/api/process-bia");
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setProcessBIAStatuses(statusData);
        }

        setIsBIAFormOpen(false);
        setBiaProcess(null);
      } else {
        const error = await res.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to submit BIA for approval"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting BIA for approval:", error);
      toast({
        title: t("Error"),
        description: t("Failed to submit BIA for approval"),
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  // Helper function to get BIA status for a process
  const getBIAStatus = (processId: string) => {
    return processBIAStatuses.find((b) => b.processId === processId);
  };

  // Handle Add Process
  const handleAddProcess = async () => {
    // Validate form
    const errors: Record<string, string> = {};
    if (!processForm.name.trim()) {
      errors.name = t("Please enter the Process Name");
    } else if (!isValidName(processForm.name.trim())) {
      errors.name = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) {
      setProcessFormErrors(errors);
      return;
    }
    setProcessFormErrors({});

    setSaving(true);
    try {
      const { responsible, accountable, consulted, informed, frequency, location, kpiRecurrence, kpiReviewDate, assetId, ...rest } = processForm;
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          processFrequency: frequency || null,
          location: location.length > 0 ? JSON.stringify(location) : null,
          responsibleId: responsible || null,
          accountableId: accountable || null,
          consultedId: consulted || null,
          informedId: informed || null,
          assetId: processForm.assetDependency && assetId ? assetId : null,
          recurrence: processForm.kpiMeasurementRequired && kpiRecurrence ? kpiRecurrence : null,
          reviewDate: processForm.kpiMeasurementRequired && kpiReviewDate ? new Date(kpiReviewDate).toISOString() : null,
        }),
      });

      if (res.ok) {
        const newProcess = await res.json();

        // Upload onboarding files if any
        if (pendingOnboardingFiles.length > 0) {
          for (const file of pendingOnboardingFiles) {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("category", "employee_onboarding");
            try {
              await fetch(`/api/processes/${newProcess.id}/attachments`, { method: "POST", body: fd });
            } catch (err) {
              console.error("Error uploading onboarding file:", err);
            }
          }
          setPendingOnboardingFiles([]);
        }

        setProcesses([...processes, newProcess]);
        resetProcessForm();
        setIsAddProcessOpen(false);
        toast({
          title: t("Success"),
          description: t("Process created successfully"),
        });
      } else {
        const error = await res.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to create process"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding process:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create process"),
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  // Handle Edit Process
  const handleEditProcess = async () => {
    if (!editingProcess) return;

    // Validate form
    const errors: Record<string, string> = {};
    if (!editingProcess.name.trim()) {
      errors.name = t("Please enter the Process Name");
    } else if (!isValidName(editingProcess.name.trim())) {
      errors.name = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(errors).length > 0) {
      setProcessFormErrors(errors);
      return;
    }
    setProcessFormErrors({});

    setSaving(true);
    try {
      const { responsible, accountable, consulted, informed, frequency, location, assetId, recurrence, reviewDate, ...rest } = editingProcess;
      const locationArr = Array.isArray(location) ? location : [];
      const res = await fetch(`/api/processes/${editingProcess.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          processFrequency: frequency || null,
          location: locationArr.length > 0 ? JSON.stringify(locationArr) : null,
          responsibleId: responsible || null,
          accountableId: accountable || null,
          consultedId: consulted || null,
          informedId: informed || null,
          assetId: editingProcess.assetDependency && assetId ? assetId : null,
          recurrence: editingProcess.kpiMeasurementRequired && recurrence ? recurrence : null,
          reviewDate: editingProcess.kpiMeasurementRequired && reviewDate ? (typeof reviewDate === 'string' ? reviewDate : new Date(reviewDate).toISOString()) : null,
        }),
      });

      if (res.ok) {
        const updated = await res.json();

        // Upload new onboarding files if any
        if (editOnboardingFiles.length > 0) {
          for (const file of editOnboardingFiles) {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("category", "employee_onboarding");
            try {
              await fetch(`/api/processes/${editingProcess.id}/attachments`, { method: "POST", body: fd });
            } catch (err) {
              console.error("Error uploading onboarding file:", err);
            }
          }
          setEditOnboardingFiles([]);
        }

        setProcesses(processes.map((p) => (p.id === updated.id ? updated : p)));
        setIsEditProcessOpen(false);
        setEditingProcess(null);
        toast({
          title: t("Success"),
          description: t("Process updated successfully"),
        });
      } else {
        const error = await res.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to update process"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating process:", error);
      toast({
        title: t("Error"),
        description: t("Failed to update process"),
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  // Generate KPI chart data - only show data if KPI config exists
  const generateKPIChartData = () => {
    // Check if KPI config has any meaningful data
    const hasKpiConfigData = kpiConfig.objective.trim() !== "" ||
                              kpiConfig.dataSource.trim() !== "" ||
                              kpiConfig.expectedValue > 0 ||
                              kpiConfig.description.trim() !== "" ||
                              kpiConfig.formula.trim() !== "";

    // Return empty array if no KPI config
    if (!hasKpiConfigData) {
      return [];
    }

    return kpiMonths.map((month) => ({
      month,
      achievedValue: null,
      expectedValue: kpiConfig.expectedValue,
    }));
  };

  // Open Edit Process modal
  const openEditProcess = (process: Process) => {
    let locationArr: string[] = [];
    try {
      if (process.location) {
        if (Array.isArray(process.location)) {
          locationArr = process.location;
        } else if (typeof process.location === 'string') {
          locationArr = JSON.parse(process.location);
        }
      }
    } catch { /* not JSON, treat as empty */ }
    setEditingProcess({
      ...process,
      frequency: process.processFrequency || "",
      location: locationArr,
      responsible: process.responsibleId || "",
      accountable: process.accountableId || "",
      consulted: process.consultedId || "",
      informed: process.informedId || "",
    });
    setIsEditProcessOpen(true);

    // Fetch existing onboarding files
    setEditOnboardingFiles([]);
    setEditExistingOnboardingFiles([]);
    fetch(`/api/processes/${process.id}/attachments`)
      .then((res) => res.ok ? res.json() : [])
      .then((attachments: { id: string; fileName: string; fileSize?: number | null; filePath?: string; category?: string }[]) => {
        setEditExistingOnboardingFiles(
          attachments
            .filter((a) => a.category === "employee_onboarding")
            .map((a) => ({ id: a.id, fileName: a.fileName, fileSize: a.fileSize, filePath: a.filePath }))
        );
      })
      .catch(() => {});
  };

  // Open KPI Modal and fetch existing KPI data
  const openKPIModal = async (process: Process) => {
    setSelectedKPIProcess(process);
    setKpiConfig({ objective: "", description: "", dataSource: "", formula: "", expectedValue: 0, targetedAchievedValue: 0 });
    setKpiErrors({});
    setIsKPIModalOpen(true);

    // Fetch existing KPI config for this process
    try {
      const res = await fetch(`/api/process-kpi/${process.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setKpiConfig({
            objective: data.config.objective || "",
            description: data.config.description || "",
            dataSource: data.config.dataSource || "",
            formula: data.config.formula || "",
            expectedValue: data.config.expectedValue || 0,
            targetedAchievedValue: data.config.targetedAchievedValue || 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching KPI config:", error);
    }
  };

  // Save KPI Config
  const handleSaveKpi = async () => {
    const errors: Record<string, string> = {};
    if (!kpiConfig.objective.trim()) errors.objective = t("Please Enter Objective.");
    if (!kpiConfig.description.trim()) errors.description = t("Please Enter Description.");
    if (!kpiConfig.dataSource.trim()) errors.dataSource = t("Please Enter Data Source.");
    if (!kpiConfig.formula.trim()) errors.formula = t("Please Enter the Calculated Formula.");
    if (!kpiConfig.expectedValue) errors.expectedValue = t("Please Enter the Expected Score.");
    if (Object.keys(errors).length > 0) {
      setKpiErrors(errors);
      return;
    }
    setKpiErrors({});
    setKpiSaving(true);
    try {
      const res = await fetch(`/api/process-kpi/${selectedKPIProcess?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: kpiConfig }),
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("KPI configuration saved successfully") });
        setIsKPIModalOpen(false);
      } else {
        toast({ title: t("Error"), description: t("Failed to save KPI configuration"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to save KPI configuration"), variant: "destructive" });
    }
    setKpiSaving(false);
  };

  // Export Repository processes to CSV
  const handleExportRepository = () => {
    if (filteredProcesses.length === 0) {
      toast({ title: t("No Data"), description: t("No processes to export"), variant: "destructive" });
      return;
    }

    const headers = ["Reference ID", "Name", "Description", "Department", "Process Owner", "Process Frequency", "Nature Of Implementation", "Status"];
    const csvRows = [headers.join(",")];

    filteredProcesses.forEach((process) => {
      const row = [
        process.processCode || "",
        process.name || "",
        (process.description || "").replace(/,/g, ";").replace(/\n/g, " "),
        process.department?.name || "",
        process.owner?.fullName || "",
        process.processFrequency || process.frequency || "",
        process.natureOfImplementation || "",
        process.status || "",
      ].map(val => `"${val}"`);
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `processes_repository_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export BIA processes to CSV with all available BIA data
  const handleExportBIA = () => {
    // Export all processes shown in the BIA tab
    const biaProcesses = filteredProcesses;
    if (biaProcesses.length === 0) {
      toast({ title: t("No Data"), description: t("No processes to export"), variant: "destructive" });
      return;
    }

    // Collect all unique category names across all BIA assessments
    const allCategoryNames = new Set<string>();
    biaProcesses.forEach((process) => {
      const biaStatus = getBIAStatus(process.id);
      biaStatus?.categoryRatings?.forEach((cr) => {
        if (cr.categoryName) allCategoryNames.add(cr.categoryName);
      });
    });
    const categoryNames = Array.from(allCategoryNames);

    // Build headers: basic fields + category rating columns + metrics
    const headers = [
      "Reference ID",
      "Name",
      "Description",
      "Department",
      "Process Owner",
      "Process Frequency",
      "Nature Of Implementation",
      ...categoryNames.flatMap((cat) => [`${cat} - Rating`, `${cat} - Description`]),
      "Impact Rating",
      "Process Criticality",
      "RTO (Hours)",
      "RPO (Hours)",
      "Low",
      "Medium",
      "High",
      "Critical",
      "BIA Status",
      "Approver",
    ];
    const csvRows = [headers.map(h => `"${h}"`).join(",")];

    biaProcesses.forEach((process) => {
      const biaStatus = getBIAStatus(process.id);
      const categoryValues = categoryNames.flatMap((catName) => {
        const cr = biaStatus?.categoryRatings?.find((r) => r.categoryName === catName);
        return [cr?.rating || "", cr?.description || ""];
      });

      const row = [
        process.processCode || "",
        process.name || "",
        process.description || "",
        process.department?.name || "",
        process.owner?.fullName || "",
        process.processFrequency || process.frequency || "",
        process.natureOfImplementation || "",
        ...categoryValues,
        biaStatus?.impactRating?.toString() || "",
        biaStatus?.processCriticality || process.processCriticality || "",
        biaStatus?.rtoHours?.toString() || "",
        biaStatus?.rpoHours?.toString() || "",
        biaStatus?.lowValue?.toString() || "",
        biaStatus?.mediumValue?.toString() || "",
        biaStatus?.highValue?.toString() || "",
        biaStatus?.criticalValue?.toString() || "",
        biaStatus?.status || "",
        biaStatus?.approverName || "",
      ].map(val => `"${String(val).replace(/"/g, '""')}"`);
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `processes_bia_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download process template
  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/templates/process_template.xlsx";
    link.download = "process_template.xlsx";
    link.click();
  };

  // Handle file selection for import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  // Import processes from Excel file
  const handleImportProcesses = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      // Read Excel file using fetch and xlsx library
      const arrayBuffer = await importFile.arrayBuffer();
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      if (data.length === 0) {
        toast({ title: t("Error"), description: t("Excel file is empty"), variant: "destructive" });
        setImporting(false);
        return;
      }

      let importedCount = 0;
      let errorCount = 0;

      for (const row of data) {
        const processName = row["Process Name"]?.trim();
        if (!processName) continue;

        const description = row["Description"]?.trim() || "";
        const departmentName = row["Department"]?.trim() || "";
        const frequencyName = row["Process frequency"]?.trim() || "";
        const natureName = row["Nature of  implementation"]?.trim() || "";
        const locationName = row["Location"]?.trim() || "";

        try {
          // Find or create department
          let departmentId = "";
          if (departmentName) {
            const existingDept = departments.find(d => d.name.toLowerCase() === departmentName.toLowerCase());
            if (existingDept) {
              departmentId = existingDept.id;
            } else {
              // Create new department
              const deptRes = await fetch("/api/departments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: departmentName }),
              });
              if (deptRes.ok) {
                const newDept = await deptRes.json();
                departmentId = newDept.id;
                setDepartments(prev => [...prev, newDept]);
              }
            }
          }

          // Find or create process frequency
          let processFrequency = "";
          if (frequencyName) {
            const existingFreq = processFrequencies.find(f => f.toLowerCase() === frequencyName.toLowerCase());
            if (existingFreq) {
              processFrequency = existingFreq;
            } else {
              // Create new process frequency
              const freqRes = await fetch("/api/organization-settings/process-frequency", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: frequencyName }),
              });
              if (freqRes.ok) {
                const newFreq = await freqRes.json();
                processFrequency = newFreq.name;
                setProcessFrequencies(prev => [...prev, newFreq.name]);
              }
            }
          }

          // Find or create nature of implementation
          let natureOfImplementation = "";
          if (natureName) {
            const existingNature = natureOfImplementations.find(n => n.toLowerCase() === natureName.toLowerCase());
            if (existingNature) {
              natureOfImplementation = existingNature;
            } else {
              // Create new nature of implementation
              const natureRes = await fetch("/api/organization-settings/nature-of-implementation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: natureName }),
              });
              if (natureRes.ok) {
                const newNature = await natureRes.json();
                natureOfImplementation = newNature.name;
                setNatureOfImplementations(prev => [...prev, newNature.name]);
              }
            }
          }

          // Find or create location
          let location: string[] = [];
          if (locationName) {
            const existingLoc = locationOptions.find(l => l.label.toLowerCase() === locationName.toLowerCase());
            if (existingLoc) {
              location = [existingLoc.label];
            } else {
              // Create new location
              const locRes = await fetch("/api/organization-settings/location", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: locationName }),
              });
              if (locRes.ok) {
                const newLoc = await locRes.json();
                location = [newLoc.name];
                setLocationOptions(prev => [...prev, { value: newLoc.id || newLoc.name, label: newLoc.name }]);
              }
            }
          }

          // Create the process
          const processData = {
            name: processName,
            description,
            departmentId: departmentId || null,
            processFrequency: processFrequency || null,
            natureOfImplementation: natureOfImplementation || null,
            location: location.length > 0 ? JSON.stringify(location) : null,
          };

          const res = await fetch("/api/processes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(processData),
          });

          if (res.ok) {
            importedCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error("Error importing row:", err);
          errorCount++;
        }
      }

      if (importedCount > 0) {
        toast({
          title: t("Success"),
          description: t("Imported {count} processes").replace("{count}", String(importedCount)) +
            (errorCount > 0 ? ` (${errorCount} ${t("failed")})` : "")
        });
        fetchData();
      } else {
        toast({ title: t("Warning"), description: t("No processes were imported"), variant: "destructive" });
      }

      setShowImportDialog(false);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: t("Error"), description: t("Failed to import processes"), variant: "destructive" });
    }
    setImporting(false);
  };

  // BIA columns
  const biaColumns: ColumnDef<Process>[] = [
    {
      accessorKey: "processCode",
      header: t("Reference ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("processCode")}</span>,
    },
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "department.name",
      header: t("Department"),
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      accessorKey: "owner.fullName",
      header: t("Process Owner"),
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    {
      accessorKey: "processFrequency",
      header: t("Process Frequency"),
      cell: ({ row }) => row.original.processFrequency || "-",
    },
    {
      accessorKey: "processCriticality",
      header: t("Process Criticality"),
      cell: ({ row }) => {
        const biaStatus = getBIAStatus(row.original.id);
        const criticality = biaStatus?.processCriticality || row.original.processCriticality;
        if (!criticality) return "-";
        return (
          <Badge variant={criticality === "High" || criticality === "Critical" ? "destructive" : criticality === "Medium" ? "secondary" : "outline"}>
            {criticality}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => {
        const biaStatus = getBIAStatus(row.original.id);
        const status = biaStatus?.status || "Open";
        const isPendingApproval = status === "Pending Approval";
        const isApproved = status === "Approved";
        const isSentBack = status === "Sent Back";
        const hasComments = biaStatus && (isPendingApproval || isApproved || isSentBack);

        // DepartmentReviewer sees "View" button for all BIAs (they review pending ones)
        // Note: Reviewer role has Perform BIA access same as CustomerAdmin (not DepartmentReviewer behavior)
        if (isDepartmentReviewer && !isReviewer) {
          return (
            <button
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("View")}
            </button>
          );
        }

        // CustomerAdmin/Contributor view
        // If approved or pending approval - show View button
        if (isApproved || isPendingApproval) {
          return (
            <button
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("View")}
            </button>
          );
        }

        // If sent back - show Respond button (to re-submit)
        if (isSentBack) {
          return (
            <button
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              {t("Respond")}
            </button>
          );
        }

        // If BIA record exists (even with Open status) - show View button
        if (biaStatus) {
          return (
            <button
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("View")}
            </button>
          );
        }

        // No BIA record - show Perform BIA button
        return (
          <button
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            onClick={() => {
              setBiaProcess(row.original);
              setIsBIAFormOpen(true);
            }}
          >
            {t("Perform BIA")}
          </button>
        );
      },
    },
  ];

  // Filtered BIA columns based on visibility
  const filteredBiaColumns = biaColumns.filter((col) => {
    const key = (col as { accessorKey?: string }).accessorKey || (col as { id?: string }).id || "";
    return biaColumnVisibility[key] !== false;
  });

  // Process columns
  const processColumns: ColumnDef<Process>[] = [
    {
      accessorKey: "processCode",
      header: t("Reference ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("processCode")}</span>,
    },
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "description",
      header: t("Description"),
      cell: ({ row }) => {
        const desc = row.getValue("description") as string;
        return <span className="text-sm text-slate-400 truncate max-w-[180px] block">{desc || "-"}</span>;
      },
    },
    {
      accessorKey: "department.name",
      header: t("Department"),
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      accessorKey: "owner.fullName",
      header: t("Process Owner"),
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    {
      accessorKey: "processFrequency",
      header: t("Process Frequency"),
      cell: ({ row }) => row.original.processFrequency || "-",
    },
    {
      accessorKey: "natureOfImplementation",
      header: t("Nature Of Implementation"),
      cell: ({ row }) => row.original.natureOfImplementation || "-",
    },
    // Hide AI Risk column for Reviewer role
    ...(!isReviewer ? [{
      id: "aiRisk",
      header: t("AI Risk"),
      cell: ({ row }: { row: { original: Process } }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-primary-600 border-primary-200"
          onClick={() => handleEvaluateAI(row.original)}
          disabled={isAiGenerating && evaluatingProcess?.id === row.original.id}
        >
          {isAiGenerating && evaluatingProcess?.id === row.original.id ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          {t("AI Risk Evaluation")}
        </Button>
      ),
    }] : []),
    // Hide actions column for Reviewer and DepartmentContributor roles
    ...(!isDepartmentContributor && !isReviewer ? [{
      id: "actions",
      header: t("Actions"),
      cell: ({ row }: { row: { original: Process } }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
            onClick={() => openEditProcess(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
            onClick={() => {
              setDeletingProcessId(row.original.id);
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    }] : []),
  ];

  // Performance Dashboard columns - matching UAT structure (Process Name, Department Name, Action)
  const performanceColumns: ColumnDef<Process>[] = [
    {
      accessorKey: "name",
      header: t("Process Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "department.name",
      header: t("Department Name"),
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <button
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          onClick={() => openKPIModal(row.original)}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {t("View KPI")}
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">{t("Loading...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className={`flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
        <div className={`flex items-center gap-1.5 text-slate-500 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Dashboard")}
        </Link>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <span className="text-primary-700 font-medium">{t("Process")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Process")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className={`overflow-x-auto -mx-1 px-1 ${isRTL ? "flex justify-end" : ""}`}>
        <TabsList className={isRTL ? "flex-row-reverse" : ""}>
          <TabsTrigger value="repository">{t("Repository")}</TabsTrigger>
          <TabsTrigger value="bia">{t("Business Impact Analysis")}</TabsTrigger>
          <TabsTrigger value="performance">{t("Performance Dashboard")}</TabsTrigger>
        </TabsList>
        </div>

        {/* Repository Tab */}
        <TabsContent value="repository" className="mt-6">
          {/* Action Buttons */}
          <div className={`grid grid-cols-2 sm:flex sm:items-center gap-2 mb-4 ${isRTL ? "sm:justify-start" : "sm:justify-end"}`}>
            <Button variant="outline" size="sm" onClick={handleExportRepository} className={isRTL ? "flex-row-reverse" : ""}>
              <Upload className="h-4 w-4 me-2" />
              {t("Export")}
            </Button>
            {!isDepartmentContributor && (
              <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)} className={isRTL ? "flex-row-reverse" : ""}>
                <Download className="h-4 w-4 me-2" />
                {t("Import")}
              </Button>
            )}
            {canAddProcess && (
              <Button size="sm" className={`col-span-2 sm:col-span-1 ${isRTL ? "flex-row-reverse" : ""}`} onClick={() => setIsAddProcessOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("Add Process")}
              </Button>
            )}
          </div>
          {/* Table Card with Integrated Filters */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
              <div className="relative w-full sm:w-56">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t("Search processes...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:ms-auto">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Departments")}</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Process Owner")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Owners")}</SelectItem>
                    {processOwners.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Frequency")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Frequencies")}</SelectItem>
                    {processFrequencies.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {freq}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* DataGrid */}
            <DataGrid
              columns={processColumns}
              data={filteredProcesses}
              hideSearch={true}
              className="border-0 rounded-none"
            />
          </div>
        </TabsContent>

        {/* Business Impact Analysis Tab */}
        <TabsContent value="bia" className="mt-6">
          {/* Action Buttons */}
          <div className={`flex items-center gap-2 mb-4 ${isRTL ? "justify-start" : "justify-end"}`}>
            <Button variant="outline" size="sm" onClick={handleExportBIA} className={isRTL ? "flex-row-reverse" : ""}>
              <Upload className="h-4 w-4 me-2" />
              {t("Export")}
            </Button>
          </div>

          {/* Table Card with Integrated Filters */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
              <div className="relative w-full sm:w-56">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  placeholder={t("Search By Process ID, Name")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:ms-auto">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Departments")}</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Process Owner")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Owners")}</SelectItem>
                    {processOwners.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Frequency")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Frequencies")}</SelectItem>
                    {processFrequencies.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {freq}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 border-0 bg-transparent hover:bg-slate-100">
                      <Settings2 className="h-4 w-4 text-slate-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>{t("Toggle Columns")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {biaColumns.map((col) => {
                      const key = (col as { accessorKey?: string }).accessorKey || (col as { id?: string }).id || "";
                      const label = typeof col.header === "string" ? col.header : key;
                      if (key === "actions") return null;
                      return (
                        <DropdownMenuCheckboxItem
                          key={key}
                          checked={biaColumnVisibility[key] !== false}
                          onCheckedChange={(checked) =>
                            setBiaColumnVisibility((prev) => ({ ...prev, [key]: !!checked }))
                          }
                        >
                          {label}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <DataGrid
              columns={filteredBiaColumns}
              data={filteredProcesses}
              hideSearch={true}
              className="border-0 rounded-none"
            />
          </div>
        </TabsContent>

        {/* Performance Dashboard Tab - Matching UAT structure */}
        <TabsContent value="performance" className="mt-6 space-y-6">
          {/* Two Donut Charts Side by Side */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 ${isRTL ? "direction-rtl" : ""}`} style={isRTL ? { direction: 'rtl' } : undefined}>
            {/* Status Chart */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className={`px-4 sm:px-6 py-4 border-b border-slate-100 ${isRTL ? "text-right" : ""}`}>
                <h3 className="text-base font-semibold text-slate-800">{t("Status")}</h3>
              </div>
              <div className="p-6">
                {(() => {
                  const kpiProcesses = departmentFilteredProcesses.filter((p) => p.kpiMeasurementRequired);
                  const total = kpiProcesses.length || 1;
                  // For now, show all as "Achieved" since we don't have KPI status tracking yet
                  const statusData = [
                    { name: t("Scheduled"), value: 0, color: "#3b82f6" },
                    { name: t("Missed"), value: 0, color: "#f59e0b" },
                    { name: t("Overdue"), value: 0, color: "#22c55e" },
                    { name: t("Achieved"), value: kpiProcesses.length, color: "#1e3a5f" },
                  ];
                  const hasData = statusData.some(d => d.value > 0);

                  return (
                    <div className="flex flex-col items-center">
                      <div className="h-[200px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={hasData ? statusData.filter(d => d.value > 0) : [{ name: t("No Data"), value: 1, color: "#e5e7eb" }]}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ percent }) => hasData && percent ? `${(percent * 100).toFixed(0)}%` : ""}
                              labelLine={false}
                            >
                              {(hasData ? statusData.filter(d => d.value > 0) : [{ name: t("No Data"), value: 1, color: "#e5e7eb" }]).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {statusData.map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-sm text-slate-600">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Department Chart */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className={`px-4 sm:px-6 py-4 border-b border-slate-100 ${isRTL ? "text-right" : ""}`}>
                <h3 className="text-base font-semibold text-slate-800">{t("Department")}</h3>
              </div>
              <div className="p-6">
                {(() => {
                  const kpiProcesses = departmentFilteredProcesses.filter((p) => p.kpiMeasurementRequired);
                  // Group by department
                  const deptCounts: Record<string, number> = {};
                  kpiProcesses.forEach((p) => {
                    const deptName = p.department?.name || t("Unassigned");
                    deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
                  });
                  const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
                  const deptData = Object.entries(deptCounts).map(([name, value], idx) => ({
                    name,
                    value,
                    color: colors[idx % colors.length],
                  }));
                  const hasData = deptData.length > 0;
                  const total = kpiProcesses.length || 1;

                  return (
                    <div className="flex flex-col items-center">
                      <div className="h-[200px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={hasData ? deptData : [{ name: t("No Data"), value: 1, color: "#e5e7eb" }]}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ percent }) => hasData && percent ? `${(percent * 100).toFixed(0)}%` : ""}
                              labelLine={false}
                            >
                              {(hasData ? deptData : [{ name: t("No Data"), value: 1, color: "#e5e7eb" }]).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {(hasData ? deptData : []).map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-sm text-slate-600">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* KPI Processes Section */}
          {(() => {
            const kpiProcesses = departmentFilteredProcesses.filter((p) => p.kpiMeasurementRequired);
            const filteredKpiProcesses = kpiProcesses.filter((p) => {
              const matchesSearch = p.name.toLowerCase().includes(kpiSearchTerm.toLowerCase());
              const matchesDepartment = kpiDepartmentFilter === "all" || p.departmentId === kpiDepartmentFilter;
              return matchesSearch && matchesDepartment;
            });

            return (
              <>
                {/* Section Header */}
                <div className={`flex items-center justify-between mb-5 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <h3 className="text-base font-semibold text-slate-800">{t("KPI Processes")}</h3>
                  </div>
                </div>

                {/* Card with Search + Filter + Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
                  {/* Search and Filter Row */}
                  <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder={t("Search processes...")}
                        value={kpiSearchTerm}
                        onChange={(e) => setKpiSearchTerm(e.target.value)}
                        className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                      />
                    </div>
                    <div className="flex items-stretch sm:items-center gap-3 sm:ms-auto">
                      <Select value={kpiDepartmentFilter} onValueChange={setKpiDepartmentFilter}>
                        <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                          <SelectValue placeholder={t("Department")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="all">{t("All Departments")}</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Table or Empty State */}
                  {filteredKpiProcesses.length > 0 ? (
                    <DataGrid
                      columns={performanceColumns}
                      data={filteredKpiProcesses}
                      hideSearch={true}
                      className="border-0 rounded-none"
                    />
                  ) : (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                        <BarChart3 className="h-6 w-6 text-primary-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 mb-1">{t("No KPI Data")}</p>
                      <p className="text-xs text-slate-400">{t("Enable KPI Measurement Required when adding a process to see it here")}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[420px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <p className="text-sm text-slate-600">
              {t("Are you sure you want to delete this process? This action cannot be undone.")}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteProcess}>
              {t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Risk Evaluation Dialog */}
      <Dialog open={isAIEvaluationOpen} onOpenChange={setIsAIEvaluationOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Sparkles className="h-5 w-5 text-primary-600" />
                {t("AI Risk Evaluation")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">{t("Process")}: {evaluatingProcess?.name}</p>
              <p className="text-xs text-slate-500 line-clamp-2">{evaluatingProcess?.description}</p>
            </div>

            {isAiGenerating ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 text-primary-600 animate-spin" />
                <p className="text-sm text-slate-600 font-medium">{t("AI is identifying potential risks...")}</p>
                <p className="text-xs text-slate-400">{t("This may take up to 30 seconds")}</p>
              </div>
            ) : aiRisks.length > 0 ? (
              <div className="space-y-6">
                {/* Semantic Matching Status Banner */}
                {(isSemanticLoading || isSemanticPolling) && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-blue-900">{t("Semantic Matching in Progress")}</h4>
                      <p className="text-sm text-blue-700">
                        {semanticStatus?.status === "processing"
                          ? t("Comparing with existing risk library...")
                          : t("Queued for processing...")}
                      </p>
                    </div>
                  </div>
                )}

                {semanticError && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-red-900">{t("Operation Failed")}</h4>
                      <p className="text-sm text-red-700">{semanticError}</p>
                    </div>
                  </div>
                )}

                {/* Match Preview Results - shown after semantic matching completes */}
                {showMatchResults && semanticResult && !semanticMatchStats && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="font-medium text-amber-900 mb-2">{t("Match Preview")}</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-amber-700">
                          <span className="font-medium">{t("New Risks")}:</span> {semanticResult.summary?.newRisksToCreate || 0}
                        </p>
                        <p className="text-amber-700">
                          <span className="font-medium">{t("Existing Matches")}:</span> {semanticResult.summary?.existingRisksToMatch || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-amber-700">
                          <span className="font-medium">{t("New Controls")}:</span> {semanticResult.summary?.newControlsToCreate || 0}
                        </p>
                        <p className="text-amber-700">
                          <span className="font-medium">{t("New Threats")}:</span> {semanticResult.summary?.newThreatsToCreate || 0}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                      {t("Click 'Confirm & Register' to add these risks to your library.")}
                    </p>
                  </div>
                )}

                {/* Registration Complete Banner */}
                {semanticMatchStats && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-green-900">{t("Risk Library Updated")}</h4>
                      <p className="text-sm text-green-700">
                        {t("Created")}: {semanticMatchStats.risks?.created || semanticMatchStats.created || 0} | {t("Matched")}: {semanticMatchStats.risks?.matched || semanticMatchStats.updated || 0} | {t("Skipped")}: {semanticMatchStats.risks?.skipped || semanticMatchStats.skipped || 0}
                      </p>
                    </div>
                  </div>
                )}

                {/* Registering Banner */}
                {isSemanticRegistering && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-blue-900">{t("Registering Risks")}</h4>
                      <p className="text-sm text-blue-700">{t("Adding risks to your library...")}</p>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <h4 className="font-medium text-primary-900 mb-2">{t("Detected Risks")} ({aiRisks.length})</h4>
                  <p className="text-sm text-primary-700">
                    {semanticMatchStats
                      ? t("These risks have been compared with your existing library. Only new risks were added to the Risk Register.")
                      : showMatchResults
                        ? t("Review the matching results above. Click 'Confirm & Register' to add new risks to your library.")
                        : (isSemanticLoading || isSemanticPolling)
                          ? t("Comparing with existing risk library...")
                          : t("Review the AI-identified risks below. Remove any unwanted risks, then click 'Match with Library' to find duplicates.")}
                  </p>
                </div>
                <div className="space-y-4">
                  {aiRisks.map((risk, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white shadow-sm">
                      <div className="flex justify-between items-start">
                        <h5 className="font-semibold text-slate-900">{risk.name}</h5>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            (risk.riskRating || risk.risk_rating) === "High" ? "bg-error-light text-error-dark" :
                              (risk.riskRating || risk.risk_rating) === "Medium" ? "bg-warning-light text-warning-dark" :
                                "bg-success-light text-success-dark"
                          }>
                            {risk.riskRating || risk.risk_rating || "Medium"}
                          </Badge>
                          {/* Delete button - only show before semantic matching starts */}
                          {!isSemanticLoading && !isSemanticPolling && !showMatchResults && !semanticMatchStats && !isSemanticRegistering && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteAiRisk(idx)}
                              title={t("Remove this risk")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">{risk.description}</p>

                      {/* Handle both formats: from DB (threats array) and from AI (threats string array) */}
                      {(risk.threats?.length > 0) && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-400 uppercase">{t("Threats")}</p>
                          <div className="flex flex-wrap gap-2">
                            {risk.threats.map((tm: any, tIdx: number) => (
                              <Badge key={tIdx} variant="outline" className="text-[10px] py-0">
                                {typeof tm === "string" ? tm : (tm.threat?.name || tm.threatId)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Handle both formats: from DB (controlRisks) and from AI (controls string array) */}
                      {(risk.controlRisks?.length > 0 || risk.controls?.length > 0) && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-400 uppercase">{t("Suggested Controls")}</p>
                          <div className="space-y-1">
                            {(risk.controlRisks || []).map((cr: any, cIdx: number) => (
                              <div key={cIdx} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded">
                                <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">{cr.control?.functionalGrouping || "protect"}</span>
                                <span className="flex-1">{cr.control?.name}</span>
                              </div>
                            ))}
                            {(risk.controls || []).map((ctrl: string, cIdx: number) => (
                              <div key={`ctrl-${cIdx}`} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded">
                                <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">protect</span>
                                <span className="flex-1">{ctrl}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Sparkles className="h-12 w-12 mb-4 opacity-20" />
                <p>{t("No risks generated yet.")}</p>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setIsAIEvaluationOpen(false);
                setShowMatchResults(false);
                resetSemanticMatch();
              }}
              disabled={isSemanticLoading || isSemanticPolling || isSemanticRegistering}
            >
              {t("Close")}
            </Button>

            {/* Phase 1: Match with Library button - shown when risks are generated but not yet matched */}
            {!showMatchResults && !semanticMatchStats && (
              <Button
                onClick={handleStartSemanticMatch}
                disabled={isSemanticLoading || isSemanticPolling || isAiGenerating || aiRisks.length === 0}
              >
                {(isSemanticLoading || isSemanticPolling) ? (
                  <>
                    <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t("Matching...")}
                  </>
                ) : (
                  t("Match with Library")
                )}
              </Button>
            )}

            {/* Phase 2: Confirm & Register button - shown after matching completes */}
            {showMatchResults && !semanticMatchStats && (
              <Button
                onClick={handleRegisterAndNavigate}
                disabled={isSemanticRegistering}
              >
                {isSemanticRegistering ? (
                  <>
                    <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t("Registering...")}
                  </>
                ) : (
                  t("Confirm & Register")
                )}
              </Button>
            )}

            {/* Phase 3: Go to Risk Register button - shown after registration completes */}
            {semanticMatchStats && (
              <Button onClick={handleGoToRiskRegister}>
                {t("Go to Risk Register")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* BIA Form Dialog */}
      <Dialog open={isBIAFormOpen} onOpenChange={setIsBIAFormOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Business Impact Analysis")} - {biaProcess?.name}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Status and Controls Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-sm font-semibold text-slate-900">{t("Status & Approval")}</h4>
                <Badge variant="outline" className="bg-info-light text-info-dark border-info">{t("Open")}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                  <Select value={biaDepartment} onValueChange={(value) => { setBiaDepartment(value); setBiaApprover(""); }}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select Department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Approver")}</Label>
                  <Select value={biaApprover} onValueChange={setBiaApprover} disabled={!biaDepartment}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={biaDepartment ? t("Select Approver") : t("Select Department First")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users
                        .filter((user) => user.departmentId === biaDepartment && user.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer"))
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" disabled={!biaApprover || saving} onClick={handleSubmitForApproval}>
                  {saving ? t("Submitting...") : t("Submit For Approval")}
                </Button>
              </div>
            </div>

            {/* Impact Assessment Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Impact Assessment")}</h4>

              {/* Category Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <div className="min-w-[500px]">
                {/* Table Header */}
                <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-100">
                  <div className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Category")}</div>
                  <div className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">{t("BIA Rating")}</div>
                  <div className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</div>
                </div>

                {/* Table Rows */}
                {biaRatings.map((item, index) => (
                  <div key={item.category} className="grid grid-cols-3 border-b border-slate-100 last:border-b-0">
                    <div className="px-4 py-3 text-sm font-medium text-slate-700">{t(item.category)}</div>
                    <div className="px-4 py-3 flex justify-center">
                      <Select
                        value={item.rating}
                        onValueChange={(value) => handleBiaRatingChange(index, value)}
                      >
                        <SelectTrigger className="w-full sm:w-[140px] bg-white">
                          <SelectValue placeholder={t("Select")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {biaRatingOptions.map((option) => (
                            <SelectItem key={option.id} value={option.label}>
                              {t(option.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="px-4 py-3 text-sm text-slate-500">
                      {item.description || "-"}
                    </div>
                  </div>
                ))}
                </div>
              </div>

              {/* Impact Rating Box */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-800">{t("Impact Rating")} = {calculateImpactRating()}</span>
                    <p className="text-xs text-slate-500 mt-1">{t("Note: The highest rating will be taken")}</p>
                  </div>
                  <Badge
                    className={
                      getProcessCriticality() === "High"
                        ? "bg-error-light text-error-dark border-error"
                        : getProcessCriticality() === "Medium"
                          ? "bg-warning-light text-warning-dark border-warning"
                          : "bg-success-light text-success-dark border-success"
                    }
                  >
                    {getProcessCriticality() || t("N/A")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Recovery Metrics Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Recovery Metrics")}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("RTO")}</Label>
                  <Input
                    type="number"
                    value={rto}
                    onChange={(e) => setRto(e.target.value)}
                    min="0"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Low")}</Label>
                  <Input
                    type="number"
                    value={lowValue}
                    onChange={(e) => setLowValue(e.target.value)}
                    min="0"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Critical")}</Label>
                  <Input
                    type="number"
                    value={criticalValue}
                    onChange={(e) => setCriticalValue(e.target.value)}
                    min="0"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("High")}</Label>
                  <Input
                    type="number"
                    value={highValue}
                    onChange={(e) => setHighValue(e.target.value)}
                    min="0"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Medium")}</Label>
                  <Input
                    type="number"
                    value={mediumValue}
                    onChange={(e) => setMediumValue(e.target.value)}
                    min="0"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("RPO")}</Label>
                  <Input
                    type="number"
                    value={rpo}
                    onChange={(e) => setRpo(e.target.value)}
                    min="0"
                    className="mt-1.5 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsBIAFormOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveBIA} disabled={saving}>
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Process Dialog */}
      <Dialog open={isAddProcessOpen} onOpenChange={(open) => {
        setIsAddProcessOpen(open);
        if (!open) resetProcessForm();
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onInteractOutside={(e) => e.preventDefault()} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Process")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Basic Information")}</h4>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-slate-700">{t("Process Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    value={processForm.name}
                    onChange={(e) => {
                      setProcessForm({ ...processForm, name: e.target.value });
                      if (processFormErrors.name) setProcessFormErrors((prev) => { const { name, ...rest } = prev; return rest; });
                    }}
                    placeholder={t("Enter process name")}
                    className={`mt-1.5 bg-white ${processFormErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {processFormErrors.name && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{processFormErrors.name}</p></div>)}
                </div>
                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Textarea
                    id="description"
                    value={processForm.description}
                    onChange={(e) => setProcessForm({ ...processForm, description: e.target.value })}
                    placeholder={t("Enter process description")}
                    className="mt-1.5 bg-white"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                    <Select value={processForm.departmentId} onValueChange={(value) => setProcessForm({ ...processForm, departmentId: value, ownerId: "" })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Process Details Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Process Details")}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Process Owner")}</Label>
                  <Select value={processForm.ownerId} onValueChange={(value) => setProcessForm({ ...processForm, ownerId: value })} disabled={!processForm.departmentId}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={processForm.departmentId ? t("Select owner") : t("Select department first")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.filter((user) => user.departmentId === processForm.departmentId && user.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer")).map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Process Frequency")}</Label>
                  <Select value={processForm.frequency} onValueChange={(value) => setProcessForm({ ...processForm, frequency: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select frequency")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {processFrequencies.map((freq) => (
                        <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Nature of Implementation")}</Label>
                  <Select value={processForm.natureOfImplementation} onValueChange={(value) => setProcessForm({ ...processForm, natureOfImplementation: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select implementation")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {natureOfImplementations.map((nature) => (
                        <SelectItem key={nature} value={nature}>{nature}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Location")}</Label>
                  <div className="mt-1.5">
                    <MultiSelect
                      options={locationOptions}
                      selected={processForm.location}
                      onChange={(selected) => setProcessForm({ ...processForm, location: selected })}
                      placeholder={t("Select locations")}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Operational Complexity")}</Label>
                  <Select value={processForm.operationalComplexity} onValueChange={(value) => setProcessForm({ ...processForm, operationalComplexity: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select complexity")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {operationalComplexities.map((complexity) => (
                        <SelectItem key={complexity} value={complexity}>{complexity}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Dependencies & Options Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Dependencies & Options")}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="assetDependency"
                    checked={processForm.assetDependency}
                    onCheckedChange={(checked) => setProcessForm({ ...processForm, assetDependency: checked as boolean })}
                  />
                  <Label htmlFor="assetDependency" className="text-sm text-slate-700 font-normal">{t("Asset Dependency")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="externalDependency"
                    checked={processForm.externalDependency}
                    onCheckedChange={(checked) => setProcessForm({ ...processForm, externalDependency: checked as boolean })}
                  />
                  <Label htmlFor="externalDependency" className="text-sm text-slate-700 font-normal">{t("External Dependency")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="kpiMeasurementRequired"
                    checked={processForm.kpiMeasurementRequired}
                    onCheckedChange={(checked) => setProcessForm({ ...processForm, kpiMeasurementRequired: checked as boolean })}
                  />
                  <Label htmlFor="kpiMeasurementRequired" className="text-sm text-slate-700 font-normal">{t("KPI Measurement Required")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="piiCapture"
                    checked={processForm.piiCapture}
                    onCheckedChange={(checked) => setProcessForm({ ...processForm, piiCapture: checked as boolean })}
                  />
                  <Label htmlFor="piiCapture" className="text-sm text-slate-700 font-normal">{t("PII Capture")}</Label>
                </div>
              </div>

              {/* Conditional fields based on checkbox selections */}
              {processForm.assetDependency && (
                <div className="mt-4">
                  <Label className="text-sm font-medium text-slate-700">{t("Select Asset")}</Label>
                  <Select value={processForm.assetId} onValueChange={(value) => setProcessForm({ ...processForm, assetId: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select an asset")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {assets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>{asset.assetId} - {asset.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {processForm.kpiMeasurementRequired && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI Recurrence")}</Label>
                    <Select value={processForm.kpiRecurrence} onValueChange={(value) => setProcessForm({ ...processForm, kpiRecurrence: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select recurrence")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="Yearly">{t("Yearly")}</SelectItem>
                        <SelectItem value="Half-Yearly">{t("Half-Yearly")}</SelectItem>
                        <SelectItem value="Quarterly">{t("Quarterly")}</SelectItem>
                        <SelectItem value="Monthly">{t("Monthly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Review Date")}</Label>
                    <div className="mt-1.5">
                      <DatePicker
                        value={processForm.kpiReviewDate}
                        onChange={(date) => setProcessForm({ ...processForm, kpiReviewDate: date ? formatLocalDate(date) : "" })}
                        placeholder={t("Select date")}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RACI Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("RACI Matrix")}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Responsible")}</Label>
                  <Select value={processForm.responsible} onValueChange={(value) => setProcessForm({ ...processForm, responsible: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select responsible")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Accountable")}</Label>
                  <Select value={processForm.accountable} onValueChange={(value) => setProcessForm({ ...processForm, accountable: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select accountable")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Consulted")}</Label>
                  <Select value={processForm.consulted} onValueChange={(value) => setProcessForm({ ...processForm, consulted: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select consulted")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Informed")}</Label>
                  <Select value={processForm.informed} onValueChange={(value) => setProcessForm({ ...processForm, informed: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select informed")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Employee Onboarding Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Employee Onboarding")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("Upload employee onboarding documents for this process.")}
              </p>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center transition-colors border-slate-300 hover:border-slate-400"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) setPendingOnboardingFiles((prev) => [...prev, ...files]);
                }}
              >
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-slate-400" />
                  <p className="text-sm text-slate-600">
                    {t("Drag and drop files here, or")}{" "}
                    <button
                      type="button"
                      onClick={() => onboardingFileInputRef.current?.click()}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {t("browse")}
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("Supported formats: PDF, DOCX, XLSX, CSV, PNG, JPG, PPT")}
                  </p>
                  <input
                    ref={onboardingFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) setPendingOnboardingFiles((prev) => [...prev, ...Array.from(files)]);
                      if (onboardingFileInputRef.current) onboardingFileInputRef.current.value = "";
                    }}
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.ppt,.pptx"
                  />
                </div>
              </div>
              {pendingOnboardingFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("Files to Upload")} ({pendingOnboardingFiles.length})</Label>
                  <div className="border rounded-lg divide-y">
                    {pendingOnboardingFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPendingOnboardingFiles((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddProcessOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddProcess} disabled={saving}>
              {saving ? t("Saving...") : t("Add Process")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Process Dialog */}
      <Dialog open={isEditProcessOpen} onOpenChange={(open) => {
        setIsEditProcessOpen(open);
        if (!open) setEditingProcess(null);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onInteractOutside={(e) => e.preventDefault()} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Process")}</DialogTitle>
            </DialogHeader>
          </div>
          {editingProcess && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Basic Information")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Process Code")}</Label>
                    <Input
                      value={editingProcess.processCode}
                      disabled
                      className="mt-1.5 bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                    <Input
                      value={editingProcess.status}
                      disabled
                      className="mt-1.5 bg-slate-50"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="editName" className="text-sm font-medium text-slate-700">{t("Process Name")}</Label>
                  <Input
                    id="editName"
                    value={editingProcess.name}
                    onChange={(e) => setEditingProcess({ ...editingProcess, name: e.target.value })}
                    placeholder={t("Enter process name")}
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="editDescription" className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Textarea
                    id="editDescription"
                    value={editingProcess.description || ""}
                    onChange={(e) => setEditingProcess({ ...editingProcess, description: e.target.value })}
                    placeholder={t("Enter process description")}
                    className="mt-1.5 bg-white"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                    <Select value={editingProcess.departmentId || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, departmentId: value, ownerId: "" })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Process Details Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Process Details")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Process Owner")}</Label>
                    <Select value={editingProcess.ownerId || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, ownerId: value })} disabled={!editingProcess.departmentId}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={editingProcess.departmentId ? t("Select owner") : t("Select department first")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users.filter((user) => user.departmentId === editingProcess.departmentId && user.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer")).map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Process Frequency")}</Label>
                    <Select value={editingProcess.frequency || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, frequency: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select frequency")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {processFrequencies.map((freq) => (
                          <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Nature of Implementation")}</Label>
                    <Select value={editingProcess.natureOfImplementation || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, natureOfImplementation: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select implementation")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {natureOfImplementations.map((nature) => (
                          <SelectItem key={nature} value={nature}>{nature}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Location")}</Label>
                    <div className="mt-1.5">
                      <MultiSelect
                        options={locationOptions}
                        selected={Array.isArray(editingProcess.location) ? editingProcess.location as string[] : []}
                        onChange={(selected) => setEditingProcess({ ...editingProcess, location: selected })}
                        placeholder={t("Select locations")}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-medium text-slate-700">{t("Operational Complexity")}</Label>
                    <Select value={editingProcess.operationalComplexity || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, operationalComplexity: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select complexity")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {operationalComplexities.map((complexity) => (
                          <SelectItem key={complexity} value={complexity}>{complexity}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Dependencies & Options Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Dependencies & Options")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="editAssetDependency"
                      checked={editingProcess.assetDependency || false}
                      onCheckedChange={(checked) => setEditingProcess({ ...editingProcess, assetDependency: checked as boolean })}
                    />
                    <Label htmlFor="editAssetDependency" className="text-sm text-slate-700 font-normal">{t("Asset Dependency")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="editExternalDependency"
                      checked={editingProcess.externalDependency || false}
                      onCheckedChange={(checked) => setEditingProcess({ ...editingProcess, externalDependency: checked as boolean })}
                    />
                    <Label htmlFor="editExternalDependency" className="text-sm text-slate-700 font-normal">{t("External Dependency")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="editKpiMeasurementRequired"
                      checked={editingProcess.kpiMeasurementRequired || false}
                      onCheckedChange={(checked) => setEditingProcess({ ...editingProcess, kpiMeasurementRequired: checked as boolean })}
                    />
                    <Label htmlFor="editKpiMeasurementRequired" className="text-sm text-slate-700 font-normal">{t("KPI Measurement Required")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="editPiiCapture"
                      checked={editingProcess.piiCapture || false}
                      onCheckedChange={(checked) => setEditingProcess({ ...editingProcess, piiCapture: checked as boolean })}
                    />
                    <Label htmlFor="editPiiCapture" className="text-sm text-slate-700 font-normal">{t("PII Capture")}</Label>
                  </div>
                </div>

                {/* Conditional fields based on checkbox selections */}
                {editingProcess.assetDependency && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium text-slate-700">{t("Select Asset")}</Label>
                    <Select value={editingProcess.assetId || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, assetId: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select an asset")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>{asset.assetId} - {asset.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {editingProcess.kpiMeasurementRequired && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("KPI Recurrence")}</Label>
                      <Select value={editingProcess.recurrence || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, recurrence: value })}>
                        <SelectTrigger className="w-full mt-1.5 bg-white">
                          <SelectValue placeholder={t("Select recurrence")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="Yearly">{t("Yearly")}</SelectItem>
                          <SelectItem value="Half-Yearly">{t("Half-Yearly")}</SelectItem>
                          <SelectItem value="Quarterly">{t("Quarterly")}</SelectItem>
                          <SelectItem value="Monthly">{t("Monthly")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Review Date")}</Label>
                      <div className="mt-1.5">
                        <DatePicker
                          value={editingProcess.reviewDate ? formatLocalDate(new Date(editingProcess.reviewDate)) : ""}
                          onChange={(date) => setEditingProcess({ ...editingProcess, reviewDate: date ? formatLocalDate(date) : undefined })}
                          placeholder={t("Select date")}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RACI Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("RACI Matrix")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Responsible")}</Label>
                    <Select value={editingProcess.responsible || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, responsible: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select responsible")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Accountable")}</Label>
                    <Select value={editingProcess.accountable || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, accountable: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select accountable")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Consulted")}</Label>
                    <Select value={editingProcess.consulted || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, consulted: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select consulted")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Informed")}</Label>
                    <Select value={editingProcess.informed || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, informed: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select informed")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Employee Onboarding Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Employee Onboarding")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("Upload employee onboarding documents for this process.")}
                </p>

                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center transition-colors border-slate-300 hover:border-slate-400"
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length > 0) setEditOnboardingFiles((prev) => [...prev, ...files]);
                  }}
                >
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 mx-auto text-slate-400" />
                    <p className="text-sm text-slate-600">
                      {t("Drag and drop files here, or")}{" "}
                      <button
                        type="button"
                        onClick={() => editOnboardingFileInputRef.current?.click()}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {t("browse")}
                      </button>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("Supported formats: PDF, DOCX, XLSX, CSV, PNG, JPG, PPT")}
                    </p>
                    <input
                      ref={editOnboardingFileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) setEditOnboardingFiles((prev) => [...prev, ...Array.from(files)]);
                        if (editOnboardingFileInputRef.current) editOnboardingFileInputRef.current.value = "";
                      }}
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.ppt,.pptx"
                    />
                  </div>
                </div>
                {editExistingOnboardingFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("Existing Files")} ({editExistingOnboardingFiles.length})</Label>
                    <div className="border rounded-lg divide-y">
                      {editExistingOnboardingFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="text-sm font-medium">{file.fileName}</p>
                              {file.fileSize && <p className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {file.filePath && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => window.open(file.filePath, "_blank")}
                                  title={t("View")}
                                >
                                  <Eye className="h-4 w-4 text-primary-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = file.filePath!;
                                    link.download = file.fileName;
                                    link.click();
                                  }}
                                  title={t("Download")}
                                >
                                  <Download className="h-4 w-4 text-green-600" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/processes/${editingProcess?.id}/attachments/${file.id}`, { method: "DELETE" });
                                  if (res.ok) {
                                    setEditExistingOnboardingFiles((prev) => prev.filter((f) => f.id !== file.id));
                                  }
                                } catch (err) {
                                  console.error("Error deleting file:", err);
                                }
                              }}
                              title={t("Delete")}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {editOnboardingFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("New Files to Upload")} ({editOnboardingFiles.length})</Label>
                    <div className="border rounded-lg divide-y">
                      {editOnboardingFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditOnboardingFiles((prev) => prev.filter((_, i) => i !== index))}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditProcessOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditProcess} disabled={saving}>
              {saving ? t("Saving...") : t("Save Changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* KPI Details Modal */}
      <Dialog open={isKPIModalOpen} onOpenChange={(open) => {
        setIsKPIModalOpen(open);
        if (!open) { setSelectedKPIProcess(null); setKpiErrors({}); }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("KPI Details")} - {selectedKPIProcess?.name}</DialogTitle>
            </DialogHeader>
          </div>
          {selectedKPIProcess && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
              {/* KPI Chart Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-sm font-semibold text-slate-900">{t("Performance Chart")}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">{t("Year")}</span>
                    <Select value={selectedKPIYear} onValueChange={setSelectedKPIYear}>
                      <SelectTrigger className="w-[100px] bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {kpiYears.map((year) => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setSelectedKPIYear("2026")}
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div>
                    {/* Line Chart */}
                    <div className="h-[250px] mb-4">
                      {generateKPIChartData().length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {t("No KPI data available. Configure KPI details below to see the performance chart.")}
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={generateKPIChartData()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis domain={[0, 100]} />
                            <RechartsTooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="achievedValue"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ fill: "#3b82f6", r: 4 }}
                              name={t("Achieved Value")}
                              connectNulls={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="expectedValue"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              name={t("Expected Value")}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Legend - only show if chart has data */}
                    {generateKPIChartData().length > 0 && (
                      <div className="flex justify-end gap-6">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-1 bg-blue-500" />
                          <span className="text-sm text-slate-600">{t("Achieved Value")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-1 bg-amber-500" />
                          <span className="text-sm text-slate-600">{t("Expected Value")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* KPI Configuration Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("KPI Configuration")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI Objective")}</Label>
                    <Input
                      placeholder={t("Enter Objective")}
                      value={kpiConfig.objective}
                      onChange={(e) => {
                        setKpiConfig({ ...kpiConfig, objective: e.target.value });
                        if (kpiErrors.objective) setKpiErrors((prev) => { const { objective, ...rest } = prev; return rest; });
                      }}
                      className={`mt-1.5 bg-white ${kpiErrors.objective ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    {kpiErrors.objective && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{kpiErrors.objective}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI Description")}</Label>
                    <Input
                      placeholder={t("Enter Description")}
                      value={kpiConfig.description}
                      onChange={(e) => {
                        setKpiConfig({ ...kpiConfig, description: e.target.value });
                        if (kpiErrors.description) setKpiErrors((prev) => { const { description, ...rest } = prev; return rest; });
                      }}
                      className={`mt-1.5 bg-white ${kpiErrors.description ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    {kpiErrors.description && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{kpiErrors.description}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI Data Source")}</Label>
                    <Input
                      placeholder={t("Enter Data Source")}
                      value={kpiConfig.dataSource}
                      onChange={(e) => {
                        setKpiConfig({ ...kpiConfig, dataSource: e.target.value });
                        if (kpiErrors.dataSource) setKpiErrors((prev) => { const { dataSource, ...rest } = prev; return rest; });
                      }}
                      className={`mt-1.5 bg-white ${kpiErrors.dataSource ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    {kpiErrors.dataSource && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{kpiErrors.dataSource}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI Measurement Formula")}</Label>
                    <Input
                      placeholder={t("Enter the KPI Calculation Formula")}
                      value={kpiConfig.formula}
                      onChange={(e) => {
                        setKpiConfig({ ...kpiConfig, formula: e.target.value });
                        if (kpiErrors.formula) setKpiErrors((prev) => { const { formula, ...rest } = prev; return rest; });
                      }}
                      className={`mt-1.5 bg-white ${kpiErrors.formula ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    {kpiErrors.formula && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{kpiErrors.formula}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Expected Value")}</Label>
                    <Input
                      type="number"
                      value={kpiConfig.expectedValue || ""}
                      onChange={(e) => {
                        setKpiConfig({ ...kpiConfig, expectedValue: parseInt(e.target.value) || 0 });
                        if (kpiErrors.expectedValue) setKpiErrors((prev) => { const { expectedValue, ...rest } = prev; return rest; });
                      }}
                      className={`mt-1.5 bg-white ${kpiErrors.expectedValue ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    {kpiErrors.expectedValue && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{kpiErrors.expectedValue}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Targeted Achieved Value")}</Label>
                    <Input
                      type="number"
                      value={kpiConfig.targetedAchievedValue || ""}
                      onChange={(e) => setKpiConfig({ ...kpiConfig, targetedAchievedValue: parseInt(e.target.value) || 0 })}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* KPI Records Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("KPI Records")}</h4>
                <div className="border border-slate-200 rounded-lg p-8 bg-slate-50">
                  <div className="flex flex-col items-center justify-center text-center">
                    <p className="text-slate-400">{t("No KPI records yet")}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setKpiErrors({}); setIsKPIModalOpen(false); }}>
              {t("Close")}
            </Button>
            <Button type="button" onClick={handleSaveKpi} disabled={kpiSaving}>
              {kpiSaving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Process Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        setShowImportDialog(open);
        if (!open) {
          setImportFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Import Processes")}
              </DialogTitle>
              <DialogDescription>
                {t("Import processes from an Excel file. The file should have columns: Process Name (required), Description, Department, Process frequency, Nature of implementation, Location.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")}</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {importFile && (
                <p className="text-sm text-slate-500 mt-1">
                  {t("Selected")}: {importFile.name}
                </p>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>{t("Note")}:</strong> {t("If Department, Process frequency, Nature of implementation, or Location values don't exist, they will be automatically created.")}
              </p>
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex flex-row items-center justify-between gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t("Download Template")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false);
                  setImportFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                {t("Cancel")}
              </Button>
              <Button onClick={handleImportProcesses} disabled={!importFile || importing}>
                {importing ? t("Importing...") : t("Import")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
