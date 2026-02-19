"use client";

import { useState, useEffect } from "react";
import { formatLocalDate } from "@/lib/utils";
import { isValidName } from "@/lib/validations";
import { Plus, Pencil, Trash2, Download, Upload, Search, Package, Server, Monitor, Database, Users, Building, Wrench, Calendar, Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import { DataGrid } from "@/components/shared";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";

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

export default function MyAssetInventoryPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('asset.my-inventory');

  // Get current user ID for filtering assets owned by the logged-in user
  const currentUserId = session?.user?.id;
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
  const [lifecycleFilter, setLifecycleFilter] = useState("all");

  // Dialog states
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetRes, lookupsRes] = await Promise.all([
        fetch("/api/assets/my-assets"),
        fetch("/api/assets/my-assets/lookups"),
      ]);

      if (assetRes.ok) setAssets(await assetRes.json());
      if (lookupsRes.ok) {
        const lookups = await lookupsRes.json();
        setCategories(lookups.categories || []);
        setSubCategories(lookups.subCategories || []);
        setGroups(lookups.groups || []);
        setLifecycleStatuses(lookups.lifecycleStatuses || []);
        setDepartments(lookups.departments || []);
        setUsers(lookups.users || []);
        setClassifications(lookups.classifications || []);
        setSensitivities(lookups.sensitivities || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Set default department and owner when session is available
  useEffect(() => {
    if (session?.user && userDepartmentId && currentUserId) {
      setNewAsset(prev => ({
        ...prev,
        departmentId: userDepartmentId,
        ownerId: currentUserId,
      }));
    }
  }, [session, userDepartmentId, currentUserId]);

  // Filter assets - API already returns only assets owned by current user
  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.owner?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (a.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (a.subCategory?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (a.group?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesCategory = categoryFilter === "all" || a.categoryId === categoryFilter;
    const matchesLifecycle = lifecycleFilter === "all" || a.lifecycleStatusId === lifecycleFilter;
    return matchesSearch && matchesCategory && matchesLifecycle;
  });

  // Generate next asset ID (preview - server will ensure uniqueness)
  const generateAssetId = () => {
    const maxId = assets.reduce((max, asset) => {
      const match = asset.assetId.match(/ASSET(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
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

    // Validation: Asset Name
    if (!newAsset.name.trim()) {
      errors.name = t("Asset name is required");
    } else if (!isValidName(newAsset.name.trim())) {
      errors.name = t("Only letters, spaces, and hyphens are allowed");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});

    try {
      const res = await fetch("/api/assets/my-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAsset,
          // Force the owner to be the current user
          ownerId: currentUserId || null,
          departmentId: userDepartmentId || newAsset.departmentId || null,
          categoryId: newAsset.categoryId || null,
          subCategoryId: newAsset.subCategoryId || null,
          groupId: newAsset.groupId || null,
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
        toast({ title: t("Success"), description: t("Asset created successfully") });
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create asset"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding asset:", error);
    }
  };

  const handleEditAsset = async () => {
    if (!editingAsset) return;

    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation: Asset Name
    if (!editingAsset.name.trim()) {
      errors.name = t("Asset name is required");
    } else if (!isValidName(editingAsset.name.trim())) {
      errors.name = t("Only letters, spaces, and hyphens are allowed");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});

    try {
      const res = await fetch(`/api/assets/my-assets/${editingAsset.id}`, {
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
        toast({ title: t("Success"), description: t("Asset updated successfully") });
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update asset"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating asset:", error);
    }
  };

  const handleDeleteAsset = async () => {
    if (!deletingAssetId) return;
    try {
      const res = await fetch(`/api/assets/my-assets/${deletingAssetId}`, { method: "DELETE" });
      if (res.ok) {
        setAssets(assets.filter((a) => a.id !== deletingAssetId));
        toast({ title: t("Success"), description: t("Asset deleted successfully") });
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
      departmentId: userDepartmentId || "",
      ownerId: currentUserId || "",
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
      const res = await fetch("/api/assets/my-assets/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "category", name: newCategoryName.trim(), status: "Active" }),
      });
      if (res.ok) {
        const result = await res.json();
        const cat = result.data;
        setCategories([...categories, cat]);
        setNewAsset({ ...newAsset, categoryId: cat.id });
        setNewCategoryName("");
        setIsAddCategoryOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleAddSubCategory = async () => {
    if (!newSubCategoryName.trim() || !newAsset.categoryId) return;
    try {
      const res = await fetch("/api/assets/my-assets/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "subCategory",
          name: newSubCategoryName.trim(),
          categoryId: newAsset.categoryId,
          status: "Active",
        }),
      });
      if (res.ok) {
        const result = await res.json();
        const subCat = result.data;
        setSubCategories([...subCategories, subCat]);
        setNewAsset({ ...newAsset, subCategoryId: subCat.id });
        setNewSubCategoryName("");
        setIsAddSubCategoryOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create sub-category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding sub category:", error);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const res = await fetch("/api/assets/my-assets/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "group", name: newGroupName.trim() }),
      });
      if (res.ok) {
        const result = await res.json();
        const group = result.data;
        setGroups([...groups, group]);
        setNewAsset({ ...newAsset, groupId: group.id });
        setNewGroupName("");
        setIsAddGroupOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create group"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding group:", error);
    }
  };

  const handleAddLifecycle = async () => {
    if (!newLifecycleName.trim()) return;
    try {
      const res = await fetch("/api/assets/my-assets/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "lifecycleStatus", name: newLifecycleName.trim() }),
      });
      if (res.ok) {
        const result = await res.json();
        const lifecycle = result.data;
        setLifecycleStatuses([...lifecycleStatuses, lifecycle]);
        setNewAsset({ ...newAsset, lifecycleStatusId: lifecycle.id });
        setNewLifecycleName("");
        setIsAddLifecycleOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create lifecycle status"), variant: "destructive" });
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
    link.setAttribute("download", `my_assets_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());

      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("Invalid CSV file: No data rows found"), variant: "destructive" });
        return;
      }

      // Skip header row
      const dataRows = lines.slice(1);
      let imported = 0;
      let errors = 0;

      for (const line of dataRows) {
        // Parse CSV line (handle quoted fields)
        const matches = line.match(/("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g);
        if (!matches) continue;

        const cells = matches.slice(0, -1).map(cell => {
          cell = cell.replace(/,$/, "");
          if (cell.startsWith('"') && cell.endsWith('"')) {
            cell = cell.slice(1, -1).replace(/""/g, '"');
          }
          return cell.trim();
        });

        const [assetId, name] = cells;
        if (!assetId || !name) continue;

        try {
          // Check if asset exists
          const existing = assets.find(a => a.assetId === assetId);
          if (existing) {
            // Skip existing assets
            continue;
          }

          const res = await fetch("/api/assets/my-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId,
              name,
              status: "Active",
              departmentId: userDepartmentId,
            }),
          });

          if (res.ok) {
            imported++;
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
      }

      // Refresh data
      fetchData();
      toast({ title: t("Success"), description: `${t("Import completed")}: ${imported} ${t("assets imported")}, ${errors} ${t("errors")}` });
    };

    reader.readAsText(file);
    // Reset the input
    event.target.value = "";
  };

  // Stats - only for user's own assets
  const stats = {
    total: filteredAssets.length,
    active: filteredAssets.filter((a) => a.status === "Active").length,
    critical: filteredAssets.filter((a) => a.classification?.name === "Critical").length,
    needsReview: filteredAssets.filter((a) => !a.classificationId).length,
  };

  // Columns matching UAT: Asset ID, Asset Name, Asset Owner, Asset Category, Asset Sub Category, Group, Action
  const assetColumns: ColumnDef<Asset>[] = [
    {
      accessorKey: "assetId",
      header: t("Asset ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assetId")}</span>,
    },
    {
      accessorKey: "name",
      header: t("Asset Name"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getAssetTypeIcon(row.original.assetType)}
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      accessorKey: "owner.fullName",
      header: t("Asset Owner"),
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    {
      accessorKey: "category.name",
      header: t("Asset Category"),
      cell: ({ row }) => row.original.category?.name || "-",
    },
    {
      accessorKey: "subCategory.name",
      header: t("Asset Sub Category"),
      cell: ({ row }) => row.original.subCategory?.name || "-",
    },
    {
      accessorKey: "group.name",
      header: t("Group"),
      cell: ({ row }) => row.original.group?.name || "-",
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditingAsset({
                  ...row.original,
                  acquisitionDate: row.original.acquisitionDate
                    ? formatLocalDate(new Date(row.original.acquisitionDate))
                    : null,
                  nextReviewDate: row.original.nextReviewDate
                    ? formatLocalDate(new Date(row.original.nextReviewDate))
                    : null,
                });
                setIsEditAssetOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => {
                setDeletingAssetId(row.original.id);
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

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
    return <Unauthorized description={t("You don't have permission to access My Asset Inventory.")} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Asset Management")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("My Inventory")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("My Asset Inventory")}</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">{t("Total Assets")}</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">{t("Active Assets")}</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">{t("Critical Assets")}</p>
          <p className="text-2xl sm:text-3xl font-bold text-red-600">{stats.critical}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {t("Needs Review")}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">{stats.needsReview}</p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t("Search assets...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-56 border-slate-200"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={t("Category")} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="all">{t("Category")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={t("All Status")} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="all">{t("Status")}</SelectItem>
              {lifecycleStatuses.map((ls) => (
                <SelectItem key={ls.id} value={ls.id}>
                  {ls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <PermissionGate resource="asset.my-inventory" action="create">
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("Import")}
                </span>
              </Button>
            </label>
          </PermissionGate>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t("Export")}
          </Button>
          <PermissionGate resource="asset.my-inventory" action="create">
            <Button size="sm" className="col-span-2 sm:col-span-1" onClick={() => {
              setNewAsset({
                ...newAsset,
                assetId: generateAssetId(),
                departmentId: userDepartmentId || "",
                ownerId: currentUserId || "",
              });
              setIsAddAssetOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              {t("Add Asset")}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid columns={assetColumns} data={filteredAssets} hideSearch={true} />

      {/* Add Asset Dialog */}
      <Dialog open={isAddAssetOpen} onOpenChange={setIsAddAssetOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Asset")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="space-y-5">
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

              {/* Asset ID & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset ID")}</Label>
                  <Input
                    value={newAsset.assetId}
                    disabled
                    className="mt-1.5 bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                  <Select
                    value={newAsset.departmentId}
                    onValueChange={(value) => setNewAsset({ ...newAsset, departmentId: value, ownerId: currentUserId || "" })}
                    disabled={!!userDepartmentId}
                  >
                    <SelectTrigger className={`mt-1.5 ${userDepartmentId ? "bg-slate-50" : ""}`}>
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
                </div>
              </div>

              {/* Asset Owner - Full Width */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Asset Owner")}</Label>
                <Input
                  value={session?.user?.name || session?.user?.email || t("Current User")}
                  disabled
                  className="mt-1.5 bg-slate-50"
                />
              </div>

              {/* Category & Sub Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Category")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={newAsset.categoryId}
                      onValueChange={(value) => setNewAsset({ ...newAsset, categoryId: value, subCategoryId: "" })}
                    >
                      <SelectTrigger className="flex-1">
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
                    <Button type="button" variant="outline" size="icon" onClick={() => setIsAddCategoryOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={newAsset.subCategoryId}
                      onValueChange={(value) => setNewAsset({ ...newAsset, subCategoryId: value })}
                      disabled={!newAsset.categoryId}
                    >
                      <SelectTrigger className="flex-1">
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
                    <Button type="button" variant="outline" size="icon" onClick={() => setIsAddSubCategoryOpen(true)} disabled={!newAsset.categoryId}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Group & Custodian */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Group")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Select
                      value={newAsset.groupId}
                      onValueChange={(value) => setNewAsset({ ...newAsset, groupId: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("Select Group")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {filteredGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setIsAddGroupOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Custodian")}</Label>
                  <Select
                    value={newAsset.custodianId}
                    onValueChange={(value) => setNewAsset({ ...newAsset, custodianId: value })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder={t("Select Custodian")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lifecycle Status & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <Button type="button" variant="outline" size="icon" onClick={() => setIsAddLifecycleOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Location")}</Label>
                  <Input
                    value={newAsset.location}
                    onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                    placeholder={t("Enter Location")}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Criticality & Sensitivity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Criticality")}</Label>
                  <Input value={t("N/A")} disabled className="mt-1.5 bg-slate-50" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Sensitivity")}</Label>
                  <Input value="" disabled className="mt-1.5 bg-slate-50" />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { resetForm(); setFieldErrors({}); setIsAddAssetOpen(false); }}>{t("Cancel")}</Button>
            <Button onClick={handleAddAsset}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={isEditAssetOpen} onOpenChange={setIsEditAssetOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Asset")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            {editingAsset && (
              <div className="space-y-5">
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

                {/* Asset ID & Department */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset ID")}</Label>
                    <Input value={editingAsset.assetId} disabled className="mt-1.5 bg-slate-50" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                    <Select
                      value={editingAsset.departmentId || ""}
                      onValueChange={(value) => setEditingAsset({ ...editingAsset, departmentId: value, ownerId: null })}
                      disabled={!!userDepartmentId}
                    >
                      <SelectTrigger className={`mt-1.5 ${userDepartmentId ? "bg-slate-50" : ""}`}>
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
                  </div>
                </div>

                {/* Asset Owner - Full Width */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Asset Owner")}</Label>
                  <Input
                    value={editingAsset.owner?.fullName || session?.user?.name || session?.user?.email || t("Current User")}
                    disabled
                    className="mt-1.5 bg-slate-50"
                  />
                </div>

                {/* Category & Sub Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Category")}</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editingAsset.categoryId || ""}
                        onValueChange={(value) => setEditingAsset({ ...editingAsset, categoryId: value, subCategoryId: null })}
                      >
                        <SelectTrigger className="flex-1">
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
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsAddCategoryOpen(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")}</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editingAsset.subCategoryId || ""}
                        onValueChange={(value) => setEditingAsset({ ...editingAsset, subCategoryId: value })}
                        disabled={!editingAsset.categoryId}
                      >
                        <SelectTrigger className="flex-1">
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
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsAddSubCategoryOpen(true)} disabled={!editingAsset.categoryId}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Group & Custodian */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Group")}</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Select
                        value={editingAsset.groupId || ""}
                        onValueChange={(value) => setEditingAsset({ ...editingAsset, groupId: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t("Select Group")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {editFilteredGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsAddGroupOpen(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Custodian")}</Label>
                    <Select
                      value={editingAsset.custodianId || ""}
                      onValueChange={(value) => setEditingAsset({ ...editingAsset, custodianId: value })}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder={t("Select Custodian")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Lifecycle Status & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsAddLifecycleOpen(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Location")}</Label>
                    <Input
                      value={editingAsset.location || ""}
                      onChange={(e) => setEditingAsset({ ...editingAsset, location: e.target.value })}
                      placeholder={t("Enter Location")}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                {/* Criticality & Sensitivity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Criticality")}</Label>
                    <Input value={t("N/A")} disabled className="mt-1.5 bg-slate-50" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Sensitivity")}</Label>
                    <Input value="" disabled className="mt-1.5 bg-slate-50" />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setIsEditAssetOpen(false); setEditingAsset(null); setFieldErrors({}); }}>{t("Cancel")}</Button>
            <Button onClick={handleEditAsset}>{t("Save Changes")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t("Are you sure you want to delete this asset? This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteAsset}>{t("Delete")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Asset Category")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Category Name")} <span className="text-semantic-error">*</span></Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t("Enter category name")}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => { setNewCategoryName(""); setIsAddCategoryOpen(false); }}>{t("Cancel")}</Button>
            <Button onClick={handleAddCategory}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Add Sub Category Dialog */}
      <Dialog open={isAddSubCategoryOpen} onOpenChange={setIsAddSubCategoryOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Asset Sub Category")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Sub Category Name")} <span className="text-semantic-error">*</span></Label>
              <Input
                value={newSubCategoryName}
                onChange={(e) => setNewSubCategoryName(e.target.value)}
                placeholder={t("Enter sub category name")}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => { setNewSubCategoryName(""); setIsAddSubCategoryOpen(false); }}>{t("Cancel")}</Button>
            <Button onClick={handleAddSubCategory}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Add Group Dialog */}
      <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Asset Group")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Group Name")} <span className="text-semantic-error">*</span></Label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t("Enter group name")}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => { setNewGroupName(""); setIsAddGroupOpen(false); }}>{t("Cancel")}</Button>
            <Button onClick={handleAddGroup}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Add Lifecycle Status Dialog */}
      <Dialog open={isAddLifecycleOpen} onOpenChange={setIsAddLifecycleOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Lifecycle Status")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Status Name")} <span className="text-semantic-error">*</span></Label>
              <Input
                value={newLifecycleName}
                onChange={(e) => setNewLifecycleName(e.target.value)}
                placeholder={t("Enter status name")}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => { setNewLifecycleName(""); setIsAddLifecycleOpen(false); }}>{t("Cancel")}</Button>
            <Button onClick={handleAddLifecycle}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
