"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Download, Upload, Search, Sparkles, FileText, Eye, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { useUserRoles } from "@/hooks/usePermissions";
<<<<<<< Updated upstream
import {
  startRiskGenerationJob,
  checkRiskGenerationStatus,
  getRiskGenerationResult
} from "@/actions/risk-generation";
=======
import { RiskGenerationResponse } from "@/types/ai-types";
>>>>>>> Stashed changes

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
}

interface BIAData {
  ratings: BIARating[];
  rto: string;
  rpo: string;
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
  frequency?: string;
  natureOfImplementation?: string;
  assetDependency?: boolean;
  externalDependency?: boolean;
  location?: string;
  kpiMeasurementRequired?: boolean;
  piiCapture?: boolean;
  operationalComplexity?: string;
  lastAuditDate?: string;
  responsible?: string;
  accountable?: string;
  consulted?: string;
  informed?: string;
  biaCompleted?: boolean;
  processCriticality?: string;
  biaData?: BIAData;
}

interface BIARating {
  category: string;
  rating: "High" | "Medium" | "Low" | "";
  description: string;
}

interface ProcessBIAStatus {
  processId: string;
  status: string;
  impactRating?: number;
  processCriticality?: string;
}

const processTypes = ["Primary", "Management", "Supporting"];
const processFrequencies = ["Daily", "Weekly", "Monthly", "Quarterly", "Bi-annually", "Annually", "As needed"];
const natureOfImplementations = ["Manual", "Automated", "Manual + Automated"];
const operationalComplexities = ["Low", "Medium", "High"];
const locations = ["Head Office", "Branch Office", "Remote", "Data Center"];

const impactDescriptions = {
  High: "Major fines/legal action, Complete service outage, > $100K of loss",
  Medium: "Local media/social concern, Reportable incident, Partial service disruption, $10K – $100K",
  Low: "Limited visibility, Minor compliance delay, Workaround available",
};

export default function ProcessPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const userRoles = useUserRoles();

  // Check if user is DepartmentReviewer (needs to see assigned processes and approve)
  const isDepartmentReviewer = userRoles.some((role) => role === "DepartmentReviewer");
  const userDepartmentId = session?.user?.departmentId;

  const [activeTab, setActiveTab] = useState("repository");
  const [processes, setProcesses] = useState<Process[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [processBIAStatuses, setProcessBIAStatuses] = useState<ProcessBIAStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");

  // Dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingProcessId, setDeletingProcessId] = useState<string | null>(null);
  const [isAIEvaluationOpen, setIsAIEvaluationOpen] = useState(false);
  const [evaluatingProcess, setEvaluatingProcess] = useState<Process | null>(null);
  const [aiRiskLoading, setAiRiskLoading] = useState(false);
  const [aiRiskResults, setAiRiskResults] = useState<RiskGenerationResponse | null>(null);
  const [aiRiskError, setAiRiskError] = useState<string | null>(null);
  const [isBIAFormOpen, setIsBIAFormOpen] = useState(false);
  const [biaProcess, setBiaProcess] = useState<Process | null>(null);
  const [biaRatings, setBiaRatings] = useState<BIARating[]>([
    { category: "Financial", rating: "", description: "" },
    { category: "Reputational Impact", rating: "", description: "" },
    { category: "Regulatory", rating: "", description: "" },
    { category: "Safety", rating: "", description: "" },
    { category: "Operational", rating: "", description: "" },
  ]);
  const [biaApprover, setBiaApprover] = useState("");
  const [rto, setRto] = useState("0");
  const [rpo, setRpo] = useState("0");

  // AI Risk Evaluation State
  const [aiJobStatus, setAiJobStatus] = useState<"idle" | "generating" | "completed" | "error">("idle");
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [generatedRisks, setGeneratedRisks] = useState<any[]>([]);
  const [selectedRisks, setSelectedRisks] = useState<Set<number>>(new Set());

  // AI Polling Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (aiJobStatus === "generating" && aiJobId) {
      interval = setInterval(async () => {
        try {
          // Poll Status
          const statusData = await checkRiskGenerationStatus(aiJobId);

          if (statusData.status === "COMPLETED" || statusData.status === "completed") {
            // Fetch Result
            const resultData = await getRiskGenerationResult(aiJobId);
            const rawRisks = resultData.Risks || resultData.generated_risks || [];

            const mappedRisks = rawRisks.map((r: any) => ({
              name: r.Risk_Name || r.RiskName || "Unnamed Risk",
              description: r.Risk_Description || r.description || "No description provided.",
              impact: r.Inherent_risk_rating || "Medium",
              likelihood: "Medium" // AI might not provide this in V2 yet, default
            }));

            setGeneratedRisks(mappedRisks);
            setAiJobStatus("completed");
            setSelectedRisks(new Set(mappedRisks.map((_: any, i: number) => i)));
            clearInterval(interval);

          } else if (statusData.status === "FAILED" || statusData.status === "failed") {
            setAiJobStatus("error");
            toast({
              title: "AI Generation Failed",
              description: statusData.error || "Unknown error",
              variant: "destructive",
            });
            clearInterval(interval);
          }
        } catch (error) {
          console.error("Polling error:", error);
          setAiJobStatus("error"); // Stop polling on hard error?
          clearInterval(interval);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [aiJobStatus, aiJobId, toast]);

  const handleGenerateRisks = async () => {
    if (!evaluatingProcess) return;
    setAiJobStatus("generating");
    setGeneratedRisks([]);
    setAiJobId(null);
    try {
      const { jobId } = await startRiskGenerationJob({
        Process_Details: `Process Name: ${evaluatingProcess.name}. Description: ${evaluatingProcess.description || "N/A"}. Type: ${evaluatingProcess.processType}.`
      });

      if (jobId) {
        setAiJobId(jobId);
      } else {
        throw new Error("No Job ID returned");
      }
    } catch (error) {
      console.error("Error starting AI job:", error);
      setAiJobStatus("error");
      toast({ title: "Error", description: "Failed to start AI job", variant: "destructive" });
    }
  };

  const handleSaveRisks = async () => {
    if (!evaluatingProcess) return;

    // Convert Set to Array for iteration
    const selectedIndices = Array.from(selectedRisks);
    if (selectedIndices.length === 0) {
      toast({ title: "No risks selected", description: "Please select at least one risk to save." });
      return;
    }

    setAiJobStatus("generating"); // Re-use generating state or "saving" UI essentially
    // Actually, let's keep it "completed" but show saving spinner on button.

    let successCount = 0;

    for (const index of selectedIndices) {
      const risk = generatedRisks[index];
      // Map Likelihood/Impact. AI might return strings or numbers.
      // Simple mapping: 1-5 direct, strings mapped. Default 1.
      const mapRating = (val: any) => {
        if (typeof val === 'number') return Math.min(Math.max(val, 1), 5);
        const str = String(val).toLowerCase();
        if (str.includes("high")) return 4; // or 5
        if (str.includes("medium")) return 3;
        if (str.includes("low")) return 2;
        return 1;
      };

      const payload = {
        name: risk.name || risk.risk_name || "AI Generated Risk",
        description: risk.description || risk.risk_description || "",
        // Use riskSources to link to Process
        riskSources: `Process: ${evaluatingProcess.name} (${evaluatingProcess.processCode})`,
        category: "Operational", // Default or map if AI provides
        departmentId: evaluatingProcess.departmentId,
        likelihood: mapRating(risk.likelihood),
        impact: mapRating(risk.impact),
        status: "Open",
        actor: "AI Assistant",
      };

      try {
        const res = await fetch("/api/risks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) successCount++;
      } catch (error) {
        console.error("Error saving risk", error);
      }
    }

    toast({
      title: "Risks Saved",
      description: `Successfully saved ${successCount} risks to the Risk Register.`,
    });
    setIsAIEvaluationOpen(false);
    setAiJobStatus("idle");
  };

  const toggleRiskSelection = (index: number) => {
    const newSet = new Set(selectedRisks);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedRisks(newSet);
  };
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [processRes, deptRes, userRes, biaRes] = await Promise.all([
        fetch("/api/processes"),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/process-bia"),
      ]);

      if (processRes.ok) setProcesses(await processRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (biaRes.ok) {
        const biaData = await biaRes.json();
        setProcessBIAStatuses(biaData.map((bia: { processId: string; status: string; impactRating?: number; processCriticality?: string }) => ({
          processId: bia.processId,
          status: bia.status,
          impactRating: bia.impactRating,
          processCriticality: bia.processCriticality,
        })));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Filter processes - DepartmentReviewer can only see processes in their department
  const departmentFilteredProcesses = isDepartmentReviewer && userDepartmentId
    ? processes.filter((p) => p.departmentId === userDepartmentId)
    : processes;

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
  const handleBiaRatingChange = (index: number, rating: "High" | "Medium" | "Low" | "") => {
    const newRatings = [...biaRatings];
    newRatings[index] = {
      ...newRatings[index],
      rating,
      description: rating ? impactDescriptions[rating] : "",
    };
    setBiaRatings(newRatings);
  };

  const calculateImpactRating = () => {
    const ratingValues = { High: 100, Medium: 50, Low: 25, "": 0 };
    const maxRating = Math.max(...biaRatings.map((r) => ratingValues[r.rating]));
    return maxRating;
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

    // Load existing BIA data if available
    if (process.biaCompleted && process.biaData) {
      setBiaRatings(process.biaData.ratings);
      setBiaApprover(process.biaData.approver);
      setRto(process.biaData.rto);
      setRpo(process.biaData.rpo);
    } else {
      // Reset to empty for new BIA
      setBiaRatings([
        { category: "Financial", rating: "", description: "" },
        { category: "Reputational Impact", rating: "", description: "" },
        { category: "Regulatory", rating: "", description: "" },
        { category: "Safety", rating: "", description: "" },
        { category: "Operational", rating: "", description: "" },
      ]);
      setBiaApprover("");
      setRto("0");
      setRpo("0");
    }
    setIsBIAFormOpen(true);
  };

  const handleSaveBIA = () => {
    if (!biaProcess) return;
    const criticality = getProcessCriticality();

    // Store BIA data in the process
    const biaData: BIAData = {
      ratings: biaRatings,
      rto,
      rpo,
      approver: biaApprover,
    };

    setProcesses(processes.map((p) =>
      p.id === biaProcess.id
        ? { ...p, biaCompleted: true, processCriticality: criticality, biaData }
        : p
    ));
    setIsBIAFormOpen(false);
    setBiaProcess(null);
  };

  // AI Risk Evaluation functions
  const handleOpenAIEvaluation = (process: Process) => {
    setEvaluatingProcess(process);
    setAiRiskResults(null);
    setAiRiskError(null);
    setIsAIEvaluationOpen(true);

    // Automatically trigger risk generation when dialog opens
    handleGenerateRisks(process);
  };

  const handleGenerateRisks = async (process: Process) => {
    setAiRiskLoading(true);
    setAiRiskError(null);
    setAiRiskResults(null);

    try {
      const response = await fetch('/api/ai/risk-evaluation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Process_Details: {
            Process_name: process.name,
            Process_description: process.description || '',
            Department: process.department?.name || '',
          },
          // Note: API requires EITHER Process_Details OR Assets_Details, not both
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate risks');
      }

      const data = await response.json();
      setAiRiskResults(data);

      toast({
        title: 'Success',
        description: `Generated ${data.total_risks || 0} risks for ${process.name}`,
      });
    } catch (error: any) {
      console.error('Error generating risks:', error);
      setAiRiskError(error.message || 'Failed to generate risk evaluation');

      toast({
        title: 'Error',
        description: error.message || 'Failed to generate risk evaluation',
        variant: 'destructive',
      });
    } finally {
      setAiRiskLoading(false);
    }
  };

  // Helper function to get BIA status for a process
  const getBIAStatus = (processId: string) => {
    return processBIAStatuses.find((b) => b.processId === processId);
  };

  // BIA columns
  const biaColumns: ColumnDef<Process>[] = [
    {
      accessorKey: "processCode",
      header: "Reference ID",
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("processCode")}</span>,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "department.name",
      header: "Department",
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      accessorKey: "owner.fullName",
      header: "Process Owner",
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    {
      accessorKey: "processCriticality",
      header: "Process Criticality",
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
      header: "Action",
      cell: ({ row }) => {
        const biaStatus = getBIAStatus(row.original.id);
        const status = biaStatus?.status || "Open";
        const isPendingApproval = status === "Pending Approval";
        const isApproved = status === "Approved";
        const isSentBack = status === "Sent Back";
        const hasComments = biaStatus && (isPendingApproval || isApproved || isSentBack);

        // DepartmentReviewer sees "View" button for all BIAs (they review pending ones)
        if (isDepartmentReviewer) {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          );
        }

        // CustomerAdmin/Contributor view
        // If approved or pending approval - show View button
        if (isApproved || isPendingApproval) {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          );
        }

        // If sent back - show Respond button (to re-submit)
        if (isSentBack) {
          return (
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              Respond
            </Button>
          );
        }

        // Open/New - show Perform BIA button
        return (
          <div className="flex gap-2 items-center">
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              Perform BIA
            </Button>
          </div>
        );
      },
    },
  ];

  // Process columns
  const processColumns: ColumnDef<Process>[] = [
    {
      accessorKey: "processCode",
      header: "Reference ID",
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("processCode")}</span>,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const desc = row.getValue("description") as string;
        return <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{desc || "-"}</span>;
      },
    },
    {
      accessorKey: "department.name",
      header: "Department",
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      accessorKey: "owner.fullName",
      header: "Process Owner",
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    {
      accessorKey: "frequency",
      header: "Process Frequency",
      cell: ({ row }) => row.original.frequency || "-",
    },
    {
      accessorKey: "natureOfImplementation",
      header: "Nature Of Implementation",
      cell: ({ row }) => row.original.natureOfImplementation || "-",
    },
    {
      id: "aiRisk",
      header: "AI Risk",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-purple-600 border-purple-200 hover:bg-purple-50"
<<<<<<< Updated upstream
          onClick={() => {
            setEvaluatingProcess(row.original);
            setIsAIEvaluationOpen(true);
            setAiJobStatus("idle");
            setGeneratedRisks([]);
          }}
=======
          onClick={() => handleOpenAIEvaluation(row.original)}
>>>>>>> Stashed changes
        >
          <Sparkles className="h-4 w-4 mr-1" />
          AI Risk Evaluation
        </Button>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/organization/process/${row.original.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setDeletingProcessId(row.original.id);
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Process" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="repository">Repository</TabsTrigger>
          <TabsTrigger value="bia">Business Impact Analysis</TabsTrigger>
          <TabsTrigger value="performance">Performance Dashboard</TabsTrigger>
        </TabsList>

        {/* Repository Tab */}
        <TabsContent value="repository" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search processes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Process Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frequencies</SelectItem>
                  {processFrequencies.map((freq) => (
                    <SelectItem key={freq} value={freq}>
                      {freq}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => router.push("/organization/process/add")}>
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            </div>
          </div>

          <DataGrid
            columns={processColumns}
            data={filteredProcesses}
            searchPlaceholder="Search..."
          />
        </TabsContent>

        {/* Business Impact Analysis Tab */}
        <TabsContent value="bia" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search By Process ID, Name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Process Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <DataGrid
            columns={biaColumns}
            data={filteredProcesses}
            searchPlaceholder="Search..."
          />
        </TabsContent>

        {/* Performance Dashboard Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Processes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{processes.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Processes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {processes.filter((p) => p.status === "Active").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Primary Processes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {processes.filter((p) => p.processType === "Primary").length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Process Performance Metrics</CardTitle>
              <CardDescription>
                Track and monitor key performance indicators for your processes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Performance Data</h3>
                <p className="text-muted-foreground">
                  Performance metrics will appear here once processes are monitored
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this process? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProcess}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAIEvaluationOpen} onOpenChange={setIsAIEvaluationOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Risk Evaluation
            </DialogTitle>
            <DialogDescription>
              AI-powered risk assessment for process: {evaluatingProcess?.name}
            </DialogDescription>
          </DialogHeader>
<<<<<<< Updated upstream

          <div className="py-4 space-y-4">

            {/* IDLE STATE */}
            {aiJobStatus === "idle" && (
              <div className="flex flex-col items-center justify-center p-8 bg-purple-50 rounded-lg border border-purple-100 text-center">
                <Sparkles className="h-12 w-12 text-purple-300 mb-4" />
                <h3 className="text-lg font-medium text-purple-900 mb-2">Ready to Assess Risks</h3>
                <p className="text-sm text-purple-700 max-w-md mb-6">
                  The AI will analyze your process details, including description, type, and complexity, to identify potential risks.
                </p>
                <Button onClick={handleGenerateRisks} className="bg-purple-600 hover:bg-purple-700">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Risks
                </Button>
              </div>
            )}

            {/* GENERATING STATE */}
            {aiJobStatus === "generating" && (
              <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-10 w-10 text-purple-600 animate-spin" />
                <p className="font-medium text-purple-900">Analyzing Process...</p>
                <p className="text-xs text-muted-foreground">This may take up to 30 seconds.</p>
              </div>
            )}

            {/* ERROR STATE */}
            {aiJobStatus === "error" && (
              <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg border border-red-100 text-center">
                <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-red-900 mb-2">Analysis Failed</h3>
                <p className="text-sm text-red-700 mb-6">
                  Something went wrong while communicating with the AI service. Please try again.
                </p>
                <Button variant="outline" onClick={() => setAiJobStatus("idle")}>
                  Try Again
                </Button>
              </div>
            )}

            {/* COMPLETED STATE */}
            {aiJobStatus === "completed" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Identified Risks ({generatedRisks.length})</h4>
                  <p className="text-xs text-muted-foreground">Select risks to add to your register.</p>
                </div>

                <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
                  {generatedRisks.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No risks identified.</div>
                  ) : (
                    generatedRisks.map((risk, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 hover:bg-gray-50">
                        <Checkbox
                          id={`risk-${idx}`}
                          checked={selectedRisks.has(idx)}
                          onCheckedChange={() => toggleRiskSelection(idx)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`risk-${idx}`} className="font-medium cursor-pointer">
                              {risk.name || risk.risk_name || "Unnamed Risk"}
                            </Label>
                            <div className="flex gap-2 text-xs">
                              {risk.likelihood && <Badge variant="outline">L: {risk.likelihood}</Badge>}
                              {risk.impact && <Badge variant="outline">I: {risk.impact}</Badge>}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {risk.description || risk.risk_description || "No description provided."}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

=======
          <div className="py-4">
            {aiRiskLoading && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <p className="text-sm text-muted-foreground">Generating AI risk assessment...</p>
              </div>
            )}

            {aiRiskError && !aiRiskLoading && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900 mb-2">Error</h4>
                <p className="text-sm text-red-700">{aiRiskError}</p>
              </div>
            )}

            {aiRiskResults && !aiRiskLoading && !aiRiskError && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">Risk Assessment Summary</h4>
                  <p className="text-sm text-purple-700">
                    Generated {(aiRiskResults.risks || aiRiskResults.generated_risks || []).length} risk{((aiRiskResults.risks || aiRiskResults.generated_risks || []).length) !== 1 ? 's' : ''} for {evaluatingProcess?.name}
                  </p>
                  {aiRiskResults.department && (
                    <p className="text-xs text-purple-600 mt-1">Department: {aiRiskResults.department}</p>
                  )}
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {(aiRiskResults.risks || aiRiskResults.generated_risks || []).map((risk, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium text-sm">{risk.Risk_name || risk.title}</h5>
                        <Badge
                          variant={
                            (risk.Inherent_risk_rating || risk.level) === 'High' || (risk.Inherent_risk_rating || risk.level) === 'Critical'
                              ? 'destructive'
                              : (risk.Inherent_risk_rating || risk.level) === 'Medium'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {risk.Inherent_risk_rating || risk.level}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{risk.Risk_description || risk.description}</p>
                      {risk.Risk_category && (
                        <div className="text-xs mt-2">
                          <span className="font-medium">Category:</span> {risk.Risk_category}
                        </div>
                      )}
                      {(risk.inherent_likelihood || risk.inherent_impact) && (
                        <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                          {risk.inherent_likelihood && (
                            <div>
                              <span className="font-medium">Likelihood:</span> {risk.inherent_likelihood}
                            </div>
                          )}
                          {risk.inherent_impact && (
                            <div>
                              <span className="font-medium">Impact:</span> {risk.inherent_impact}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
>>>>>>> Stashed changes
          </div>

          <DialogFooter>
<<<<<<< Updated upstream
            {aiJobStatus === "completed" ? (
              <>
                <Button variant="outline" onClick={() => setIsAIEvaluationOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveRisks} className="bg-purple-600 hover:bg-purple-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Selected Risks
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsAIEvaluationOpen(false)}>Close</Button>
=======
            <Button variant="outline" onClick={() => setIsAIEvaluationOpen(false)}>
              Close
            </Button>
            {aiRiskResults && !aiRiskLoading && (
              <Button onClick={() => handleGenerateRisks(evaluatingProcess!)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
>>>>>>> Stashed changes
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BIA Form Dialog */}
      <Dialog open={isBIAFormOpen} onOpenChange={setIsBIAFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Business Impact Analysis</DialogTitle>
            <DialogDescription>
              Assess the impact of disruptions to: {biaProcess?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {/* Header controls */}
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Badge variant="outline" className="bg-white">Open</Badge>
              <Select value={biaApprover} onValueChange={setBiaApprover}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Approver" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={!biaApprover}>
                Submit For Approval
              </Button>
            </div>

            {/* Process Name */}
            <div>
              <h4 className="text-lg font-semibold mb-4">{biaProcess?.name}</h4>

              {/* Category Headers */}
              <div className="flex justify-between items-center mb-2 px-2">
                <span className="text-sm font-medium text-muted-foreground w-1/4">Category</span>
                <span className="text-sm font-medium text-muted-foreground w-1/4">BIA Rating</span>
                <span className="text-sm font-medium text-muted-foreground w-1/2">Impact Description</span>
              </div>

              {/* Impact Categories */}
              <div className="space-y-2">
                {biaRatings.map((item, index) => (
                  <div key={item.category} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium w-1/4">{item.category}</span>
                    <Select
                      value={item.rating}
                      onValueChange={(value) => handleBiaRatingChange(index, value as "High" | "Medium" | "Low" | "")}
                    >
                      <SelectTrigger className="w-1/4">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground w-1/2">
                      {item.description || "Select a rating to see impact description"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Impact Rating */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="font-medium">Impact Rating = {calculateImpactRating()}</span>
                <Badge variant={getProcessCriticality() === "High" ? "destructive" : getProcessCriticality() === "Medium" ? "secondary" : "outline"}>
                  {getProcessCriticality() || "N/A"}
                </Badge>
              </div>
              <p className="text-xs text-amber-700 mt-1">Note: The highest rating will be taken</p>
            </div>

            {/* Recovery Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rto">RTO (Recovery Time Objective) - Hours</Label>
                <Input
                  id="rto"
                  type="number"
                  value={rto}
                  onChange={(e) => setRto(e.target.value)}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rpo">RPO (Recovery Point Objective) - Hours</Label>
                <Input
                  id="rpo"
                  type="number"
                  value={rpo}
                  onChange={(e) => setRpo(e.target.value)}
                  min="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBIAFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBIA}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
