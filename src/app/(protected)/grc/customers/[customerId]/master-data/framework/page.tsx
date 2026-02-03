"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  Eye,
  Home,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface Framework {
  id: string;
  code?: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  country?: string;
  industry?: string;
  isCustom: boolean;
  compliancePercentage: number;
  policyPercentage: number;
  evidencePercentage: number;
}

export default function MasterDataFrameworkPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const customerId = params.customerId as string;

  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // Edit dialog
  const [editingFramework, setEditingFramework] = useState<Framework | null>(null);
  const [editName, setEditName] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Delete dialog
  const [deletingFramework, setDeletingFramework] = useState<Framework | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    fetchFrameworks();
  }, [customerId]);

  const fetchFrameworks = async () => {
    try {
      const response = await fetch(`/api/grc/customers/${customerId}/frameworks`);
      if (response.ok) {
        const data = await response.json();
        setFrameworks(data);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    } finally {
      setLoading(false);
    }
  };

  const sortedFrameworks = [...frameworks].sort((a, b) =>
    sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
  );

  const handleBack = () => {
    router.push(`/grc/customers/${customerId}/frameworks`);
  };

  const handleNewFramework = () => {
    // Navigate back to the frameworks page where the create dialog exists
    router.push(`/grc/customers/${customerId}/frameworks`);
  };

  const handleEditFramework = (framework: Framework) => {
    setEditingFramework(framework);
    setEditName(framework.name);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFramework) return;
    try {
      const response = await fetch(`/api/frameworks/${editingFramework.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      if (response.ok) {
        toast({ title: t("Success"), description: t("Framework updated successfully") });
        fetchFrameworks();
        setIsEditDialogOpen(false);
      } else {
        const error = await response.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update framework"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating framework:", error);
      toast({ title: t("Error"), description: t("Failed to update framework"), variant: "destructive" });
    }
  };

  const handleDeleteFramework = (framework: Framework) => {
    setDeletingFramework(framework);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingFramework) return;
    try {
      const response = await fetch(`/api/frameworks/${deletingFramework.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({ title: t("Success"), description: t("Framework deleted successfully") });
        fetchFrameworks();
        setIsDeleteDialogOpen(false);
      } else {
        const error = await response.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete framework"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting framework:", error);
      toast({ title: t("Error"), description: t("Failed to delete framework"), variant: "destructive" });
    }
  };

  const handleExport = async () => {
    try {
      const XLSX = await import("xlsx");
      const exportData = frameworks.map((f) => ({
        "Framework Name": f.name,
        "Type": f.type,
        "Status": f.status,
        "Country": f.country || "",
        "Industry": f.industry || "",
        "Compliance %": f.compliancePercentage,
        "Policy %": f.policyPercentage,
        "Evidence %": f.evidencePercentage,
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Frameworks");
      XLSX.writeFile(workbook, "customer_frameworks.xlsx");
      toast({ title: t("Exported"), description: t("Frameworks exported successfully") });
    } catch (error) {
      console.error("Error exporting:", error);
      toast({ title: t("Error"), description: t("Failed to export frameworks"), variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Customers")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href={`/grc/customers/${customerId}/frameworks`} className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Frameworks")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-500">{t("Master Data")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Framework")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("Framework")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleNewFramework}
            size="sm"
          >
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("New Framework")}
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
          >
            {t("Export")}
          </Button>
        </div>
      </div>

      {/* Framework Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                background: "linear-gradient(135deg, #0a0a5c 0%, #1a1a8c 50%, #0d0d6b 100%)",
              }}
            >
              <th className="text-left p-4 text-white font-semibold">
                <div className="flex items-center gap-2">
                  {t("Framework Name")}
                  <button
                    onClick={() => setSortAsc(!sortAsc)}
                    className="text-white/80 hover:text-white"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </div>
              </th>
              <th className="text-center p-4 text-white font-semibold w-40">{t("Action")}</th>
              <th className="text-center p-4 text-white font-semibold w-16">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-white/80 hover:text-white border border-white/40 rounded p-1"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedFrameworks.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-gray-500">
                  {t("No frameworks found.")}
                </td>
              </tr>
            ) : (
              sortedFrameworks.map((framework, index) => (
                <tr
                  key={framework.id}
                  className={`border-b hover:bg-blue-50/50 ${
                    index % 2 === 0 ? "bg-white" : "bg-blue-50/30"
                  }`}
                >
                  <td className="p-4 text-gray-800 font-medium">{framework.name}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => handleEditFramework(framework)}
                        className="text-blue-600 hover:text-blue-800"
                        title={t("Edit")}
                      >
                        <Pencil className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFramework(framework)}
                        className="text-red-500 hover:text-red-700"
                        title={t("Delete")}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {showDetails && (
                      <span className="text-xs text-gray-500">{framework.type}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Framework Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-700">{t("Edit Framework")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("Framework Name")}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("Enter framework name")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {t("Save")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">{t("Delete Framework")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              {t("Are you sure you want to delete")} <strong>{deletingFramework?.name}</strong>? {t("This action cannot be undone.")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {t("Delete")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
