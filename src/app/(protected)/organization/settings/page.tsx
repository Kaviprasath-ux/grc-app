"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Settings2, MapPin, FileType, Clock, Briefcase, BarChart3, Search, ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { DataGrid } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  // Dialog states
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Form state
  const [newItem, setNewItem] = useState({ name: "", description: "" });

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

  // Filter data based on search
  const filteredData = currentData.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // CRUD operations
  const handleAddItem = async () => {
    if (!activeCategory || !newItem.name.trim()) {
      toast({ title: t("Error"), description: t("Please enter a name"), variant: "destructive" });
      return;
    }

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

  // Columns for settings table - matching profile page pattern
  const settingColumns: ColumnDef<SettingItem>[] = [
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("name")}</span>,
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
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
            onClick={() => {
              setEditingItem(row.original);
              setIsEditItemOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
            onClick={() => setDeletingItemId(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

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
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <button
            onClick={() => setActiveCategory(null)}
            className="text-slate-500 hover:text-primary-600 transition-colors"
          >
            {t("Settings")}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{currentCategory ? t(currentCategory.title) : ""}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{currentCategory ? t(currentCategory.title) : ""}</h1>
        </div>

        {/* Toolbar - Search and Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={`${t("Search")} ${currentCategory ? t(currentCategory.title).toLowerCase() : ""}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ltr:pl-10 rtl:pr-10 bg-white border-slate-200"
            />
          </div>
          <Button size="sm" onClick={() => setIsAddItemOpen(true)}>
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Add")} {currentCategory ? t(currentCategory.title) : ""}
          </Button>
        </div>

        {/* Data Grid - hide internal search */}
        <DataGrid
          columns={settingColumns}
          data={filteredData}
          hideSearch={true}
        />

        {/* Add Item Dialog */}
        <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
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
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder={t("Enter name")}
                    className="mt-1.5 bg-white"
                  />
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
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleAddItem}>{t("Save")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
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
                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      className="mt-1.5 bg-white"
                    />
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
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsEditItemOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleEditItem}>{t("Save")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingItemId} onOpenChange={(open) => !open && setDeletingItemId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("Delete")} {currentCategory ? t(currentCategory.title) : ""}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("Are you sure you want to delete this item? This action cannot be undone.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteItem}>{t("Delete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Settings")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Organization Settings")}</h1>
      </div>

      {/* Settings Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingCategories.map((category) => {
          const Icon = category.icon;

          return (
            <div
              key={category.id}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-full min-h-[160px]"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3 bg-blue-50 rounded-lg flex-shrink-0">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-slate-800">{t(category.title)}</h4>
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {t(category.description)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end pt-3 mt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (category.id === "bia") {
                      router.push("/organization/settings/bia");
                    } else {
                      setActiveCategory(category.id);
                    }
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
