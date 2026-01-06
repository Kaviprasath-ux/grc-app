"use client";

import { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Image, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    customerName: "",
    email: "",
    userName: "",
    newPassword: "",
    confirmPassword: "",
    blocked: false,
    active: true,
    language: "en-US",
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
      logoFile: null,
    });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-700">GRC Customer Account</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-900 hover:bg-blue-900">
                <TableHead className="text-white font-semibold">Customer Code</TableHead>
                <TableHead className="text-white font-semibold">Customer Name</TableHead>
                <TableHead className="text-white font-semibold">Email</TableHead>
                <TableHead className="text-white font-semibold">UserName</TableHead>
                <TableHead className="text-white font-semibold">Compliance Percentage</TableHead>
                <TableHead className="text-white font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{customer.customerCode}</TableCell>
                    <TableCell>{customer.customerName}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.userName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${customer.compliancePercentage}%` }}
                          />
                        </div>
                        <span className="text-sm">{customer.compliancePercentage.toFixed(2)}%</span>
                      </div>
                    </TableCell>
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
                  onClick={() => document.getElementById("customerLogoUpload")?.click()}
                >
                  Browse...
                </Button>
                <input
                  id="customerLogoUpload"
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
                <Button variant="link" className="text-blue-600 p-0">
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
            <Button variant="outline" className="bg-blue-600 text-white hover:bg-blue-700">
              Subscription Plan
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
              {submitting ? "Deleting..." : "OK"}
            </Button>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setSelectedCustomer(null); }}>
              Cancel
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
