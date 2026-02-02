"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Image, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
  email: string;
  userName: string;
  compliancePercentage: number;
  blocked?: boolean;
  active?: boolean;
  language?: string;
  timeZone?: string;
  logoUrl?: string;
}

// Restricted to English and Arabic only per UAT
const LANGUAGES = [
  { value: "en-US", label: "English, United States" },
  { value: "ar-QA", label: "Arabic, Qatar" },
];

// Full IANA time zone list
const TIME_ZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Qatar", label: "Asia/Qatar" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
];

export default function CustomersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [formData, setFormData] = useState({
    customerName: "",
    email: "",
    userName: "",
    newPassword: "",
    confirmPassword: "",
    blocked: false,
    active: true,
    language: "en-US",
    timeZone: "Asia/Qatar",
    logoFile: null as File | null,
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/grc/customers");
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: "",
      email: "",
      userName: "",
      newPassword: "",
      confirmPassword: "",
      blocked: false,
      active: true,
      language: "en-US",
      timeZone: "Asia/Qatar",
      logoFile: null,
    });
  };

  const handleLogoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleLogoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        setFormData({ ...formData, logoFile: file });
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file (PNG, JPG, etc.)",
          variant: "destructive",
        });
      }
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setFormData({ ...formData, logoFile: file });
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file (PNG, JPG, etc.)",
          variant: "destructive",
        });
      }
    }
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, logoFile: null });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleEditCustomer = async () => {
    if (!selectedCustomer) return;

    if (!formData.customerName || !formData.email || !formData.userName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/grc/customer-accounts/${selectedCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.customerName,
          email: formData.email,
          userName: formData.userName,
          password: formData.newPassword || undefined,
          blocked: formData.blocked,
          active: formData.active,
          language: formData.language,
          timeZone: formData.timeZone,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Customer updated successfully",
        });
        setShowEditDialog(false);
        resetForm();
        setSelectedCustomer(null);
        fetchCustomers();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update customer",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update customer",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/grc/customer-accounts/${selectedCustomer.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Customer deleted successfully",
        });
        setShowDeleteDialog(false);
        setSelectedCustomer(null);
        fetchCustomers();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete customer",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      customerName: customer.customerName,
      email: customer.email,
      userName: customer.userName,
      newPassword: "",
      confirmPassword: "",
      blocked: customer.blocked || false,
      active: customer.active !== false,
      language: customer.language || "en-US",
      timeZone: customer.timeZone || "Asia/Qatar",
      logoFile: null,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDeleteDialog(true);
  };

  const openLogoDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowLogoDialog(true);
  };

  const handleRowDoubleClick = (customer: Customer) => {
    router.push(`/grc/customers/${customer.id}/frameworks`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">GRC Customer Account</h1>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="font-semibold text-slate-700">Customer Code</TableHead>
              <TableHead className="font-semibold text-slate-700">Customer Name</TableHead>
              <TableHead className="font-semibold text-slate-700">Email</TableHead>
              <TableHead className="font-semibold text-slate-700">UserName</TableHead>
              <TableHead className="font-semibold text-slate-700">Compliance Percentage</TableHead>
              <TableHead className="font-semibold text-slate-700">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onDoubleClick={() => handleRowDoubleClick(customer)}
                >
                  <TableCell className="font-medium">{customer.customerCode}</TableCell>
                  <TableCell>{customer.customerName}</TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.userName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${customer.compliancePercentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-600">{customer.compliancePercentage.toFixed(2)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(customer)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openLogoDialog(customer)}
                        title="View Logo"
                      >
                        <Image className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(customer)}
                        title="Delete"
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
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Edit Account</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              {/* Account Information Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Account Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Customer Code</Label>
                    <Input value={selectedCustomer?.customerCode || ""} disabled className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">User Role</Label>
                    <Input className="bg-slate-50" value="CustomerAdministrator" disabled />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editCustomerName" className="text-sm font-medium text-slate-700">Customer Name <span className="text-error">*</span></Label>
                  <Input
                    id="editCustomerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="Enter customer name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editUserName" className="text-sm font-medium text-slate-700">Username <span className="text-error">*</span></Label>
                  <Input
                    id="editUserName"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    placeholder="Enter username"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editEmail" className="text-sm font-medium text-slate-700">Email <span className="text-error">*</span></Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Upload Logo</Label>

                  {/* Drag and Drop Zone */}
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                      dragOver
                        ? "border-primary bg-primary/5"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                    onDragOver={handleLogoDragOver}
                    onDragLeave={handleLogoDragLeave}
                    onDrop={handleLogoDrop}
                  >
                    {!formData.logoFile ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                          <Upload className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-600">
                          Drag and Drop or{" "}
                          <label className="text-primary cursor-pointer hover:underline">
                            Click to upload
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoFileSelect}
                            />
                          </label>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Supported formats: PNG, JPG. Max Size: 5MB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* File Item */}
                        <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {formData.logoFile.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatFileSize(formData.logoFile.size)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            onClick={handleRemoveLogo}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Settings Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Settings</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Language</Label>
                    <Select value={formData.language || ""} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Time Zone</Label>
                    <Select value={formData.timeZone || ""} onValueChange={(v) => setFormData({ ...formData, timeZone: v })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {TIME_ZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Is Local User</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="isLocalUserCustomer" value="yes" defaultChecked className="accent-primary" /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="isLocalUserCustomer" value="no" className="accent-primary" /> No
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Blocked</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="blockedCustomer"
                          checked={!formData.blocked}
                          onChange={() => setFormData({ ...formData, blocked: false })}
                          className="accent-primary"
                        /> No
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="blockedCustomer"
                          checked={formData.blocked}
                          onChange={() => setFormData({ ...formData, blocked: true })}
                          className="accent-primary"
                        /> Yes
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Active</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="activeCustomer"
                          checked={formData.active}
                          onChange={() => setFormData({ ...formData, active: true })}
                          className="accent-primary"
                        /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="activeCustomer"
                          checked={!formData.active}
                          onChange={() => setFormData({ ...formData, active: false })}
                          className="accent-primary"
                        /> No
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <Button
                    variant="link"
                    className="text-primary p-0 h-auto text-sm"
                  >
                    Change password
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 flex justify-between">
            <Button
              variant="outline"
              size="sm"
            >
              Subscription Plan
            </Button>
            <div className="flex gap-2">
              <Button onClick={handleEditCustomer} disabled={submitting} size="sm">
                {submitting ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowEditDialog(false); resetForm(); setSelectedCustomer(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Confirmation</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-slate-600">Are you sure you want to delete this?</p>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
            <Button
              onClick={handleDeleteCustomer}
              disabled={submitting}
              size="sm"
            >
              {submitting ? "Deleting..." : "Yes"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowDeleteDialog(false); setSelectedCustomer(null); }}>
              No
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Logo Dialog */}
      <Dialog open={showLogoDialog} onOpenChange={setShowLogoDialog}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Customer Logo</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-5 flex justify-center">
            {selectedCustomer?.logoUrl ? (
              <img
                src={selectedCustomer.logoUrl}
                alt={`${selectedCustomer.customerName} logo`}
                className="max-w-full max-h-64 object-contain"
              />
            ) : (
              <div className="text-slate-400 text-center py-8">
                <Image className="h-16 w-16 mx-auto text-slate-300 mb-2" />
                <p>No logo uploaded</p>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => { setShowLogoDialog(false); setSelectedCustomer(null); }}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
