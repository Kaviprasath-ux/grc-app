"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Download, Upload, Search, ChevronRight } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

interface Stakeholder {
  id: string;
  name: string;
  email: string | null;
  type: string;
  status: string;
  departmentId: string | null;
  department: Department | null;
}

interface User {
  id: string;
  fullName: string;
  departmentId: string | null;
}

interface Issue {
  id: string;
  title: string;
  description: string | null;
  domain: string;
  category: string;
  issueType: string;
  status: string;
  dueDate: string | null;
  departmentId: string | null;
  department: Department | null;
  ownerId: string | null;
  owner: User | null;
}

// Issue types from reference
const issueTypes = ["Financial", "Operational", "Data hack", "Compliance", "Security"];

// 5-step wizard for adding issues
const ISSUE_STEPS = [
  { id: 1, name: "Info", description: "Basic information" },
  { id: 2, name: "Regulations", description: "Related regulations" },
  { id: 3, name: "Process", description: "Related processes" },
  { id: 4, name: "Stakeholder", description: "Related stakeholders" },
  { id: 5, name: "Preview & Save", description: "Review and submit" },
];

export default function ContextPage() {
  const [activeTab, setActiveTab] = useState("stakeholder");
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [stakeholderSearch, setStakeholderSearch] = useState("");
  const [stakeholderTypeFilter, setStakeholderTypeFilter] = useState("all");
  const [stakeholderStatusFilter, setStakeholderStatusFilter] = useState("all");
  const [issueDomainFilter, setIssueDomainFilter] = useState("all");
  const [issueCategoryFilter, setIssueCategoryFilter] = useState("all");
  const [issueDepartmentFilter, setIssueDepartmentFilter] = useState("all");
  const [issueSearch, setIssueSearch] = useState("");

  // Form states
  const [showAddStakeholder, setShowAddStakeholder] = useState(false);
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ type: string; id: string } | null>(null);

  // New stakeholder form
  const [newStakeholder, setNewStakeholder] = useState({
    name: "",
    email: "",
    type: "Internal",
    status: "Active",
    departmentId: "",
  });

  // New issue form
  const [newIssue, setNewIssue] = useState({
    title: "",
    description: "",
    domain: "Internal",
    category: "Finance",
    issueType: "",
    status: "Open",
    dueDate: "",
    departmentId: "",
    ownerId: "",
    selectedRegulations: [] as string[],
    selectedProcesses: [] as string[],
    selectedStakeholders: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stakeholderRes, issueRes, deptRes, usersRes] = await Promise.all([
        fetch("/api/stakeholders"),
        fetch("/api/issues"),
        fetch("/api/departments"),
        fetch("/api/users"),
      ]);

      if (stakeholderRes.ok) setStakeholders(await stakeholderRes.json());
      if (issueRes.ok) setIssues(await issueRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Filter stakeholders
  const filteredStakeholders = stakeholders.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(stakeholderSearch.toLowerCase());
    const matchesType = stakeholderTypeFilter === "all" || s.type === stakeholderTypeFilter;
    const matchesStatus = stakeholderStatusFilter === "all" || s.status === stakeholderStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Filter issues
  const filteredIssues = issues.filter((i) => {
    const matchesSearch = i.title.toLowerCase().includes(issueSearch.toLowerCase()) ||
      (i.description && i.description.toLowerCase().includes(issueSearch.toLowerCase()));
    const matchesDomain = issueDomainFilter === "all" || i.domain === issueDomainFilter;
    const matchesCategory = issueCategoryFilter === "all" || i.category === issueCategoryFilter;
    const matchesDepartment = issueDepartmentFilter === "all" || i.departmentId === issueDepartmentFilter;
    return matchesSearch && matchesDomain && matchesCategory && matchesDepartment;
  });

  // Stakeholder CRUD
  const handleAddStakeholder = async () => {
    if (!newStakeholder.name.trim()) return;
    try {
      const res = await fetch("/api/stakeholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newStakeholder,
          departmentId: newStakeholder.departmentId || null,
        }),
      });
      if (res.ok) {
        const stakeholder = await res.json();
        setStakeholders([...stakeholders, stakeholder]);
        setNewStakeholder({
          name: "",
          email: "",
          type: "Internal",
          status: "Active",
          departmentId: "",
        });
        setShowAddStakeholder(false);
      }
    } catch (error) {
      console.error("Error adding stakeholder:", error);
    }
  };

  const handleDeleteStakeholder = async (id: string) => {
    try {
      const res = await fetch(`/api/stakeholders/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStakeholders(stakeholders.filter((s) => s.id !== id));
      }
    } catch (error) {
      console.error("Error deleting stakeholder:", error);
    }
    setIsDeleteDialogOpen(false);
    setDeletingItem(null);
  };

  // Issue CRUD
  const handleAddIssue = async () => {
    if (!newIssue.title.trim()) return;
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newIssue.title,
          description: newIssue.description,
          domain: newIssue.domain,
          category: newIssue.category,
          status: newIssue.status,
          dueDate: newIssue.dueDate || null,
          departmentId: newIssue.departmentId || null,
        }),
      });
      if (res.ok) {
        const issue = await res.json();
        setIssues([...issues, issue]);
        setNewIssue({
          title: "",
          description: "",
          domain: "Internal",
          category: "Finance",
          issueType: "",
          status: "Open",
          dueDate: "",
          departmentId: "",
          ownerId: "",
          selectedRegulations: [] as string[],
          selectedProcesses: [] as string[],
          selectedStakeholders: [] as string[],
        });
        setShowAddIssue(false);
        setCurrentStep(1);
      }
    } catch (error) {
      console.error("Error adding issue:", error);
    }
  };

  const handleDeleteIssue = async (id: string) => {
    try {
      const res = await fetch(`/api/issues/${id}`, { method: "DELETE" });
      if (res.ok) {
        setIssues(issues.filter((i) => i.id !== id));
      }
    } catch (error) {
      console.error("Error deleting issue:", error);
    }
    setIsDeleteDialogOpen(false);
    setDeletingItem(null);
  };

  const confirmDelete = () => {
    if (!deletingItem) return;
    if (deletingItem.type === "stakeholder") {
      handleDeleteStakeholder(deletingItem.id);
    } else if (deletingItem.type === "issue") {
      handleDeleteIssue(deletingItem.id);
    }
  };

  // Stakeholder columns
  const stakeholderColumns: ColumnDef<Stakeholder>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-muted-foreground">{row.getValue("email") || "-"}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        return (
          <Badge variant={type === "Internal" ? "default" : type === "External" ? "secondary" : "outline"}>
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "department.name",
      header: "Department",
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant={status === "Active" ? "default" : "secondary"}>
            {status}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setDeletingItem({ type: "stakeholder", id: row.original.id });
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Get unique categories and domains from issues
  const uniqueCategories = [...new Set(issues.map((i) => i.category))];
  const uniqueDomains = [...new Set(issues.map((i) => i.domain))];

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-red-100 text-red-800";
      case "In Progress":
        return "bg-yellow-100 text-yellow-800";
      case "Pending":
        return "bg-blue-100 text-blue-800";
      case "Resolved":
        return "bg-green-100 text-green-800";
      case "Closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Add Stakeholder Form (Full Page)
  if (showAddStakeholder) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="New Stakeholder"
          actions={[
            {
              label: "Cancel",
              variant: "outline",
              onClick: () => setShowAddStakeholder(false),
            },
          ]}
        />

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <Label>Stakeholder Type</Label>
              <RadioGroup
                value={newStakeholder.type}
                onValueChange={(value) => setNewStakeholder({ ...newStakeholder, type: value })}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Internal" id="internal" />
                  <Label htmlFor="internal" className="font-normal">Internal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="External" id="external" />
                  <Label htmlFor="external" className="font-normal">External</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Third Party" id="thirdparty" />
                  <Label htmlFor="thirdparty" className="font-normal">Third Party</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="stakeholderName">Stakeholder Name *</Label>
                <Input
                  id="stakeholderName"
                  value={newStakeholder.name}
                  onChange={(e) => setNewStakeholder({ ...newStakeholder, name: e.target.value })}
                  placeholder="Enter stakeholder name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stakeholderEmail">Email</Label>
                <Input
                  id="stakeholderEmail"
                  type="email"
                  value={newStakeholder.email}
                  onChange={(e) => setNewStakeholder({ ...newStakeholder, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={newStakeholder.departmentId}
                  onValueChange={(value) => setNewStakeholder({ ...newStakeholder, departmentId: value })}
                >
                  <SelectTrigger>
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
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={newStakeholder.status}
                  onValueChange={(value) => setNewStakeholder({ ...newStakeholder, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowAddStakeholder(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddStakeholder}>Save Stakeholder</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Add Issue Form (5-Step Wizard)
  if (showAddIssue) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Add Issue"
          actions={[
            {
              label: "Cancel",
              variant: "outline",
              onClick: () => {
                setShowAddIssue(false);
                setCurrentStep(1);
              },
            },
          ]}
        />

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-2 py-4">
          {ISSUE_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  currentStep === step.id
                    ? "bg-blue-600 text-white"
                    : currentStep > step.id
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {step.id}
              </div>
              <span className={`ml-2 text-sm ${currentStep === step.id ? "font-medium" : "text-muted-foreground"}`}>
                {step.name}
              </span>
              {index < ISSUE_STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-4 text-gray-400" />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Step 1: Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="issueTitle">Issue Title *</Label>
                    <Input
                      id="issueTitle"
                      value={newIssue.title}
                      onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                      placeholder="Enter issue title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Domain *</Label>
                    <Select
                      value={newIssue.domain}
                      onValueChange={(value) => setNewIssue({ ...newIssue, domain: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Internal">Internal</SelectItem>
                        <SelectItem value="External">External</SelectItem>
                        <SelectItem value="IT">IT</SelectItem>
                        <SelectItem value="GRC">GRC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select
                      value={newIssue.category}
                      onValueChange={(value) => setNewIssue({ ...newIssue, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Human Resources">Human Resources</SelectItem>
                        <SelectItem value="Data breach">Data breach</SelectItem>
                        <SelectItem value="Compliance">Compliance</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="Security">Security</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={newIssue.departmentId}
                      onValueChange={(value) => setNewIssue({ ...newIssue, departmentId: value, ownerId: "" })}
                    >
                      <SelectTrigger>
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
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Issue Owner</Label>
                    <Select
                      value={newIssue.ownerId}
                      onValueChange={(value) => setNewIssue({ ...newIssue, ownerId: value })}
                      disabled={!newIssue.departmentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={newIssue.departmentId ? "Select owner" : "Select department first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter((user) => !newIssue.departmentId || user.departmentId === newIssue.departmentId)
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Issue Type</Label>
                    <Select
                      value={newIssue.issueType}
                      onValueChange={(value) => setNewIssue({ ...newIssue, issueType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {issueTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issueDescription">Description</Label>
                  <textarea
                    id="issueDescription"
                    value={newIssue.description}
                    onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                    placeholder="Enter issue description"
                    className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={newIssue.status}
                      onValueChange={(value) => setNewIssue({ ...newIssue, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Resolved">Resolved</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issueDueDate">Due Date</Label>
                    <Input
                      id="issueDueDate"
                      type="date"
                      value={newIssue.dueDate}
                      onChange={(e) => setNewIssue({ ...newIssue, dueDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Regulations */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Related Regulations</h3>
                <p className="text-muted-foreground text-sm">Select regulations related to this issue (optional)</p>
                <div className="border rounded-lg p-4 min-h-[200px] flex items-center justify-center text-muted-foreground">
                  No regulations available
                </div>
              </div>
            )}

            {/* Step 3: Process */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Related Processes</h3>
                <p className="text-muted-foreground text-sm">Select processes related to this issue (optional)</p>
                <div className="border rounded-lg p-4 min-h-[200px] flex items-center justify-center text-muted-foreground">
                  No processes available
                </div>
              </div>
            )}

            {/* Step 4: Stakeholder */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Related Stakeholders</h3>
                <p className="text-muted-foreground text-sm">Select stakeholders related to this issue (optional)</p>
                <div className="border rounded-lg p-4 min-h-[200px]">
                  {stakeholders.length > 0 ? (
                    <div className="space-y-2">
                      {stakeholders.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newIssue.selectedStakeholders.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewIssue({
                                  ...newIssue,
                                  selectedStakeholders: [...newIssue.selectedStakeholders, s.id],
                                });
                              } else {
                                setNewIssue({
                                  ...newIssue,
                                  selectedStakeholders: newIssue.selectedStakeholders.filter((id) => id !== s.id),
                                });
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <span>{s.name}</span>
                          <Badge variant="outline" className="ml-2">{s.type}</Badge>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-muted-foreground h-full">
                      No stakeholders available
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Preview & Save */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Preview & Save</h3>
                <div className="border rounded-lg p-6 space-y-4 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Title</Label>
                      <p className="font-medium">{newIssue.title || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Domain</Label>
                      <p className="font-medium">{newIssue.domain}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Category</Label>
                      <p className="font-medium">{newIssue.category}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Issue Type</Label>
                      <p className="font-medium">{newIssue.issueType || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p className="font-medium">{newIssue.status}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Due Date</Label>
                      <p className="font-medium">{newIssue.dueDate || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Department</Label>
                      <p className="font-medium">
                        {departments.find((d) => d.id === newIssue.departmentId)?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Issue Owner</Label>
                      <p className="font-medium">
                        {users.find((u) => u.id === newIssue.ownerId)?.fullName || "-"}
                      </p>
                    </div>
                  </div>
                  {newIssue.description && (
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="font-medium">{newIssue.description}</p>
                    </div>
                  )}
                  {newIssue.selectedStakeholders.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Related Stakeholders</Label>
                      <div className="flex gap-2 mt-1">
                        {newIssue.selectedStakeholders.map((id) => {
                          const stakeholder = stakeholders.find((s) => s.id === id);
                          return stakeholder ? (
                            <Badge key={id} variant="secondary">{stakeholder.name}</Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  if (currentStep === 1) {
                    setShowAddIssue(false);
                  } else {
                    setCurrentStep(currentStep - 1);
                  }
                }}
              >
                {currentStep === 1 ? "Cancel" : "Previous"}
              </Button>
              <Button
                onClick={() => {
                  if (currentStep === 5) {
                    handleAddIssue();
                  } else {
                    setCurrentStep(currentStep + 1);
                  }
                }}
              >
                {currentStep === 5 ? "Save Issue" : "Next"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Context" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stakeholder">Stakeholder</TabsTrigger>
          <TabsTrigger value="issuelist">Issue List</TabsTrigger>
        </TabsList>

        {/* Stakeholder Tab */}
        <TabsContent value="stakeholder" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stakeholders..."
                  value={stakeholderSearch}
                  onChange={(e) => setStakeholderSearch(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <Select value={stakeholderTypeFilter} onValueChange={setStakeholderTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Internal">Internal</SelectItem>
                  <SelectItem value="External">External</SelectItem>
                  <SelectItem value="Third Party">Third Party</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stakeholderStatusFilter} onValueChange={setStakeholderStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowAddStakeholder(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Stakeholder
            </Button>
          </div>

          <DataGrid
            columns={stakeholderColumns}
            data={filteredStakeholders}
            searchPlaceholder="Search..."
          />
        </TabsContent>

        {/* Issue List Tab */}
        <TabsContent value="issuelist" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search issues..."
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <Select value={issueDepartmentFilter} onValueChange={setIssueDepartmentFilter}>
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
              <Select value={issueCategoryFilter} onValueChange={setIssueCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={issueDomainFilter} onValueChange={setIssueDomainFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  {uniqueDomains.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
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
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
              <Button onClick={() => setShowAddIssue(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            </div>
          </div>

          {/* Issue Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIssues.map((issue) => (
              <Card key={issue.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{issue.title}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          setDeletingItem({ type: "issue", id: issue.id });
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {issue.description || "No description"}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="outline">{issue.domain}</Badge>
                    <Badge variant="outline">{issue.category}</Badge>
                    <Badge className={getStatusColor(issue.status)}>{issue.status}</Badge>
                  </div>
                  {issue.department && (
                    <p className="text-xs text-muted-foreground pt-2">
                      Department: {issue.department.name}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredIssues.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No issues found</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {deletingItem?.type}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
