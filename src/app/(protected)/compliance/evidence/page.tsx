"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  Upload,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Download,
} from "lucide-react";

interface Evidence {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  domain: string | null;
  recurrence: string | null;
  status: string;
  departmentId: string | null;
  assigneeId: string | null;
  department?: { id: string; name: string } | null;
  assignee?: { id: string; fullName: string } | null;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  entities: string;
  domain?: { id: string; name: string } | null;
  framework?: { id: string; name: string } | null;
  functionalGrouping: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId: string | null;
}

interface Framework {
  id: string;
  name: string;
}

interface ControlDomain {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-gray-100 text-gray-800",
  Draft: "bg-yellow-100 text-yellow-800",
  Validated: "bg-blue-100 text-blue-800",
  Published: "bg-green-100 text-green-800",
  "Need Attention": "bg-red-100 text-red-800",
};

const recurrenceOptions = ["Yearly", "Half-yearly", "Quarterly", "Monthly"];

export default function EvidencePage() {
  const router = useRouter();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);

  // Import dialog states
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Delete dialogs
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);

  // Filters
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
  });

  // Step 2 - Control selection
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlFilters, setControlFilters] = useState({
    domainId: "",
    frameworkId: "",
    functionalGrouping: "",
    search: "",
  });

  const fetchEvidences = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (frameworkFilter && frameworkFilter !== "all") params.append("frameworkId", frameworkFilter);
      if (searchTerm) params.append("search", searchTerm);
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());

      const response = await fetch(`/api/evidences?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEvidences(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoading(false);
    }
  }, [frameworkFilter, searchTerm, currentPage]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [deptRes, usersRes, fwRes, controlsRes, domainsRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/frameworks"),
        fetch("/api/controls?limit=500"),
        fetch("/api/control-domains"),
      ]);

      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.data || data || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data || data || []);
      }
      if (fwRes.ok) {
        const data = await fwRes.json();
        setFrameworks(data.data || data || []);
      }
      if (controlsRes.ok) {
        const data = await controlsRes.json();
        setControls(data.data || data || []);
      }
      if (domainsRes.ok) {
        const data = await domainsRes.json();
        setControlDomains(data.data || data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    fetchEvidences();
  }, [fetchEvidences]);

  // Filtered users by department
  const filteredUsers = createForm.departmentId
    ? users.filter((u) => u.departmentId === createForm.departmentId)
    : users;

  // Filtered controls for step 2
  const filteredControls = controls.filter((c) => {
    if (controlFilters.domainId && c.domain?.id !== controlFilters.domainId) return false;
    if (controlFilters.frameworkId && c.framework?.id !== controlFilters.frameworkId) return false;
    if (controlFilters.functionalGrouping && c.functionalGrouping !== controlFilters.functionalGrouping) return false;
    if (controlFilters.search) {
      const search = controlFilters.search.toLowerCase();
      if (!c.controlCode.toLowerCase().includes(search) && !c.name.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const handleSearch = () => {
    setCurrentPage(1);
    fetchEvidences();
  };

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/evidences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          recurrence: createForm.recurrence,
          departmentId: createForm.departmentId || null,
          assigneeId: createForm.assigneeId || null,
          controlIds: selectedControlIds,
          status: "Not Uploaded",
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        resetCreateForm();
        fetchEvidences();
      }
    } catch (error) {
      console.error("Error creating evidence:", error);
    }
  };

  const resetCreateForm = () => {
    setCreateStep(1);
    setCreateForm({
      name: "",
      description: "",
      recurrence: "",
      departmentId: "",
      assigneeId: "",
    });
    setSelectedControlIds([]);
    setControlFilters({
      domainId: "",
      frameworkId: "",
      functionalGrouping: "",
      search: "",
    });
  };

  const handleDeleteAll = async () => {
    try {
      const response = await fetch("/api/evidences/delete-all", {
        method: "DELETE",
      });
      if (response.ok) {
        fetchEvidences();
      }
    } catch (error) {
      console.error("Error deleting all evidences:", error);
    } finally {
      setIsDeleteAllDialogOpen(false);
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

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/api/evidences/import", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchEvidences();
      }
    } catch (error) {
      console.error("Error importing evidences:", error);
    } finally {
      setImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    }
  };

  const toggleControlSelection = (controlId: string) => {
    setSelectedControlIds((prev) =>
      prev.includes(controlId)
        ? prev.filter((id) => id !== controlId)
        : [...prev, controlId]
    );
  };

  const canProceedStep1 = createForm.name && createForm.recurrence && createForm.departmentId && createForm.assigneeId;

  // Pagination helpers
  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Evidence</h1>
        <div className="flex gap-2">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Evidence
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

      {/* Search and Filter Row */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Input
            placeholder="Search by Name, Domain and Assignee"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
                  <TableHead>Evidence Code</TableHead>
                  <TableHead>Evidence Name</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Department Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidences.map((evidence) => (
                  <TableRow
                    key={evidence.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onDoubleClick={() => router.push(`/compliance/evidence/${evidence.id}`)}
                  >
                    <TableCell className="font-medium">{evidence.evidenceCode}</TableCell>
                    <TableCell>{evidence.name}</TableCell>
                    <TableCell>{evidence.domain || ""}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[evidence.status] || "bg-gray-100 text-gray-800"}>
                        {evidence.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{evidence.assignee?.fullName || ""}</TableCell>
                    <TableCell>{evidence.department?.name || ""}</TableCell>
                  </TableRow>
                ))}
                {evidences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No evidence records found
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

      {/* Create Evidence Dialog - 3 Step Wizard */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateForm();
        setCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              New Evidence - Step {createStep} of 3
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
                  {step < createStep ? <Check className="h-4 w-4" /> : step}
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
                  <Label htmlFor="name">Evidence Requirement *</Label>
                  <Input
                    id="name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Enter evidence requirement"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recurrence">Recurrence *</Label>
                    <Select value={createForm.recurrence} onValueChange={(v) => setCreateForm({ ...createForm, recurrence: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select recurrence" />
                      </SelectTrigger>
                      <SelectContent>
                        {recurrenceOptions.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="departmentId">Department *</Label>
                    <Select value={createForm.departmentId} onValueChange={(v) => setCreateForm({ ...createForm, departmentId: v, assigneeId: "" })}>
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
                </div>
                <div>
                  <Label htmlFor="assigneeId">Assignee *</Label>
                  <Select value={createForm.assigneeId} onValueChange={(v) => setCreateForm({ ...createForm, assigneeId: v })} disabled={!createForm.departmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder={createForm.departmentId ? "Select assignee" : "Select department first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Enter description"
                    rows={3}
                  />
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
                <div className="grid grid-cols-3 gap-4">
                  <Select value={controlFilters.domainId || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, domainId: v === "all" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Domains</SelectItem>
                      {controlDomains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlFilters.frameworkId || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, frameworkId: v === "all" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Framework" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Frameworks</SelectItem>
                      {frameworks.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlFilters.functionalGrouping || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, functionalGrouping: v === "all" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Functional Grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groupings</SelectItem>
                      <SelectItem value="Govern">Govern</SelectItem>
                      <SelectItem value="Identify">Identify</SelectItem>
                      <SelectItem value="Protect">Protect</SelectItem>
                      <SelectItem value="Detect">Detect</SelectItem>
                      <SelectItem value="Respond">Respond</SelectItem>
                      <SelectItem value="Recover">Recover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search controls..."
                    value={controlFilters.search}
                    onChange={(e) => setControlFilters({ ...controlFilters, search: e.target.value })}
                    className="pl-10"
                  />
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id} className="cursor-pointer" onClick={() => toggleControlSelection(control.id)}>
                          <TableCell>
                            <Checkbox
                              checked={selectedControlIds.includes(control.id)}
                              onCheckedChange={() => toggleControlSelection(control.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{control.controlCode}</TableCell>
                          <TableCell>{control.name}</TableCell>
                          <TableCell>{control.domain?.name || "-"}</TableCell>
                        </TableRow>
                      ))}
                      {filteredControls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                    <Label className="text-muted-foreground text-sm">Evidence Name</Label>
                    <p className="font-medium">{createForm.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Recurrence</Label>
                    <p className="font-medium">{createForm.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Department</Label>
                    <p className="font-medium">
                      {departments.find((d) => d.id === createForm.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Assignee</Label>
                    <p className="font-medium">
                      {users.find((u) => u.id === createForm.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Linked Controls</Label>
                    <p className="font-medium">{selectedControlIds.length} controls</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Description</Label>
                    <p className="font-medium">{createForm.description || "-"}</p>
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
                resetCreateForm();
                setCreateDialogOpen(false);
              }
            }}>
              {createStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button
              onClick={() => {
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreate();
              }}
              disabled={createStep === 1 && !canProceedStep1}
            >
              {createStep === 3 ? "Create Evidence" : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Evidence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all evidence records? This action cannot be undone.
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
            <DialogTitle>Import Evidence</DialogTitle>
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
                    ref={importFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    id="import-file"
                    onChange={handleImportFileChange}
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
            <Button onClick={handleImportSubmit} disabled={!importFile || importing}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
