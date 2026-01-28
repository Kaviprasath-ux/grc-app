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
      <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-800">Edit Profile</DialogTitle>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-start justify-center pt-5">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start">
                <div className="flex flex-col items-center w-32">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                      currentStep > step.id
                        ? "bg-success text-white"
                        : currentStep === step.id
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 text-slate-400 border border-slate-200"
                    )}
                  >
                    {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium text-center",
                      currentStep >= step.id ? "text-slate-700" : "text-slate-400"
                    )}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-12 h-0.5 mt-[18px] -mx-5 transition-colors",
                      currentStep > step.id ? "bg-success" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Step 1: Info */}
          {currentStep === 1 && (
            <div className="space-y-5">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="h-5 w-5 text-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Logo</p>
                  <p className="text-xs text-slate-400 mb-2">PNG or JPG, max 2MB</p>
                  <div className="flex gap-2">
                    <label>
                      <Input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "logo")} />
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" asChild>
                        <span>Upload</span>
                      </Button>
                    </label>
                    {formData.logo && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-semantic-error" onClick={() => setFormData({ ...formData, logo: "" })}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Organization Name */}
              <div>
                <Label className="text-sm font-medium text-slate-700">Organization Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1.5"
                  placeholder="Enter organization name"
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1.5"
                    placeholder="contact@company.com"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1.5"
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>

              {/* Website & Established */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Website</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="mt-1.5"
                    placeholder="https://company.com"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Established</Label>
                  <Input
                    type="date"
                    value={formData.establishedDate}
                    onChange={(e) => setFormData({ ...formData, establishedDate: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Employee Count */}
              <div>
                <Label className="text-sm font-medium text-slate-700">Employee Count</Label>
                <Input
                  type="number"
                  value={formData.employeeCount}
                  onChange={(e) => setFormData({ ...formData, employeeCount: parseInt(e.target.value) || 0 })}
                  className="mt-1.5 w-40"
                  placeholder="0"
                />
              </div>

              {/* About */}
              <div>
                <Label className="text-sm font-medium text-slate-700">About</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1.5"
                  rows={3}
                  placeholder="Brief description of your organization..."
                />
              </div>

              {/* Head Office */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-slate-700">Head Office</Label>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-primary-600" onClick={addBranch}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Branch
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={formData.headOfficeLocation}
                    onChange={(e) => setFormData({ ...formData, headOfficeLocation: e.target.value })}
                    placeholder="City, Country"
                  />
                  <Input
                    value={formData.headOfficeAddress}
                    onChange={(e) => setFormData({ ...formData, headOfficeAddress: e.target.value })}
                    placeholder="Full address"
                  />
                </div>
              </div>

              {/* Branches */}
              {formData.branches.map((branch, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium text-slate-500">Branch {index + 1}</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-semantic-error" onClick={() => removeBranch(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={branch.location} onChange={(e) => updateBranch(index, "location", e.target.value)} placeholder="City, Country" />
                    <Input value={branch.address} onChange={(e) => updateBranch(index, "address", e.target.value)} placeholder="Full address" />
                  </div>
                </div>
              ))}

              {/* Data Centers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-slate-700">Data Centers</Label>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-primary-600" onClick={addDataCenter}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                {formData.dataCenters.length === 0 ? (
                  <p className="text-xs text-slate-400">No data centers added</p>
                ) : (
                  <div className="space-y-2">
                    {formData.dataCenters.map((dc, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Select value={dc.locationType} onValueChange={(value) => updateDataCenter(index, "locationType", value)}>
                          <SelectTrigger className="w-28 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="On-Prem">On-Prem</SelectItem>
                            <SelectItem value="Outsourced">Outsourced</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={dc.locationType === "Outsourced" ? dc.vendor || "" : dc.address || ""}
                          onChange={(e) => updateDataCenter(index, dc.locationType === "Outsourced" ? "vendor" : "address", e.target.value)}
                          placeholder={dc.locationType === "Outsourced" ? "Vendor" : "Address"}
                          className="flex-1 h-9"
                        />
                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-slate-400 hover:text-semantic-error" onClick={() => removeDataCenter(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cloud Providers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-slate-700">Cloud Providers</Label>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-primary-600" onClick={addCloudProvider}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                {formData.cloudProviders.length === 0 ? (
                  <p className="text-xs text-slate-400">No cloud providers added</p>
                ) : (
                  <div className="space-y-2">
                    {formData.cloudProviders.map((cp, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input value={cp.name} onChange={(e) => updateCloudProvider(index, "name", e.target.value)} placeholder="Provider name" className="flex-1 h-9" />
                        <Select value={cp.serviceType} onValueChange={(value) => updateCloudProvider(index, "serviceType", value)}>
                          <SelectTrigger className="w-24 h-9">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Iaas">IaaS</SelectItem>
                            <SelectItem value="Paas">PaaS</SelectItem>
                            <SelectItem value="Saas">SaaS</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-slate-400 hover:text-semantic-error" onClick={() => removeCloudProvider(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Social Media */}
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-3 block">Social Media</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input value={formData.facebook} onChange={(e) => setFormData({ ...formData, facebook: e.target.value })} placeholder="Facebook URL" />
                  <Input value={formData.linkedin} onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })} placeholder="LinkedIn URL" />
                  <Input value={formData.twitter} onChange={(e) => setFormData({ ...formData, twitter: e.target.value })} placeholder="Twitter URL" />
                  <Input value={formData.youtube} onChange={(e) => setFormData({ ...formData, youtube: e.target.value })} placeholder="YouTube URL" />
                </div>
              </div>

              {/* Brochure */}
              <div>
                <Label className="text-sm font-medium text-slate-700">Brochure</Label>
                <div className="mt-1.5 border border-dashed border-slate-200 rounded-lg p-4">
                  {formData.brochure ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{formData.brochure.split("/").pop()}</span>
                      <Button type="button" variant="ghost" size="sm" className="text-slate-400 hover:text-semantic-error" onClick={() => setFormData({ ...formData, brochure: "" })}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer py-2">
                      <Upload className="h-6 w-6 text-slate-300 mb-2" />
                      <span className="text-sm text-slate-500">Click to upload</span>
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, "brochure")} />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: VMW */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-slate-700">Vision</Label>
                <Textarea
                  value={formData.vision}
                  onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                  className="mt-1.5"
                  rows={5}
                  placeholder="Where do you see your organization in the future?"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Mission</Label>
                <Textarea
                  value={formData.mission}
                  onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                  className="mt-1.5"
                  rows={5}
                  placeholder="What is your organization's purpose?"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Core Values</Label>
                <Textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="mt-1.5"
                  rows={5}
                  placeholder="What principles guide your organization?"
                />
              </div>
            </div>
          )}

          {/* Step 3: CEO Message */}
          {currentStep === 3 && (
            <div>
              <Label className="text-sm font-medium text-slate-700">CEO Message</Label>
              <Textarea
                value={formData.ceoMessage}
                onChange={(e) => setFormData({ ...formData, ceoMessage: e.target.value })}
                className="mt-1.5"
                rows={14}
                placeholder="Share a message from your CEO..."
              />
            </div>
          )}

          {/* Step 4: Preview & Save */}
          {currentStep === 4 && (
            <div className="space-y-4">
              {/* Organization Info */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Organization</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Name</span>
                    <span className="text-sm font-medium text-slate-800">{formData.name || "-"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Email</span>
                    <span className="text-sm text-slate-700">{formData.email || "-"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Phone</span>
                    <span className="text-sm text-slate-700">{formData.phone || "-"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Website</span>
                    <span className="text-sm text-primary-600">{formData.website || "-"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Established</span>
                    <span className="text-sm text-slate-700">{formData.establishedDate || "-"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Employees</span>
                    <span className="text-sm text-slate-700">{formData.employeeCount || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Locations */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Locations</p>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-500">Head Office</span>
                  <span className="text-sm text-slate-700">{formData.headOfficeLocation || "-"}</span>
                </div>
                {formData.branches.map((branch, index) => (
                  <div key={index} className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Branch {index + 1}</span>
                    <span className="text-sm text-slate-700">{branch.location || "-"}</span>
                  </div>
                ))}
              </div>

              {/* Infrastructure */}
              {(formData.dataCenters.length > 0 || formData.cloudProviders.length > 0) && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Infrastructure</p>
                  {formData.dataCenters.map((dc, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-500">Data Center</span>
                      <span className="text-sm text-slate-700">{dc.locationType}</span>
                    </div>
                  ))}
                  {formData.cloudProviders.map((cp, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-500">Cloud</span>
                      <span className="text-sm text-slate-700">{cp.name} ({cp.serviceType})</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Vision, Mission, Values */}
              {(formData.vision || formData.mission || formData.value) && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vision, Mission & Values</p>
                  {formData.vision && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Vision</p>
                      <p className="text-sm text-slate-700">{formData.vision}</p>
                    </div>
                  )}
                  {formData.mission && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Mission</p>
                      <p className="text-sm text-slate-700">{formData.mission}</p>
                    </div>
                  )}
                  {formData.value && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Values</p>
                      <p className="text-sm text-slate-700">{formData.value}</p>
                    </div>
                  )}
                </div>
              )}

              {/* CEO Message */}
              {formData.ceoMessage && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">CEO Message</p>
                  <p className="text-sm text-slate-700">{formData.ceoMessage}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
