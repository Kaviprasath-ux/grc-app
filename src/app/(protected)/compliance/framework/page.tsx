"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { FrameworkCard } from "@/components/compliance/framework-card";

interface Framework {
  id: string;
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
  _count?: {
    controls: number;
    evidences: number;
    requirements: number;
  };
}

const ITEMS_PER_PAGE = 6;

export default function FrameworkOverviewPage() {
  const router = useRouter();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [filteredFrameworks, setFilteredFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>("Subscribed");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newFramework, setNewFramework] = useState({
    name: "",
    description: "",
    type: "Framework",
    country: "",
    industry: "",
  });

  useEffect(() => {
    fetchFrameworks();
  }, []);

  useEffect(() => {
    filterFrameworks();
  }, [frameworks, subscriptionFilter, typeFilter]);

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

  const filterFrameworks = () => {
    let filtered = [...frameworks];

    if (subscriptionFilter && subscriptionFilter !== "all") {
      filtered = filtered.filter((f) => f.status === subscriptionFilter);
    }

    if (typeFilter && typeFilter !== "all") {
      filtered = filtered.filter((f) => f.type === typeFilter);
    }

    setFilteredFrameworks(filtered);
    setCurrentPage(0);
  };

  const handleCreateFramework = async () => {
    try {
      const response = await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newFramework,
          isCustom: true,
          status: "Subscribed",
        }),
      });

      if (response.ok) {
        setIsCreateDialogOpen(false);
        setNewFramework({
          name: "",
          description: "",
          type: "Framework",
          country: "",
          industry: "",
        });
        fetchFrameworks();
      }
    } catch (error) {
      console.error("Error creating framework:", error);
    }
  };

  const handleFrameworkClick = (framework: Framework) => {
    router.push(`/compliance/framework/${framework.id}`);
  };

  // Pagination
  const totalPages = Math.ceil(filteredFrameworks.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredFrameworks.length);
  const currentFrameworks = filteredFrameworks.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Integrated Frameworks</h1>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              New Integrated Framework (AI)
            </Button>

            <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Subscription Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subscriptions</SelectItem>
                <SelectItem value="Subscribed">Subscribed</SelectItem>
                <SelectItem value="Not Subscribed">Not Subscribed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] bg-white">
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

      {/* Pagination Controls */}
      <div className="flex items-center justify-start gap-2 px-1">
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
        <span className="text-sm text-muted-foreground px-3 py-1 bg-white rounded border">
          {filteredFrameworks.length > 0
            ? `${startIndex + 1} to ${endIndex} of ${filteredFrameworks.length}`
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

      {/* Framework Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {currentFrameworks.map((framework) => (
          <FrameworkCard
            key={framework.id}
            id={framework.id}
            name={framework.name}
            compliancePercentage={framework.compliancePercentage}
            policyPercentage={framework.policyPercentage}
            evidencePercentage={framework.evidencePercentage}
            onClick={() => handleFrameworkClick(framework)}
          />
        ))}
      </div>

      {filteredFrameworks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-muted-foreground">No frameworks found matching your filters.</p>
        </div>
      )}

      {/* Create Framework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Create Integrated Framework
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-100">
              Note: Custom framework will be automatically added and marked as custom to
              differentiate from pre-built frameworks.
            </p>

            <div className="space-y-2">
              <Label htmlFor="name">Integrated Framework Name *</Label>
              <Input
                id="name"
                value={newFramework.name}
                onChange={(e) =>
                  setNewFramework({ ...newFramework, name: e.target.value })
                }
                placeholder="Enter framework name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newFramework.description}
                onChange={(e) =>
                  setNewFramework({ ...newFramework, description: e.target.value })
                }
                placeholder="Enter description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Framework Type</Label>
              <Select
                value={newFramework.type}
                onValueChange={(value) =>
                  setNewFramework({ ...newFramework, type: value })
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
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={newFramework.country}
                  onChange={(e) =>
                    setNewFramework({ ...newFramework, country: e.target.value })
                  }
                  placeholder="Enter country"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={newFramework.industry}
                  onChange={(e) =>
                    setNewFramework({ ...newFramework, industry: e.target.value })
                  }
                  placeholder="Enter industry"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Upload Support Document</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center gap-2">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm">Click here, or drop files to upload</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFramework} disabled={!newFramework.name}>
                Create Framework
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
