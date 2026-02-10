"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Settings2, MapPin, FileType, Clock, Briefcase, BarChart3, ChevronRight, Home, Package } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataGrid } from "@/components/shared";
import { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface SettingItem {
  id: string;
  name: string;
  description?: string;
}

// Setting categories as shown in testing
const settingCategories = [
  {
    id: "bia",
    title: "BIA",
    description: "Business Impact Analysis settings",
    icon: BarChart3,
  },
  {
    id: "location",
    title: "Location",
    description: "Manage organization locations",
    icon: MapPin,
  },
  {
    id: "implementation",
    title: "Nature of Implementation",
    description: "Implementation type settings",
    icon: Settings2,
  },
  {
    id: "document-types",
    title: "User Document Types",
    description: "Document type configurations",
    icon: FileType,
  },
  {
    id: "frequency",
    title: "Process Frequency",
    description: "Process frequency options",
    icon: Clock,
  },
  {
    id: "designation",
    title: "Designation",
    description: "Employee designation settings",
    icon: Briefcase,
  },
];

// Empty initial data - each tenant starts with clean slate
const initialSettingsData: Record<string, SettingItem[]> = {
  bia: [],
  location: [],
  implementation: [],
  "document-types": [],
  frequency: [],
  designation: [],
};

// API endpoint mapping for categories that have backend persistence
const categoryApiEndpoints: Record<string, string> = {
  frequency: "/api/organization-settings/process-frequency",
  location: "/api/organization-settings/location",
  implementation: "/api/organization-settings/nature-of-implementation",
};

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState<Record<string, SettingItem[]>>(initialSettingsData);
  const [loadingData, setLoadingData] = useState(false);

  // Dialog states
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Form state
  const [newItem, setNewItem] = useState({ name: "", description: "" });
  const [addNameError, setAddNameError] = useState("");
  const [editNameError, setEditNameError] = useState("");

  // Fetch data from API when a category with an API endpoint is selected
  const fetchCategoryData = useCallback(async (categoryId: string) => {
    const apiEndpoint = categoryApiEndpoints[categoryId];
    if (!apiEndpoint) return;

    setLoadingData(true);
    try {
      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const data = await res.json();
        setSettingsData((prev) => ({
          ...prev,
          [categoryId]: data.map((item: { id: string; name: string }) => ({
            id: item.id,
            name: item.name,
          })),
        }));
      }
    } catch (error) {
      console.error("Error fetching settings data:", error);
    }
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (activeCategory && categoryApiEndpoints[activeCategory]) {
      fetchCategoryData(activeCategory);
    }
  }, [activeCategory, fetchCategoryData]);

  // Get current category data
  const currentCategory = settingCategories.find((c) => c.id === activeCategory);
  const currentData = activeCategory ? settingsData[activeCategory] || [] : [];

  // Table columns
  const settingColumns: ColumnDef<SettingItem>[] = [
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.getValue("name")}</span>
      ),
    },
    {
      accessorKey: "description",
      header: t("Description"),
      cell: ({ row }) => (
        <span className="text-slate-500">{row.getValue("description") || "—"}</span>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
            onClick={() => {
              setEditingItem(row.original);
              setEditNameError("");
              setIsEditItemOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
            onClick={() => setDeletingItemId(row.original.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // CRUD operations
  const handleAddItem = async () => {
    if (!activeCategory) return;
    if (!newItem.name.trim()) {
      setAddNameError(t("Please enter the name"));
      return;
    }
    setAddNameError("");

    const apiEndpoint = categoryApiEndpoints[activeCategory];
    if (apiEndpoint) {
      try {
        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newItem.name }),
        });
        if (res.ok) {
          setNewItem({ name: "", description: "" });
          setIsAddItemOpen(false);
          toast({ title: t("Success"), description: t("Item added successfully") });
          fetchCategoryData(activeCategory);
        } else {
          const error = await res.json();
          toast({ title: t("Error"), description: error.error || t("Failed to add item"), variant: "destructive" });
        }
      } catch {
        toast({ title: t("Error"), description: t("Failed to add item"), variant: "destructive" });
      }
    } else {
      const newId = Date.now().toString();
      setSettingsData({
        ...settingsData,
        [activeCategory]: [...currentData, { id: newId, ...newItem }],
      });
      setNewItem({ name: "", description: "" });
      setIsAddItemOpen(false);
      toast({ title: t("Success"), description: t("Item added successfully") });
    }
  };

  const handleEditItem = async () => {
    if (!activeCategory || !editingItem) return;
    if (!editingItem.name.trim()) {
      setEditNameError(t("Please enter the name"));
      return;
    }
    setEditNameError("");

    const apiEndpoint = categoryApiEndpoints[activeCategory];
    if (apiEndpoint) {
      try {
        const res = await fetch(`${apiEndpoint}/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editingItem.name }),
        });
        if (res.ok) {
          setIsEditItemOpen(false);
          setEditingItem(null);
          toast({ title: t("Success"), description: t("Item updated successfully") });
          fetchCategoryData(activeCategory);
        } else {
          const error = await res.json();
          toast({ title: t("Error"), description: error.error || t("Failed to update item"), variant: "destructive" });
        }
      } catch {
        toast({ title: t("Error"), description: t("Failed to update item"), variant: "destructive" });
      }
    } else {
      setSettingsData({
        ...settingsData,
        [activeCategory]: currentData.map((item) =>
          item.id === editingItem.id ? editingItem : item
        ),
      });
      setIsEditItemOpen(false);
      setEditingItem(null);
      toast({ title: t("Success"), description: t("Item updated successfully") });
    }
  };

  const handleDeleteItem = async () => {
    if (!activeCategory || !deletingItemId) return;

    const apiEndpoint = categoryApiEndpoints[activeCategory];
    if (apiEndpoint) {
      try {
        const res = await fetch(`${apiEndpoint}/${deletingItemId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setDeletingItemId(null);
          toast({ title: t("Success"), description: t("Item deleted successfully") });
          fetchCategoryData(activeCategory);
        } else {
          const error = await res.json();
          toast({ title: t("Error"), description: error.error || t("Failed to delete item"), variant: "destructive" });
        }
      } catch {
        toast({ title: t("Error"), description: t("Failed to delete item"), variant: "destructive" });
      }
    } else {
      setSettingsData({
        ...settingsData,
        [activeCategory]: currentData.filter((item) => item.id !== deletingItemId),
      });
      setDeletingItemId(null);
      toast({ title: t("Success"), description: t("Item deleted successfully") });
    }
  };

  // Show settings list view
  if (activeCategory) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Organization")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <button
            onClick={() => setActiveCategory(null)}
            className="text-slate-500 hover:text-primary-600 transition-colors"
          >
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{currentCategory ? t(currentCategory.title) : ""}</span>
        </nav>

        {/* Page Header with Count & Action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{currentCategory ? t(currentCategory.title) : ""}</h1>
          </div>
          <Button size="sm" onClick={() => { setNewItem({ name: "", description: "" }); setAddNameError(""); setIsAddItemOpen(true); }}>
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Add")} {currentCategory ? t(currentCategory.title) : ""}
          </Button>
        </div>

        {/* Table */}
        <DataGrid
          columns={settingColumns}
          data={currentData}
          searchPlaceholder={`${t("Search")} ${currentCategory ? t(currentCategory.title).toLowerCase() : ""}...`}
          hideSearch={currentData.length === 0}
        />

        {/* Add Item Dialog */}
        <Dialog open={isAddItemOpen} onOpenChange={(open) => { setIsAddItemOpen(open); if (!open) setAddNameError(""); }}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  {t("Add")} {currentCategory ? t(currentCategory.title) : ""}
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Name")} <span className="text-error">*</span>
                  </Label>
                  <Input
                    value={newItem.name}
                    onChange={(e) => { setNewItem({ ...newItem, name: e.target.value }); if (addNameError) setAddNameError(""); }}
                    placeholder={t("Enter name")}
                    className={`mt-1.5 bg-white ${addNameError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {addNameError && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{addNameError}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Description")}
                  </Label>
                  <Input
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder={t("Enter description")}
                    className="mt-1.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setAddNameError(""); setIsAddItemOpen(false); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddItem}>{t("Save")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={isEditItemOpen} onOpenChange={(open) => { setIsEditItemOpen(open); if (!open) setEditNameError(""); }}>
          <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Fixed Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  {t("Edit")} {currentCategory ? t(currentCategory.title) : ""}
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* Content */}
            {editingItem && (
              <div className="px-6 py-6">
                <div className="space-y-5">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      {t("Name")} <span className="text-error">*</span>
                    </Label>
                    <Input
                      value={editingItem.name}
                      onChange={(e) => { setEditingItem({ ...editingItem, name: e.target.value }); if (editNameError) setEditNameError(""); }}
                      className={`mt-1.5 bg-white ${editNameError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    {editNameError && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{editNameError}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      {t("Description")}
                    </Label>
                    <Input
                      value={editingItem.description || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => { setEditNameError(""); setIsEditItemOpen(false); }}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleEditItem}>{t("Save")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deletingItemId} onOpenChange={(open) => !open && setDeletingItemId(null)}>
          <DialogContent className="sm:max-w-[420px] p-0 gap-0">
            <div className="px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  {t("Delete")} {currentCategory ? t(currentCategory.title) : ""}
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="px-6 py-6">
              <p className="text-sm text-slate-600">
                {t("Are you sure you want to delete this item? This action cannot be undone.")}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setDeletingItemId(null)}>
                {t("Cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteItem}>
                {t("Delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show settings grid view
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Settings")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Organization Settings")}</h1>
      </div>

      {/* Settings Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingCategories.map((category) => {
          const Icon = category.icon;

          return (
            <button
              key={category.id}
              className="group bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 text-left transition-all hover:border-primary-200 hover:shadow-md hover:shadow-primary-100/50 cursor-pointer"
              onClick={() => {
                if (category.id === "bia") {
                  router.push("/organization/settings/bia");
                } else {
                  setActiveCategory(category.id);
                }
              }}
            >
              <div className="p-3 bg-primary-50 rounded-xl flex-shrink-0 transition-colors group-hover:bg-primary-100">
                <Icon className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800">{t(category.title)}</h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {t(category.description)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 transition-transform group-hover:text-primary-500 group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
