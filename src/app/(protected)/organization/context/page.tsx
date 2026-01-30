"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Download, Upload, Search, ChevronRight, MessageSquare, File, FileText, FileImage, FileSpreadsheet, Eye, X, Check } from "lucide-react";
import { DataGrid } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from "@/hooks/usePermissions";
import { useSession } from "next-auth/react";

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
  userRoles: { role: { name: string } }[];
}

interface IssueActionComment {
  id: string;
  actionId: string;
  comment: string;
  createdBy: string;
  createdAt: string;
}

interface IssueAction {
  id: string;
  issueId: string;
  actionType: string; // "Preventive", "Corrective"
  description: string;
  completion: number;
  comment: string | null;
  status: string; // "Pending", "Resolved", "Sent Back"
  fileName: string | null;
  fileType: string | null;
  filePath: string | null;
  fileSize: number | null;
  createdById: string;
  createdBy: { id: string; fullName: string };
  comments: IssueActionComment[];
  createdAt: string;
  updatedAt: string;
}

interface IssueRegulation {
  id: string;
  issueId: string;
  regulationId: string;
  regulation: {
    id: string;
    name: string;
    version: string | null;
    status: string;
  };
}

interface IssueProcess {
  id: string;
  issueId: string;
  processId: string;
  process: {
    id: string;
    processCode: string;
    name: string;
  };
}

interface IssueStakeholder {
  id: string;
  issueId: string;
  stakeholderId: string;
  needExpectation: string | null;
  stakeholder: {
    id: string;
    name: string;
    type: string;
  };
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
  actions?: IssueAction[];
  regulations?: IssueRegulation[];
  processes?: IssueProcess[];
  stakeholders?: IssueStakeholder[];
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
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRoles = useUserRoles();

  // Check if user is DepartmentReviewer or DepartmentContributor (read-only for stakeholders, export-only for issues)
  const isReadOnlyRole = userRoles.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  );

  // Check if user is specifically DepartmentContributor (no Issues tab, Stakeholder as title)
  const isDepartmentContributor = userRoles.some(
    (role) => role === "DepartmentContributor"
  );

  // Get user's department ID for department-scoped filtering
  const userDepartmentId = session?.user?.departmentId;

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
  const [showEditStakeholder, setShowEditStakeholder] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ type: string; id: string } | null>(null);

  // Edit issue state
  const [isEditIssueOpen, setIsEditIssueOpen] = useState(false);
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

  // Issue Action states (for DepartmentReviewer)
  const [showCreateActionDialog, setShowCreateActionDialog] = useState(false);
  const [showViewActionsDialog, setShowViewActionsDialog] = useState(false);
  const [selectedIssueForAction, setSelectedIssueForAction] = useState<Issue | null>(null);
  const [actionForm, setActionForm] = useState({
    actionType: "",
    description: "",
    completion: 0,
    comment: "",
  });
  const [savingAction, setSavingAction] = useState(false);
  const [actionFile, setActionFile] = useState<File | null>(null);
  const [isDraggingActionFile, setIsDraggingActionFile] = useState(false);
  const actionFileInputRef = useRef<HTMLInputElement>(null);

  // View Actions file upload states (for DeptReviewer)
  const [viewActionFile, setViewActionFile] = useState<File | null>(null);
  const [uploadingActionId, setUploadingActionId] = useState<string | null>(null);
  const [isDraggingViewActionFile, setIsDraggingViewActionFile] = useState<string | null>(null);
  const viewActionFileInputRef = useRef<HTMLInputElement>(null);

  // Action Review states (for CustomerAdmin/Reviewer)
  const [showActionReviewDialog, setShowActionReviewDialog] = useState(false);
  const [selectedActionForReview, setSelectedActionForReview] = useState<IssueAction | null>(null);
  const [showResendDialog, setShowResendDialog] = useState(false);
  const [resendComment, setResendComment] = useState("");
  const [processingAction, setProcessingAction] = useState(false);

  // Action Comments dialog (for DepartmentReviewer to view sent back comments)
  const [showActionCommentsDialog, setShowActionCommentsDialog] = useState(false);
  const [selectedActionForComments, setSelectedActionForComments] = useState<IssueAction | null>(null);

  // Edit Action dialog (for DepartmentReviewer to edit sent back action)
  const [showEditActionDialog, setShowEditActionDialog] = useState(false);
  const [editingAction, setEditingAction] = useState<IssueAction | null>(null);
  const [editActionForm, setEditActionForm] = useState({
    actionType: "",
    description: "",
    completion: 0,
    comment: "",
  });

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
        toast({ title: "Error", description: "CSV file must have a header row and at least one data row", variant: "destructive" });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const titleIndex = headers.findIndex(h => h === 'title');
      const descriptionIndex = headers.findIndex(h => h === 'description');
      const domainIndex = headers.findIndex(h => h === 'domain');
      const categoryIndex = headers.findIndex(h => h === 'category');
      const issueTypeIndex = headers.findIndex(h => h === 'issuetype' || h === 'issue type' || h === 'type');

      if (titleIndex === -1) {
        toast({ title: "Error", description: "CSV must have a \"title\" column", variant: "destructive" });
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
      toast({ title: "Success", description: `Successfully imported ${newIssues.length} issues` });
    } catch (error) {
      console.error('Error importing issues:', error);
      toast({ title: "Error", description: "Error importing issues. Please check the file format.", variant: "destructive" });
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

  // Filter issues (role-based filtering is done server-side in API)
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

  const handleOpenEditStakeholder = (stakeholder: Stakeholder) => {
    setEditingStakeholder(stakeholder);
    setShowEditStakeholder(true);
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

  const handleEditStakeholder = (stakeholder: Stakeholder) => {
    setEditingStakeholder(stakeholder);
    setShowEditStakeholder(true);
  };

  const handleUpdateStakeholder = async () => {
    if (!editingStakeholder || !editingStakeholder.name.trim()) return;
    try {
      const res = await fetch(`/api/stakeholders/${editingStakeholder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingStakeholder.name,
          type: editingStakeholder.type,
          status: editingStakeholder.status,
          departmentId: editingStakeholder.departmentId || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStakeholders(stakeholders.map((s) => (s.id === updated.id ? updated : s)));
        setShowEditStakeholder(false);
        setEditingStakeholder(null);
        toast({
          title: "Success",
          description: "Stakeholder updated successfully",
        });
      }
    } catch (error) {
      console.error("Error updating stakeholder:", error);
      toast({
        title: "Error",
        description: "Failed to update stakeholder",
        variant: "destructive",
      });
    }
  };

  // Issue CRUD
  const handleAddIssue = async () => {
    if (!newIssue.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    // Debug logging
    console.log("Creating issue with data:", {
      selectedRegulations: newIssue.selectedRegulations,
      selectedProcesses: newIssue.selectedProcesses,
      stakeholderNeeds: stakeholderNeeds,
    });

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
          ownerId: newIssue.ownerId || null,
          selectedRegulations: newIssue.selectedRegulations,
          selectedProcesses: newIssue.selectedProcesses,
          stakeholderNeeds: stakeholderNeeds,
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
        setStakeholderNeeds([]);
        setShowAddIssue(false);
        setCurrentStep(1);
        toast({
          title: "Success",
          description: "Issue created successfully",
        });
      } else {
        const errorData = await res.json();
        console.error("API Error:", errorData);
        toast({
          title: "Error",
          description: errorData.error || "Failed to create issue",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding issue:", error);
      toast({
        title: "Error",
        description: "Failed to create issue",
        variant: "destructive",
      });
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
    // Extract existing associations from the issue
    const existingRegulations = issue.regulations?.map((r) => r.regulationId) || [];
    const existingProcesses = issue.processes?.map((p) => p.processId) || [];
    const existingStakeholderNeeds = issue.stakeholders?.map((s) => ({
      stakeholderId: s.stakeholderId,
      needExpectation: s.needExpectation || "",
    })) || [];

    // Debug logging
    console.log("Loading issue for edit:", {
      issueId: issue.id,
      regulations: issue.regulations,
      processes: issue.processes,
      stakeholders: issue.stakeholders,
      extractedStakeholderNeeds: existingStakeholderNeeds,
    });

    setEditIssueForm({
      title: issue.title,
      description: issue.description || "",
      domain: issue.domain,
      category: issue.category,
      issueType: issue.issueType,
      departmentId: issue.departmentId || "",
      ownerId: issue.ownerId || "",
      selectedRegulations: existingRegulations,
      selectedProcesses: existingProcesses,
    });
    setEditCurrentStep(1);
    setEditStakeholderType("Internal");
    setEditSelectedStakeholderId("");
    setEditSelectedNeedExpectation("");
    setEditStakeholderNeeds(existingStakeholderNeeds);
    setIsEditIssueOpen(true);
  };

  const handleUpdateIssue = async () => {
    if (!editingIssue || !editIssueForm.title.trim()) return;

    // Debug logging
    console.log("Updating issue with data:", {
      selectedRegulations: editIssueForm.selectedRegulations,
      selectedProcesses: editIssueForm.selectedProcesses,
      stakeholderNeeds: editStakeholderNeeds,
    });

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
          ownerId: editIssueForm.ownerId || null,
          selectedRegulations: editIssueForm.selectedRegulations,
          selectedProcesses: editIssueForm.selectedProcesses,
          stakeholderNeeds: editStakeholderNeeds,
        }),
      });
      if (res.ok) {
        const updatedIssue = await res.json();
        setIssues(issues.map((i) => (i.id === editingIssue.id ? updatedIssue : i)));
        setIsEditIssueOpen(false);
        setEditingIssue(null);
        setEditCurrentStep(1);
        setEditStakeholderNeeds([]);
        toast({
          title: "Success",
          description: "Issue updated successfully",
        });
      }
    } catch (error) {
      console.error("Error updating issue:", error);
      toast({
        title: "Error",
        description: "Failed to update issue",
        variant: "destructive",
      });
    }
  };

  // ============ Issue Action Handlers ============

  // File handlers for action file upload
  const handleActionFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingActionFile(true);
  };

  const handleActionFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingActionFile(false);
  };

  const handleActionFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingActionFile(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setActionFile(files[0]);
    }
  };

  const handleActionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setActionFile(file);
    }
  };

  // View Actions file handlers (for DeptReviewer)
  const handleViewActionFileDragOver = (e: React.DragEvent, actionId: string) => {
    e.preventDefault();
    setIsDraggingViewActionFile(actionId);
  };

  const handleViewActionFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingViewActionFile(null);
  };

  const handleViewActionFileDrop = async (e: React.DragEvent, action: IssueAction) => {
    e.preventDefault();
    setIsDraggingViewActionFile(null);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFileToAction(action, files[0]);
    }
  };

  const handleViewActionFileChange = async (e: React.ChangeEvent<HTMLInputElement>, action: IssueAction) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFileToAction(action, file);
    }
    // Reset input
    if (viewActionFileInputRef.current) {
      viewActionFileInputRef.current.value = "";
    }
  };

  const uploadFileToAction = async (action: IssueAction, file: File) => {
    setUploadingActionId(action.id);
    try {
      // Upload file first
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        toast({
          title: "Error",
          description: "Failed to upload file",
          variant: "destructive",
        });
        return;
      }

      const uploadResult = await uploadRes.json();

      // Update action with file info
      const res = await fetch(`/api/issues/${action.issueId}/actions/${action.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: uploadResult.file.originalName,
          fileType: uploadResult.file.fileType,
          filePath: uploadResult.file.filePath,
          fileSize: uploadResult.file.fileSize,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "File uploaded successfully",
        });
        // Refresh issues
        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) setIssues(await issuesRes.json());
      } else {
        toast({
          title: "Error",
          description: "Failed to attach file to action",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploadingActionId(null);
    }
  };

  const handleDeleteActionFile = async (action: IssueAction) => {
    setUploadingActionId(action.id);
    try {
      const res = await fetch(`/api/issues/${action.issueId}/actions/${action.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteFile: true }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "File deleted successfully",
        });
        // Refresh issues
        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) setIssues(await issuesRes.json());
      } else {
        toast({
          title: "Error",
          description: "Failed to delete file",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    } finally {
      setUploadingActionId(null);
    }
  };

  // Create Action (DepartmentReviewer)
  const handleCreateAction = async () => {
    if (!selectedIssueForAction || !actionForm.actionType || !actionForm.description) {
      toast({
        title: "Error",
        description: "Action type and description are required",
        variant: "destructive",
      });
      return;
    }

    setSavingAction(true);
    try {
      let fileData = {};

      // Upload file first if present
      if (actionFile) {
        const formData = new FormData();
        formData.append("file", actionFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadResult = await uploadRes.json();
          fileData = {
            fileName: uploadResult.file.originalName,
            fileType: uploadResult.file.fileType,
            filePath: uploadResult.file.filePath,
            fileSize: uploadResult.file.fileSize,
          };
        } else {
          toast({
            title: "Error",
            description: "Failed to upload file",
            variant: "destructive",
          });
          setSavingAction(false);
          return;
        }
      }

      const res = await fetch(`/api/issues/${selectedIssueForAction.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...actionForm,
          ...fileData,
          createdById: session?.user?.id,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Action created successfully",
        });
        // Refresh issues to get updated actions
        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) setIssues(await issuesRes.json());
        setShowCreateActionDialog(false);
        setActionForm({ actionType: "", description: "", completion: 0, comment: "" });
        setActionFile(null);
        setSelectedIssueForAction(null);
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create action",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating action:", error);
      toast({
        title: "Error",
        description: "Failed to create action",
        variant: "destructive",
      });
    } finally {
      setSavingAction(false);
    }
  };

  // Resolve Action (CustomerAdmin/Reviewer)
  const handleResolveAction = async (action: IssueAction) => {
    setProcessingAction(true);
    try {
      const res = await fetch(`/api/issues/${action.issueId}/actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Action is resolved",
        });
        // Refresh issues
        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) setIssues(await issuesRes.json());
        setShowActionReviewDialog(false);
        setSelectedActionForReview(null);
      }
    } catch (error) {
      console.error("Error resolving action:", error);
      toast({
        title: "Error",
        description: "Failed to resolve action",
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // Resend Action (CustomerAdmin/Reviewer)
  const handleResendAction = async () => {
    if (!selectedActionForReview || !resendComment) {
      toast({
        title: "Error",
        description: "Comment is required",
        variant: "destructive",
      });
      return;
    }

    setProcessingAction(true);
    try {
      const res = await fetch(`/api/issues/${selectedActionForReview.issueId}/actions/${selectedActionForReview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resend",
          comment: resendComment,
          createdBy: session?.user?.name || "Admin",
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Action is sent back",
        });
        // Refresh issues
        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) setIssues(await issuesRes.json());
        setShowResendDialog(false);
        setShowActionReviewDialog(false);
        setResendComment("");
        setSelectedActionForReview(null);
      }
    } catch (error) {
      console.error("Error resending action:", error);
      toast({
        title: "Error",
        description: "Failed to send back action",
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // Update Action (DepartmentReviewer - after sent back)
  const handleUpdateAction = async () => {
    if (!editingAction || !editActionForm.actionType || !editActionForm.description) {
      toast({
        title: "Error",
        description: "Action type and description are required",
        variant: "destructive",
      });
      return;
    }

    setSavingAction(true);
    try {
      const res = await fetch(`/api/issues/${editingAction.issueId}/actions/${editingAction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editActionForm,
          status: "Pending", // Reset to pending when resubmitting
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Action updated and resubmitted",
        });
        // Refresh issues
        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) setIssues(await issuesRes.json());
        setShowEditActionDialog(false);
        setEditingAction(null);
        setEditActionForm({ actionType: "", description: "", completion: 0, comment: "" });
      }
    } catch (error) {
      console.error("Error updating action:", error);
      toast({
        title: "Error",
        description: "Failed to update action",
        variant: "destructive",
      });
    } finally {
      setSavingAction(false);
    }
  };

  // Check if user is CustomerAdmin or Reviewer (can review actions)
  const isReviewerRole = userRoles.some(
    (role) => role === "CustomerAdministrator" || role === "Reviewer"
  );

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
          <Badge
            variant="outline"
            className={status === "Active"
              ? "border-transparent bg-success-light text-success-dark"
              : "border-transparent bg-slate-100 text-slate-600"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    // Only show actions column for non-readonly roles
    ...(!isReadOnlyRole ? [{
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: { original: Stakeholder } }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleEditStakeholder(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
            onClick={() => {
              setDeletingItem({ type: "stakeholder", id: row.original.id });
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }] : []),
  ];

  // Get unique categories and domains from issues
  const uniqueCategories = [...new Set(issues.map((i) => i.category))];
  const uniqueDomains = [...new Set(issues.map((i) => i.domain))];

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-error-light text-error-dark";
      case "In Progress":
        return "bg-warning-light text-warning-dark";
      case "Pending":
        return "bg-info-light text-info-dark";
      case "Resolved":
        return "bg-success-light text-success-dark";
      case "Closed":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  // Add Issue Form (5-Step Wizard) - Rendered as Modal
  const renderAddIssueModal = () => (
    <Dialog open={showAddIssue} onOpenChange={(open) => { if (!open) { setShowAddIssue(false); setCurrentStep(1); } }}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-800">Add Issue</DialogTitle>
          </DialogHeader>
        </div>

        {/* Step Progress */}
        <div className="flex-shrink-0 flex items-start justify-center py-5 px-6 border-b border-slate-100">
          {ISSUE_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-start">
              <div className="flex flex-col items-center w-24">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    currentStep > step.id
                      ? "bg-success text-white"
                      : currentStep === step.id
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span
                  className={`mt-2 text-xs font-medium text-center ${
                    currentStep >= step.id ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {step.name}
                </span>
              </div>
              {index < ISSUE_STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mt-[18px] -mx-3 transition-colors ${
                    currentStep > step.id ? "bg-success" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Step 1: Info */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Basic Information</h3>
                {/* Issue Title - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Issue Title <span className="text-error">*</span></Label>
                  <Input
                    value={newIssue.title}
                    onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                    placeholder="Enter issue title"
                    className="mt-1.5"
                  />
                </div>
                {/* Domain & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Domain <span className="text-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={newIssue.domain}
                        onValueChange={(value) => setNewIssue({ ...newIssue, domain: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select domain" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
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
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Category <span className="text-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={newIssue.category}
                        onValueChange={(value) => setNewIssue({ ...newIssue, category: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
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
                </div>
                {/* Department & Issue Owner */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Department</Label>
                    <Select
                      value={newIssue.departmentId}
                      onValueChange={(value) => setNewIssue({ ...newIssue, departmentId: value, ownerId: "" })}
                    >
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue placeholder="Select department" />
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
                    <Label className="text-sm font-medium text-slate-700">Issue Owner</Label>
                    <Select
                      value={newIssue.ownerId}
                      onValueChange={(value) => setNewIssue({ ...newIssue, ownerId: value })}
                      disabled={!newIssue.departmentId}
                    >
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue placeholder={newIssue.departmentId ? "Select owner" : "Select department first"} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users
                          .filter((user) =>
                            (!newIssue.departmentId || user.departmentId === newIssue.departmentId) &&
                            user.userRoles?.some((ur) => ["DepartmentReviewer", "Reviewer"].includes(ur.role.name))
                          )
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Issue Type - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Issue Type</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={newIssue.issueType}
                      onValueChange={(value) => setNewIssue({ ...newIssue, issueType: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
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
                {/* Description */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Description</Label>
                  <textarea
                    id="issueDescription"
                    value={newIssue.description}
                    onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                    placeholder="Enter issue description"
                    className="w-full min-h-[100px] px-3 py-2 text-sm border border-slate-200 rounded-md mt-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Regulations */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Related Regulations</h3>
                <p className="text-slate-500 text-sm">Select regulations related to this issue (optional)</p>
                <div className="border rounded-lg p-4 min-h-[200px]">
                  {regulations.length > 0 ? (
                    <div className="space-y-2">
                      {regulations.map((reg) => (
                        <label key={reg.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer">
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
                            {reg.version && <span className="text-slate-500 ml-2 text-sm">v{reg.version}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-slate-500 h-full">
                      No regulations available
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Process */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Related Processes</h3>
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
                              <div className="text-primary-600 font-medium">
                                {process.processCode} : {process.name}
                              </div>
                              {process.description && (
                                <p className="text-sm text-slate-500 mt-1">{process.description}</p>
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
                    <div className="flex items-center justify-center h-[200px] text-slate-500 border rounded-lg">
                      No items found
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Stakeholder */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Stakeholder Information</h3>
                {/* Stakeholder Type */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Stakeholder Type</Label>
                  <RadioGroup
                    value={stakeholderType}
                    onValueChange={setStakeholderType}
                    className="flex gap-6 mt-1.5"
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
                <div>
                  <Label className="text-sm font-medium text-slate-700">Stakeholder</Label>
                  <Select
                    value={selectedStakeholderId}
                    onValueChange={setSelectedStakeholderId}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select stakeholder" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {filteredStakeholdersByType.length > 0 ? (
                        filteredStakeholdersByType.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-slate-500">No {stakeholderType} stakeholders found</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Need and Expectation */}
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-slate-700">Need and Expectation</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={selectedNeedExpectation}
                        onValueChange={setSelectedNeedExpectation}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select need/expectation" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
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
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stakeholder
                  </Button>
                </div>

                {/* Stakeholder Needs and Exceptions Table */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Stakeholder Needs and Expectations</Label>
                  <div className="border rounded-lg min-h-[150px] mt-1.5">
                    {stakeholderNeeds.length > 0 ? (
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b">
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
                      <div className="flex items-center justify-center h-[150px] text-slate-500">
                        No stakeholder needs added
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Preview & Save */}
            {currentStep === 5 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Preview & Save</h3>
                <div className="border border-slate-200 rounded-lg p-6 space-y-4 bg-slate-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Title</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.title || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Domain</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.domain}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Category</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Issue Type</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.issueType || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Department</p>
                      <p className="text-sm font-medium text-slate-800">
                        {departments.find((d) => d.id === newIssue.departmentId)?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Issue Owner</p>
                      <p className="text-sm font-medium text-slate-800">
                        {users.find((u) => u.id === newIssue.ownerId)?.fullName || "-"}
                      </p>
                    </div>
                  </div>
                  {newIssue.description && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Description</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.description}</p>
                    </div>
                  )}
                  {newIssue.selectedRegulations.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Related Regulations</p>
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
                      <p className="text-xs text-slate-500 mb-1">Related Processes</p>
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
                      <p className="text-xs text-slate-500 mb-1">Stakeholder Needs and Expectations</p>
                      <div className="mt-1 space-y-1">
                        {stakeholderNeeds.map((item, index) => {
                          const stakeholder = stakeholders.find((s) => s.id === item.stakeholderId);
                          return (
                            <div key={index} className="text-sm text-slate-700">
                              <span className="font-medium text-slate-800">{stakeholder?.name}</span>: {item.needExpectation}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Fixed Footer with Navigation */}
        <div className="flex-shrink-0 flex justify-between px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep === 1) {
                setShowAddIssue(false);
                setCurrentStep(1);
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
      </DialogContent>

      {/* Add Domain Dialog */}
        <Dialog open={showAddDomainDialog} onOpenChange={setShowAddDomainDialog}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">Add New Domain</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  Enter a name for the new domain.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">Domain Name <span className="text-error">*</span></Label>
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Enter domain name"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddDomainDialog(false); setNewDomain(""); }}>
                Cancel
              </Button>
              <Button onClick={handleAddDomain} disabled={!newDomain.trim()}>
                Add Domain
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Category Dialog */}
        <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">Add New Category</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  Enter a name for the new category.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">Category Name <span className="text-error">*</span></Label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddCategoryDialog(false); setNewCategory(""); }}>
                Cancel
              </Button>
              <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>
                Add Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Issue Type Dialog */}
        <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">Add New Issue Type</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  Enter a name for the new issue type.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">Issue Type Name <span className="text-error">*</span></Label>
              <Input
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="Enter issue type name"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddTypeDialog(false); setNewType(""); }}>
                Cancel
              </Button>
              <Button onClick={handleAddType} disabled={!newType.trim()}>
                Add Type
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Choose Processes Dialog */}
        <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
          <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
            {/* Fixed Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">Link Process</DialogTitle>
                <DialogDescription>
                  Select processes to link with this issue.
                </DialogDescription>
              </DialogHeader>
            </div>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
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
                        className="flex items-start gap-3 p-4 border rounded-lg border-slate-200 cursor-pointer transition-colors"
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
                          <div className="text-primary-600 font-medium">
                            {process.processCode} : {process.name}
                          </div>
                          {process.description && (
                            <p className="text-sm text-slate-500 mt-1">{process.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-slate-500">
                    No processes found
                  </div>
                )}
              </div>
            </div>
            {/* Fixed Footer */}
            <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleLinkProcesses}>
                Link Process
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Need/Expectation Dialog */}
        <Dialog open={showAddNeedDialog} onOpenChange={setShowAddNeedDialog}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0">
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">Add New Need/Expectation</DialogTitle>
                <DialogDescription>
                  Enter a new need or expectation type.
                </DialogDescription>
              </DialogHeader>
            </div>
            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label htmlFor="newNeedExpectation" className="text-sm font-medium text-slate-700">Need/Expectation *</Label>
                <Input
                  id="newNeedExpectation"
                  value={newNeedExpectation}
                  onChange={(e) => setNewNeedExpectation(e.target.value)}
                  placeholder="Enter need/expectation"
                  className="mt-1.5"
                />
              </div>
            </div>
            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddNeedDialog(false); setNewNeedExpectation(""); }}>
                Cancel
              </Button>
              <Button onClick={handleAddCustomNeedExpectation} disabled={!newNeedExpectation.trim()}>
                Add
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </Dialog>
  );

  // Edit Issue Form (5-Step Wizard) - Rendered as Modal
  const renderEditIssueModal = () => (
    <Dialog open={isEditIssueOpen && !!editingIssue} onOpenChange={(open) => { if (!open) { setIsEditIssueOpen(false); setEditCurrentStep(1); setEditingIssue(null); } }}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-800">Edit Issue</DialogTitle>
          </DialogHeader>
        </div>

        {/* Step Progress */}
        <div className="flex-shrink-0 flex items-start justify-center py-5 px-6 border-b border-slate-100">
          {ISSUE_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-start">
              <div className="flex flex-col items-center w-24">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    editCurrentStep > step.id
                      ? "bg-success text-white"
                      : editCurrentStep === step.id
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}
                >
                  {editCurrentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span
                  className={`mt-2 text-xs font-medium text-center ${
                    editCurrentStep >= step.id ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {step.name}
                </span>
              </div>
              {index < ISSUE_STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mt-[18px] -mx-3 transition-colors ${
                    editCurrentStep > step.id ? "bg-success" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* Step 1: Info */}
            {editCurrentStep === 1 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Basic Information</h3>
                {/* Issue Title - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Issue Title <span className="text-error">*</span></Label>
                  <Input
                    id="editIssueTitle"
                    value={editIssueForm.title}
                    onChange={(e) => setEditIssueForm({ ...editIssueForm, title: e.target.value })}
                    placeholder="Enter issue title"
                    className="mt-1.5"
                  />
                </div>
                {/* Domain & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Domain <span className="text-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editIssueForm.domain}
                        onValueChange={(value) => setEditIssueForm({ ...editIssueForm, domain: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select domain" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
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
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Category <span className="text-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editIssueForm.category}
                        onValueChange={(value) => setEditIssueForm({ ...editIssueForm, category: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
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
                </div>
                {/* Department & Issue Owner */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Department</Label>
                    <Select
                      value={editIssueForm.departmentId}
                      onValueChange={(value) => setEditIssueForm({ ...editIssueForm, departmentId: value, ownerId: "" })}
                    >
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue placeholder="Select department" />
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
                    <Label className="text-sm font-medium text-slate-700">Issue Owner</Label>
                    <Select
                      value={editIssueForm.ownerId}
                      onValueChange={(value) => setEditIssueForm({ ...editIssueForm, ownerId: value })}
                      disabled={!editIssueForm.departmentId}
                    >
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue placeholder={editIssueForm.departmentId ? "Select owner" : "Select department first"} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users
                          .filter((user) =>
                            (!editIssueForm.departmentId || user.departmentId === editIssueForm.departmentId) &&
                            user.userRoles?.some((ur) => ["DepartmentReviewer", "Reviewer"].includes(ur.role.name))
                          )
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Issue Type - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Issue Type</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={editIssueForm.issueType}
                      onValueChange={(value) => setEditIssueForm({ ...editIssueForm, issueType: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
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
                {/* Description */}
                <div>
                  <Label htmlFor="editIssueDescription" className="text-sm font-medium text-slate-700">Description</Label>
                  <textarea
                    id="editIssueDescription"
                    value={editIssueForm.description}
                    onChange={(e) => setEditIssueForm({ ...editIssueForm, description: e.target.value })}
                    placeholder="Enter issue description"
                    className="w-full min-h-[100px] px-3 py-2 text-sm border border-slate-200 rounded-md mt-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Regulations */}
            {editCurrentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Related Regulations</h3>
                  <p className="text-slate-500 text-sm mt-1">Select regulations related to this issue (optional)</p>
                </div>
                <div className="border rounded-lg p-4 min-h-[200px]">
                  {regulations.length > 0 ? (
                    <div className="space-y-2">
                      {regulations.map((reg) => (
                        <label key={reg.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer">
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
                            {reg.version && <span className="text-slate-500 ml-2 text-sm">v{reg.version}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-slate-500 h-full">
                      No regulations available
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Process */}
            {editCurrentStep === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Related Processes</h3>
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
                              <div className="text-primary-600 font-medium">
                                {process.processCode} : {process.name}
                              </div>
                              {process.description && (
                                <p className="text-sm text-slate-500 mt-1">{process.description}</p>
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
                    <div className="flex items-center justify-center h-[200px] text-slate-500 border rounded-lg">
                      No items found
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Stakeholder */}
            {editCurrentStep === 4 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Stakeholder Information</h3>
                {/* Stakeholder Type */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Stakeholder Type</Label>
                  <RadioGroup
                    value={editStakeholderType}
                    onValueChange={setEditStakeholderType}
                    className="flex gap-6 mt-1.5"
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
                <div>
                  <Label className="text-sm font-medium text-slate-700">Stakeholder</Label>
                  <Select
                    value={editSelectedStakeholderId}
                    onValueChange={setEditSelectedStakeholderId}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select stakeholder" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {filteredEditStakeholdersByType.length > 0 ? (
                        filteredEditStakeholdersByType.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-slate-500">No {editStakeholderType} stakeholders found</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Need and Expectation */}
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-slate-700">Need and Expectation</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editSelectedNeedExpectation}
                        onValueChange={setEditSelectedNeedExpectation}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select need/expectation" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
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
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stakeholder
                  </Button>
                </div>

                {/* Stakeholder Needs and Exceptions Table */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Stakeholder Needs and Expectations</Label>
                  <div className="border rounded-lg min-h-[150px] mt-1.5">
                    {editStakeholderNeeds.length > 0 ? (
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b">
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
                      <div className="flex items-center justify-center h-[150px] text-slate-500">
                        No stakeholder needs added
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Preview & Save */}
            {editCurrentStep === 5 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Preview & Save</h3>
                <div className="border rounded-lg p-6 space-y-4 bg-slate-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500">Title</Label>
                      <p className="font-medium">{editIssueForm.title || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Domain</Label>
                      <p className="font-medium">{editIssueForm.domain}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Category</Label>
                      <p className="font-medium">{editIssueForm.category}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Issue Type</Label>
                      <p className="font-medium">{editIssueForm.issueType || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Department</Label>
                      <p className="font-medium">
                        {departments.find((d) => d.id === editIssueForm.departmentId)?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Issue Owner</Label>
                      <p className="font-medium">
                        {users.find((u) => u.id === editIssueForm.ownerId)?.fullName || "-"}
                      </p>
                    </div>
                  </div>
                  {editIssueForm.description && (
                    <div>
                      <Label className="text-slate-500">Description</Label>
                      <p className="font-medium">{editIssueForm.description}</p>
                    </div>
                  )}
                  {editIssueForm.selectedRegulations.length > 0 && (
                    <div>
                      <Label className="text-slate-500">Related Regulations</Label>
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
                      <Label className="text-slate-500">Related Processes</Label>
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
                      <Label className="text-slate-500">Stakeholder Needs and Expectations</Label>
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

          </div>
        </div>

        {/* Fixed Footer with Navigation */}
        <div className="flex-shrink-0 flex justify-between px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
          <Button
            variant="outline"
            onClick={() => {
              if (editCurrentStep === 1) {
                setIsEditIssueOpen(false);
                setEditCurrentStep(1);
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
      </DialogContent>

      {/* Add Domain Dialog */}
        <Dialog open={showAddDomainDialog} onOpenChange={setShowAddDomainDialog}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">Add New Domain</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  Enter a name for the new domain.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">Domain Name <span className="text-error">*</span></Label>
              <Input
                id="editNewDomain"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Enter domain name"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Category Dialog */}
        <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">Add New Category</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  Enter a name for the new category.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">Category Name <span className="text-error">*</span></Label>
              <Input
                id="editNewCategory"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Issue Type Dialog */}
        <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">Add New Issue Type</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  Enter a name for the new issue type.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">Issue Type Name <span className="text-error">*</span></Label>
              <Input
                id="editNewType"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="Enter issue type name"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
            </div>
          </DialogContent>
        </Dialog>

        {/* Choose Processes Dialog for Edit */}
        <Dialog open={showEditProcessDialog} onOpenChange={setShowEditProcessDialog}>
          <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
            {/* Fixed Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">Link Process</DialogTitle>
                <DialogDescription>
                  Select processes to link with this issue.
                </DialogDescription>
              </DialogHeader>
            </div>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
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
                        className="flex items-start gap-3 p-4 border rounded-lg border-slate-200 cursor-pointer transition-colors"
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
                          <div className="text-primary-600 font-medium">
                            {process.processCode} : {process.name}
                          </div>
                          {process.description && (
                            <p className="text-sm text-slate-500 mt-1">{process.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-slate-500">
                    No processes found
                  </div>
                )}
              </div>
            </div>
            {/* Fixed Footer */}
            <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setShowEditProcessDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleLinkEditProcesses}>
                Link Process
              </Button>
            </div>
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
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Context</h1>
      </div>

      {/* DepartmentContributor: Show Stakeholder without tabs */}
      {isDepartmentContributor ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search stakeholders..."
                value={stakeholderSearch}
                onChange={(e) => setStakeholderSearch(e.target.value)}
                className="pl-10 w-[250px] bg-white"
              />
            </div>
            <Select value={stakeholderTypeFilter} onValueChange={setStakeholderTypeFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Internal">Internal</SelectItem>
                <SelectItem value="External">External</SelectItem>
                <SelectItem value="Third Party">Third Party</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stakeholderStatusFilter} onValueChange={setStakeholderStatusFilter}>
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataGrid
            columns={stakeholderColumns}
            data={filteredStakeholders}
            hideSearch={true}
          />
        </div>
      ) : (
        /* Other roles: Show normal tabs with Stakeholder and Issue List */
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="stakeholder">Stakeholder</TabsTrigger>
            <TabsTrigger value="issuelist">Issue List</TabsTrigger>
          </TabsList>

          {/* Stakeholder Tab */}
          <TabsContent value="stakeholder" className="mt-6">
            {/* Filters and Action Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search stakeholders..."
                    value={stakeholderSearch}
                    onChange={(e) => setStakeholderSearch(e.target.value)}
                    className="pl-10 w-[250px] bg-white"
                  />
                </div>
                <Select value={stakeholderTypeFilter} onValueChange={setStakeholderTypeFilter}>
                  <SelectTrigger className="w-[150px] bg-white">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Internal">Internal</SelectItem>
                    <SelectItem value="External">External</SelectItem>
                    <SelectItem value="Third Party">Third Party</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stakeholderStatusFilter} onValueChange={setStakeholderStatusFilter}>
                  <SelectTrigger className="w-[150px] bg-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isReadOnlyRole && (
                <Button size="sm" onClick={() => setShowAddStakeholder(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Stakeholder
                </Button>
              )}
            </div>

            <DataGrid
              columns={stakeholderColumns}
              data={filteredStakeholders}
              hideSearch={true}
            />
          </TabsContent>

          {/* Issue List Tab */}
          <TabsContent value="issuelist" className="mt-6">
            {/* Filters and Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search issues..."
                    value={issueSearch}
                    onChange={(e) => setIssueSearch(e.target.value)}
                    className="pl-10 w-[250px] bg-white"
                  />
                </div>
                <Select value={issueDepartmentFilter} onValueChange={setIssueDepartmentFilter}>
                  <SelectTrigger className="w-[180px] bg-white">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={issueCategoryFilter} onValueChange={setIssueCategoryFilter}>
                  <SelectTrigger className="w-[150px] bg-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={issueDomainFilter} onValueChange={setIssueDomainFilter}>
                  <SelectTrigger className="w-[150px] bg-white">
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
                {!isReadOnlyRole && (
                  <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                    <Download className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Upload className="h-4 w-4 mr-2" />
                  Export
                </Button>
                {!isReadOnlyRole && (
                  <Button size="sm" onClick={() => setShowAddIssue(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New
                  </Button>
                )}
              </div>
            </div>

            {/* Issue Cards - Single column list layout */}
            <div className="space-y-3">
              {filteredIssues.map((issue, index) => (
                <div key={issue.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-md">
                        IS{String(index + 1).padStart(3, '0')}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-800">{issue.title}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={
                          issue.status === "Open"
                            ? "border-transparent bg-error-light text-error-dark"
                            : issue.status === "In Progress"
                            ? "border-transparent bg-warning-light text-warning-dark"
                            : issue.status === "Resolved"
                            ? "border-transparent bg-success-light text-success-dark"
                            : "border-transparent bg-slate-100 text-slate-600"
                        }
                      >
                        {issue.status}
                      </Badge>
                      {!isReadOnlyRole && (
                        <div className="flex items-center gap-1 ml-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleEditIssue(issue)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                            onClick={() => {
                              setDeletingItem({ type: "issue", id: issue.id });
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="px-6 py-5">
                    {/* Details Row */}
                    <div className="grid grid-cols-5 gap-6">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Owner</p>
                        <p className="text-sm font-medium text-slate-700">{issue.owner?.fullName || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Category</p>
                        <p className="text-sm font-medium text-slate-700">{issue.category || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Type</p>
                        <p className="text-sm font-medium text-slate-700">{issue.issueType || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Domain</p>
                        <p className="text-sm font-medium text-slate-700">{issue.domain || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Department</p>
                        <p className="text-sm font-medium text-slate-700">{issue.department?.name || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons Footer - Only show if there are actions or for readonly role */}
                  {(isReadOnlyRole || (isReviewerRole && issue.actions && issue.actions.length > 0)) && (
                    <div className="flex items-center gap-3 px-6 py-3 border-t border-slate-100 bg-slate-50/30">
                      {/* DeptReviewer/DeptContributor: Create Action and View Action buttons */}
                      {isReadOnlyRole && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setSelectedIssueForAction(issue);
                              setActionForm({ actionType: "", description: "", completion: 0, comment: "" });
                              setShowCreateActionDialog(true);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Create Action
                          </Button>
                          {issue.actions && issue.actions.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setSelectedIssueForAction(issue);
                                setShowViewActionsDialog(true);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              View Actions ({issue.actions.length})
                            </Button>
                          )}
                        </>
                      )}

                      {/* CustomerAdmin/Reviewer: Action button (only if actions exist) */}
                      {isReviewerRole && issue.actions && issue.actions.length > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setSelectedIssueForAction(issue);
                            const pendingAction = issue.actions?.find(a => a.status === "Pending");
                            if (pendingAction) {
                              setSelectedActionForReview(pendingAction);
                              setShowActionReviewDialog(true);
                            } else {
                              setShowViewActionsDialog(true);
                            }
                          }}
                        >
                          Review Actions ({issue.actions.filter(a => a.status === "Pending").length} pending)
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredIssues.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-800 mb-1">No Issues Found</h3>
                <p className="text-sm text-slate-500">
                  {issueSearch || issueDepartmentFilter !== "all" || issueCategoryFilter !== "all" || issueDomainFilter !== "all"
                    ? "Try adjusting your filters to find issues."
                    : "Create your first issue to get started."}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Add Issue Modal */}
      {renderAddIssueModal()}

      {/* Edit Issue Modal */}
      {renderEditIssueModal()}

      {/* Add Stakeholder Dialog */}
      <Dialog open={showAddStakeholder} onOpenChange={setShowAddStakeholder}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Add Stakeholder</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">Stakeholder Type</Label>
                <RadioGroup
                  value={newStakeholder.type}
                  onValueChange={(value) => setNewStakeholder({ ...newStakeholder, type: value })}
                  className="flex gap-6 mt-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Internal" id="add-internal" />
                    <Label htmlFor="add-internal" className="font-normal text-sm text-slate-600">Internal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="External" id="add-external" />
                    <Label htmlFor="add-external" className="font-normal text-sm text-slate-600">External</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Third Party" id="add-thirdparty" />
                    <Label htmlFor="add-thirdparty" className="font-normal text-sm text-slate-600">Third Party</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Stakeholder Name <span className="text-error">*</span></Label>
                <Input
                  value={newStakeholder.name}
                  onChange={(e) => setNewStakeholder({ ...newStakeholder, name: e.target.value })}
                  placeholder="Enter stakeholder name"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Department</Label>
                  <Select
                    value={newStakeholder.departmentId}
                    onValueChange={(value) => setNewStakeholder({ ...newStakeholder, departmentId: value })}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Select department" />
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
                  <Label className="text-sm font-medium text-slate-700">Status</Label>
                  <Select
                    value={newStakeholder.status}
                    onValueChange={(value) => setNewStakeholder({ ...newStakeholder, status: value })}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setShowAddStakeholder(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStakeholder}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Stakeholder Dialog */}
      <Dialog open={showEditStakeholder} onOpenChange={setShowEditStakeholder}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Edit Stakeholder</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">Stakeholder Type</Label>
                <RadioGroup
                  value={editingStakeholder?.type || "Internal"}
                  onValueChange={(value) => setEditingStakeholder(editingStakeholder ? { ...editingStakeholder, type: value } : null)}
                  className="flex gap-6 mt-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Internal" id="edit-internal" />
                    <Label htmlFor="edit-internal" className="font-normal text-sm text-slate-600">Internal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="External" id="edit-external" />
                    <Label htmlFor="edit-external" className="font-normal text-sm text-slate-600">External</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Third Party" id="edit-thirdparty" />
                    <Label htmlFor="edit-thirdparty" className="font-normal text-sm text-slate-600">Third Party</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Stakeholder Name <span className="text-error">*</span></Label>
                <Input
                  value={editingStakeholder?.name || ""}
                  onChange={(e) => setEditingStakeholder(editingStakeholder ? { ...editingStakeholder, name: e.target.value } : null)}
                  placeholder="Enter stakeholder name"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Department</Label>
                  <Select
                    value={editingStakeholder?.departmentId || ""}
                    onValueChange={(value) => setEditingStakeholder(editingStakeholder ? { ...editingStakeholder, departmentId: value } : null)}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Select department" />
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
                  <Label className="text-sm font-medium text-slate-700">Status</Label>
                  <Select
                    value={editingStakeholder?.status || "Active"}
                    onValueChange={(value) => setEditingStakeholder(editingStakeholder ? { ...editingStakeholder, status: value } : null)}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setShowEditStakeholder(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStakeholder}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Confirm Delete</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                Are you sure you want to delete this {deletingItem?.type}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Domain Dialog */}
      <Dialog open={showAddDomainDialog} onOpenChange={setShowAddDomainDialog}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" nested>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Add New Domain</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                Enter a name for the new domain.
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6">
            <Label className="text-sm font-medium text-slate-700">Domain Name <span className="text-error">*</span></Label>
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="Enter domain name"
              className="mt-1.5"
            />
          </div>
          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setShowAddDomainDialog(false); setNewDomain(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddDomain} disabled={!newDomain.trim()}>
              Add Domain
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" nested>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Add New Category</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                Enter a name for the new category.
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6">
            <Label className="text-sm font-medium text-slate-700">Category Name <span className="text-error">*</span></Label>
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Enter category name"
              className="mt-1.5"
            />
          </div>
          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setShowAddCategoryDialog(false); setNewCategory(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>
              Add Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Issue Type Dialog */}
      <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" nested>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Add New Issue Type</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                Enter a name for the new issue type.
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6">
            <Label className="text-sm font-medium text-slate-700">Issue Type Name <span className="text-error">*</span></Label>
            <Input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="Enter issue type name"
              className="mt-1.5"
            />
          </div>
          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setShowAddTypeDialog(false); setNewType(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddType} disabled={!newType.trim()}>
              Add Type
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Action Dialog (DeptReviewer) */}
      <Dialog open={showCreateActionDialog} onOpenChange={(open) => {
        setShowCreateActionDialog(open);
        if (!open) {
          setActionForm({ actionType: "", description: "", completion: 0, comment: "" });
          setActionFile(null);
          setSelectedIssueForAction(null);
        }
      }}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Action Details</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                Create a new action for issue: {selectedIssueForAction?.title}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">Action Type <span className="text-error">*</span></Label>
                <Select
                  value={actionForm.actionType}
                  onValueChange={(value) => setActionForm({ ...actionForm, actionType: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select action type" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="Preventive">Preventive</SelectItem>
                    <SelectItem value="Corrective">Corrective</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Description <span className="text-error">*</span></Label>
                <textarea
                  className="mt-1.5 flex min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  placeholder="Enter action description"
                  value={actionForm.description}
                  onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Completion (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={actionForm.completion}
                  onChange={(e) => setActionForm({ ...actionForm, completion: parseInt(e.target.value) || 0 })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Comment</Label>
                <textarea
                  className="mt-1.5 flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  placeholder="Optional comment"
                  value={actionForm.comment}
                  onChange={(e) => setActionForm({ ...actionForm, comment: e.target.value })}
                />
              </div>
              {/* File Upload Section */}
              <div>
                <Label className="text-sm font-medium text-slate-700">Attachment</Label>
                <div
                  className={`mt-1.5 border border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    isDraggingActionFile ? "border-primary-500 bg-primary-50" : "border-slate-200 border-slate-200"
                  }`}
                  onDragOver={handleActionFileDragOver}
                  onDragLeave={handleActionFileDragLeave}
                  onDrop={handleActionFileDrop}
                  onClick={() => actionFileInputRef.current?.click()}
                >
                  {actionFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <File className="h-5 w-5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{actionFile.name}</span>
                        <span className="text-xs text-slate-500">
                          ({(actionFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-semantic-error"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionFile(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      <Upload className="h-6 w-6 mx-auto text-slate-300" />
                      <p className="text-sm text-slate-500">
                        Drag and drop a file here, or click to browse
                      </p>
                    </div>
                  )}
                  <input
                    ref={actionFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleActionFileChange}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setShowCreateActionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAction} disabled={savingAction || !actionForm.actionType || !actionForm.description}>
              {savingAction ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Actions Dialog (DeptReviewer) */}
      <Dialog open={showViewActionsDialog} onOpenChange={(open) => {
        setShowViewActionsDialog(open);
        if (!open) setSelectedIssueForAction(null);
      }}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Actions for Issue</DialogTitle>
              <DialogDescription>
                {selectedIssueForAction?.title}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {selectedIssueForAction?.actions?.map((action) => (
              <Card key={action.id} className={`${action.status === "Sent Back" ? "border-warning" : action.status === "Resolved" ? "border-success" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Badge variant={action.status === "Resolved" ? "default" : action.status === "Sent Back" ? "destructive" : "secondary"}>
                        {action.status}
                      </Badge>
                      <Badge variant="outline" className="ml-2">{action.actionType}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {action.status === "Sent Back" && action.comments.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedActionForComments(action);
                            setShowActionCommentsDialog(true);
                          }}
                        >
                          <MessageSquare className="h-4 w-4 text-warning" />
                        </Button>
                      )}
                      {action.status === "Sent Back" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingAction(action);
                            setEditActionForm({
                              actionType: action.actionType,
                              description: action.description,
                              completion: action.completion,
                              comment: action.comment || "",
                            });
                            setShowEditActionDialog(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm mb-2">{action.description}</p>

                  {/* File Upload Dropzone - Only show when action is NOT resolved */}
                  {action.status !== "Resolved" && (
                    <div className="space-y-2 mb-2">
                      <div
                        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                          isDraggingViewActionFile === action.id ? "border-primary bg-primary/5" : "border-muted-foreground/25 border-slate-200"
                        } ${uploadingActionId === action.id ? "opacity-50 pointer-events-none" : ""}`}
                        onDragOver={(e) => handleViewActionFileDragOver(e, action.id)}
                        onDragLeave={handleViewActionFileDragLeave}
                        onDrop={(e) => handleViewActionFileDrop(e, action)}
                        onClick={() => {
                          if (viewActionFileInputRef.current) {
                            viewActionFileInputRef.current.setAttribute("data-action-id", action.id);
                            viewActionFileInputRef.current.setAttribute("data-issue-id", action.issueId);
                            viewActionFileInputRef.current.click();
                          }
                        }}
                      >
                        {uploadingActionId === action.id ? (
                          <div className="flex items-center justify-center gap-2 py-1">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            <span className="text-sm text-slate-500">Uploading...</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-1">
                            <Upload className="h-4 w-4 text-slate-500" />
                            <span className="text-sm text-slate-500">Drop file here or click to upload</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Display Section */}
                  {action.fileName && action.filePath && (
                    <div className="space-y-2 mb-2">
                      <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          {action.fileType?.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                            <FileImage className="h-5 w-5 text-info" />
                          ) : action.fileType?.match(/^(xls|xlsx|csv)$/i) ? (
                            <FileSpreadsheet className="h-5 w-5 text-success" />
                          ) : action.fileType?.match(/^(doc|docx|txt|pdf)$/i) ? (
                            <FileText className="h-5 w-5 text-error" />
                          ) : (
                            <File className="h-5 w-5 text-slate-500" />
                          )}
                          <span className="text-sm truncate max-w-[150px]">{action.fileName}</span>
                          {action.fileSize && (
                            <span className="text-xs text-slate-500">
                              ({(action.fileSize / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(action.filePath!, "_blank")}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title="Download"
                          >
                            <a href={action.filePath!} download={action.fileName}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          {/* Delete button - Only show when action is NOT resolved */}
                          {action.status !== "Resolved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteActionFile(action)}
                              disabled={uploadingActionId === action.id}
                              title="Delete"
                              className="text-slate-400 hover:text-semantic-error"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-xs text-slate-500">
                    <span>By: {action.createdBy.fullName}</span>
                    <span>Completion: {action.completion}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!selectedIssueForAction?.actions || selectedIssueForAction.actions.length === 0) && (
              <p className="text-center text-slate-500 py-4">No actions found</p>
            )}
            {/* Hidden file input for View Actions */}
            <input
              ref={viewActionFileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const actionId = viewActionFileInputRef.current?.getAttribute("data-action-id");
                const issueId = viewActionFileInputRef.current?.getAttribute("data-issue-id");
                const action = selectedIssueForAction?.actions?.find(a => a.id === actionId);
                if (action) {
                  handleViewActionFileChange(e, action);
                }
              }}
            />
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setShowViewActionsDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Review Dialog (CustomerAdmin/Reviewer) */}
      <Dialog open={showActionReviewDialog} onOpenChange={(open) => {
        setShowActionReviewDialog(open);
        if (!open) {
          setSelectedActionForReview(null);
          setSelectedIssueForAction(null);
        }
      }}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Review Action</DialogTitle>
              <DialogDescription>
                Review and take action on this submission
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          {selectedActionForReview && (
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div className="space-y-2">
                <Label>Action Type</Label>
                <p className="text-sm p-2 bg-muted rounded">{selectedActionForReview.actionType}</p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <p className="text-sm p-2 bg-muted rounded whitespace-pre-wrap">{selectedActionForReview.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Completion</Label>
                  <p className="text-sm p-2 bg-muted rounded">{selectedActionForReview.completion}%</p>
                </div>
                <div className="space-y-2">
                  <Label>Created By</Label>
                  <p className="text-sm p-2 bg-muted rounded">{selectedActionForReview.createdBy.fullName}</p>
                </div>
              </div>
              {selectedActionForReview.comment && (
                <div className="space-y-2">
                  <Label>Comment</Label>
                  <p className="text-sm p-2 bg-muted rounded whitespace-pre-wrap">{selectedActionForReview.comment}</p>
                </div>
              )}
              {/* Attachment Section - Only visible if file exists */}
              {selectedActionForReview.fileName && selectedActionForReview.filePath && (
                <div className="space-y-2">
                  <Label>Attachment</Label>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      {/* File Type Icon */}
                      {selectedActionForReview.fileType?.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                        <FileImage className="h-8 w-8 text-info" />
                      ) : selectedActionForReview.fileType?.match(/^(xls|xlsx|csv)$/i) ? (
                        <FileSpreadsheet className="h-8 w-8 text-success" />
                      ) : selectedActionForReview.fileType?.match(/^(doc|docx|txt|pdf)$/i) ? (
                        <FileText className="h-8 w-8 text-error" />
                      ) : (
                        <File className="h-8 w-8 text-slate-500" />
                      )}
                      {/* File Name and Size */}
                      <div>
                        <p className="text-sm font-medium truncate max-w-[180px]">
                          {selectedActionForReview.fileName}
                        </p>
                        {selectedActionForReview.fileSize && (
                          <p className="text-xs text-slate-500">
                            {(selectedActionForReview.fileSize / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                    </div>
                    {/* View and Download Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(selectedActionForReview.filePath!, "_blank")}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={selectedActionForReview.filePath!}
                          download={selectedActionForReview.fileName}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setShowActionReviewDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => selectedActionForReview && handleResolveAction(selectedActionForReview)}
              disabled={processingAction}
            >
              {processingAction ? "Processing..." : "Resolved"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowResendDialog(true)}
              disabled={processingAction}
            >
              Resend
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resend Comment Dialog (CustomerAdmin/Reviewer) */}
      <Dialog open={showResendDialog} onOpenChange={(open) => {
        setShowResendDialog(open);
        if (!open) setResendComment("");
      }}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Send Back Action</DialogTitle>
              <DialogDescription>
                Add a comment explaining why this action is being sent back
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label htmlFor="resendComment" className="text-sm font-medium text-slate-700">Comment *</Label>
              <textarea
                id="resendComment"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1.5"
                placeholder="Enter your feedback..."
                value={resendComment}
                onChange={(e) => setResendComment(e.target.value)}
              />
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setShowResendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResendAction} disabled={processingAction || !resendComment.trim()}>
              {processingAction ? "Sending..." : "Send Back"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Comments Dialog (DeptReviewer) */}
      <Dialog open={showActionCommentsDialog} onOpenChange={(open) => {
        setShowActionCommentsDialog(open);
        if (!open) setSelectedActionForComments(null);
      }}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Comments</DialogTitle>
              <DialogDescription>
                Feedback from reviewer
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {selectedActionForComments?.comments.map((comment) => (
              <Card key={comment.id}>
                <CardContent className="p-3">
                  <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>By: {comment.createdBy}</span>
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!selectedActionForComments?.comments || selectedActionForComments.comments.length === 0) && (
              <p className="text-center text-slate-500 py-4">No comments</p>
            )}
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setShowActionCommentsDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Action Dialog (DeptReviewer - for sent back actions) */}
      <Dialog open={showEditActionDialog} onOpenChange={(open) => {
        setShowEditActionDialog(open);
        if (!open) {
          setEditingAction(null);
          setEditActionForm({ actionType: "", description: "", completion: 0, comment: "" });
        }
      }}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Edit Action</DialogTitle>
              <DialogDescription>
                Update and resubmit this action
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label htmlFor="editActionType" className="text-sm font-medium text-slate-700">Action Type *</Label>
              <Select
                value={editActionForm.actionType}
                onValueChange={(value) => setEditActionForm({ ...editActionForm, actionType: value })}
              >
                <SelectTrigger className="mt-1.5 bg-white">
                  <SelectValue placeholder="Select action type" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="Preventive">Preventive</SelectItem>
                  <SelectItem value="Corrective">Corrective</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editDescription" className="text-sm font-medium text-slate-700">Description *</Label>
              <textarea
                id="editDescription"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1.5"
                placeholder="Enter action description"
                value={editActionForm.description}
                onChange={(e) => setEditActionForm({ ...editActionForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="editCompletion" className="text-sm font-medium text-slate-700">Completion (%)</Label>
              <Input
                id="editCompletion"
                type="number"
                min="0"
                max="100"
                value={editActionForm.completion}
                onChange={(e) => setEditActionForm({ ...editActionForm, completion: parseInt(e.target.value) || 0 })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="editComment" className="text-sm font-medium text-slate-700">Comment</Label>
              <textarea
                id="editComment"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1.5"
                placeholder="Optional comment"
                value={editActionForm.comment}
                onChange={(e) => setEditActionForm({ ...editActionForm, comment: e.target.value })}
              />
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setShowEditActionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAction} disabled={savingAction || !editActionForm.actionType || !editActionForm.description}>
              {savingAction ? "Saving..." : "Save & Resubmit"}
            </Button>
          </div>
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
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Import Issues</DialogTitle>
              <DialogDescription>
                Import issues from a CSV file. The file should have columns: title (required), description, domain, category, type.
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">File</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {importFile && (
                <p className="text-sm text-slate-500 mt-1">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex justify-between gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
