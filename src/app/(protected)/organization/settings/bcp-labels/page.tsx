"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Home, Plus, Pencil, Trash2, Search, Clock, Database } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { isValidName } from "@/lib/validations";
import { PageHeader, DataGrid } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";

interface BCPLabel {
  id: string;
  name: string;
  type: string;
  hours: number;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export default function BCPLabelsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("rto");
  const [labels, setLabels] = useState<BCPLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BCPLabel | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "RTO",
    hours: 0,
    description: "",
    sortOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchLabels();
  }, [activeTab]);

  const fetchLabels = async () => {
    setLoading(true);
    try {
      const type = activeTab.toUpperCase();
      const res = await fetch(`/api/bia/bcp-labels?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setLabels(data);
      }
    } catch (error) {
      console.error("Error fetching BCP labels:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) return;
    if (!isValidName(formData.name.trim())) {
      alert(t("Only letters, spaces, and hyphens are allowed"));
      return;
    }
    try {
      const res = await fetch("/api/bia/bcp-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          type: activeTab.toUpperCase(),
        }),
      });
      if (res.ok) {
        const created = await res.json();
        triggerTranslation('BCPLabel', created.id, { name: formData.name, description: formData.description || undefined });
        await fetchLabels();
        setIsAddOpen(false);
        resetForm();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create label");
      }
    } catch (error) {
      console.error("Error creating label:", error);
    }
  };

  const handleEdit = async () => {
    if (!editingItem || !formData.name.trim()) return;
    if (!isValidName(formData.name.trim())) {
      alert(t("Only letters, spaces, and hyphens are allowed"));
      return;
    }
    try {
      const res = await fetch(`/api/bia/bcp-labels/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        triggerTranslation('BCPLabel', editingItem.id, { name: formData.name, description: formData.description || undefined });
        await fetchLabels();
        setIsEditOpen(false);
        setEditingItem(null);
        resetForm();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update label");
      }
    } catch (error) {
      console.error("Error updating label:", error);
    }
  };

  const handleDelete = async () => {
    if (!deletingItemId) return;
    try {
      const res = await fetch(`/api/bia/bcp-labels/${deletingItemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchLabels();
        setIsDeleteOpen(false);
        setDeletingItemId(null);
      }
    } catch (error) {
      console.error("Error deleting label:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: activeTab.toUpperCase(),
      hours: 0,
      description: "",
      sortOrder: 0,
      isActive: true,
    });
  };

  const openEditDialog = (item: BCPLabel) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      hours: item.hours,
      description: item.description || "",
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
    setIsEditOpen(true);
  };

  const { data: translatedLabels } = useTranslatedData(labels, { modelName: 'BCPLabel' });

  const filteredData = translatedLabels.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatHours = (hours: number) => {
    if (hours < 1) return `${hours * 60} ${t("minutes")}`;
    if (hours < 24) return `${hours} ${hours !== 1 ? t("hours") : t("hour")}`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days} ${days !== 1 ? t("days") : t("day")}`;
    return `${days} ${days !== 1 ? t("days") : t("day")} ${remainingHours} ${remainingHours !== 1 ? t("hours") : t("hour")}`;
  };

  const columns: ColumnDef<BCPLabel>[] = [
    {
      accessorKey: "name",
      header: t("Label Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "hours",
      header: t("Time Value"),
      cell: ({ row }) => formatHours(row.getValue("hours")),
    },
    {
      accessorKey: "description",
      header: t("Description"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue("description") || "-"}</span>
      ),
    },
    {
      accessorKey: "isActive",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
          {row.getValue("isActive") ? t("Active") : t("Inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <div className="flex gap-2">
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
            onClick={() => {
              setDeletingItemId(row.original.id);
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/organization/settings" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/organization/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("BCP Labels")}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("Back")}
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">{t("Organization Settings")}</p>
          <h1 className="text-xl sm:text-2xl font-semibold">{t("BCP Labels")}</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSearchTerm(""); }}>
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="rto" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t("RTO Labels")}
          </TabsTrigger>
          <TabsTrigger value="rpo" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            {t("RPO Labels")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rto" className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
            <h3 className="font-medium text-blue-900">{t("Recovery Time Objective (RTO)")}</h3>
            <p className="text-sm text-blue-700">
              {t("RTO defines the maximum acceptable time to restore a process after a disruption. Configure labels to standardize RTO options across your organization.")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search labels...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-[250px]"
              />
            </div>
            <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t("Add RTO Label")}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">{t("Loading...")}</p>
            </div>
          ) : (
            <DataGrid columns={columns} data={filteredData} searchPlaceholder={t("Search...")} />
          )}
        </TabsContent>

        <TabsContent value="rpo" className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4">
            <h3 className="font-medium text-green-900">{t("Recovery Point Objective (RPO)")}</h3>
            <p className="text-sm text-green-700">
              {t("RPO defines the maximum acceptable data loss measured in time. Configure labels to standardize RPO options across your organization.")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search labels...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-[250px]"
              />
            </div>
            <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t("Add RPO Label")}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">{t("Loading...")}</p>
            </div>
          ) : (
            <DataGrid columns={columns} data={filteredData} searchPlaceholder={t("Search...")} />
          )}
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add")} {activeTab.toUpperCase()} {t("Label")}</DialogTitle>
            <DialogDescription>
              {activeTab === "rto" ? t("Create a new Recovery Time Objective label") : t("Create a new Recovery Point Objective label")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("Label Name")} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("e.g., Immediate, 4 Hours, 24 Hours")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">{t("Time Value (in hours)")} *</Label>
              <Input
                id="hours"
                type="number"
                min="0"
                step="0.5"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                {t("Enter value in hours. Use 0.5 for 30 minutes, 0.25 for 15 minutes, etc.")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("Description")}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter description")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">{t("Sort Order")}</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">{t("Active")}</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAdd}>{t("Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Edit")} {formData.type} {t("Label")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("Label Name")} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Time Value (in hours)")} *</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Description")}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Sort Order")}</Label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>{t("Active")}</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditingItem(null); resetForm(); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEdit}>{t("Save Changes")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Confirm Delete")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete this label? This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
