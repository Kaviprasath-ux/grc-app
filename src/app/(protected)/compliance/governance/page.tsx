"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Upload,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface Policy {
  id: string;
  code: string;
  name: string;
  version: string;
  documentType: string;
  recurrence?: string;
  status: string;
  effectiveDate?: string;
  reviewDate?: string;
  aiReviewStatus?: string;
  aiReviewScore?: number;
  department?: { id: string; name: string };
  assignee?: { id: string; fullName: string };
  approver?: { id: string; fullName: string };
  _count?: { policyControls: number; attachments: number };
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
}

interface Framework {
  id: string;
  name: string;
  code: string;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  status: string;
  domain?: { id: string; name: string };
}

interface Domain {
  id: string;
  name: string;
}

const DOCUMENT_TYPES = ["Policy", "Standard", "Procedure"];
const RECURRENCE_OPTIONS = ["Weekly", "Monthly", "Quarterly", "Yearly"];

export default function GovernancePage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDocType, setActiveDocType] = useState<string>("Policy");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;

  // Filters
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");

  // Filter options
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);

  // Create dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    documentType: "Policy",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
  });

  // Step 2 - Control linking
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlSearch, setControlSearch] = useState("");
  const [controlDomainFilter, setControlDomainFilter] = useState<string>("all");
  const [controlStatusFilter, setControlStatusFilter] = useState<string>("all");

  // Delete dialogs
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);

  // Import dialog
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [activeDocType, currentPage, frameworkFilter]);

  const fetchFilterOptions = async () => {
    try {
      const [deptRes, userRes, frameworkRes, controlRes, domainRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/frameworks"),
        fetch("/api/controls"),
        fetch("/api/control-domains"),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (frameworkRes.ok) {
        const data = await frameworkRes.json();
        setFrameworks(Array.isArray(data) ? data : data.data || []);
      }
      if (controlRes.ok) {
        const data = await controlRes.json();
        setControls(Array.isArray(data) ? data : data.data || []);
      }
      if (domainRes.ok) {
        const data = await domainRes.json();
        setDomains(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", itemsPerPage.toString());
      params.set("documentType", activeDocType);
      if (frameworkFilter && frameworkFilter !== "all") params.set("frameworkId", frameworkFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/policies?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  }, [activeDocType, currentPage, frameworkFilter, search]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchPolicies();
  };

  const handleCreatePolicy = async () => {
    try {
      const response = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPolicy,
          controlIds: selectedControlIds,
        }),
      });
      if (response.ok) {
        setIsCreateDialogOpen(false);
        resetCreateDialog();
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error creating policy:", error);
    }
  };

  const resetCreateDialog = () => {
    setCreateStep(1);
    setNewPolicy({
      name: "",
      documentType: activeDocType,
      recurrence: "",
      departmentId: "",
      assigneeId: "",
    });
    setSelectedControlIds([]);
    setControlSearch("");
    setControlDomainFilter("all");
    setControlStatusFilter("all");
  };

  const handleDeletePolicy = async () => {
    if (!policyToDelete) return;
    try {
      const response = await fetch(`/api/policies/${policyToDelete.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting policy:", error);
    } finally {
      setIsDeleteDialogOpen(false);
      setPolicyToDelete(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const response = await fetch(`/api/policies/delete-all?documentType=${activeDocType}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting all policies:", error);
    } finally {
      setIsDeleteAllDialogOpen(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("documentType", activeDocType);

      const response = await fetch("/api/policies/import", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        fetchPolicies();
        setIsImportDialogOpen(false);
        setImportFile(null);
      }
    } catch (error) {
      console.error("Error importing:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setImportFile(files[0]);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Published": return "bg-green-100 text-green-800";
      case "Approved": return "bg-blue-100 text-blue-800";
      case "Draft": return "bg-yellow-100 text-yellow-800";
      case "Needs Review": return "bg-orange-100 text-orange-800";
      case "Not Uploaded": return "bg-gray-100 text-gray-800";
      case "Pending Approval": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Filter controls for Step 2
  const filteredControls = controls.filter((control) => {
    const matchesSearch = !controlSearch ||
      control.name.toLowerCase().includes(controlSearch.toLowerCase()) ||
      control.controlCode.toLowerCase().includes(controlSearch.toLowerCase());
    const matchesDomain = controlDomainFilter === "all" || control.domain?.id === controlDomainFilter;
    const matchesStatus = controlStatusFilter === "all" || control.status === controlStatusFilter;
    return matchesSearch && matchesDomain && matchesStatus;
  });

  // Filter users by selected department
  const filteredUsers = newPolicy.departmentId
    ? users.filter((u) => u.departmentId === newPolicy.departmentId || !u.departmentId)
    : users;

  const handleTabChange = (tab: string) => {
    setActiveDocType(tab);
    setCurrentPage(1);
    setSearch("");
    setFrameworkFilter("all");
  };

  const canProceedStep1 = newPolicy.name && newPolicy.departmentId && newPolicy.documentType && newPolicy.recurrence && newPolicy.assigneeId;

  // Pagination helpers
  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Governance</h1>
        <div className="flex gap-2">
          <Button onClick={() => {
            setNewPolicy({ ...newPolicy, documentType: activeDocType });
            setIsCreateDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            New Governance
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setIsDeleteAllDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeDocType} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="Policy">Policy</TabsTrigger>
          <TabsTrigger value="Standard">Standards</TabsTrigger>
          <TabsTrigger value="Procedure">Procedures</TabsTrigger>
        </TabsList>

        {/* Tab Content - Same structure for all tabs */}
        {["Policy", "Standard", "Procedure"].map((docType) => (
          <TabsContent key={docType} value={docType} className="mt-4 space-y-4">
            {/* Search and Filter Row */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Input
                  placeholder={` Search By ${docType} Name , ${docType} Code`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={handleSearch}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Integrated Framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Integrated Framework</SelectItem>
                  {frameworks.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Approver</TableHead>
                        <TableHead>Department Name</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map((policy) => (
                        <TableRow
                          key={policy.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onDoubleClick={() => router.push(`/compliance/governance/${policy.id}`)}
                        >
                          <TableCell className="font-medium">{policy.code}</TableCell>
                          <TableCell>{policy.name}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(policy.status)}>
                              {policy.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{policy.assignee?.fullName || ""}</TableCell>
                          <TableCell>{policy.approver?.fullName || ""}</TableCell>
                          <TableCell>{policy.department?.name || ""}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/compliance/governance/${policy.id}`);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPolicyToDelete(policy);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {policies.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No {docType.toLowerCase()}s found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-4">
                    Currently showing {startItem} to {endItem} of {total}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Dialog - 3 Steps */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateDialog();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              New Governance - Step {createStep} of 3
            </DialogTitle>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === createStep
                    ? "bg-primary text-primary-foreground"
                    : step < createStep
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 ${step < createStep ? "bg-green-500" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="py-4">
            {/* Step 1: Basic Information */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Governance Name *</Label>
                  <Input
                    id="name"
                    value={newPolicy.name}
                    onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                    placeholder="Enter governance name"
                  />
                </div>
                <div>
                  <Label htmlFor="departmentId">Department *</Label>
                  <Select value={newPolicy.departmentId} onValueChange={(v) => setNewPolicy({ ...newPolicy, departmentId: v, assigneeId: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="documentType">Document Type *</Label>
                  <Select value={newPolicy.documentType} onValueChange={(v) => setNewPolicy({ ...newPolicy, documentType: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="recurrence">Recurrence *</Label>
                  <Select value={newPolicy.recurrence} onValueChange={(v) => setNewPolicy({ ...newPolicy, recurrence: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assigneeId">Assignee *</Label>
                  <Select value={newPolicy.assigneeId} onValueChange={(v) => setNewPolicy({ ...newPolicy, assigneeId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Link Controls */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-medium">Select Controls to Link</Label>
                  <Badge variant="secondary">{selectedControlIds.length} selected</Badge>
                </div>

                {/* Control Filters */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search controls..."
                      value={controlSearch}
                      onChange={(e) => setControlSearch(e.target.value)}
                    />
                  </div>
                  <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Domains</SelectItem>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlStatusFilter} onValueChange={setControlStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Compliant">Compliant</SelectItem>
                      <SelectItem value="Non Compliant">Non Compliant</SelectItem>
                      <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Controls Table */}
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Control Code</TableHead>
                        <TableHead>Control Name</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedControlIds.includes(control.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedControlIds([...selectedControlIds, control.id]);
                                } else {
                                  setSelectedControlIds(selectedControlIds.filter((id) => id !== control.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{control.controlCode}</TableCell>
                          <TableCell>{control.name}</TableCell>
                          <TableCell>{control.domain?.name || "-"}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(control.status)}>
                              {control.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredControls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No controls found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {createStep === 3 && (
              <div className="space-y-6">
                <div className="text-lg font-medium">Review Information</div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="text-muted-foreground text-sm">Governance Name</Label>
                    <p className="font-medium">{newPolicy.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Document Type</Label>
                    <p className="font-medium">{newPolicy.documentType}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Recurrence</Label>
                    <p className="font-medium">{newPolicy.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Department</Label>
                    <p className="font-medium">
                      {departments.find((d) => d.id === newPolicy.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Assignee</Label>
                    <p className="font-medium">
                      {users.find((u) => u.id === newPolicy.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Linked Controls</Label>
                    <p className="font-medium">{selectedControlIds.length} controls</p>
                  </div>
                </div>

                {selectedControlIds.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-sm mb-2 block">Selected Controls:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedControlIds.map((id) => {
                        const control = controls.find((c) => c.id === id);
                        return control ? (
                          <Badge key={id} variant="outline">
                            {control.controlCode}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                resetCreateDialog();
                setIsCreateDialogOpen(false);
              }
            }}>
              {createStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button
              onClick={() => {
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreatePolicy();
              }}
              disabled={createStep === 1 && !canProceedStep1}
            >
              {createStep === 3 ? `Create ${newPolicy.documentType}` : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Single Policy Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {policyToDelete?.documentType || "Policy"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{policyToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPolicyToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePolicy} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All {activeDocType}s</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {activeDocType.toLowerCase()}s? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import {activeDocType}s</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {importFile ? (
                <div className="space-y-2">
                  <p className="font-medium">{importFile.name}</p>
                  <Button variant="outline" size="sm" onClick={() => setImportFile(null)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Drag and drop a file here, or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    id="import-file"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        setImportFile(files[0]);
                      }
                    }}
                  />
                  <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()}>
                    Browse Files
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
