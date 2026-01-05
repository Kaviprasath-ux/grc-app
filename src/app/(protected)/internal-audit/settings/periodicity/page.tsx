"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Periodicity {
  id: string;
  interval: string;
  months: number;
  createdAt: string;
  updatedAt: string;
}

export default function PeriodicityPage() {
  const router = useRouter();
  const [items, setItems] = useState<Periodicity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Periodicity | null>(null);
  const [formData, setFormData] = useState({ interval: "", months: 1 });
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Periodicity | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/internal-audit/periodicity");
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch periodicities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = () => {
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newOrder);
    const sorted = [...items].sort((a, b) => {
      if (newOrder === "asc") {
        return a.interval.localeCompare(b.interval);
      }
      return b.interval.localeCompare(a.interval);
    });
    setItems(sorted);
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({ interval: "", months: 1 });
    setDialogOpen(true);
  };

  const openEditDialog = (item: Periodicity) => {
    setEditItem(item);
    setFormData({ interval: item.interval, months: item.months });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.interval.trim()) return;

    setSaving(true);
    try {
      const url = editItem
        ? `/api/internal-audit/periodicity/${editItem.id}`
        : "/api/internal-audit/periodicity";
      const method = editItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interval: formData.interval,
          months: Number(formData.months) || 1
        }),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchItems();
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item: Periodicity) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/internal-audit/periodicity/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchItems();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Internal Audit</p>
            <h1 className="text-2xl font-semibold">Audit Settings</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/internal-audit/settings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">Internal Audit</p>
          <h1 className="text-2xl font-semibold">Audit Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Periodicity</h2>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Periodicity
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={handleSort} className="flex items-center gap-2 -ml-4">
                  Interval
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Months</TableHead>
              <TableHead className="w-[100px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.interval}</TableCell>
                <TableCell>{item.months}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  No items found. Add your first periodicity.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination info */}
        <div className="flex items-center justify-end mt-4 text-sm text-muted-foreground">
          Currently showing 1 to {items.length} of {items.length}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editItem ? "Edit Periodicity" : "Add Periodicity"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="interval">Interval</Label>
              <Input
                id="interval"
                value={formData.interval}
                onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                placeholder="Enter interval (e.g., Monthly, Quarterly)"
                className="mt-2"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="months">Months</Label>
              <Input
                id="months"
                type="number"
                min={1}
                value={formData.months}
                onChange={(e) => setFormData({ ...formData, months: parseInt(e.target.value) || 1 })}
                placeholder="Enter number of months"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.interval.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>OK</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
