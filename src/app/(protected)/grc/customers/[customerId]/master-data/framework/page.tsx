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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
        toast({ title: "Success", description: "Framework updated successfully" });
        fetchFrameworks();
        setIsEditDialogOpen(false);
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to update framework", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating framework:", error);
      toast({ title: "Error", description: "Failed to update framework", variant: "destructive" });
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
        toast({ title: "Success", description: "Framework deleted successfully" });
        fetchFrameworks();
        setIsDeleteDialogOpen(false);
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to delete framework", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting framework:", error);
      toast({ title: "Error", description: "Failed to delete framework", variant: "destructive" });
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
      toast({ title: "Exported", description: "Frameworks exported successfully" });
    } catch (error) {
      console.error("Error exporting:", error);
      toast({ title: "Error", description: "Failed to export frameworks", variant: "destructive" });
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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="text-gray-700 hover:text-gray-900 flex items-center gap-1 text-sm font-medium"
            onClick={handleBack}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-blue-700">Framework</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleNewFramework}
            className="bg-blue-700 hover:bg-blue-800 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Framework
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Export
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
                  Framework Name
                  <button
                    onClick={() => setSortAsc(!sortAsc)}
                    className="text-white/80 hover:text-white"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </div>
              </th>
              <th className="text-center p-4 text-white font-semibold w-40">Action</th>
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
                  No frameworks found.
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
                        title="Edit"
                      >
                        <Pencil className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFramework(framework)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete"
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
            <DialogTitle className="text-blue-700">Edit Framework</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Framework Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter framework name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Framework</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deletingFramework?.name}</strong>? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
