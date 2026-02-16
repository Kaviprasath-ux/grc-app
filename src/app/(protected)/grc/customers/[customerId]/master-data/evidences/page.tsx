"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { Pencil, Trash2, Home, ChevronRight, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isValidName } from "@/lib/validations";

interface EvidenceItem {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  status: string;
  domain: string | null;
  framework: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  assignee: { id: string; fullName: string } | null;
}

export default function CustomerMasterDataEvidencesPage() {
  const params = useParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const customerId = params.customerId as string;

  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);

  const [editItem, setEditItem] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    fetchData();
    fetchCustomerName();
  }, [customerId]);

  const fetchCustomerName = async () => {
    try {
      const res = await fetch("/api/grc/customers");
      if (res.ok) {
        const data = await res.json();
        const found = data.find((c: { id: string; customerName: string }) => c.id === customerId);
        if (found) setCustomerName(found.customerName);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/grc/customers/${customerId}/evidences`);
      if (res.ok) setItems(await res.json());
    } catch (error) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id: string, name: string) => {
    setEditItem({ id, name });
    setEditName(name);
    setEditError("");
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    if (!editName.trim()) { setEditError(t("Name is required")); return; }
    if (!isValidName(editName.trim())) { setEditError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    try {
      const res = await fetch(`/api/evidences/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Item updated successfully") });
        fetchData();
        setIsEditOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating:", error);
      toast({ title: t("Error"), description: t("Failed to update"), variant: "destructive" });
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    try {
      const res = await fetch(`/api/evidences/${deleteItem.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Item deleted successfully") });
        fetchData();
        setIsDeleteOpen(false);
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting:", error);
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  };

  const breadcrumb = (
    <nav className="flex items-center gap-1.5 text-sm flex-wrap">
      <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
        <Home className="h-4 w-4" />
        <span>{t("GRC")}</span>
      </Link>
      <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
      <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">{t("Customers")}</Link>
      <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
      <Link href={`/grc/customers/${customerId}/frameworks`} className="text-slate-500 hover:text-primary-600 transition-colors">{customerName || t("Customer")}</Link>
      <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
      <Link href={`/grc/customers/${customerId}/frameworks?tab=masterdata`} className="text-slate-500 hover:text-primary-600 transition-colors">{t("Master Data")}</Link>
      <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
      <span className="text-primary-700 font-medium">{t("Evidence")}</span>
    </nav>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {breadcrumb}
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {breadcrumb}
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Evidence")}</h1>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 ps-5">{t("Code")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Description")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Framework")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Department")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Status")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 pe-5">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7}>
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3"><ClipboardCheck className="h-6 w-6 text-primary-500" /></div>
                    <h3 className="text-sm font-medium text-slate-600 mb-1">{t("No Evidence Found")}</h3>
                    <p className="text-xs text-slate-400">{t("No evidence found for this customer.")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.map((ev) => (
              <TableRow key={ev.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                <TableCell className="py-3.5 ps-5 text-sm text-slate-800">{ev.evidenceCode}</TableCell>
                <TableCell className="py-3.5 text-sm text-slate-600">{ev.name}</TableCell>
                <TableCell className="py-3.5 text-sm text-slate-600 max-w-[200px] truncate">{ev.description || "-"}</TableCell>
                <TableCell className="py-3.5 text-sm text-slate-600">{ev.framework?.name || "-"}</TableCell>
                <TableCell className="py-3.5 text-sm text-slate-600">{ev.department?.name || "-"}</TableCell>
                <TableCell className="py-3.5"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ev.status === "Collected" ? "bg-green-50 text-green-700 border-green-200" : ev.status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200" : ev.status === "In Review" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>{ev.status}</span></TableCell>
                <TableCell className="py-3.5 pe-5">
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => handleEdit(ev.id, ev.name)} title={t("Edit")}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50" onClick={() => handleDelete(ev.id, ev.name)} title={t("Delete")}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Evidence")}</DialogTitle></DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium text-slate-700">{t("Name")}</Label>
              <Input id="edit-name" value={editName} onChange={(e) => { setEditName(e.target.value); setEditError(""); }} placeholder={t("Enter name")} className="bg-white border-slate-200 rounded-lg" />
              {editError && <p className="text-sm text-red-500">{editError}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>{t("Cancel")}</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={!editName.trim()}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle></DialogHeader>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-slate-600">{t("Are you sure you want to delete")} <strong>{deleteItem?.name}</strong>? {t("This action cannot be undone.")}</p>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>{t("Cancel")}</Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>{t("Delete")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
