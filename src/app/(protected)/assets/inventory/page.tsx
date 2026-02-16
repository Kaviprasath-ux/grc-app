"use client";

import { useState, useEffect, useRef } from "react";
import { formatLocalDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, Upload, Download, Search, Package, Server, Monitor, Database, Users, Building, Wrench, Calendar, Home, ChevronRight, ChevronLeft, Eye } from "lucide-react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePermissions, useUserRoles } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { isValidName } from "@/lib/validations";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId: string | null;
}

interface AssetClassification {
  id: string;
  name: string;
  description: string | null;
}

interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
}

interface AssetSubCategory {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  category: AssetCategory;
}

interface AssetGroup {
  id: string;
  name: string;
  description: string | null;
  subCategoryId: string | null;
}

interface AssetSensitivity {
  id: string;
  name: string;
  description: string | null;
}

interface AssetLifecycleStatus {
  id: string;
  name: string;
  description: string | null;
  order: number;
}

interface Asset {
  id: string;
  assetId: string;
  name: string;
  description: string | null;
  assetType: string | null;
  categoryId: string | null;
  category: AssetCategory | null;
  subCategoryId: string | null;
  subCategory: AssetSubCategory | null;
  groupId: string | null;
  group: AssetGroup | null;
  departmentId: string | null;
  department: Department | null;
  ownerId: string | null;
  owner: User | null;
  custodianId: string | null;
  custodian: User | null;
  classificationId: string | null;
  classification: AssetClassification | null;
  sensitivityId: string | null;
  sensitivity: AssetSensitivity | null;
  lifecycleStatusId: string | null;
  lifecycleStatus: AssetLifecycleStatus | null;
  status: string;
  value: number | null;
  location: string | null;
  acquisitionDate: string | null;
  nextReviewDate: string | null;
}

const assetTypes = ["Hardware", "Software", "Information", "People", "Services", "Facility"];

const getAssetTypeIcon = (type: string | null) => {
  switch (type) {
    case "Hardware":
      return <Server className="h-4 w-4" />;
    case "Software":
      return <Monitor className="h-4 w-4" />;
    case "Information":
      return <Database className="h-4 w-4" />;
    case "People":
      return <Users className="h-4 w-4" />;
    case "Facility":
      return <Building className="h-4 w-4" />;
    case "Services":
      return <Wrench className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
};

const getClassificationColor = (classification: string | null) => {
  switch (classification) {
    case "Critical":
      return "destructive";
    case "High":
      return "default";
    case "Medium":
      return "secondary";
    case "Low":
      return "outline";
    default:
      return "outline";
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString();
};

const ITEMS_PER_PAGE = 10;

export default function AssetInventoryPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('asset.inventory');
  const { t } = useLanguage();

  // Check if user is DepartmentReviewer or DepartmentContributor (department-scoped)
  const isDepartmentRole = userRoles.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  );
  const userDepartmentId = session?.user?.departmentId;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [classifications, setClassifications] = useState<AssetClassification[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [subCategories, setSubCategories] = useState<AssetSubCategory[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [sensitivities, setSensitivities] = useState<AssetSensitivity[]>([]);
  const [lifecycleStatuses, setLifecycleStatuses] = useState<AssetLifecycleStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  // Import dialog states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline add dialog states
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddSubCategoryOpen, setIsAddSubCategoryOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isAddLifecycleOpen, setIsAddLifecycleOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubCategoryName, setNewSubCategoryName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newLifecycleName, setNewLifecycleName] = useState("");

  // Form state (matching UAT fields - no description field)
  const [newAsset, setNewAsset] = useState({
    assetId: "",
    name: "",
    assetType: "",
    categoryId: "",
    subCategoryId: "",
    groupId: "",
    departmentId: "",
    ownerId: "",
    custodianId: "",
    classificationId: "",
    sensitivityId: "",
    lifecycleStatusId: "",
    status: "Active",
    value: "",
    location: "",
    acquisitionDate: "",
    nextReviewDate: "",
  });

  // Field errors state for inline validation
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Filtered subcategories based on selected category
  const filteredSubCategories = subCategories.filter(
    (sc) => !newAsset.categoryId || sc.categoryId === newAsset.categoryId
  );

  const editFilteredSubCategories = subCategories.filter(
    (sc) => !editingAsset?.categoryId || sc.categoryId === editingAsset?.categoryId
  );

  // Filtered groups based on selected sub-category
  const filteredGroups = groups.filter(
    (g) => !newAsset.subCategoryId || g.subCategoryId === newAsset.subCategoryId
  );

  const editFilteredGroups = groups.filter(
    (g) => !editingAsset?.subCategoryId || g.subCategoryId === editingAsset?.subCategoryId
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        assetRes,
        deptRes,
        userRes,
        classRes,
        catRes,
        subCatRes,
        groupRes,
        sensRes,
        lifecycleRes,
      ] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/asset-classifications"),
        fetch("/api/asset-categories"),
        fetch("/api/asset-sub-categories"),
        fetch("/api/asset-groups"),
        fetch("/api/asset-sensitivities"),
        fetch("/api/asset-lifecycle-statuses"),
      ]);

      if (assetRes.ok) setAssets(await assetRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (classRes.ok) setClassifications(await classRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (subCatRes.ok) setSubCategories(await subCatRes.json());
      if (groupRes.ok) setGroups(await groupRes.json());
      if (sensRes.ok) setSensitivities(await sensRes.json());
      if (lifecycleRes.ok) setLifecycleStatuses(await lifecycleRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Filter assets
  const filteredAssets = assets.filter((a) => {
    // Department-scoped filtering for DepartmentReviewer/DepartmentContributor
    if (isDepartmentRole && userDepartmentId && a.departmentId !== userDepartmentId) {
      return false;
    }
    const matchesSearch =
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.owner?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (a.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (a.subCategory?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (a.group?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesCategory = categoryFilter === "all" || a.categoryId === categoryFilter;
    const matchesDepartment = departmentFilter === "all" || a.departmentId === departmentFilter;
    const matchesLifecycle = lifecycleFilter === "all" || a.lifecycleStatusId === lifecycleFilter;
    return matchesSearch && matchesCategory && matchesDepartment && matchesLifecycle;
  });

  // Pagination
  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAssets = filteredAssets.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const startItem = filteredAssets.length > 0 ? startIndex + 1 : 0;
  const endItem = Math.min(startIndex + ITEMS_PER_PAGE, filteredAssets.length);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, departmentFilter, lifecycleFilter]);

  // Generate next asset ID (ASSET prefix format matching UAT)
  const generateAssetId = () => {
    const maxId = assets.reduce((max, asset) => {
      const match = asset.assetId.match(/ASSET(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      // Legacy format support
      const legacyMatch = asset.assetId.match(/AST-(\d+)/);
      if (legacyMatch) {
        const num = parseInt(legacyMatch[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    return `ASSET${String(maxId + 1).padStart(4, "0")}`;
  };

  // Filter users by department for Asset Owner dropdown
  const filteredOwners = newAsset.departmentId
    ? users.filter((u: any) => u.departmentId === newAsset.departmentId)
    : [];

  const editFilteredOwners = editingAsset?.departmentId
    ? users.filter((u: any) => u.departmentId === editingAsset.departmentId)
    : [];

  // Asset CRUD
  const handleAddAsset = async () => {
    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation: Asset ID
    if (!newAsset.assetId.trim()) {
      errors.assetId = t("Asset ID is required");
    }

    // Validation: Asset Name
    if (!newAsset.name.trim()) {
      errors.name = t("Asset name is required");
    } else if (!isValidName(newAsset.name.trim())) {
      errors.name = t("Only letters, numbers, spaces, and hyphens are allowed");
    }

    // Validation: Department
    if (!newAsset.departmentId) {
      errors.departmentId = t("Please select the department");
    }

    // Validation: Asset Owner
    if (!newAsset.ownerId) {
      errors.ownerId = t("Please select the asset owner");
    }

    // Validation: Asset Category
    if (!newAsset.categoryId) {
      errors.categoryId = t("Please select the asset category");
    }

    // Validation: Asset Sub Category
    if (!newAsset.subCategoryId) {
      errors.subCategoryId = t("Please select the asset sub category");
    }

    // Validation: Asset Group
    if (!newAsset.groupId) {
      errors.groupId = t("Please select the asset group");
    }

    // Validation: Asset Custodian
    if (!newAsset.custodianId) {
      errors.custodianId = t("Please select the asset custodian");
    }

    // Validation: Asset Location
    if (!newAsset.location || !newAsset.location.trim()) {
      errors.location = t("Please enter the asset location");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAsset,
          categoryId: newAsset.categoryId || null,
          subCategoryId: newAsset.subCategoryId || null,
          groupId: newAsset.groupId || null,
          departmentId: newAsset.departmentId || null,
          ownerId: newAsset.ownerId || null,
          custodianId: newAsset.custodianId || null,
          classificationId: newAsset.classificationId || null,
          sensitivityId: newAsset.sensitivityId || null,
          lifecycleStatusId: newAsset.lifecycleStatusId || null,
          acquisitionDate: newAsset.acquisitionDate || null,
          nextReviewDate: newAsset.nextReviewDate || null,
        }),
      });
      if (res.ok) {
        const asset = await res.json();
        setAssets([...assets, asset]);
        resetForm();
        setIsAddAssetOpen(false);
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to create asset", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding asset:", error);
    }
  };

  const handleEditAsset = async () => {
    if (!editingAsset) return;

    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation: Asset ID
    if (!editingAsset.assetId.trim()) {
      errors.assetId = t("Asset ID is required");
    }

    // Validation: Asset Name
    if (!editingAsset.name.trim()) {
      errors.name = t("Asset name is required");
    } else if (!isValidName(editingAsset.name.trim())) {
      errors.name = t("Only letters, numbers, spaces, and hyphens are allowed");
    }

    // Validation: Department
    if (!editingAsset.departmentId) {
      errors.departmentId = t("Please select the department");
    }

    // Validation: Asset Owner
    if (!editingAsset.ownerId) {
      errors.ownerId = t("Please select the asset owner");
    }

    // Validation: Asset Category
    if (!editingAsset.categoryId) {
      errors.categoryId = t("Please select the asset category");
    }

    // Validation: Asset Sub Category
    if (!editingAsset.subCategoryId) {
      errors.subCategoryId = t("Please select the asset sub category");
    }

    // Validation: Asset Group
    if (!editingAsset.groupId) {
      errors.groupId = t("Please select the asset group");
    }

    // Validation: Asset Custodian
    if (!editingAsset.custodianId) {
      errors.custodianId = t("Please select the asset custodian");
    }

    // Validation: Asset Location
    if (!editingAsset.location || !editingAsset.location.trim()) {
      errors.location = t("Please enter the asset location");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});

    try {
      const res = await fetch(`/api/assets/${editingAsset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingAsset,
          acquisitionDate: editingAsset.acquisitionDate || null,
          nextReviewDate: editingAsset.nextReviewDate || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAssets(assets.map((a) => (a.id === updated.id ? updated : a)));
        setIsEditAssetOpen(false);
        setEditingAsset(null);
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to update asset", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating asset:", error);
    }
  };

  const handleDeleteAsset = async () => {
    if (!deletingAssetId) return;
    try {
      const res = await fetch(`/api/assets/${deletingAssetId}`, { method: "DELETE" });
      if (res.ok) {
        setAssets(assets.filter((a) => a.id !== deletingAssetId));
      }
    } catch (error) {
      console.error("Error deleting asset:", error);
    }
    setIsDeleteDialogOpen(false);
    setDeletingAssetId(null);
  };

  const resetForm = () => {
    setNewAsset({
      assetId: "",
      name: "",
      assetType: "",
      categoryId: "",
      subCategoryId: "",
      groupId: "",
      departmentId: "",
      ownerId: "",
      custodianId: "",
      classificationId: "",
      sensitivityId: "",
      lifecycleStatusId: "",
      status: "Active",
      value: "",
      location: "",
      acquisitionDate: "",
      nextReviewDate: "",
    });
    setFieldErrors({});
  };

  // Inline add handlers for Category, Sub Category, Group, Lifecycle Status
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/asset-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim(), status: "Active" }),
      });
      if (res.ok) {
        const cat = await res.json();
        setCategories([...categories, cat]);
        setNewAsset({ ...newAsset, categoryId: cat.id });
        setNewCategoryName("");
        setIsAddCategoryOpen(false);
      }
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleAddSubCategory = async () => {
    if (!newSubCategoryName.trim() || !newAsset.categoryId) return;
    try {
      const res = await fetch("/api/asset-sub-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubCategoryName.trim(),
          categoryId: newAsset.categoryId,
          status: "Active",
        }),
      });
      if (res.ok) {
        const subCat = await res.json();
        setSubCategories([...subCategories, subCat]);
        setNewAsset({ ...newAsset, subCategoryId: subCat.id });
        setNewSubCategoryName("");
        setIsAddSubCategoryOpen(false);
      }
    } catch (error) {
      console.error("Error adding sub category:", error);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const res = await fetch("/api/asset-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim(), status: "Active" }),
      });
      if (res.ok) {
        const group = await res.json();
        setGroups([...groups, group]);
        setNewAsset({ ...newAsset, groupId: group.id });
        setNewGroupName("");
        setIsAddGroupOpen(false);
      }
    } catch (error) {
      console.error("Error adding group:", error);
    }
  };

  const handleAddLifecycle = async () => {
    if (!newLifecycleName.trim()) return;
    try {
      const res = await fetch("/api/asset-lifecycle-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLifecycleName.trim() }),
      });
      if (res.ok) {
        const lifecycle = await res.json();
        setLifecycleStatuses([...lifecycleStatuses, lifecycle]);
        setNewAsset({ ...newAsset, lifecycleStatusId: lifecycle.id });
        setNewLifecycleName("");
        setIsAddLifecycleOpen(false);
      }
    } catch (error) {
      console.error("Error adding lifecycle status:", error);
    }
  };

  // Import/Export handlers
  const handleExport = () => {
    // Create CSV content
    const headers = ["Asset ID", "Asset Name", "Asset Owner", "Asset Category", "Asset Sub Category", "Group", "Department", "Custodian", "Lifecycle Status", "Location", "Acquisition Date", "Next Review Date"];
    const rows = filteredAssets.map(asset => [
      asset.assetId,
      asset.name,
      asset.owner?.fullName || "",
      asset.category?.name || "",
      asset.subCategory?.name || "",
      asset.group?.name || "",
      asset.department?.name || "",
      asset.custodian?.fullName || "",
      asset.lifecycleStatus?.name || "",
      asset.location || "",
      asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString() : "",
      asset.nextReviewDate ? new Date(asset.nextReviewDate).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `assets_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const templateCsv = [
      [
        "Asset ID",
        "Asset Name",
        "Asset Type",
        "Department",
        "Owner",
        "Custodian",
        "Category",
        "Sub Category",
        "Group",
        "Location",
        "Acquisition Date",
        "Next Review Date",
      ],
      [
        "ASSET0001",
        "Example Asset",
        "Hardware",
        "IT Department",
        "John Doe",
        "Jane Smith",
        "IT Assets",
        "Servers",
        "Data Center",
        "Building A, Floor 2",
        "2025-01-15",
        "2026-01-15",
      ],
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([templateCsv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assets_template.csv";
    a.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const parseFileToRows = async (file: File): Promise<string[][]> => {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (isExcel) {
      // Parse Excel file using xlsx library
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return [];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
      }) as (string | number | null)[][];
      // Convert all values to strings
      return jsonData
        .filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
        .map((row) => row.map((cell) => String(cell ?? "").trim()));
    } else {
      // Parse CSV file
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      return lines.map((line) => {
        const matches = line.match(/("([^"]*)"|[^,]+)/g) || [];
        return matches.map((v) => v.replace(/^"|"$/g, "").trim());
      });
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const rows = await parseFileToRows(importFile);

      if (rows.length < 2) {
        toast({ title: "Error", description: "Invalid file: No data rows found", variant: "destructive" });
        setImporting(false);
        return;
      }

      // First row is header, rest is data
      const dataRows = rows.slice(1);
      let successCount = 0;
      let errorCount = 0;

      for (const values of dataRows) {
        if (values.length >= 2) {
          const [
            assetId,
            name,
            assetType,
            departmentName,
            ownerName,
            custodianName,
            categoryName,
            subCategoryName,
            groupName,
            location,
            acquisitionDate,
            nextReviewDate,
          ] = values;

          if (!assetId || !name) continue;

          // Check if asset already exists
          const existing = assets.find((a) => a.assetId === assetId);
          if (existing) continue;

          // Lookup IDs by name
          const department = departments.find(
            (d) => d.name.toLowerCase() === departmentName?.toLowerCase()
          );
          const owner = users.find(
            (u) => u.fullName?.toLowerCase() === ownerName?.toLowerCase()
          );
          const custodian = users.find(
            (u) => u.fullName?.toLowerCase() === custodianName?.toLowerCase()
          );
          const category = categories.find(
            (c) => c.name.toLowerCase() === categoryName?.toLowerCase()
          );
          const subCategory = subCategories.find(
            (sc) => sc.name.toLowerCase() === subCategoryName?.toLowerCase()
          );
          const group = groups.find(
            (g) => g.name.toLowerCase() === groupName?.toLowerCase()
          );

          try {
            const res = await fetch("/api/assets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                assetId,
                name,
                assetType: assetType || null,
                departmentId: department?.id || null,
                ownerId: owner?.id || null,
                custodianId: custodian?.id || null,
                categoryId: category?.id || null,
                subCategoryId: subCategory?.id || null,
                groupId: group?.id || null,
                location: location || null,
                acquisitionDate: acquisitionDate || null,
                nextReviewDate: nextReviewDate || null,
                status: "Active",
              }),
            });

            if (res.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch {
            errorCount++;
          }
        }
      }

      toast({
        title: "Success",
        description: `Import completed: ${successCount} assets imported, ${errorCount} errors`,
      });
      setIsImportDialogOpen(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchData();
    } catch (error) {
      console.error("Error importing assets:", error);
      toast({
        title: "Error",
        description: "Failed to import assets. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Stats
  const stats = {
    total: assets.length,
    active: assets.filter((a) => a.status === "Active").length,
    critical: assets.filter((a) => a.classification?.name === "Critical").length,
    needsReview: assets.filter((a) => !a.classificationId).length,
  };

  // Show loading state while permissions or data is being fetched
  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading assets...")}</p>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Asset Inventory.")} />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500 ">
          <Home className="h-4 w-4" />
          <span>{t("Asset Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Inventory")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Asset Inventory")}</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">
            {stats.total}
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Total Assets")}</span>
          </div>
        </div>
        <div className="relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Server className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">
            {stats.active}
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Active Assets")}</span>
          </div>
        </div>
        <div className="relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Database className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">
            {stats.critical}
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Critical Assets")}</span>
          </div>
        </div>
        <div className="relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">
            {stats.needsReview}
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Needs Review")}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons - Above Card */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Export")}
        </Button>
        <PermissionGate resource="asset.inventory" action="create">
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Import")}
          </Button>
        </PermissionGate>
        
        <PermissionGate resource="asset.inventory" action="create">
          <Button size="sm" onClick={() => {
            setNewAsset({ ...newAsset, assetId: generateAssetId() });
            setIsAddAssetOpen(true);
          }}>
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Add Asset")}
          </Button>
        </PermissionGate>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search assets...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <div className="ltr:ml-auto rtl:mr-auto flex items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("All Categories")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">{t("All Categories")}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("All Departments")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">{t("All Departments")}</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("All Status")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">{t("All Status")}</SelectItem>
                {lifecycleStatuses.map((ls) => (
                  <SelectItem key={ls.id} value={ls.id}>
                    {ls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Asset ID")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Asset Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Asset Owner")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Asset Category")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Asset Sub Category")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Group")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAssets.map((asset) => (
              <TableRow
                key={asset.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
              >
                <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800 font-mono">{asset.assetId}</TableCell>
                <TableCell className="py-3.5 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{getAssetTypeIcon(asset.assetType)}</span>
                    <span className="font-medium">{asset.name}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3.5 text-sm text-slate-600">{asset.owner?.fullName || "-"}</TableCell>
                <TableCell className="py-3.5 text-sm text-slate-600">{asset.category?.name || "-"}</TableCell>
                <TableCell className="py-3.5 text-sm text-slate-600">{asset.subCategory?.name || "-"}</TableCell>
                <TableCell className="py-3.5 text-sm text-slate-600">{asset.group?.name || "-"}</TableCell>
                <TableCell className="py-3.5 pe-5">
                  <div className="flex items-center gap-0.5">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => {
                          setEditingAsset({
                            ...asset,
                            acquisitionDate: asset.acquisitionDate
                              ? formatLocalDate(new Date(asset.acquisitionDate))
                              : null,
                            nextReviewDate: asset.nextReviewDate
                              ? formatLocalDate(new Date(asset.nextReviewDate))
                              : null,
                          });
                          setFieldErrors({});
                          setIsEditAssetOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                        onClick={() => {
                          setDeletingAssetId(asset.id);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredAssets.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                      <Package className="h-6 w-6 text-primary-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-1">{t("No assets found")}</p>
                    <p className="text-xs text-slate-400">{t("Create a new asset to get started")}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {filteredAssets.length > 0
              ? `${t("Showing")} ${startItem} ${t("to")} ${endItem} ${t("of")} ${filteredAssets.length}`
              : t("No assets")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Add Asset Dialog */}
      <Dialog open={isAddAssetOpen} onOpenChange={setIsAddAssetOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Add New Asset")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              {/* Asset Name - Full Width */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Asset Name")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={newAsset.name}
                  onChange={(e) => {
                    setNewAsset({ ...newAsset, name: e.target.value });
                    if (fieldErrors.name) {
                      setFieldErrors({ ...fieldErrors, name: "" });
                    }
                  }}
                  placeholder={t("Enter Asset Name")}
                  className={`mt-1.5 ${fieldErrors.name ? "border-red-500" : ""}`}
                />
                {fieldErrors.name && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>
                )}
              </div>

              {/* Asset ID - Full Width */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Asset ID")} <span className="text-semantic-error">*</span></Label>
                <Input
                  value={newAsset.assetId}
                  disabled
                  className={`mt-1.5 bg-muted ${fieldErrors.assetId ? "border-red-500" : ""}`}
                />
                {fieldErrors.assetId && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.assetId}</p>
                )}
              </div>

              {/* Department - Full Width */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Department")} <span className="text-semantic-error">*</span></Label>
                <Select
                  value={newAsset.departmentId}
                  onValueChange={(value) => {
                    setNewAsset({ ...newAsset, departmentId: value, ownerId: "" });
                    if (fieldErrors.departmentId) {
                      setFieldErrors({ ...fieldErrors, departmentId: "" });
                    }
                  }}
                >
                  <SelectTrigger className={`mt-1.5 w-full ${fieldErrors.departmentId ? "border-red-500" : ""}`}>
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
                {fieldErrors.departmentId && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.departmentId}</p>
                )}
              </div>

              {/* Asset Owner - Full Width */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Asset Owner")} <span className="text-semantic-error">*</span></Label>
                <Select
                  value={newAsset.ownerId}
                  onValueChange={(value) => {
                    setNewAsset({ ...newAsset, ownerId: value });
                    if (fieldErrors.ownerId) {
                      setFieldErrors({ ...fieldErrors, ownerId: "" });
                    }
                  }}
                  disabled={!newAsset.departmentId}
                >
                  <SelectTrigger className={`mt-1.5 w-full ${!newAsset.departmentId ? "bg-muted" : ""} ${fieldErrors.ownerId ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={newAsset.departmentId ? t("Select Asset Owner") : t("Select Department first")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {filteredOwners.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.ownerId && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.ownerId}</p>
                )}
              </div>

              {/* Category & Sub Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Category")} <span className="text-semantic-error">*</span></Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={newAsset.categoryId}
                      onValueChange={(value) => {
                        setNewAsset({ ...newAsset, categoryId: value, subCategoryId: "" });
                        if (fieldErrors.categoryId) {
                          setFieldErrors({ ...fieldErrors, categoryId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`flex-1 ${fieldErrors.categoryId ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select Category")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsAddCategoryOpen(true)}
                      className="flex-shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {fieldErrors.categoryId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryId}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} <span className="text-semantic-error">*</span></Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={newAsset.subCategoryId}
                      onValueChange={(value) => {
                        setNewAsset({ ...newAsset, subCategoryId: value });
                        if (fieldErrors.subCategoryId) {
                          setFieldErrors({ ...fieldErrors, subCategoryId: "" });
                        }
                      }}
                      disabled={!newAsset.categoryId}
                    >
                      <SelectTrigger className={`flex-1 ${fieldErrors.subCategoryId ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select Sub Category")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {filteredSubCategories.map((sc) => (
                          <SelectItem key={sc.id} value={sc.id}>
                            {sc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsAddSubCategoryOpen(true)}
                      disabled={!newAsset.categoryId}
                      className="flex-shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {fieldErrors.subCategoryId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryId}</p>
                  )}
                </div>
              </div>

              {/* Group & Custodian */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Group")} <span className="text-semantic-error">*</span></Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={newAsset.groupId}
                      onValueChange={(value) => {
                        setNewAsset({ ...newAsset, groupId: value });
                        if (fieldErrors.groupId) {
                          setFieldErrors({ ...fieldErrors, groupId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`flex-1 ${fieldErrors.groupId ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select Asset Group")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {filteredGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsAddGroupOpen(true)}
                      className="flex-shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {fieldErrors.groupId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.groupId}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Custodian")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={newAsset.custodianId}
                    onValueChange={(value) => {
                      setNewAsset({ ...newAsset, custodianId: value });
                      if (fieldErrors.custodianId) {
                        setFieldErrors({ ...fieldErrors, custodianId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${fieldErrors.custodianId ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select Asset Custodian")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.custodianId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.custodianId}</p>
                  )}
                </div>
              </div>

              {/* Lifecycle Status & Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Lifecycle Status")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={newAsset.lifecycleStatusId}
                      onValueChange={(value) => setNewAsset({ ...newAsset, lifecycleStatusId: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("Select Status")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {lifecycleStatuses.map((ls) => (
                          <SelectItem key={ls.id} value={ls.id}>
                            {ls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsAddLifecycleOpen(true)}
                      className="flex-shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Location")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={newAsset.location}
                    onChange={(e) => {
                      setNewAsset({ ...newAsset, location: e.target.value });
                      if (fieldErrors.location) {
                        setFieldErrors({ ...fieldErrors, location: "" });
                      }
                    }}
                    placeholder={t("Enter Location")}
                    className={`mt-1.5 ${fieldErrors.location ? "border-red-500" : ""}`}
                  />
                  {fieldErrors.location && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.location}</p>
                  )}
                </div>
              </div>

              {/* Criticality & Sensitivity (Computed fields) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Criticality")}</Label>
                  <Input
                    value={t("N/A")}
                    disabled
                    className="mt-1.5 bg-muted"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sensitivity")}</Label>
                  <Input
                    value=""
                    disabled
                    className="mt-1.5 bg-muted"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Acquisition Date")}</Label>
                  <div className="mt-1.5">
                    <DatePicker
                      value={newAsset.acquisitionDate}
                      onChange={(date) => setNewAsset({ ...newAsset, acquisitionDate: date ? format(date, "yyyy-MM-dd") : "" })}
                      placeholder={t("Select Acquisition Date")}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Next Review Date")}</Label>
                  <div className="mt-1.5">
                    <DatePicker
                      value={newAsset.nextReviewDate}
                      onChange={(date) => setNewAsset({ ...newAsset, nextReviewDate: date ? format(date, "yyyy-MM-dd") : "" })}
                      placeholder={t("Select Review Date")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              resetForm();
              setIsAddAssetOpen(false);
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddAsset}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={isEditAssetOpen} onOpenChange={setIsEditAssetOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Asset")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          {editingAsset && (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                {/* Asset Name - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Name")} <span className="text-semantic-error">*</span></Label>
                  <Input
                    value={editingAsset.name}
                    onChange={(e) => {
                      setEditingAsset({ ...editingAsset, name: e.target.value });
                      if (fieldErrors.name) {
                        setFieldErrors({ ...fieldErrors, name: "" });
                      }
                    }}
                    className={`mt-1.5 ${fieldErrors.name ? "border-red-500" : ""}`}
                  />
                  {fieldErrors.name && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                {/* Asset ID - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset ID")}</Label>
                  <Input
                    value={editingAsset.assetId}
                    disabled
                    className="mt-1.5 bg-muted"
                  />
                </div>

                {/* Department - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={editingAsset.departmentId || ""}
                    onValueChange={(value) => {
                      setEditingAsset({ ...editingAsset, departmentId: value, ownerId: null });
                      if (fieldErrors.departmentId) {
                        setFieldErrors({ ...fieldErrors, departmentId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${fieldErrors.departmentId ? "border-red-500" : ""}`}>
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
                  {fieldErrors.departmentId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.departmentId}</p>
                  )}
                </div>

                {/* Asset Owner - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Owner")} <span className="text-semantic-error">*</span></Label>
                  <Select
                    value={editingAsset.ownerId || ""}
                    onValueChange={(value) => {
                      setEditingAsset({ ...editingAsset, ownerId: value });
                      if (fieldErrors.ownerId) {
                        setFieldErrors({ ...fieldErrors, ownerId: "" });
                      }
                    }}
                    disabled={!editingAsset.departmentId}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${!editingAsset.departmentId ? "bg-muted" : ""} ${fieldErrors.ownerId ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={editingAsset.departmentId ? t("Select Asset Owner") : t("Select Department first")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {editFilteredOwners.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.ownerId && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.ownerId}</p>
                  )}
                </div>

                {/* Category & Sub Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Category")} <span className="text-semantic-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editingAsset.categoryId || ""}
                        onValueChange={(value) => {
                          setEditingAsset({ ...editingAsset, categoryId: value, subCategoryId: null });
                          if (fieldErrors.categoryId) {
                            setFieldErrors({ ...fieldErrors, categoryId: "" });
                          }
                        }}
                      >
                        <SelectTrigger className={`flex-1 ${fieldErrors.categoryId ? "border-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select Category")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsAddCategoryOpen(true)}
                        className="flex-shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {fieldErrors.categoryId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryId}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} <span className="text-semantic-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editingAsset.subCategoryId || ""}
                        onValueChange={(value) => {
                          setEditingAsset({ ...editingAsset, subCategoryId: value });
                          if (fieldErrors.subCategoryId) {
                            setFieldErrors({ ...fieldErrors, subCategoryId: "" });
                          }
                        }}
                        disabled={!editingAsset.categoryId}
                      >
                        <SelectTrigger className={`flex-1 ${fieldErrors.subCategoryId ? "border-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select Sub Category")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {editFilteredSubCategories.map((sc) => (
                            <SelectItem key={sc.id} value={sc.id}>
                              {sc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsAddSubCategoryOpen(true)}
                        disabled={!editingAsset.categoryId}
                        className="flex-shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {fieldErrors.subCategoryId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.subCategoryId}</p>
                    )}
                  </div>
                </div>

                {/* Group & Custodian */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Group")} <span className="text-semantic-error">*</span></Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editingAsset.groupId || ""}
                        onValueChange={(value) => {
                          setEditingAsset({ ...editingAsset, groupId: value });
                          if (fieldErrors.groupId) {
                            setFieldErrors({ ...fieldErrors, groupId: "" });
                          }
                        }}
                      >
                        <SelectTrigger className={`flex-1 ${fieldErrors.groupId ? "border-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select Asset Group")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {editFilteredGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsAddGroupOpen(true)}
                        className="flex-shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {fieldErrors.groupId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.groupId}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Custodian")} <span className="text-semantic-error">*</span></Label>
                    <Select
                      value={editingAsset.custodianId || ""}
                      onValueChange={(value) => {
                        setEditingAsset({ ...editingAsset, custodianId: value });
                        if (fieldErrors.custodianId) {
                          setFieldErrors({ ...fieldErrors, custodianId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`mt-1.5 w-full ${fieldErrors.custodianId ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select Asset Custodian")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.custodianId && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.custodianId}</p>
                    )}
                  </div>
                </div>

                {/* Lifecycle Status & Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Lifecycle Status")}</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editingAsset.lifecycleStatusId || ""}
                        onValueChange={(value) => setEditingAsset({ ...editingAsset, lifecycleStatusId: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t("Select Status")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {lifecycleStatuses.map((ls) => (
                            <SelectItem key={ls.id} value={ls.id}>
                              {ls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsAddLifecycleOpen(true)}
                        className="flex-shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Location")} <span className="text-semantic-error">*</span></Label>
                    <Input
                      value={editingAsset.location || ""}
                      onChange={(e) => {
                        setEditingAsset({ ...editingAsset, location: e.target.value });
                        if (fieldErrors.location) {
                          setFieldErrors({ ...fieldErrors, location: "" });
                        }
                      }}
                      placeholder={t("Enter Location")}
                      className={`mt-1.5 ${fieldErrors.location ? "border-red-500" : ""}`}
                    />
                    {fieldErrors.location && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.location}</p>
                    )}
                  </div>
                </div>

                {/* Criticality & Sensitivity (Computed fields) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Criticality")}</Label>
                    <Input
                      value={t("N/A")}
                      disabled
                      className="mt-1.5 bg-muted"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Sensitivity")}</Label>
                    <Input
                      value=""
                      disabled
                      className="mt-1.5 bg-muted"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Acquisition Date")}</Label>
                    <div className="mt-1.5">
                      <DatePicker
                        value={editingAsset.acquisitionDate || ""}
                        onChange={(date) => setEditingAsset({ ...editingAsset, acquisitionDate: date ? format(date, "yyyy-MM-dd") : null })}
                        placeholder={t("Select Acquisition Date")}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Next Review Date")}</Label>
                    <div className="mt-1.5">
                      <DatePicker
                        value={editingAsset.nextReviewDate || ""}
                        onChange={(date) => setEditingAsset({ ...editingAsset, nextReviewDate: date ? format(date, "yyyy-MM-dd") : null })}
                        placeholder={t("Select Review Date")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsEditAssetOpen(false);
              setEditingAsset(null);
              setFieldErrors({});
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditAsset}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-slate-600">
              {t("Are you sure you want to delete this asset? This action cannot be undone.")}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAsset}>
              {t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Asset Category")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <Label className="text-sm font-medium text-slate-700">{t("Category Name")}</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t("Enter category name")}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setNewCategoryName("");
              setIsAddCategoryOpen(false);
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddCategory}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Add Sub Category Dialog */}
      <Dialog open={isAddSubCategoryOpen} onOpenChange={setIsAddSubCategoryOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Asset Sub Category")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <Label className="text-sm font-medium text-slate-700">{t("Sub Category Name")}</Label>
            <Input
              value={newSubCategoryName}
              onChange={(e) => setNewSubCategoryName(e.target.value)}
              placeholder={t("Enter sub category name")}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setNewSubCategoryName("");
              setIsAddSubCategoryOpen(false);
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddSubCategory}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Add Group Dialog */}
      <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Asset Group")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <Label className="text-sm font-medium text-slate-700">{t("Group Name")}</Label>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t("Enter group name")}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setNewGroupName("");
              setIsAddGroupOpen(false);
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddGroup}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Add Lifecycle Status Dialog */}
      <Dialog open={isAddLifecycleOpen} onOpenChange={setIsAddLifecycleOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Lifecycle Status")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <Label className="text-sm font-medium text-slate-700">{t("Status Name")}</Label>
            <Input
              value={newLifecycleName}
              onChange={(e) => setNewLifecycleName(e.target.value)}
              placeholder={t("Enter status name")}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setNewLifecycleName("");
              setIsAddLifecycleOpen(false);
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddLifecycle}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) {
            setImportFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">
                {t("Import Assets")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-6 space-y-4">
            <p className="text-sm text-slate-500">
              {t("Upload a CSV file to import assets. You can download a template to see the required format.")}
            </p>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")} *</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <Input
                  readOnly
                  value={importFile?.name || ""}
                  placeholder={t("Choose a file...")}
                  className="flex-1 bg-white min-w-0"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0"
                >
                  {t("Browse...")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {t("Supported formats: CSV, XLSX, XLS")}
              </p>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Download Template")}
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsImportDialogOpen(false);
                  setImportFile(null);
                }}
              >
                {t("Cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? t("Importing...") : t("Import")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
