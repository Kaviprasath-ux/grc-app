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
import { Plus, Pencil, Image, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const handleOnboardCustomer = async () => {
    if (!formData.customerName || !formData.email || !formData.userName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    if (!formData.newPassword) {
      toast({
        title: "Validation Error",
        description: "Password is required",
        variant: "destructive",
      });
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
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
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Upload logo if a file was selected
        if (formData.logoFile && data.user?.id) {
          await uploadCustomerLogo(data.user.id, formData.logoFile);
        }

        toast({
          title: "Success",
          description: "Customer onboarded successfully",
        });
        setShowOnboardDialog(false);
        resetForm();
        fetchCustomers();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to onboard customer",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to onboard customer",
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
        title: "Validation Error",
        description: "Please fill in all required fields",
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

  const handleChangePassword = async () => {
    if (!selectedCustomer) return;

    if (!changePasswordData.newPassword) {
      toast({
        title: "Validation Error",
        description: "New password is required",
        variant: "destructive",
      });
      return;
    }
    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
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
          customerName: selectedCustomer.customerName,
          email: selectedCustomer.email,
          userName: selectedCustomer.userName,
          password: changePasswordData.newPassword,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Password changed successfully",
        });
        setShowChangePasswordDialog(false);
        resetChangePasswordData();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to change password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change password",
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

  const handleAddSubscription = async () => {
    if (!newSubscriptionData.startDate || !newSubscriptionData.expiryDate) {
      toast({
        title: "Validation Error",
        description: "Start date and expiry date are required",
        variant: "destructive",
      });
      return;
    }

    const customerId = selectedCustomer?.id;
    if (!customerId) {
      toast({
        title: "Error",
        description: "No customer selected",
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
          title: "Success",
          description: "Subscription plan added successfully",
        });
        setShowNewSubscriptionDialog(false);
        resetNewSubscriptionData();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to add subscription plan",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add subscription plan",
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
          title: "Warning",
          description: error.error || "Failed to upload logo",
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
          title: "Success",
          description: "Subscription plan deleted successfully",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete subscription plan",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete subscription plan",
        variant: "destructive",
      });
    }
  };

  const handleEditSubscription = async () => {
    const customerId = selectedCustomer?.id;
    if (!customerId || !editSubscriptionData.id) return;

    if (!editSubscriptionData.startDate || !editSubscriptionData.expiryDate) {
      toast({
        title: "Validation Error",
        description: "Start date and expiry date are required",
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
          title: "Success",
          description: "Subscription plan updated successfully",
        });
        setShowEditSubscriptionDialog(false);
        setSelectedPlan(null);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update subscription plan",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update subscription plan",
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

  const openSubscriptionPlanDialog = async (customer?: CustomerAccount) => {
    if (customer) {
      setSelectedCustomer(customer);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-700">GRC Customer Account</h1>
        <Button onClick={() => setShowOnboardDialog(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Onboard Customer
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-900 hover:bg-blue-900">
                <TableHead className="text-white font-semibold">Customer Code</TableHead>
                <TableHead className="text-white font-semibold">Customer Name</TableHead>
                <TableHead className="text-white font-semibold">Email</TableHead>
                <TableHead className="text-white font-semibold">Is Local User</TableHead>
                <TableHead className="text-white font-semibold">Name</TableHead>
                <TableHead className="text-white font-semibold">Last Login</TableHead>
                <TableHead className="text-white font-semibold">Blocked</TableHead>
                <TableHead className="text-white font-semibold">Active</TableHead>
                <TableHead className="text-white font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No customer accounts found
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{customer.customerCode}</TableCell>
                    <TableCell>{customer.customerName}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.isLocalUser ? "Yes" : "No"}</TableCell>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.lastLogin || "-"}</TableCell>
                    <TableCell>{customer.blocked ? "Yes" : "No"}</TableCell>
                    <TableCell>{customer.active ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(customer)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openLogoDialog(customer)}
                          title="View Logo"
                        >
                          <Image className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(customer)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Onboard Customer Dialog */}
      <Dialog open={showOnboardDialog} onOpenChange={setShowOnboardDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
            <DialogDescription>
              Create a new customer account. The user will be assigned the CustomerAdministrator role.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Customer Code</Label>
              <div className="col-span-3">
                <Input value={nextCustomerCode} disabled className="bg-gray-100" />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customerName" className="text-right text-blue-700">Customer Name *</Label>
              <Input
                id="customerName"
                className="col-span-3"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Enter customer name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="userName" className="text-right text-blue-700">Username *</Label>
              <Input
                id="userName"
                className="col-span-3"
                value={formData.userName}
                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                placeholder="Enter username"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right text-blue-700">Email *</Label>
              <Input
                id="email"
                type="email"
                className="col-span-3"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">User Role</Label>
              <Input
                className="col-span-3 bg-gray-100"
                value="CustomerAdministrator"
                disabled
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Upload Logo</Label>
              <div className="col-span-3 flex gap-2">
                <Input
                  type="text"
                  className="flex-1"
                  value={formData.logoFile?.name || "..."}
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("logoUpload")?.click()}
                >
                  Browse...
                </Button>
                <input
                  id="logoUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setFormData({ ...formData, logoFile: file });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Is Local User</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="isLocalUserNew" value="yes" defaultChecked /> Yes
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="isLocalUserNew" value="no" /> No
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Language</Label>
              <div className="col-span-3">
                <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Time Zone</Label>
              <div className="col-span-3">
                <Select value={formData.timeZone} onValueChange={(v) => setFormData({ ...formData, timeZone: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time zone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {TIME_ZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Blocked</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="blockedNew"
                    checked={!formData.blocked}
                    onChange={() => setFormData({ ...formData, blocked: false })}
                  /> No
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="blockedNew"
                    checked={formData.blocked}
                    onChange={() => setFormData({ ...formData, blocked: true })}
                  /> Yes
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Active</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="activeNew"
                    checked={formData.active}
                    onChange={() => setFormData({ ...formData, active: true })}
                  /> Yes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="activeNew"
                    checked={!formData.active}
                    onChange={() => setFormData({ ...formData, active: false })}
                  /> No
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newPassword" className="text-right text-blue-700">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                className="col-span-3"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="confirmPassword" className="text-right text-blue-700">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                className="col-span-3"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm password"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button onClick={handleOnboardCustomer} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                {submitting ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => { setShowOnboardDialog(false); resetForm(); }}>
                Cancel
              </Button>
            </div>
            <Button
              variant="outline"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => openSubscriptionPlanDialog()}
            >
              Subscription Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Customer Code</Label>
              <div className="col-span-3">
                <Input value={selectedCustomer?.customerCode || ""} disabled className="bg-gray-100" />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editCustomerName" className="text-right text-blue-700">Customer Name *</Label>
              <Input
                id="editCustomerName"
                className="col-span-3"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editUserName" className="text-right text-blue-700">Username *</Label>
              <Input
                id="editUserName"
                className="col-span-3"
                value={formData.userName}
                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editEmail" className="text-right text-blue-700">Email *</Label>
              <Input
                id="editEmail"
                type="email"
                className="col-span-3"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Upload Logo</Label>
              <div className="col-span-3 flex gap-2">
                <Input
                  type="text"
                  className="flex-1"
                  value={formData.logoFile?.name || "..."}
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("editLogoUpload")?.click()}
                >
                  Browse...
                </Button>
                <input
                  id="editLogoUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setFormData({ ...formData, logoFile: file });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Is Local User</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="isLocalUser" value="yes" defaultChecked /> Yes
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="isLocalUser" value="no" /> No
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">User Role(s)</Label>
              <Input
                className="col-span-3 bg-gray-100"
                value="CustomerAdministrator"
                disabled
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Language</Label>
              <div className="col-span-3">
                <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Blocked</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="blocked"
                    checked={!formData.blocked}
                    onChange={() => setFormData({ ...formData, blocked: false })}
                  /> No
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="blocked"
                    checked={formData.blocked}
                    onChange={() => setFormData({ ...formData, blocked: true })}
                  /> Yes
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-blue-700">Active</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="active"
                    checked={formData.active}
                    onChange={() => setFormData({ ...formData, active: true })}
                  /> Yes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="active"
                    checked={!formData.active}
                    onChange={() => setFormData({ ...formData, active: false })}
                  /> No
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="col-span-4">
                <Button
                  variant="link"
                  className="text-blue-600 p-0"
                  onClick={openChangePasswordDialog}
                >
                  Change password
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button onClick={handleEditCustomer} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                {submitting ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => { setShowEditDialog(false); resetForm(); setSelectedCustomer(null); }}>
                Cancel
              </Button>
            </div>
            <Button
              variant="outline"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => openSubscriptionPlanDialog(selectedCustomer || undefined)}
            >
              Subscription Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newPasswordChange" className="text-blue-700">New password</Label>
              <Input
                id="newPasswordChange"
                type="password"
                value={changePasswordData.newPassword}
                onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPasswordChange" className="text-blue-700">Confirm password</Label>
              <Input
                id="confirmPasswordChange"
                type="password"
                value={changePasswordData.confirmPassword}
                onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleChangePassword} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? "Changing..." : "Change"}
            </Button>
            <Button variant="outline" onClick={() => { setShowChangePasswordDialog(false); resetChangePasswordData(); }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Plans Dialog */}
      <Dialog open={showSubscriptionPlanDialog} onOpenChange={setShowSubscriptionPlanDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscription Plans</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-900 hover:bg-blue-900">
                  <TableHead className="text-white font-semibold">Frameworks Available</TableHead>
                  <TableHead className="text-white font-semibold">Accounts Available</TableHead>
                  <TableHead className="text-white font-semibold">Expiry date</TableHead>
                  <TableHead className="text-white font-semibold">Status</TableHead>
                  <TableHead className="text-white font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptionPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No subscription plans found
                    </TableCell>
                  </TableRow>
                ) : (
                  subscriptionPlans.map((plan) => (
                    <TableRow key={plan.id} className="hover:bg-gray-50">
                      <TableCell>{plan.frameworksAvailable}</TableCell>
                      <TableCell>{plan.accountsAvailable}</TableCell>
                      <TableCell>{plan.expiryDate}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          plan.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}>
                          {plan.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditSubscriptionDialog(plan)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSubscription(plan.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowNewSubscriptionDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              New Subscription Plan
            </Button>
            <Button variant="outline" onClick={() => setShowSubscriptionPlanDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Subscription Dialog */}
      <Dialog open={showNewSubscriptionDialog} onOpenChange={setShowNewSubscriptionDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>New Subscription</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-right text-blue-700">Start date</Label>
              <Input
                id="startDate"
                type="date"
                className="col-span-3"
                value={newSubscriptionData.startDate}
                onChange={(e) => setNewSubscriptionData({ ...newSubscriptionData, startDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expiryDate" className="text-right text-blue-700">Expiry date</Label>
              <Input
                id="expiryDate"
                type="date"
                className="col-span-3"
                value={newSubscriptionData.expiryDate}
                onChange={(e) => setNewSubscriptionData({ ...newSubscriptionData, expiryDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="maxFrameworks" className="text-right text-blue-700">Max frameworks allowed</Label>
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
              <Label htmlFor="maxAccounts" className="text-right text-blue-700">Max accounts allowed</Label>
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
              <Label className="text-right text-blue-700">Status</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="subscriptionStatus"
                    checked={newSubscriptionData.status === "Active"}
                    onChange={() => setNewSubscriptionData({ ...newSubscriptionData, status: "Active" })}
                  /> Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="subscriptionStatus"
                    checked={newSubscriptionData.status === "Inactive"}
                    onChange={() => setNewSubscriptionData({ ...newSubscriptionData, status: "Inactive" })}
                  /> Inactive
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddSubscription} className="bg-blue-600 hover:bg-blue-700">
              Save
            </Button>
            <Button variant="outline" onClick={() => { setShowNewSubscriptionDialog(false); resetNewSubscriptionData(); }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={showEditSubscriptionDialog} onOpenChange={setShowEditSubscriptionDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editStartDate" className="text-right text-blue-700">Start date</Label>
              <Input
                id="editStartDate"
                type="date"
                className="col-span-3"
                value={editSubscriptionData.startDate}
                onChange={(e) => setEditSubscriptionData({ ...editSubscriptionData, startDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editExpiryDate" className="text-right text-blue-700">Expiry date</Label>
              <Input
                id="editExpiryDate"
                type="date"
                className="col-span-3"
                value={editSubscriptionData.expiryDate}
                onChange={(e) => setEditSubscriptionData({ ...editSubscriptionData, expiryDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editMaxFrameworks" className="text-right text-blue-700">Max frameworks allowed</Label>
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
              <Label htmlFor="editMaxAccounts" className="text-right text-blue-700">Max accounts allowed</Label>
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
              <Label className="text-right text-blue-700">Status</Label>
              <div className="col-span-3 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="editSubscriptionStatus"
                    checked={editSubscriptionData.status === "Active"}
                    onChange={() => setEditSubscriptionData({ ...editSubscriptionData, status: "Active" })}
                  /> Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="editSubscriptionStatus"
                    checked={editSubscriptionData.status === "Inactive"}
                    onChange={() => setEditSubscriptionData({ ...editSubscriptionData, status: "Inactive" })}
                  /> Inactive
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditSubscription} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={() => { setShowEditSubscriptionDialog(false); setSelectedPlan(null); }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmation</DialogTitle>
          </DialogHeader>
          <p className="py-4">Are you sure you want to delete this?</p>
          <DialogFooter>
            <Button
              onClick={handleDeleteCustomer}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? "Deleting..." : "Yes"}
            </Button>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setSelectedCustomer(null); }}>
              No
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Logo Dialog */}
      <Dialog open={showLogoDialog} onOpenChange={setShowLogoDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Customer Logo</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex justify-center">
            {selectedCustomer?.logoUrl ? (
              <img
                src={selectedCustomer.logoUrl}
                alt={`${selectedCustomer.customerName} logo`}
                className="max-w-full max-h-64 object-contain"
              />
            ) : (
              <div className="text-gray-500 text-center py-8">
                <Image className="h-16 w-16 mx-auto text-gray-300 mb-2" />
                <p>No logo uploaded</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowLogoDialog(false); setSelectedCustomer(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
