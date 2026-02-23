"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { useToast } from "@/hooks/use-toast";
import { ColumnDef } from "@tanstack/react-table";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { isValidName, isValidNumber } from "@/lib/validations";

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
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState("category");
  const [loading, setLoading] = useState(true);

  // Search states for each tab

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
  const [isRatingWarningOpen, setIsRatingWarningOpen] = useState(false);

  // Form states
  const [editingCategory, setEditingCategory] = useState<BIACategory | null>(null);
  const [editingRating, setEditingRating] = useState<BIARating | null>(null);
  const [editingRange, setEditingRange] = useState<BIAScoringRange | null>(null);
  const [editingBcp, setEditingBcp] = useState<BCPLabel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

  // New item forms
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [newRating, setNewRating] = useState({ label: "", score: "" as string | number, description: "" });
  const [newRange, setNewRange] = useState<{ label: string; lowValue: number | ""; highValue: number | "" | null }>({ label: "", lowValue: "", highValue: "" });
  const [newBcp, setNewBcp] = useState({ name: "", type: "RTO", hours: 0, description: "", isActive: true });

  // Inline validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
      toast({ title: t("Error"), description: t("Failed to load BIA settings"), variant: "destructive" });
    }
    setLoading(false);
  };

  // ==================== Category CRUD ====================
  const handleSaveCategory = async () => {
    const name = editingCategory ? editingCategory.name : newCategory.name;
    const errors: Record<string, string> = {};
    if (!name?.trim()) errors.categoryName = t("Please enter the name");
    else if (!isValidName(name.trim())) errors.categoryName = t("Only letters, spaces, and hyphens are allowed");
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
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
        const saved = await res.json();
        const savedId = saved?.id || editingCategory?.id;
        if (savedId) {
          triggerTranslation("BIACategory", savedId, { name: (data as { name?: string }).name || "", description: (data as { description?: string }).description || "" });
        }
        toast({ title: t("Success"), description: isEditing ? t("Category updated successfully") : t("Category created successfully") });
        fetchAllData();
        setIsCategoryDialogOpen(false);
        setEditingCategory(null);
        setNewCategory({ name: "", description: "" });
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to save category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving category:", error);
      toast({ title: t("Error"), description: t("Failed to save category"), variant: "destructive" });
    }
  };

  // ==================== Rating CRUD ====================
  const handleSaveRating = async () => {
    const label = editingRating ? editingRating.label : newRating.label;
    const score = editingRating ? editingRating.score : newRating.score;
    const errors: Record<string, string> = {};
    if (!label?.trim()) errors.ratingLabel = t("Please enter the rating");
    else if (!isValidName(label.trim())) errors.ratingLabel = t("Only letters, spaces, and hyphens are allowed");
    if (score === "" || score === undefined || score === null) errors.ratingScore = t("Please enter the score");
    else if (!isValidNumber(score)) errors.ratingScore = t("Please enter a valid number");
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
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
        const saved = await res.json();
        const savedId = saved?.id || editingRating?.id;
        if (savedId) {
          triggerTranslation("BIARating", savedId, { label: (data as { label?: string }).label || "", description: (data as { description?: string }).description || "" });
        }
        toast({ title: t("Success"), description: isEditing ? t("Rating updated successfully") : t("Rating created successfully") });
        fetchAllData();
        setIsRatingDialogOpen(false);
        setEditingRating(null);
        setNewRating({ label: "", score: "", description: "" });
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to save rating"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving rating:", error);
      toast({ title: t("Error"), description: t("Failed to save rating"), variant: "destructive" });
    }
  };

  // ==================== Scoring Range CRUD ====================
  const handleSaveRange = async () => {
    const rangeLabel = editingRange ? editingRange.label : newRange.label;
    const highValue = editingRange ? editingRange.highValue : newRange.highValue;
    const lowValue = editingRange ? editingRange.lowValue : newRange.lowValue;
    const errors: Record<string, string> = {};
    if (!rangeLabel?.trim()) errors.rangeLabel = t("Please enter the rating");
    else if (!isValidName(rangeLabel.trim())) errors.rangeLabel = t("Only letters, spaces, and hyphens are allowed");
    if (highValue === "" || highValue === null || highValue === undefined) errors.rangeHigh = t("Please enter the high range");
    else if (!isValidNumber(highValue)) errors.rangeHigh = t("Please enter a valid number");
    if (lowValue === "" || lowValue === undefined) errors.rangeLow = t("Please enter the low range");
    else if (!isValidNumber(lowValue)) errors.rangeLow = t("Please enter a valid number");
    if (lowValue !== "" && lowValue !== undefined && highValue !== "" && highValue !== null && highValue !== undefined && Number(lowValue) >= Number(highValue)) {
      errors.rangeLow = t("Low range must be less than high range");
    }
    // Validate High Range based on calculation type
    if ((calculationType === "Product of all" || calculationType === "Addition of all") && highValue !== "" && highValue !== null && highValue !== undefined) {
      const maxScore = ratings.length > 0 ? Math.max(...ratings.map(r => r.score)) : 0;
      const categoryCount = categories.length;
      if (maxScore > 0) {
        const maxAllowed = calculationType === "Product of all"
          ? Math.pow(maxScore, categoryCount)
          : categoryCount * maxScore;
        if (Number(highValue) > maxAllowed) {
          errors.rangeHigh = t("High range must be less than or equal to") + ` ${maxAllowed}`;
        }
      }
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
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
        const saved = await res.json();
        const savedId = saved?.id || editingRange?.id;
        if (savedId) {
          triggerTranslation("BIAScoringRange", savedId, { label: (data as { label?: string }).label || "" });
        }
        toast({ title: t("Success"), description: isEditing ? t("Scoring range updated successfully") : t("Scoring range created successfully") });
        fetchAllData();
        setIsRangeDialogOpen(false);
        setEditingRange(null);
        setNewRange({ label: "", lowValue: "", highValue: "" });
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to save scoring range"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving scoring range:", error);
      toast({ title: t("Error"), description: t("Failed to save scoring range"), variant: "destructive" });
    }
  };

  // ==================== BCP Label CRUD ====================
  const handleSaveBcp = async () => {
    const bcpName = editingBcp ? editingBcp.name : newBcp.name;
    const errors: Record<string, string> = {};
    if (!bcpName?.trim()) errors.bcpName = t("Please enter the name");
    else if (!isValidName(bcpName.trim())) errors.bcpName = t("Only letters, spaces, and hyphens are allowed");
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
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
        const saved = await res.json();
        const savedId = saved?.id || editingBcp?.id;
        if (savedId) {
          triggerTranslation("BCPLabel", savedId, { name: (data as { name?: string }).name || "", description: (data as { description?: string }).description || "" });
        }
        toast({ title: t("Success"), description: isEditing ? t("BCP label updated successfully") : t("BCP label created successfully") });
        fetchAllData();
        setIsBcpDialogOpen(false);
        setEditingBcp(null);
        setNewBcp({ name: "", type: "RTO", hours: 0, description: "", isActive: true });
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to save BCP label"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving BCP label:", error);
      toast({ title: t("Error"), description: t("Failed to save BCP label"), variant: "destructive" });
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
        toast({ title: t("Success"), description: t("Item deleted successfully") });
        fetchAllData();
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete item"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: t("Error"), description: t("Failed to delete item"), variant: "destructive" });
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
      toast({ title: t("Success"), description: t("Calculation type updated") });
    } catch (error) {
      console.error("Error updating calculation type:", error);
    }
  };

  // ==================== Column Definitions ====================
  const categoryColumns: ColumnDef<BIACategory>[] = [
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("name")}</span>,
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
            onClick={() => {
              setEditingCategory(row.original);
              setFormErrors({});
              setIsCategoryDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
            onClick={() => setDeleteTarget({ type: "category", id: row.original.id })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const ratingColumns: ColumnDef<BIARating>[] = [
    {
      accessorKey: "label",
      header: t("Rating"),
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("label")}</span>,
    },
    {
      accessorKey: "score",
      header: t("Score"),
      cell: ({ row }) => <span className="text-slate-600">{row.getValue("score")}</span>,
    },
    {
      accessorKey: "description",
      header: t("Description"),
      cell: ({ row }) => (
        <span className="text-slate-600">{row.getValue("description") || "-"}</span>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
            onClick={() => {
              setEditingRating(row.original);
              setFormErrors({});
              setIsRatingDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
            onClick={() => setDeleteTarget({ type: "rating", id: row.original.id })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const scoringRangeColumns: ColumnDef<BIAScoringRange>[] = [
    {
      accessorKey: "label",
      header: t("Rating"),
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("label")}</span>,
    },
    {
      accessorKey: "highValue",
      header: t("High Range"),
      cell: ({ row }) => <span className="text-slate-600">{row.original.highValue ?? "-"}</span>,
    },
    {
      accessorKey: "lowValue",
      header: t("Low Range"),
      cell: ({ row }) => <span className="text-slate-600">{row.getValue("lowValue")}</span>,
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
            onClick={() => {
              setEditingRange(row.original);
              setFormErrors({});
              setIsRangeDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
            onClick={() => setDeleteTarget({ type: "range", id: row.original.id })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const bcpColumns: ColumnDef<BCPLabel>[] = [
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("name")}</span>,
    },
    // Hidden: Type column kept for future use
    // {
    //   accessorKey: "type",
    //   header: t("Type"),
    //   cell: ({ row }) => <span className="text-slate-600">{row.getValue("type")}</span>,
    // },
    {
      accessorKey: "isActive",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge
          className={
            row.original.isActive
              ? "border-transparent bg-success-light text-success-dark"
              : "border-transparent bg-error-light text-error"
          }
        >
          {row.original.isActive ? t("Active") : t("Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
            onClick={() => {
              setEditingBcp(row.original);
              setFormErrors({});
              setIsBcpDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
            onClick={() => setDeleteTarget({ type: "bcp", id: row.original.id })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // Dynamic data translation hooks
  const { data: translatedCategories } = useTranslatedData(categories, { modelName: "BIACategory" });
  const { data: translatedRatings } = useTranslatedData(ratings, { modelName: "BIARating" });
  const { data: translatedScoringRanges } = useTranslatedData(scoringRanges, { modelName: "BIAScoringRange" });
  const { data: translatedBcpLabels } = useTranslatedData(bcpLabels, { modelName: "BCPLabel" });

  // Filter scoring ranges by calculation type (business logic, not search)
  const filteredScoringRanges = translatedScoringRanges.filter((r) => r.calculationType === calculationType);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading BIA settings...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className={`flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
        <div className={`flex items-center gap-1.5 text-slate-500 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Dashboard")}
        </Link>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <Link href="/organization/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Settings")}
        </Link>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <span className="text-primary-700 font-medium">{t("BIA")}</span>
      </nav>

      {/* Page Header */}
      <div className="w-full" style={isRTL ? { direction: 'rtl' } : undefined}>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("BIA Settings")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className={`overflow-x-auto -mx-1 px-1 ${isRTL ? "flex justify-end" : ""}`}>
        <TabsList className={`w-full sm:w-auto flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
          <TabsTrigger value="category">{t("Category")}</TabsTrigger>
          <TabsTrigger value="methodology">{t("BIA Methodology")}</TabsTrigger>
          <TabsTrigger value="bcp">{t("BCP Labels")}</TabsTrigger>
        </TabsList>
        </div>

        {/* Category Tab */}
        <TabsContent value="category" className="mt-4 sm:mt-6 space-y-4">
          <div className={`flex items-center justify-end [direction:ltr]`}>
            <Button
              size="sm"
              onClick={() => {
                setEditingCategory(null);
                setNewCategory({ name: "", description: "" });
                setFormErrors({});
                setIsCategoryDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Add Category")}
            </Button>
          </div>
          <DataGrid columns={categoryColumns} data={translatedCategories} searchPlaceholder={t("Search categories...")} />
        </TabsContent>

        {/* BIA Methodology Tab */}
        <TabsContent value="methodology" className="mt-4 sm:mt-6 space-y-6 sm:space-y-8">
          {/* BIA Rating Section */}
          <div className="space-y-4">
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
              <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                <h3 className="text-base font-semibold text-slate-800">{t("BIA Rating")}</h3>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingRating(null);
                  setNewRating({ label: "", score: "", description: "" });
                  setFormErrors({});
                  setIsRatingDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Add Rating")}
              </Button>
            </div>
            <DataGrid columns={ratingColumns} data={translatedRatings} searchPlaceholder={t("Search ratings...")} />
          </div>

          {/* BIA Calculation Section */}
          <div className="border-t border-slate-200 pt-6 sm:pt-8 space-y-4">
            <h3 className={`text-base font-semibold text-slate-800 ${isRTL ? "text-right" : ""}`}>{t("BIA Calculation")}</h3>
            <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
              <Label className="text-sm font-medium text-slate-700">{t("Calculation Type")}</Label>
              <Select value={calculationType} onValueChange={handleCalculationTypeChange}>
                <SelectTrigger className="w-full sm:w-[200px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white" position="popper" sideOffset={4}>
                  <SelectItem value="High of all">{t("High of all")}</SelectItem>
                  <SelectItem value="Addition of all">{t("Addition of all")}</SelectItem>
                  <SelectItem value="Product of all">{t("Product of all")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scoring Calculation Grid - Only show for Addition/Product */}
            {calculationType !== "High of all" && (
              <div className="space-y-4 pt-4">
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
                  <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <h4 className="text-sm font-semibold text-slate-800">{t("Scoring Calculation")}</h4>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (ratings.length === 0) {
                        setIsRatingWarningOpen(true);
                        return;
                      }
                      setEditingRange(null);
                      setNewRange({ label: "", lowValue: "", highValue: "" });
                      setFormErrors({});
                      setIsRangeDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Add Range")}
                  </Button>
                </div>
                <DataGrid columns={scoringRangeColumns} data={filteredScoringRanges} searchPlaceholder={t("Search ranges...")} />
              </div>
            )}
          </div>
        </TabsContent>

        {/* BCP Labels Tab */}
        <TabsContent value="bcp" className="mt-4 sm:mt-6 space-y-4">
          <div className={`flex items-center justify-end [direction:ltr]`}>
            <Button
              size="sm"
              onClick={() => {
                setEditingBcp(null);
                setNewBcp({ name: "", type: "RTO", hours: 0, description: "", isActive: true });
                setFormErrors({});
                setIsBcpDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Add BCP Label")}
            </Button>
          </div>
          <DataGrid columns={bcpColumns} data={translatedBcpLabels} searchPlaceholder={t("Search BCP labels...")} />
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editingCategory ? t("Edit Category") : t("Add Category")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Name")} <span className="text-error">*</span>
                </Label>
                <Input
                  value={editingCategory?.name || newCategory.name}
                  onChange={(e) => {
                    if (formErrors.categoryName) setFormErrors((prev) => { const { categoryName, ...rest } = prev; return rest; });
                    editingCategory
                      ? setEditingCategory({ ...editingCategory, name: e.target.value })
                      : setNewCategory({ ...newCategory, name: e.target.value });
                  }}
                  placeholder={t("Enter category name")}
                  className={`mt-1.5 bg-white ${formErrors.categoryName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {formErrors.categoryName && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{formErrors.categoryName}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                <Input
                  value={editingCategory?.description || newCategory.description}
                  onChange={(e) =>
                    editingCategory
                      ? setEditingCategory({ ...editingCategory, description: e.target.value })
                      : setNewCategory({ ...newCategory, description: e.target.value })
                  }
                  placeholder={t("Enter description")}
                  className="mt-1.5 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className={`flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg justify-end [direction:ltr]`}>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveCategory}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editingRating ? t("Edit Rating") : t("Add Rating")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Rating")} <span className="text-error">*</span>
                </Label>
                <Input
                  value={editingRating?.label || newRating.label}
                  onChange={(e) => {
                    if (formErrors.ratingLabel) setFormErrors((prev) => { const { ratingLabel, ...rest } = prev; return rest; });
                    editingRating
                      ? setEditingRating({ ...editingRating, label: e.target.value })
                      : setNewRating({ ...newRating, label: e.target.value });
                  }}
                  placeholder={t("e.g., High, Medium, Low")}
                  className={`mt-1.5 bg-white ${formErrors.ratingLabel ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {formErrors.ratingLabel && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{formErrors.ratingLabel}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Score")} <span className="text-error">*</span>
                </Label>
                <Input
                  type="number"
                  value={editingRating?.score ?? newRating.score}
                  onChange={(e) => {
                    if (formErrors.ratingScore) setFormErrors((prev) => { const { ratingScore, ...rest } = prev; return rest; });
                    editingRating
                      ? setEditingRating({ ...editingRating, score: parseInt(e.target.value) || 0 })
                      : setNewRating({ ...newRating, score: parseInt(e.target.value) || 0 });
                  }}
                  placeholder={t("e.g., 100")}
                  className={`mt-1.5 bg-white ${formErrors.ratingScore ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {formErrors.ratingScore && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{formErrors.ratingScore}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                <Input
                  value={editingRating?.description || newRating.description}
                  onChange={(e) =>
                    editingRating
                      ? setEditingRating({ ...editingRating, description: e.target.value })
                      : setNewRating({ ...newRating, description: e.target.value })
                  }
                  placeholder={t("Enter description")}
                  className="mt-1.5 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className={`flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg justify-end [direction:ltr]`}>
            <Button variant="outline" onClick={() => setIsRatingDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveRating}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scoring Range Dialog */}
      <Dialog open={isRangeDialogOpen} onOpenChange={setIsRangeDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editingRange ? t("Edit Scoring Range") : t("Add Scoring Range")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Rating")} <span className="text-error">*</span>
                </Label>
                <Input
                  value={editingRange?.label || newRange.label}
                  onChange={(e) => {
                    if (formErrors.rangeLabel) setFormErrors((prev) => { const { rangeLabel, ...rest } = prev; return rest; });
                    editingRange
                      ? setEditingRange({ ...editingRange, label: e.target.value })
                      : setNewRange({ ...newRange, label: e.target.value });
                  }}
                  placeholder={t("e.g., Critical, High, Medium, Low")}
                  className={`mt-1.5 bg-white ${formErrors.rangeLabel ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {formErrors.rangeLabel && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{formErrors.rangeLabel}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("High Range")} <span className="text-error">*</span>
                  </Label>
                  <Input
                    type="number"
                    value={(editingRange ? editingRange.highValue : newRange.highValue) ?? ""}
                    onChange={(e) => {
                      if (formErrors.rangeHigh) setFormErrors((prev) => { const { rangeHigh, ...rest } = prev; return rest; });
                      const rawValue = e.target.value;
                      const numValue = rawValue === "" ? null : Number(rawValue);
                      if (editingRange) {
                        setEditingRange({ ...editingRange, highValue: numValue });
                      } else {
                        setNewRange({ ...newRange, highValue: numValue });
                      }
                    }}
                    placeholder={t("e.g., 500")}
                    className={`mt-1.5 bg-white ${formErrors.rangeHigh ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {formErrors.rangeHigh && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{formErrors.rangeHigh}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Low Range")} <span className="text-error">*</span>
                  </Label>
                  <Input
                    type="number"
                    value={(editingRange ? editingRange.lowValue : newRange.lowValue) ?? ""}
                    onChange={(e) => {
                      if (formErrors.rangeLow) setFormErrors((prev) => { const { rangeLow, ...rest } = prev; return rest; });
                      const rawValue = e.target.value;
                      const numValue = rawValue === "" ? null : Number(rawValue);
                      if (editingRange) {
                        setEditingRange({ ...editingRange, lowValue: numValue as number });
                      } else {
                        setNewRange({ ...newRange, lowValue: numValue === null ? "" : numValue });
                      }
                    }}
                    placeholder={t("e.g., 250")}
                    className={`mt-1.5 bg-white ${formErrors.rangeLow ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {formErrors.rangeLow && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{formErrors.rangeLow}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className={`flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg justify-end [direction:ltr]`}>
            <Button variant="outline" onClick={() => setIsRangeDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveRange}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BCP Label Dialog */}
      <Dialog open={isBcpDialogOpen} onOpenChange={setIsBcpDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editingBcp ? t("Edit BCP Label") : t("Add BCP Label")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Name")} <span className="text-error">*</span>
                </Label>
                <Input
                  value={editingBcp?.name || newBcp.name}
                  onChange={(e) => {
                    if (formErrors.bcpName) setFormErrors((prev) => { const { bcpName, ...rest } = prev; return rest; });
                    editingBcp
                      ? setEditingBcp({ ...editingBcp, name: e.target.value })
                      : setNewBcp({ ...newBcp, name: e.target.value });
                  }}
                  placeholder={t("e.g., Critical, High, RTO")}
                  className={`mt-1.5 bg-white ${formErrors.bcpName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {formErrors.bcpName && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{formErrors.bcpName}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                <Input
                  value={editingBcp?.description || newBcp.description}
                  onChange={(e) =>
                    editingBcp
                      ? setEditingBcp({ ...editingBcp, description: e.target.value })
                      : setNewBcp({ ...newBcp, description: e.target.value })
                  }
                  placeholder={t("Enter description")}
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                <div className="flex items-center gap-4 mt-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bcp-status"
                      checked={(editingBcp ? editingBcp.isActive : newBcp.isActive) !== false}
                      onChange={() =>
                        editingBcp
                          ? setEditingBcp({ ...editingBcp, isActive: true })
                          : setNewBcp({ ...newBcp, isActive: true })
                      }
                      className="accent-primary"
                    />
                    <span className="text-sm">{t("Active")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bcp-status"
                      checked={(editingBcp ? editingBcp.isActive : newBcp.isActive) === false}
                      onChange={() =>
                        editingBcp
                          ? setEditingBcp({ ...editingBcp, isActive: false })
                          : setNewBcp({ ...newBcp, isActive: false })
                      }
                      className="accent-primary"
                    />
                    <span className="text-sm">{t("Inactive")}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className={`flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg justify-end [direction:ltr]`}>
            <Button variant="outline" onClick={() => setIsBcpDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveBcp}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[420px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined}>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Item")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <p className="text-sm text-slate-600">
              {t("Are you sure you want to delete this item? This action cannot be undone.")}
            </p>
          </div>
          <div className={`flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg justify-end [direction:ltr]`}>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("Delete")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BIA Rating Warning Dialog */}
      <Dialog open={isRatingWarningOpen} onOpenChange={setIsRatingWarningOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[420px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined}>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Warning")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <p className="text-sm text-slate-600">
              {t("Please add BIA rating before adding scoring ranges.")}
            </p>
          </div>
          <div className={`flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg justify-end [direction:ltr]`}>
            <Button onClick={() => setIsRatingWarningOpen(false)}>{t("OK")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
