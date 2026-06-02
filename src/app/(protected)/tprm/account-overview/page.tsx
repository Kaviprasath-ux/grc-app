"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataGrid } from "@/components/shared/data-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Loader2, Pencil, Trash2, Home, ChevronRight, Plus, Search, Users } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";

// Restricted to English and Arabic only per UAT
const LANGUAGES = [
  { value: "en-US", label: "English, United States" },
  { value: "ar-QA", label: "Arabic, Qatar" },
];

// Common time zones
const TIME_ZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Qatar", label: "Asia/Qatar" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh" },
  { value: "Asia/Kuwait", label: "Asia/Kuwait" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
];

// ==================== Types ====================

interface CustomerAccount {
  id: string;
  userId: string | null;
  companyName: string;
  fullName: string;
  email: string;
  active: string;
  assessmentCount: number;
  onboardedVendor: number;
  isGrcAdded: boolean;
  isTprmAdded: boolean;
}

interface VendorItem {
  id: string;
  label: string;
  name: string;
  vendorCode: string;
  customerAccountName: string;
}

interface VendorUser {
  id: string;
  companyName: string;
  fullName: string;
  username: string;
  email: string;
  createdDate: string;
  lastLogin: string | null;
  active: string;
}

interface FactoryAccount {
  id: string;
  userId: string | null;
  companyName: string;
  fullName: string;
  email: string;
  active: string;
  assessmentCount: number;
}

interface SuperAdmin {
  id: string;
  fullName: string;
  username: string;
  email: string;
  companyName: string;
  phoneNumber: string;
  lastLogin: string | null;
  active: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString();
}

// ==================== Create Account Dialog ====================
// Creates a new CustomerAccount + User with the appropriate TPRM role

interface SubscriptionPlanItem {
  id: string;
  startDate: string;
  expiryDate: string;
  maxFrameworks: number;
  maxAccounts: number;
  assessmentLimit: number;
  vendorLimit: number;
  status: string;
}

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: "customers" | "factory" | "superadmin";
  title: string;
  showIsGrcAdded: boolean;
  onSuccess: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  customers: "CustomerAdministrator",
  factory: "FactoryAdmin",
  superadmin: "TPRMAdmin",
};

function CreateAccountDialog({ open, onOpenChange, tab, title, showIsGrcAdded, onSuccess }: CreateAccountDialogProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    customerName: "",
    fullName: "",
    userName: "",
    email: "",
    password: "",
    confirmPassword: "",
    isGrcAdded: false,
    language: "en-US",
    timeZone: "Asia/Qatar",
    blocked: false,
    active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Subscription plan state
  const [pendingPlans, setPendingPlans] = useState<SubscriptionPlanItem[]>([]);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subData, setSubData] = useState({
    startDate: "",
    expiryDate: "",
    maxFrameworks: 0,
    maxAccounts: 0,
    assessmentLimit: 0,
    vendorLimit: 0,
    status: "Active",
  });
  const [subErrors, setSubErrors] = useState<Record<string, string>>({});

  // Whether subscription plans are supported for this tab
  const hasSubscription = tab === "customers" || tab === "factory";

  const resetForm = () => {
    setFormData({
      customerName: "",
      fullName: "",
      userName: "",
      email: "",
      password: "",
      confirmPassword: "",
      isGrcAdded: false,
      language: "en-US",
      timeZone: "Asia/Qatar",
      blocked: false,
      active: true,
    });
    setFormErrors({});
    setError("");
    setPendingPlans([]);
  };

  const resetSubData = () => {
    setSubData({
      startDate: "",
      expiryDate: "",
      maxFrameworks: 0,
      maxAccounts: 0,
      assessmentLimit: 0,
      vendorLimit: 0,
      status: "Active",
    });
    setSubErrors({});
  };

  const handleAddSubscription = () => {
    const errors: Record<string, string> = {};
    if (!subData.startDate) errors.startDate = t("Please enter the subscription start date.");
    if (!subData.expiryDate) {
      errors.expiryDate = t("Expiry date is required and should be greater than the start date!");
    } else if (subData.startDate && subData.expiryDate <= subData.startDate) {
      errors.expiryDate = t("Expiry date is required and should be greater than the start date!");
    }
    // maxFrameworks only when isGrcAdded
    if (formData.isGrcAdded) {
      if (!subData.maxFrameworks || subData.maxFrameworks <= 0) {
        errors.maxFrameworks = t("Please enter the maximum allowed frameworks.");
      }
    }
    if (!subData.maxAccounts || subData.maxAccounts <= 0) {
      errors.maxAccounts = t("Please enter the maximum allowed accounts.");
    }
    // Assessment limit always required for TPRM
    if (!subData.assessmentLimit || subData.assessmentLimit <= 0) {
      errors.assessmentLimit = t("Please enter the assessment limit.");
    }
    // Vendor limit only for customers tab (not factory)
    if (tab === "customers") {
      if (!subData.vendorLimit || subData.vendorLimit <= 0) {
        errors.vendorLimit = t("Please enter the vendor limit.");
      }
    }
    if (!subData.status) errors.status = t("Status is required!");

    if (Object.keys(errors).length > 0) {
      setSubErrors(errors);
      return;
    }

    setPendingPlans([...pendingPlans, {
      id: `pending-${Date.now()}`,
      ...subData,
    }]);
    setShowSubDialog(false);
    resetSubData();
  };

  const handleDeletePlan = (planId: string) => {
    setPendingPlans(pendingPlans.filter(p => p.id !== planId));
  };

  const handleSubmit = async () => {
    setError("");
    const errors: Record<string, string> = {};

    if (!formData.customerName.trim()) errors.customerName = t("Customer name is required");
    if (!formData.fullName.trim()) errors.fullName = t("Full name is required");
    if (!formData.userName.trim()) errors.userName = t("Username is required");
    if (!formData.email.trim()) errors.email = t("Email is required");
    if (!formData.password) errors.password = t("Password is required");
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = t("Passwords do not match");
    }
    if (!formData.confirmPassword) errors.confirmPassword = t("Confirm password is required");

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/tprm/account-overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab,
          customerName: formData.customerName,
          fullName: formData.fullName,
          userName: formData.userName,
          email: formData.email,
          password: formData.password,
          isGrcAdded: showIsGrcAdded ? formData.isGrcAdded : undefined,
          language: formData.language,
          timeZone: formData.timeZone,
          blocked: formData.blocked,
          active: formData.active,
          subscriptionPlans: pendingPlans.map(p => ({
            startDate: p.startDate,
            expiryDate: p.expiryDate,
            maxFrameworks: p.maxFrameworks,
            maxAccounts: p.maxAccounts,
            assessmentLimit: p.assessmentLimit,
            vendorLimit: p.vendorLimit,
            status: p.status,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("Failed to create account"));
        return;
      }

      // Trigger dynamic translation for customer account name
      if (json.customerAccount?.id) {
        triggerTranslation('CustomerAccount', json.customerAccount.id, { name: formData.customerName });
      }
      if (json.user?.id) {
        triggerTranslation('User', json.user.id, { fullName: formData.fullName, firstName: formData.fullName.split(' ')[0], lastName: formData.fullName.split(' ').slice(1).join(' ') });
      }

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch {
      setError(t("Failed to create account"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{title}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              {/* Account Information Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Account Information")}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("User Role")}</Label>
                    <Input className="bg-slate-50" value={t(ROLE_LABELS[tab] || "")} disabled />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Customer Name")} <span className="text-error">*</span></Label>
                  <Input
                    value={formData.customerName}
                    onChange={(e) => { setFormData({ ...formData, customerName: e.target.value }); setFormErrors(prev => { const { customerName, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter customer name")}
                    className={formErrors.customerName ? "border-red-400" : ""}
                  />
                  {formErrors.customerName && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.customerName}</div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Full Name")} <span className="text-error">*</span></Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => { setFormData({ ...formData, fullName: e.target.value }); setFormErrors(prev => { const { fullName, ...rest } = prev; return rest; }); }}
                    placeholder={t("Admin user full name")}
                    className={formErrors.fullName ? "border-red-400" : ""}
                  />
                  {formErrors.fullName && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.fullName}</div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Username")} <span className="text-error">*</span></Label>
                  <Input
                    autoComplete="off"
                    value={formData.userName}
                    onChange={(e) => { setFormData({ ...formData, userName: e.target.value }); setFormErrors(prev => { const { userName, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter username")}
                    className={formErrors.userName ? "border-red-400" : ""}
                  />
                  {formErrors.userName && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.userName}</div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Email")} <span className="text-error">*</span></Label>
                  <Input
                    type="email"
                    autoComplete="off"
                    value={formData.email}
                    onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFormErrors(prev => { const { email, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter email address")}
                    className={formErrors.email ? "border-red-400" : ""}
                  />
                  {formErrors.email && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.email}</div>
                  )}
                </div>
              </div>

              {/* Settings Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Settings")}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Language")}</Label>
                    <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
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
                    <Select value={formData.timeZone} onValueChange={(v) => setFormData({ ...formData, timeZone: v })}>
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

                <div className={`grid grid-cols-1 ${showIsGrcAdded ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4`}>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Blocked")}</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`blocked-${tab}`} checked={!formData.blocked} onChange={() => setFormData({ ...formData, blocked: false })} className="accent-primary" /> {t("No")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`blocked-${tab}`} checked={formData.blocked} onChange={() => setFormData({ ...formData, blocked: true })} className="accent-primary" /> {t("Yes")}
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Active")}</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`active-${tab}`} checked={formData.active} onChange={() => setFormData({ ...formData, active: true })} className="accent-primary" /> {t("Yes")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`active-${tab}`} checked={!formData.active} onChange={() => setFormData({ ...formData, active: false })} className="accent-primary" /> {t("No")}
                      </label>
                    </div>
                  </div>
                  {showIsGrcAdded && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">{t("Is GRC Added")}</Label>
                      <div className="flex gap-4 h-9 items-center">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`isGrcAdded-${tab}`} checked={!formData.isGrcAdded} onChange={() => setFormData({ ...formData, isGrcAdded: false })} className="accent-primary" /> {t("No")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`isGrcAdded-${tab}`} checked={formData.isGrcAdded} onChange={() => setFormData({ ...formData, isGrcAdded: true })} className="accent-primary" /> {t("Yes")}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Password")}</h3>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("New Password")} <span className="text-error">*</span></Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setFormErrors(prev => { const { password, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter password")}
                    className={formErrors.password ? "border-red-400" : ""}
                  />
                  {formErrors.password && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.password}</div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Confirm Password")} <span className="text-error">*</span></Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); setFormErrors(prev => { const { confirmPassword, ...rest } = prev; return rest; }); }}
                    placeholder={t("Confirm password")}
                    className={formErrors.confirmPassword ? "border-red-400" : ""}
                  />
                  {formErrors.confirmPassword && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.confirmPassword}</div>
                  )}
                </div>
              </div>

              {/* Subscription Plans Section (only for customers and factory tabs) */}
              {hasSubscription && pendingPlans.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Subscription Plans")}</h3>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
                    <Table className="min-w-[500px]">
                      <TableHeader>
                        <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Accounts Available")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assessment Limit")}</TableHead>
                          {tab === "customers" && (
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Vendor Limit")}</TableHead>
                          )}
                          {formData.isGrcAdded && (
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Frameworks Available")}</TableHead>
                          )}
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Expiry date")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5">{t("Action")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPlans.map((plan) => (
                          <TableRow key={plan.id} className="border-b border-slate-100 last:border-0">
                            <TableCell className="py-3 ltr:pl-5 rtl:pr-5 text-sm text-slate-700">{plan.maxAccounts}</TableCell>
                            <TableCell className="py-3 text-sm text-slate-700">{plan.assessmentLimit}</TableCell>
                            {tab === "customers" && (
                              <TableCell className="py-3 text-sm text-slate-700">{plan.vendorLimit}</TableCell>
                            )}
                            {formData.isGrcAdded && (
                              <TableCell className="py-3 text-sm text-slate-700">{plan.maxFrameworks}</TableCell>
                            )}
                            <TableCell className="py-3 text-sm text-slate-700">{plan.expiryDate}</TableCell>
                            <TableCell className="py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                plan.status === "Active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"
                              }`}>
                                {t(plan.status)}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => handleDeletePlan(plan.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex flex-col sm:flex-row sm:rtl:flex-row-reverse justify-between gap-2">
            {hasSubscription ? (
              <Button variant="outline" size="sm" className="w-full sm:w-auto order-last sm:order-first" onClick={() => setShowSubDialog(true)}>
                {t("Subscription Plan")} {pendingPlans.length > 0 && `(${pendingPlans.length})`}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2 rtl:flex-row-reverse">
              <Button onClick={handleSubmit} disabled={saving} size="sm" className="flex-1 sm:flex-none">
                {saving ? t("Saving...") : t("Save")}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => { resetForm(); onOpenChange(false); }}>
                {t("Cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Subscription Plan Dialog */}
      <Dialog open={showSubDialog} onOpenChange={(v) => { setShowSubDialog(v); if (!v) setSubErrors({}); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Subscription")}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Start date")}</Label>
              <div className="col-span-3 space-y-1.5">
                <Input type="date" value={subData.startDate} onChange={(e) => { setSubData({ ...subData, startDate: e.target.value }); setSubErrors(prev => { const { startDate, ...rest } = prev; return rest; }); }} className={subErrors.startDate ? "border-red-400" : ""} />
                {subErrors.startDate && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.startDate}</div>}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Expiry date")}</Label>
              <div className="col-span-3 space-y-1.5">
                <Input type="date" value={subData.expiryDate} onChange={(e) => { setSubData({ ...subData, expiryDate: e.target.value }); setSubErrors(prev => { const { expiryDate, ...rest } = prev; return rest; }); }} className={subErrors.expiryDate ? "border-red-400" : ""} />
                {subErrors.expiryDate && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.expiryDate}</div>}
              </div>
            </div>
            {formData.isGrcAdded && (
              <div className="grid grid-cols-4 gap-4">
                <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Max frameworks")}</Label>
                <div className="col-span-3 space-y-1.5">
                  <Input type="number" min="0" value={subData.maxFrameworks} onChange={(e) => { setSubData({ ...subData, maxFrameworks: parseInt(e.target.value) || 0 }); setSubErrors(prev => { const { maxFrameworks, ...rest } = prev; return rest; }); }} className={subErrors.maxFrameworks ? "border-red-400" : ""} />
                  {subErrors.maxFrameworks && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.maxFrameworks}</div>}
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Max accounts")}</Label>
              <div className="col-span-3 space-y-1.5">
                <Input type="number" min="0" value={subData.maxAccounts} onChange={(e) => { setSubData({ ...subData, maxAccounts: parseInt(e.target.value) || 0 }); setSubErrors(prev => { const { maxAccounts, ...rest } = prev; return rest; }); }} className={subErrors.maxAccounts ? "border-red-400" : ""} />
                {subErrors.maxAccounts && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.maxAccounts}</div>}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Assessment limit")}</Label>
              <div className="col-span-3 space-y-1.5">
                <Input type="number" min="0" value={subData.assessmentLimit} onChange={(e) => { setSubData({ ...subData, assessmentLimit: parseInt(e.target.value) || 0 }); setSubErrors(prev => { const { assessmentLimit, ...rest } = prev; return rest; }); }} className={subErrors.assessmentLimit ? "border-red-400" : ""} />
                {subErrors.assessmentLimit && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.assessmentLimit}</div>}
              </div>
            </div>
            {tab === "customers" && (
              <div className="grid grid-cols-4 gap-4">
                <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Vendor limit")}</Label>
                <div className="col-span-3 space-y-1.5">
                  <Input type="number" min="0" value={subData.vendorLimit} onChange={(e) => { setSubData({ ...subData, vendorLimit: parseInt(e.target.value) || 0 }); setSubErrors(prev => { const { vendorLimit, ...rest } = prev; return rest; }); }} className={subErrors.vendorLimit ? "border-red-400" : ""} />
                  {subErrors.vendorLimit && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.vendorLimit}</div>}
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Status")}</Label>
              <div className="col-span-3 space-y-1.5">
                <div className="flex gap-4 h-9 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="tprmSubStatus" checked={subData.status === "Active"} onChange={() => { setSubData({ ...subData, status: "Active" }); setSubErrors(prev => { const { status, ...rest } = prev; return rest; }); }} className="accent-primary" /> {t("Active")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="tprmSubStatus" checked={subData.status === "Inactive"} onChange={() => { setSubData({ ...subData, status: "Inactive" }); setSubErrors(prev => { const { status, ...rest } = prev; return rest; }); }} className="accent-primary" /> {t("Inactive")}
                  </label>
                </div>
                {subErrors.status && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.status}</div>}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex gap-2 ltr:justify-end rtl:justify-start">
            <Button onClick={handleAddSubscription} size="sm">{t("Save")}</Button>
            <Button variant="outline" size="sm" onClick={() => { setShowSubDialog(false); resetSubData(); }}>{t("Cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== Edit Account Dialog ====================
// Matches the CreateAccountDialog layout: Account Info, Settings, Password, Subscription Plans

interface EditAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  tab: "customers" | "factory" | "superadmin" | "vendor-users";
  showIsGrcAdded: boolean;
  onSuccess: () => void;
}

function EditAccountDialog({ open, onOpenChange, userId, tab, showIsGrcAdded, onSuccess }: EditAccountDialogProps) {
  const { t } = useLanguage();
  const [loadingData, setLoadingData] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    fullName: "",
    userName: "",
    email: "",
    password: "",
    confirmPassword: "",
    isGrcAdded: false,
    language: "en-US",
    timeZone: "Asia/Qatar",
    blocked: false,
    active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Subscription plan state
  const [existingPlans, setExistingPlans] = useState<SubscriptionPlanItem[]>([]);
  const [pendingPlans, setPendingPlans] = useState<SubscriptionPlanItem[]>([]);
  const [deletedPlanIds, setDeletedPlanIds] = useState<string[]>([]);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subData, setSubData] = useState({
    startDate: "",
    expiryDate: "",
    maxFrameworks: 0,
    maxAccounts: 0,
    assessmentLimit: 0,
    vendorLimit: 0,
    status: "Active",
  });
  const [subErrors, setSubErrors] = useState<Record<string, string>>({});

  const hasSubscription = tab === "customers" || tab === "factory";

  // Fetch full user details when dialog opens
  useEffect(() => {
    if (!open || !userId) return;
    setLoadingData(true);
    setError("");
    setFormErrors({});
    setPendingPlans([]);
    setDeletedPlanIds([]);
    fetch(`/api/tprm/account-overview?tab=user-detail&userId=${userId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
          return;
        }
        const u = json.user;
        setFormData({
          customerName: json.customerAccount?.name || "",
          fullName: u.fullName || "",
          userName: u.userName || "",
          email: u.email || "",
          password: "",
          confirmPassword: "",
          isGrcAdded: json.customerAccount?.isGrcAdded || false,
          language: u.language || "en-US",
          timeZone: u.timeZone || "Asia/Qatar",
          blocked: u.blocked || false,
          active: u.active !== false,
        });
        setExistingPlans(
          (json.subscriptionPlans || []).map((p: SubscriptionPlanItem & { startDate: string; expiryDate: string }) => ({
            ...p,
            startDate: p.startDate ? new Date(p.startDate).toISOString().split("T")[0] : "",
            expiryDate: p.expiryDate ? new Date(p.expiryDate).toISOString().split("T")[0] : "",
          }))
        );
      })
      .catch(() => setError(t("Failed to load user details")))
      .finally(() => setLoadingData(false));
  }, [open, userId, t]);

  const resetSubData = () => {
    setSubData({ startDate: "", expiryDate: "", maxFrameworks: 0, maxAccounts: 0, assessmentLimit: 0, vendorLimit: 0, status: "Active" });
    setSubErrors({});
  };

  const handleAddSubscription = () => {
    const errors: Record<string, string> = {};
    if (!subData.startDate) errors.startDate = t("Please enter the subscription start date.");
    if (!subData.expiryDate) {
      errors.expiryDate = t("Expiry date is required and should be greater than the start date!");
    } else if (subData.startDate && subData.expiryDate <= subData.startDate) {
      errors.expiryDate = t("Expiry date is required and should be greater than the start date!");
    }
    if (formData.isGrcAdded) {
      if (!subData.maxFrameworks || subData.maxFrameworks <= 0) errors.maxFrameworks = t("Please enter the maximum allowed frameworks.");
    }
    if (!subData.maxAccounts || subData.maxAccounts <= 0) errors.maxAccounts = t("Please enter the maximum allowed accounts.");
    if (!subData.assessmentLimit || subData.assessmentLimit <= 0) errors.assessmentLimit = t("Please enter the assessment limit.");
    if (tab === "customers") {
      if (!subData.vendorLimit || subData.vendorLimit <= 0) errors.vendorLimit = t("Please enter the vendor limit.");
    }
    if (!subData.status) errors.status = t("Status is required!");
    if (Object.keys(errors).length > 0) { setSubErrors(errors); return; }
    setPendingPlans([...pendingPlans, { id: `pending-${Date.now()}`, ...subData }]);
    setShowSubDialog(false);
    resetSubData();
  };

  const handleDeleteExistingPlan = (planId: string) => {
    setDeletedPlanIds([...deletedPlanIds, planId]);
    setExistingPlans(existingPlans.filter((p) => p.id !== planId));
  };

  const handleDeletePendingPlan = (planId: string) => {
    setPendingPlans(pendingPlans.filter((p) => p.id !== planId));
  };

  const handleSubmit = async () => {
    setError("");
    const errors: Record<string, string> = {};
    if (!formData.customerName.trim() && tab !== "vendor-users") errors.customerName = t("Customer name is required");
    if (!formData.fullName.trim()) errors.fullName = t("Full name is required");
    if (!formData.email.trim()) errors.email = t("Email is required");
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = t("Passwords do not match");
    }
    if (formData.password && !formData.confirmPassword) errors.confirmPassword = t("Confirm password is required");
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    try {
      setSaving(true);
      const res = await fetch("/api/tprm/account-overview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          customerName: formData.customerName || undefined,
          fullName: formData.fullName,
          email: formData.email,
          language: formData.language,
          timeZone: formData.timeZone,
          blocked: formData.blocked,
          active: formData.active,
          isGrcAdded: showIsGrcAdded ? formData.isGrcAdded : undefined,
          password: formData.password || undefined,
          deleteSubscriptionPlanIds: deletedPlanIds.length > 0 ? deletedPlanIds : undefined,
          addSubscriptionPlans: pendingPlans.length > 0 ? pendingPlans.map((p) => ({
            startDate: p.startDate,
            expiryDate: p.expiryDate,
            maxFrameworks: p.maxFrameworks,
            maxAccounts: p.maxAccounts,
            assessmentLimit: p.assessmentLimit,
            vendorLimit: p.vendorLimit,
            status: p.status,
          })) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("Failed to update account"));
        return;
      }

      // Trigger dynamic translation for updated customer account name and user
      if (json.customerAccountId) {
        triggerTranslation('CustomerAccount', json.customerAccountId, { name: formData.customerName });
      }
      if (userId) {
        triggerTranslation('User', userId, { fullName: formData.fullName, firstName: formData.fullName.split(' ')[0], lastName: formData.fullName.split(' ').slice(1).join(' ') });
      }

      onOpenChange(false);
      onSuccess();
    } catch {
      setError(t("Failed to update account"));
    } finally {
      setSaving(false);
    }
  };

  const allPlans = [...existingPlans, ...pendingPlans];
  const editRoleLabel = tab === "vendor-users" ? "" : (ROLE_LABELS[tab] || "");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Account")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            {loadingData ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-md">
                    {error}
                  </div>
                )}

                {/* Account Information Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Account Information")}</h3>

                  {editRoleLabel && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-slate-700">{t("User Role")}</Label>
                        <Input className="bg-slate-50" value={t(editRoleLabel)} disabled />
                      </div>
                    </div>
                  )}

                  {tab !== "vendor-users" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">{t("Customer Name")} <span className="text-error">*</span></Label>
                      <Input
                        value={formData.customerName}
                        onChange={(e) => { setFormData({ ...formData, customerName: e.target.value }); setFormErrors((prev) => { const { customerName, ...rest } = prev; return rest; }); }}
                        placeholder={t("Enter customer name")}
                        className={formErrors.customerName ? "border-red-400" : ""}
                      />
                      {formErrors.customerName && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.customerName}</div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Full Name")} <span className="text-error">*</span></Label>
                    <Input
                      value={formData.fullName}
                      onChange={(e) => { setFormData({ ...formData, fullName: e.target.value }); setFormErrors((prev) => { const { fullName, ...rest } = prev; return rest; }); }}
                      placeholder={t("Admin user full name")}
                      className={formErrors.fullName ? "border-red-400" : ""}
                    />
                    {formErrors.fullName && (
                      <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.fullName}</div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Username")}</Label>
                    <Input className="bg-slate-50" value={formData.userName} disabled />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Email")} <span className="text-error">*</span></Label>
                    <Input
                      type="email"
                      autoComplete="off"
                      value={formData.email}
                      onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFormErrors((prev) => { const { email, ...rest } = prev; return rest; }); }}
                      placeholder={t("Enter email address")}
                      className={formErrors.email ? "border-red-400" : ""}
                    />
                    {formErrors.email && (
                      <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.email}</div>
                    )}
                  </div>
                </div>

                {/* Settings Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Settings")}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Language")}</Label>
                      <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
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
                      <Select value={formData.timeZone} onValueChange={(v) => setFormData({ ...formData, timeZone: v })}>
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

                  <div className={`grid grid-cols-1 ${showIsGrcAdded ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4`}>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">{t("Blocked")}</Label>
                      <div className="flex gap-4 h-9 items-center">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`edit-blocked-${tab}`} checked={!formData.blocked} onChange={() => setFormData({ ...formData, blocked: false })} className="accent-primary" /> {t("No")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`edit-blocked-${tab}`} checked={formData.blocked} onChange={() => setFormData({ ...formData, blocked: true })} className="accent-primary" /> {t("Yes")}
                        </label>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">{t("Active")}</Label>
                      <div className="flex gap-4 h-9 items-center">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`edit-active-${tab}`} checked={formData.active} onChange={() => setFormData({ ...formData, active: true })} className="accent-primary" /> {t("Yes")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`edit-active-${tab}`} checked={!formData.active} onChange={() => setFormData({ ...formData, active: false })} className="accent-primary" /> {t("No")}
                        </label>
                      </div>
                    </div>
                    {showIsGrcAdded && (
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-slate-700">{t("Is GRC Added")}</Label>
                        <div className="flex gap-4 h-9 items-center">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="radio" name={`edit-isGrcAdded-${tab}`} checked={!formData.isGrcAdded} onChange={() => setFormData({ ...formData, isGrcAdded: false })} className="accent-primary" /> {t("No")}
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="radio" name={`edit-isGrcAdded-${tab}`} checked={formData.isGrcAdded} onChange={() => setFormData({ ...formData, isGrcAdded: true })} className="accent-primary" /> {t("Yes")}
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Password Section (optional for edit) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Password")}</h3>
                  <p className="text-xs text-slate-500">{t("Leave blank to keep current password")}</p>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("New Password")}</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setFormErrors((prev) => { const { password, ...rest } = prev; return rest; }); }}
                      placeholder={t("Enter new password")}
                      className={formErrors.password ? "border-red-400" : ""}
                    />
                    {formErrors.password && (
                      <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.password}</div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Confirm Password")}</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); setFormErrors((prev) => { const { confirmPassword, ...rest } = prev; return rest; }); }}
                      placeholder={t("Confirm new password")}
                      className={formErrors.confirmPassword ? "border-red-400" : ""}
                    />
                    {formErrors.confirmPassword && (
                      <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{formErrors.confirmPassword}</div>
                    )}
                  </div>
                </div>

                {/* Subscription Plans Section */}
                {hasSubscription && allPlans.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Subscription Plans")}</h3>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
                      <Table className="min-w-[500px]">
                        <TableHeader>
                          <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Accounts Available")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assessment Limit")}</TableHead>
                            {tab === "customers" && (
                              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Vendor Limit")}</TableHead>
                            )}
                            {formData.isGrcAdded && (
                              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Frameworks Available")}</TableHead>
                            )}
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Expiry date")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5">{t("Action")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allPlans.map((plan) => {
                            const isPending = plan.id.startsWith("pending-");
                            return (
                              <TableRow key={plan.id} className="border-b border-slate-100 last:border-0">
                                <TableCell className="py-3 ltr:pl-5 rtl:pr-5 text-sm text-slate-700">{plan.maxAccounts}</TableCell>
                                <TableCell className="py-3 text-sm text-slate-700">{plan.assessmentLimit}</TableCell>
                                {tab === "customers" && (
                                  <TableCell className="py-3 text-sm text-slate-700">{plan.vendorLimit}</TableCell>
                                )}
                                {formData.isGrcAdded && (
                                  <TableCell className="py-3 text-sm text-slate-700">{plan.maxFrameworks}</TableCell>
                                )}
                                <TableCell className="py-3 text-sm text-slate-700">{plan.expiryDate}</TableCell>
                                <TableCell className="py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    plan.status === "Active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {t(plan.status)}
                                  </span>
                                </TableCell>
                                <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                                    onClick={() => isPending ? handleDeletePendingPlan(plan.id) : handleDeleteExistingPlan(plan.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          {!loadingData && (
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex flex-col sm:flex-row sm:rtl:flex-row-reverse justify-between gap-2">
              {hasSubscription ? (
                <Button variant="outline" size="sm" className="w-full sm:w-auto order-last sm:order-first" onClick={() => setShowSubDialog(true)}>
                  {t("Subscription Plan")} {allPlans.length > 0 && `(${allPlans.length})`}
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2 rtl:flex-row-reverse">
                <Button onClick={handleSubmit} disabled={saving} size="sm" className="flex-1 sm:flex-none">
                  {saving ? t("Saving...") : t("Save")}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
                  {t("Cancel")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Subscription Plan Dialog (reused from CreateAccountDialog pattern) */}
      <Dialog open={showSubDialog} onOpenChange={(v) => { setShowSubDialog(v); if (!v) setSubErrors({}); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Subscription")}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Start date")}</Label>
              <div className="col-span-3 space-y-1.5">
                <Input type="date" value={subData.startDate} onChange={(e) => { setSubData({ ...subData, startDate: e.target.value }); setSubErrors((prev) => { const { startDate, ...rest } = prev; return rest; }); }} className={subErrors.startDate ? "border-red-400" : ""} />
                {subErrors.startDate && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.startDate}</div>}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Expiry date")}</Label>
              <div className="col-span-3 space-y-1.5">
                <Input type="date" value={subData.expiryDate} onChange={(e) => { setSubData({ ...subData, expiryDate: e.target.value }); setSubErrors((prev) => { const { expiryDate, ...rest } = prev; return rest; }); }} className={subErrors.expiryDate ? "border-red-400" : ""} />
                {subErrors.expiryDate && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.expiryDate}</div>}
              </div>
            </div>
            {formData.isGrcAdded && (
              <div className="grid grid-cols-4 gap-4">
                <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Max frameworks")}</Label>
                <div className="col-span-3 space-y-1.5">
                  <Input type="number" min="0" value={subData.maxFrameworks} onChange={(e) => { setSubData({ ...subData, maxFrameworks: parseInt(e.target.value) || 0 }); setSubErrors((prev) => { const { maxFrameworks, ...rest } = prev; return rest; }); }} className={subErrors.maxFrameworks ? "border-red-400" : ""} />
                  {subErrors.maxFrameworks && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.maxFrameworks}</div>}
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Max accounts")}</Label>
              <div className="col-span-3 space-y-1.5">
                <Input type="number" min="0" value={subData.maxAccounts} onChange={(e) => { setSubData({ ...subData, maxAccounts: parseInt(e.target.value) || 0 }); setSubErrors((prev) => { const { maxAccounts, ...rest } = prev; return rest; }); }} className={subErrors.maxAccounts ? "border-red-400" : ""} />
                {subErrors.maxAccounts && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.maxAccounts}</div>}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Assessment limit")}</Label>
              <div className="col-span-3 space-y-1.5">
                <Input type="number" min="0" value={subData.assessmentLimit} onChange={(e) => { setSubData({ ...subData, assessmentLimit: parseInt(e.target.value) || 0 }); setSubErrors((prev) => { const { assessmentLimit, ...rest } = prev; return rest; }); }} className={subErrors.assessmentLimit ? "border-red-400" : ""} />
                {subErrors.assessmentLimit && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.assessmentLimit}</div>}
              </div>
            </div>
            {tab === "customers" && (
              <div className="grid grid-cols-4 gap-4">
                <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Vendor limit")}</Label>
                <div className="col-span-3 space-y-1.5">
                  <Input type="number" min="0" value={subData.vendorLimit} onChange={(e) => { setSubData({ ...subData, vendorLimit: parseInt(e.target.value) || 0 }); setSubErrors((prev) => { const { vendorLimit, ...rest } = prev; return rest; }); }} className={subErrors.vendorLimit ? "border-red-400" : ""} />
                  {subErrors.vendorLimit && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.vendorLimit}</div>}
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-4">
              <Label className="ltr:text-right rtl:text-left text-sm font-medium text-slate-700 pt-2">{t("Status")}</Label>
              <div className="col-span-3 space-y-1.5">
                <div className="flex gap-4 h-9 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="editSubStatus" checked={subData.status === "Active"} onChange={() => { setSubData({ ...subData, status: "Active" }); setSubErrors((prev) => { const { status, ...rest } = prev; return rest; }); }} className="accent-primary" /> {t("Active")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="editSubStatus" checked={subData.status === "Inactive"} onChange={() => { setSubData({ ...subData, status: "Inactive" }); setSubErrors((prev) => { const { status, ...rest } = prev; return rest; }); }} className="accent-primary" /> {t("Inactive")}
                  </label>
                </div>
                {subErrors.status && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded">{subErrors.status}</div>}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex gap-2 ltr:justify-end rtl:justify-start">
            <Button onClick={handleAddSubscription} size="sm">{t("Save")}</Button>
            <Button variant="outline" size="sm" onClick={() => { setShowSubDialog(false); resetSubData(); }}>{t("Cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== Customer Accounts Tab ====================

function CustomerAccountsTab() {
  const { t } = useLanguage();
  const [data, setData] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState("");
  const [deleteAccountName, setDeleteAccountName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/account-overview?tab=customers&limit=100");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (error) {
      console.error("Error fetching customer accounts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Dynamic translation for customer account names
  const accountRecords = useMemo(() => data.map((c) => ({ id: c.id, name: c.companyName })), [data]);
  const { data: translatedAccounts } = useTranslatedData(accountRecords, { modelName: 'CustomerAccount' });
  const translatedData = useMemo(() => data.map((c) => {
    const tr = translatedAccounts.find((r) => r.id === c.id);
    return tr ? { ...c, companyName: tr.name || c.companyName } : c;
  }), [data, translatedAccounts]);

  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tprm/account-overview?tab=customers&accountId=${deleteAccountId}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      } else {
        const json = await res.json();
        console.error("Delete failed:", json.error);
      }
    } catch (error) {
      console.error("Error deleting account:", error);
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteAccountId("");
      setDeleteAccountName("");
    }
  };

  const columns: ColumnDef<CustomerAccount>[] = [
    {
      accessorKey: "companyName",
      header: t("Company Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("companyName")}</span>,
    },
    {
      accessorKey: "fullName",
      header: t("Full Name"),
    },
    {
      accessorKey: "email",
      header: t("Email"),
      cell: ({ row }) => <span className="text-sm">{row.getValue("email")}</span>,
    },
    {
      accessorKey: "active",
      header: t("Active"),
      cell: ({ row }) => (
        <Badge variant={row.getValue("active") === "Yes" ? "default" : "secondary"}>
          {t(row.getValue("active") as string)}
        </Badge>
      ),
    },
    {
      accessorKey: "assessmentCount",
      header: t("Assessment Count"),
      cell: ({ row }) => {
        const val = row.getValue("assessmentCount") as number;
        return <span className={val > 0 ? "text-primary font-semibold" : ""}>{val}</span>;
      },
    },
    {
      accessorKey: "onboardedVendor",
      header: t("Onboarded Vendor"),
      cell: ({ row }) => {
        const val = row.getValue("onboardedVendor") as number;
        return <span className={val > 0 ? "text-primary font-semibold" : ""}>{val}</span>;
      },
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => {
            const uid = row.original.userId;
            if (!uid) return;
            setEditUserId(uid);
            setEditOpen(true);
          }} title={t("Edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => {
            setDeleteAccountId(row.original.id);
            setDeleteAccountName(row.original.companyName);
            setDeleteConfirmOpen(true);
          }} title={t("Delete")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <p className="text-sm text-slate-500">{t("Loading...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:rtl:flex-row-reverse items-start sm:items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-700">{t("Customer Accounts")}</h3>
        <p className="text-xs text-slate-500 ltr:text-right rtl:text-left">
          {t("New customers are onboarded from the Customer Accounts page.")}
        </p>
      </div>
      <DataGrid columns={columns} data={translatedData} searchPlaceholder={t("Search customers...")} searchColumn="companyName" />
      <EditAccountDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        userId={editUserId}
        tab="customers"
        showIsGrcAdded={true}
        onSuccess={fetchData}
      />
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Account")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete the account")} <strong>{deleteAccountName}</strong>? {t("This will permanently delete the account, all associated users, vendors, assessments, and subscription plans. This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : null}
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== Vendor Accounts Tab ====================

function VendorAccountsTab() {
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorUsers, setVendorUsers] = useState<Record<string, VendorUser[]>>({});
  const [loadingVendor, setLoadingVendor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editVendorId, setEditVendorId] = useState("");

  const fetchVendors = useCallback(async (reset = true) => {
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : loadedCount;
      const params = new URLSearchParams({ tab: "vendors", limit: "20", offset: String(currentOffset) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/tprm/account-overview?${params}`);
      if (res.ok) {
        const json = await res.json();
        if (reset) {
          setVendors(json.data);
          setLoadedCount(json.data.length);
        } else {
          setVendors((prev) => [...prev, ...json.data]);
          setLoadedCount((prev) => prev + json.data.length);
        }
        setHasMore(json.pagination.hasMore);
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
    } finally {
      setLoading(false);
    }
  }, [search, loadedCount]);

  useEffect(() => { fetchVendors(true); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchVendorUsers = async (vendorId: string, userSearch?: string) => {
    try {
      setLoadingVendor(vendorId);
      const params = new URLSearchParams({ tab: "vendor-users", vendorId, limit: "50" });
      if (userSearch) params.set("search", userSearch);
      const res = await fetch(`/api/tprm/account-overview?${params}`);
      if (res.ok) {
        const json = await res.json();
        setVendorUsers((prev) => ({ ...prev, [vendorId]: json.data }));
      }
    } catch (error) {
      console.error("Error fetching vendor users:", error);
    } finally {
      setLoadingVendor(null);
    }
  };

  const handleAccordionChange = (value: string[]) => {
    for (const vendorId of value) {
      if (!vendorUsers[vendorId]) {
        fetchVendorUsers(vendorId);
      }
    }
  };

  const vendorUserColumns: ColumnDef<VendorUser>[] = [
    {
      accessorKey: "companyName",
      header: t("Company Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("companyName")}</span>,
    },
    {
      accessorKey: "fullName",
      header: t("Full Name"),
    },
    {
      accessorKey: "username",
      header: t("Username"),
      cell: ({ row }) => <span className="text-sm">{row.getValue("username")}</span>,
    },
    {
      accessorKey: "email",
      header: t("Email"),
      cell: ({ row }) => <span className="text-sm">{row.getValue("email")}</span>,
    },
    {
      accessorKey: "createdDate",
      header: t("Created Date"),
      cell: ({ row }) => formatDate(row.getValue("createdDate")),
    },
    {
      accessorKey: "lastLogin",
      header: t("Last Login"),
      cell: ({ row }) => formatDate(row.getValue("lastLogin")),
    },
    {
      accessorKey: "active",
      header: t("Active"),
      cell: ({ row }) => (
        <Badge variant={row.getValue("active") === "Yes" ? "default" : "secondary"}>
          {t(row.getValue("active") as string)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => {
            setEditUserId(row.original.id);
            setEditVendorId(row.original.id);
            setEditOpen(true);
          }} title={t("Edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading && vendors.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <p className="text-sm text-slate-500">{t("Loading...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:rtl:flex-row-reverse items-start sm:items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-700">{t("Vendor Accounts")}</h3>
        <div className="relative w-full sm:w-64">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("Search vendors...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ltr:pl-9 rtl:pr-9 h-9"
          />
        </div>
      </div>

      {vendors.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-primary-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">{t("No vendors found")}</p>
          <p className="text-xs text-slate-400">{t("Try adjusting your search")}</p>
        </div>
      ) : (
        <Accordion type="multiple" onValueChange={handleAccordionChange}>
          {vendors.map((vendor) => (
            <AccordionItem key={vendor.id} value={vendor.id} className="bg-white rounded-xl border border-slate-200 mb-3 px-4">
              <AccordionTrigger className="text-sm font-semibold text-slate-800 hover:no-underline">
                {vendor.label}
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2">
                  {loadingVendor === vendor.id ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
                    </div>
                  ) : vendorUsers[vendor.id]?.length ? (
                    <DataGrid columns={vendorUserColumns} data={vendorUsers[vendor.id]} searchPlaceholder={t("Search users...")} searchColumn="fullName" pageSize={5} />
                  ) : (
                    <p className="text-sm text-slate-500 py-4 text-center">{t("No data available")}</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
      {hasMore && (
        <button
          onClick={() => fetchVendors(false)}
          className="w-full py-3 text-sm text-primary-600 hover:bg-primary-50 border border-slate-200 rounded-xl transition-colors"
        >
          {t("Load more...")}
        </button>
      )}
      <EditAccountDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        userId={editUserId}
        tab="vendor-users"
        showIsGrcAdded={false}
        onSuccess={() => {
          // Refresh vendor users for all expanded vendors
          Object.keys(vendorUsers).forEach((vid) => fetchVendorUsers(vid));
        }}
      />
    </div>
  );
}

// ==================== Assessment Factory Tab ====================

function AssessmentFactoryTab() {
  const { t } = useLanguage();
  const [data, setData] = useState<FactoryAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState("");
  const [deleteAccountName, setDeleteAccountName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/account-overview?tab=factory&limit=100");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (error) {
      console.error("Error fetching factory accounts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const accountRecords = useMemo(() => data.map(a => ({ id: a.id, name: a.companyName })), [data]);
  const { data: translatedFactoryAccounts } = useTranslatedData(accountRecords, { modelName: 'CustomerAccount' });
  const userRecords = useMemo(() => data.filter(a => a.userId).map(a => ({ id: a.userId!, fullName: a.fullName })), [data]);
  const { data: translatedFactoryUsers } = useTranslatedData(userRecords, { modelName: 'User' });
  const factoryTranslatedData = useMemo(() => data.map(a => {
    const ta = translatedFactoryAccounts.find(r => r.id === a.id);
    const tu = a.userId ? translatedFactoryUsers.find(r => r.id === a.userId) : null;
    return { ...a, companyName: ta?.name || a.companyName, fullName: tu?.fullName || a.fullName };
  }), [data, translatedFactoryAccounts, translatedFactoryUsers]);

  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tprm/account-overview?tab=factory&accountId=${deleteAccountId}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      } else {
        const json = await res.json();
        console.error("Delete failed:", json.error);
      }
    } catch (error) {
      console.error("Error deleting account:", error);
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteAccountId("");
      setDeleteAccountName("");
    }
  };

  const columns: ColumnDef<FactoryAccount>[] = [
    {
      accessorKey: "companyName",
      header: t("Company Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("companyName")}</span>,
    },
    {
      accessorKey: "fullName",
      header: t("Full Name"),
    },
    {
      accessorKey: "email",
      header: t("Email"),
      cell: ({ row }) => <span className="text-sm">{row.getValue("email")}</span>,
    },
    {
      accessorKey: "active",
      header: t("Active"),
      cell: ({ row }) => (
        <Badge variant={row.getValue("active") === "Yes" ? "default" : "secondary"}>
          {t(row.getValue("active") as string)}
        </Badge>
      ),
    },
    {
      accessorKey: "assessmentCount",
      header: t("Assessment Count"),
      cell: ({ row }) => {
        const val = row.getValue("assessmentCount") as number;
        return <span className={val > 0 ? "text-primary font-semibold" : ""}>{val}</span>;
      },
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => {
            const uid = row.original.userId;
            if (!uid) return;
            setEditUserId(uid);
            setEditOpen(true);
          }} title={t("Edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => {
            setDeleteAccountId(row.original.id);
            setDeleteAccountName(row.original.companyName);
            setDeleteConfirmOpen(true);
          }} title={t("Delete")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <p className="text-sm text-slate-500">{t("Loading...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:rtl:flex-row-reverse items-start sm:items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-700">{t("Assessment Factory")}</h3>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Create Factory Admin")}
        </Button>
      </div>
      <DataGrid columns={columns} data={factoryTranslatedData} searchPlaceholder={t("Search factory accounts...")} searchColumn="companyName" />
      <CreateAccountDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tab="factory"
        title={t("Create Factory Admin Account")}
        showIsGrcAdded={false}
        onSuccess={fetchData}
      />
      <EditAccountDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        userId={editUserId}
        tab="factory"
        showIsGrcAdded={false}
        onSuccess={fetchData}
      />
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Account")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete the account")} <strong>{deleteAccountName}</strong>? {t("This will permanently delete the account, all associated users, vendors, assessments, and subscription plans. This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : null}
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== Super Admin Tab ====================

function SuperAdminTab() {
  const { t } = useLanguage();
  const [data, setData] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteUserName, setDeleteUserName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/account-overview?tab=superadmin&limit=100");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (error) {
      console.error("Error fetching super admins:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const superAdminUserRecords = useMemo(() => data.map(a => ({ id: a.id, fullName: a.fullName })), [data]);
  const { data: translatedSuperAdmins } = useTranslatedData(superAdminUserRecords, { modelName: 'User' });
  const superAdminTranslatedData = useMemo(() => data.map(a => {
    const tu = translatedSuperAdmins.find(r => r.id === a.id);
    return tu ? { ...a, fullName: tu.fullName || a.fullName } : a;
  }), [data, translatedSuperAdmins]);

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tprm/account-overview?tab=superadmin&userId=${deleteUserId}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      } else {
        const json = await res.json();
        console.error("Delete failed:", json.error);
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteUserId("");
      setDeleteUserName("");
    }
  };

  const columns: ColumnDef<SuperAdmin>[] = [
    {
      accessorKey: "fullName",
      header: t("Full Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("fullName")}</span>,
    },
    {
      accessorKey: "username",
      header: t("Username"),
      cell: ({ row }) => <span className="text-sm">{row.getValue("username")}</span>,
    },
    {
      accessorKey: "email",
      header: t("Email"),
      cell: ({ row }) => <span className="text-sm">{row.getValue("email")}</span>,
    },
    {
      accessorKey: "companyName",
      header: t("Company Name"),
    },
    {
      accessorKey: "phoneNumber",
      header: t("Phone Number"),
    },
    {
      accessorKey: "lastLogin",
      header: t("Last Login"),
      cell: ({ row }) => formatDate(row.getValue("lastLogin")),
    },
    {
      accessorKey: "active",
      header: t("Active"),
      cell: ({ row }) => (
        <Badge variant={row.getValue("active") === "Yes" ? "default" : "secondary"}>
          {t(row.getValue("active") as string)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => {
            setEditUserId(row.original.id);
            setEditOpen(true);
          }} title={t("Edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => {
            setDeleteUserId(row.original.id);
            setDeleteUserName(row.original.fullName);
            setDeleteConfirmOpen(true);
          }} title={t("Delete")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <p className="text-sm text-slate-500">{t("Loading...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:rtl:flex-row-reverse items-start sm:items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-700">{t("Super Admin")}</h3>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Create New SuperAdmin")}
        </Button>
      </div>
      <DataGrid columns={columns} data={superAdminTranslatedData} searchPlaceholder={t("Search super admins...")} searchColumn="fullName" />
      <CreateAccountDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tab="superadmin"
        title={t("Create New TPRM Admin Account")}
        showIsGrcAdded={false}
        onSuccess={fetchData}
      />
      <EditAccountDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        userId={editUserId}
        tab="superadmin"
        showIsGrcAdded={false}
        onSuccess={fetchData}
      />
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Super Admin")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} <strong>{deleteUserName}</strong>? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteUser}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : null}
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== Main Page ====================

export default function AccountOverviewPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Account Overview")}</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Account Overview")}</h1>

      <Tabs defaultValue="customers">
        <TabsList className="ltr:justify-start rtl:justify-end">
          <TabsTrigger value="customers">{t("Customer Accounts")}</TabsTrigger>
          <TabsTrigger value="vendors">{t("Vendor Accounts")}</TabsTrigger>
          <TabsTrigger value="factory">{t("Assessment Factory")}</TabsTrigger>
          <TabsTrigger value="superadmin">{t("Super Admin")}</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-6">
          <CustomerAccountsTab />
        </TabsContent>

        <TabsContent value="vendors" className="mt-6">
          <VendorAccountsTab />
        </TabsContent>

        <TabsContent value="factory" className="mt-6">
          <AssessmentFactoryTab />
        </TabsContent>

        <TabsContent value="superadmin" className="mt-6">
          <SuperAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
