"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Download, Upload, Search, Settings2, MapPin, FileType, Clock, Briefcase, BarChart3 } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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

// Mock data for each setting type
const mockSettingsData: Record<string, SettingItem[]> = {
  bia: [
    { id: "1", name: "Critical", description: "Business critical processes" },
    { id: "2", name: "High", description: "High priority processes" },
    { id: "3", name: "Medium", description: "Medium priority processes" },
    { id: "4", name: "Low", description: "Low priority processes" },
  ],
  location: [
    { id: "1", name: "Head Office", description: "Main headquarters" },
    { id: "2", name: "Branch Office", description: "Regional branches" },
    { id: "3", name: "Remote", description: "Remote locations" },
  ],
  implementation: [
    { id: "1", name: "On-Premise", description: "Local deployment" },
    { id: "2", name: "Cloud", description: "Cloud-based deployment" },
    { id: "3", name: "Hybrid", description: "Mixed deployment" },
  ],
  "document-types": [
    { id: "1", name: "Policy", description: "Policy documents" },
    { id: "2", name: "Procedure", description: "Procedure documents" },
    { id: "3", name: "Standard", description: "Standard documents" },
    { id: "4", name: "Guideline", description: "Guideline documents" },
  ],
  frequency: [
    { id: "1", name: "Daily", description: "Every day" },
    { id: "2", name: "Weekly", description: "Every week" },
    { id: "3", name: "Monthly", description: "Every month" },
    { id: "4", name: "Quarterly", description: "Every quarter" },
    { id: "5", name: "Annually", description: "Every year" },
  ],
  designation: [
    { id: "1", name: "CEO", description: "Chief Executive Officer" },
    { id: "2", name: "CTO", description: "Chief Technology Officer" },
    { id: "3", name: "CFO", description: "Chief Financial Officer" },
    { id: "4", name: "Manager", description: "Department Manager" },
    { id: "5", name: "Executive", description: "Executive" },
    { id: "6", name: "Analyst", description: "Analyst" },
    { id: "7", name: "Specialist", description: "Specialist" },
  ],
};

export default function OrganizationSettingsPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState<Record<string, SettingItem[]>>(mockSettingsData);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Form state
  const [newItem, setNewItem] = useState({ name: "", description: "" });

  // Get current category data
  const currentCategory = settingCategories.find((c) => c.id === activeCategory);
  const currentData = activeCategory ? settingsData[activeCategory] || [] : [];

  // Filter data
  const filteredData = currentData.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // CRUD operations
  const handleAddItem = () => {
    if (!activeCategory || !newItem.name.trim()) return;
    const newId = Date.now().toString();
    setSettingsData({
      ...settingsData,
      [activeCategory]: [...currentData, { id: newId, ...newItem }],
    });
    setNewItem({ name: "", description: "" });
    setIsAddItemOpen(false);
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
  };

  const handleDeleteItem = () => {
    if (!activeCategory || !deletingItemId) return;
    setSettingsData({
      ...settingsData,
      [activeCategory]: currentData.filter((item) => item.id !== deletingItemId),
    });
    setIsDeleteDialogOpen(false);
    setDeletingItemId(null);
  };

  // Columns for settings table
  const settingColumns: ColumnDef<SettingItem>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
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
              setEditingItem(row.original);
              setIsEditItemOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              setDeletingItemId(row.original.id);
              setIsDeleteDialogOpen(true);
            }}
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
        <PageHeader
          title={currentCategory?.title || "Settings"}
          actions={[
            {
              label: "Back to Settings",
              variant: "outline",
              icon: ArrowLeft,
              onClick: () => setActiveCategory(null),
            },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-[250px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setIsAddItemOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        </div>

        <DataGrid
          columns={settingColumns}
          data={filteredData}
          searchPlaceholder="Search..."
        />

        {/* Add Item Dialog */}
        <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New {currentCategory?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="itemName">Name *</Label>
                <Input
                  id="itemName"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Enter name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemDescription">Description</Label>
                <Input
                  id="itemDescription"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Enter description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {currentCategory?.title}</DialogTitle>
            </DialogHeader>
            {editingItem && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="editItemName">Name *</Label>
                  <Input
                    id="editItemName"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editItemDescription">Description</Label>
                  <Input
                    id="editItemDescription"
                    value={editingItem.description || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditItemOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditItem}>Save Changes</Button>
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
              <Button variant="destructive" onClick={handleDeleteItem}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show settings grid view
  return (
    <div className="space-y-6">
      <PageHeader title="Organization Settings" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingCategories.map((category) => {
          const Icon = category.icon;
          const itemCount = settingsData[category.id]?.length || 0;

          return (
            <Card
              key={category.id}
              className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
              onClick={() => setActiveCategory(category.id)}
            >
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">{category.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {category.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                  <Button variant="ghost" size="sm" className="text-blue-600">
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
