"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Image, Trash2, X, Upload, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface CustomerAccount {
  id: string;
  customerCode: string;
  customerName: string;
  email: string;
  userName: string;
  isLocalUser: boolean;
  name: string;
  lastLogin: string | null;
  blocked: boolean;
  blockedSince: string | null;
  active: boolean;
  language?: string;
  timeZone?: string;
  logoUrl?: string;
}

interface SubscriptionPlan {
  id: string;
  frameworksAvailable: number;
  accountsAvailable: number;
  maxFrameworksAllowed?: number;
  maxAccountsAllowed?: number;
  frameworksUsed?: number;
  accountsUsed?: number;
  startDate?: string;
  expiryDate: string;
  status: string;
}

// Restricted to English and Arabic only per UAT
const LANGUAGES = [
  { value: "en-US", label: "English, United States" },
  { value: "ar-QA", label: "Arabic, Qatar" },
];

// Full IANA time zone list
const TIME_ZONES = [
  // UTC
  { value: "UTC", label: "UTC" },
  // Africa
  { value: "Africa/Abidjan", label: "Africa/Abidjan" },
  { value: "Africa/Accra", label: "Africa/Accra" },
  { value: "Africa/Algiers", label: "Africa/Algiers" },
  { value: "Africa/Cairo", label: "Africa/Cairo" },
  { value: "Africa/Casablanca", label: "Africa/Casablanca" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg" },
  { value: "Africa/Lagos", label: "Africa/Lagos" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi" },
  { value: "Africa/Tunis", label: "Africa/Tunis" },
  // America
  { value: "America/Anchorage", label: "America/Anchorage" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Argentina/Buenos_Aires" },
  { value: "America/Bogota", label: "America/Bogota" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Lima", label: "America/Lima" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "America/Mexico_City", label: "America/Mexico_City" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Phoenix", label: "America/Phoenix" },
  { value: "America/Santiago", label: "America/Santiago" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo" },
  { value: "America/Toronto", label: "America/Toronto" },
  { value: "America/Vancouver", label: "America/Vancouver" },
  // Asia
  { value: "Asia/Baghdad", label: "Asia/Baghdad" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok" },
  { value: "Asia/Beirut", label: "Asia/Beirut" },
  { value: "Asia/Colombo", label: "Asia/Colombo" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong" },
  { value: "Asia/Jakarta", label: "Asia/Jakarta" },
  { value: "Asia/Jerusalem", label: "Asia/Jerusalem" },
  { value: "Asia/Kabul", label: "Asia/Kabul" },
  { value: "Asia/Karachi", label: "Asia/Karachi" },
  { value: "Asia/Kathmandu", label: "Asia/Kathmandu" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur" },
  { value: "Asia/Kuwait", label: "Asia/Kuwait" },
  { value: "Asia/Manila", label: "Asia/Manila" },
  { value: "Asia/Muscat", label: "Asia/Muscat" },
  { value: "Asia/Qatar", label: "Asia/Qatar" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh" },
  { value: "Asia/Seoul", label: "Asia/Seoul" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Asia/Taipei", label: "Asia/Taipei" },
  { value: "Asia/Tehran", label: "Asia/Tehran" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  // Atlantic
  { value: "Atlantic/Azores", label: "Atlantic/Azores" },
  { value: "Atlantic/Reykjavik", label: "Atlantic/Reykjavik" },
  // Australia
  { value: "Australia/Adelaide", label: "Australia/Adelaide" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane" },
  { value: "Australia/Darwin", label: "Australia/Darwin" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne" },
  { value: "Australia/Perth", label: "Australia/Perth" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  // Europe
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam" },
  { value: "Europe/Athens", label: "Europe/Athens" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/Brussels", label: "Europe/Brussels" },
  { value: "Europe/Bucharest", label: "Europe/Bucharest" },
  { value: "Europe/Budapest", label: "Europe/Budapest" },
  { value: "Europe/Copenhagen", label: "Europe/Copenhagen" },
  { value: "Europe/Dublin", label: "Europe/Dublin" },
  { value: "Europe/Helsinki", label: "Europe/Helsinki" },
  { value: "Europe/Istanbul", label: "Europe/Istanbul" },
  { value: "Europe/Lisbon", label: "Europe/Lisbon" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Madrid", label: "Europe/Madrid" },
  { value: "Europe/Moscow", label: "Europe/Moscow" },
  { value: "Europe/Oslo", label: "Europe/Oslo" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/Prague", label: "Europe/Prague" },
  { value: "Europe/Rome", label: "Europe/Rome" },
  { value: "Europe/Stockholm", label: "Europe/Stockholm" },
  { value: "Europe/Vienna", label: "Europe/Vienna" },
  { value: "Europe/Warsaw", label: "Europe/Warsaw" },
  { value: "Europe/Zurich", label: "Europe/Zurich" },
  // Indian
  { value: "Indian/Maldives", label: "Indian/Maldives" },
  { value: "Indian/Mauritius", label: "Indian/Mauritius" },
  // Pacific
  { value: "Pacific/Auckland", label: "Pacific/Auckland" },
  { value: "Pacific/Fiji", label: "Pacific/Fiji" },
  { value: "Pacific/Guam", label: "Pacific/Guam" },
  { value: "Pacific/Honolulu", label: "Pacific/Honolulu" },
  { value: "Pacific/Midway", label: "Pacific/Midway" },
  { value: "Pacific/Samoa", label: "Pacific/Samoa" },
];

export default function CustomerAccountsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardDialog, setShowOnboardDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [showSubscriptionPlanDialog, setShowSubscriptionPlanDialog] = useState(false);
  const [showNewSubscriptionDialog, setShowNewSubscriptionDialog] = useState(false);
  const [showEditSubscriptionDialog, setShowEditSubscriptionDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAccount | null>(null);
  const [nextCustomerCode, setNextCustomerCode] = useState("GRC_001");
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [pendingSubscriptionPlans, setPendingSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [isOnboardingMode, setIsOnboardingMode] = useState(false);

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

  const [changePasswordData, setChangePasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [newSubscriptionData, setNewSubscriptionData] = useState({
    startDate: "",
    expiryDate: "",
    maxFrameworks: 0,
    maxAccounts: 0,
    status: "Active",
  });

  const [editSubscriptionData, setEditSubscriptionData] = useState({
    id: "",
    startDate: "",
    expiryDate: "",
    maxFrameworks: 0,
    maxAccounts: 0,
    status: "Active",
  });

  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [logoUploadStatus, setLogoUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/grc/customer-accounts");
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
        // Calculate next customer code
        const maxCode = data.reduce((max: number, c: CustomerAccount) => {
          const num = parseInt(c.customerCode.replace("GRC_", "")) || 0;
          return Math.max(max, num);
        }, 0);
        setNextCustomerCode(`GRC_${String(maxCode + 1).padStart(3, "0")}`);
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
    setPendingSubscriptionPlans([]);
    setIsOnboardingMode(false);
  };

  const resetChangePasswordData = () => {
    setChangePasswordData({
      newPassword: "",
      confirmPassword: "",
    });
  };

  const resetNewSubscriptionData = () => {
    setNewSubscriptionData({
      startDate: "",
      expiryDate: "",
      maxFrameworks: 0,
      maxAccounts: 0,
      status: "Active",
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
        setLogoUploadStatus("idle");
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
        setLogoUploadStatus("idle");
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
    setLogoUploadStatus("idle");
    setLogoUploadProgress(0);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleOnboardCustomer = async () => {
    if (!formData.customerName || !formData.email || !formData.userName) {
      toast({
        title: t("Validation Error"),
        description: t("Please fill in all required fields"),
        variant: "destructive",
      });
      return;
    }
    if (!formData.newPassword) {
      toast({
        title: t("Validation Error"),
        description: t("Password is required"),
        variant: "destructive",
      });
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: t("Validation Error"),
        description: t("Passwords do not match"),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/grc/customer-accounts/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.customerName,
          email: formData.email,
          userName: formData.userName,
          password: formData.newPassword,
          blocked: formData.blocked,
          active: formData.active,
          language: formData.language,
          timeZone: formData.timeZone,
          role: "CustomerAdministrator",
          subscriptionPlans: pendingSubscriptionPlans.map(plan => ({
            startDate: plan.startDate,
            expiryDate: plan.expiryDate,
            maxFrameworks: plan.maxFrameworksAllowed || 0,
            maxAccounts: plan.maxAccountsAllowed || 0,
            status: plan.status,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Upload logo if a file was selected
        if (formData.logoFile && data.user?.id) {
          await uploadCustomerLogo(data.user.id, formData.logoFile);
        }

        toast({
          title: t("Success"),
          description: t("Customer onboarded successfully"),
        });
        setShowOnboardDialog(false);
        resetForm();
        fetchCustomers();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to onboard customer"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to onboard customer"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCustomer = async () => {
    if (!selectedCustomer) return;

    if (!formData.customerName || !formData.email || !formData.userName) {
      toast({
        title: t("Validation Error"),
        description: t("Please fill in all required fields"),
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
          blocked: formData.blocked,
          active: formData.active,
          language: formData.language,
          timeZone: formData.timeZone,
        }),
      });

      if (response.ok) {
        // Upload logo if a file was selected
        if (formData.logoFile && selectedCustomer.id) {
          await uploadCustomerLogo(selectedCustomer.id, formData.logoFile);
        }

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

  const handleChangePassword = async () => {
    if (!selectedCustomer) return;

    if (!changePasswordData.newPassword) {
      toast({
        title: t("Validation Error"),
        description: t("New password is required"),
        variant: "destructive",
      });
      return;
    }
    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
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
          customerName: selectedCustomer.customerName,
          email: selectedCustomer.email,
          userName: selectedCustomer.userName,
          password: changePasswordData.newPassword,
        }),
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Password changed successfully"),
        });
        setShowChangePasswordDialog(false);
        resetChangePasswordData();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to change password"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to change password"),
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

  const handleAddSubscription = async () => {
    if (!newSubscriptionData.startDate || !newSubscriptionData.expiryDate) {
      toast({
        title: t("Validation Error"),
        description: t("Start date and expiry date are required"),
        variant: "destructive",
      });
      return;
    }

    // If in onboarding mode, add to pending plans (will be saved with customer)
    if (isOnboardingMode) {
      const newPlan: SubscriptionPlan = {
        id: `pending-${Date.now()}`, // Temporary ID for display
        frameworksAvailable: newSubscriptionData.maxFrameworks,
        accountsAvailable: newSubscriptionData.maxAccounts,
        maxFrameworksAllowed: newSubscriptionData.maxFrameworks,
        maxAccountsAllowed: newSubscriptionData.maxAccounts,
        frameworksUsed: 0,
        accountsUsed: 0,
        startDate: newSubscriptionData.startDate,
        expiryDate: newSubscriptionData.expiryDate,
        status: newSubscriptionData.status,
      };
      setPendingSubscriptionPlans([...pendingSubscriptionPlans, newPlan]);
      setSubscriptionPlans([...subscriptionPlans, newPlan]);
      toast({
        title: t("Success"),
        description: t("Subscription plan added successfully"),
      });
      setShowNewSubscriptionDialog(false);
      resetNewSubscriptionData();
      return;
    }

    // Existing customer - save to API
    const customerId = selectedCustomer?.id;
    if (!customerId) {
      toast({
        title: t("Error"),
        description: t("No customer selected"),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/grc/customer-accounts/${customerId}/subscription-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: newSubscriptionData.startDate,
          expiryDate: newSubscriptionData.expiryDate,
          maxFrameworks: newSubscriptionData.maxFrameworks,
          maxAccounts: newSubscriptionData.maxAccounts,
          status: newSubscriptionData.status,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Add the new plan to the list
        setSubscriptionPlans([...subscriptionPlans, data.plan]);
        toast({
          title: t("Success"),
          description: t("Subscription plan added successfully"),
        });
        setShowNewSubscriptionDialog(false);
        resetNewSubscriptionData();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to add subscription plan"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to add subscription plan"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const uploadCustomerLogo = async (customerId: string, logoFile: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append("logo", logoFile);

    try {
      const response = await fetch(`/api/grc/customer-accounts/${customerId}/logo`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        return true;
      } else {
        const error = await response.json();
        toast({
          title: t("Warning"),
          description: error.error || t("Failed to upload logo"),
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Failed to upload logo:", error);
      return false;
    }
  };

  const handleDeleteSubscription = async (planId: string) => {
    // If in onboarding mode, remove from pending plans
    if (isOnboardingMode) {
      setPendingSubscriptionPlans(pendingSubscriptionPlans.filter(p => p.id !== planId));
      setSubscriptionPlans(subscriptionPlans.filter(p => p.id !== planId));
      toast({
        title: t("Success"),
        description: t("Subscription plan removed"),
      });
      return;
    }

    const customerId = selectedCustomer?.id;
    if (!customerId) return;

    try {
      const response = await fetch(
        `/api/grc/customer-accounts/${customerId}/subscription-plans?planId=${planId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setSubscriptionPlans(subscriptionPlans.filter(p => p.id !== planId));
        toast({
          title: t("Success"),
          description: t("Subscription plan deleted successfully"),
        });
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to delete subscription plan"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to delete subscription plan"),
        variant: "destructive",
      });
    }
  };

  const handleEditSubscription = async () => {
    if (!editSubscriptionData.id) return;

    if (!editSubscriptionData.startDate || !editSubscriptionData.expiryDate) {
      toast({
        title: t("Validation Error"),
        description: t("Start date and expiry date are required"),
        variant: "destructive",
      });
      return;
    }

    // If in onboarding mode, update pending plans (will be saved with customer)
    if (isOnboardingMode) {
      const updatedPlan: SubscriptionPlan = {
        id: editSubscriptionData.id,
        frameworksAvailable: editSubscriptionData.maxFrameworks,
        accountsAvailable: editSubscriptionData.maxAccounts,
        maxFrameworksAllowed: editSubscriptionData.maxFrameworks,
        maxAccountsAllowed: editSubscriptionData.maxAccounts,
        frameworksUsed: 0,
        accountsUsed: 0,
        startDate: editSubscriptionData.startDate,
        expiryDate: editSubscriptionData.expiryDate,
        status: editSubscriptionData.status,
      };
      setPendingSubscriptionPlans(pendingSubscriptionPlans.map(p =>
        p.id === editSubscriptionData.id ? updatedPlan : p
      ));
      setSubscriptionPlans(subscriptionPlans.map(p =>
        p.id === editSubscriptionData.id ? updatedPlan : p
      ));
      toast({
        title: t("Success"),
        description: t("Subscription plan updated successfully"),
      });
      setShowEditSubscriptionDialog(false);
      setSelectedPlan(null);
      return;
    }

    // Existing customer - save to API
    const customerId = selectedCustomer?.id;
    if (!customerId) {
      toast({
        title: t("Error"),
        description: t("No customer selected"),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/grc/customer-accounts/${customerId}/subscription-plans?planId=${editSubscriptionData.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: editSubscriptionData.startDate,
            expiryDate: editSubscriptionData.expiryDate,
            maxFrameworks: editSubscriptionData.maxFrameworks,
            maxAccounts: editSubscriptionData.maxAccounts,
            status: editSubscriptionData.status,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Update the plan in the list
        setSubscriptionPlans(subscriptionPlans.map(p =>
          p.id === editSubscriptionData.id ? data.plan : p
        ));
        toast({
          title: t("Success"),
          description: t("Subscription plan updated successfully"),
        });
        setShowEditSubscriptionDialog(false);
        setSelectedPlan(null);
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to update subscription plan"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to update subscription plan"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditSubscriptionDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setEditSubscriptionData({
      id: plan.id,
      startDate: plan.startDate || "",
      expiryDate: plan.expiryDate,
      maxFrameworks: plan.maxFrameworksAllowed || 0,
      maxAccounts: plan.maxAccountsAllowed || 0,
      status: plan.status,
    });
    setShowEditSubscriptionDialog(true);
  };

  const openEditDialog = (customer: CustomerAccount) => {
    setSelectedCustomer(customer);
    setFormData({
      customerName: customer.customerName,
      email: customer.email,
      userName: customer.userName || customer.name,
      newPassword: "",
      confirmPassword: "",
      blocked: customer.blocked,
      active: customer.active,
      language: customer.language || "en-US",
      timeZone: customer.timeZone || "Asia/Qatar",
      logoFile: null,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (customer: CustomerAccount) => {
    setSelectedCustomer(customer);
    setShowDeleteDialog(true);
  };

  const openLogoDialog = (customer: CustomerAccount) => {
    setSelectedCustomer(customer);
    setShowLogoDialog(true);
  };

  const openChangePasswordDialog = () => {
    resetChangePasswordData();
    setShowChangePasswordDialog(true);
  };

  const openSubscriptionPlanDialog = async (customer?: CustomerAccount, onboardingMode: boolean = false) => {
    setIsOnboardingMode(onboardingMode);

    if (customer) {
      setSelectedCustomer(customer);
    }

    // If onboarding mode, show pending plans instead of fetching from API
    if (onboardingMode) {
      setSubscriptionPlans(pendingSubscriptionPlans);
      setShowSubscriptionPlanDialog(true);
      return;
    }

    const customerId = customer?.id || selectedCustomer?.id;
    if (customerId) {
      // Fetch subscription plans from API
      try {
        const response = await fetch(`/api/grc/customer-accounts/${customerId}/subscription-plans`);
        if (response.ok) {
          const plans = await response.json();
          setSubscriptionPlans(plans);
        } else {
          setSubscriptionPlans([]);
        }
      } catch (error) {
        console.error("Failed to fetch subscription plans:", error);
        setSubscriptionPlans([]);
      }
    } else {
      setSubscriptionPlans([]);
    }
    setShowSubscriptionPlanDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">{t("Loading...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("GRC Customer Account")}</h1>
        <Button onClick={() => setShowOnboardDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t("Onboard Customer")}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="font-semibold text-slate-700">{t("Customer Code")}</TableHead>
              <TableHead className="font-semibold text-slate-700">{t("Customer Name")}</TableHead>
              <TableHead className="font-semibold text-slate-700">{t("Email")}</TableHead>
              <TableHead className="font-semibold text-slate-700">{t("Is Local User")}</TableHead>
              <TableHead className="font-semibold text-slate-700">{t("Name")}</TableHead>
              <TableHead className="font-semibold text-slate-700">{t("Last Login")}</TableHead>
              <TableHead className="font-semibold text-slate-700">{t("Blocked")}</TableHead>
              <TableHead className="font-semibold text-slate-700">{t("Active")}</TableHead>
              <TableHead className="font-semibold text-slate-700">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                  {t("No customer accounts found")}
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{customer.customerCode}</TableCell>
                  <TableCell>{customer.customerName}</TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.isLocalUser ? t("Yes") : t("No")}</TableCell>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.lastLogin || "-"}</TableCell>
                  <TableCell>{customer.blocked ? t("Yes") : t("No")}</TableCell>
                  <TableCell>
                    <span className={customer.active
                      ? "px-2 py-1 rounded text-xs font-medium bg-success-light text-success-dark"
                      : "px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600"
                    }>
                      {customer.active ? t("Yes") : t("No")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Onboard Customer Dialog */}
      <Dialog open={showOnboardDialog} onOpenChange={setShowOnboardDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Account")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              {/* Account Information Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Account Information")}</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Customer Code")}</Label>
                    <Input value={nextCustomerCode} disabled className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("User Role")}</Label>
                    <Input className="bg-slate-50" value="CustomerAdministrator" disabled />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customerName" className="text-sm font-medium text-slate-700">{t("Customer Name")} <span className="text-error">*</span></Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder={t("Enter customer name")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="userName" className="text-sm font-medium text-slate-700">{t("Username")} <span className="text-error">*</span></Label>
                  <Input
                    id="userName"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    placeholder={t("Enter username")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">{t("Email")} <span className="text-error">*</span></Label>
                  <Input
                    id="email"
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Is Local User")}</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="isLocalUserNew" value="yes" defaultChecked className="accent-primary" /> {t("Yes")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="isLocalUserNew" value="no" className="accent-primary" /> {t("No")}
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Blocked")}</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="blockedNew"
                          checked={!formData.blocked}
                          onChange={() => setFormData({ ...formData, blocked: false })}
                          className="accent-primary"
                        /> {t("No")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="blockedNew"
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
                          name="activeNew"
                          checked={formData.active}
                          onChange={() => setFormData({ ...formData, active: true })}
                          className="accent-primary"
                        /> {t("Yes")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="activeNew"
                          checked={!formData.active}
                          onChange={() => setFormData({ ...formData, active: false })}
                          className="accent-primary"
                        /> {t("No")}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Password")}</h3>

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-sm font-medium text-slate-700">{t("New Password")} <span className="text-error">*</span></Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    placeholder={t("Enter password")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">{t("Confirm Password")} <span className="text-error">*</span></Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder={t("Confirm password")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openSubscriptionPlanDialog(undefined, true)}
            >
              {t("Subscription Plan")} {pendingSubscriptionPlans.length > 0 && `(${pendingSubscriptionPlans.length})`}
            </Button>
            <div className="flex gap-2">
              <Button onClick={handleOnboardCustomer} disabled={submitting} size="sm">
                {submitting ? t("Saving...") : t("Save")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowOnboardDialog(false); resetForm(); }}>
                {t("Cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Account")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              {/* Account Information Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Account Information")}</h3>

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Is Local User")}</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="isLocalUserEdit" value="yes" defaultChecked className="accent-primary" /> {t("Yes")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="isLocalUserEdit" value="no" className="accent-primary" /> {t("No")}
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Blocked")}</Label>
                    <div className="flex gap-4 h-9 items-center">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="blockedEdit"
                          checked={!formData.blocked}
                          onChange={() => setFormData({ ...formData, blocked: false })}
                          className="accent-primary"
                        /> {t("No")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="blockedEdit"
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
                          name="activeEdit"
                          checked={formData.active}
                          onChange={() => setFormData({ ...formData, active: true })}
                          className="accent-primary"
                        /> {t("Yes")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="activeEdit"
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
                    onClick={openChangePasswordDialog}
                  >
                    {t("Change password")}
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
              onClick={() => openSubscriptionPlanDialog(selectedCustomer || undefined)}
            >
              {t("Subscription Plan")}
            </Button>
            <div className="flex gap-2">
              <Button onClick={handleEditCustomer} disabled={submitting} size="sm">
                {submitting ? t("Saving...") : t("Save")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowEditDialog(false); resetForm(); setSelectedCustomer(null); }}>
                {t("Cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Change Password")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPasswordChange" className="text-sm font-medium text-slate-700">{t("New password")}</Label>
              <Input
                id="newPasswordChange"
                type="password"
                value={changePasswordData.newPassword}
                onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                placeholder={t("Enter new password")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPasswordChange" className="text-sm font-medium text-slate-700">{t("Confirm password")}</Label>
              <Input
                id="confirmPasswordChange"
                type="password"
                value={changePasswordData.confirmPassword}
                onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                placeholder={t("Confirm new password")}
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
            <Button onClick={handleChangePassword} disabled={submitting} size="sm">
              {submitting ? t("Changing...") : t("Change")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowChangePasswordDialog(false); resetChangePasswordData(); }}>
              {t("Cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Plans Dialog */}
      <Dialog open={showSubscriptionPlanDialog} onOpenChange={setShowSubscriptionPlanDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Subscription Plans")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">{t("Frameworks Available")}</TableHead>
                  <TableHead className="font-semibold text-slate-700">{t("Accounts Available")}</TableHead>
                  <TableHead className="font-semibold text-slate-700">{t("Expiry date")}</TableHead>
                  <TableHead className="font-semibold text-slate-700">{t("Status")}</TableHead>
                  <TableHead className="font-semibold text-slate-700">{t("Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptionPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                      {t("No subscription plans found")}
                    </TableCell>
                  </TableRow>
                ) : (
                  subscriptionPlans.map((plan) => (
                    <TableRow key={plan.id} className="hover:bg-slate-50">
                      <TableCell>{plan.frameworksAvailable}</TableCell>
                      <TableCell>{plan.accountsAvailable}</TableCell>
                      <TableCell>{plan.expiryDate}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          plan.status === "Active" ? "bg-success-light text-success-dark" : "bg-slate-100 text-slate-600"
                        }`}>
                          {plan.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            onClick={() => openEditSubscriptionDialog(plan)}
                            title={t("Edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                            onClick={() => handleDeleteSubscription(plan.id)}
                            title={t("Delete")}
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

          {/* Fixed Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 flex gap-2">
            <Button
              onClick={() => setShowNewSubscriptionDialog(true)}
              size="sm"
            >
              {t("New Subscription Plan")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSubscriptionPlanDialog(false)}>
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Subscription Dialog */}
      <Dialog open={showNewSubscriptionDialog} onOpenChange={setShowNewSubscriptionDialog}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Subscription")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-right text-sm font-medium text-slate-700">{t("Start date")}</Label>
              <Input
                id="startDate"
                type="date"
                className="col-span-3"
                value={newSubscriptionData.startDate}
                onChange={(e) => setNewSubscriptionData({ ...newSubscriptionData, startDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expiryDate" className="text-right text-sm font-medium text-slate-700">{t("Expiry date")}</Label>
              <Input
                id="expiryDate"
                type="date"
                className="col-span-3"
                value={newSubscriptionData.expiryDate}
                onChange={(e) => setNewSubscriptionData({ ...newSubscriptionData, expiryDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="maxFrameworks" className="text-right text-sm font-medium text-slate-700">{t("Max frameworks")}</Label>
              <Input
                id="maxFrameworks"
                type="number"
                min="0"
                className="col-span-3"
                value={newSubscriptionData.maxFrameworks}
                onChange={(e) => setNewSubscriptionData({ ...newSubscriptionData, maxFrameworks: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="maxAccounts" className="text-right text-sm font-medium text-slate-700">{t("Max accounts")}</Label>
              <Input
                id="maxAccounts"
                type="number"
                min="0"
                className="col-span-3"
                value={newSubscriptionData.maxAccounts}
                onChange={(e) => setNewSubscriptionData({ ...newSubscriptionData, maxAccounts: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-sm font-medium text-slate-700">{t("Status")}</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="subscriptionStatus"
                    checked={newSubscriptionData.status === "Active"}
                    onChange={() => setNewSubscriptionData({ ...newSubscriptionData, status: "Active" })}
                    className="accent-primary"
                  /> {t("Active")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="subscriptionStatus"
                    checked={newSubscriptionData.status === "Inactive"}
                    onChange={() => setNewSubscriptionData({ ...newSubscriptionData, status: "Inactive" })}
                    className="accent-primary"
                  /> {t("Inactive")}
                </label>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
            <Button onClick={handleAddSubscription} size="sm">
              {t("Save")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowNewSubscriptionDialog(false); resetNewSubscriptionData(); }}>
              {t("Cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={showEditSubscriptionDialog} onOpenChange={setShowEditSubscriptionDialog}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Subscription")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editStartDate" className="text-right text-sm font-medium text-slate-700">{t("Start date")}</Label>
              <Input
                id="editStartDate"
                type="date"
                className="col-span-3"
                value={editSubscriptionData.startDate}
                onChange={(e) => setEditSubscriptionData({ ...editSubscriptionData, startDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editExpiryDate" className="text-right text-sm font-medium text-slate-700">{t("Expiry date")}</Label>
              <Input
                id="editExpiryDate"
                type="date"
                className="col-span-3"
                value={editSubscriptionData.expiryDate}
                onChange={(e) => setEditSubscriptionData({ ...editSubscriptionData, expiryDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editMaxFrameworks" className="text-right text-sm font-medium text-slate-700">{t("Max frameworks")}</Label>
              <Input
                id="editMaxFrameworks"
                type="number"
                min="0"
                className="col-span-3"
                value={editSubscriptionData.maxFrameworks}
                onChange={(e) => setEditSubscriptionData({ ...editSubscriptionData, maxFrameworks: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editMaxAccounts" className="text-right text-sm font-medium text-slate-700">{t("Max accounts")}</Label>
              <Input
                id="editMaxAccounts"
                type="number"
                min="0"
                className="col-span-3"
                value={editSubscriptionData.maxAccounts}
                onChange={(e) => setEditSubscriptionData({ ...editSubscriptionData, maxAccounts: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-sm font-medium text-slate-700">{t("Status")}</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="editSubscriptionStatus"
                    checked={editSubscriptionData.status === "Active"}
                    onChange={() => setEditSubscriptionData({ ...editSubscriptionData, status: "Active" })}
                    className="accent-primary"
                  /> {t("Active")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="editSubscriptionStatus"
                    checked={editSubscriptionData.status === "Inactive"}
                    onChange={() => setEditSubscriptionData({ ...editSubscriptionData, status: "Inactive" })}
                    className="accent-primary"
                  /> {t("Inactive")}
                </label>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
            <Button onClick={handleEditSubscription} disabled={submitting} size="sm">
              {submitting ? t("Saving...") : t("Save")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowEditSubscriptionDialog(false); setSelectedPlan(null); }}>
              {t("Cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
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
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
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
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
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
          <div className="px-6 py-4 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => { setShowLogoDialog(false); setSelectedCustomer(null); }}>
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
