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
import { Pencil, Image, Trash2, Upload, Home, ChevronRight, Users, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHasRole } from "@/hooks/usePermissions";
import { validateEmail } from "@/lib/validations/email";

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
  const { t } = useLanguage();
  const isGRCAdmin = useHasRole("GRCAdministrator");
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
          title: t("Invalid file type"),
          description: t("Please upload an image file (PNG, JPG, etc.)"),
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
          title: t("Invalid file type"),
          description: t("Please upload an image file (PNG, JPG, etc.)"),
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

    if (!formData.customerName || !formData.userName) {
      toast({
        title: t("Validation Error"),
        description: t("Please fill in all required fields"),
        variant: "destructive",
      });
      return;
    }
    const emailError = validateEmail(formData.email);
    if (emailError) {
      toast({
        title: t("Validation Error"),
        description: t(emailError),
        variant: "destructive",
      });
      return;
    }
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast({
        title: t("Validation Error"),
        description: t("Passwords do not match"),
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
          title: t("Success"),
          description: t("Customer updated successfully"),
        });
        setShowEditDialog(false);
        resetForm();
        setSelectedCustomer(null);
        fetchCustomers();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to update customer"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to update customer"),
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
          title: t("Success"),
          description: t("Customer deleted successfully"),
        });
        setShowDeleteDialog(false);
        setSelectedCustomer(null);
        fetchCustomers();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to delete customer"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to delete customer"),
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
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Customers")}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("GRC Customer Account")}</h1>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-400">{t("Loading...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Customers")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("GRC Customer Account")}</h1>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Customer Code")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Customer Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Email")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("UserName")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Compliance Percentage")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-0">
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                      <Users className="h-6 w-6 text-primary-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      {t("No Customers Found")}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t("Add a new customer to get started.")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="border-b border-slate-100 last:border-0 cursor-pointer"
                  onDoubleClick={() => handleRowDoubleClick(customer)}
                >
                  <TableCell className="py-3 pl-5 text-sm font-medium text-slate-900">{customer.customerCode}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{customer.customerName}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{customer.email}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{customer.userName}</TableCell>
                  <TableCell className="py-3">
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
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-primary-600"
                        onClick={() => handleRowDoubleClick(customer)}
                        title={t("View")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!isGRCAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            onClick={() => openEditDialog(customer)}
                            title={t("Edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            onClick={() => openLogoDialog(customer)}
                            title={t("View Logo")}
                          >
                            <Image className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                            onClick={() => openDeleteDialog(customer)}
                            title={t("Delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
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
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Account")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="space-y-5">
              {/* Account Information Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Account Information")}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Customer Code")}</Label>
                    <Input value={selectedCustomer?.customerCode || ""} disabled className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("User Role")}</Label>
                    <Input className="bg-slate-50" value="CustomerAdministrator" disabled />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editCustomerName" className="text-sm font-medium text-slate-700">{t("Customer Name")} <span className="text-error">*</span></Label>
                  <Input
                    id="editCustomerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder={t("Enter customer name")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editUserName" className="text-sm font-medium text-slate-700">{t("Username")} <span className="text-error">*</span></Label>
                  <Input
                    id="editUserName"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    placeholder={t("Enter username")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editEmail" className="text-sm font-medium text-slate-700">{t("Email")} <span className="text-error">*</span></Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t("Enter email address")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Upload Logo")}</Label>

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
                          {t("Drag and Drop or")}{" "}
                          <label className="text-primary cursor-pointer hover:underline">
                            {t("Click to upload")}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoFileSelect}
                            />
                          </label>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {t("Supported formats: PNG, JPG. Max Size: 5MB")}
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
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Settings")}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Language")}</Label>
                    <Select value={formData.language || ""} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Time Zone")}</Label>
                    <Select value={formData.timeZone || ""} onValueChange={(v) => setFormData({ ...formData, timeZone: v })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {TIME_ZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Is Local User")}</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="isLocalUserCustomer" value="yes" defaultChecked className="accent-primary" /> {t("Yes")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="isLocalUserCustomer" value="no" className="accent-primary" /> {t("No")}
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Blocked")}</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="blockedCustomer"
                          checked={!formData.blocked}
                          onChange={() => setFormData({ ...formData, blocked: false })}
                          className="accent-primary"
                        /> {t("No")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="blockedCustomer"
                          checked={formData.blocked}
                          onChange={() => setFormData({ ...formData, blocked: true })}
                          className="accent-primary"
                        /> {t("Yes")}
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Active")}</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="activeCustomer"
                          checked={formData.active}
                          onChange={() => setFormData({ ...formData, active: true })}
                          className="accent-primary"
                        /> {t("Yes")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="activeCustomer"
                          checked={!formData.active}
                          onChange={() => setFormData({ ...formData, active: false })}
                          className="accent-primary"
                        /> {t("No")}
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <Button
                    variant="link"
                    className="text-primary p-0 h-auto text-sm"
                  >
                    {t("Change password")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex flex-col sm:flex-row justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              {t("Subscription Plan")}
            </Button>
            <div className="flex gap-2">
              <Button onClick={handleEditCustomer} disabled={submitting} size="sm" className="flex-1 sm:flex-none">
                {submitting ? t("Saving...") : t("Save")}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => { setShowEditDialog(false); resetForm(); setSelectedCustomer(null); }}>
                {t("Cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirmation")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-slate-600">{t("Are you sure you want to delete this?")}</p>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex gap-2">
            <Button
              onClick={handleDeleteCustomer}
              disabled={submitting}
              size="sm"
            >
              {submitting ? t("Deleting...") : t("Yes")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowDeleteDialog(false); setSelectedCustomer(null); }}>
              {t("No")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Logo Dialog */}
      <Dialog open={showLogoDialog} onOpenChange={setShowLogoDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Customer Logo")}</DialogTitle>
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
                <p>{t("No logo uploaded")}</p>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => { setShowLogoDialog(false); setSelectedCustomer(null); }}>
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
