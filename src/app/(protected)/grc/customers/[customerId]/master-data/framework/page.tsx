"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  Eye,
  Home,
  ChevronRight,
  Shield,
  Download,
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
  const [customerName, setCustomerName] = useState<string>("");
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
    fetchCustomerName();
  }, [customerId]);

  const fetchCustomerName = async () => {
    try {
      const response = await fetch("/api/grc/customers");
      if (response.ok) {
        const data = await response.json();
        const found = data.find((c: { id: string; customerName: string }) => c.id === customerId);
        if (found) setCustomerName(found.customerName);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  };

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
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Customers")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-slate-500">{customerName || t("Customer")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Framework")}</span>
        </nav>
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
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
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Customers")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href={`/grc/customers/${customerId}/frameworks`} className="text-slate-500 hover:text-primary-600 transition-colors">
          {customerName || t("Customer")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-slate-500">{t("Master Data")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Framework")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Framework")}</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button onClick={handleNewFramework} size="sm" className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 me-2" />
            {t("New Framework")}
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 me-2" />
            {t("Export")}
          </Button>
        </div>
      </div>

      {/* Framework Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table className="min-w-[500px]">
          <TableHeader>
            <TableRow className="h-11 bg-slate-50 hover:bg-slate-50">
              <TableHead className="pl-5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <button
                  className="flex items-center gap-1 hover:text-slate-800"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  {t("Framework Name")}
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-40">
                {t("Action")}
              </TableHead>
              <TableHead className="text-center w-16">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedFrameworks.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3}>
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                      <Shield className="h-6 w-6 text-primary-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      {t("No Frameworks Found")}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t("No frameworks available for this customer.")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedFrameworks.map((framework) => (
                <TableRow key={framework.id} className="hover:bg-slate-50">
                  <TableCell className="py-4 pl-5 text-sm font-medium text-slate-800">
                    {framework.name}
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => handleEditFramework(framework)}
                        title={t("Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => handleDeleteFramework(framework)}
                        title={t("Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    {showDetails && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {framework.type}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Framework Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Framework")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium text-slate-700">{t("Framework Name")}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("Enter framework name")}
                className="bg-slate-50 border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={!editName.trim()}>
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-slate-600">
              {t("Are you sure you want to delete")} <strong>{deletingFramework?.name}</strong>? {t("This action cannot be undone.")}
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>
              {t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
