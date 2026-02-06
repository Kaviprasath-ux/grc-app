"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, ArrowLeft, Search, Upload, Download, FolderTree, Clock, Settings2, Lock, CheckCircle, RefreshCw, Layers, FolderOpen, Group, Home, ChevronRight } from "lucide-react";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  status: string;
  _count?: { subCategories: number; assets: number };
}

interface AssetSubCategory {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  category: AssetCategory;
  status: string;
  _count?: { assets: number };
}

interface AssetGroup {
  id: string;
  name: string;
  description: string | null;
  _count?: { assets: number };
}

interface AssetLifecycleStatus {
  id: string;
  name: string;
  description: string | null;
  order: number;
  _count?: { assets: number };
}

interface AssetSensitivity {
  id: string;
  name: string;
  description: string | null;
  _count?: { assets: number };
}

interface Asset {
  id: string;
  assetId: string;
  name: string;
  location: string | null;
  value: number | null;
  acquisitionDate: string | null;
  nextReviewDate: string | null;
  lifecycleStatus: AssetLifecycleStatus | null;
  sensitivity: AssetSensitivity | null;
}

interface CIARating {
  id: string;
  type: string; // Confidentiality, Integrity, Availability
  label: string; // high, medium, low
  value: number;
}

interface ScoringConfig {
  id: string;
  level: string;
  minScore: number;
  maxScore: number;
  color: string;
}

// Setting categories for block navigation (matching UAT: CIA, Asset, Lifecycle Status)
const settingCategoriesConfig = [
  {
    id: "cia",
    titleKey: "CIA",
    descriptionKey: "Configure CIA ratings and scoring",
    icon: Settings2,
  },
  {
    id: "asset",
    titleKey: "Asset",
    descriptionKey: "Manage asset entities and configurations",
    icon: FolderTree,
  },
  {
    id: "lifecycle",
    titleKey: "Lifecycle Status",
    descriptionKey: "Define asset lifecycle stages",
    icon: Clock,
  },
];

// Entity sub-categories for navigation (under Asset section - matching UAT)
const entitySubCategoriesConfig = [
  {
    id: "asset-list",
    titleKey: "Asset",
    descriptionKey: "View and manage all assets",
    icon: FolderOpen,
  },
  {
    id: "subcategories",
    titleKey: "Asset Sub Category",
    descriptionKey: "Sub-categories under main categories",
    icon: Layers,
  },
  {
    id: "groups",
    titleKey: "Asset Group",
    descriptionKey: "Logical groupings for assets",
    icon: Group,
  },
  {
    id: "categories",
    titleKey: "Asset Category",
    descriptionKey: "Top-level asset categories (e.g., Hardware, Software)",
    icon: FolderOpen,
  },
  {
    id: "sensitivity",
    titleKey: "Asset Sensitivity",
    descriptionKey: "Asset sensitivity levels",
    icon: Lock,
  },
];

const SCORING_CALCULATION_TYPES_CONFIG = [
  { value: "high_of_all", labelKey: "High of all" },
  { value: "addition_of_all", labelKey: "Addition of all" },
  { value: "product_of_all", labelKey: "Product of all" },
];

export default function AssetSettingsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [entitySubTab, setEntitySubTab] = useState<string | null>(null);

  // Translated arrays
  const settingCategories = settingCategoriesConfig.map(cat => ({
    ...cat,
    title: t(cat.titleKey),
    description: t(cat.descriptionKey),
  }));

  const entitySubCategories = entitySubCategoriesConfig.map(cat => ({
    ...cat,
    title: t(cat.titleKey),
    description: t(cat.descriptionKey),
  }));

  const SCORING_CALCULATION_TYPES = SCORING_CALCULATION_TYPES_CONFIG.map(type => ({
    ...type,
    label: t(type.labelKey),
  }));

  // Data states
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [subCategories, setSubCategories] = useState<AssetSubCategory[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [lifecycleStatuses, setLifecycleStatuses] = useState<AssetLifecycleStatus[]>([]);
  const [sensitivities, setSensitivities] = useState<AssetSensitivity[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ciaRatings, setCiaRatings] = useState<CIARating[]>([]);
  const [scoringCalculationType, setScoringCalculationType] = useState("high_of_all");
  const [highOfAllConfigs, setHighOfAllConfigs] = useState<ScoringConfig[]>([]);
  const [additionOfAllConfigs, setAdditionOfAllConfigs] = useState<ScoringConfig[]>([]);
  const [productOfAllConfigs, setProductOfAllConfigs] = useState<ScoringConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AssetCategory | AssetSubCategory | AssetGroup | AssetLifecycleStatus | null>(null);

  // CIA Rating dialog states
  const [isCiaAddOpen, setIsCiaAddOpen] = useState(false);
  const [isCiaEditOpen, setIsCiaEditOpen] = useState(false);
  const [isCiaDeleteOpen, setIsCiaDeleteOpen] = useState(false);
  const [selectedCiaRating, setSelectedCiaRating] = useState<CIARating | null>(null);
  const [ciaRatingType, setCiaRatingType] = useState<string>("Confidentiality");

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", status: "Active" });
  const [subCategoryForm, setSubCategoryForm] = useState({ name: "", description: "", categoryId: "", status: "Active" });
  const [groupForm, setGroupForm] = useState({ name: "", description: "", status: "Active", subCategoryId: "" });
  const [lifecycleForm, setLifecycleForm] = useState({ name: "", description: "", order: 0 });
  const [sensitivityForm, setSensitivityForm] = useState({ name: "", description: "" });
  const [assetForm, setAssetForm] = useState({
    name: "",
    assetId: "",
    location: "",
    categoryId: "",
    subCategoryId: "",
    groupId: "",
    sensitivityId: "",
    lifecycleStatusId: "",
    value: 0
  });
  const [ciaRatingForm, setCiaRatingForm] = useState({ label: "", value: 0 });
  const [scoringConfigForm, setScoringConfigForm] = useState({ level: "", minScore: 0, maxScore: 0, color: "#000000" });
  const [isScoringAddOpen, setIsScoringAddOpen] = useState(false);
  const [isScoringEditOpen, setIsScoringEditOpen] = useState(false);
  const [isScoringDeleteOpen, setIsScoringDeleteOpen] = useState(false);
  const [selectedScoringConfig, setSelectedScoringConfig] = useState<ScoringConfig | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, subCatRes, groupRes, lifecycleRes, sensRes, assetRes, ciaRes] = await Promise.all([
        fetch("/api/asset-categories"),
        fetch("/api/asset-sub-categories"),
        fetch("/api/asset-groups"),
        fetch("/api/asset-lifecycle-statuses"),
        fetch("/api/asset-sensitivities"),
        fetch("/api/assets"),
        fetch("/api/cia-ratings"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (subCatRes.ok) setSubCategories(await subCatRes.json());
      if (groupRes.ok) setGroups(await groupRes.json());
      if (lifecycleRes.ok) setLifecycleStatuses(await lifecycleRes.json());
      if (sensRes.ok) setSensitivities(await sensRes.json());
      if (assetRes.ok) setAssets(await assetRes.json());
      if (ciaRes.ok) setCiaRatings(await ciaRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Filter CIA ratings by type
  const confidentialityRatings = ciaRatings.filter(r => r.type === "Confidentiality");
  const integrityRatings = ciaRatings.filter(r => r.type === "Integrity");
  const availabilityRatings = ciaRatings.filter(r => r.type === "Availability");

  // Category CRUD
  const handleAddCategory = async () => {
    if (!categoryForm.name.trim()) return;
    try {
      const res = await fetch("/api/asset-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      if (res.ok) {
        const created = await res.json();
        setCategories([...categories, created]);
        setCategoryForm({ name: "", description: "", status: "Active" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleEditCategory = async () => {
    if (!selectedItem || !categoryForm.name.trim()) return;
    try {
      const res = await fetch(`/api/asset-categories/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setCategories(categories.map((c) => (c.id === updated.id ? updated : c)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-categories/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setCategories(categories.filter((c) => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  // SubCategory CRUD
  const handleAddSubCategory = async () => {
    if (!subCategoryForm.name.trim() || !subCategoryForm.categoryId) return;
    try {
      const res = await fetch("/api/asset-sub-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subCategoryForm),
      });
      if (res.ok) {
        const created = await res.json();
        setSubCategories([...subCategories, created]);
        setSubCategoryForm({ name: "", description: "", categoryId: "", status: "Active" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create sub-category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding sub-category:", error);
    }
  };

  const handleEditSubCategory = async () => {
    if (!selectedItem || !subCategoryForm.name.trim()) return;
    try {
      const res = await fetch(`/api/asset-sub-categories/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subCategoryForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setSubCategories(subCategories.map((c) => (c.id === updated.id ? updated : c)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update sub-category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating sub-category:", error);
    }
  };

  const handleDeleteSubCategory = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-sub-categories/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setSubCategories(subCategories.filter((c) => c.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete sub-category"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting sub-category:", error);
    }
  };

  // Group CRUD
  const handleAddGroup = async () => {
    if (!groupForm.name.trim()) return;
    try {
      const res = await fetch("/api/asset-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });
      if (res.ok) {
        const created = await res.json();
        setGroups([...groups, created]);
        setGroupForm({ name: "", description: "", status: "Active", subCategoryId: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create group"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding group:", error);
    }
  };

  const handleEditGroup = async () => {
    if (!selectedItem || !groupForm.name.trim()) return;
    try {
      const res = await fetch(`/api/asset-groups/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setGroups(groups.map((g) => (g.id === updated.id ? updated : g)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update group"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating group:", error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-groups/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setGroups(groups.filter((g) => g.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete group"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  // Lifecycle Status CRUD
  const handleAddLifecycle = async () => {
    if (!lifecycleForm.name.trim()) return;
    try {
      const res = await fetch("/api/asset-lifecycle-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lifecycleForm),
      });
      if (res.ok) {
        const created = await res.json();
        setLifecycleStatuses([...lifecycleStatuses, created]);
        setLifecycleForm({ name: "", description: "", order: 0 });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create lifecycle status"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding lifecycle status:", error);
    }
  };

  const handleEditLifecycle = async () => {
    if (!selectedItem || !lifecycleForm.name.trim()) return;
    try {
      const res = await fetch(`/api/asset-lifecycle-statuses/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lifecycleForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setLifecycleStatuses(lifecycleStatuses.map((l) => (l.id === updated.id ? updated : l)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update lifecycle status"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating lifecycle status:", error);
    }
  };

  const handleDeleteLifecycle = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-lifecycle-statuses/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setLifecycleStatuses(lifecycleStatuses.filter((l) => l.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete lifecycle status"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting lifecycle status:", error);
    }
  };

  // Asset CRUD
  const handleAddAsset = async () => {
    if (!assetForm.name.trim() || !assetForm.assetId.trim()) return;
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetForm.name,
          assetId: assetForm.assetId,
          location: assetForm.location || null,
          categoryId: assetForm.categoryId || null,
          subCategoryId: assetForm.subCategoryId || null,
          groupId: assetForm.groupId || null,
          sensitivityId: assetForm.sensitivityId || null,
          lifecycleStatusId: assetForm.lifecycleStatusId || null,
          value: assetForm.value || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setAssets([...assets, created]);
        setAssetForm({
          name: "",
          assetId: "",
          location: "",
          categoryId: "",
          subCategoryId: "",
          groupId: "",
          sensitivityId: "",
          lifecycleStatusId: "",
          value: 0
        });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create asset"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding asset:", error);
    }
  };

  // Sensitivity CRUD
  const handleAddSensitivity = async () => {
    if (!sensitivityForm.name.trim()) return;
    try {
      const res = await fetch("/api/asset-sensitivities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sensitivityForm),
      });
      if (res.ok) {
        const created = await res.json();
        setSensitivities([...sensitivities, created]);
        setSensitivityForm({ name: "", description: "" });
        setIsAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create sensitivity"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding sensitivity:", error);
    }
  };

  const handleEditSensitivity = async () => {
    if (!selectedItem || !sensitivityForm.name.trim()) return;
    try {
      const res = await fetch(`/api/asset-sensitivities/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sensitivityForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setSensitivities(sensitivities.map((s) => (s.id === updated.id ? updated : s)));
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update sensitivity"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating sensitivity:", error);
    }
  };

  const handleDeleteSensitivity = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/asset-sensitivities/${selectedItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setSensitivities(sensitivities.filter((s) => s.id !== selectedItem.id));
        setIsDeleteOpen(false);
        setSelectedItem(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete sensitivity"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting sensitivity:", error);
    }
  };

  // CIA Rating CRUD
  const handleAddCiaRating = async () => {
    if (!ciaRatingForm.label.trim()) return;
    try {
      const res = await fetch("/api/cia-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: ciaRatingType,
          label: ciaRatingForm.label,
          value: ciaRatingForm.value,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCiaRatings([...ciaRatings, created]);
        setCiaRatingForm({ label: "", value: 0 });
        setIsCiaAddOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create CIA rating"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding CIA rating:", error);
    }
  };

  const handleEditCiaRating = async () => {
    if (!selectedCiaRating || !ciaRatingForm.label.trim()) return;
    try {
      const res = await fetch(`/api/cia-ratings/${selectedCiaRating.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedCiaRating.type,
          label: ciaRatingForm.label,
          value: ciaRatingForm.value,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCiaRatings(ciaRatings.map((r) => (r.id === updated.id ? updated : r)));
        setIsCiaEditOpen(false);
        setSelectedCiaRating(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update CIA rating"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating CIA rating:", error);
    }
  };

  const handleDeleteCiaRating = async () => {
    if (!selectedCiaRating) return;
    try {
      const res = await fetch(`/api/cia-ratings/${selectedCiaRating.id}`, { method: "DELETE" });
      if (res.ok) {
        setCiaRatings(ciaRatings.filter((r) => r.id !== selectedCiaRating.id));
        setIsCiaDeleteOpen(false);
        setSelectedCiaRating(null);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete CIA rating"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting CIA rating:", error);
    }
  };

  // Scoring Configuration handlers
  // Get current configs based on calculation type
  const getCurrentConfigs = () => {
    switch (scoringCalculationType) {
      case "high_of_all": return highOfAllConfigs;
      case "addition_of_all": return additionOfAllConfigs;
      case "product_of_all": return productOfAllConfigs;
      default: return highOfAllConfigs;
    }
  };

  const setCurrentConfigs = (configs: ScoringConfig[]) => {
    switch (scoringCalculationType) {
      case "high_of_all": setHighOfAllConfigs(configs); break;
      case "addition_of_all": setAdditionOfAllConfigs(configs); break;
      case "product_of_all": setProductOfAllConfigs(configs); break;
    }
  };

  const handleAddScoringConfig = () => {
    if (!scoringConfigForm.level.trim()) return;

    const currentConfigs = getCurrentConfigs();

    // Check for duplicate rating name
    const duplicateLevel = currentConfigs.find(
      c => c.level.toLowerCase() === scoringConfigForm.level.trim().toLowerCase()
    );
    if (duplicateLevel) {
      toast({ title: t("Error"), description: t("Rating already exists"), variant: "destructive" });
      return;
    }

    // Check that low range and high range are not the same (for addition/product types)
    if (scoringCalculationType !== "high_of_all" && scoringConfigForm.minScore === scoringConfigForm.maxScore) {
      toast({ title: t("Error"), description: t("Low range and High range cannot be the same"), variant: "destructive" });
      return;
    }

    // Check for overlapping ranges (for addition/product types)
    if (scoringCalculationType !== "high_of_all") {
      const newMin = scoringConfigForm.minScore;
      const newMax = scoringConfigForm.maxScore;

      const overlappingRange = currentConfigs.find(c => {
        // Check if new range overlaps with existing range
        // Overlap exists if: newMin <= existingMax AND newMax >= existingMin
        return newMin <= c.maxScore && newMax >= c.minScore;
      });

      if (overlappingRange) {
        toast({ title: t("Error"), description: t("Range overlaps with existing range"), variant: "destructive" });
        return;
      }
    } else {
      // For high_of_all, just check duplicate high value
      const duplicateRange = currentConfigs.find(c => c.maxScore === scoringConfigForm.maxScore);
      if (duplicateRange) {
        toast({ title: t("Error"), description: t("Range value already exists"), variant: "destructive" });
        return;
      }
    }

    const newConfig: ScoringConfig = {
      id: Date.now().toString(),
      level: scoringConfigForm.level,
      minScore: scoringConfigForm.minScore,
      maxScore: scoringConfigForm.maxScore,
      color: scoringConfigForm.color,
    };
    setCurrentConfigs([...currentConfigs, newConfig]);
    setScoringConfigForm({ level: "", minScore: 0, maxScore: 0, color: "#000000" });
    setIsScoringAddOpen(false);
  };

  const handleUpdateScoringConfig = () => {
    if (!selectedScoringConfig) return;

    // Check that low range and high range are not the same (for addition/product types)
    if (scoringCalculationType !== "high_of_all" && scoringConfigForm.minScore === scoringConfigForm.maxScore) {
      toast({ title: t("Error"), description: t("Low range and High range cannot be the same"), variant: "destructive" });
      return;
    }

    const currentConfigs = getCurrentConfigs();

    // Check for overlapping ranges (exclude the current item being edited)
    if (scoringCalculationType !== "high_of_all") {
      const newMin = scoringConfigForm.minScore;
      const newMax = scoringConfigForm.maxScore;

      const overlappingRange = currentConfigs.find(c => {
        if (c.id === selectedScoringConfig.id) return false; // Skip current item
        return newMin <= c.maxScore && newMax >= c.minScore;
      });

      if (overlappingRange) {
        toast({ title: t("Error"), description: t("Range overlaps with existing range"), variant: "destructive" });
        return;
      }
    } else {
      const duplicateRange = currentConfigs.find(c =>
        c.id !== selectedScoringConfig.id && c.maxScore === scoringConfigForm.maxScore
      );
      if (duplicateRange) {
        toast({ title: t("Error"), description: t("Range value already exists"), variant: "destructive" });
        return;
      }
    }

    setCurrentConfigs(currentConfigs.map(c =>
      c.id === selectedScoringConfig.id
        ? { ...c, level: scoringConfigForm.level, minScore: scoringConfigForm.minScore, maxScore: scoringConfigForm.maxScore, color: scoringConfigForm.color }
        : c
    ));
    setIsScoringEditOpen(false);
    setSelectedScoringConfig(null);
  };

  const handleDeleteScoringConfig = () => {
    if (!selectedScoringConfig) return;
    const currentConfigs = getCurrentConfigs();
    setCurrentConfigs(currentConfigs.filter(c => c.id !== selectedScoringConfig.id));
    setIsScoringDeleteOpen(false);
    setSelectedScoringConfig(null);
  };

  // Export handlers for each entity type
  const handleExportCategories = () => {
    const headers = ["Name", "Description", "Status"];
    const rows = categories.map(c => [c.name, c.description || "", c.status]);
    exportToCSV(headers, rows, "asset_categories");
  };

  const handleExportSubCategories = () => {
    const headers = ["Name", "Description", "Category", "Status"];
    const rows = subCategories.map(c => [c.name, c.description || "", c.category?.name || "", c.status]);
    exportToCSV(headers, rows, "asset_sub_categories");
  };

  const handleExportGroups = () => {
    const headers = ["Name", "Description"];
    const rows = groups.map(g => [g.name, g.description || ""]);
    exportToCSV(headers, rows, "asset_groups");
  };

  const handleExportSensitivities = () => {
    const headers = ["Name", "Description"];
    const rows = sensitivities.map(s => [s.name, s.description || ""]);
    exportToCSV(headers, rows, "asset_sensitivities");
  };

  const handleExportLifecycleStatuses = () => {
    const headers = ["Name", "Description", "Order"];
    const rows = lifecycleStatuses.map(l => [l.name, l.description || "", l.order.toString()]);
    exportToCSV(headers, rows, "lifecycle_statuses");
  };

  const handleExportAssets = () => {
    const headers = ["Asset ID", "Name", "Location", "Lifecycle Status", "Sensitivity"];
    const rows = assets.map(a => [
      a.assetId,
      a.name,
      a.location || "",
      a.lifecycleStatus?.name || "",
      a.sensitivity?.name || "",
    ]);
    exportToCSV(headers, rows, "assets");
  };

  const exportToCSV = (headers: string[], rows: string[][], filename: string) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import handler for categories
  const handleImportCategories = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("Invalid CSV file"), variant: "destructive" });
        return;
      }

      const dataRows = lines.slice(1);
      let imported = 0;

      for (const line of dataRows) {
        const cells = parseCSVLine(line);
        const [name, description, status] = cells;
        if (!name) continue;

        try {
          const res = await fetch("/api/asset-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description: description || "", status: status || "Active" }),
          });
          if (res.ok) imported++;
        } catch { /* skip errors */ }
      }

      fetchData();
      toast({ title: t("Success"), description: `${t("Imported")} ${imported} ${t("categories")}` });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Import handler for lifecycle statuses
  const handleImportLifecycleStatuses = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: t("Error"), description: t("Invalid CSV file"), variant: "destructive" });
        return;
      }

      const dataRows = lines.slice(1);
      let imported = 0;

      for (const line of dataRows) {
        const cells = parseCSVLine(line);
        const [name, description, order] = cells;
        if (!name) continue;

        try {
          const res = await fetch("/api/asset-lifecycle-statuses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description: description || "", order: parseInt(order) || 0 }),
          });
          if (res.ok) imported++;
        } catch { /* skip errors */ }
      }

      fetchData();
      toast({ title: t("Success"), description: `${t("Imported")} ${imported} ${t("lifecycle statuses")}` });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Helper function to parse CSV line
  const parseCSVLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  // Get export handler based on entity type
  const getExportHandler = () => {
    switch (entitySubTab) {
      case "categories": return handleExportCategories;
      case "subcategories": return handleExportSubCategories;
      case "groups": return handleExportGroups;
      case "sensitivity": return handleExportSensitivities;
      case "asset-list": return handleExportAssets;
      default: return () => {};
    }
  };

  // Column definitions - Asset Category (matching UAT: Title, Status, Action)
  const categoryColumns: ColumnDef<AssetCategory>[] = [
    { accessorKey: "name", header: t("Title") },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant={row.getValue("status") === "Active" ? "default" : "secondary"}>
          {row.getValue("status") as string}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedItem(row.original);
              setCategoryForm({
                name: row.original.name,
                description: row.original.description || "",
                status: row.original.status,
              });
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setSelectedItem(row.original);
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Asset Sub Category columns matching UAT
  const subCategoryColumns: ColumnDef<AssetSubCategory>[] = [
    { accessorKey: "category.name", header: t("Asset Category"), cell: ({ row }) => row.original.category?.name || "-" },
    { accessorKey: "name", header: t("Asset Sub-Category") },
    { accessorKey: "description", header: t("Description"), cell: ({ row }) => row.getValue("description") || "-" },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant={row.getValue("status") === "Active" ? "default" : "secondary"}>
          {row.getValue("status") as string}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedItem(row.original);
              setSubCategoryForm({
                name: row.original.name,
                description: row.original.description || "",
                categoryId: row.original.categoryId,
                status: row.original.status,
              });
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setSelectedItem(row.original);
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const groupColumns: ColumnDef<AssetGroup>[] = [
    { accessorKey: "name", header: t("Name") },
    { accessorKey: "description", header: t("Description"), cell: ({ row }) => row.getValue("description") || "-" },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant={(row.original as any).status === "Active" ? "default" : "secondary"}>
          {(row.original as any).status || "Active"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedItem(row.original);
              setGroupForm({
                name: row.original.name,
                description: row.original.description || "",
                status: (row.original as any).status || "Active",
                subCategoryId: (row.original as any).subCategoryId || "",
              });
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setSelectedItem(row.original);
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const sensitivityColumns: ColumnDef<AssetSensitivity>[] = [
    { accessorKey: "name", header: t("Name") },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedItem(row.original as any);
              setSensitivityForm({
                name: row.original.name,
                description: row.original.description || "",
              });
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setSelectedItem(row.original as any);
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Asset list columns for settings view (matching UAT)
  const assetSettingsColumns: ColumnDef<Asset>[] = [
    { accessorKey: "name", header: t("Name") },
    { accessorKey: "assetId", header: t("ID") },
    { accessorKey: "location", header: t("Location"), cell: ({ row }) => row.getValue("location") || "-" },
    { accessorKey: "value", header: t("Value"), cell: ({ row }) => row.getValue("value") || "-" },
    {
      accessorKey: "acquisitionDate",
      header: t("Acquisition date"),
      cell: ({ row }) => row.original.acquisitionDate
        ? new Date(row.original.acquisitionDate).toLocaleDateString('en-GB')
        : "-"
    },
    {
      accessorKey: "lifecycleStatus.name",
      header: t("Status"),
      cell: ({ row }) => row.original.lifecycleStatus?.name || "-"
    },
    {
      accessorKey: "nextReviewDate",
      header: t("Next review date"),
      cell: ({ row }) => row.original.nextReviewDate
        ? new Date(row.original.nextReviewDate).toLocaleDateString('en-GB')
        : "-"
    },
    {
      accessorKey: "sensitivity.name",
      header: t("Asset sensitivity"),
      cell: ({ row }) => row.original.sensitivity?.name || "-"
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Lifecycle columns matching UAT (Name, Action only)
  const lifecycleColumns: ColumnDef<AssetLifecycleStatus>[] = [
    { accessorKey: "name", header: t("Name") },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedItem(row.original);
              setLifecycleForm({
                name: row.original.name,
                description: row.original.description || "",
                order: row.original.order,
              });
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setSelectedItem(row.original);
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Get current category info
  const currentCategory = settingCategories.find((c) => c.id === activeCategory);
  const currentEntitySub = entitySubCategories.find((e) => e.id === entitySubTab);

  // Get item counts for cards
  const getItemCount = (categoryId: string) => {
    switch (categoryId) {
      case "asset":
        return assets.length + subCategories.length + groups.length + categories.length + sensitivities.length;
      case "lifecycle":
        return lifecycleStatuses.length;
      case "cia":
        return ciaRatings.length;
      default:
        return 0;
    }
  };

  const getEntitySubCount = (subId: string) => {
    switch (subId) {
      case "asset-list":
        return assets.length;
      case "categories":
        return categories.length;
      case "subcategories":
        return subCategories.length;
      case "groups":
        return groups.length;
      case "sensitivity":
        return sensitivities.length;
      default:
        return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading settings...")}</p>
        </div>
      </div>
    );
  }

  // Show entity sub-category list (Asset, Asset Sub Category, Asset Group, Asset Category, Asset Sensitivity)
  if (activeCategory === "asset" && entitySubTab) {
    const getData = () => {
      switch (entitySubTab) {
        case "asset-list":
          return assets.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.assetId.toLowerCase().includes(searchTerm.toLowerCase()));
        case "categories":
          return categories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        case "subcategories":
          return subCategories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        case "groups":
          return groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
        case "sensitivity":
          return sensitivities.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        default:
          return [];
      }
    };

    const getColumns = () => {
      switch (entitySubTab) {
        case "asset-list":
          return assetSettingsColumns;
        case "categories":
          return categoryColumns;
        case "subcategories":
          return subCategoryColumns;
        case "groups":
          return groupColumns;
        case "sensitivity":
          return sensitivityColumns;
        default:
          return [];
      }
    };

    const getAddButtonLabel = () => {
      switch (entitySubTab) {
        case "asset-list": return t("New Asset");
        case "subcategories": return t("New Asset Sub Category");
        case "groups": return t("New Asset Group");
        case "categories": return t("New Asset Category");
        case "sensitivity": return t("New Asset Sensitivity");
        default: return t("Add New");
      }
    };

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Asset Management")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <button onClick={() => setEntitySubTab(null)} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{currentEntitySub?.title || t("Settings")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{currentEntitySub?.title || t("Settings")}</h1>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t("Search...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-[250px] bg-white border-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            {entitySubTab === "categories" && (
              <label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCategories}
                  className="hidden"
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Download className="h-4 w-4 mr-2" />
                    {t("Import")}
                  </span>
                </Button>
              </label>
            )}
            <Button variant="outline" size="sm" onClick={getExportHandler()}>
              <Upload className="h-4 w-4 mr-2" />
              {t("Export")}
            </Button>
            <Button size="sm" onClick={() => {
              if (entitySubTab === "categories") {
                setCategoryForm({ name: "", description: "", status: "Active" });
              } else if (entitySubTab === "subcategories") {
                setSubCategoryForm({ name: "", description: "", categoryId: "", status: "Active" });
              } else if (entitySubTab === "groups") {
                setGroupForm({ name: "", description: "", status: "Active", subCategoryId: "" });
              } else if (entitySubTab === "sensitivity") {
                setSensitivityForm({ name: "", description: "" });
              } else if (entitySubTab === "asset-list") {
                setAssetForm({
                  name: "",
                  assetId: "",
                  location: "",
                  categoryId: "",
                  subCategoryId: "",
                  groupId: "",
                  sensitivityId: "",
                  lifecycleStatusId: "",
                  value: 0
                });
              }
              setIsAddOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              {getAddButtonLabel()}
            </Button>
          </div>
        </div>

        <DataGrid
          columns={getColumns() as ColumnDef<AssetCategory | AssetSubCategory | AssetGroup | AssetSensitivity | Asset>[]}
          data={getData()}
          hideSearch={true}
        />

        {/* Add Dialog for Entity List */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>
                {t("Add")} {entitySubTab === "categories" ? t("Category") :
                     entitySubTab === "subcategories" ? t("Sub Category") :
                     entitySubTab === "groups" ? t("Group") :
                     entitySubTab === "sensitivity" ? t("Sensitivity") :
                     entitySubTab === "asset-list" ? t("Asset") : t("Item")}
              </DialogTitle>
              <DialogDescription>
                {t("Enter the details for the new item")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {entitySubTab === "asset-list" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("Asset ID")} *</Label>
                      <Input
                        value={assetForm.assetId}
                        onChange={(e) => setAssetForm({ ...assetForm, assetId: e.target.value })}
                        placeholder={t("e.g., AST-001")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("Name")} *</Label>
                      <Input
                        value={assetForm.name}
                        onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                        placeholder={t("e.g., Production Server 1")}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("Category")}</Label>
                      <Select
                        value={assetForm.categoryId}
                        onValueChange={(value) => setAssetForm({ ...assetForm, categoryId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select category")} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("Sub Category")}</Label>
                      <Select
                        value={assetForm.subCategoryId}
                        onValueChange={(value) => setAssetForm({ ...assetForm, subCategoryId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select sub category")} />
                        </SelectTrigger>
                        <SelectContent>
                          {subCategories
                            .filter(sc => !assetForm.categoryId || sc.categoryId === assetForm.categoryId)
                            .map((sc) => (
                              <SelectItem key={sc.id} value={sc.id}>
                                {sc.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("Group")}</Label>
                      <Select
                        value={assetForm.groupId}
                        onValueChange={(value) => setAssetForm({ ...assetForm, groupId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select group")} />
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
                    <div className="space-y-2">
                      <Label>{t("Sensitivity")}</Label>
                      <Select
                        value={assetForm.sensitivityId}
                        onValueChange={(value) => setAssetForm({ ...assetForm, sensitivityId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select sensitivity")} />
                        </SelectTrigger>
                        <SelectContent>
                          {sensitivities.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("Lifecycle Status")}</Label>
                      <Select
                        value={assetForm.lifecycleStatusId}
                        onValueChange={(value) => setAssetForm({ ...assetForm, lifecycleStatusId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select status")} />
                        </SelectTrigger>
                        <SelectContent>
                          {lifecycleStatuses.map((ls) => (
                            <SelectItem key={ls.id} value={ls.id}>
                              {ls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("Value")}</Label>
                      <Input
                        type="number"
                        value={assetForm.value || ""}
                        onChange={(e) => setAssetForm({ ...assetForm, value: parseFloat(e.target.value) || 0 })}
                        placeholder={t("e.g., 10000")}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Location")}</Label>
                    <Input
                      value={assetForm.location}
                      onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                      placeholder={t("e.g., Data Center 1")}
                    />
                  </div>
                </>
              )}

              {entitySubTab === "categories" && (
                <>
                  <div className="space-y-2">
                    <Label>{t("Name")} *</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder={t("e.g., Hardware, Software, Data")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Status")}</Label>
                    <Select
                      value={categoryForm.status}
                      onValueChange={(value) => setCategoryForm({ ...categoryForm, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">{t("Active")}</SelectItem>
                        <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {entitySubTab === "subcategories" && (
                <>
                  <div className="space-y-2">
                    <Label>{t("Category")} *</Label>
                    <Select
                      value={subCategoryForm.categoryId}
                      onValueChange={(value) => setSubCategoryForm({ ...subCategoryForm, categoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("Select category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Name")} *</Label>
                    <Input
                      value={subCategoryForm.name}
                      onChange={(e) => setSubCategoryForm({ ...subCategoryForm, name: e.target.value })}
                      placeholder={t("e.g., Server, Firewall, Router")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Description")}</Label>
                    <textarea
                      value={subCategoryForm.description}
                      onChange={(e) => setSubCategoryForm({ ...subCategoryForm, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                </>
              )}

              {entitySubTab === "groups" && (
                <>
                  <div className="space-y-2">
                    <Label>{t("Name")} *</Label>
                    <Input
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      placeholder={t("e.g., Security Tools, Payment Systems")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Description")}</Label>
                    <textarea
                      value={groupForm.description}
                      onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Status")} *</Label>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="groupStatus"
                          checked={groupForm.status === "Active"}
                          onChange={() => setGroupForm({ ...groupForm, status: "Active" })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Active")}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="groupStatus"
                          checked={groupForm.status === "Inactive"}
                          onChange={() => setGroupForm({ ...groupForm, status: "Inactive" })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Inactive")}</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Asset Sub Category")} *</Label>
                    <Select
                      value={groupForm.subCategoryId}
                      onValueChange={(value) => setGroupForm({ ...groupForm, subCategoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("Select sub category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.map((subCat) => (
                          <SelectItem key={subCat.id} value={subCat.id}>
                            {subCat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {entitySubTab === "sensitivity" && (
                <div className="space-y-2">
                  <Label>{t("Name")} *</Label>
                  <Input
                    value={sensitivityForm.name}
                    onChange={(e) => setSensitivityForm({ ...sensitivityForm, name: e.target.value })}
                    placeholder={t("e.g., High, Medium, Low")}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={() => {
                if (entitySubTab === "asset-list") {
                  handleAddAsset();
                } else if (entitySubTab === "categories") {
                  handleAddCategory();
                } else if (entitySubTab === "subcategories") {
                  handleAddSubCategory();
                } else if (entitySubTab === "groups") {
                  handleAddGroup();
                } else if (entitySubTab === "sensitivity") {
                  handleAddSensitivity();
                }
              }}>
                {t("Save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog for Entity List */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  {t("Edit")} {entitySubTab === "categories" ? t("Category") :
                        entitySubTab === "subcategories" ? t("Sub Category") :
                        entitySubTab === "groups" ? t("Group") :
                        entitySubTab === "sensitivity" ? t("Sensitivity") : t("Item")}
                </DialogTitle>
                <DialogDescription>
                  {t("Update the details")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              {entitySubTab === "categories" && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} *</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder={t("e.g., Hardware, Software, Data")}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                    <Select
                      value={categoryForm.status}
                      onValueChange={(value) => setCategoryForm({ ...categoryForm, status: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">{t("Active")}</SelectItem>
                        <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {entitySubTab === "subcategories" && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Category")} *</Label>
                    <Select
                      value={subCategoryForm.categoryId}
                      onValueChange={(value) => setSubCategoryForm({ ...subCategoryForm, categoryId: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue placeholder={t("Select category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} *</Label>
                    <Input
                      value={subCategoryForm.name}
                      onChange={(e) => setSubCategoryForm({ ...subCategoryForm, name: e.target.value })}
                      placeholder={t("e.g., Server, Firewall, Router")}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <textarea
                      value={subCategoryForm.description}
                      onChange={(e) => setSubCategoryForm({ ...subCategoryForm, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                </>
              )}

              {entitySubTab === "groups" && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Name")} *</Label>
                    <Input
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      placeholder={t("e.g., Security Tools, Payment Systems")}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <textarea
                      value={groupForm.description}
                      onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Status")} *</Label>
                    <div className="flex items-center gap-6 mt-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="editGroupStatus"
                          checked={groupForm.status === "Active"}
                          onChange={() => setGroupForm({ ...groupForm, status: "Active" })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Active")}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="editGroupStatus"
                          checked={groupForm.status === "Inactive"}
                          onChange={() => setGroupForm({ ...groupForm, status: "Inactive" })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{t("Inactive")}</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Asset Sub Category")} *</Label>
                    <Select
                      value={groupForm.subCategoryId}
                      onValueChange={(value) => setGroupForm({ ...groupForm, subCategoryId: value })}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder={t("Select sub category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.map((subCat) => (
                          <SelectItem key={subCat.id} value={subCat.id}>
                            {subCat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {entitySubTab === "sensitivity" && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Name")} *</Label>
                  <Input
                    value={sensitivityForm.name}
                    onChange={(e) => setSensitivityForm({ ...sensitivityForm, name: e.target.value })}
                    placeholder={t("e.g., High, Medium, Low")}
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={() => {
                if (entitySubTab === "categories") {
                  handleEditCategory();
                } else if (entitySubTab === "subcategories") {
                  handleEditSubCategory();
                } else if (entitySubTab === "groups") {
                  handleEditGroup();
                } else if (entitySubTab === "sensitivity") {
                  handleEditSensitivity();
                }
              }}>
                {t("Save Changes")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
                <DialogDescription>
                  {t("Are you sure you want to delete this item? This action cannot be undone.")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button variant="destructive" onClick={() => {
                if (entitySubTab === "categories") {
                  handleDeleteCategory();
                } else if (entitySubTab === "subcategories") {
                  handleDeleteSubCategory();
                } else if (entitySubTab === "groups") {
                  handleDeleteGroup();
                } else if (entitySubTab === "sensitivity") {
                  handleDeleteSensitivity();
                }
              }}>
                {t("Delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show entity sub-navigation (Asset, Asset Sub Category, Asset Group, Asset Category, Asset Sensitivity)
  if (activeCategory === "asset") {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Asset Management")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <button onClick={() => setActiveCategory(null)} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Asset Settings")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("Asset Settings")}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entitySubCategories.map((sub) => {
            const Icon = sub.icon;
            const itemCount = getEntitySubCount(sub.id);

            return (
              <div
                key={sub.id}
                className="bg-white rounded-xl border border-slate-200 p-5"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-slate-800">{sub.title}</h4>
                    <p className="text-sm text-slate-500">
                      {sub.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-sm text-slate-500">
                    {itemCount} {itemCount === 1 ? t("item") : t("items")}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEntitySubTab(sub.id);
                      setSearchTerm("");
                    }}
                  >
                    {t("Manage")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Show lifecycle status list view
  if (activeCategory === "lifecycle") {
    const filteredData = lifecycleStatuses.filter(l =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Asset Management")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <button onClick={() => setActiveCategory(null)} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Lifecycle Status")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("Lifecycle Status")}</h1>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("Search...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-[250px] bg-white border-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportLifecycleStatuses}
                className="hidden"
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Download className="h-4 w-4 mr-2" />
                  {t("Import")}
                </span>
              </Button>
            </label>
            <Button variant="outline" size="sm" onClick={handleExportLifecycleStatuses}>
              <Upload className="h-4 w-4 mr-2" />
              {t("Export")}
            </Button>
            <Button size="sm" onClick={() => {
              setLifecycleForm({ name: "", description: "", order: lifecycleStatuses.length });
              setIsAddOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              {t("Add New")}
            </Button>
          </div>
        </div>

        <DataGrid
          columns={lifecycleColumns}
          data={filteredData}
          hideSearch={true}
        />

        {/* Add Lifecycle Status Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[400px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Lifecycle Status")}</DialogTitle>
                <DialogDescription>
                  {t("Enter the details for the new lifecycle status")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Name")} *</Label>
                <Input
                  value={lifecycleForm.name}
                  onChange={(e) => setLifecycleForm({ ...lifecycleForm, name: e.target.value })}
                  placeholder={t("e.g., Active, In Use, Retired")}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddLifecycle}>
                {t("Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Lifecycle Status Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Lifecycle Status")}</DialogTitle>
                <DialogDescription>
                  {t("Update the lifecycle status details")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Name")} *</Label>
                <Input
                  value={lifecycleForm.name}
                  onChange={(e) => setLifecycleForm({ ...lifecycleForm, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                <textarea
                  value={lifecycleForm.description}
                  onChange={(e) => setLifecycleForm({ ...lifecycleForm, description: e.target.value })}
                  placeholder={t("Enter description")}
                  className="mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Order")}</Label>
                <Input
                  type="number"
                  value={lifecycleForm.order}
                  onChange={(e) => setLifecycleForm({ ...lifecycleForm, order: parseInt(e.target.value) || 0 })}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleEditLifecycle}>
                {t("Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Lifecycle Status Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Lifecycle Status")}</DialogTitle>
                <DialogDescription>
                  {t("Are you sure you want to delete this lifecycle status? This action cannot be undone.")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteLifecycle}>
                {t("Delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show CIA Configuration view
  if (activeCategory === "cia") {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Asset Management")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <button onClick={() => setActiveCategory(null)} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("CIA Configuration")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("CIA Configuration")}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Confidentiality */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{t("Confidentiality")}</CardTitle>
                </div>
                <Button size="sm" onClick={() => {
                  setCiaRatingType("Confidentiality");
                  setCiaRatingForm({ label: "", value: 0 });
                  setIsCiaAddOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("New Confidentiality")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">{t("Label")}</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">{t("Value")}</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confidentialityRatings.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2 text-sm">{r.label}</td>
                        <td className="px-4 py-2 text-sm">{r.value}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              setSelectedCiaRating(r);
                              setCiaRatingForm({ label: r.label, value: r.value });
                              setIsCiaEditOpen(true);
                            }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                              setSelectedCiaRating(r);
                              setIsCiaDeleteOpen(true);
                            }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {confidentialityRatings.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-muted-foreground">{t("No ratings defined")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Integrity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">{t("Integrity")}</CardTitle>
                </div>
                <Button size="sm" onClick={() => {
                  setCiaRatingType("Integrity");
                  setCiaRatingForm({ label: "", value: 0 });
                  setIsCiaAddOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("New Integrity")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">{t("Label")}</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">{t("Value")}</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrityRatings.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2 text-sm">{r.label}</td>
                        <td className="px-4 py-2 text-sm">{r.value}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              setSelectedCiaRating(r);
                              setCiaRatingForm({ label: r.label, value: r.value });
                              setIsCiaEditOpen(true);
                            }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                              setSelectedCiaRating(r);
                              setIsCiaDeleteOpen(true);
                            }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {integrityRatings.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-muted-foreground">{t("No ratings defined")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Availability */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-lg">{t("Availability")}</CardTitle>
                </div>
                <Button size="sm" onClick={() => {
                  setCiaRatingType("Availability");
                  setCiaRatingForm({ label: "", value: 0 });
                  setIsCiaAddOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("New Availability")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">{t("Label")}</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">{t("Value")}</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availabilityRatings.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2 text-sm">{r.label}</td>
                        <td className="px-4 py-2 text-sm">{r.value}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              setSelectedCiaRating(r);
                              setCiaRatingForm({ label: r.label, value: r.value });
                              setIsCiaEditOpen(true);
                            }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                              setSelectedCiaRating(r);
                              setIsCiaDeleteOpen(true);
                            }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {availabilityRatings.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-muted-foreground">{t("No ratings defined")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Scoring Configuration Grid */}
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{t("Scoring Configuration")}</CardTitle>
                <CardDescription>
                  {scoringCalculationType === "high_of_all"
                    ? t("Define the high range value for each criticality rating")
                    : t("Define low and high range values for each criticality rating")}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={scoringCalculationType} onValueChange={setScoringCalculationType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORING_CALCULATION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    setScoringConfigForm({ level: "", minScore: 0, maxScore: 0, color: "#16A34A" });
                    setIsScoringAddOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Scoring Configuration
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t("Rating")}</th>
                    {scoringCalculationType === "high_of_all" ? (
                      <th className="px-4 py-3 text-left text-sm font-medium">{t("High range")}</th>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t("Low range")}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t("High range")}</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right text-sm font-medium">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {getCurrentConfigs().map((config) => (
                    <tr key={config.id} className="border-t">
                      <td className="px-4 py-3 text-sm font-medium">{config.level}</td>
                      {scoringCalculationType === "high_of_all" ? (
                        <td className="px-4 py-3 text-sm">{config.maxScore}</td>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm">{config.minScore}</td>
                          <td className="px-4 py-3 text-sm">{config.maxScore}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setSelectedScoringConfig(config);
                              setScoringConfigForm({
                                level: config.level,
                                minScore: config.minScore,
                                maxScore: config.maxScore,
                                color: config.color,
                              });
                              setIsScoringEditOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedScoringConfig(config);
                              setIsScoringDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {getCurrentConfigs().length === 0 && (
                    <tr className="border-t">
                      <td colSpan={scoringCalculationType === "high_of_all" ? 3 : 4} className="px-4 py-8 text-center text-muted-foreground">
                        {t("No scoring configurations. Click \"New Scoring Configuration\" to add one.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">{t("How scoring works:")}</h4>
              <p className="text-sm text-muted-foreground">
                {scoringCalculationType === "high_of_all" &&
                  t("The highest value among Confidentiality, Integrity, and Availability is used as the final score.")}
                {scoringCalculationType === "addition_of_all" &&
                  t("All three CIA values are added together to calculate the final score.")}
                {scoringCalculationType === "product_of_all" &&
                  t("All three CIA values are multiplied together to calculate the final score.")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Config Edit Dialog */}
        <Dialog open={isScoringEditOpen} onOpenChange={setIsScoringEditOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Scoring Configuration")}</DialogTitle>
                <DialogDescription>
                  {t("Update the score range and color for this criticality level")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Criticality Level")}</Label>
                <Input
                  value={scoringConfigForm.level}
                  onChange={(e) => setScoringConfigForm({ ...scoringConfigForm, level: e.target.value })}
                  placeholder={t("e.g., Critical, High, Medium, Low")}
                  className="mt-1.5"
                />
              </div>
              {scoringCalculationType === "high_of_all" ? (
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("High range")}</Label>
                  <Input
                    type="number"
                    value={scoringConfigForm.maxScore}
                    onChange={(e) => setScoringConfigForm({ ...scoringConfigForm, maxScore: parseInt(e.target.value) || 0 })}
                    className="mt-1.5"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Low range")}</Label>
                    <Input
                      type="number"
                      value={scoringConfigForm.minScore}
                      onChange={(e) => setScoringConfigForm({ ...scoringConfigForm, minScore: parseInt(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("High range")}</Label>
                    <Input
                      type="number"
                      value={scoringConfigForm.maxScore}
                      onChange={(e) => setScoringConfigForm({ ...scoringConfigForm, maxScore: parseInt(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsScoringEditOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleUpdateScoringConfig}>{t("Save Changes")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Scoring Config Add Dialog */}
        <Dialog open={isScoringAddOpen} onOpenChange={setIsScoringAddOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Scoring Configuration")}</DialogTitle>
                <DialogDescription>
                  {t("Add a new scoring configuration for criticality rating")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Rating")} *</Label>
                <Input
                  value={scoringConfigForm.level}
                  onChange={(e) => setScoringConfigForm({ ...scoringConfigForm, level: e.target.value })}
                  placeholder={t("e.g., Critical, High, Medium, Low")}
                  className="mt-1.5"
                />
              </div>
              {scoringCalculationType === "high_of_all" ? (
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("High range")}</Label>
                  <Input
                    type="number"
                    value={scoringConfigForm.maxScore}
                    onChange={(e) => setScoringConfigForm({ ...scoringConfigForm, maxScore: parseInt(e.target.value) || 0 })}
                    className="mt-1.5"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Low range")}</Label>
                    <Input
                      type="number"
                      value={scoringConfigForm.minScore}
                      onChange={(e) => setScoringConfigForm({ ...scoringConfigForm, minScore: parseInt(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("High range")}</Label>
                    <Input
                      type="number"
                      value={scoringConfigForm.maxScore}
                      onChange={(e) => setScoringConfigForm({ ...scoringConfigForm, maxScore: parseInt(e.target.value) || 0 })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsScoringAddOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddScoringConfig}>{t("Add")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Scoring Config Delete Dialog */}
        <Dialog open={isScoringDeleteOpen} onOpenChange={setIsScoringDeleteOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Scoring Configuration")}</DialogTitle>
                <DialogDescription>
                  {`${t("Are you sure you want to delete the")} "${selectedScoringConfig?.level}" ${t("scoring configuration? This action cannot be undone.")}`}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsScoringDeleteOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteScoringConfig}>{t("Delete")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CIA Rating Add Dialog */}
        <Dialog open={isCiaAddOpen} onOpenChange={setIsCiaAddOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("New")} {t(ciaRatingType)}</DialogTitle>
                <DialogDescription>
                  {`${t("Add a new")} ${t(ciaRatingType.toLowerCase())} ${t("rating level")}`}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Label")} *</Label>
                <Input
                  value={ciaRatingForm.label}
                  onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, label: e.target.value })}
                  placeholder={t("e.g., high, medium, low")}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Value")} *</Label>
                <Input
                  type="number"
                  value={ciaRatingForm.value}
                  onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, value: parseInt(e.target.value) || 0 })}
                  placeholder={t("e.g., 10, 5, 1")}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsCiaAddOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddCiaRating}>{t("Add")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CIA Rating Edit Dialog */}
        <Dialog open={isCiaEditOpen} onOpenChange={setIsCiaEditOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Rating")}</DialogTitle>
                <DialogDescription>
                  {t("Update the rating details")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Label")} *</Label>
                <Input
                  value={ciaRatingForm.label}
                  onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, label: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Value")} *</Label>
                <Input
                  type="number"
                  value={ciaRatingForm.value}
                  onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, value: parseInt(e.target.value) || 0 })}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsCiaEditOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleEditCiaRating}>{t("Save Changes")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CIA Rating Delete Dialog */}
        <Dialog open={isCiaDeleteOpen} onOpenChange={setIsCiaDeleteOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
                <DialogDescription>
                  {t("Are you sure you want to delete this rating? This action cannot be undone.")}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsCiaDeleteOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteCiaRating}>
                {t("Delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show main settings grid view (default)
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Asset Management")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Settings")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Asset Settings")}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingCategories.map((category) => {
          const Icon = category.icon;
          const itemCount = getItemCount(category.id);

          return (
            <div
              key={category.id}
              className="bg-white rounded-xl border border-slate-200 p-5"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-slate-800">{category.title}</h4>
                  <p className="text-sm text-slate-500">
                    {category.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-sm text-slate-500">
                  {itemCount} {itemCount === 1 ? t("item") : t("items")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveCategory(category.id);
                    setSearchTerm("");
                  }}
                >
                  {t("Manage")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("Add")} {entitySubTab === "categories" ? t("Category") :
                   entitySubTab === "subcategories" ? t("Sub Category") :
                   entitySubTab === "groups" ? t("Group") :
                   activeCategory === "lifecycle" ? t("Lifecycle Status") : t("Item")}
            </DialogTitle>
            <DialogDescription>
              {t("Enter the details for the new item")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {entitySubTab === "categories" && (
              <>
                <div className="space-y-2">
                  <Label>{t("Name")} *</Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder={t("e.g., Hardware, Software, Data")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Status")}</Label>
                  <Select
                    value={categoryForm.status}
                    onValueChange={(value) => setCategoryForm({ ...categoryForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">{t("Active")}</SelectItem>
                      <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {entitySubTab === "subcategories" && (
              <>
                <div className="space-y-2">
                  <Label>{t("Category")} *</Label>
                  <Select
                    value={subCategoryForm.categoryId}
                    onValueChange={(value) => setSubCategoryForm({ ...subCategoryForm, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("Name")} *</Label>
                  <Input
                    value={subCategoryForm.name}
                    onChange={(e) => setSubCategoryForm({ ...subCategoryForm, name: e.target.value })}
                    placeholder={t("e.g., Server, Firewall, Router")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Description")}</Label>
                  <textarea
                    value={subCategoryForm.description}
                    onChange={(e) => setSubCategoryForm({ ...subCategoryForm, description: e.target.value })}
                    placeholder={t("Enter description")}
                    className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
              </>
            )}

            {entitySubTab === "groups" && (
              <>
                <div className="space-y-2">
                  <Label>{t("Name")} *</Label>
                  <Input
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                    placeholder={t("e.g., Security Tools, Payment Systems")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Description")}</Label>
                  <textarea
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    placeholder={t("Enter description")}
                    className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Status")} *</Label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="groupStatus3"
                        checked={groupForm.status === "Active"}
                        onChange={() => setGroupForm({ ...groupForm, status: "Active" })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{t("Active")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="groupStatus3"
                        checked={groupForm.status === "Inactive"}
                        onChange={() => setGroupForm({ ...groupForm, status: "Inactive" })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{t("Inactive")}</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("Asset Sub Category")} *</Label>
                  <Select
                    value={groupForm.subCategoryId}
                    onValueChange={(value) => setGroupForm({ ...groupForm, subCategoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select sub category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategories.map((subCat) => (
                        <SelectItem key={subCat.id} value={subCat.id}>
                          {subCat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {entitySubTab === "sensitivity" && (
              <div className="space-y-2">
                <Label>{t("Name")} *</Label>
                <Input
                  value={sensitivityForm.name}
                  onChange={(e) => setSensitivityForm({ ...sensitivityForm, name: e.target.value })}
                  placeholder={t("e.g., high, medium, low")}
                />
              </div>
            )}

            {activeCategory === "lifecycle" && (
              <>
                <div className="space-y-2">
                  <Label>{t("Name")} *</Label>
                  <Input
                    value={lifecycleForm.name}
                    onChange={(e) => setLifecycleForm({ ...lifecycleForm, name: e.target.value })}
                    placeholder={t("e.g., Active, In Use, Retired")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Description")}</Label>
                  <textarea
                    value={lifecycleForm.description}
                    onChange={(e) => setLifecycleForm({ ...lifecycleForm, description: e.target.value })}
                    placeholder={t("Enter description")}
                    className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Order")}</Label>
                  <Input
                    type="number"
                    value={lifecycleForm.order}
                    onChange={(e) => setLifecycleForm({ ...lifecycleForm, order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={() => {
              if (activeCategory === "lifecycle") {
                handleAddLifecycle();
              } else if (entitySubTab === "categories") {
                handleAddCategory();
              } else if (entitySubTab === "subcategories") {
                handleAddSubCategory();
              } else if (entitySubTab === "groups") {
                handleAddGroup();
              } else if (entitySubTab === "sensitivity") {
                handleAddSensitivity();
              }
            }}>
              {t("Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Edit Item")}</DialogTitle>
            <DialogDescription>
              {t("Update the item details")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {entitySubTab === "categories" && (
              <>
                <div className="space-y-2">
                  <Label>{t("Name")} *</Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Status")}</Label>
                  <Select
                    value={categoryForm.status}
                    onValueChange={(value) => setCategoryForm({ ...categoryForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">{t("Active")}</SelectItem>
                      <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {entitySubTab === "subcategories" && (
              <>
                <div className="space-y-2">
                  <Label>{t("Category")} *</Label>
                  <Select
                    value={subCategoryForm.categoryId}
                    onValueChange={(value) => setSubCategoryForm({ ...subCategoryForm, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("Name")} *</Label>
                  <Input
                    value={subCategoryForm.name}
                    onChange={(e) => setSubCategoryForm({ ...subCategoryForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Description")}</Label>
                  <textarea
                    value={subCategoryForm.description}
                    onChange={(e) => setSubCategoryForm({ ...subCategoryForm, description: e.target.value })}
                    className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
              </>
            )}

            {entitySubTab === "groups" && (
              <>
                <div className="space-y-2">
                  <Label>{t("Name")} *</Label>
                  <Input
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Description")}</Label>
                  <textarea
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Status")} *</Label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editGroupStatus4"
                        checked={groupForm.status === "Active"}
                        onChange={() => setGroupForm({ ...groupForm, status: "Active" })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{t("Active")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editGroupStatus4"
                        checked={groupForm.status === "Inactive"}
                        onChange={() => setGroupForm({ ...groupForm, status: "Inactive" })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{t("Inactive")}</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("Asset Sub Category")} *</Label>
                  <Select
                    value={groupForm.subCategoryId}
                    onValueChange={(value) => setGroupForm({ ...groupForm, subCategoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select sub category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategories.map((subCat) => (
                        <SelectItem key={subCat.id} value={subCat.id}>
                          {subCat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {entitySubTab === "sensitivity" && (
              <div className="space-y-2">
                <Label>{t("Name")} *</Label>
                <Input
                  value={sensitivityForm.name}
                  onChange={(e) => setSensitivityForm({ ...sensitivityForm, name: e.target.value })}
                />
              </div>
            )}

            {activeCategory === "lifecycle" && (
              <>
                <div className="space-y-2">
                  <Label>{t("Name")} *</Label>
                  <Input
                    value={lifecycleForm.name}
                    onChange={(e) => setLifecycleForm({ ...lifecycleForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Description")}</Label>
                  <textarea
                    value={lifecycleForm.description}
                    onChange={(e) => setLifecycleForm({ ...lifecycleForm, description: e.target.value })}
                    className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Order")}</Label>
                  <Input
                    type="number"
                    value={lifecycleForm.order}
                    onChange={(e) => setLifecycleForm({ ...lifecycleForm, order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={() => {
              if (activeCategory === "lifecycle") {
                handleEditLifecycle();
              } else if (entitySubTab === "categories") {
                handleEditCategory();
              } else if (entitySubTab === "subcategories") {
                handleEditSubCategory();
              } else if (entitySubTab === "groups") {
                handleEditGroup();
              } else if (entitySubTab === "sensitivity") {
                handleEditSensitivity();
              }
            }}>
              {t("Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Confirm Delete")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete this item? This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={() => {
              if (activeCategory === "lifecycle") {
                handleDeleteLifecycle();
              } else if (entitySubTab === "categories") {
                handleDeleteCategory();
              } else if (entitySubTab === "subcategories") {
                handleDeleteSubCategory();
              } else if (entitySubTab === "groups") {
                handleDeleteGroup();
              } else if (entitySubTab === "sensitivity") {
                handleDeleteSensitivity();
              }
            }}>
              {t("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CIA Rating Add Dialog */}
      <Dialog open={isCiaAddOpen} onOpenChange={setIsCiaAddOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New")} {t(ciaRatingType)}</DialogTitle>
              <DialogDescription>
                {`${t("Add a new")} ${t(ciaRatingType.toLowerCase())} ${t("rating level")}`}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Label")} *</Label>
              <Input
                value={ciaRatingForm.label}
                onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, label: e.target.value })}
                placeholder={t("e.g., high, medium, low")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Value")} *</Label>
              <Input
                type="number"
                value={ciaRatingForm.value}
                onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, value: parseInt(e.target.value) || 0 })}
                placeholder={t("e.g., 10, 5, 1")}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsCiaAddOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddCiaRating}>{t("Add")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CIA Rating Edit Dialog */}
      <Dialog open={isCiaEditOpen} onOpenChange={setIsCiaEditOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Rating")}</DialogTitle>
              <DialogDescription>
                {t("Update the rating details")}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Label")} *</Label>
              <Input
                value={ciaRatingForm.label}
                onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, label: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Value")} *</Label>
              <Input
                type="number"
                value={ciaRatingForm.value}
                onChange={(e) => setCiaRatingForm({ ...ciaRatingForm, value: parseInt(e.target.value) || 0 })}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsCiaEditOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditCiaRating}>{t("Save Changes")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CIA Rating Delete Dialog */}
      <Dialog open={isCiaDeleteOpen} onOpenChange={setIsCiaDeleteOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
              <DialogDescription>
                {t("Are you sure you want to delete this rating? This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsCiaDeleteOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteCiaRating}>
              {t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
