"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Pencil,
  Trash2,
  Sparkles,
  Plus,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";

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

interface NewFramework {
  code: string;
  name: string;
  description: string;
  type: string;
  country: string;
  industry: string;
}

const ITEMS_PER_PAGE = 15;

export default function FrameworkOverviewPage() {
  const router = useRouter();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortField, setSortField] = useState<string>("code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAICreate, setIsAICreate] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingFramework, setEditingFramework] = useState<Framework | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [frameworkToDelete, setFrameworkToDelete] = useState<Framework | null>(null);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form state
  const [formData, setFormData] = useState<NewFramework>({
    code: "",
    name: "",
    description: "",
    type: "",
    country: "",
    industry: "",
  });

  useEffect(() => {
    fetchFrameworks();
  }, []);

  const fetchFrameworks = async () => {
    try {
      const response = await fetch("/api/frameworks");
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedFrameworks = [...frameworks].sort((a, b) => {
    const aValue = (a[sortField as keyof Framework] || "") as string;
    const bValue = (b[sortField as keyof Framework] || "") as string;

    if (sortDirection === "asc") {
      return aValue.localeCompare(bValue);
    }
    return bValue.localeCompare(aValue);
  });

  // Pagination
  const totalPages = Math.ceil(sortedFrameworks.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, sortedFrameworks.length);
  const currentFrameworks = sortedFrameworks.slice(startIndex, endIndex);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      type: "",
      country: "",
      industry: "",
    });
    setUploadedFile(null);
    setIsEditMode(false);
    setEditingFramework(null);
  };

  const openCreateDialog = (isAI: boolean) => {
    resetForm();
    setIsAICreate(isAI);
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (framework: Framework) => {
    setFormData({
      code: framework.code || "",
      name: framework.name,
      description: framework.description || "",
      type: framework.type || "",
      country: framework.country || "",
      industry: framework.industry || "",
    });
    setEditingFramework(framework);
    setIsEditMode(true);
    setIsAICreate(false);
    setIsCreateDialogOpen(true);
  };

  const handleCreateOrUpdate = async () => {
    try {
      if (isEditMode && editingFramework) {
        // Update existing framework
        const response = await fetch(`/api/frameworks/${editingFramework.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
          }),
        });

        if (response.ok) {
          setIsCreateDialogOpen(false);
          resetForm();
          fetchFrameworks();
        }
      } else {
        // Create new framework
        const response = await fetch("/api/frameworks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            isCustom: true,
            status: "Subscribed",
          }),
        });

        if (response.ok) {
          setIsCreateDialogOpen(false);
          resetForm();
          fetchFrameworks();
        }
      }
    } catch (error) {
      console.error("Error saving framework:", error);
    }
  };

  const handleDelete = async () => {
    if (!frameworkToDelete) return;

    try {
      const response = await fetch(`/api/frameworks/${frameworkToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIsDeleteDialogOpen(false);
        setFrameworkToDelete(null);
        fetchFrameworks();
      }
    } catch (error) {
      console.error("Error deleting framework:", error);
    }
  };

  const openDeleteDialog = (framework: Framework) => {
    setFrameworkToDelete(framework);
    setIsDeleteDialogOpen(true);
  };

  // File upload handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setUploadedFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Frameworks</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => openCreateDialog(true)}
              variant="outline"
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              New Integrated Framework (AI)
            </Button>
            <Button
              onClick={() => openCreateDialog(false)}
              variant="outline"
              className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Integrated Framework
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("code")}
                  className="h-8 px-2 font-semibold"
                >
                  Code
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("name")}
                  className="h-8 px-2 font-semibold"
                >
                  FrameworkName
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[40%]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("description")}
                  className="h-8 px-2 font-semibold"
                >
                  Description
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px] text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentFrameworks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No frameworks found.
                </TableCell>
              </TableRow>
            ) : (
              currentFrameworks.map((framework) => (
                <TableRow
                  key={framework.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onDoubleClick={() => router.push(`/compliance/framework/${framework.id}`)}
                >
                  <TableCell className="font-medium">{framework.code || "-"}</TableCell>
                  <TableCell>{framework.name}</TableCell>
                  <TableCell className="text-gray-600 truncate max-w-[400px]">
                    {framework.description || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(framework)}
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(framework)}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 p-4 border-t">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0}
            className="h-8 w-8"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-3 py-1">
            {sortedFrameworks.length > 0
              ? `Currently showing ${startIndex + 1} to ${endIndex} of ${sortedFrameworks.length}`
              : "No frameworks"}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            className="h-8 w-8"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create/Edit Framework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Create Integrated Framework" : "Create Integrated Framework"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Please find out the following details to create new compliance framework.
              Provide distinctive name for easy identification. Note that custom framework
              will be automatically assigned a grey color to differentiate them from
              standard frameworks in the dashboard.
            </p>

            {isEditMode && (
              <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                Note: Custom framework will be automatically added in grey color to
                differentiate between Subscribed Frameworks.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Enter code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Integrated Framework Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter framework name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Framework Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Framework">Framework</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Regulation">Regulation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Enter country"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="Enter industry"
                />
              </div>
            </div>

            {/* File Upload - Only for AI version */}
            {isAICreate && (
              <div className="space-y-2">
                <Label>Upload Support Document</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xlsx,.xls"
                  />
                  {uploadedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-green-500" />
                      <span className="text-sm font-medium text-green-600">
                        {uploadedFile.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFile(null);
                        }}
                        className="text-red-500 hover:text-red-600"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="h-8 w-8" />
                      <span className="text-sm">Click here, or drop files here to upload.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              {isEditMode && (
                <Button onClick={handleCreateOrUpdate} disabled={!formData.name}>
                  Save
                </Button>
              )}
              <Button
                onClick={handleCreateOrUpdate}
                disabled={!formData.name}
                variant={isEditMode ? "outline" : "default"}
              >
                Create
              </Button>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
