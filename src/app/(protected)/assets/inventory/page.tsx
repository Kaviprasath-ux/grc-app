"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Download, Upload, Search, Package, Server, Monitor, Database, Users, Building, Wrench, Calendar } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export default function AssetInventoryPage() {
  const { toast } = useToast();
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

  // Dialog states
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

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
    if (!newAsset.assetId.trim() || !newAsset.name.trim()) return;
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

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());

      if (lines.length < 2) {
        toast({ title: "Error", description: "Invalid CSV file: No data rows found", variant: "destructive" });
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

          const res = await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId,
              name,
              status: "Active",
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
      toast({ title: "Success", description: `Import completed: ${imported} assets imported, ${errors} errors` });
    };

    reader.readAsText(file);
    // Reset the input
    event.target.value = "";
  };

  // Stats
  const stats = {
    total: assets.length,
    active: assets.filter((a) => a.status === "Active").length,
    critical: assets.filter((a) => a.classification?.name === "Critical").length,
    needsReview: assets.filter((a) => {
      if (!a.nextReviewDate) return false;
      return new Date(a.nextReviewDate) <= new Date();
    }).length,
  };

  // Columns matching UAT: Asset ID, Asset Name, Asset Owner, Asset Category, Asset Sub Category, Group, Action
  const assetColumns: ColumnDef<Asset>[] = [
    {
      accessorKey: "assetId",
      header: "Asset ID",
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assetId")}</span>,
    },
    {
      accessorKey: "name",
      header: "Asset Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getAssetTypeIcon(row.original.assetType)}
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      accessorKey: "owner.fullName",
      header: "Asset Owner",
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    {
      accessorKey: "category.name",
      header: "Asset Category",
      cell: ({ row }) => row.original.category?.name || "-",
    },
    {
      accessorKey: "subCategory.name",
      header: "Asset Sub Category",
      cell: ({ row }) => row.original.subCategory?.name || "-",
    },
    {
      accessorKey: "group.name",
      header: "Group",
      cell: ({ row }) => row.original.group?.name || "-",
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingAsset({
                ...row.original,
                acquisitionDate: row.original.acquisitionDate
                  ? new Date(row.original.acquisitionDate).toISOString().split('T')[0]
                  : null,
                nextReviewDate: row.original.nextReviewDate
                  ? new Date(row.original.nextReviewDate).toISOString().split('T')[0]
                  : null,
              });
              setIsEditAssetOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
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
      <PageHeader title="Asset Inventory" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.critical}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Needs Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.needsReview}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-[250px]"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Category</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Department</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status</SelectItem>
              {lifecycleStatuses.map((ls) => (
                <SelectItem key={ls.id} value={ls.id}>
                  {ls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
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
                Import
              </span>
            </Button>
          </label>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => {
            setNewAsset({ ...newAsset, assetId: generateAssetId() });
            setIsAddAssetOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid columns={assetColumns} data={filteredAssets} hideSearch={true} />

      {/* Add Asset Dialog */}
      <Dialog open={isAddAssetOpen} onOpenChange={setIsAddAssetOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>
              Enter the details for the new asset
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Basic Info - Row 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assetId">Asset ID</Label>
                <Input
                  id="assetId"
                  value={newAsset.assetId}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Asset Name</Label>
                <Input
                  id="name"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  placeholder="Enter Asset Name"
                />
              </div>
            </div>

            {/* Department & Owner - Row 2 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={newAsset.departmentId}
                  onValueChange={(value) => setNewAsset({ ...newAsset, departmentId: value, ownerId: "" })}
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
                <Label>Asset Owner</Label>
                <Select
                  value={newAsset.ownerId}
                  onValueChange={(value) => setNewAsset({ ...newAsset, ownerId: value })}
                  disabled={!newAsset.departmentId}
                >
                  <SelectTrigger className={!newAsset.departmentId ? "bg-muted" : ""}>
                    <SelectValue placeholder={newAsset.departmentId ? "Select Asset Owner" : "Select Department first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredOwners.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category & Sub Category - Row 3 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Category</Label>
                <div className="flex gap-2">
                  <Select
                    value={newAsset.categoryId}
                    onValueChange={(value) => setNewAsset({ ...newAsset, categoryId: value, subCategoryId: "" })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
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
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Asset Sub Category</Label>
                <div className="flex gap-2">
                  <Select
                    value={newAsset.subCategoryId}
                    onValueChange={(value) => setNewAsset({ ...newAsset, subCategoryId: value })}
                    disabled={!newAsset.categoryId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
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
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Group & Custodian - Row 4 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Group</Label>
                <div className="flex gap-2">
                  <Select
                    value={newAsset.groupId}
                    onValueChange={(value) => setNewAsset({ ...newAsset, groupId: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select Asset Group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
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
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Asset Custodian</Label>
                <Select
                  value={newAsset.custodianId}
                  onValueChange={(value) => setNewAsset({ ...newAsset, custodianId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Asset Custodian" />
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

            {/* Criticality & Sensitivity (Computed fields) - Row 5 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Criticality</Label>
                <Input
                  value="N/A"
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Asset Sensitivity</Label>
                <Input
                  value=""
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {/* Lifecycle Status & Location - Row 6 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lifecycle Status</Label>
                <div className="flex gap-2">
                  <Select
                    value={newAsset.lifecycleStatusId}
                    onValueChange={(value) => setNewAsset({ ...newAsset, lifecycleStatusId: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
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
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Asset Location</Label>
                <Input
                  id="location"
                  value={newAsset.location}
                  onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                  placeholder="Enter Location"
                />
              </div>
            </div>

            {/* Dates - Row 7 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acquisitionDate">Acquisition date</Label>
                <Input
                  id="acquisitionDate"
                  type="date"
                  value={newAsset.acquisitionDate}
                  onChange={(e) => setNewAsset({ ...newAsset, acquisitionDate: e.target.value })}
                  placeholder="Select Acquistion Date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextReviewDate">Next review date</Label>
                <Input
                  id="nextReviewDate"
                  type="date"
                  value={newAsset.nextReviewDate}
                  onChange={(e) => setNewAsset({ ...newAsset, nextReviewDate: e.target.value })}
                  placeholder="Next Review Date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              resetForm();
              setIsAddAssetOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddAsset}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={isEditAssetOpen} onOpenChange={setIsEditAssetOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Update the asset details
            </DialogDescription>
          </DialogHeader>
          {editingAsset && (
            <div className="space-y-4 py-4">
              {/* Basic Info - Row 1 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-assetId">Asset ID</Label>
                  <Input
                    id="edit-assetId"
                    value={editingAsset.assetId}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Asset Name</Label>
                  <Input
                    id="edit-name"
                    value={editingAsset.name}
                    onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                  />
                </div>
              </div>

              {/* Department & Owner - Row 2 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={editingAsset.departmentId || ""}
                    onValueChange={(value) => setEditingAsset({ ...editingAsset, departmentId: value, ownerId: null })}
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
                  <Label>Asset Owner</Label>
                  <Select
                    value={editingAsset.ownerId || ""}
                    onValueChange={(value) => setEditingAsset({ ...editingAsset, ownerId: value })}
                    disabled={!editingAsset.departmentId}
                  >
                    <SelectTrigger className={!editingAsset.departmentId ? "bg-muted" : ""}>
                      <SelectValue placeholder={editingAsset.departmentId ? "Select Asset Owner" : "Select Department first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {editFilteredOwners.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Category & Sub Category - Row 3 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset Category</Label>
                  <div className="flex gap-2">
                    <Select
                      value={editingAsset.categoryId || ""}
                      onValueChange={(value) => setEditingAsset({ ...editingAsset, categoryId: value, subCategoryId: null })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
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
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Asset Sub Category</Label>
                  <div className="flex gap-2">
                    <Select
                      value={editingAsset.subCategoryId || ""}
                      onValueChange={(value) => setEditingAsset({ ...editingAsset, subCategoryId: value })}
                      disabled={!editingAsset.categoryId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
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
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Group & Custodian - Row 4 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset Group</Label>
                  <div className="flex gap-2">
                    <Select
                      value={editingAsset.groupId || ""}
                      onValueChange={(value) => setEditingAsset({ ...editingAsset, groupId: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Asset Group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => (
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
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Asset Custodian</Label>
                  <Select
                    value={editingAsset.custodianId || ""}
                    onValueChange={(value) => setEditingAsset({ ...editingAsset, custodianId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Asset Custodian" />
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

              {/* Criticality & Sensitivity (Computed fields) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset Criticality</Label>
                  <Input
                    value="N/A"
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Asset Sensitivity</Label>
                  <Input
                    value=""
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              {/* Lifecycle Status & Location - Row 6 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lifecycle Status</Label>
                  <div className="flex gap-2">
                    <Select
                      value={editingAsset.lifecycleStatusId || ""}
                      onValueChange={(value) => setEditingAsset({ ...editingAsset, lifecycleStatusId: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
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
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Asset Location</Label>
                  <Input
                    id="edit-location"
                    value={editingAsset.location || ""}
                    onChange={(e) => setEditingAsset({ ...editingAsset, location: e.target.value })}
                    placeholder="Enter Location"
                  />
                </div>
              </div>

              {/* Dates - Row 7 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-acquisitionDate">Acquisition date</Label>
                  <Input
                    id="edit-acquisitionDate"
                    type="date"
                    value={editingAsset.acquisitionDate || ""}
                    onChange={(e) => setEditingAsset({ ...editingAsset, acquisitionDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-nextReviewDate">Next review date</Label>
                  <Input
                    id="edit-nextReviewDate"
                    type="date"
                    value={editingAsset.nextReviewDate || ""}
                    onChange={(e) => setEditingAsset({ ...editingAsset, nextReviewDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditAssetOpen(false);
              setEditingAsset(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleEditAsset}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAsset}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Asset Category</DialogTitle>
            <DialogDescription>
              Create a new asset category
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-category-name">Category Name</Label>
              <Input
                id="new-category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setNewCategoryName("");
              setIsAddCategoryOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Add Sub Category Dialog */}
      <Dialog open={isAddSubCategoryOpen} onOpenChange={setIsAddSubCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Asset Sub Category</DialogTitle>
            <DialogDescription>
              Create a new asset sub category
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-subcategory-name">Sub Category Name</Label>
              <Input
                id="new-subcategory-name"
                value={newSubCategoryName}
                onChange={(e) => setNewSubCategoryName(e.target.value)}
                placeholder="Enter sub category name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setNewSubCategoryName("");
              setIsAddSubCategoryOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddSubCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Add Group Dialog */}
      <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Asset Group</DialogTitle>
            <DialogDescription>
              Create a new asset group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-group-name">Group Name</Label>
              <Input
                id="new-group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setNewGroupName("");
              setIsAddGroupOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddGroup}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Add Lifecycle Status Dialog */}
      <Dialog open={isAddLifecycleOpen} onOpenChange={setIsAddLifecycleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lifecycle Status</DialogTitle>
            <DialogDescription>
              Create a new lifecycle status
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-lifecycle-name">Status Name</Label>
              <Input
                id="new-lifecycle-name"
                value={newLifecycleName}
                onChange={(e) => setNewLifecycleName(e.target.value)}
                placeholder="Enter status name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setNewLifecycleName("");
              setIsAddLifecycleOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddLifecycle}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
