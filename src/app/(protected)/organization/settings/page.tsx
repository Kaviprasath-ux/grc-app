"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Settings2, MapPin, FileType, Clock, Briefcase, BarChart3, Search, ChevronLeft } from "lucide-react";
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
// TODO: Replace with actual API calls for persistent storage
const initialSettingsData: Record<string, SettingItem[]> = {
  bia: [],
  location: [],
  implementation: [],
  "document-types": [],
  frequency: [],
  designation: [],
};

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState<Record<string, SettingItem[]>>(initialSettingsData);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Form state
  const [newItem, setNewItem] = useState({ name: "", description: "" });

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
  const handleAddItem = () => {
    if (!activeCategory || !newItem.name.trim()) {
      toast({ title: "Error", description: "Please enter a name", variant: "destructive" });
      return;
    }
    const newId = Date.now().toString();
    setSettingsData({
      ...settingsData,
      [activeCategory]: [...currentData, { id: newId, ...newItem }],
    });
    setNewItem({ name: "", description: "" });
    setIsAddItemOpen(false);
    toast({ title: "Success", description: "Item added successfully" });
  };

  const handleEditItem = () => {
    if (!activeCategory || !editingItem) return;
    setSettingsData({
      ...settingsData,
      [activeCategory]: currentData.map((item) =>
        item.id === editingItem.id ? editingItem : item
      ),
    });
    setIsEditItemOpen(false);
    setEditingItem(null);
    toast({ title: "Success", description: "Item updated successfully" });
  };

  const handleDeleteItem = () => {
    if (!activeCategory || !deletingItemId) return;
    setSettingsData({
      ...settingsData,
      [activeCategory]: currentData.filter((item) => item.id !== deletingItemId),
    });
    setDeletingItemId(null);
    toast({ title: "Success", description: "Item deleted successfully" });
  };

  // Columns for settings table - matching profile page pattern
  const settingColumns: ColumnDef<SettingItem>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("name")}</span>,
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
        {/* Page Header with Back Button */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-600 hover:text-slate-800"
            onClick={() => setActiveCategory(null)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">{currentCategory?.title}</h1>
        </div>

        {/* Toolbar - Search and Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={`Search ${currentCategory?.title.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-slate-200"
            />
          </div>
          <Button size="sm" onClick={() => setIsAddItemOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add {currentCategory?.title}
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
                  Add {currentCategory?.title}
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
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Enter name"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Description
                  </Label>
                  <Input
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Enter description"
                    className="mt-1.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem}>Save</Button>
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
                  Edit {currentCategory?.title}
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* Content */}
            {editingItem && (
              <div className="px-6 py-6">
                <div className="space-y-5">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Name <span className="text-error">*</span>
                    </Label>
                    <Input
                      value={editingItem.name}
                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Description
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
                Cancel
              </Button>
              <Button onClick={handleEditItem}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingItemId} onOpenChange={(open) => !open && setDeletingItemId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {currentCategory?.title}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this item? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteItem}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Show settings grid view
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Organization Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingCategories.map((category) => {
          const Icon = category.icon;
          const itemCount = settingsData[category.id]?.length || 0;

          return (
            <div
              key={category.id}
              className="cursor-pointer bg-white rounded-xl border border-slate-200 p-5"
              onClick={() => {
                // Navigate to dedicated BIA settings page
                if (category.id === "bia") {
                  router.push("/organization/settings/bia");
                } else {
                  setActiveCategory(category.id);
                }
              }}
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary-50 rounded-lg">
                  <Icon className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800">{category.title}</h3>
                  <p className="text-sm text-slate-500">
                    {category.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-sm text-slate-500">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
