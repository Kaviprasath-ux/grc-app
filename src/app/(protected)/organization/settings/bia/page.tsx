"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { DataGrid } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("category");
  const [loading, setLoading] = useState(true);

  // Search states for each tab
  const [categorySearch, setCategorySearch] = useState("");
  const [ratingSearch, setRatingSearch] = useState("");
  const [rangeSearch, setRangeSearch] = useState("");
  const [bcpSearch, setBcpSearch] = useState("");

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
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("name")}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
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
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
            onClick={() => setDeleteTarget({ type: "category", id: row.original.id })}
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
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("label")}</span>,
    },
    {
      accessorKey: "score",
      header: "Score",
      cell: ({ row }) => <span className="text-slate-600">{row.getValue("score")}</span>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-slate-600">{row.getValue("description") || "-"}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
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
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
            onClick={() => setDeleteTarget({ type: "rating", id: row.original.id })}
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
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("label")}</span>,
    },
    {
      accessorKey: "highValue",
      header: "High Range",
      cell: ({ row }) => <span className="text-slate-600">{row.original.highValue ?? "-"}</span>,
    },
    {
      accessorKey: "lowValue",
      header: "Low Range",
      cell: ({ row }) => <span className="text-slate-600">{row.getValue("lowValue")}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
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
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
            onClick={() => setDeleteTarget({ type: "range", id: row.original.id })}
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
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <span className="text-slate-600">{row.getValue("type")}</span>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          className={
            row.original.isActive
              ? "border-transparent bg-success-light text-success-dark"
              : "border-transparent bg-error-light text-error"
          }
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
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
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
            onClick={() => setDeleteTarget({ type: "bcp", id: row.original.id })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Filter data based on search
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const filteredRatings = ratings.filter(
    (r) =>
      r.label.toLowerCase().includes(ratingSearch.toLowerCase()) ||
      r.description?.toLowerCase().includes(ratingSearch.toLowerCase())
  );
  const filteredScoringRanges = scoringRanges
    .filter((r) => r.calculationType === calculationType)
    .filter((r) => r.label.toLowerCase().includes(rangeSearch.toLowerCase()));
  const filteredBcpLabels = bcpLabels.filter(
    (b) =>
      b.name.toLowerCase().includes(bcpSearch.toLowerCase()) ||
      b.type.toLowerCase().includes(bcpSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading BIA settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">BIA Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="methodology">BIA Methodology</TabsTrigger>
          <TabsTrigger value="bcp">BCP Labels</TabsTrigger>
        </TabsList>

        {/* Category Tab */}
        <TabsContent value="category" className="mt-6 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="pl-10 bg-white border-slate-200"
              />
            </div>
            <Button
              size="sm"
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
          <DataGrid columns={categoryColumns} data={filteredCategories} hideSearch={true} />
        </TabsContent>

        {/* BIA Methodology Tab */}
        <TabsContent value="methodology" className="mt-6 space-y-8">
          {/* BIA Rating Section */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-800">BIA Rating</h3>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search ratings..."
                  value={ratingSearch}
                  onChange={(e) => setRatingSearch(e.target.value)}
                  className="pl-10 bg-white border-slate-200"
                />
              </div>
              <Button
                size="sm"
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
            <DataGrid columns={ratingColumns} data={filteredRatings} hideSearch={true} />
          </div>

          {/* BIA Calculation Section */}
          <div className="border-t border-slate-200 pt-8 space-y-4">
            <h3 className="text-base font-semibold text-slate-800">BIA Calculation</h3>
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium text-slate-700">Calculation Type</Label>
              <Select value={calculationType} onValueChange={handleCalculationTypeChange}>
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white" position="popper" sideOffset={4}>
                  <SelectItem value="High of all">High of all</SelectItem>
                  <SelectItem value="Addition of all">Addition of all</SelectItem>
                  <SelectItem value="Product of all">Product of all</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scoring Calculation Grid - Only show for Addition/Product */}
            {calculationType !== "High of all" && (
              <div className="space-y-4 pt-4">
                <h4 className="text-sm font-medium text-slate-700">Scoring Calculation</h4>
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search ranges..."
                      value={rangeSearch}
                      onChange={(e) => setRangeSearch(e.target.value)}
                      className="pl-10 bg-white border-slate-200"
                    />
                  </div>
                  <Button
                    size="sm"
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
                <DataGrid columns={scoringRangeColumns} data={filteredScoringRanges} hideSearch={true} />
              </div>
            )}
          </div>
        </TabsContent>

        {/* BCP Labels Tab */}
        <TabsContent value="bcp" className="mt-6 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search BCP labels..."
                value={bcpSearch}
                onChange={(e) => setBcpSearch(e.target.value)}
                className="pl-10 bg-white border-slate-200"
              />
            </div>
            <Button
              size="sm"
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
          <DataGrid columns={bcpColumns} data={filteredBcpLabels} hideSearch={true} />
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editingCategory ? "Edit Category" : "Add Category"}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Name <span className="text-error">*</span>
                </Label>
                <Input
                  value={editingCategory?.name || newCategory.name}
                  onChange={(e) =>
                    editingCategory
                      ? setEditingCategory({ ...editingCategory, name: e.target.value })
                      : setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  placeholder="Enter category name"
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Description</Label>
                <Input
                  value={editingCategory?.description || newCategory.description}
                  onChange={(e) =>
                    editingCategory
                      ? setEditingCategory({ ...editingCategory, description: e.target.value })
                      : setNewCategory({ ...newCategory, description: e.target.value })
                  }
                  placeholder="Enter description"
                  className="mt-1.5 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editingRating ? "Edit Rating" : "Add Rating"}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Rating <span className="text-error">*</span>
                </Label>
                <Input
                  value={editingRating?.label || newRating.label}
                  onChange={(e) =>
                    editingRating
                      ? setEditingRating({ ...editingRating, label: e.target.value })
                      : setNewRating({ ...newRating, label: e.target.value })
                  }
                  placeholder="e.g., High, Medium, Low"
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Score <span className="text-error">*</span>
                </Label>
                <Input
                  type="number"
                  value={editingRating?.score ?? newRating.score}
                  onChange={(e) =>
                    editingRating
                      ? setEditingRating({ ...editingRating, score: parseInt(e.target.value) || 0 })
                      : setNewRating({ ...newRating, score: parseInt(e.target.value) || 0 })
                  }
                  placeholder="e.g., 100"
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Description</Label>
                <Input
                  value={editingRating?.description || newRating.description}
                  onChange={(e) =>
                    editingRating
                      ? setEditingRating({ ...editingRating, description: e.target.value })
                      : setNewRating({ ...newRating, description: e.target.value })
                  }
                  placeholder="Enter description"
                  className="mt-1.5 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsRatingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRating}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scoring Range Dialog */}
      <Dialog open={isRangeDialogOpen} onOpenChange={setIsRangeDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editingRange ? "Edit Scoring Range" : "Add Scoring Range"}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Rating <span className="text-error">*</span>
                </Label>
                <Input
                  value={editingRange?.label || newRange.label}
                  onChange={(e) =>
                    editingRange
                      ? setEditingRange({ ...editingRange, label: e.target.value })
                      : setNewRange({ ...newRange, label: e.target.value })
                  }
                  placeholder="e.g., Critical, High, Medium, Low"
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">High Range</Label>
                <Input
                  type="number"
                  value={editingRange?.highValue ?? newRange.highValue}
                  onChange={(e) =>
                    editingRange
                      ? setEditingRange({ ...editingRange, highValue: parseInt(e.target.value) || 0 })
                      : setNewRange({ ...newRange, highValue: parseInt(e.target.value) || 0 })
                  }
                  placeholder="e.g., 500"
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Low Range <span className="text-error">*</span>
                </Label>
                <Input
                  type="number"
                  value={editingRange?.lowValue ?? newRange.lowValue}
                  onChange={(e) =>
                    editingRange
                      ? setEditingRange({ ...editingRange, lowValue: parseInt(e.target.value) || 0 })
                      : setNewRange({ ...newRange, lowValue: parseInt(e.target.value) || 0 })
                  }
                  placeholder="e.g., 250"
                  className="mt-1.5 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsRangeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRange}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BCP Label Dialog */}
      <Dialog open={isBcpDialogOpen} onOpenChange={setIsBcpDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editingBcp ? "Edit BCP Label" : "Add BCP Label"}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Name <span className="text-error">*</span>
                </Label>
                <Input
                  value={editingBcp?.name || newBcp.name}
                  onChange={(e) =>
                    editingBcp
                      ? setEditingBcp({ ...editingBcp, name: e.target.value })
                      : setNewBcp({ ...newBcp, name: e.target.value })
                  }
                  placeholder="e.g., Critical, High, RTO"
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Type <span className="text-error">*</span>
                </Label>
                <Select
                  value={editingBcp?.type || newBcp.type}
                  onValueChange={(value) =>
                    editingBcp
                      ? setEditingBcp({ ...editingBcp, type: value })
                      : setNewBcp({ ...newBcp, type: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white" position="popper" sideOffset={4}>
                    <SelectItem value="RTO">RTO</SelectItem>
                    <SelectItem value="RPO">RPO</SelectItem>
                    <SelectItem value="Criticality">Criticality</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Hours</Label>
                <Input
                  type="number"
                  value={editingBcp?.hours ?? newBcp.hours}
                  onChange={(e) =>
                    editingBcp
                      ? setEditingBcp({ ...editingBcp, hours: parseInt(e.target.value) || 0 })
                      : setNewBcp({ ...newBcp, hours: parseInt(e.target.value) || 0 })
                  }
                  placeholder="e.g., 4"
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Description</Label>
                <Input
                  value={editingBcp?.description || newBcp.description}
                  onChange={(e) =>
                    editingBcp
                      ? setEditingBcp({ ...editingBcp, description: e.target.value })
                      : setNewBcp({ ...newBcp, description: e.target.value })
                  }
                  placeholder="Enter description"
                  className="mt-1.5 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsBcpDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBcp}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
