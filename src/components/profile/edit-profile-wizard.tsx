"use client";

import { useState } from "react";
import { Check, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Branch {
  id?: string;
  location: string;
  address: string;
}

interface DataCenter {
  id?: string;
  locationType: string;
  address?: string;
  vendor?: string;
}

interface CloudProvider {
  id?: string;
  name: string;
  serviceType: string;
}

interface OrganizationData {
  id: string;
  name: string;
  email: string;
  phone: string;
  logo: string;
  establishedDate: string;
  employeeCount: number;
  branchCount: number;
  headOfficeLocation: string;
  headOfficeAddress: string;
  website: string;
  description: string;
  vision: string;
  mission: string;
  value: string;
  ceoMessage: string;
  facebook: string;
  youtube: string;
  twitter: string;
  linkedin: string;
  brochure: string;
  branches: Branch[];
  dataCenters: DataCenter[];
  cloudProviders: CloudProvider[];
}

interface EditProfileWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: OrganizationData | null;
  onSave: (data: OrganizationData) => Promise<void>;
}

const steps = [
  { id: 1, name: "Info", description: "Basic information" },
  { id: 2, name: "VMW", description: "Vision, Mission, Values" },
  { id: 3, name: "CEO Message", description: "CEO message" },
  { id: 4, name: "Preview & Save", description: "Review and save" },
];

export function EditProfileWizard({
  open,
  onOpenChange,
  organization,
  onSave,
}: EditProfileWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<OrganizationData>({
    id: "",
    name: "",
    email: "",
    phone: "",
    logo: "",
    establishedDate: "",
    employeeCount: 0,
    branchCount: 0,
    headOfficeLocation: "",
    headOfficeAddress: "",
    website: "",
    description: "",
    vision: "",
    mission: "",
    value: "",
    ceoMessage: "",
    facebook: "",
    youtube: "",
    twitter: "",
    linkedin: "",
    brochure: "",
    branches: [],
    dataCenters: [],
    cloudProviders: [],
  });

  // Initialize form data when organization changes
  useState(() => {
    if (organization) {
      setFormData({
        ...organization,
        email: organization.email || "",
        phone: organization.phone || "",
        logo: organization.logo || "",
        value: organization.value || "",
        ceoMessage: organization.ceoMessage || "",
        facebook: organization.facebook || "",
        youtube: organization.youtube || "",
        twitter: organization.twitter || "",
        linkedin: organization.linkedin || "",
        brochure: organization.brochure || "",
        branches: organization.branches || [],
        dataCenters: organization.dataCenters || [],
        cloudProviders: organization.cloudProviders || [],
      });
    }
  });

  // Reset form when dialog opens with new organization
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && organization) {
      setFormData({
        ...organization,
        email: organization.email || "",
        phone: organization.phone || "",
        logo: organization.logo || "",
        value: organization.value || "",
        ceoMessage: organization.ceoMessage || "",
        facebook: organization.facebook || "",
        youtube: organization.youtube || "",
        twitter: organization.twitter || "",
        linkedin: organization.linkedin || "",
        brochure: organization.brochure || "",
        branches: organization.branches || [],
        dataCenters: organization.dataCenters || [],
        cloudProviders: organization.cloudProviders || [],
      });
      setCurrentStep(1);
    }
    onOpenChange(newOpen);
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving organization:", error);
    }
    setSaving(false);
  };

  // Branch handlers
  const addBranch = () => {
    setFormData({
      ...formData,
      branches: [...formData.branches, { location: "", address: "" }],
    });
  };

  const removeBranch = (index: number) => {
    setFormData({
      ...formData,
      branches: formData.branches.filter((_, i) => i !== index),
    });
  };

  const updateBranch = (index: number, field: keyof Branch, value: string) => {
    const updated = [...formData.branches];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, branches: updated });
  };

  // Data Center handlers
  const addDataCenter = () => {
    setFormData({
      ...formData,
      dataCenters: [...formData.dataCenters, { locationType: "On-Prem", address: "" }],
    });
  };

  const removeDataCenter = (index: number) => {
    setFormData({
      ...formData,
      dataCenters: formData.dataCenters.filter((_, i) => i !== index),
    });
  };

  const updateDataCenter = (index: number, field: keyof DataCenter, value: string) => {
    const updated = [...formData.dataCenters];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, dataCenters: updated });
  };

  // Cloud Provider handlers
  const addCloudProvider = () => {
    setFormData({
      ...formData,
      cloudProviders: [...formData.cloudProviders, { name: "", serviceType: "" }],
    });
  };

  const removeCloudProvider = (index: number) => {
    setFormData({
      ...formData,
      cloudProviders: formData.cloudProviders.filter((_, i) => i !== index),
    });
  };

  const updateCloudProvider = (index: number, field: keyof CloudProvider, value: string) => {
    const updated = [...formData.cloudProviders];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, cloudProviders: updated });
  };

  // File upload handler (placeholder - implement actual upload)
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo" | "brochure"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formDataUpload,
        });
        if (res.ok) {
          const data = await res.json();
          setFormData({ ...formData, [field]: data.url });
        }
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center py-6">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                    currentStep > step.id
                      ? "bg-green-500 border-green-500 text-white"
                      : currentStep === step.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-muted border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-16 h-0.5 mx-2 transition-colors",
                    currentStep > step.id ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="py-4">
          {/* Step 1: Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Logo */}
              <div>
                <Label className="font-semibold text-foreground">Logo</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-4">
                  {formData.logo ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{formData.logo.split("/").pop()}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData({ ...formData, logo: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, "logo")}
                      />
                      <span className="text-sm text-muted-foreground">...</span>
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>Browse...</span>
                      </Button>
                    </label>
                  )}
                </div>
              </div>

              {/* Name and Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold text-foreground">Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="font-semibold text-foreground">Email ID</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Phone and Established Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold text-foreground">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="font-semibold text-foreground">Established Date</Label>
                  <Input
                    type="date"
                    value={formData.establishedDate}
                    onChange={(e) => setFormData({ ...formData, establishedDate: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* About Us */}
              <div>
                <Label className="font-semibold text-foreground">About Us</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-2"
                  rows={4}
                />
              </div>

              {/* Employee Count and Website */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold text-foreground">Employee Count</Label>
                  <Input
                    type="number"
                    value={formData.employeeCount}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeCount: parseInt(e.target.value) || 0 })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="font-semibold text-foreground">Website</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Head Office */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-foreground">Head Office</Label>
                  <Button type="button" size="sm" onClick={addBranch}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Branch
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold text-foreground">Location</Label>
                    <Input
                      value={formData.headOfficeLocation}
                      onChange={(e) =>
                        setFormData({ ...formData, headOfficeLocation: e.target.value })
                      }
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-foreground">Address</Label>
                    <Input
                      value={formData.headOfficeAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, headOfficeAddress: e.target.value })
                      }
                      className="mt-2"
                    />
                  </div>
                </div>

                {/* Branches */}
                {formData.branches.map((branch, index) => (
                  <div key={index} className="border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold text-foreground">Branch Details</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBranch(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="font-semibold text-foreground">Location</Label>
                        <Input
                          value={branch.location}
                          onChange={(e) => updateBranch(index, "location", e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold text-foreground">Address</Label>
                        <Input
                          value={branch.address}
                          onChange={(e) => updateBranch(index, "address", e.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Centers */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-foreground">Data Center</Label>
                  <Button type="button" size="sm" onClick={addDataCenter}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Data Center
                  </Button>
                </div>
                {formData.dataCenters.map((dc, index) => (
                  <div key={index} className="border-t pt-4 first:border-t-0 first:pt-0">
                    <div className="grid grid-cols-3 gap-4 items-end">
                      <div>
                        <Label className="font-semibold text-foreground">Location</Label>
                        <Select
                          value={dc.locationType}
                          onValueChange={(value) => updateDataCenter(index, "locationType", value)}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="On-Prem">On-Prem</SelectItem>
                            <SelectItem value="Outsourced">Outsourced</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="font-semibold text-foreground">
                          {dc.locationType === "Outsourced" ? "Vendor" : "Address"}
                        </Label>
                        <Input
                          value={dc.locationType === "Outsourced" ? dc.vendor || "" : dc.address || ""}
                          onChange={(e) =>
                            updateDataCenter(
                              index,
                              dc.locationType === "Outsourced" ? "vendor" : "address",
                              e.target.value
                            )
                          }
                          className="mt-2"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDataCenter(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cloud Providers */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-foreground">Cloud Provider</Label>
                  <Button type="button" size="sm" onClick={addCloudProvider}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Cloud Provider
                  </Button>
                </div>
                {formData.cloudProviders.map((cp, index) => (
                  <div key={index} className="border-t pt-4 first:border-t-0 first:pt-0">
                    <div className="grid grid-cols-3 gap-4 items-end">
                      <div>
                        <Label className="font-semibold text-foreground">Name</Label>
                        <Input
                          value={cp.name}
                          onChange={(e) => updateCloudProvider(index, "name", e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold text-foreground">Service type</Label>
                        <Select
                          value={cp.serviceType}
                          onValueChange={(value) => updateCloudProvider(index, "serviceType", value)}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Iaas">Iaas</SelectItem>
                            <SelectItem value="Paas">Paas</SelectItem>
                            <SelectItem value="Saas">Saas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCloudProvider(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Social Media */}
              <div className="border rounded-lg p-4 space-y-4">
                <Label className="font-semibold text-foreground">Social Media</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold text-foreground">Facebook</Label>
                    <Input
                      value={formData.facebook}
                      onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-foreground">Youtube</Label>
                    <Input
                      value={formData.youtube}
                      onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold text-foreground">Twitter</Label>
                    <Input
                      value={formData.twitter}
                      onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-foreground">LinkedIn</Label>
                    <Input
                      value={formData.linkedin}
                      onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* Brochure */}
              <div>
                <Label className="font-semibold text-foreground">Brochure</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-4">
                  {formData.brochure ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{formData.brochure.split("/").pop()}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData({ ...formData, brochure: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Click here, or drop files here to upload
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, "brochure")}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: VMW */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <Label className="font-semibold text-foreground">Vision</Label>
                <Textarea
                  value={formData.vision}
                  onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                  className="mt-2"
                  rows={5}
                />
              </div>
              <div>
                <Label className="font-semibold text-foreground">Mission</Label>
                <Textarea
                  value={formData.mission}
                  onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                  className="mt-2"
                  rows={5}
                />
              </div>
              <div>
                <Label className="font-semibold text-foreground">Value</Label>
                <Textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="mt-2"
                  rows={5}
                />
              </div>
            </div>
          )}

          {/* Step 3: CEO Message */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <Label className="font-semibold text-foreground">CEO Message</Label>
                <Textarea
                  value={formData.ceoMessage}
                  onChange={(e) => setFormData({ ...formData, ceoMessage: e.target.value })}
                  className="mt-2"
                  rows={10}
                />
              </div>
            </div>
          )}

          {/* Step 4: Preview & Save */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Mission & Vision */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="font-semibold text-foreground">Mission</Label>
                  <p className="mt-2 text-sm">{formData.mission || "-"}</p>
                </div>
                <div>
                  <Label className="font-semibold text-foreground">Vision</Label>
                  <p className="mt-2 text-sm">{formData.vision || "-"}</p>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label className="font-semibold text-foreground">Name</Label>
                  <p className="mt-2 text-sm">{formData.name || "-"}</p>
                </div>
                <div>
                  <Label className="font-semibold text-foreground">Email Id</Label>
                  <p className="mt-2 text-sm">{formData.email || "-"}</p>
                </div>
                <div>
                  <Label className="font-semibold text-foreground">Phone</Label>
                  <p className="mt-2 text-sm">{formData.phone || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label className="font-semibold text-foreground">Established Date</Label>
                  <p className="mt-2 text-sm">{formData.establishedDate || "-"}</p>
                </div>
                <div>
                  <Label className="font-semibold text-foreground">Website</Label>
                  <p className="mt-2 text-sm">{formData.website || "-"}</p>
                </div>
                <div>
                  <Label className="font-semibold text-foreground">Employee Count</Label>
                  <p className="mt-2 text-sm">{formData.employeeCount}</p>
                </div>
              </div>

              {/* Head Office */}
              <div className="border rounded-lg p-4">
                <Label className="font-semibold text-foreground">Head Office</Label>
                <div className="grid grid-cols-2 gap-6 mt-2">
                  <div>
                    <Label className="text-muted-foreground text-sm">Location</Label>
                    <p className="text-sm">{formData.headOfficeLocation || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Address</Label>
                    <p className="text-sm">{formData.headOfficeAddress || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Branch Offices */}
              {formData.branches.length > 0 && (
                <div className="border rounded-lg p-4">
                  <Label className="font-semibold text-foreground">Branch Office</Label>
                  {formData.branches.map((branch, index) => (
                    <div key={index} className="grid grid-cols-2 gap-6 mt-2 pt-2 border-t first:border-t-0">
                      <div>
                        <Label className="text-muted-foreground text-sm">Location</Label>
                        <p className="text-sm">{branch.location || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-sm">Address</Label>
                        <p className="text-sm">{branch.address || "-"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Data Centers */}
              {formData.dataCenters.length > 0 && (
                <div className="border rounded-lg p-4">
                  <Label className="font-semibold text-foreground">Data Centers</Label>
                  {formData.dataCenters.map((dc, index) => (
                    <div key={index} className="grid grid-cols-2 gap-6 mt-2 pt-2 border-t first:border-t-0">
                      <div>
                        <Label className="text-muted-foreground text-sm">Type</Label>
                        <p className="text-sm">{dc.locationType || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-sm">
                          {dc.locationType === "Outsourced" ? "Vendor" : "Address"}
                        </Label>
                        <p className="text-sm">
                          {dc.locationType === "Outsourced" ? dc.vendor || "-" : dc.address || "-"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cloud Providers */}
              {formData.cloudProviders.length > 0 && (
                <div className="border rounded-lg p-4">
                  <Label className="font-semibold text-foreground">Cloud Providers</Label>
                  {formData.cloudProviders.map((cp, index) => (
                    <div key={index} className="grid grid-cols-2 gap-6 mt-2 pt-2 border-t first:border-t-0">
                      <div>
                        <Label className="text-muted-foreground text-sm">Name</Label>
                        <p className="text-sm">{cp.name || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-sm">Service Type</Label>
                        <p className="text-sm">{cp.serviceType || "-"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CEO Message */}
              {formData.ceoMessage && (
                <div className="border rounded-lg p-4">
                  <Label className="font-semibold text-foreground">CEO Message</Label>
                  <p className="mt-2 text-sm">{formData.ceoMessage}</p>
                </div>
              )}

              {/* Value */}
              {formData.value && (
                <div className="border rounded-lg p-4">
                  <Label className="font-semibold text-foreground">Value</Label>
                  <p className="mt-2 text-sm">{formData.value}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {currentStep > 1 && (
            <Button variant="outline" onClick={handlePrevious}>
              Previous
            </Button>
          )}
          {currentStep < 4 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
