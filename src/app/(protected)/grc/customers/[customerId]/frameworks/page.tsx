"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Plus,
  Upload,
} from "lucide-react";

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

interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
  email: string;
  userName: string;
}

interface NewFramework {
  name: string;
  description: string;
  type: string;
  country: string;
  industry: string;
}

export default function CustomerFrameworkOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("Framework");
  const [creationMode, setCreationMode] = useState<string>("Manual");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<NewFramework>({
    name: "",
    description: "",
    type: "",
    country: "",
    industry: "",
  });

  useEffect(() => {
    fetchCustomer();
    fetchFrameworks();
  }, [customerId]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch("/api/grc/customers");
      if (response.ok) {
        const data = await response.json();
        const foundCustomer = data.find((c: Customer) => c.id === customerId);
        setCustomer(foundCustomer || null);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  };

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

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "",
      country: "",
      industry: "",
    });
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
    router.push(`/compliance/framework/${framework.id}`);
  };

  const handleBack = () => {
    router.push("/grc/customers");
  };

  const tabs = ["Framework", "Control", "Policy", "Evidence", "Master data"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            className="text-gray-600 hover:text-gray-800 p-0 h-auto"
            onClick={handleBack}
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-blue-700">Frameworks</h1>
            <p className="text-sm text-blue-600 bg-blue-100 px-2 py-1 mt-1 inline-block">
              {customer?.customerName || "Loading..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={openCreateDialog}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Frameworks
          </Button>
          <Select value={creationMode} onValueChange={setCreationMode}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Manual">Manual</SelectItem>
              <SelectItem value="AI">AI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs and Content */}
      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-40 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`w-full text-left px-4 py-3 rounded-sm transition-colors ${
                activeTab === tab
                  ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Framework Cards Grid */}
        <div className="flex-1">
          {activeTab === "Framework" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {frameworks.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No frameworks found.
                </div>
              ) : (
                frameworks.map((framework) => (
                  <div
                    key={framework.id}
                    className={`bg-white rounded-lg shadow-sm border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                      framework.isCustom ? "border-l-4 border-l-gray-400" : ""
                    }`}
                    onClick={() => handleFrameworkClick(framework)}
                  >
                    {/* Framework Name */}
                    <h4 className="text-base font-semibold text-blue-800 mb-4 truncate">
                      {framework.name}
                    </h4>

                    {/* Compliance Circle */}
                    <div className="flex justify-center mb-4">
                      <div className="relative w-28 h-28">
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
                          <span className="text-lg font-bold text-gray-800">
                            {framework.compliancePercentage.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500">Compliant</span>
                        </div>
                      </div>
                    </div>

                    {/* Policy and Evidence Progress Bars */}
                    <div className="space-y-3">
                      {/* Policy */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${framework.policyPercentage}%` }}
                          />
                        </div>
                        <div className="text-right min-w-[80px]">
                          <span className="text-sm font-medium">{framework.policyPercentage.toFixed(1)}%</span>
                          <span className="text-xs text-gray-500 ml-1">Policy</span>
                        </div>
                      </div>

                      {/* Evidence */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
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
          )}

          {activeTab !== "Framework" && (
            <div className="text-center py-12 text-gray-500">
              {activeTab} tab content
            </div>
          )}
        </div>
      </div>

      {/* Create Framework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Integrated Framework</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
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

            {creationMode === "AI" && (
              <div className="space-y-2">
                <Label>Upload Support Document</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-gray-300 hover:border-gray-400">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">Click here, or drop files here to upload.</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-start gap-2 pt-4">
              <Button
                onClick={handleCreate}
                disabled={!formData.name || !formData.type || !formData.country || !formData.industry}
                className="bg-blue-600 hover:bg-blue-700"
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
