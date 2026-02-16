"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, Download, Upload, Search, ChevronRight, ChevronLeft, MessageSquare, File, FileText, FileImage, FileSpreadsheet, Eye, X, Check, ArrowLeft, Home, Users, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from "@/hooks/usePermissions";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { isValidName } from "@/lib/validations";

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
const defaultDomains: string[] = [];
const defaultCategories: string[] = [];
const defaultIssueTypes: string[] = [];

// 5-step wizard for adding issues - step names will be translated in render
const ISSUE_STEP_KEYS = [
  { id: 1, nameKey: "Info", descriptionKey: "Basic information" },
  { id: 2, nameKey: "Regulations", descriptionKey: "Related regulations" },
  { id: 3, nameKey: "Process", descriptionKey: "Related processes" },
  { id: 4, nameKey: "Stakeholder", descriptionKey: "Related stakeholders" },
  { id: 5, nameKey: "Preview & Save", descriptionKey: "Review and submit" },
];

const ITEMS_PER_PAGE = 10;

export default function ContextPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDashboard = searchParams.get("from") === "dashboard";
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { t } = useLanguage();

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

  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabParam === "issuelist" ? "issuelist" : "stakeholder");
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
  const [stakeholderPage, setStakeholderPage] = useState(1);
  const [issuePage, setIssuePage] = useState(1);

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
  const [stakeholderErrors, setStakeholderErrors] = useState<Record<string, string>>({});

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
  const [issueErrors, setIssueErrors] = useState<Record<string, string>>({});
  const [issueStepError, setIssueStepError] = useState("");

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
  const [domainError, setDomainError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [typeError, setTypeError] = useState("");

  // Process dialog state
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [processSearchQuery, setProcessSearchQuery] = useState("");
  const [tempSelectedProcesses, setTempSelectedProcesses] = useState<string[]>([]);

  // Stakeholder step 4 state
  const [stakeholderType, setStakeholderType] = useState("");
  const [selectedStakeholderId, setSelectedStakeholderId] = useState("");
  const [step4Errors, setStep4Errors] = useState<Record<string, string>>({});
  const [selectedNeedExpectation, setSelectedNeedExpectation] = useState("");
  const [stakeholderNeeds, setStakeholderNeeds] = useState<{ stakeholderId: string; needExpectation: string }[]>([]);
  const [needExpectationOptions, setNeedExpectationOptions] = useState<string[]>([]);
  const [showAddNeedDialog, setShowAddNeedDialog] = useState(false);
  const [newNeedExpectation, setNewNeedExpectation] = useState("");
  const [customNeedExpectations, setCustomNeedExpectations] = useState<string[]>([]);

  // Handlers for adding new options
  const handleAddDomain = () => {
    if (!newDomain.trim()) { setDomainError(t("Please enter domain name")); return; }
    if (!isValidName(newDomain.trim())) { setDomainError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setDomainError("");
    if (!domains.includes(newDomain.trim())) {
      setDomains([...domains, newDomain.trim()]);
      setNewIssue({ ...newIssue, domain: newDomain.trim() });
    }
    setNewDomain("");
    setShowAddDomainDialog(false);
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) { setCategoryError(t("Please enter category name")); return; }
    if (!isValidName(newCategory.trim())) { setCategoryError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setCategoryError("");
    if (!categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewIssue({ ...newIssue, category: newCategory.trim() });
    }
    setNewCategory("");
    setShowAddCategoryDialog(false);
  };

  const handleAddType = () => {
    if (!newType.trim()) { setTypeError(t("Please enter issue type name")); return; }
    if (!isValidName(newType.trim())) { setTypeError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setTypeError("");
    if (!issueTypes.includes(newType.trim())) {
      setIssueTypes([...issueTypes, newType.trim()]);
      setNewIssue({ ...newIssue, issueType: newType.trim() });
    }
    setNewType("");
    setShowAddTypeDialog(false);
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
    const errors: Record<string, string> = {};
    if (!stakeholderType) errors.stakeholderType = t("Please Select Stakeholder Type");
    if (!selectedStakeholderId) errors.stakeholder = t("Please select Stakeholder");
    if (!selectedNeedExpectation) errors.needExpectation = t("Please Select Need and Exception");
    if (Object.keys(errors).length > 0) { setStep4Errors(errors); return; }
    setStep4Errors({});
    const newNeed = { stakeholderId: selectedStakeholderId, needExpectation: selectedNeedExpectation };
    setStakeholderNeeds([...stakeholderNeeds, newNeed]);
    setSelectedStakeholderId("");
    setSelectedNeedExpectation("");
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
    if (activeTab === "stakeholder") {
      const csvContent = "name,type,status\nJohn Doe,Internal,Active\nAcme Corp,External,Active\nPartner Inc,Third Party,Active";
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "stakeholders_template.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const csvContent = "title,description,domain,category,type\nSample Issue 1,Description for issue 1,Internal,Finance,Financial\nSample Issue 2,Description for issue 2,External,Security,Compliance";
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "issues_template.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("CSV file must have a header row and at least one data row"), variant: "destructive" });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      if (activeTab === "stakeholder") {
        // Import stakeholders
        const nameIndex = headers.findIndex(h => h === 'name');
        const typeIndex = headers.findIndex(h => h === 'type');
        const statusIndex = headers.findIndex(h => h === 'status');

        if (nameIndex === -1) {
          toast({ title: t("Error"), description: t("CSV must have a \"name\" column"), variant: "destructive" });
          return;
        }

        const newStakeholders: Stakeholder[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const name = values[nameIndex];

          if (!name) continue;

          const stakeholderData = {
            name,
            type: typeIndex !== -1 ? values[typeIndex] || 'Internal' : 'Internal',
            status: statusIndex !== -1 ? values[statusIndex] || 'Active' : 'Active',
            departmentId: null,
          };

          const res = await fetch('/api/stakeholders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stakeholderData),
          });

          if (res.ok) {
            const stakeholder = await res.json();
            newStakeholders.push(stakeholder);
          }
        }

        setStakeholders([...stakeholders, ...newStakeholders]);
        setShowImportDialog(false);
        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        toast({ title: t("Success"), description: t("Successfully imported {count} stakeholders").replace("{count}", String(newStakeholders.length)) });
      } else {
        // Import issues
        const titleIndex = headers.findIndex(h => h === 'title');
        const descriptionIndex = headers.findIndex(h => h === 'description');
        const domainIndex = headers.findIndex(h => h === 'domain');
        const categoryIndex = headers.findIndex(h => h === 'category');
        const issueTypeIndex = headers.findIndex(h => h === 'issuetype' || h === 'issue type' || h === 'type');

        if (titleIndex === -1) {
          toast({ title: t("Error"), description: t("CSV must have a \"title\" column"), variant: "destructive" });
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
        toast({ title: t("Success"), description: t("Successfully imported {count} issues").replace("{count}", String(newIssues.length)) });
      }
    } catch (error) {
      console.error('Error importing:', error);
      toast({ title: t("Error"), description: t("Error importing data. Please check the file format."), variant: "destructive" });
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
      if (issueRes.ok) {
        const issuesData = await issueRes.json();
        setIssues(issuesData);
        const uniqueDomains = [...new Set(issuesData.map((i: Issue) => i.domain).filter(Boolean))] as string[];
        const uniqueCategories = [...new Set(issuesData.map((i: Issue) => i.category).filter(Boolean))] as string[];
        const uniqueIssueTypes = [...new Set(issuesData.map((i: Issue) => i.issueType).filter(Boolean))] as string[];
        setDomains(uniqueDomains);
        setCategories(uniqueCategories);
        setIssueTypes(uniqueIssueTypes);
        const uniqueNeeds = [...new Set(
          issuesData.flatMap((i: Issue) => (i.stakeholders || []).map((s: IssueStakeholder) => s.needExpectation)).filter(Boolean)
        )] as string[];
        setNeedExpectationOptions(uniqueNeeds);
      }
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
    const errors: Record<string, string> = {};
    if (!newStakeholder.name.trim()) {
      errors.name = t("Please Enter Stakeholder Name");
    } else if (!isValidName(newStakeholder.name.trim())) {
      errors.name = t("Only letters, numbers, spaces, and hyphens are allowed");
    }
    if (!newStakeholder.type) errors.type = t("Please Select Stakeholder Type");
    if (!newStakeholder.status) errors.status = t("Please Select Status");
    if (Object.keys(errors).length > 0) {
      setStakeholderErrors(errors);
      return;
    }
    setStakeholderErrors({});
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
    if (!editingStakeholder) return;
    if (!editingStakeholder.name.trim()) {
      setStakeholderErrors({ name: t("Please Enter Stakeholder Name") });
      return;
    }
    if (!isValidName(editingStakeholder.name.trim())) {
      setStakeholderErrors({ name: t("Only letters, numbers, spaces, and hyphens are allowed") });
      return;
    }
    setStakeholderErrors({});
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
          title: t("Success"),
          description: t("Stakeholder updated successfully"),
        });
      }
    } catch (error) {
      console.error("Error updating stakeholder:", error);
      toast({
        title: t("Error"),
        description: t("Failed to update stakeholder"),
        variant: "destructive",
      });
    }
  };

  // Issue CRUD
  const handleAddIssue = async () => {
    if (!newIssue.title.trim()) {
      toast({
        title: t("Error"),
        description: t("Title is required"),
        variant: "destructive",
      });
      return;
    }
    if (!isValidName(newIssue.title.trim())) {
      toast({
        title: t("Error"),
        description: t("Only letters, numbers, spaces, and hyphens are allowed"),
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
          title: t("Success"),
          description: t("Issue created successfully"),
        });
      } else {
        const errorData = await res.json();
        console.error("API Error:", errorData);
        toast({
          title: t("Error"),
          description: errorData.error || t("Failed to create issue"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding issue:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create issue"),
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
    if (!editingIssue) return;
    if (!editIssueForm.title.trim()) {
      toast({
        title: t("Error"),
        description: t("Title is required"),
        variant: "destructive",
      });
      return;
    }
    if (!isValidName(editIssueForm.title.trim())) {
      toast({
        title: t("Error"),
        description: t("Only letters, numbers, spaces, and hyphens are allowed"),
        variant: "destructive",
      });
      return;
    }

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
          title: t("Success"),
          description: t("Issue updated successfully"),
        });
      }
    } catch (error) {
      console.error("Error updating issue:", error);
      toast({
        title: t("Error"),
        description: t("Failed to update issue"),
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
          title: t("Error"),
          description: t("Failed to upload file"),
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
          title: t("Success"),
          description: t("File uploaded successfully"),
        });
        // Refresh issues
        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) setIssues(await issuesRes.json());
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to attach file to action"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: t("Error"),
        description: t("Failed to upload file"),
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
          title: t("Success"),
          description: t("File deleted successfully"),
        });
        // Refresh issues
        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) setIssues(await issuesRes.json());
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to delete file"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({
        title: t("Error"),
        description: t("Failed to delete file"),
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
        title: t("Error"),
        description: t("Action type and description are required"),
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
            title: t("Error"),
            description: t("Failed to upload file"),
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
          title: t("Success"),
          description: t("Action created successfully"),
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
          title: t("Error"),
          description: error.error || t("Failed to create action"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating action:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create action"),
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
          title: t("Success"),
          description: t("Action is resolved"),
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
        title: t("Error"),
        description: t("Failed to resolve action"),
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
        title: t("Error"),
        description: t("Comment is required"),
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
          title: t("Success"),
          description: t("Action is sent back"),
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
        title: t("Error"),
        description: t("Failed to send back action"),
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
        title: t("Error"),
        description: t("Action type and description are required"),
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
          title: t("Success"),
          description: t("Action updated and resubmitted"),
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
        title: t("Error"),
        description: t("Failed to update action"),
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
  const handleExportIssues = () => {
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

  // Export Stakeholders handler
  const handleExportStakeholders = () => {
    const headers = ["Name", "Type", "Department", "Status"];
    const csvRows = [headers.join(",")];

    filteredStakeholders.forEach((s) => {
      const row = [
        `"${s.name.replace(/"/g, '""')}"`,
        `"${s.type}"`,
        `"${s.department?.name || ""}"`,
        `"${s.status}"`,
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stakeholders_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Context-aware export handler based on active tab
  const handleExport = () => {
    if (activeTab === "stakeholder") {
      handleExportStakeholders();
    } else {
      handleExportIssues();
    }
  };

  // Get unique categories and domains from issues
  const uniqueCategories = [...new Set(issues.map((i) => i.category))];
  const uniqueDomains = [...new Set(issues.map((i) => i.domain))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">{t("Loading...")}</p>
      </div>
    );
  }

  // Add Issue Form (5-Step Wizard) - Rendered as Modal
  const renderAddIssueModal = () => (
    <Dialog open={showAddIssue} onOpenChange={(open) => { if (!open) { setShowAddIssue(false); setCurrentStep(1); setIssueErrors({}); setStep4Errors({}); } }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Add Issue")}</DialogTitle>
          </DialogHeader>
        </div>

        {/* Step Progress */}
        <div className="flex-shrink-0 flex items-start justify-center py-3 sm:py-5 px-2 sm:px-6 border-b border-slate-100 overflow-x-auto">
          {ISSUE_STEP_KEYS.map((step, index) => (
            <div key={step.id} className="flex items-start">
              <div className="flex flex-col items-center w-14 sm:w-24">
                <div
                  className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors ${
                    currentStep > step.id
                      ? "bg-success text-white"
                      : currentStep === step.id
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : step.id}
                </div>
                <span
                  className={`mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-center ${
                    currentStep >= step.id ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {t(step.nameKey)}
                </span>
              </div>
              {index < ISSUE_STEP_KEYS.length - 1 && (
                <div
                  className={`w-4 sm:w-8 h-0.5 mt-[14px] sm:mt-[18px] -mx-1 sm:-mx-3 transition-colors ${
                    currentStep > step.id ? "bg-success" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="space-y-5">
            {/* Step 1: Info */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Basic Information")}</h3>
                {/* Issue Title - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Issue Title")} <span className="text-error">*</span></Label>
                  <Input
                    value={newIssue.title}
                    onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                    placeholder={t("Enter issue title")}
                    className="mt-1.5"
                  />
                </div>
                {/* Domain & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Domain")} <span className="text-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={newIssue.domain}
                        onValueChange={(value) => { setNewIssue({ ...newIssue, domain: value }); if (issueErrors.domain) setIssueErrors((prev) => { const { domain, ...rest } = prev; return rest; }); }}
                      >
                        <SelectTrigger className={`w-full ${issueErrors.domain ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select domain")} />
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
                    {issueErrors.domain && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{issueErrors.domain}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Category")} <span className="text-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={newIssue.category}
                        onValueChange={(value) => { setNewIssue({ ...newIssue, category: value }); if (issueErrors.category) setIssueErrors((prev) => { const { category, ...rest } = prev; return rest; }); }}
                      >
                        <SelectTrigger className={`w-full ${issueErrors.category ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select category")} />
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
                    {issueErrors.category && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{issueErrors.category}</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Department & Issue Owner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Department")} <span className="text-error">*</span></Label>
                    <Select
                      value={newIssue.departmentId}
                      onValueChange={(value) => { setNewIssue({ ...newIssue, departmentId: value, ownerId: "" }); if (issueErrors.departmentId) setIssueErrors((prev) => { const { departmentId, ...rest } = prev; return rest; }); }}
                    >
                      <SelectTrigger className={`w-full mt-1.5 ${issueErrors.departmentId ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {issueErrors.departmentId && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{issueErrors.departmentId}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Issue Owner")} <span className="text-error">*</span></Label>
                    <Select
                      value={newIssue.ownerId}
                      onValueChange={(value) => { setNewIssue({ ...newIssue, ownerId: value }); if (issueErrors.ownerId) setIssueErrors((prev) => { const { ownerId, ...rest } = prev; return rest; }); }}
                      disabled={!newIssue.departmentId}
                    >
                      <SelectTrigger className={`w-full mt-1.5 ${issueErrors.ownerId ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                        <SelectValue placeholder={newIssue.departmentId ? t("Select owner") : t("Select department first")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users
                          .filter((user) =>
                            (!newIssue.departmentId || user.departmentId === newIssue.departmentId) &&
                            user.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer")
                          )
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {issueErrors.ownerId && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{issueErrors.ownerId}</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Issue Type - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Issue Type")} <span className="text-error">*</span></Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={newIssue.issueType}
                      onValueChange={(value) => { setNewIssue({ ...newIssue, issueType: value }); if (issueErrors.issueType) setIssueErrors((prev) => { const { issueType, ...rest } = prev; return rest; }); }}
                    >
                      <SelectTrigger className={`w-full ${issueErrors.issueType ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select type")} />
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
                  {issueErrors.issueType && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{issueErrors.issueType}</p>
                    </div>
                  )}
                </div>
                {/* Description */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Textarea
                    id="issueDescription"
                    value={newIssue.description}
                    onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                    placeholder={t("Enter issue description")}
                    className="min-h-[100px] mt-1.5"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Regulations */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Related Regulations")}</h3>
                <p className="text-slate-500 text-sm">{t("Select regulations related to this issue (optional)")}</p>
                <div className="border rounded-lg p-4 min-h-[200px]">
                  {regulations.length > 0 ? (
                    <div className="space-y-1">
                      {regulations.map((reg) => (
                        <label key={reg.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                          <Checkbox
                            checked={newIssue.selectedRegulations.includes(reg.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
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
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-slate-700">{reg.name}</span>
                            {reg.version && <span className="text-slate-400 ms-2 text-xs">v{reg.version}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-sm text-slate-400 h-full">
                      {t("No regulations available")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Process */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Related Processes")}</h3>
                  <Button variant="outline" onClick={handleOpenProcessDialog}>
                    <Plus className="h-4 w-4 me-1.5" />
                    {t("Choose Processes")}
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
                      {t("No items found")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Stakeholder */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Stakeholder Information")}</h3>
                {/* Stakeholder Type */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Stakeholder Type")} <span className="text-error">*</span></Label>
                  <RadioGroup
                    value={stakeholderType}
                    onValueChange={(value) => { setStakeholderType(value); if (step4Errors.stakeholderType) setStep4Errors((prev) => { const { stakeholderType, ...rest } = prev; return rest; }); }}
                    className="flex gap-6 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Internal" id="st-internal" />
                      <Label htmlFor="st-internal" className="font-normal">{t("Internal")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="External" id="st-external" />
                      <Label htmlFor="st-external" className="font-normal">{t("External")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Third Party" id="st-thirdparty" />
                      <Label htmlFor="st-thirdparty" className="font-normal">{t("Third Party")}</Label>
                    </div>
                  </RadioGroup>
                  {step4Errors.stakeholderType && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{step4Errors.stakeholderType}</p>
                    </div>
                  )}
                </div>

                {/* Stakeholder Selection */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Stakeholder")} <span className="text-error">*</span></Label>
                  <Select
                    value={selectedStakeholderId}
                    onValueChange={(value) => { setSelectedStakeholderId(value); if (step4Errors.stakeholder) setStep4Errors((prev) => { const { stakeholder, ...rest } = prev; return rest; }); }}
                  >
                    <SelectTrigger className={`mt-1.5 ${step4Errors.stakeholder ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select stakeholder")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {filteredStakeholdersByType.length > 0 ? (
                        filteredStakeholdersByType.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-slate-500">{t("No")} {t(stakeholderType || "Internal")} {t("stakeholders found")}</div>
                      )}
                    </SelectContent>
                  </Select>
                  {step4Errors.stakeholder && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{step4Errors.stakeholder}</p>
                    </div>
                  )}
                </div>

                {/* Need and Expectation */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Need and Expectation")} <span className="text-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={selectedNeedExpectation}
                        onValueChange={(value) => { setSelectedNeedExpectation(value); if (step4Errors.needExpectation) setStep4Errors((prev) => { const { needExpectation, ...rest } = prev; return rest; }); }}
                      >
                        <SelectTrigger className={`flex-1 ${step4Errors.needExpectation ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select need/expectation")} />
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
                    {step4Errors.needExpectation && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{step4Errors.needExpectation}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={handleAddStakeholderNeed}
                  >
                    <Plus className="h-4 w-4 me-1.5" />
                    {t("Add Stakeholder")}
                  </Button>
                </div>

                {/* Stakeholder Needs and Exceptions Table */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Stakeholder Needs and Expectations")}</Label>
                  <div className="border rounded-lg min-h-[150px] mt-1.5 overflow-hidden overflow-x-auto">
                    {stakeholderNeeds.length > 0 ? (
                      <table className="w-full min-w-[400px]">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="text-left p-3 text-sm font-medium">{t("Stakeholder")}</th>
                            <th className="text-left p-3 text-sm font-medium">{t("Need/Expectation")}</th>
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
                        {t("No stakeholder needs added")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Preview & Save */}
            {currentStep === 5 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Preview & Save")}</h3>
                <div className="border border-slate-200 rounded-lg p-4 sm:p-6 space-y-4 bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Title")}</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.title || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Domain")}</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.domain}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Category")}</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Issue Type")}</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.issueType || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Department")}</p>
                      <p className="text-sm font-medium text-slate-800">
                        {departments.find((d) => d.id === newIssue.departmentId)?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Issue Owner")}</p>
                      <p className="text-sm font-medium text-slate-800">
                        {users.find((u) => u.id === newIssue.ownerId)?.fullName || "-"}
                      </p>
                    </div>
                  </div>
                  {newIssue.description && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Description")}</p>
                      <p className="text-sm font-medium text-slate-800">{newIssue.description}</p>
                    </div>
                  )}
                  {newIssue.selectedRegulations.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Related Regulations")}</p>
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
                      <p className="text-xs text-slate-500 mb-1">{t("Related Processes")}</p>
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
                      <p className="text-xs text-slate-500 mb-1">{t("Stakeholder Needs and Expectations")}</p>
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
        <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
          <span className="text-xs font-medium text-slate-400 me-auto">
            {t("Step")} {currentStep} {t("of")} 5
          </span>
          <Button
            variant="outline"
            size="sm"
            className="sm:size-default"
            onClick={() => {
              if (currentStep === 1) {
                setShowAddIssue(false);
                setCurrentStep(1);
                setIssueErrors({});
                setStep4Errors({});
              } else {
                setCurrentStep(currentStep - 1);
              }
            }}
          >
            {currentStep > 1 && <ChevronLeft className="h-4 w-4 me-1" />}
            {currentStep === 1 ? t("Cancel") : t("Previous")}
          </Button>
          <Button
            size="sm"
            className="sm:size-default"
            onClick={() => {
              if (currentStep === 5) {
                handleAddIssue();
              } else if (currentStep === 1) {
                const errors: Record<string, string> = {};
                if (!newIssue.domain) errors.domain = t("Please select Domain");
                if (!newIssue.category) errors.category = t("Please select Category");
                if (!newIssue.departmentId) errors.departmentId = t("Please select Department");
                if (!newIssue.ownerId) errors.ownerId = t("Please select Owner");
                if (!newIssue.issueType) errors.issueType = t("Please select Issue Type");
                if (Object.keys(errors).length > 0) {
                  setIssueErrors(errors);
                  return;
                }
                setIssueErrors({});
                setCurrentStep(2);
              } else if (currentStep === 2) {
                if (newIssue.selectedRegulations.length === 0) {
                  setIssueStepError(t("Please link a regulation for this Issue"));
                  return;
                }
                setCurrentStep(3);
              } else {
                setCurrentStep(currentStep + 1);
              }
            }}
          >
            {currentStep === 5 ? t("Save Issue") : t("Next")}
            {currentStep < 5 && <ChevronRight className="h-4 w-4 ms-1" />}
          </Button>
        </div>
      </DialogContent>

      {/* Issue Step Error Dialog */}
      <Dialog open={!!issueStepError} onOpenChange={(open) => { if (!open) setIssueStepError(""); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 [&>button.absolute]:hidden" nested>
          <DialogHeader className="sr-only">
            <DialogTitle>{t("Error")}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
            <span className="text-sm font-semibold text-primary-600">{t("Error")}</span>
            <button onClick={() => setIssueStepError("")} className="text-primary-600 hover:text-primary-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-6">
            <p className="text-sm text-slate-700">{issueStepError}</p>
          </div>
          <div className="flex justify-end px-5 py-3 border-t border-slate-200">
            <Button size="sm" onClick={() => setIssueStepError("")}>
              {t("OK")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Domain Dialog */}
        <Dialog open={showAddDomainDialog} onOpenChange={(open) => { if (!open) { setShowAddDomainDialog(false); setDomainError(""); } }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Domain")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Enter a name for the new domain.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">{t("Domain Name")} <span className="text-error">*</span></Label>
              <Input
                value={newDomain}
                onChange={(e) => { setNewDomain(e.target.value); if (domainError) setDomainError(""); }}
                placeholder={t("Enter domain name")}
                className={`mt-1.5 ${domainError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {domainError && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{domainError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddDomainDialog(false); setNewDomain(""); setDomainError(""); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddDomain}>
                {t("Add Domain")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Category Dialog */}
        <Dialog open={showAddCategoryDialog} onOpenChange={(open) => { if (!open) { setShowAddCategoryDialog(false); setCategoryError(""); } }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Category")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Enter a name for the new category.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">{t("Category Name")} <span className="text-error">*</span></Label>
              <Input
                value={newCategory}
                onChange={(e) => { setNewCategory(e.target.value); if (categoryError) setCategoryError(""); }}
                placeholder={t("Enter category name")}
                className={`mt-1.5 ${categoryError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {categoryError && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{categoryError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddCategoryDialog(false); setNewCategory(""); setCategoryError(""); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddCategory}>
                {t("Add Category")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Issue Type Dialog */}
        <Dialog open={showAddTypeDialog} onOpenChange={(open) => { if (!open) { setShowAddTypeDialog(false); setTypeError(""); } }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Issue Type")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Enter a name for the new issue type.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">{t("Issue Type Name")} <span className="text-error">*</span></Label>
              <Input
                value={newType}
                onChange={(e) => { setNewType(e.target.value); if (typeError) setTypeError(""); }}
                placeholder={t("Enter issue type name")}
                className={`mt-1.5 ${typeError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {typeError && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{typeError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddTypeDialog(false); setNewType(""); setTypeError(""); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddType}>
                {t("Add Type")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Choose Processes Dialog */}
        <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Link Process")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Select processes to link with this issue.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("Search processes...")}
                  value={processSearchQuery}
                  onChange={(e) => setProcessSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="border rounded-lg p-4 min-h-[200px]">
                {filteredProcesses.length > 0 ? (
                  <div className="space-y-1">
                    {filteredProcesses.map((process) => (
                      <label
                        key={process.id}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                          tempSelectedProcesses.includes(process.id)
                            ? "bg-primary-50"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <Checkbox
                          checked={tempSelectedProcesses.includes(process.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setTempSelectedProcesses([...tempSelectedProcesses, process.id]);
                            } else {
                              setTempSelectedProcesses(tempSelectedProcesses.filter((id) => id !== process.id));
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-700">
                            {process.processCode} : {process.name}
                          </span>
                          {process.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{process.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-sm text-slate-400">
                    {t("No processes found")}
                  </div>
                )}
              </div>
            </div>
            {/* Fixed Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleLinkProcesses}>
                {t("Link Process")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Need/Expectation Dialog */}
        <Dialog open={showAddNeedDialog} onOpenChange={setShowAddNeedDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0">
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Need/Expectation")}</DialogTitle>
                <DialogDescription>
                  {t("Enter a new need or expectation type.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label htmlFor="newNeedExpectation" className="text-sm font-medium text-slate-700">{t("Need/Expectation")} *</Label>
                <Input
                  id="newNeedExpectation"
                  value={newNeedExpectation}
                  onChange={(e) => setNewNeedExpectation(e.target.value)}
                  placeholder={t("Enter need/expectation")}
                  className="mt-1.5"
                />
              </div>
            </div>
            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddNeedDialog(false); setNewNeedExpectation(""); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddCustomNeedExpectation} disabled={!newNeedExpectation.trim()}>
                {t("Add")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </Dialog>
  );

  // Edit Issue Form (5-Step Wizard) - Rendered as Modal
  const renderEditIssueModal = () => (
    <Dialog open={isEditIssueOpen && !!editingIssue} onOpenChange={(open) => { if (!open) { setIsEditIssueOpen(false); setEditCurrentStep(1); setEditingIssue(null); } }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Edit Issue")}</DialogTitle>
          </DialogHeader>
        </div>

        {/* Step Progress */}
        <div className="flex-shrink-0 flex items-start justify-center py-3 sm:py-5 px-2 sm:px-6 border-b border-slate-100 overflow-x-auto">
          {ISSUE_STEP_KEYS.map((step, index) => (
            <div key={step.id} className="flex items-start">
              <div className="flex flex-col items-center w-14 sm:w-24">
                <div
                  className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors ${
                    editCurrentStep > step.id
                      ? "bg-success text-white"
                      : editCurrentStep === step.id
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}
                >
                  {editCurrentStep > step.id ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : step.id}
                </div>
                <span
                  className={`mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-center ${
                    editCurrentStep >= step.id ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {t(step.nameKey)}
                </span>
              </div>
              {index < ISSUE_STEP_KEYS.length - 1 && (
                <div
                  className={`w-4 sm:w-8 h-0.5 mt-[14px] sm:mt-[18px] -mx-1 sm:-mx-3 transition-colors ${
                    editCurrentStep > step.id ? "bg-success" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="space-y-5">
            {/* Step 1: Info */}
            {editCurrentStep === 1 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Basic Information")}</h3>
                {/* Issue Title - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Issue Title")} <span className="text-error">*</span></Label>
                  <Input
                    id="editIssueTitle"
                    value={editIssueForm.title}
                    onChange={(e) => setEditIssueForm({ ...editIssueForm, title: e.target.value })}
                    placeholder={t("Enter issue title")}
                    className="mt-1.5"
                  />
                </div>
                {/* Domain & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Domain")} <span className="text-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editIssueForm.domain}
                        onValueChange={(value) => setEditIssueForm({ ...editIssueForm, domain: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("Select domain")} />
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
                    <Label className="text-sm font-medium text-slate-700">{t("Category")} <span className="text-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editIssueForm.category}
                        onValueChange={(value) => setEditIssueForm({ ...editIssueForm, category: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("Select category")} />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                    <Select
                      value={editIssueForm.departmentId}
                      onValueChange={(value) => setEditIssueForm({ ...editIssueForm, departmentId: value, ownerId: "" })}
                    >
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue placeholder={t("Select department")} />
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
                    <Label className="text-sm font-medium text-slate-700">{t("Issue Owner")}</Label>
                    <Select
                      value={editIssueForm.ownerId}
                      onValueChange={(value) => setEditIssueForm({ ...editIssueForm, ownerId: value })}
                      disabled={!editIssueForm.departmentId}
                    >
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue placeholder={editIssueForm.departmentId ? t("Select owner") : t("Select department first")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users
                          .filter((user) =>
                            (!editIssueForm.departmentId || user.departmentId === editIssueForm.departmentId) &&
                            user.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer")
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
                  <Label className="text-sm font-medium text-slate-700">{t("Issue Type")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={editIssueForm.issueType}
                      onValueChange={(value) => setEditIssueForm({ ...editIssueForm, issueType: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select type")} />
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
                  <Label htmlFor="editIssueDescription" className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Textarea
                    id="editIssueDescription"
                    value={editIssueForm.description}
                    onChange={(e) => setEditIssueForm({ ...editIssueForm, description: e.target.value })}
                    placeholder={t("Enter issue description")}
                    className="min-h-[100px] mt-1.5"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Regulations */}
            {editCurrentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Related Regulations")}</h3>
                  <p className="text-slate-500 text-sm mt-1">{t("Select regulations related to this issue (optional)")}</p>
                </div>
                <div className="border rounded-lg p-4 min-h-[200px]">
                  {regulations.length > 0 ? (
                    <div className="space-y-1">
                      {regulations.map((reg) => (
                        <label key={reg.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                          <Checkbox
                            checked={editIssueForm.selectedRegulations.includes(reg.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
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
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-slate-700">{reg.name}</span>
                            {reg.version && <span className="text-slate-400 ms-2 text-xs">v{reg.version}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-sm text-slate-400 h-full">
                      {t("No regulations available")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Process */}
            {editCurrentStep === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Related Processes")}</h3>
                  <Button variant="outline" onClick={handleOpenEditProcessDialog}>
                    <Plus className="h-4 w-4 me-1.5" />
                    {t("Choose Processes")}
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
                      {t("No items found")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Stakeholder */}
            {editCurrentStep === 4 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Stakeholder Information")}</h3>
                {/* Stakeholder Type */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Stakeholder Type")}</Label>
                  <RadioGroup
                    value={editStakeholderType}
                    onValueChange={setEditStakeholderType}
                    className="flex gap-6 mt-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Internal" id="edit-st-internal" />
                      <Label htmlFor="edit-st-internal" className="font-normal">{t("Internal")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="External" id="edit-st-external" />
                      <Label htmlFor="edit-st-external" className="font-normal">{t("External")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Third Party" id="edit-st-thirdparty" />
                      <Label htmlFor="edit-st-thirdparty" className="font-normal">{t("Third Party")}</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Stakeholder Selection */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Stakeholder")}</Label>
                  <Select
                    value={editSelectedStakeholderId}
                    onValueChange={setEditSelectedStakeholderId}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder={t("Select stakeholder")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {filteredEditStakeholdersByType.length > 0 ? (
                        filteredEditStakeholdersByType.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-slate-500">{t("No")} {editStakeholderType} {t("stakeholders found")}</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Need and Expectation */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Need and Expectation")}</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editSelectedNeedExpectation}
                        onValueChange={setEditSelectedNeedExpectation}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t("Select need/expectation")} />
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
                    className="w-full sm:w-auto"
                    onClick={handleAddEditStakeholderNeed}
                    disabled={!editSelectedStakeholderId || !editSelectedNeedExpectation}
                  >
                    <Plus className="h-4 w-4 me-1.5" />
                    {t("Add Stakeholder")}
                  </Button>
                </div>

                {/* Stakeholder Needs and Exceptions Table */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Stakeholder Needs and Expectations")}</Label>
                  <div className="border rounded-lg min-h-[150px] mt-1.5 overflow-hidden overflow-x-auto">
                    {editStakeholderNeeds.length > 0 ? (
                      <table className="w-full min-w-[400px]">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="text-left p-3 text-sm font-medium">{t("Stakeholder")}</th>
                            <th className="text-left p-3 text-sm font-medium">{t("Need/Expectation")}</th>
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
                        {t("No stakeholder needs added")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Preview & Save */}
            {editCurrentStep === 5 && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Preview & Save")}</h3>
                <div className="border border-slate-200 rounded-lg p-4 sm:p-6 space-y-4 bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Title")}</p>
                      <p className="text-sm font-medium text-slate-800">{editIssueForm.title || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Domain")}</p>
                      <p className="text-sm font-medium text-slate-800">{editIssueForm.domain}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Category")}</p>
                      <p className="text-sm font-medium text-slate-800">{editIssueForm.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Issue Type")}</p>
                      <p className="text-sm font-medium text-slate-800">{editIssueForm.issueType || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Department")}</p>
                      <p className="text-sm font-medium text-slate-800">
                        {departments.find((d) => d.id === editIssueForm.departmentId)?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Issue Owner")}</p>
                      <p className="text-sm font-medium text-slate-800">
                        {users.find((u) => u.id === editIssueForm.ownerId)?.fullName || "-"}
                      </p>
                    </div>
                  </div>
                  {editIssueForm.description && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Description")}</p>
                      <p className="text-sm font-medium text-slate-800">{editIssueForm.description}</p>
                    </div>
                  )}
                  {editIssueForm.selectedRegulations.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{t("Related Regulations")}</p>
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
                      <p className="text-xs text-slate-500 mb-1">{t("Related Processes")}</p>
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
                      <p className="text-xs text-slate-500 mb-1">{t("Stakeholder Needs and Expectations")}</p>
                      <div className="mt-1 space-y-1">
                        {editStakeholderNeeds.map((item, index) => {
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
        <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
          <span className="text-xs font-medium text-slate-400 me-auto">
            {t("Step")} {editCurrentStep} {t("of")} 5
          </span>
          <Button
            variant="outline"
            size="sm"
            className="sm:size-default"
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
            {editCurrentStep > 1 && <ChevronLeft className="h-4 w-4 me-1" />}
            {editCurrentStep === 1 ? t("Cancel") : t("Previous")}
          </Button>
          <Button
            size="sm"
            className="sm:size-default"
            onClick={() => {
              if (editCurrentStep === 5) {
                handleUpdateIssue();
              } else {
                setEditCurrentStep(editCurrentStep + 1);
              }
            }}
          >
            {editCurrentStep === 5 ? t("Update Issue") : t("Next")}
            {editCurrentStep < 5 && <ChevronRight className="h-4 w-4 ms-1" />}
          </Button>
        </div>
      </DialogContent>

      {/* Add Domain Dialog */}
        <Dialog open={showAddDomainDialog} onOpenChange={(open) => { if (!open) { setShowAddDomainDialog(false); setDomainError(""); } }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Domain")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Enter a name for the new domain.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">{t("Domain Name")} <span className="text-error">*</span></Label>
              <Input
                id="editNewDomain"
                value={newDomain}
                onChange={(e) => { setNewDomain(e.target.value); if (domainError) setDomainError(""); }}
                placeholder={t("Enter domain name")}
                className={`mt-1.5 ${domainError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {domainError && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{domainError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddDomainDialog(false); setNewDomain(""); setDomainError(""); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={() => {
                if (!newDomain.trim()) { setDomainError(t("Please enter domain name")); return; }
                setDomainError("");
                if (!domains.includes(newDomain.trim())) {
                  setDomains([...domains, newDomain.trim()]);
                  setEditIssueForm({ ...editIssueForm, domain: newDomain.trim() });
                }
                setNewDomain("");
                setShowAddDomainDialog(false);
              }}>
                {t("Add Domain")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Category Dialog */}
        <Dialog open={showAddCategoryDialog} onOpenChange={(open) => { if (!open) { setShowAddCategoryDialog(false); setCategoryError(""); } }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Category")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Enter a name for the new category.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">{t("Category Name")} <span className="text-error">*</span></Label>
              <Input
                id="editNewCategory"
                value={newCategory}
                onChange={(e) => { setNewCategory(e.target.value); if (categoryError) setCategoryError(""); }}
                placeholder={t("Enter category name")}
                className={`mt-1.5 ${categoryError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {categoryError && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{categoryError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddCategoryDialog(false); setNewCategory(""); setCategoryError(""); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={() => {
                if (!newCategory.trim()) { setCategoryError(t("Please enter category name")); return; }
                setCategoryError("");
                if (!categories.includes(newCategory.trim())) {
                  setCategories([...categories, newCategory.trim()]);
                  setEditIssueForm({ ...editIssueForm, category: newCategory.trim() });
                }
                setNewCategory("");
                setShowAddCategoryDialog(false);
              }}>
                {t("Add Category")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Issue Type Dialog */}
        <Dialog open={showAddTypeDialog} onOpenChange={(open) => { if (!open) { setShowAddTypeDialog(false); setTypeError(""); } }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" nested>
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Issue Type")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Enter a name for the new issue type.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">{t("Issue Type Name")} <span className="text-error">*</span></Label>
              <Input
                id="editNewType"
                value={newType}
                onChange={(e) => { setNewType(e.target.value); if (typeError) setTypeError(""); }}
                placeholder={t("Enter issue type name")}
                className={`mt-1.5 ${typeError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {typeError && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{typeError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddTypeDialog(false); setNewType(""); setTypeError(""); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={() => {
                if (!newType.trim()) { setTypeError(t("Please enter issue type name")); return; }
                setTypeError("");
                if (!issueTypes.includes(newType.trim())) {
                  setIssueTypes([...issueTypes, newType.trim()]);
                  setEditIssueForm({ ...editIssueForm, issueType: newType.trim() });
                }
                setNewType("");
                setShowAddTypeDialog(false);
              }}>
                {t("Add Type")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Choose Processes Dialog for Edit */}
        <Dialog open={showEditProcessDialog} onOpenChange={setShowEditProcessDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Link Process")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Select processes to link with this issue.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("Search processes...")}
                  value={editProcessSearchQuery}
                  onChange={(e) => setEditProcessSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="border rounded-lg p-4 min-h-[200px]">
                {filteredEditProcesses.length > 0 ? (
                  <div className="space-y-1">
                    {filteredEditProcesses.map((process) => (
                      <label
                        key={process.id}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                          editTempSelectedProcesses.includes(process.id)
                            ? "bg-primary-50"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <Checkbox
                          checked={editTempSelectedProcesses.includes(process.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditTempSelectedProcesses([...editTempSelectedProcesses, process.id]);
                            } else {
                              setEditTempSelectedProcesses(editTempSelectedProcesses.filter((id) => id !== process.id));
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-700">
                            {process.processCode} : {process.name}
                          </span>
                          {process.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{process.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-sm text-slate-400">
                    {t("No processes found")}
                  </div>
                )}
              </div>
            </div>
            {/* Fixed Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setShowEditProcessDialog(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleLinkEditProcesses}>
                {t("Link Process")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Need/Expectation Dialog for Edit */}
        <Dialog open={showAddNeedDialog} onOpenChange={setShowAddNeedDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Need/Expectation")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Enter a new need or expectation type.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label htmlFor="editNewNeedExpectation" className="text-sm font-medium text-slate-700">{t("Need/Expectation")} *</Label>
                <Input
                  id="editNewNeedExpectation"
                  value={newNeedExpectation}
                  onChange={(e) => setNewNeedExpectation(e.target.value)}
                  placeholder={t("Enter need/expectation")}
                  className="mt-1.5"
                />
              </div>
            </div>
            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setShowAddNeedDialog(false); setNewNeedExpectation(""); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddCustomNeedExpectation} disabled={!newNeedExpectation.trim()}>
                {t("Add")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </Dialog>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto">
        <div className="flex items-center gap-1.5 text-slate-500 whitespace-nowrap">
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors whitespace-nowrap">
          {t("Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <span className="text-primary-700 font-medium whitespace-nowrap">{t("Context")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Context")}</h1>
      </div>

      {/* DepartmentContributor: Show Stakeholder without tabs */}
      {isDepartmentContributor ? (
        <>
          {filteredStakeholders.length > 0 || stakeholderSearch || stakeholderTypeFilter !== "all" || stakeholderStatusFilter !== "all" ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
                <div className="relative w-full sm:w-56">
                  <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("Search stakeholders...")}
                    value={stakeholderSearch}
                    onChange={(e) => { setStakeholderSearch(e.target.value); setStakeholderPage(1); }}
                    className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto ltr:sm:ml-auto rtl:sm:mr-auto">
                <Select value={stakeholderTypeFilter} onValueChange={(v) => { setStakeholderTypeFilter(v); setStakeholderPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Type")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Types")}</SelectItem>
                    <SelectItem value="Internal">{t("Internal")}</SelectItem>
                    <SelectItem value="External">{t("External")}</SelectItem>
                    <SelectItem value="Third Party">{t("Third Party")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stakeholderStatusFilter} onValueChange={(v) => { setStakeholderStatusFilter(v); setStakeholderPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Status")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Status")}</SelectItem>
                    <SelectItem value="Active">{t("Active")}</SelectItem>
                    <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                  </SelectContent>
                </Select>
                </div>
              </div>
              {/* Table with horizontal scroll on mobile */}
              <div className="overflow-x-auto">
              {/* Column Headers */}
              <div className="grid grid-cols-[1fr_120px_1fr_120px] gap-4 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[600px]">
                <span>{t("Name")}</span>
                <span>{t("Type")}</span>
                <span>{t("Department")}</span>
                <span>{t("Status")}</span>
              </div>
              {/* Rows */}
              {(() => {
                const paginated = filteredStakeholders.slice(
                  (stakeholderPage - 1) * ITEMS_PER_PAGE,
                  stakeholderPage * ITEMS_PER_PAGE
                );
                return (
                  <>
                    <div className="divide-y divide-slate-100">
                      {paginated.map((s) => (
                        <div key={s.id} className="grid grid-cols-[1fr_120px_1fr_120px] gap-4 px-3 sm:px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors min-w-[600px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                              <Users className="h-4 w-4 text-primary-500" />
                            </div>
                            <span className="text-sm font-medium text-slate-800 truncate">{s.name}</span>
                          </div>
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              s.type === "Internal" ? "bg-primary-50 text-primary-700"
                              : s.type === "External" ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                            }`}>
                              {t(s.type)}
                            </span>
                          </div>
                          <span className="text-sm text-slate-600 truncate">{s.department?.name || "-"}</span>
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              s.status === "Active" ? "bg-success-light text-success-dark" : "bg-slate-100 text-slate-600"
                            }`}>
                              {t(s.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {paginated.length === 0 && (
                        <div className="px-5 py-12 text-center text-sm text-slate-400">{t("No stakeholders match your search.")}</div>
                      )}
                    </div>
                    {/* Pagination */}
                    {filteredStakeholders.length > ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                        <span className="text-xs text-slate-500">
                          {(stakeholderPage - 1) * ITEMS_PER_PAGE + 1} {t("to")} {Math.min(stakeholderPage * ITEMS_PER_PAGE, filteredStakeholders.length)} {t("of")} {filteredStakeholders.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={stakeholderPage === 1} onClick={() => setStakeholderPage(stakeholderPage - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={stakeholderPage * ITEMS_PER_PAGE >= filteredStakeholders.length} onClick={() => setStakeholderPage(stakeholderPage + 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Stakeholders")}</h3>
              <p className="text-sm text-slate-500">{t("No stakeholders have been added yet.")}</p>
            </div>
          )}
        </>
      ) : (
        /* Other roles: Show normal tabs with Stakeholder and Issue List */
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="stakeholder">{t("Stakeholder")}</TabsTrigger>
            <TabsTrigger value="issuelist">{t("Issue List")}</TabsTrigger>
          </TabsList>

          {/* Stakeholder Tab */}
          <TabsContent value="stakeholder" className="mt-4 sm:mt-6">
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 mb-4">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExportStakeholders}>
                <Upload className="h-4 w-4 me-2" />
                {t("Export")}
              </Button>
              {!isReadOnlyRole && (
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowImportDialog(true)}>
                  <Download className="h-4 w-4 me-2" />
                  {t("Import")}
                </Button>
              )}
              {!isReadOnlyRole && (
                <Button size="sm" className="w-full sm:w-auto" onClick={() => { setStakeholderErrors({}); setNewStakeholder({ name: "", type: "Internal", status: "Active", departmentId: "" }); setShowAddStakeholder(true); }}>
                  <Plus className="h-4 w-4 me-2" />
                  {t("New Stakeholder")}
                </Button>
              )}
            </div>
            {stakeholders.length > 0 || stakeholderSearch || stakeholderTypeFilter !== "all" || stakeholderStatusFilter !== "all" ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t("Search stakeholders...")}
                      value={stakeholderSearch}
                      onChange={(e) => { setStakeholderSearch(e.target.value); setStakeholderPage(1); }}
                      className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto ltr:sm:ml-auto rtl:sm:mr-auto">
                  <Select value={stakeholderTypeFilter} onValueChange={(v) => { setStakeholderTypeFilter(v); setStakeholderPage(1); }}>
                    <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                      <SelectValue placeholder={t("Type")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">{t("All Types")}</SelectItem>
                      <SelectItem value="Internal">{t("Internal")}</SelectItem>
                      <SelectItem value="External">{t("External")}</SelectItem>
                      <SelectItem value="Third Party">{t("Third Party")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={stakeholderStatusFilter} onValueChange={(v) => { setStakeholderStatusFilter(v); setStakeholderPage(1); }}>
                    <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                      <SelectValue placeholder={t("Status")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">{t("All Status")}</SelectItem>
                      <SelectItem value="Active">{t("Active")}</SelectItem>
                      <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                  </div>
                </div>
                {/* Table with horizontal scroll on mobile */}
                <div className="overflow-x-auto">
                {/* Column Headers */}
                <div className={`grid ${!isReadOnlyRole ? "grid-cols-[1fr_120px_1fr_120px_72px]" : "grid-cols-[1fr_120px_1fr_120px]"} gap-4 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[600px]`}>
                  <span>{t("Name")}</span>
                  <span>{t("Type")}</span>
                  <span>{t("Department")}</span>
                  <span>{t("Status")}</span>
                  {!isReadOnlyRole && <span className="text-end">{t("Actions")}</span>}
                </div>
                {/* Rows */}
                {(() => {
                  const paginated = filteredStakeholders.slice(
                    (stakeholderPage - 1) * ITEMS_PER_PAGE,
                    stakeholderPage * ITEMS_PER_PAGE
                  );
                  return (
                    <>
                      <div className="divide-y divide-slate-100">
                        {paginated.map((s) => (
                          <div key={s.id} className={`grid ${!isReadOnlyRole ? "grid-cols-[1fr_120px_1fr_120px_72px]" : "grid-cols-[1fr_120px_1fr_120px]"} gap-4 px-3 sm:px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors min-w-[600px]`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                                <Users className="h-4 w-4 text-primary-500" />
                              </div>
                              <span className="text-sm font-medium text-slate-800 truncate">{s.name}</span>
                            </div>
                            <div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                s.type === "Internal" ? "bg-primary-50 text-primary-700"
                                : s.type === "External" ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                              }`}>
                                {t(s.type)}
                              </span>
                            </div>
                            <span className="text-sm text-slate-600 truncate">{s.department?.name || "-"}</span>
                            <div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                s.status === "Active" ? "bg-success-light text-success-dark" : "bg-slate-100 text-slate-600"
                              }`}>
                                {t(s.status)}
                              </span>
                            </div>
                            {!isReadOnlyRole && (
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => handleEditStakeholder(s)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50" onClick={() => { setDeletingItem({ type: "stakeholder", id: s.id }); setIsDeleteDialogOpen(true); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {paginated.length === 0 && (
                          <div className="px-5 py-12 text-center text-sm text-slate-400">{t("No stakeholders match your search.")}</div>
                        )}
                      </div>
                      {/* Pagination */}
                      {filteredStakeholders.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                          <span className="text-xs text-slate-500">
                            {(stakeholderPage - 1) * ITEMS_PER_PAGE + 1} {t("to")} {Math.min(stakeholderPage * ITEMS_PER_PAGE, filteredStakeholders.length)} {t("of")} {filteredStakeholders.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={stakeholderPage === 1} onClick={() => setStakeholderPage(stakeholderPage - 1)}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={stakeholderPage * ITEMS_PER_PAGE >= filteredStakeholders.length} onClick={() => setStakeholderPage(stakeholderPage + 1)}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-12 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-primary-500" />
                </div>
                <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Stakeholders")}</h3>
                <p className="text-sm text-slate-500 mb-6">{t("Add your first stakeholder to get started.")}</p>
                {!isReadOnlyRole && (
                  <Button size="sm" onClick={() => { setStakeholderErrors({}); setNewStakeholder({ name: "", type: "Internal", status: "Active", departmentId: "" }); setShowAddStakeholder(true); }}>
                    <Plus className="h-4 w-4 me-2" />
                    {t("New Stakeholder")}
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Issue List Tab */}
          <TabsContent value="issuelist" className="mt-4 sm:mt-6">
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 mb-4">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExportIssues}>
                <Upload className="h-4 w-4 me-2" />
                {t("Export")}
              </Button>
              {!isReadOnlyRole && (
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowImportDialog(true)}>
                  <Download className="h-4 w-4 me-2" />
                  {t("Import")}
                </Button>
              )}
              {!isReadOnlyRole && (
                <Button size="sm" className="w-full sm:w-auto" onClick={() => { setIssueErrors({}); setStep4Errors({}); setShowAddIssue(true); }}>
                  <Plus className="h-4 w-4 me-2" />
                  {t("Add Issue")}
                </Button>
              )}
            </div>
            {issues.length > 0 || issueSearch || issueDepartmentFilter !== "all" || issueCategoryFilter !== "all" || issueDomainFilter !== "all" ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t("Search issues...")}
                      value={issueSearch}
                      onChange={(e) => { setIssueSearch(e.target.value); setIssuePage(1); }}
                      className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto ltr:sm:ml-auto rtl:sm:mr-auto">
                  <Select value={issueDepartmentFilter} onValueChange={(v) => { setIssueDepartmentFilter(v); setIssuePage(1); }}>
                    <SelectTrigger className="w-[calc(50%-6px)] sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                      <SelectValue placeholder={t("Department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">{t("All Departments")}</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={issueCategoryFilter} onValueChange={(v) => { setIssueCategoryFilter(v); setIssuePage(1); }}>
                    <SelectTrigger className="w-[calc(50%-6px)] sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                      <SelectValue placeholder={t("Category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">{t("All Categories")}</SelectItem>
                      {uniqueCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={issueDomainFilter} onValueChange={(v) => { setIssueDomainFilter(v); setIssuePage(1); }}>
                    <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                      <SelectValue placeholder={t("Domain")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">{t("All Domains")}</SelectItem>
                      {uniqueDomains.map((domain) => (
                        <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </div>
                </div>
                {/* Table with horizontal scroll on mobile */}
                <div className="overflow-x-auto">
                {/* Column Headers */}
                <div className={`grid ${!isReadOnlyRole ? "grid-cols-[1.5fr_120px_100px_1fr_110px_72px]" : "grid-cols-[1.5fr_120px_100px_1fr_110px]"} gap-4 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[700px]`}>
                  <span>{t("Title")}</span>
                  <span>{t("Category")}</span>
                  <span>{t("Domain")}</span>
                  <span>{t("Department")}</span>
                  <span>{t("Status")}</span>
                  {!isReadOnlyRole && <span className="text-end">{t("Actions")}</span>}
                </div>
                {/* Rows */}
                {(() => {
                  const paginated = filteredIssues.slice(
                    (issuePage - 1) * ITEMS_PER_PAGE,
                    issuePage * ITEMS_PER_PAGE
                  );
                  return (
                    <>
                      <div className="divide-y divide-slate-100">
                        {paginated.map((issue) => (
                          <div key={issue.id}>
                            <div className={`grid ${!isReadOnlyRole ? "grid-cols-[1.5fr_120px_100px_1fr_110px_72px]" : "grid-cols-[1.5fr_120px_100px_1fr_110px]"} gap-4 px-3 sm:px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors min-w-[700px]`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                                  <AlertTriangle className="h-4 w-4 text-primary-500" />
                                </div>
                                <span className="text-sm font-medium text-slate-800 truncate">{issue.title}</span>
                              </div>
                              <span className="text-sm text-slate-600 truncate">{issue.category || "-"}</span>
                              <span className="text-sm text-slate-600 truncate">{issue.domain || "-"}</span>
                              <span className="text-sm text-slate-600 truncate">{issue.department?.name || "-"}</span>
                              <div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  issue.status === "Open" ? "bg-error-light text-error-dark"
                                  : issue.status === "In Progress" ? "bg-warning-light text-warning-dark"
                                  : issue.status === "Resolved" ? "bg-success-light text-success-dark"
                                  : "bg-slate-100 text-slate-600"
                                }`}>
                                  {t(issue.status)}
                                </span>
                              </div>
                              {!isReadOnlyRole && (
                                <div className="flex items-center justify-end gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => handleEditIssue(issue)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50" onClick={() => { setDeletingItem({ type: "issue", id: issue.id }); setIsDeleteDialogOpen(true); }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {/* Action Buttons Footer - Only show if there are actions or for readonly role */}
                            {(isReadOnlyRole || (isReviewerRole && issue.actions && issue.actions.length > 0)) && (
                              <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-50 bg-slate-50/30">
                                {isReadOnlyRole && (
                                  <>
                                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedIssueForAction(issue); setActionForm({ actionType: "", description: "", completion: 0, comment: "" }); setShowCreateActionDialog(true); }}>
                                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                                      {t("Create Action")}
                                    </Button>
                                    {issue.actions && issue.actions.length > 0 && (
                                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedIssueForAction(issue); setShowViewActionsDialog(true); }}>
                                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                                        {t("View Actions")} ({issue.actions.length})
                                      </Button>
                                    )}
                                  </>
                                )}
                                {isReviewerRole && issue.actions && issue.actions.length > 0 && (
                                  <Button variant="default" size="sm" className="text-xs h-7" onClick={() => {
                                    setSelectedIssueForAction(issue);
                                    const pendingAction = issue.actions?.find(a => a.status === "Pending");
                                    if (pendingAction) { setSelectedActionForReview(pendingAction); setShowActionReviewDialog(true); }
                                    else { setShowViewActionsDialog(true); }
                                  }}>
                                    {t("Review Actions")} ({issue.actions.filter(a => a.status === "Pending").length} {t("pending")})
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {paginated.length === 0 && (
                          <div className="px-5 py-12 text-center text-sm text-slate-400">{t("No issues match your search.")}</div>
                        )}
                      </div>
                      {/* Pagination */}
                      {filteredIssues.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                          <span className="text-xs text-slate-500">
                            {(issuePage - 1) * ITEMS_PER_PAGE + 1} {t("to")} {Math.min(issuePage * ITEMS_PER_PAGE, filteredIssues.length)} {t("of")} {filteredIssues.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={issuePage === 1} onClick={() => setIssuePage(issuePage - 1)}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={issuePage * ITEMS_PER_PAGE >= filteredIssues.length} onClick={() => setIssuePage(issuePage + 1)}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-12 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-6 w-6 text-primary-500" />
                </div>
                <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Issues Found")}</h3>
                <p className="text-sm text-slate-500 mb-6">{t("Create your first issue to get started.")}</p>
                {!isReadOnlyRole && (
                  <Button size="sm" onClick={() => { setIssueErrors({}); setStep4Errors({}); setShowAddIssue(true); }}>
                    <Plus className="h-4 w-4 me-2" />
                    {t("Add Issue")}
                  </Button>
                )}
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
      <Dialog open={showAddStakeholder} onOpenChange={(open) => { setShowAddStakeholder(open); if (!open) setStakeholderErrors({}); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Add Stakeholder")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Stakeholder Type")} <span className="text-error">*</span></Label>
                <RadioGroup
                  value={newStakeholder.type}
                  onValueChange={(value) => {
                    setNewStakeholder({ ...newStakeholder, type: value });
                    if (stakeholderErrors.type) setStakeholderErrors((prev) => { const { type, ...rest } = prev; return rest; });
                  }}
                  className="flex gap-6 mt-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Internal" id="add-internal" />
                    <Label htmlFor="add-internal" className="font-normal text-sm text-slate-600">{t("Internal")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="External" id="add-external" />
                    <Label htmlFor="add-external" className="font-normal text-sm text-slate-600">{t("External")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Third Party" id="add-thirdparty" />
                    <Label htmlFor="add-thirdparty" className="font-normal text-sm text-slate-600">{t("Third Party")}</Label>
                  </div>
                </RadioGroup>
                {stakeholderErrors.type && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{stakeholderErrors.type}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Stakeholder Name")} <span className="text-error">*</span></Label>
                <Input
                  value={newStakeholder.name}
                  onChange={(e) => {
                    setNewStakeholder({ ...newStakeholder, name: e.target.value });
                    if (stakeholderErrors.name) setStakeholderErrors((prev) => { const { name, ...rest } = prev; return rest; });
                  }}
                  placeholder={t("Enter stakeholder name")}
                  className={`mt-1.5 ${stakeholderErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {stakeholderErrors.name && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{stakeholderErrors.name}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                  <Select
                    value={newStakeholder.departmentId}
                    onValueChange={(value) => setNewStakeholder({ ...newStakeholder, departmentId: value })}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder={t("Select department")} />
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
                  <Label className="text-sm font-medium text-slate-700">{t("Status")} <span className="text-error">*</span></Label>
                  <Select
                    value={newStakeholder.status}
                    onValueChange={(value) => {
                      setNewStakeholder({ ...newStakeholder, status: value });
                      if (stakeholderErrors.status) setStakeholderErrors((prev) => { const { status, ...rest } = prev; return rest; });
                    }}
                  >
                    <SelectTrigger className={`w-full mt-1.5 ${stakeholderErrors.status ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select status")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Active">{t("Active")}</SelectItem>
                      <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {stakeholderErrors.status && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{stakeholderErrors.status}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setStakeholderErrors({}); setShowAddStakeholder(false); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddStakeholder}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Stakeholder Dialog */}
      <Dialog open={showEditStakeholder} onOpenChange={setShowEditStakeholder}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Edit Stakeholder")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Stakeholder Type")}</Label>
                <RadioGroup
                  value={editingStakeholder?.type || "Internal"}
                  onValueChange={(value) => setEditingStakeholder(editingStakeholder ? { ...editingStakeholder, type: value } : null)}
                  className="flex gap-6 mt-1.5"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Internal" id="edit-internal" />
                    <Label htmlFor="edit-internal" className="font-normal text-sm text-slate-600">{t("Internal")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="External" id="edit-external" />
                    <Label htmlFor="edit-external" className="font-normal text-sm text-slate-600">{t("External")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Third Party" id="edit-thirdparty" />
                    <Label htmlFor="edit-thirdparty" className="font-normal text-sm text-slate-600">{t("Third Party")}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Stakeholder Name")} <span className="text-error">*</span></Label>
                <Input
                  value={editingStakeholder?.name || ""}
                  onChange={(e) => setEditingStakeholder(editingStakeholder ? { ...editingStakeholder, name: e.target.value } : null)}
                  placeholder={t("Enter stakeholder name")}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                  <Select
                    value={editingStakeholder?.departmentId || ""}
                    onValueChange={(value) => setEditingStakeholder(editingStakeholder ? { ...editingStakeholder, departmentId: value } : null)}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder={t("Select department")} />
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
                  <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                  <Select
                    value={editingStakeholder?.status || "Active"}
                    onValueChange={(value) => setEditingStakeholder(editingStakeholder ? { ...editingStakeholder, status: value } : null)}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder={t("Select status")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Active">{t("Active")}</SelectItem>
                      <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setShowEditStakeholder(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleUpdateStakeholder}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t("Are you sure you want to delete this")} {deletingItem?.type}? {t("This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Domain Dialog */}
      <Dialog open={showAddDomainDialog} onOpenChange={(open) => { if (!open) { setShowAddDomainDialog(false); setDomainError(""); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" nested>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Domain")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t("Enter a name for the new domain.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6">
            <Label className="text-sm font-medium text-slate-700">{t("Domain Name")} <span className="text-error">*</span></Label>
            <Input
              value={newDomain}
              onChange={(e) => { setNewDomain(e.target.value); if (domainError) setDomainError(""); }}
              placeholder={t("Enter domain name")}
              className={`mt-1.5 ${domainError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {domainError && (
              <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-600">{domainError}</p>
              </div>
            )}
          </div>
          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setShowAddDomainDialog(false); setNewDomain(""); setDomainError(""); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddDomain}>
              {t("Add Domain")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={(open) => { if (!open) { setShowAddCategoryDialog(false); setCategoryError(""); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" nested>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Category")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t("Enter a name for the new category.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6">
            <Label className="text-sm font-medium text-slate-700">{t("Category Name")} <span className="text-error">*</span></Label>
            <Input
              value={newCategory}
              onChange={(e) => { setNewCategory(e.target.value); if (categoryError) setCategoryError(""); }}
              placeholder={t("Enter category name")}
              className={`mt-1.5 ${categoryError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {categoryError && (
              <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-600">{categoryError}</p>
              </div>
            )}
          </div>
          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setShowAddCategoryDialog(false); setNewCategory(""); setCategoryError(""); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddCategory}>
              {t("Add Category")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Issue Type Dialog */}
      <Dialog open={showAddTypeDialog} onOpenChange={(open) => { if (!open) { setShowAddTypeDialog(false); setTypeError(""); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" nested>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Issue Type")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t("Enter a name for the new issue type.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6">
            <Label className="text-sm font-medium text-slate-700">{t("Issue Type Name")} <span className="text-error">*</span></Label>
            <Input
              value={newType}
              onChange={(e) => { setNewType(e.target.value); if (typeError) setTypeError(""); }}
              placeholder={t("Enter issue type name")}
              className={`mt-1.5 ${typeError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {typeError && (
              <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-600">{typeError}</p>
              </div>
            )}
          </div>
          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setShowAddTypeDialog(false); setNewType(""); setTypeError(""); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddType}>
              {t("Add Type")}
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
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Action Details")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t("Create a new action for issue:")} {selectedIssueForAction?.title}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Action Type")} <span className="text-error">*</span></Label>
                <Select
                  value={actionForm.actionType}
                  onValueChange={(value) => setActionForm({ ...actionForm, actionType: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={t("Select action type")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="Preventive">{t("Preventive")}</SelectItem>
                    <SelectItem value="Corrective">{t("Corrective")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Description")} <span className="text-error">*</span></Label>
                <textarea
                  className="mt-1.5 flex min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  placeholder={t("Enter action description")}
                  value={actionForm.description}
                  onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Completion")} (%)</Label>
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
                <Label className="text-sm font-medium text-slate-700">{t("Comment")}</Label>
                <textarea
                  className="mt-1.5 flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  placeholder={t("Optional comment")}
                  value={actionForm.comment}
                  onChange={(e) => setActionForm({ ...actionForm, comment: e.target.value })}
                />
              </div>
              {/* File Upload Section */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Attachment")}</Label>
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
                        {t("Drag and drop a file here, or click to browse")}
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
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setShowCreateActionDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleCreateAction} disabled={savingAction || !actionForm.actionType || !actionForm.description}>
              {savingAction ? t("Submitting...") : t("Submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Actions Dialog (DeptReviewer) */}
      <Dialog open={showViewActionsDialog} onOpenChange={(open) => {
        setShowViewActionsDialog(open);
        if (!open) setSelectedIssueForAction(null);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Actions for Issue")}</DialogTitle>
              <DialogDescription>
                {selectedIssueForAction?.title}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            {selectedIssueForAction?.actions?.map((action) => (
              <Card key={action.id} className={`${action.status === "Sent Back" ? "border-warning" : action.status === "Resolved" ? "border-success" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Badge variant={action.status === "Resolved" ? "default" : action.status === "Sent Back" ? "destructive" : "secondary"}>
                        {t(action.status)}
                      </Badge>
                      <Badge variant="outline" className="ml-2">{t(action.actionType)}</Badge>
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
                          {t("Edit")}
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
                            <span className="text-sm text-slate-500">{t("Uploading...")}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-1">
                            <Upload className="h-4 w-4 text-slate-500" />
                            <span className="text-sm text-slate-500">{t("Drop file here or click to upload")}</span>
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
                            title={t("View")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title={t("Download")}
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
                              title={t("Delete")}
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
                    <span>{t("By")}: {action.createdBy.fullName}</span>
                    <span>{t("Completion")}: {action.completion}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!selectedIssueForAction?.actions || selectedIssueForAction.actions.length === 0) && (
              <p className="text-center text-slate-500 py-4">{t("No actions found")}</p>
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
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setShowViewActionsDialog(false)}>
              {t("Close")}
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
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Review Action")}</DialogTitle>
              <DialogDescription>
                {t("Review and take action on this submission")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          {selectedActionForReview && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
              <div className="space-y-2">
                <Label>{t("Action Type")}</Label>
                <p className="text-sm p-2 bg-muted rounded">{selectedActionForReview.actionType}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("Description")}</Label>
                <p className="text-sm p-2 bg-muted rounded whitespace-pre-wrap">{selectedActionForReview.description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("Completion")}</Label>
                  <p className="text-sm p-2 bg-muted rounded">{selectedActionForReview.completion}%</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("Created By")}</Label>
                  <p className="text-sm p-2 bg-muted rounded">{selectedActionForReview.createdBy.fullName}</p>
                </div>
              </div>
              {selectedActionForReview.comment && (
                <div className="space-y-2">
                  <Label>{t("Comment")}</Label>
                  <p className="text-sm p-2 bg-muted rounded whitespace-pre-wrap">{selectedActionForReview.comment}</p>
                </div>
              )}
              {/* Attachment Section - Only visible if file exists */}
              {selectedActionForReview.fileName && selectedActionForReview.filePath && (
                <div className="space-y-2">
                  <Label>{t("Attachment")}</Label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* File Type Icon */}
                      {selectedActionForReview.fileType?.match(/^(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                        <FileImage className="h-8 w-8 text-info shrink-0" />
                      ) : selectedActionForReview.fileType?.match(/^(xls|xlsx|csv)$/i) ? (
                        <FileSpreadsheet className="h-8 w-8 text-success shrink-0" />
                      ) : selectedActionForReview.fileType?.match(/^(doc|docx|txt|pdf)$/i) ? (
                        <FileText className="h-8 w-8 text-error shrink-0" />
                      ) : (
                        <File className="h-8 w-8 text-slate-500 shrink-0" />
                      )}
                      {/* File Name and Size */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[180px] sm:max-w-[250px]">
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
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(selectedActionForReview.filePath!, "_blank")}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {t("View")}
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
                          {t("Download")}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowActionReviewDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button
              variant="default"
              className="w-full sm:w-auto"
              onClick={() => selectedActionForReview && handleResolveAction(selectedActionForReview)}
              disabled={processingAction}
            >
              {processingAction ? t("Processing...") : t("Resolved")}
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => setShowResendDialog(true)}
              disabled={processingAction}
            >
              {t("Resend")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resend Comment Dialog (CustomerAdmin/Reviewer) */}
      <Dialog open={showResendDialog} onOpenChange={(open) => {
        setShowResendDialog(open);
        if (!open) setResendComment("");
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Send Back Action")}</DialogTitle>
              <DialogDescription>
                {t("Add a comment explaining why this action is being sent back")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label htmlFor="resendComment" className="text-sm font-medium text-slate-700">{t("Comment")} *</Label>
              <textarea
                id="resendComment"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1.5"
                placeholder={t("Enter your feedback...")}
                value={resendComment}
                onChange={(e) => setResendComment(e.target.value)}
              />
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setShowResendDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleResendAction} disabled={processingAction || !resendComment.trim()}>
              {processingAction ? t("Sending...") : t("Send Back")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Comments Dialog (DeptReviewer) */}
      <Dialog open={showActionCommentsDialog} onOpenChange={(open) => {
        setShowActionCommentsDialog(open);
        if (!open) setSelectedActionForComments(null);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Comments")}</DialogTitle>
              <DialogDescription>
                {t("Feedback from reviewer")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            {selectedActionForComments?.comments.map((comment) => (
              <Card key={comment.id}>
                <CardContent className="p-3">
                  <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>{t("By")}: {comment.createdBy}</span>
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!selectedActionForComments?.comments || selectedActionForComments.comments.length === 0) && (
              <p className="text-center text-slate-500 py-4">{t("No comments")}</p>
            )}
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setShowActionCommentsDialog(false)}>
              {t("Close")}
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
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Action")}</DialogTitle>
              <DialogDescription>
                {t("Update and resubmit this action")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label htmlFor="editActionType" className="text-sm font-medium text-slate-700">{t("Action Type")} *</Label>
              <Select
                value={editActionForm.actionType}
                onValueChange={(value) => setEditActionForm({ ...editActionForm, actionType: value })}
              >
                <SelectTrigger className="mt-1.5 bg-white">
                  <SelectValue placeholder={t("Select action type")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="Preventive">{t("Preventive")}</SelectItem>
                  <SelectItem value="Corrective">{t("Corrective")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editDescription" className="text-sm font-medium text-slate-700">{t("Description")} *</Label>
              <textarea
                id="editDescription"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1.5"
                placeholder={t("Enter action description")}
                value={editActionForm.description}
                onChange={(e) => setEditActionForm({ ...editActionForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="editCompletion" className="text-sm font-medium text-slate-700">{t("Completion")} (%)</Label>
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
              <Label htmlFor="editComment" className="text-sm font-medium text-slate-700">{t("Comment")}</Label>
              <textarea
                id="editComment"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1.5"
                placeholder={t("Optional comment")}
                value={editActionForm.comment}
                onChange={(e) => setEditActionForm({ ...editActionForm, comment: e.target.value })}
              />
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setShowEditActionDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleUpdateAction} disabled={savingAction || !editActionForm.actionType || !editActionForm.description}>
              {savingAction ? t("Saving...") : t("Save & Resubmit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog (context-aware) */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        setShowImportDialog(open);
        if (!open) {
          setImportFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {activeTab === "stakeholder" ? t("Import Stakeholders") : t("Import Issues")}
              </DialogTitle>
              <DialogDescription>
                {activeTab === "stakeholder"
                  ? t("Import stakeholders from a CSV file. The file should have columns: name (required), type, status.")
                  : t("Import issues from a CSV file. The file should have columns: title (required), description, domain, category, type.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")}</Label>
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
                  {t("Selected")}: {importFile.name}
                </p>
              )}
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex flex-col sm:flex-row justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t("Download Template")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 sm:flex-initial"
                onClick={() => {
                  setShowImportDialog(false);
                  setImportFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                {t("Cancel")}
              </Button>
              <Button className="flex-1 sm:flex-initial" onClick={handleImport} disabled={!importFile || importing}>
                {importing ? t("Importing...") : t("Import")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
