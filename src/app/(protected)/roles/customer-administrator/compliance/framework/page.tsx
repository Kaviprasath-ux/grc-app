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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
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
  name: string;
  description: string;
  type: string;
  country: string;
  industry: string;
}

const ITEMS_PER_PAGE = 6;

export default function CustomerAdminFrameworkPage() {
  const router = useRouter();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  // Filter states
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>("Subscribed");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form state
  const [formData, setFormData] = useState<NewFramework>({
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

  // Apply filters
  const filteredFrameworks = frameworks.filter((fw) => {
    // Subscription filter
    if (subscriptionFilter === "Subscribed" && fw.status !== "Subscribed") return false;
    if (subscriptionFilter === "Not Subscribed" && fw.status === "Subscribed") return false;

    // Type filter
    if (typeFilter && fw.type !== typeFilter) return false;

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredFrameworks.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredFrameworks.length);
  const currentFrameworks = filteredFrameworks.slice(startIndex, endIndex);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "",
      country: "",
      industry: "",
    });
    setUploadedFile(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    try {
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
    } catch (error) {
      console.error("Error creating framework:", error);
    }
  };

  const handleFrameworkClick = (framework: Framework) => {
    router.push(`/roles/customer-administrator/compliance/framework/${framework.id}`);
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [subscriptionFilter, typeFilter]);

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
          <h3 className="text-xl font-semibold text-[#1e3a5f]">Integrated Frameworks</h3>
          <div className="flex items-center gap-3">
            <Button
              onClick={openCreateDialog}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              New Integrated Framework (AI)
            </Button>

            {/* Subscription Type Filter */}
            <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Subscription Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Subscription Type</SelectItem>
                <SelectItem value="Subscribed">Subscribed</SelectItem>
                <SelectItem value="Not Subscribed">Not Subscribed</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Select Type</SelectItem>
                <SelectItem value="Framework">Framework</SelectItem>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Regulation">Regulation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Pagination Info */}
      <div className="flex justify-end px-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0}
            className="h-8 w-8"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {filteredFrameworks.length > 0
              ? `${startIndex + 1} to ${endIndex} of ${filteredFrameworks.length}`
              : "No frameworks"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            className="h-8 w-8"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Framework Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentFrameworks.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No frameworks found.
          </div>
        ) : (
          currentFrameworks.map((framework) => (
            <div
              key={framework.id}
              className={`bg-white rounded-lg shadow-sm border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                framework.isCustom ? "border-l-4 border-l-gray-400" : ""
              }`}
              onClick={() => handleFrameworkClick(framework)}
            >
              {/* Framework Name */}
              <h4 className="text-base font-semibold text-[#1e3a5f] mb-4 truncate">
                {framework.name}
              </h4>

              {/* Compliance Circle - Clickable */}
              <div className="flex justify-center mb-4">
                <div
                  className="relative w-28 h-28 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/roles/customer-administrator/compliance/framework/${framework.id}/controls`);
                  }}
                  title="Click to view controls"
                >
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${framework.compliancePercentage * 2.51} 251`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-[#1e3a5f]">
                      {framework.compliancePercentage.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500">Compliance</span>
                  </div>
                </div>
              </div>

              {/* Policy and Evidence Progress Bars - Clickable */}
              <div className="space-y-3">
                {/* Policy - Clickable */}
                <div
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity p-1 -m-1 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/roles/customer-administrator/compliance/framework/${framework.id}/policies`);
                  }}
                  title="Click to view policies"
                >
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#22c55e] rounded-full"
                      style={{ width: `${framework.policyPercentage}%` }}
                    />
                  </div>
                  <div className="text-right min-w-[80px]">
                    <span className="text-sm font-medium">{framework.policyPercentage.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500 ml-1">Policy</span>
                  </div>
                </div>

                {/* Evidence - Clickable */}
                <div
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity p-1 -m-1 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/roles/customer-administrator/compliance/framework/${framework.id}/evidence`);
                  }}
                  title="Click to view evidence"
                >
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#22c55e] rounded-full"
                      style={{ width: `${framework.evidencePercentage}%` }}
                    />
                  </div>
                  <div className="text-right min-w-[80px]">
                    <span className="text-sm font-medium">{framework.evidencePercentage.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500 ml-1">Evidence</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Framework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Integrated Framework</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Note: Custom framework will be automatically added in grey color to
              differentiate between Subscribed Frameworks.
            </p>

            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1">
                Integrated Framework Name <span className="text-red-500">*</span>
              </Label>
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
              <Label htmlFor="type" className="flex items-center gap-1">
                Framework Type <span className="text-red-500">*</span>
              </Label>
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
                <Label htmlFor="country" className="flex items-center gap-1">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Enter country"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry" className="flex items-center gap-1">
                  Industry <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="Enter industry"
                />
              </div>
            </div>

            {/* File Upload */}
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

            <div className="flex justify-start gap-2 pt-4">
              <Button
                onClick={handleCreate}
                disabled={!formData.name || !formData.type || !formData.country || !formData.industry}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              >
                Save
              </Button>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
