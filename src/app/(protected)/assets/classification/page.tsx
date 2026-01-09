"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Sparkles, Search, Download, Upload } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

interface AssetCategory {
  id: string;
  name: string;
}

interface AssetSubCategory {
  id: string;
  name: string;
  categoryId: string;
  category: AssetCategory;
}

interface AssetGroup {
  id: string;
  name: string;
}

interface AssetSensitivity {
  id: string;
  name: string;
}

interface CIARating {
  id: string;
  type: string;
  label: string;
  value: number;
}

interface CIAClassification {
  id: string;
  subCategoryId: string;
  subCategory: AssetSubCategory;
  groupId: string;
  group: AssetGroup;
  sensitivityId?: string;
  sensitivity?: AssetSensitivity;
  confidentiality: string;
  confidentialityScore: number;
  integrity: string;
  integrityScore: number;
  availability: string;
  availabilityScore: number;
  assetCriticality: string;
  assetCriticalityScore: number;
}

export default function AssetClassificationPage() {
  const { toast } = useToast();
  const [classifications, setCIAClassifications] = useState<CIAClassification[]>([]);
  const [subCategories, setSubCategories] = useState<AssetSubCategory[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [sensitivities, setSensitivities] = useState<AssetSensitivity[]>([]);
  const [ciaRatings, setCIARatings] = useState<CIARating[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<CIAClassification | null>(null);

  // Inline add dialogs
  const [isAddSensitivityOpen, setIsAddSensitivityOpen] = useState(false);
  const [isAddCIARatingOpen, setIsAddCIARatingOpen] = useState(false);
  const [newCIARatingType, setNewCIARatingType] = useState<"Confidentiality" | "Integrity" | "Availability">("Confidentiality");
  const [newSensitivityName, setNewSensitivityName] = useState("");
  const [newCIARatingLabel, setNewCIARatingLabel] = useState("");
  const [newCIARatingValue, setNewCIARatingValue] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    subCategoryId: "",
    groupId: "",
    sensitivityId: "",
    confidentiality: "low",
    confidentialityScore: 1,
    integrity: "low",
    integrityScore: 1,
    availability: "low",
    availabilityScore: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classRes, subCatRes, groupRes, sensRes, ciaRes] = await Promise.all([
        fetch("/api/asset-cia-classifications"),
        fetch("/api/asset-sub-categories"),
        fetch("/api/asset-groups"),
        fetch("/api/asset-sensitivities"),
        fetch("/api/cia-ratings"),
      ]);

      if (classRes.ok) setCIAClassifications(await classRes.json());
      if (subCatRes.ok) setSubCategories(await subCatRes.json());
      if (groupRes.ok) setGroups(await groupRes.json());
      if (sensRes.ok) setSensitivities(await sensRes.json());
      if (ciaRes.ok) setCIARatings(await ciaRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Get ratings by type
  const getRatingsByType = (type: string) => {
    return ciaRatings.filter(r => r.type === type);
  };

  const handleAdd = async () => {
    if (!formData.subCategoryId || !formData.groupId) {
      toast({ title: "Error", description: "Please select both Sub Category and Group", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/asset-cia-classifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const created = await res.json();
        setCIAClassifications([...classifications, created]);
        resetForm();
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to create classification", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding classification:", error);
    }
  };

  const handleEdit = async () => {
    if (!selectedClassification) return;
    try {
      const res = await fetch(`/api/asset-cia-classifications/${selectedClassification.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const updated = await res.json();
        setCIAClassifications(classifications.map((c) => (c.id === updated.id ? updated : c)));
        resetForm();
        setSelectedClassification(null);
        setIsEditOpen(false);
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to update classification", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating classification:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedClassification) return;
    try {
      const res = await fetch(`/api/asset-cia-classifications/${selectedClassification.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCIAClassifications(classifications.filter((c) => c.id !== selectedClassification.id));
        setSelectedClassification(null);
        setIsDeleteOpen(false);
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to delete classification", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting classification:", error);
    }
  };

  const openEditDialog = (classification: CIAClassification) => {
    setSelectedClassification(classification);
    setFormData({
      subCategoryId: classification.subCategoryId,
      groupId: classification.groupId,
      sensitivityId: classification.sensitivityId || "",
      confidentiality: classification.confidentiality,
      confidentialityScore: classification.confidentialityScore,
      integrity: classification.integrity,
      integrityScore: classification.integrityScore,
      availability: classification.availability,
      availabilityScore: classification.availabilityScore,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (classification: CIAClassification) => {
    setSelectedClassification(classification);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      subCategoryId: "",
      groupId: "",
      sensitivityId: "",
      confidentiality: "low",
      confidentialityScore: 1,
      integrity: "low",
      integrityScore: 1,
      availability: "low",
      availabilityScore: 0,
    });
  };

  const updateCIAValue = (field: "confidentiality" | "integrity" | "availability", value: string) => {
    const typeMap = {
      confidentiality: "Confidentiality",
      integrity: "Integrity",
      availability: "Availability",
    };
    const rating = ciaRatings.find(r => r.type === typeMap[field] && r.label === value);
    if (rating) {
      setFormData({
        ...formData,
        [field]: value,
        [`${field}Score`]: rating.value,
      });
    }
  };

  // Handle adding new sensitivity
  const handleAddSensitivity = async () => {
    if (!newSensitivityName.trim()) return;
    try {
      const res = await fetch("/api/asset-sensitivities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSensitivityName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setSensitivities([...sensitivities, created]);
        setFormData({ ...formData, sensitivityId: created.id });
        setNewSensitivityName("");
        setIsAddSensitivityOpen(false);
      }
    } catch (error) {
      console.error("Error adding sensitivity:", error);
    }
  };

  // Handle adding new CIA rating
  const handleAddCIARating = async () => {
    if (!newCIARatingLabel.trim()) return;
    try {
      const res = await fetch("/api/cia-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newCIARatingType,
          label: newCIARatingLabel.trim().toLowerCase(),
          value: newCIARatingValue,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCIARatings([...ciaRatings, created]);
        // Update form with new rating
        const fieldMap: Record<string, "confidentiality" | "integrity" | "availability"> = {
          Confidentiality: "confidentiality",
          Integrity: "integrity",
          Availability: "availability",
        };
        const field = fieldMap[newCIARatingType];
        setFormData({
          ...formData,
          [field]: created.label,
          [`${field}Score`]: created.value,
        });
        setNewCIARatingLabel("");
        setNewCIARatingValue(0);
        setIsAddCIARatingOpen(false);
      }
    } catch (error) {
      console.error("Error adding CIA rating:", error);
    }
  };

  // Filter classifications based on search
  const filteredClassifications = classifications.filter((c) => {
    const search = searchTerm.toLowerCase();
    return (
      c.subCategory?.name?.toLowerCase().includes(search) ||
      c.group?.name?.toLowerCase().includes(search) ||
      c.confidentiality?.toLowerCase().includes(search) ||
      c.integrity?.toLowerCase().includes(search) ||
      c.availability?.toLowerCase().includes(search) ||
      c.assetCriticality?.toLowerCase().includes(search)
    );
  });

  // Export handler
  const handleExport = () => {
    const headers = ["Sub Category", "Asset Group", "Confidentiality", "Integrity", "Availability", "Asset Criticality", "Asset Criticality Score"];
    const rows = filteredClassifications.map(c => [
      c.subCategory?.name || "",
      c.group?.name || "",
      c.confidentiality || "",
      c.integrity || "",
      c.availability || "",
      c.assetCriticality || "",
      c.assetCriticalityScore?.toString() || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `asset_classifications_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Grid Columns matching UAT
  const ciaColumns: ColumnDef<CIAClassification>[] = [
    {
      accessorKey: "subCategory.name",
      header: "Sub Category",
      cell: ({ row }) => row.original.subCategory?.name || "-",
    },
    {
      accessorKey: "group.name",
      header: "Asset Group",
      cell: ({ row }) => row.original.group?.name || "-",
    },
    {
      accessorKey: "confidentiality",
      header: "Confidentiality",
      cell: ({ row }) => row.original.confidentiality || "-",
    },
    {
      accessorKey: "integrity",
      header: "Integrity",
      cell: ({ row }) => row.original.integrity || "-",
    },
    {
      accessorKey: "availability",
      header: "Availability",
      cell: ({ row }) => row.original.availability || "-",
    },
    {
      accessorKey: "assetCriticality",
      header: "Asset Criticality",
      cell: ({ row }) => row.original.assetCriticality || "-",
    },
    {
      accessorKey: "assetCriticalityScore",
      header: "Asset Criticality Score",
      cell: ({ row }) => row.original.assetCriticalityScore,
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast({ title: "Info", description: "AI Risk Evaluation - Coming Soon" })}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            AI Risk Evaluation
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEditDialog(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => openDeleteDialog(row.original)}
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
      <PageHeader title="Asset Classification" />

      {/* Search and Actions - aligned on same row */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Group, Sub Category, Confidentiality, Availability, Integrity, Criticality"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-[500px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => {
            resetForm();
            setIsAddOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            New Asset Classification
          </Button>
        </div>
      </div>

      {/* Asset Classification Grid */}
      <DataGrid
        columns={ciaColumns}
        data={filteredClassifications}
        hideSearch={true}
      />

      {/* Add Classification Dialog - matching UAT */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Asset Classification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Asset Sub Category */}
            <div className="space-y-2">
              <Label>Asset Sub Category</Label>
              <Select
                value={formData.subCategoryId}
                onValueChange={(value) => setFormData({ ...formData, subCategoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {subCategories.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Group */}
            <div className="space-y-2">
              <Label>Asset Group</Label>
              <Select
                value={formData.groupId}
                onValueChange={(value) => setFormData({ ...formData, groupId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Sensitivity with inline add */}
            <div className="space-y-2">
              <Label>Asset Sensitivity</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.sensitivityId}
                  onValueChange={(value) => setFormData({ ...formData, sensitivityId: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {sensitivities.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsAddSensitivityOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Confidentiality with inline add */}
            <div className="space-y-2">
              <Label>Confidentiality</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.confidentiality}
                  onValueChange={(value) => updateCIAValue("confidentiality", value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {getRatingsByType("Confidentiality").map((r) => (
                      <SelectItem key={r.id} value={r.label}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewCIARatingType("Confidentiality");
                    setIsAddCIARatingOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Integrity with inline add */}
            <div className="space-y-2">
              <Label>Integrity</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.integrity}
                  onValueChange={(value) => updateCIAValue("integrity", value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {getRatingsByType("Integrity").map((r) => (
                      <SelectItem key={r.id} value={r.label}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewCIARatingType("Integrity");
                    setIsAddCIARatingOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Availability with inline add */}
            <div className="space-y-2">
              <Label>Availability</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.availability}
                  onValueChange={(value) => updateCIAValue("availability", value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {getRatingsByType("Availability").map((r) => (
                      <SelectItem key={r.id} value={r.label}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewCIARatingType("Availability");
                    setIsAddCIARatingOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd}>Save</Button>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Classification Dialog - matching UAT */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Asset Classification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Asset Sub Category */}
            <div className="space-y-2">
              <Label>Asset Sub Category</Label>
              <Select
                value={formData.subCategoryId}
                onValueChange={(value) => setFormData({ ...formData, subCategoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {subCategories.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Group */}
            <div className="space-y-2">
              <Label>Asset Group</Label>
              <Select
                value={formData.groupId}
                onValueChange={(value) => setFormData({ ...formData, groupId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Sensitivity with inline add */}
            <div className="space-y-2">
              <Label>Asset Sensitivity</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.sensitivityId}
                  onValueChange={(value) => setFormData({ ...formData, sensitivityId: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {sensitivities.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsAddSensitivityOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Confidentiality with inline add */}
            <div className="space-y-2">
              <Label>Confidentiality</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.confidentiality}
                  onValueChange={(value) => updateCIAValue("confidentiality", value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {getRatingsByType("Confidentiality").map((r) => (
                      <SelectItem key={r.id} value={r.label}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewCIARatingType("Confidentiality");
                    setIsAddCIARatingOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Integrity with inline add */}
            <div className="space-y-2">
              <Label>Integrity</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.integrity}
                  onValueChange={(value) => updateCIAValue("integrity", value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {getRatingsByType("Integrity").map((r) => (
                      <SelectItem key={r.id} value={r.label}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewCIARatingType("Integrity");
                    setIsAddCIARatingOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Availability with inline add */}
            <div className="space-y-2">
              <Label>Availability</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.availability}
                  onValueChange={(value) => updateCIAValue("availability", value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {getRatingsByType("Availability").map((r) => (
                      <SelectItem key={r.id} value={r.label}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewCIARatingType("Availability");
                    setIsAddCIARatingOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit}>Save</Button>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this classification? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Asset Sensitivity Dialog - inline add */}
      <Dialog open={isAddSensitivityOpen} onOpenChange={setIsAddSensitivityOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Asset Sensitivity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newSensitivityName}
                onChange={(e) => setNewSensitivityName(e.target.value)}
                placeholder="Enter sensitivity name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setNewSensitivityName("");
              setIsAddSensitivityOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddSensitivity}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add CIA Rating Dialog - inline add */}
      <Dialog open={isAddCIARatingOpen} onOpenChange={setIsAddCIARatingOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {newCIARatingType}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={newCIARatingLabel}
                onChange={(e) => setNewCIARatingLabel(e.target.value)}
                placeholder="e.g., high, medium, low"
              />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                value={newCIARatingValue}
                onChange={(e) => setNewCIARatingValue(parseInt(e.target.value) || 0)}
                placeholder="Score value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setNewCIARatingLabel("");
              setNewCIARatingValue(0);
              setIsAddCIARatingOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddCIARating}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
