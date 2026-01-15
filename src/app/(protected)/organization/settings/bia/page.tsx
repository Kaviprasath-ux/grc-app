"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ColumnDef } from "@tanstack/react-table";

interface BIACategory {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

interface BIARating {
  id: string;
  label: string;
  score: number;
  description?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
}

interface BIAScoringRange {
  id: string;
  label: string;
  lowValue: number;
  highValue?: number | null;
  color?: string;
  calculationType: string;
  sortOrder: number;
}

interface BCPLabel {
  id: string;
  name: string;
  type: string;
  hours: number;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export default function BIASettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("category");
  const [loading, setLoading] = useState(true);

  // Data states
  const [categories, setCategories] = useState<BIACategory[]>([]);
  const [ratings, setRatings] = useState<BIARating[]>([]);
  const [scoringRanges, setScoringRanges] = useState<BIAScoringRange[]>([]);
  const [bcpLabels, setBcpLabels] = useState<BCPLabel[]>([]);
  const [calculationType, setCalculationType] = useState("High of all");

  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);
  const [isBcpDialogOpen, setIsBcpDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form states
  const [editingCategory, setEditingCategory] = useState<BIACategory | null>(null);
  const [editingRating, setEditingRating] = useState<BIARating | null>(null);
  const [editingRange, setEditingRange] = useState<BIAScoringRange | null>(null);
  const [editingBcp, setEditingBcp] = useState<BCPLabel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

  // New item forms
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [newRating, setNewRating] = useState({ label: "", score: 0, description: "" });
  const [newRange, setNewRange] = useState({ label: "", lowValue: 0, highValue: 0 });
  const [newBcp, setNewBcp] = useState({ name: "", type: "RTO", hours: 0, description: "" });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [catRes, ratingRes, configRes, rangeRes, bcpRes] = await Promise.all([
        fetch("/api/bia-categories"),
        fetch("/api/bia-ratings"),
        fetch("/api/bia-scoring-config"),
        fetch("/api/bia-scoring-ranges"),
        fetch("/api/bcp-labels"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (ratingRes.ok) setRatings(await ratingRes.json());
      if (configRes.ok) {
        const config = await configRes.json();
        setCalculationType(config?.calculationType || "High of all");
      }
      if (rangeRes.ok) setScoringRanges(await rangeRes.json());
      if (bcpRes.ok) setBcpLabels(await bcpRes.json());
    } catch (error) {
      console.error("Error fetching BIA data:", error);
      toast({ title: "Error", description: "Failed to load BIA settings", variant: "destructive" });
    }
    setLoading(false);
  };

  // ==================== Category CRUD ====================
  const handleSaveCategory = async () => {
    try {
      const isEditing = !!editingCategory;
      const url = isEditing ? `/api/bia-categories/${editingCategory.id}` : "/api/bia-categories";
      const method = isEditing ? "PUT" : "POST";
      const data = isEditing ? editingCategory : newCategory;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast({ title: "Success", description: `Category ${isEditing ? "updated" : "created"} successfully` });
        fetchAllData();
        setIsCategoryDialogOpen(false);
        setEditingCategory(null);
        setNewCategory({ name: "", description: "" });
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to save category", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving category:", error);
      toast({ title: "Error", description: "Failed to save category", variant: "destructive" });
    }
  };

  // ==================== Rating CRUD ====================
  const handleSaveRating = async () => {
    try {
      const isEditing = !!editingRating;
      const url = isEditing ? `/api/bia-ratings/${editingRating.id}` : "/api/bia-ratings";
      const method = isEditing ? "PUT" : "POST";
      const data = isEditing ? editingRating : newRating;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast({ title: "Success", description: `Rating ${isEditing ? "updated" : "created"} successfully` });
        fetchAllData();
        setIsRatingDialogOpen(false);
        setEditingRating(null);
        setNewRating({ label: "", score: 0, description: "" });
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to save rating", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving rating:", error);
      toast({ title: "Error", description: "Failed to save rating", variant: "destructive" });
    }
  };

  // ==================== Scoring Range CRUD ====================
  const handleSaveRange = async () => {
    try {
      const isEditing = !!editingRange;
      const url = isEditing ? `/api/bia-scoring-ranges/${editingRange.id}` : "/api/bia-scoring-ranges";
      const method = isEditing ? "PUT" : "POST";
      const data = isEditing
        ? editingRange
        : { ...newRange, calculationType };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast({ title: "Success", description: `Scoring range ${isEditing ? "updated" : "created"} successfully` });
        fetchAllData();
        setIsRangeDialogOpen(false);
        setEditingRange(null);
        setNewRange({ label: "", lowValue: 0, highValue: 0 });
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to save scoring range", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving scoring range:", error);
      toast({ title: "Error", description: "Failed to save scoring range", variant: "destructive" });
    }
  };

  // ==================== BCP Label CRUD ====================
  const handleSaveBcp = async () => {
    try {
      const isEditing = !!editingBcp;
      const url = isEditing ? `/api/bcp-labels/${editingBcp.id}` : "/api/bcp-labels";
      const method = isEditing ? "PUT" : "POST";
      const data = isEditing ? editingBcp : newBcp;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast({ title: "Success", description: `BCP label ${isEditing ? "updated" : "created"} successfully` });
        fetchAllData();
        setIsBcpDialogOpen(false);
        setEditingBcp(null);
        setNewBcp({ name: "", type: "RTO", hours: 0, description: "" });
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to save BCP label", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving BCP label:", error);
      toast({ title: "Error", description: "Failed to save BCP label", variant: "destructive" });
    }
  };

  // ==================== Delete ====================
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const { type, id } = deleteTarget;
      const endpoints: Record<string, string> = {
        category: `/api/bia-categories/${id}`,
        rating: `/api/bia-ratings/${id}`,
        range: `/api/bia-scoring-ranges/${id}`,
        bcp: `/api/bcp-labels/${id}`,
      };

      const res = await fetch(endpoints[type], { method: "DELETE" });

      if (res.ok) {
        toast({ title: "Success", description: "Item deleted successfully" });
        fetchAllData();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to delete item", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
    setIsDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  // ==================== Calculation Type Change ====================
  const handleCalculationTypeChange = async (value: string) => {
    setCalculationType(value);
    try {
      await fetch("/api/bia-scoring-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calculationType: value }),
      });
      toast({ title: "Success", description: "Calculation type updated" });
    } catch (error) {
      console.error("Error updating calculation type:", error);
    }
  };

  // ==================== Column Definitions ====================
  const categoryColumns: ColumnDef<BIACategory>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingCategory(row.original);
              setIsCategoryDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setDeleteTarget({ type: "category", id: row.original.id });
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const ratingColumns: ColumnDef<BIARating>[] = [
    {
      accessorKey: "label",
      header: "Rating",
      cell: ({ row }) => <span className="font-medium">{row.getValue("label")}</span>,
    },
    {
      accessorKey: "score",
      header: "Score",
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue("description") || "-"}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingRating(row.original);
              setIsRatingDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setDeleteTarget({ type: "rating", id: row.original.id });
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const scoringRangeColumns: ColumnDef<BIAScoringRange>[] = [
    {
      accessorKey: "label",
      header: "Rating",
      cell: ({ row }) => <span className="font-medium">{row.getValue("label")}</span>,
    },
    {
      accessorKey: "highValue",
      header: "High Range",
      cell: ({ row }) => row.original.highValue ?? "-",
    },
    {
      accessorKey: "lowValue",
      header: "Low Range",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingRange(row.original);
              setIsRangeDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setDeleteTarget({ type: "range", id: row.original.id });
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const bcpColumns: ColumnDef<BCPLabel>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <span className={row.original.isActive ? "text-green-600" : "text-red-600"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingBcp(row.original);
              setIsBcpDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setDeleteTarget({ type: "bcp", id: row.original.id });
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Filter scoring ranges by calculation type
  const filteredScoringRanges = scoringRanges.filter(
    (r) => r.calculationType === calculationType
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="BIA Settings"
        actions={[
          {
            label: "Back to Settings",
            variant: "outline",
            icon: ArrowLeft,
            onClick: () => router.push("/organization/settings"),
          },
        ]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="methodology">BIA Methodology</TabsTrigger>
          <TabsTrigger value="bcp">BCP Labels</TabsTrigger>
        </TabsList>

        {/* Category Tab */}
        <TabsContent value="category" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingCategory(null);
                setNewCategory({ name: "", description: "" });
                setIsCategoryDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>
          <DataGrid columns={categoryColumns} data={categories} searchPlaceholder="Search categories..." />
        </TabsContent>

        {/* BIA Methodology Tab */}
        <TabsContent value="methodology" className="space-y-6">
          {/* BIA Rating Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">BIA Rating</h3>
              <Button
                onClick={() => {
                  setEditingRating(null);
                  setNewRating({ label: "", score: 0, description: "" });
                  setIsRatingDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Rating
              </Button>
            </div>
            <DataGrid columns={ratingColumns} data={ratings} searchPlaceholder="Search ratings..." />
          </div>

          {/* BIA Calculation Section */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold">BIA Calculation</h3>
            <div className="flex items-center gap-4">
              <Label>Calculation Type</Label>
              <Select value={calculationType} onValueChange={handleCalculationTypeChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High of all">High of all</SelectItem>
                  <SelectItem value="Addition of all">Addition of all</SelectItem>
                  <SelectItem value="Product of all">Product of all</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scoring Calculation Grid - Only show for Addition/Product */}
            {calculationType !== "High of all" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium">Scoring Calculation</h4>
                  <Button
                    onClick={() => {
                      setEditingRange(null);
                      setNewRange({ label: "", lowValue: 0, highValue: 0 });
                      setIsRangeDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Range
                  </Button>
                </div>
                <DataGrid columns={scoringRangeColumns} data={filteredScoringRanges} searchPlaceholder="Search ranges..." />
              </div>
            )}
          </div>
        </TabsContent>

        {/* BCP Labels Tab */}
        <TabsContent value="bcp" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingBcp(null);
                setNewBcp({ name: "", type: "RTO", hours: 0, description: "" });
                setIsBcpDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add BCP Label
            </Button>
          </div>
          <DataGrid columns={bcpColumns} data={bcpLabels} searchPlaceholder="Search BCP labels..." />
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Name *</Label>
              <Input
                id="categoryName"
                value={editingCategory?.name || newCategory.name}
                onChange={(e) =>
                  editingCategory
                    ? setEditingCategory({ ...editingCategory, name: e.target.value })
                    : setNewCategory({ ...newCategory, name: e.target.value })
                }
                placeholder="Enter category name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryDescription">Description</Label>
              <Input
                id="categoryDescription"
                value={editingCategory?.description || newCategory.description}
                onChange={(e) =>
                  editingCategory
                    ? setEditingCategory({ ...editingCategory, description: e.target.value })
                    : setNewCategory({ ...newCategory, description: e.target.value })
                }
                placeholder="Enter description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRating ? "Edit Rating" : "Add Rating"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ratingLabel">Rating *</Label>
              <Input
                id="ratingLabel"
                value={editingRating?.label || newRating.label}
                onChange={(e) =>
                  editingRating
                    ? setEditingRating({ ...editingRating, label: e.target.value })
                    : setNewRating({ ...newRating, label: e.target.value })
                }
                placeholder="e.g., High, Medium, Low"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ratingScore">Score *</Label>
              <Input
                id="ratingScore"
                type="number"
                value={editingRating?.score ?? newRating.score}
                onChange={(e) =>
                  editingRating
                    ? setEditingRating({ ...editingRating, score: parseInt(e.target.value) || 0 })
                    : setNewRating({ ...newRating, score: parseInt(e.target.value) || 0 })
                }
                placeholder="e.g., 100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ratingDescription">Description</Label>
              <Input
                id="ratingDescription"
                value={editingRating?.description || newRating.description}
                onChange={(e) =>
                  editingRating
                    ? setEditingRating({ ...editingRating, description: e.target.value })
                    : setNewRating({ ...newRating, description: e.target.value })
                }
                placeholder="Enter description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRatingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRating}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scoring Range Dialog */}
      <Dialog open={isRangeDialogOpen} onOpenChange={setIsRangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRange ? "Edit Scoring Range" : "Add Scoring Range"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rangeLabel">Rating *</Label>
              <Input
                id="rangeLabel"
                value={editingRange?.label || newRange.label}
                onChange={(e) =>
                  editingRange
                    ? setEditingRange({ ...editingRange, label: e.target.value })
                    : setNewRange({ ...newRange, label: e.target.value })
                }
                placeholder="e.g., Critical, High, Medium, Low"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rangeHigh">High Range</Label>
              <Input
                id="rangeHigh"
                type="number"
                value={editingRange?.highValue ?? newRange.highValue}
                onChange={(e) =>
                  editingRange
                    ? setEditingRange({ ...editingRange, highValue: parseInt(e.target.value) || 0 })
                    : setNewRange({ ...newRange, highValue: parseInt(e.target.value) || 0 })
                }
                placeholder="e.g., 500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rangeLow">Low Range *</Label>
              <Input
                id="rangeLow"
                type="number"
                value={editingRange?.lowValue ?? newRange.lowValue}
                onChange={(e) =>
                  editingRange
                    ? setEditingRange({ ...editingRange, lowValue: parseInt(e.target.value) || 0 })
                    : setNewRange({ ...newRange, lowValue: parseInt(e.target.value) || 0 })
                }
                placeholder="e.g., 250"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRangeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRange}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BCP Label Dialog */}
      <Dialog open={isBcpDialogOpen} onOpenChange={setIsBcpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBcp ? "Edit BCP Label" : "Add BCP Label"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bcpName">Name *</Label>
              <Input
                id="bcpName"
                value={editingBcp?.name || newBcp.name}
                onChange={(e) =>
                  editingBcp
                    ? setEditingBcp({ ...editingBcp, name: e.target.value })
                    : setNewBcp({ ...newBcp, name: e.target.value })
                }
                placeholder="e.g., Critical, High, RTO"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcpType">Type *</Label>
              <Select
                value={editingBcp?.type || newBcp.type}
                onValueChange={(value) =>
                  editingBcp
                    ? setEditingBcp({ ...editingBcp, type: value })
                    : setNewBcp({ ...newBcp, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RTO">RTO</SelectItem>
                  <SelectItem value="RPO">RPO</SelectItem>
                  <SelectItem value="Criticality">Criticality</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcpHours">Hours</Label>
              <Input
                id="bcpHours"
                type="number"
                value={editingBcp?.hours ?? newBcp.hours}
                onChange={(e) =>
                  editingBcp
                    ? setEditingBcp({ ...editingBcp, hours: parseInt(e.target.value) || 0 })
                    : setNewBcp({ ...newBcp, hours: parseInt(e.target.value) || 0 })
                }
                placeholder="e.g., 4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcpDescription">Description</Label>
              <Input
                id="bcpDescription"
                value={editingBcp?.description || newBcp.description}
                onChange={(e) =>
                  editingBcp
                    ? setEditingBcp({ ...editingBcp, description: e.target.value })
                    : setNewBcp({ ...newBcp, description: e.target.value })
                }
                placeholder="Enter description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBcpDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBcp}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
