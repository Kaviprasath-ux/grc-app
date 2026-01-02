"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Pencil, Trash2, Download, Search, Upload, Check } from "lucide-react";

interface Framework {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  type: string;
  status: string;
  country: string | null;
  industry: string | null;
  isCustom: boolean;
}

export default function FrameworkMasterDataPage() {
  const router = useRouter();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<Framework | null>(null);

  // Multi-step wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useAIControls, setUseAIControls] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "Framework",
    status: "Subscribed",
    country: "",
    industry: "",
    isCustom: true,
  });

  const fetchFrameworks = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchFrameworks();
  }, [fetchFrameworks]);

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        resetForm();
        fetchFrameworks();
      }
    } catch (error) {
      console.error("Error creating framework:", error);
    }
  };

  const handleEdit = async () => {
    if (!selectedFramework) return;
    try {
      const response = await fetch(`/api/frameworks/${selectedFramework.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setSelectedFramework(null);
        resetForm();
        fetchFrameworks();
      }
    } catch (error) {
      console.error("Error updating framework:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedFramework) return;
    try {
      const response = await fetch(`/api/frameworks/${selectedFramework.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setSelectedFramework(null);
        fetchFrameworks();
      }
    } catch (error) {
      console.error("Error deleting framework:", error);
    }
  };

  const openEditDialog = (framework: Framework) => {
    setSelectedFramework(framework);
    setFormData({
      name: framework.name,
      description: framework.description || "",
      type: framework.type,
      status: framework.status,
      country: framework.country || "",
      industry: framework.industry || "",
      isCustom: framework.isCustom,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (framework: Framework) => {
    setSelectedFramework(framework);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "Framework",
      status: "Subscribed",
      country: "",
      industry: "",
      isCustom: true,
    });
    setWizardStep(1);
    setSelectedFile(null);
    setUseAIControls(false);
  };

  const handleNextStep = () => {
    setWizardStep(2);
  };

  const handlePreviousStep = () => {
    setWizardStep(1);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    try {
      // First create the framework
      const response = await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const framework = await response.json();

        // If file is selected, upload requirements
        if (selectedFile) {
          const formDataUpload = new FormData();
          formDataUpload.append("file", selectedFile);
          formDataUpload.append("frameworkId", framework.id);
          formDataUpload.append("useAI", String(useAIControls));

          await fetch("/api/frameworks/import", {
            method: "POST",
            body: formDataUpload,
          });
        }

        setCreateDialogOpen(false);
        resetForm();
        fetchFrameworks();
      }
    } catch (error) {
      console.error("Error creating framework:", error);
    }
  };

  const handleDownloadTemplate = () => {
    // Download CSV template for requirement import
    const template = "Code,Name,Description,Requirement Type,Chapter Type,Level\n";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requirement_template.csv";
    a.click();
  };

  const handleExport = () => {
    const csv = [
      ["Name", "Version", "Type", "Status", "Country", "Industry"],
      ...frameworks.map((f) => [
        f.name,
        f.version || "",
        f.type,
        f.status,
        f.country || "",
        f.industry || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frameworks.csv";
    a.click();
  };

  const filteredFrameworks = frameworks.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/master-data")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Framework</h1>
            <p className="text-gray-600">Manage compliance frameworks</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Framework
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {wizardStep === 1 ? "Create Integrated Framework" : "Import Requirement"}
                </DialogTitle>
              </DialogHeader>

              {/* Stepper */}
              <div className="flex items-center justify-center mb-4">
                <div className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${wizardStep >= 1 ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}>
                    {wizardStep > 1 ? <Check className="h-4 w-4" /> : "1"}
                  </div>
                  <span className={`ml-2 text-sm ${wizardStep === 1 ? 'font-semibold' : 'text-gray-500'}`}>Framework Details</span>
                </div>
                <div className="w-12 h-0.5 bg-gray-300 mx-3" />
                <div className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${wizardStep >= 2 ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}>
                    2
                  </div>
                  <span className={`ml-2 text-sm ${wizardStep === 2 ? 'font-semibold' : 'text-gray-500'}`}>Import Requirement</span>
                </div>
              </div>

              {/* Step 1: Framework Details */}
              {wizardStep === 1 && (
                <div className="space-y-4 py-4">
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    Note: Custom framework will be automatically added in grey color to differentiate between Subscribed Frameworks.
                  </p>
                  <div>
                    <Label>Integrated Framework Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label>Framework Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Framework">Framework</SelectItem>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Regulation">Regulation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Country *</Label>
                      <Input
                        value={formData.country}
                        onChange={(e) =>
                          setFormData({ ...formData, country: e.target.value })
                        }
                        placeholder=""
                      />
                    </div>
                    <div>
                      <Label>Industry *</Label>
                      <Input
                        value={formData.industry}
                        onChange={(e) =>
                          setFormData({ ...formData, industry: e.target.value })
                        }
                        placeholder=""
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreateDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      disabled={!formData.name || !formData.country || !formData.industry}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Import Requirements */}
              {wizardStep === 2 && (
                <div className="space-y-4 py-4">
                  <div>
                    <Label>File</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="text"
                        value={selectedFile?.name || ""}
                        readOnly
                        placeholder="Choose a file..."
                        className="flex-1"
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Browse...
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="useAI"
                      checked={useAIControls}
                      onCheckedChange={(checked) => setUseAIControls(checked as boolean)}
                    />
                    <Label htmlFor="useAI" className="cursor-pointer">
                      Do you want to get controls from our AI?
                    </Label>
                  </div>
                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={handleDownloadTemplate}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handlePreviousStep}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCreateDialogOpen(false);
                          resetForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleImport}>
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search frameworks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Framework Name</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFrameworks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8">
                    <p className="text-gray-500">No frameworks found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredFrameworks.map((framework) => (
                  <TableRow key={framework.id}>
                    <TableCell className="font-medium">
                      {framework.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(framework)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(framework)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredFrameworks.length} of {frameworks.length} frameworks
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Integrated Framework</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Integrated Framework Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Framework Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Framework">Framework</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Regulation">Regulation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Country *</Label>
                <Input
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Industry *</Label>
                <Input
                  value={formData.industry}
                  onChange={(e) =>
                    setFormData({ ...formData, industry: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedFramework(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={!formData.name || !formData.country || !formData.industry}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Framework</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedFramework?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
