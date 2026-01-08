"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  Download,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Evidence {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  status: string;
  recurrence: string | null;
  reviewDate: string | null;
  domain: string | null;
  entities: string | null;
  isControlLinked: boolean;
  isPolicyLinked: boolean;
  artifactDescription: string | null;
  isKPI: boolean;
  kpiDescription: string | null;
  kpiExpectedScore: number | null;
  kpiObjective: string | null;
  kpiDataSource: string | null;
  kpiCalculationFormula: string | null;
  aiStatus: string | null;
  aiJustification: string | null;
  isAdded: boolean;
  department: { id: string; name: string } | null;
  controls: any[];
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  departmentId?: string;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description?: string;
  domain?: { id: string; name: string } | null;
  functionalGrouping?: string | null;
}

interface ControlDomain {
  id: string;
  name: string;
}

interface Framework {
  id: string;
  name: string;
}

interface NewEvidenceFormData {
  name: string;
  recurrence: string;
  departmentId: string;
  assigneeId: string;
  description: string;
  controlIds: string[];
}

export default function EvidencesMasterDataPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // New Evidence Dialog (3-step wizard)
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newStep, setNewStep] = useState(1);
  const [newFormData, setNewFormData] = useState<NewEvidenceFormData>({
    name: "",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
    description: "",
    controlIds: [],
  });
  const [newFormErrors, setNewFormErrors] = useState<Record<string, string>>({});

  // Step 2 Filters
  const [controlSearch, setControlSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState("");
  const [functionalGroupingFilter, setFunctionalGroupingFilter] = useState("");

  // Edit Evidence Dialog (single page)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);
  const [editControlId, setEditControlId] = useState<string>("");

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Delete All Dialog
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  // Import Dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  const fetchEvidences = useCallback(async () => {
    try {
      const response = await fetch("/api/evidences");
      if (response.ok) {
        const data = await response.json();
        setEvidences(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchControls = useCallback(async () => {
    try {
      const response = await fetch("/api/controls");
      if (response.ok) {
        const data = await response.json();
        setControls(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    }
  }, []);

  const fetchControlDomains = useCallback(async () => {
    try {
      const response = await fetch("/api/control-domains");
      if (response.ok) {
        const data = await response.json();
        setControlDomains(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching control domains:", error);
    }
  }, []);

  const fetchFrameworks = useCallback(async () => {
    try {
      const response = await fetch("/api/frameworks");
      if (response.ok) {
        const data = await response.json();
        setFrameworks(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    }
  }, []);

  useEffect(() => {
    fetchEvidences();
    fetchDepartments();
    fetchUsers();
    fetchControls();
    fetchControlDomains();
    fetchFrameworks();
  }, [fetchEvidences, fetchDepartments, fetchUsers, fetchControls, fetchControlDomains, fetchFrameworks]);

  // Filter users by selected department
  const filteredUsers = users.filter(
    (user) => !newFormData.departmentId || user.departmentId === newFormData.departmentId
  );

  // Filter controls based on search and filters
  const filteredControls = controls.filter((control) => {
    const matchesSearch =
      !controlSearch ||
      control.controlCode.toLowerCase().includes(controlSearch.toLowerCase()) ||
      control.name.toLowerCase().includes(controlSearch.toLowerCase());
    const matchesDomain =
      !domainFilter || control.domain?.id === domainFilter;
    const matchesFunctionalGrouping =
      !functionalGroupingFilter || control.functionalGrouping === functionalGroupingFilter;
    return matchesSearch && matchesDomain && matchesFunctionalGrouping;
  });

  // Get unique functional groupings from controls
  const functionalGroupings = [...new Set(controls.map((c) => c.functionalGrouping).filter(Boolean))];

  const handleExport = () => {
    const csv = [
      ["Evidence Code", "Title", "Evidence Requirement"],
      ...evidences.map((e) => [
        e.evidenceCode,
        e.name,
        e.description || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evidences-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const csv = ["Evidence Code,Title,Evidence Requirement", "E-001,Sample Domain,Sample Evidence Requirement"].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evidence-import-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // New Evidence - Step 1 Validation
  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!newFormData.name) errors.name = "Please enter the evidence name";
    if (!newFormData.recurrence) errors.recurrence = "Please select the recurrence";
    if (!newFormData.departmentId) errors.departmentId = "Please select the Department";
    if (!newFormData.assigneeId) errors.assigneeId = "Please select the assignee";
    setNewFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNewNext = () => {
    if (newStep === 1) {
      if (validateStep1()) {
        setNewStep(2);
      }
    } else if (newStep === 2) {
      setNewStep(3);
    }
  };

  const handleNewBack = () => {
    if (newStep > 1) {
      setNewStep(newStep - 1);
    }
  };

  const handleNewSubmit = async () => {
    try {
      const response = await fetch("/api/evidences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFormData.name,
          description: newFormData.description,
          recurrence: newFormData.recurrence,
          departmentId: newFormData.departmentId,
          status: "Draft",
          controlIds: newFormData.controlIds,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Evidence created successfully",
        });
        setIsNewDialogOpen(false);
        resetNewForm();
        fetchEvidences();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to create evidence",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating evidence:", error);
      toast({
        title: "Error",
        description: "Failed to create evidence",
        variant: "destructive",
      });
    }
  };

  const resetNewForm = () => {
    setNewFormData({
      name: "",
      recurrence: "",
      departmentId: "",
      assigneeId: "",
      description: "",
      controlIds: [],
    });
    setNewFormErrors({});
    setNewStep(1);
    setControlSearch("");
    setDomainFilter("");
    setFrameworkFilter("");
    setFunctionalGroupingFilter("");
  };

  const handleEdit = (evidence: Evidence) => {
    setEditingEvidence(evidence);
    setEditControlId(evidence.controls?.[0]?.id || "");
    setIsEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingEvidence) return;

    try {
      const response = await fetch(`/api/evidences/${editingEvidence.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingEvidence,
          controlIds: editControlId ? [editControlId] : [],
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Evidence updated successfully",
        });
        setIsEditDialogOpen(false);
        setEditingEvidence(null);
        setEditControlId("");
        fetchEvidences();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to update evidence",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating evidence:", error);
      toast({
        title: "Error",
        description: "Failed to update evidence",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      const response = await fetch(`/api/evidences/${deletingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Evidence deleted successfully",
        });
        fetchEvidences();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete evidence",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting evidence:", error);
      toast({
        title: "Error",
        description: "Failed to delete evidence",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const deletePromises = evidences.map((evidence) =>
        fetch(`/api/evidences/${evidence.id}`, { method: "DELETE" })
      );

      await Promise.all(deletePromises);

      toast({
        title: "Success",
        description: "All evidences deleted successfully",
      });
      fetchEvidences();
    } catch (error) {
      console.error("Error deleting all evidences:", error);
      toast({
        title: "Error",
        description: "Failed to delete all evidences",
        variant: "destructive",
      });
    } finally {
      setDeleteAllDialogOpen(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      toast({
        title: "Error",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n");
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
          const evidenceData: any = {};

          headers.forEach((header, index) => {
            if (header === "Evidence Code") evidenceData.evidenceCode = values[index];
            else if (header === "Title") evidenceData.name = values[index];
            else if (header === "Evidence Requirement") evidenceData.description = values[index];
          });

          await fetch("/api/evidences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...evidenceData,
              status: "Draft",
            }),
          });
        }

        toast({
          title: "Success",
          description: "Evidences imported successfully",
        });
        fetchEvidences();
        setImportDialogOpen(false);
        setImportName("");
        setImportFile(null);
      } catch (error) {
        console.error("Error importing evidences:", error);
        toast({
          title: "Error",
          description: "Failed to import evidences",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(importFile);
  };

  // Get selected controls for review
  const selectedControls = controls.filter((c) => newFormData.controlIds.includes(c.id));
  const selectedDomains = [...new Set(selectedControls.map((c) => c.domain?.name).filter(Boolean))];

  // Filter evidences based on search
  const filteredEvidences = evidences.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.evidenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/master-data")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Evidences</h1>
            <p className="text-gray-600">Manage evidence definitions and requirements</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Evidence
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteAllDialogOpen(true)}
            disabled={evidences.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search evidences..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evidence Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Evidence Requirement</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvidences.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <p className="text-gray-500">No evidences found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvidences.map((evidence) => (
                  <TableRow key={evidence.id}>
                    <TableCell className="font-medium">{evidence.evidenceCode}</TableCell>
                    <TableCell>{evidence.name}</TableCell>
                    <TableCell>{evidence.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(evidence)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(evidence.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredEvidences.length} of {evidences.length} evidences
          </div>
        </CardContent>
      </Card>

      {/* New Evidence Dialog - 3 Step Wizard */}
      <Dialog open={isNewDialogOpen} onOpenChange={(open) => {
        setIsNewDialogOpen(open);
        if (!open) resetNewForm();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">
              {newStep === 1 ? "Evidence Details" : newStep === 2 ? "Controls" : "Review Information"}
            </DialogTitle>
            <DialogDescription>
              {newStep === 1 ? "Enter evidence details" : newStep === 2 ? "Select controls to link" : "Review and confirm"}
            </DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${newStep >= 1 ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}>
                {newStep > 1 ? <Check className="h-5 w-5" /> : "1"}
              </div>
              <span className={`text-xs ${newStep === 1 ? 'text-primary font-semibold' : 'text-gray-500'}`}>Evidence Details</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-2 mt-[-20px]" />
            <div className="flex flex-col items-center gap-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${newStep >= 2 ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}>
                {newStep > 2 ? <Check className="h-5 w-5" /> : "2"}
              </div>
              <span className={`text-xs ${newStep === 2 ? 'text-primary font-semibold' : 'text-gray-500'}`}>Controls</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-2 mt-[-20px]" />
            <div className="flex flex-col items-center gap-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${newStep >= 3 ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}>
                3
              </div>
              <span className={`text-xs ${newStep === 3 ? 'text-primary font-semibold' : 'text-gray-500'}`}>Review informations</span>
            </div>
          </div>

          {/* Step 1: Evidence Details */}
          {newStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="evidence-name" className="text-primary">Evidence Requirement <span className="text-red-500">*</span></Label>
                <Input
                  id="evidence-name"
                  value={newFormData.name}
                  onChange={(e) => {
                    setNewFormData({ ...newFormData, name: e.target.value });
                    if (newFormErrors.name) {
                      setNewFormErrors({ ...newFormErrors, name: "" });
                    }
                  }}
                  className={newFormErrors.name ? "border-red-500" : ""}
                />
                {newFormErrors.name && (
                  <p className="text-sm text-red-500 mt-1">{newFormErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recurrence" className="text-primary">Recurrence <span className="text-red-500">*</span></Label>
                  <Select
                    value={newFormData.recurrence}
                    onValueChange={(value) => {
                      setNewFormData({ ...newFormData, recurrence: value });
                      if (newFormErrors.recurrence) {
                        setNewFormErrors({ ...newFormErrors, recurrence: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={newFormErrors.recurrence ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                      <SelectItem value="Half-yearly">Half-yearly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  {newFormErrors.recurrence && (
                    <p className="text-sm text-red-500 mt-1">{newFormErrors.recurrence}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="department" className="text-primary">Department <span className="text-red-500">*</span></Label>
                  <Select
                    value={newFormData.departmentId}
                    onValueChange={(value) => {
                      setNewFormData({ ...newFormData, departmentId: value, assigneeId: "" });
                      if (newFormErrors.departmentId) {
                        setNewFormErrors({ ...newFormErrors, departmentId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={newFormErrors.departmentId ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newFormErrors.departmentId && (
                    <p className="text-sm text-red-500 mt-1">{newFormErrors.departmentId}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="assignee" className="text-primary">Assignee <span className="text-red-500">*</span></Label>
                <Select
                  value={newFormData.assigneeId}
                  onValueChange={(value) => {
                    setNewFormData({ ...newFormData, assigneeId: value });
                    if (newFormErrors.assigneeId) {
                      setNewFormErrors({ ...newFormErrors, assigneeId: "" });
                    }
                  }}
                >
                  <SelectTrigger className={newFormErrors.assigneeId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newFormErrors.assigneeId && (
                  <p className="text-sm text-red-500 mt-1">{newFormErrors.assigneeId}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description" className="text-primary">Description</Label>
                <Textarea
                  id="description"
                  value={newFormData.description}
                  onChange={(e) =>
                    setNewFormData({ ...newFormData, description: e.target.value })
                  }
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 2: Controls */}
          {newStep === 2 && (
            <div className="space-y-4">
              {/* Filters Row */}
              <div className="grid grid-cols-3 gap-4">
                <Select value={domainFilter || "_all"} onValueChange={(v) => setDomainFilter(v === "_all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Domains</SelectItem>
                    {controlDomains.map((domain) => (
                      <SelectItem key={domain.id} value={domain.id}>
                        {domain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={frameworkFilter || "_all"} onValueChange={(v) => setFrameworkFilter(v === "_all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Framework" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Frameworks</SelectItem>
                    {frameworks.map((framework) => (
                      <SelectItem key={framework.id} value={framework.id}>
                        {framework.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={functionalGroupingFilter || "_all"} onValueChange={(v) => setFunctionalGroupingFilter(v === "_all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Functional Grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Groupings</SelectItem>
                    {functionalGroupings.map((grouping) => (
                      <SelectItem key={grouping} value={grouping!}>
                        {grouping}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search By Control Code , Name"
                  value={controlSearch}
                  onChange={(e) => setControlSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Controls List */}
              <div className="border rounded-md max-h-80 overflow-y-auto">
                {filteredControls.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No controls found</div>
                ) : (
                  filteredControls.map((control) => (
                    <div
                      key={control.id}
                      className={`p-4 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                        newFormData.controlIds.includes(control.id) ? "bg-primary/5" : ""
                      }`}
                      onClick={() => {
                        if (newFormData.controlIds.includes(control.id)) {
                          setNewFormData({
                            ...newFormData,
                            controlIds: newFormData.controlIds.filter((id) => id !== control.id),
                          });
                        } else {
                          setNewFormData({
                            ...newFormData,
                            controlIds: [...newFormData.controlIds, control.id],
                          });
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={newFormData.controlIds.includes(control.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-primary">
                              {control.controlCode} : {control.name}
                            </span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              Organization Wide
                            </span>
                          </div>
                          {control.description && (
                            <p className="text-sm text-gray-600 mt-1">{control.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="text-sm text-gray-500">
                {newFormData.controlIds.length} control(s) selected
              </p>
            </div>
          )}

          {/* Step 3: Review */}
          {newStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-primary font-semibold">Evidence Name</Label>
                  <p className="mt-1">{newFormData.name}</p>
                </div>
                <div>
                  <Label className="text-primary font-semibold">Control Domain</Label>
                  <p className="mt-1">{selectedDomains.join(", ") || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-primary font-semibold">Recurrence</Label>
                  <p className="mt-1">{newFormData.recurrence}</p>
                </div>
                <div>
                  <Label className="text-primary font-semibold">Entities</Label>
                  <p className="mt-1">{newFormData.controlIds.length > 0 ? "Organization Wide" : "-"}</p>
                </div>
              </div>
              <div>
                <Label className="text-primary font-semibold">Department</Label>
                <p className="mt-1">
                  {departments.find((d) => d.id === newFormData.departmentId)?.name || "-"}
                </p>
              </div>
              {newFormData.description && (
                <div>
                  <Label className="text-primary font-semibold">Description</Label>
                  <p className="mt-1">{newFormData.description}</p>
                </div>
              )}
              <div>
                <Label className="text-primary font-semibold">Selected Controls</Label>
                <p className="mt-1">{newFormData.controlIds.length} control(s) selected</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {newStep > 1 && (
              <Button variant="outline" onClick={handleNewBack}>
                Previous
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>
              Cancel
            </Button>
            {newStep < 3 ? (
              <Button onClick={handleNewNext} className="bg-primary">Next</Button>
            ) : (
              <Button onClick={handleNewSubmit} className="bg-primary">Create Evidence</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Evidence Dialog - Single Page */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingEvidence(null);
          setEditControlId("");
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">Edit Evidence</DialogTitle>
            <DialogDescription>Modify the evidence details below</DialogDescription>
          </DialogHeader>

          {editingEvidence && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-primary">Evidence code</Label>
                  <Input value={editingEvidence.evidenceCode} disabled />
                </div>
                <div>
                  <Label className="text-primary">Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={editingEvidence.name}
                    onChange={(e) =>
                      setEditingEvidence({ ...editingEvidence, name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <Label className="text-primary">Evidence requirement</Label>
                <Input
                  value={editingEvidence.description || ""}
                  onChange={(e) =>
                    setEditingEvidence({ ...editingEvidence, description: e.target.value })
                  }
                />
              </div>

              <div>
                <Label className="text-primary">Recurrence <span className="text-red-500">*</span></Label>
                <RadioGroup
                  value={editingEvidence.recurrence || ""}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, recurrence: value })
                  }
                  className="flex flex-wrap gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Yearly" id="edit-yearly" />
                    <Label htmlFor="edit-yearly">Yearly</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Half-yearly" id="edit-half-yearly" />
                    <Label htmlFor="edit-half-yearly">Half-yearly</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Quarterly" id="edit-quarterly" />
                    <Label htmlFor="edit-quarterly">Quarterly</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Monthly" id="edit-monthly" />
                    <Label htmlFor="edit-monthly">Monthly</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-primary">Entities</Label>
                <RadioGroup
                  value={editingEvidence.entities || "Organization Wide"}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, entities: value })
                  }
                  className="flex flex-wrap gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Organization Wide" id="edit-org-wide" />
                    <Label htmlFor="edit-org-wide">Organization Wide</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-primary">Status</Label>
                <RadioGroup
                  value={editingEvidence.status}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, status: value })
                  }
                  className="flex flex-wrap gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Not Uploaded" id="edit-not-uploaded" />
                    <Label htmlFor="edit-not-uploaded">Not Uploaded</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Draft" id="edit-draft" />
                    <Label htmlFor="edit-draft">Draft</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Need Attention" id="edit-need-attention" />
                    <Label htmlFor="edit-need-attention">Need Attention</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Published" id="edit-published" />
                    <Label htmlFor="edit-published">Published</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Validated (For Filters)" id="edit-validated-filters" />
                    <Label htmlFor="edit-validated-filters">Validated (For Filters)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Validated" id="edit-validated" />
                    <Label htmlFor="edit-validated">Validated</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-primary">Review date</Label>
                <Input
                  type="date"
                  value={editingEvidence.reviewDate?.split("T")[0] || ""}
                  onChange={(e) =>
                    setEditingEvidence({ ...editingEvidence, reviewDate: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-primary">Is control linked</Label>
                  <RadioGroup
                    value={editingEvidence.isControlLinked ? "Yes" : "No"}
                    onValueChange={(value) =>
                      setEditingEvidence({
                        ...editingEvidence,
                        isControlLinked: value === "Yes",
                      })
                    }
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Yes" id="edit-control-yes" />
                      <Label htmlFor="edit-control-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="No" id="edit-control-no" />
                      <Label htmlFor="edit-control-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-primary">Is policy linked</Label>
                  <RadioGroup
                    value={editingEvidence.isPolicyLinked ? "Yes" : "No"}
                    onValueChange={(value) =>
                      setEditingEvidence({
                        ...editingEvidence,
                        isPolicyLinked: value === "Yes",
                      })
                    }
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Yes" id="edit-policy-yes" />
                      <Label htmlFor="edit-policy-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="No" id="edit-policy-no" />
                      <Label htmlFor="edit-policy-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div>
                <Label className="text-primary">Artifact description</Label>
                <Input
                  value={editingEvidence.artifactDescription || ""}
                  onChange={(e) =>
                    setEditingEvidence({
                      ...editingEvidence,
                      artifactDescription: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label className="text-primary">Is KPI</Label>
                <RadioGroup
                  value={editingEvidence.isKPI ? "Yes" : "No"}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, isKPI: value === "Yes" })
                  }
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Yes" id="edit-kpi-yes" />
                    <Label htmlFor="edit-kpi-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="No" id="edit-kpi-no" />
                    <Label htmlFor="edit-kpi-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              {editingEvidence.isKPI && (
                <>
                  <div>
                    <Label className="text-primary">Kpi description</Label>
                    <Input
                      value={editingEvidence.kpiDescription || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiDescription: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label className="text-primary">Kpi expected score</Label>
                    <Input
                      type="number"
                      value={editingEvidence.kpiExpectedScore || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiExpectedScore: parseInt(e.target.value) || null,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label className="text-primary">Kpi objective</Label>
                    <Input
                      value={editingEvidence.kpiObjective || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiObjective: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label className="text-primary">Kpi data source</Label>
                    <Input
                      value={editingEvidence.kpiDataSource || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiDataSource: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label className="text-primary">Kpi calculation formula</Label>
                    <Input
                      value={editingEvidence.kpiCalculationFormula || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiCalculationFormula: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}

              <div>
                <Label className="text-primary">Is added</Label>
                <RadioGroup
                  value={editingEvidence.isAdded ? "Yes" : "No"}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, isAdded: value === "Yes" })
                  }
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Yes" id="edit-added-yes" />
                    <Label htmlFor="edit-added-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="No" id="edit-added-no" />
                    <Label htmlFor="edit-added-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-primary">AI status</Label>
                <RadioGroup
                  value={editingEvidence.aiStatus || ""}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, aiStatus: value })
                  }
                  className="flex flex-wrap gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Compliant" id="edit-ai-compliant" />
                    <Label htmlFor="edit-ai-compliant">Compliant</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Non Compliant" id="edit-ai-non-compliant" />
                    <Label htmlFor="edit-ai-non-compliant">Non Compliant</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Partially Compliant" id="edit-ai-partial" />
                    <Label htmlFor="edit-ai-partial">Partially Compliant</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-primary">AI response Justification</Label>
                <Input
                  value={editingEvidence.aiJustification || ""}
                  onChange={(e) =>
                    setEditingEvidence({
                      ...editingEvidence,
                      aiJustification: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label className="text-primary">Control</Label>
                <Select value={editControlId || "_none"} onValueChange={(v) => setEditControlId(v === "_none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select control" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No control</SelectItem>
                    {controls.map((control) => (
                      <SelectItem key={control.id} value={control.id}>
                        {control.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} className="bg-primary">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-primary">Confirmation</DialogTitle>
            <DialogDescription>Are you sure you want to delete this?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDelete} className="bg-primary">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-primary">Confirmation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {evidences.length} evidences?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteAll} className="bg-primary">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setImportName("");
          setImportFile(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-primary">Edit Template document</DialogTitle>
            <DialogDescription>Import evidences from a file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-primary">Name</Label>
              <Input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Enter name"
              />
            </div>
            <div>
              <Label className="text-primary">File</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              Download Templete
            </Button>
            <Button onClick={handleImportSubmit} className="bg-primary">
              Import
            </Button>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
