"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Download, Upload, Search, Sparkles, BarChart3, FileText, ChevronRight, Check } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("repository");
  const [processes, setProcesses] = useState<Process[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");

  // Dialog states
  const [isAddProcessOpen, setIsAddProcessOpen] = useState(false);
  const [isEditProcessOpen, setIsEditProcessOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingProcessId, setDeletingProcessId] = useState<string | null>(null);
  const [isAIEvaluationOpen, setIsAIEvaluationOpen] = useState(false);
  const [evaluatingProcess, setEvaluatingProcess] = useState<Process | null>(null);
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

  // Wizard step state
  const [wizardStep, setWizardStep] = useState(1);

  // Form state
  const [newProcess, setNewProcess] = useState({
    processCode: "",
    name: "",
    description: "",
    processType: "Primary",
    departmentId: "",
    ownerId: "",
    status: "Active",
    frequency: "",
    natureOfImplementation: "",
    assetDependency: false,
    externalDependency: false,
    location: "",
    kpiMeasurementRequired: false,
    piiCapture: false,
    operationalComplexity: "",
    lastAuditDate: "",
    responsible: "",
    accountable: "",
    consulted: "",
    informed: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [processRes, deptRes, userRes] = await Promise.all([
        fetch("/api/processes"),
        fetch("/api/departments"),
        fetch("/api/users"),
      ]);

      if (processRes.ok) setProcesses(await processRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Filter processes
  const filteredProcesses = processes.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.processCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === "all" || p.departmentId === departmentFilter;
    const matchesOwner = ownerFilter === "all" || p.ownerId === ownerFilter;
    return matchesSearch && matchesDepartment && matchesOwner;
  });

  // Process CRUD
  const handleAddProcess = async () => {
    if (!newProcess.processCode.trim() || !newProcess.name.trim()) return;
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProcess,
          departmentId: newProcess.departmentId || null,
          ownerId: newProcess.ownerId || null,
        }),
      });
      if (res.ok) {
        const process = await res.json();
        setProcesses([...processes, process]);
        setNewProcess({
          processCode: "",
          name: "",
          description: "",
          processType: "Primary",
          departmentId: "",
          ownerId: "",
          status: "Active",
        });
        setIsAddProcessOpen(false);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create process");
      }
    } catch (error) {
      console.error("Error adding process:", error);
    }
  };

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
        const criticality = row.original.processCriticality;
        if (!criticality) return "-";
        return (
          <Badge variant={criticality === "High" ? "destructive" : criticality === "Medium" ? "secondary" : "outline"}>
            {criticality}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-purple-600 border-purple-200 hover:bg-purple-50"
            onClick={() => {
              setEvaluatingProcess(row.original);
              setIsAIEvaluationOpen(true);
            }}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            AI Risk Evaluation
          </Button>
          {row.original.biaCompleted ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenBIAForm(row.original)}
            >
              View
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleOpenBIAForm(row.original)}
            >
              Perform BIA
            </Button>
          )}
        </div>
      ),
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
          onClick={() => {
            setEvaluatingProcess(row.original);
            setIsAIEvaluationOpen(true);
          }}
        >
          <Sparkles className="h-4 w-4 mr-1" />
          Evaluate
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
            onClick={() => {
              setEditingProcess(row.original);
              setIsEditProcessOpen(true);
            }}
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
              <Button onClick={() => setIsAddProcessOpen(true)}>
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

      {/* Add Process Dialog - Multi-step Wizard */}
      <Dialog open={isAddProcessOpen} onOpenChange={(open) => {
        setIsAddProcessOpen(open);
        if (!open) setWizardStep(1);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Process</DialogTitle>
            <DialogDescription>
              Complete the form to create a new process
            </DialogDescription>
          </DialogHeader>

          {/* Wizard Steps Indicator */}
          <div className="flex items-center justify-center gap-4 py-4">
            {[
              { step: 1, label: "Info" },
              { step: 2, label: "Process Flow" },
              { step: 3, label: "Process RACI" },
            ].map((item, index) => (
              <div key={item.step} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      wizardStep >= item.step
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {wizardStep > item.step ? <Check className="h-4 w-4" /> : item.step}
                  </div>
                  <span className={`text-sm ${wizardStep >= item.step ? "text-blue-600 font-medium" : "text-gray-500"}`}>
                    {item.label}
                  </span>
                </div>
                {index < 2 && (
                  <ChevronRight className="h-4 w-4 mx-4 text-gray-400" />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Info */}
          {wizardStep === 1 && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="processCode">Process ID *</Label>
                  <Input
                    id="processCode"
                    value={newProcess.processCode}
                    onChange={(e) => setNewProcess({ ...newProcess, processCode: e.target.value })}
                    placeholder="e.g., PRO001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="processName">Process Name *</Label>
                  <Input
                    id="processName"
                    value={newProcess.name}
                    onChange={(e) => setNewProcess({ ...newProcess, name: e.target.value })}
                    placeholder="Enter process name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="processDescription">Description</Label>
                <textarea
                  id="processDescription"
                  value={newProcess.description}
                  onChange={(e) => setNewProcess({ ...newProcess, description: e.target.value })}
                  placeholder="Enter description"
                  className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={newProcess.departmentId}
                    onValueChange={(value) => setNewProcess({ ...newProcess, departmentId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Process Owner</Label>
                  <Select
                    value={newProcess.ownerId}
                    onValueChange={(value) => setNewProcess({ ...newProcess, ownerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Process Frequency</Label>
                  <Select
                    value={newProcess.frequency}
                    onValueChange={(value) => setNewProcess({ ...newProcess, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Process Frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {processFrequencies.map((freq) => (
                        <SelectItem key={freq} value={freq}>
                          {freq}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nature of Implementation</Label>
                  <Select
                    value={newProcess.natureOfImplementation}
                    onValueChange={(value) => setNewProcess({ ...newProcess, natureOfImplementation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Nature Of Implementation" />
                    </SelectTrigger>
                    <SelectContent>
                      {natureOfImplementations.map((nature) => (
                        <SelectItem key={nature} value={nature}>
                          {nature}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="assetDependency"
                    checked={newProcess.assetDependency}
                    onCheckedChange={(checked) => setNewProcess({ ...newProcess, assetDependency: !!checked })}
                  />
                  <Label htmlFor="assetDependency">Asset Dependency</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="externalDependency"
                    checked={newProcess.externalDependency}
                    onCheckedChange={(checked) => setNewProcess({ ...newProcess, externalDependency: !!checked })}
                  />
                  <Label htmlFor="externalDependency">External Dependency</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    value={newProcess.location}
                    onValueChange={(value) => setNewProcess({ ...newProcess, location: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-6 pt-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="kpiMeasurement"
                      checked={newProcess.kpiMeasurementRequired}
                      onCheckedChange={(checked) => setNewProcess({ ...newProcess, kpiMeasurementRequired: !!checked })}
                    />
                    <Label htmlFor="kpiMeasurement">KPI Measurement Required</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="piiCapture"
                      checked={newProcess.piiCapture}
                      onCheckedChange={(checked) => setNewProcess({ ...newProcess, piiCapture: !!checked })}
                    />
                    <Label htmlFor="piiCapture">PII Capture</Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Operational Complexity</Label>
                  <Select
                    value={newProcess.operationalComplexity}
                    onValueChange={(value) => setNewProcess({ ...newProcess, operationalComplexity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Complexity" />
                    </SelectTrigger>
                    <SelectContent>
                      {operationalComplexities.map((complexity) => (
                        <SelectItem key={complexity} value={complexity}>
                          {complexity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastAuditDate">Last Audit Date</Label>
                  <Input
                    id="lastAuditDate"
                    type="date"
                    value={newProcess.lastAuditDate}
                    onChange={(e) => setNewProcess({ ...newProcess, lastAuditDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Process Flow */}
          {wizardStep === 2 && (
            <div className="py-8">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Drag and drop or select file</p>
                <p className="text-sm text-gray-400 mb-4">Upload process flow diagram (PDF, PNG, JPG)</p>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Select File
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Process RACI */}
          {wizardStep === 3 && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Assign responsibility for this process using the RACI matrix
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Responsible</Label>
                  <Select
                    value={newProcess.responsible}
                    onValueChange={(value) => setNewProcess({ ...newProcess, responsible: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Person who does the work</p>
                </div>
                <div className="space-y-2">
                  <Label>Accountable</Label>
                  <Select
                    value={newProcess.accountable}
                    onValueChange={(value) => setNewProcess({ ...newProcess, accountable: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Person ultimately answerable</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Consulted</Label>
                  <Select
                    value={newProcess.consulted}
                    onValueChange={(value) => setNewProcess({ ...newProcess, consulted: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Person whose input is sought</p>
                </div>
                <div className="space-y-2">
                  <Label>Informed</Label>
                  <Select
                    value={newProcess.informed}
                    onValueChange={(value) => setNewProcess({ ...newProcess, informed: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Person kept up-to-date on progress</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div>
              {wizardStep > 1 && (
                <Button variant="outline" onClick={() => setWizardStep(wizardStep - 1)}>
                  Previous
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsAddProcessOpen(false);
                setWizardStep(1);
              }}>
                Cancel
              </Button>
              {wizardStep < 3 ? (
                <Button onClick={() => setWizardStep(wizardStep + 1)}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleAddProcess}>
                  Save
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* AI Risk Evaluation Dialog */}
      <Dialog open={isAIEvaluationOpen} onOpenChange={setIsAIEvaluationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Risk Evaluation
            </DialogTitle>
            <DialogDescription>
              AI-powered risk assessment for process: {evaluatingProcess?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-medium text-purple-900 mb-2">Risk Assessment Summary</h4>
                <p className="text-sm text-purple-700">
                  Based on the process characteristics and historical data, the AI has identified
                  the following risk factors:
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm">Operational Risk</span>
                  <Badge variant="secondary">Medium</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm">Compliance Risk</span>
                  <Badge variant="outline">Low</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm">Security Risk</span>
                  <Badge variant="secondary">Medium</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                * This is a simulated AI evaluation. In production, this would connect to an AI service
                for real-time risk assessment.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAIEvaluationOpen(false)}>
              Close
            </Button>
            <Button>
              Generate Full Report
            </Button>
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
