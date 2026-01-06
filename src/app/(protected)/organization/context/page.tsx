"use client";

import { useState, useEffect, useRef } from "react";
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

interface Regulation {
  id: string;
  name: string;
  version: string | null;
  scope: string | null;
  status: string;
}

interface Process {
  id: string;
  processCode: string;
  name: string;
  description: string | null;
}

// Default options
const defaultDomains = ["Internal", "External", "IT", "GRC"];
const defaultCategories = ["Finance", "Human Resources", "Data breach", "Compliance", "Operations", "Security"];
const defaultIssueTypes = ["Financial", "Operational", "Data hack", "Compliance", "Security"];

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
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
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

  // Edit issue state
  const [showEditIssue, setShowEditIssue] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [editCurrentStep, setEditCurrentStep] = useState(1);
  const [editIssueForm, setEditIssueForm] = useState({
    title: "",
    description: "",
    domain: "",
    category: "",
    issueType: "",
    departmentId: "",
    ownerId: "",
    selectedRegulations: [] as string[],
    selectedProcesses: [] as string[],
  });

  // Edit Process dialog state
  const [showEditProcessDialog, setShowEditProcessDialog] = useState(false);
  const [editProcessSearchQuery, setEditProcessSearchQuery] = useState("");
  const [editTempSelectedProcesses, setEditTempSelectedProcesses] = useState<string[]>([]);

  // Edit Stakeholder step 4 state
  const [editStakeholderType, setEditStakeholderType] = useState("Internal");
  const [editSelectedStakeholderId, setEditSelectedStakeholderId] = useState("");
  const [editSelectedNeedExpectation, setEditSelectedNeedExpectation] = useState("");
  const [editStakeholderNeeds, setEditStakeholderNeeds] = useState<{ stakeholderId: string; needExpectation: string }[]>([]);

  // New stakeholder form
  const [newStakeholder, setNewStakeholder] = useState({
    name: "",
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

  // Dynamic options state
  const [domains, setDomains] = useState<string[]>(defaultDomains);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [issueTypes, setIssueTypes] = useState<string[]>(defaultIssueTypes);

  // Add new option dialogs
  const [showAddDomainDialog, setShowAddDomainDialog] = useState(false);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newType, setNewType] = useState("");

  // Process dialog state
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [processSearchQuery, setProcessSearchQuery] = useState("");
  const [tempSelectedProcesses, setTempSelectedProcesses] = useState<string[]>([]);

  // Stakeholder step 4 state
  const [stakeholderType, setStakeholderType] = useState("Internal");
  const [selectedStakeholderId, setSelectedStakeholderId] = useState("");
  const [selectedNeedExpectation, setSelectedNeedExpectation] = useState("");
  const [stakeholderNeeds, setStakeholderNeeds] = useState<{ stakeholderId: string; needExpectation: string }[]>([]);
  const [needExpectationOptions] = useState(["Compliance", "Security", "Business Continuity", "Data Protection", "Risk Management", "Audit Support"]);
  const [showAddNeedDialog, setShowAddNeedDialog] = useState(false);
  const [newNeedExpectation, setNewNeedExpectation] = useState("");
  const [customNeedExpectations, setCustomNeedExpectations] = useState<string[]>([]);

  // Handlers for adding new options
  const handleAddDomain = () => {
    if (newDomain.trim() && !domains.includes(newDomain.trim())) {
      setDomains([...domains, newDomain.trim()]);
      setNewIssue({ ...newIssue, domain: newDomain.trim() });
      setNewDomain("");
      setShowAddDomainDialog(false);
    }
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewIssue({ ...newIssue, category: newCategory.trim() });
      setNewCategory("");
      setShowAddCategoryDialog(false);
    }
  };

  const handleAddType = () => {
    if (newType.trim() && !issueTypes.includes(newType.trim())) {
      setIssueTypes([...issueTypes, newType.trim()]);
      setNewIssue({ ...newIssue, issueType: newType.trim() });
      setNewType("");
      setShowAddTypeDialog(false);
    }
  };

  // Process dialog handlers
  const handleOpenProcessDialog = () => {
    setTempSelectedProcesses([...newIssue.selectedProcesses]);
    setProcessSearchQuery("");
    setShowProcessDialog(true);
  };

  const handleLinkProcesses = () => {
    setNewIssue({ ...newIssue, selectedProcesses: tempSelectedProcesses });
    setShowProcessDialog(false);
  };

  const filteredProcesses = processes.filter((p) =>
    p.processCode.toLowerCase().includes(processSearchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(processSearchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(processSearchQuery.toLowerCase()))
  );

  // Stakeholder step 4 handlers
  const handleAddStakeholderNeed = () => {
    if (selectedStakeholderId && selectedNeedExpectation) {
      const newNeed = { stakeholderId: selectedStakeholderId, needExpectation: selectedNeedExpectation };
      setStakeholderNeeds([...stakeholderNeeds, newNeed]);
      setSelectedStakeholderId("");
      setSelectedNeedExpectation("");
    }
  };

  const handleAddCustomNeedExpectation = () => {
    if (newNeedExpectation.trim() && !needExpectationOptions.includes(newNeedExpectation.trim()) && !customNeedExpectations.includes(newNeedExpectation.trim())) {
      setCustomNeedExpectations([...customNeedExpectations, newNeedExpectation.trim()]);
      setSelectedNeedExpectation(newNeedExpectation.trim());
      setNewNeedExpectation("");
      setShowAddNeedDialog(false);
    }
  };

  const filteredStakeholdersByType = stakeholders.filter((s) => s.type === stakeholderType);
  const allNeedExpectations = [...needExpectationOptions, ...customNeedExpectations];

  // Edit Process dialog handlers
  const handleOpenEditProcessDialog = () => {
    setEditTempSelectedProcesses([...editIssueForm.selectedProcesses]);
    setEditProcessSearchQuery("");
    setShowEditProcessDialog(true);
  };

  const handleLinkEditProcesses = () => {
    setEditIssueForm({ ...editIssueForm, selectedProcesses: editTempSelectedProcesses });
    setShowEditProcessDialog(false);
  };

  const filteredEditProcesses = processes.filter((p) =>
    p.processCode.toLowerCase().includes(editProcessSearchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(editProcessSearchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(editProcessSearchQuery.toLowerCase()))
  );

  // Edit Stakeholder step 4 handlers
  const filteredEditStakeholdersByType = stakeholders.filter((s) => s.type === editStakeholderType);

  const handleAddEditStakeholderNeed = () => {
    if (editSelectedStakeholderId && editSelectedNeedExpectation) {
      const newNeed = { stakeholderId: editSelectedStakeholderId, needExpectation: editSelectedNeedExpectation };
      setEditStakeholderNeeds([...editStakeholderNeeds, newNeed]);
      setEditSelectedStakeholderId("");
      setEditSelectedNeedExpectation("");
    }
  };

  // Import functionality
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "title,description,domain,category,type\nSample Issue 1,Description for issue 1,Internal,Finance,Financial\nSample Issue 2,Description for issue 2,External,Security,Compliance";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "issues_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        alert('CSV file must have a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const titleIndex = headers.findIndex(h => h === 'title');
      const descriptionIndex = headers.findIndex(h => h === 'description');
      const domainIndex = headers.findIndex(h => h === 'domain');
      const categoryIndex = headers.findIndex(h => h === 'category');
      const issueTypeIndex = headers.findIndex(h => h === 'issuetype' || h === 'issue type' || h === 'type');

      if (titleIndex === -1) {
        alert('CSV must have a "title" column');
        return;
      }

      const newIssues: Issue[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const title = values[titleIndex];

        if (!title) continue;

        const issueData = {
          title,
          description: descriptionIndex !== -1 ? values[descriptionIndex] || null : null,
          domain: domainIndex !== -1 ? values[domainIndex] || 'Internal' : 'Internal',
          category: categoryIndex !== -1 ? values[categoryIndex] || 'Finance' : 'Finance',
          issueType: issueTypeIndex !== -1 ? values[issueTypeIndex] || '' : '',
          status: 'Open',
          dueDate: null,
          departmentId: null,
        };

        const res = await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(issueData),
        });

        if (res.ok) {
          const issue = await res.json();
          newIssues.push(issue);
        }
      }

      setIssues([...issues, ...newIssues]);
      setShowImportDialog(false);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert(`Successfully imported ${newIssues.length} issues`);
    } catch (error) {
      console.error('Error importing issues:', error);
      alert('Error importing issues. Please check the file format.');
    }
    setImporting(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stakeholderRes, issueRes, deptRes, usersRes, regulationsRes, processesRes] = await Promise.all([
        fetch("/api/stakeholders"),
        fetch("/api/issues"),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/regulations"),
        fetch("/api/processes"),
      ]);

      if (stakeholderRes.ok) setStakeholders(await stakeholderRes.json());
      if (issueRes.ok) setIssues(await issueRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (regulationsRes.ok) setRegulations(await regulationsRes.json());
      if (processesRes.ok) setProcesses(await processesRes.json());
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
          issueType: newIssue.issueType || null,
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

  // Edit Issue handlers
  const handleEditIssue = (issue: Issue) => {
    setEditingIssue(issue);
    setEditIssueForm({
      title: issue.title,
      description: issue.description || "",
      domain: issue.domain,
      category: issue.category,
      issueType: issue.issueType,
      departmentId: issue.departmentId || "",
      ownerId: issue.ownerId || "",
      selectedRegulations: [],
      selectedProcesses: [],
    });
    setEditCurrentStep(1);
    setEditStakeholderType("Internal");
    setEditSelectedStakeholderId("");
    setEditSelectedNeedExpectation("");
    setEditStakeholderNeeds([]);
    setShowEditIssue(true);
  };

  const handleUpdateIssue = async () => {
    if (!editingIssue || !editIssueForm.title.trim()) return;
    try {
      const res = await fetch(`/api/issues/${editingIssue.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editIssueForm.title,
          description: editIssueForm.description || null,
          domain: editIssueForm.domain,
          category: editIssueForm.category,
          issueType: editIssueForm.issueType,
          departmentId: editIssueForm.departmentId || null,
        }),
      });
      if (res.ok) {
        const updatedIssue = await res.json();
        setIssues(issues.map((i) => (i.id === editingIssue.id ? updatedIssue : i)));
        setShowEditIssue(false);
        setEditingIssue(null);
        setEditCurrentStep(1);
        setEditStakeholderNeeds([]);
      }
    } catch (error) {
      console.error("Error updating issue:", error);
    }
  };

  // Export Issues handler
  const handleExport = () => {
    const headers = ["Title", "Description", "Domain", "Category", "Issue Type", "Status", "Department"];
    const csvRows = [headers.join(",")];

    filteredIssues.forEach((issue) => {
      const row = [
        `"${issue.title.replace(/"/g, '""')}"`,
        `"${(issue.description || "").replace(/"/g, '""')}"`,
        `"${issue.domain}"`,
        `"${issue.category}"`,
        `"${issue.issueType}"`,
        `"${issue.status}"`,
        `"${issue.department?.name || ""}"`,
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `issues_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Stakeholder columns
  const stakeholderColumns: ColumnDef<Stakeholder>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
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

            <div className="space-y-2">
              <Label htmlFor="stakeholderName">Stakeholder Name *</Label>
              <Input
                id="stakeholderName"
                value={newStakeholder.name}
                onChange={(e) => setNewStakeholder({ ...newStakeholder, name: e.target.value })}
                placeholder="Enter stakeholder name"
              />
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
                    <div className="flex gap-2">
                      <Select
                        value={newIssue.domain}
                        onValueChange={(value) => setNewIssue({ ...newIssue, domain: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {domains.map((domain) => (
                            <SelectItem key={domain} value={domain}>
                              {domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setShowAddDomainDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={newIssue.category}
                        onValueChange={(value) => setNewIssue({ ...newIssue, category: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setShowAddCategoryDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
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
                    <div className="flex gap-2">
                      <Select
                        value={newIssue.issueType}
                        onValueChange={(value) => setNewIssue({ ...newIssue, issueType: value })}
                      >
                        <SelectTrigger className="flex-1">
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
                      <Button type="button" variant="outline" size="icon" onClick={() => setShowAddTypeDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
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
              </div>
            )}

            {/* Step 2: Regulations */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Related Regulations</h3>
                <p className="text-muted-foreground text-sm">Select regulations related to this issue (optional)</p>
                <div className="border rounded-lg p-4 min-h-[200px]">
                  {regulations.length > 0 ? (
                    <div className="space-y-2">
                      {regulations.map((reg) => (
                        <label key={reg.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newIssue.selectedRegulations.includes(reg.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewIssue({
                                  ...newIssue,
                                  selectedRegulations: [...newIssue.selectedRegulations, reg.id],
                                });
                              } else {
                                setNewIssue({
                                  ...newIssue,
                                  selectedRegulations: newIssue.selectedRegulations.filter((id) => id !== reg.id),
                                });
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{reg.name}</span>
                            {reg.version && <span className="text-muted-foreground ml-2 text-sm">v{reg.version}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-muted-foreground h-full">
                      No regulations available
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Process */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Select Process related with the issue</h3>
                  <Button variant="outline" onClick={handleOpenProcessDialog}>
                    Choose Processes
                  </Button>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {newIssue.selectedProcesses.length > 0 ? (
                    <>
                      {newIssue.selectedProcesses.map((processId) => {
                        const process = processes.find((p) => p.id === processId);
                        return process ? (
                          <div key={process.id} className="p-4 border rounded-lg flex items-start justify-between">
                            <div>
                              <div className="text-blue-600 font-medium">
                                {process.processCode} : {process.name}
                              </div>
                              {process.description && (
                                <p className="text-sm text-muted-foreground mt-1">{process.description}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                setNewIssue({
                                  ...newIssue,
                                  selectedProcesses: newIssue.selectedProcesses.filter((id) => id !== processId),
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null;
                      })}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground border rounded-lg">
                      No items found
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Stakeholder */}
            {currentStep === 4 && (
              <div className="space-y-6">
                {/* Stakeholder Type */}
                <div className="space-y-2">
                  <h5 className="font-medium">Stakeholder Type</h5>
                  <RadioGroup
                    value={stakeholderType}
                    onValueChange={setStakeholderType}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Internal" id="st-internal" />
                      <Label htmlFor="st-internal" className="font-normal">Internal</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="External" id="st-external" />
                      <Label htmlFor="st-external" className="font-normal">External</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Third Party" id="st-thirdparty" />
                      <Label htmlFor="st-thirdparty" className="font-normal">Third Party</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Stakeholder Selection */}
                <div className="space-y-2">
                  <h5 className="font-medium">Stakeholder</h5>
                  <Select
                    value={selectedStakeholderId}
                    onValueChange={setSelectedStakeholderId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stakeholder" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStakeholdersByType.length > 0 ? (
                        filteredStakeholdersByType.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">No {stakeholderType} stakeholders found</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Need and Expectation */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <h5 className="font-medium">Need and Expectation</h5>
                    <div className="flex gap-2">
                      <Select
                        value={selectedNeedExpectation}
                        onValueChange={setSelectedNeedExpectation}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select need/expectation" />
                        </SelectTrigger>
                        <SelectContent>
                          {allNeedExpectations.map((need) => (
                            <SelectItem key={need} value={need}>
                              {need}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={() => setShowAddNeedDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddStakeholderNeed}
                    disabled={!selectedStakeholderId || !selectedNeedExpectation}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Stakeholder Needs and Exceptions Table */}
                <div className="space-y-2">
                  <h4 className="font-medium">Stakeholder Needs and Expectations</h4>
                  <div className="border rounded-lg min-h-[150px]">
                    {stakeholderNeeds.length > 0 ? (
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left p-3 text-sm font-medium">Stakeholder</th>
                            <th className="text-left p-3 text-sm font-medium">Need/Expectation</th>
                            <th className="w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {stakeholderNeeds.map((item, index) => {
                            const stakeholder = stakeholders.find((s) => s.id === item.stakeholderId);
                            return (
                              <tr key={index} className="border-b last:border-b-0">
                                <td className="p-3">{stakeholder?.name || "-"}</td>
                                <td className="p-3">{item.needExpectation}</td>
                                <td className="p-3">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => {
                                      setStakeholderNeeds(stakeholderNeeds.filter((_, i) => i !== index));
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                        No stakeholder needs added
                      </div>
                    )}
                  </div>
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
                  {newIssue.selectedRegulations.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Related Regulations</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {newIssue.selectedRegulations.map((id) => {
                          const regulation = regulations.find((r) => r.id === id);
                          return regulation ? (
                            <Badge key={id} variant="secondary">{regulation.name}</Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  {newIssue.selectedProcesses.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Related Processes</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {newIssue.selectedProcesses.map((id) => {
                          const process = processes.find((p) => p.id === id);
                          return process ? (
                            <Badge key={id} variant="secondary">{process.processCode} - {process.name}</Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  {stakeholderNeeds.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Stakeholder Needs and Expectations</Label>
                      <div className="mt-1 space-y-1">
                        {stakeholderNeeds.map((item, index) => {
                          const stakeholder = stakeholders.find((s) => s.id === item.stakeholderId);
                          return (
                            <div key={index} className="text-sm">
                              <span className="font-medium">{stakeholder?.name}</span>: {item.needExpectation}
                            </div>
                          );
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

        {/* Add Domain Dialog */}
        <Dialog open={showAddDomainDialog} onOpenChange={setShowAddDomainDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Domain</DialogTitle>
              <DialogDescription>
                Enter a name for the new domain.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newDomainWizard">Domain Name *</Label>
                <Input
                  id="newDomainWizard"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="Enter domain name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddDomainDialog(false); setNewDomain(""); }}>
                Cancel
              </Button>
              <Button onClick={handleAddDomain} disabled={!newDomain.trim()}>
                Add Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Category Dialog */}
        <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
              <DialogDescription>
                Enter a name for the new category.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newCategoryWizard">Category Name *</Label>
                <Input
                  id="newCategoryWizard"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Enter category name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddCategoryDialog(false); setNewCategory(""); }}>
                Cancel
              </Button>
              <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>
                Add Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Issue Type Dialog */}
        <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Issue Type</DialogTitle>
              <DialogDescription>
                Enter a name for the new issue type.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newTypeWizard">Issue Type Name *</Label>
                <Input
                  id="newTypeWizard"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="Enter issue type name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddTypeDialog(false); setNewType(""); }}>
                Cancel
              </Button>
              <Button onClick={handleAddType} disabled={!newType.trim()}>
                Add Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Choose Processes Dialog */}
        <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Link Process</DialogTitle>
              <DialogDescription>
                Select processes to link with this issue.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search processes..."
                  value={processSearchQuery}
                  onChange={(e) => setProcessSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-3">
                {filteredProcesses.length > 0 ? (
                  <>
                    {filteredProcesses.map((process) => (
                      <label
                        key={process.id}
                        className="flex items-start gap-3 p-4 border rounded-lg hover:border-blue-300 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={tempSelectedProcesses.includes(process.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTempSelectedProcesses([...tempSelectedProcesses, process.id]);
                            } else {
                              setTempSelectedProcesses(tempSelectedProcesses.filter((id) => id !== process.id));
                            }
                          }}
                          className="h-4 w-4 mt-1"
                        />
                        <div className="flex-1">
                          <div className="text-blue-600 font-medium">
                            {process.processCode} : {process.name}
                          </div>
                          {process.description && (
                            <p className="text-sm text-muted-foreground mt-1">{process.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No processes found
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleLinkProcesses}>
                Link Process
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Need/Expectation Dialog */}
        <Dialog open={showAddNeedDialog} onOpenChange={setShowAddNeedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Need/Expectation</DialogTitle>
              <DialogDescription>
                Enter a new need or expectation type.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newNeedExpectation">Need/Expectation *</Label>
                <Input
                  id="newNeedExpectation"
                  value={newNeedExpectation}
                  onChange={(e) => setNewNeedExpectation(e.target.value)}
                  placeholder="Enter need/expectation"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddNeedDialog(false); setNewNeedExpectation(""); }}>
                Cancel
              </Button>
              <Button onClick={handleAddCustomNeedExpectation} disabled={!newNeedExpectation.trim()}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Edit Issue Form (5-Step Wizard)
  if (showEditIssue && editingIssue) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit Issue"
          actions={[
            {
              label: "Cancel",
              variant: "outline",
              onClick: () => {
                setShowEditIssue(false);
                setEditCurrentStep(1);
                setEditingIssue(null);
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
                  editCurrentStep === step.id
                    ? "bg-blue-600 text-white"
                    : editCurrentStep > step.id
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {step.id}
              </div>
              <span className={`ml-2 text-sm ${editCurrentStep === step.id ? "font-medium" : "text-muted-foreground"}`}>
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
            {editCurrentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="editIssueTitle">Issue Title *</Label>
                    <Input
                      id="editIssueTitle"
                      value={editIssueForm.title}
                      onChange={(e) => setEditIssueForm({ ...editIssueForm, title: e.target.value })}
                      placeholder="Enter issue title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Domain *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={editIssueForm.domain}
                        onValueChange={(value) => setEditIssueForm({ ...editIssueForm, domain: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {domains.map((domain) => (
                            <SelectItem key={domain} value={domain}>
                              {domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setShowAddDomainDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={editIssueForm.category}
                        onValueChange={(value) => setEditIssueForm({ ...editIssueForm, category: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setShowAddCategoryDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={editIssueForm.departmentId}
                      onValueChange={(value) => setEditIssueForm({ ...editIssueForm, departmentId: value, ownerId: "" })}
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
                      value={editIssueForm.ownerId}
                      onValueChange={(value) => setEditIssueForm({ ...editIssueForm, ownerId: value })}
                      disabled={!editIssueForm.departmentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={editIssueForm.departmentId ? "Select owner" : "Select department first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter((user) => !editIssueForm.departmentId || user.departmentId === editIssueForm.departmentId)
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
                    <div className="flex gap-2">
                      <Select
                        value={editIssueForm.issueType}
                        onValueChange={(value) => setEditIssueForm({ ...editIssueForm, issueType: value })}
                      >
                        <SelectTrigger className="flex-1">
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
                      <Button type="button" variant="outline" size="icon" onClick={() => setShowAddTypeDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editIssueDescription">Description</Label>
                  <textarea
                    id="editIssueDescription"
                    value={editIssueForm.description}
                    onChange={(e) => setEditIssueForm({ ...editIssueForm, description: e.target.value })}
                    placeholder="Enter issue description"
                    className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Regulations */}
            {editCurrentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Related Regulations</h3>
                <p className="text-muted-foreground text-sm">Select regulations related to this issue (optional)</p>
                <div className="border rounded-lg p-4 min-h-[200px]">
                  {regulations.length > 0 ? (
                    <div className="space-y-2">
                      {regulations.map((reg) => (
                        <label key={reg.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editIssueForm.selectedRegulations.includes(reg.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditIssueForm({
                                  ...editIssueForm,
                                  selectedRegulations: [...editIssueForm.selectedRegulations, reg.id],
                                });
                              } else {
                                setEditIssueForm({
                                  ...editIssueForm,
                                  selectedRegulations: editIssueForm.selectedRegulations.filter((id) => id !== reg.id),
                                });
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{reg.name}</span>
                            {reg.version && <span className="text-muted-foreground ml-2 text-sm">v{reg.version}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-muted-foreground h-full">
                      No regulations available
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Process */}
            {editCurrentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Select Process related with the issue</h3>
                  <Button variant="outline" onClick={handleOpenEditProcessDialog}>
                    Choose Processes
                  </Button>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {editIssueForm.selectedProcesses.length > 0 ? (
                    <>
                      {editIssueForm.selectedProcesses.map((processId) => {
                        const process = processes.find((p) => p.id === processId);
                        return process ? (
                          <div key={process.id} className="p-4 border rounded-lg flex items-start justify-between">
                            <div>
                              <div className="text-blue-600 font-medium">
                                {process.processCode} : {process.name}
                              </div>
                              {process.description && (
                                <p className="text-sm text-muted-foreground mt-1">{process.description}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                setEditIssueForm({
                                  ...editIssueForm,
                                  selectedProcesses: editIssueForm.selectedProcesses.filter((id) => id !== processId),
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null;
                      })}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground border rounded-lg">
                      No items found
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Stakeholder */}
            {editCurrentStep === 4 && (
              <div className="space-y-6">
                {/* Stakeholder Type */}
                <div className="space-y-2">
                  <h5 className="font-medium">Stakeholder Type</h5>
                  <RadioGroup
                    value={editStakeholderType}
                    onValueChange={setEditStakeholderType}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Internal" id="edit-st-internal" />
                      <Label htmlFor="edit-st-internal" className="font-normal">Internal</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="External" id="edit-st-external" />
                      <Label htmlFor="edit-st-external" className="font-normal">External</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Third Party" id="edit-st-thirdparty" />
                      <Label htmlFor="edit-st-thirdparty" className="font-normal">Third Party</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Stakeholder Selection */}
                <div className="space-y-2">
                  <h5 className="font-medium">Stakeholder</h5>
                  <Select
                    value={editSelectedStakeholderId}
                    onValueChange={setEditSelectedStakeholderId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stakeholder" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEditStakeholdersByType.length > 0 ? (
                        filteredEditStakeholdersByType.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">No {editStakeholderType} stakeholders found</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Need and Expectation */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <h5 className="font-medium">Need and Expectation</h5>
                    <div className="flex gap-2">
                      <Select
                        value={editSelectedNeedExpectation}
                        onValueChange={setEditSelectedNeedExpectation}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select need/expectation" />
                        </SelectTrigger>
                        <SelectContent>
                          {allNeedExpectations.map((need) => (
                            <SelectItem key={need} value={need}>
                              {need}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={() => setShowAddNeedDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddEditStakeholderNeed}
                    disabled={!editSelectedStakeholderId || !editSelectedNeedExpectation}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Stakeholder Needs and Exceptions Table */}
                <div className="space-y-2">
                  <h4 className="font-medium">Stakeholder Needs and Expectations</h4>
                  <div className="border rounded-lg min-h-[150px]">
                    {editStakeholderNeeds.length > 0 ? (
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left p-3 text-sm font-medium">Stakeholder</th>
                            <th className="text-left p-3 text-sm font-medium">Need/Expectation</th>
                            <th className="w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {editStakeholderNeeds.map((item, index) => {
                            const stakeholder = stakeholders.find((s) => s.id === item.stakeholderId);
                            return (
                              <tr key={index} className="border-b last:border-b-0">
                                <td className="p-3">{stakeholder?.name || "-"}</td>
                                <td className="p-3">{item.needExpectation}</td>
                                <td className="p-3">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => {
                                      setEditStakeholderNeeds(editStakeholderNeeds.filter((_, i) => i !== index));
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                        No stakeholder needs added
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Preview & Save */}
            {editCurrentStep === 5 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Preview & Save</h3>
                <div className="border rounded-lg p-6 space-y-4 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Title</Label>
                      <p className="font-medium">{editIssueForm.title || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Domain</Label>
                      <p className="font-medium">{editIssueForm.domain}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Category</Label>
                      <p className="font-medium">{editIssueForm.category}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Issue Type</Label>
                      <p className="font-medium">{editIssueForm.issueType || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Department</Label>
                      <p className="font-medium">
                        {departments.find((d) => d.id === editIssueForm.departmentId)?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Issue Owner</Label>
                      <p className="font-medium">
                        {users.find((u) => u.id === editIssueForm.ownerId)?.fullName || "-"}
                      </p>
                    </div>
                  </div>
                  {editIssueForm.description && (
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="font-medium">{editIssueForm.description}</p>
                    </div>
                  )}
                  {editIssueForm.selectedRegulations.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Related Regulations</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {editIssueForm.selectedRegulations.map((id) => {
                          const regulation = regulations.find((r) => r.id === id);
                          return regulation ? (
                            <Badge key={id} variant="secondary">{regulation.name}</Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  {editIssueForm.selectedProcesses.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Related Processes</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {editIssueForm.selectedProcesses.map((id) => {
                          const process = processes.find((p) => p.id === id);
                          return process ? (
                            <Badge key={id} variant="secondary">{process.processCode} - {process.name}</Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  {editStakeholderNeeds.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Stakeholder Needs and Expectations</Label>
                      <div className="mt-1 space-y-1">
                        {editStakeholderNeeds.map((item, index) => {
                          const stakeholder = stakeholders.find((s) => s.id === item.stakeholderId);
                          return (
                            <div key={index} className="text-sm">
                              <span className="font-medium">{stakeholder?.name}</span>: {item.needExpectation}
                            </div>
                          );
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
                  if (editCurrentStep === 1) {
                    setShowEditIssue(false);
                    setEditingIssue(null);
                  } else {
                    setEditCurrentStep(editCurrentStep - 1);
                  }
                }}
              >
                {editCurrentStep === 1 ? "Cancel" : "Previous"}
              </Button>
              <Button
                onClick={() => {
                  if (editCurrentStep === 5) {
                    handleUpdateIssue();
                  } else {
                    setEditCurrentStep(editCurrentStep + 1);
                  }
                }}
              >
                {editCurrentStep === 5 ? "Update Issue" : "Next"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add Domain Dialog */}
        <Dialog open={showAddDomainDialog} onOpenChange={setShowAddDomainDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Domain</DialogTitle>
              <DialogDescription>
                Enter a name for the new domain.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editNewDomain">Domain Name *</Label>
                <Input
                  id="editNewDomain"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="Enter domain name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddDomainDialog(false); setNewDomain(""); }}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (newDomain.trim() && !domains.includes(newDomain.trim())) {
                  setDomains([...domains, newDomain.trim()]);
                  setEditIssueForm({ ...editIssueForm, domain: newDomain.trim() });
                  setNewDomain("");
                  setShowAddDomainDialog(false);
                }
              }} disabled={!newDomain.trim()}>
                Add Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Category Dialog */}
        <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
              <DialogDescription>
                Enter a name for the new category.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editNewCategory">Category Name *</Label>
                <Input
                  id="editNewCategory"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Enter category name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddCategoryDialog(false); setNewCategory(""); }}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (newCategory.trim() && !categories.includes(newCategory.trim())) {
                  setCategories([...categories, newCategory.trim()]);
                  setEditIssueForm({ ...editIssueForm, category: newCategory.trim() });
                  setNewCategory("");
                  setShowAddCategoryDialog(false);
                }
              }} disabled={!newCategory.trim()}>
                Add Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Issue Type Dialog */}
        <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Issue Type</DialogTitle>
              <DialogDescription>
                Enter a name for the new issue type.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editNewType">Issue Type Name *</Label>
                <Input
                  id="editNewType"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="Enter issue type name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddTypeDialog(false); setNewType(""); }}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (newType.trim() && !issueTypes.includes(newType.trim())) {
                  setIssueTypes([...issueTypes, newType.trim()]);
                  setEditIssueForm({ ...editIssueForm, issueType: newType.trim() });
                  setNewType("");
                  setShowAddTypeDialog(false);
                }
              }} disabled={!newType.trim()}>
                Add Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Choose Processes Dialog for Edit */}
        <Dialog open={showEditProcessDialog} onOpenChange={setShowEditProcessDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Link Process</DialogTitle>
              <DialogDescription>
                Select processes to link with this issue.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search processes..."
                  value={editProcessSearchQuery}
                  onChange={(e) => setEditProcessSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-3">
                {filteredEditProcesses.length > 0 ? (
                  <>
                    {filteredEditProcesses.map((process) => (
                      <label
                        key={process.id}
                        className="flex items-start gap-3 p-4 border rounded-lg hover:border-blue-300 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={editTempSelectedProcesses.includes(process.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditTempSelectedProcesses([...editTempSelectedProcesses, process.id]);
                            } else {
                              setEditTempSelectedProcesses(editTempSelectedProcesses.filter((id) => id !== process.id));
                            }
                          }}
                          className="h-4 w-4 mt-1"
                        />
                        <div className="flex-1">
                          <div className="text-blue-600 font-medium">
                            {process.processCode} : {process.name}
                          </div>
                          {process.description && (
                            <p className="text-sm text-muted-foreground mt-1">{process.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No processes found
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditProcessDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleLinkEditProcesses}>
                Link Process
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Need/Expectation Dialog for Edit */}
        <Dialog open={showAddNeedDialog} onOpenChange={setShowAddNeedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Need/Expectation</DialogTitle>
              <DialogDescription>
                Enter a new need or expectation type.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editNewNeedExpectation">Need/Expectation *</Label>
                <Input
                  id="editNewNeedExpectation"
                  value={newNeedExpectation}
                  onChange={(e) => setNewNeedExpectation(e.target.value)}
                  placeholder="Enter need/expectation"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddNeedDialog(false); setNewNeedExpectation(""); }}>
                Cancel
              </Button>
              <Button onClick={handleAddCustomNeedExpectation} disabled={!newNeedExpectation.trim()}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
              <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditIssue(issue)}>
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

      {/* Add Domain Dialog */}
      <Dialog open={showAddDomainDialog} onOpenChange={setShowAddDomainDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Domain</DialogTitle>
            <DialogDescription>
              Enter a name for the new domain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newDomain">Domain Name *</Label>
              <Input
                id="newDomain"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Enter domain name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDomainDialog(false); setNewDomain(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddDomain} disabled={!newDomain.trim()}>
              Add Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Enter a name for the new category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newCategory">Category Name *</Label>
              <Input
                id="newCategory"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddCategoryDialog(false); setNewCategory(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Issue Type Dialog */}
      <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Issue Type</DialogTitle>
            <DialogDescription>
              Enter a name for the new issue type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newType">Issue Type Name *</Label>
              <Input
                id="newType"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="Enter issue type name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddTypeDialog(false); setNewType(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddType} disabled={!newType.trim()}>
              Add Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Issues Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        setShowImportDialog(open);
        if (!open) {
          setImportFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Issues</DialogTitle>
            <DialogDescription>
              Import issues from a CSV file. The file should have columns: title (required), description, domain, category, type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>File</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {importFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
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
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!importFile || importing}>
                  {importing ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
