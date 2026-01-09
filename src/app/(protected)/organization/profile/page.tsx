"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { EditProfileWizard } from "@/components/profile/edit-profile-wizard";

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

interface Organization {
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

interface Department {
  id: string;
  name: string;
}

interface Service {
  id: string;
  title: string;
  description: string;
  serviceUser: string;
  serviceCategory: string;
  serviceItem: string;
}

interface Regulation {
  id: string;
  name: string;
  version: string;
  sa1Date: string;
  sa2Date: string;
  scope: string;
  exclusionJustification: string;
  document: string;
  certificate: string;
  status: string;
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isAddRegulationOpen, setIsAddRegulationOpen] = useState(false);
  const [isEditServiceOpen, setIsEditServiceOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditProfileWizardOpen, setIsEditProfileWizardOpen] = useState(false);
  const [isEditDepartmentOpen, setIsEditDepartmentOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  // Delete confirmation dialogs
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<string | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [deleteRegulationId, setDeleteRegulationId] = useState<string | null>(null);

  // Service categories and items
  const [serviceCategories, setServiceCategories] = useState<string[]>([
    "consulting",
    "Telecom",
    "IT",
  ]);
  const [serviceItems, setServiceItems] = useState<string[]>([
    "Advisory",
    "Internet",
    "Support",
  ]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemName, setNewItemName] = useState("");

  // Form states
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newService, setNewService] = useState({
    title: "",
    description: "",
    serviceUser: "Internal",
    serviceCategory: "consulting",
    serviceItem: "Advisory",
  });
  const [newRegulation, setNewRegulation] = useState({
    name: "",
    version: "",
    sa1Date: "",
    sa2Date: "",
    scope: "",
    exclusionJustification: "",
    document: "",
    certificate: "",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [editDocumentFile, setEditDocumentFile] = useState<File | null>(null);
  const [editCertificateFile, setEditCertificateFile] = useState<File | null>(null);
  const [isEditRegulationOpen, setIsEditRegulationOpen] = useState(false);
  const [editingRegulation, setEditingRegulation] = useState<Regulation | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgRes, deptRes, servRes, regRes] = await Promise.all([
        fetch("/api/organization"),
        fetch("/api/departments"),
        fetch("/api/services"),
        fetch("/api/regulations"),
      ]);

      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setOrganization(orgData); // Will be null if no profile exists
      }
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (servRes.ok) setServices(await servRes.json());
      if (regRes.ok) setRegulations(await regRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Department CRUD
  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim()) return;
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDepartmentName }),
      });
      if (res.ok) {
        const dept = await res.json();
        setDepartments([...departments, dept]);
        setNewDepartmentName("");
        setIsAddDepartmentOpen(false);
      }
    } catch (error) {
      console.error("Error adding department:", error);
    }
  };

  const handleDeleteDepartment = (id: string) => {
    setDeleteDepartmentId(id);
  };

  const confirmDeleteDepartment = async () => {
    if (!deleteDepartmentId) return;
    try {
      const res = await fetch(`/api/departments/${deleteDepartmentId}`, { method: "DELETE" });
      if (res.ok) {
        setDepartments(departments.filter((d) => d.id !== deleteDepartmentId));
      }
    } catch (error) {
      console.error("Error deleting department:", error);
    } finally {
      setDeleteDepartmentId(null);
    }
  };

  const handleEditDepartment = async () => {
    if (!editingDepartment || !editingDepartment.name.trim()) return;
    try {
      const res = await fetch(`/api/departments/${editingDepartment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingDepartment.name }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDepartments(departments.map((d) => (d.id === updated.id ? updated : d)));
        setIsEditDepartmentOpen(false);
        setEditingDepartment(null);
      }
    } catch (error) {
      console.error("Error updating department:", error);
    }
  };

  // Service CRUD
  const handleAddService = async () => {
    if (!newService.title.trim()) return;
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newService),
      });
      if (res.ok) {
        const service = await res.json();
        setServices([...services, service]);
        setNewService({
          title: "",
          description: "",
          serviceUser: "Internal",
          serviceCategory: "consulting",
          serviceItem: "Advisory",
        });
        setIsAddServiceOpen(false);
      }
    } catch (error) {
      console.error("Error adding service:", error);
    }
  };

  const handleEditService = async () => {
    if (!editingService) return;
    try {
      const res = await fetch(`/api/services/${editingService.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingService),
      });
      if (res.ok) {
        const updated = await res.json();
        setServices(services.map((s) => (s.id === updated.id ? updated : s)));
        setIsEditServiceOpen(false);
        setEditingService(null);
      }
    } catch (error) {
      console.error("Error updating service:", error);
    }
  };

  const handleDeleteService = (id: string) => {
    setDeleteServiceId(id);
  };

  const confirmDeleteService = async () => {
    if (!deleteServiceId) return;
    try {
      const res = await fetch(`/api/services/${deleteServiceId}`, { method: "DELETE" });
      if (res.ok) {
        setServices(services.filter((s) => s.id !== deleteServiceId));
      }
    } catch (error) {
      console.error("Error deleting service:", error);
    } finally {
      setDeleteServiceId(null);
    }
  };

  // File upload handler
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      return data.url;
    }
    throw new Error("File upload failed");
  };

  // Regulation CRUD
  const handleAddRegulation = async () => {
    if (!newRegulation.name.trim()) return;
    try {
      let documentUrl = newRegulation.document;
      let certificateUrl = newRegulation.certificate;

      // Upload document if selected
      if (documentFile) {
        documentUrl = await uploadFile(documentFile);
      }

      // Upload certificate if selected
      if (certificateFile) {
        certificateUrl = await uploadFile(certificateFile);
      }

      const res = await fetch("/api/regulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRegulation,
          document: documentUrl,
          certificate: certificateUrl,
          status: "Subscribed",
        }),
      });
      if (res.ok) {
        const reg = await res.json();
        setRegulations([...regulations, reg]);
        setNewRegulation({
          name: "",
          version: "",
          sa1Date: "",
          sa2Date: "",
          scope: "",
          exclusionJustification: "",
          document: "",
          certificate: "",
        });
        setDocumentFile(null);
        setCertificateFile(null);
        setIsAddRegulationOpen(false);
      }
    } catch (error) {
      console.error("Error adding regulation:", error);
    }
  };

  const handleEditRegulation = async () => {
    if (!editingRegulation) return;
    try {
      let documentUrl = editingRegulation.document;
      let certificateUrl = editingRegulation.certificate;

      // Upload new document if selected
      if (editDocumentFile) {
        documentUrl = await uploadFile(editDocumentFile);
      }

      // Upload new certificate if selected
      if (editCertificateFile) {
        certificateUrl = await uploadFile(editCertificateFile);
      }

      const res = await fetch(`/api/regulations/${editingRegulation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingRegulation,
          document: documentUrl,
          certificate: certificateUrl,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRegulations(regulations.map((r) => (r.id === updated.id ? updated : r)));
        setIsEditRegulationOpen(false);
        setEditingRegulation(null);
        setEditDocumentFile(null);
        setEditCertificateFile(null);
      }
    } catch (error) {
      console.error("Error updating regulation:", error);
    }
  };

  const handleDeleteRegulation = (id: string) => {
    setDeleteRegulationId(id);
  };

  const confirmDeleteRegulation = async () => {
    if (!deleteRegulationId) return;
    try {
      const res = await fetch(`/api/regulations/${deleteRegulationId}`, { method: "DELETE" });
      if (res.ok) {
        setRegulations(regulations.filter((r) => r.id !== deleteRegulationId));
      }
    } catch (error) {
      console.error("Error deleting regulation:", error);
    } finally {
      setDeleteRegulationId(null);
    }
  };

  // Add new service category
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (!serviceCategories.includes(newCategoryName)) {
      setServiceCategories([...serviceCategories, newCategoryName]);
      setNewService({ ...newService, serviceCategory: newCategoryName });
    }
    setNewCategoryName("");
    setIsAddCategoryOpen(false);
  };

  // Add new service item
  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    if (!serviceItems.includes(newItemName)) {
      setServiceItems([...serviceItems, newItemName]);
      setNewService({ ...newService, serviceItem: newItemName });
    }
    setNewItemName("");
    setIsAddItemOpen(false);
  };

  // Edit organization via wizard
  const handleSaveOrganization = async (data: Organization) => {
    try {
      const res = await fetch(`/api/organization`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrganization(updated);
      }
    } catch (error) {
      console.error("Error updating organization:", error);
      throw error;
    }
  };

  // Open edit organization wizard
  const openEditOrganization = () => {
    setIsEditProfileWizardOpen(true);
  };

  // Department columns
  const departmentColumns: ColumnDef<Department>[] = [
    {
      accessorKey: "name",
      header: "Department Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingDepartment(row.original);
              setIsEditDepartmentOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => handleDeleteDepartment(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Regulation columns
  const regulationColumns: ColumnDef<Regulation>[] = [
    {
      accessorKey: "name",
      header: "Regulation Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "version",
      header: "Version",
    },
    {
      accessorKey: "status",
      header: "Compliance Status",
      cell: ({ row }) => (
        <span className="text-grc-primary">{row.getValue("status")}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingRegulation(row.original);
              setIsEditRegulationOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => handleDeleteRegulation(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="regulations">Regulations</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="orgchart">Organization Chart</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Organization Information</CardTitle>
              {organization ? (
                <Button variant="outline" size="sm" onClick={openEditOrganization}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <Button size="sm" onClick={openEditOrganization}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Profile
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {organization ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <Label className="text-muted-foreground">Established Date</Label>
                      <p className="font-medium">{organization.establishedDate || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Employee Count</Label>
                      <p className="font-medium">{organization.employeeCount}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Branch Count</Label>
                      <p className="font-medium">{organization.branchCount}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Head Office Location</Label>
                      <p className="font-medium">{organization.headOfficeLocation || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Head Office Address</Label>
                      <p className="font-medium">{organization.headOfficeAddress || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Website</Label>
                      <p className="font-medium text-grc-link">{organization.website || "-"}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-muted-foreground font-semibold">{organization.name}</Label>
                      <p className="text-sm mt-1">{organization.description || "-"}</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">Vision</Label>
                        <p className="text-sm">{organization.vision || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Mission</Label>
                        <p className="text-sm">{organization.mission || "-"}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <Plus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Profile Added</h3>
                  <p className="text-muted-foreground mb-4 max-w-md">
                    Create your organization profile to display company information, vision, mission, and more.
                  </p>
                  <Button onClick={openEditOrganization}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <div className="flex justify-between items-center">
            <Input placeholder="Search services..." className="max-w-sm" />
            <Button onClick={() => setIsAddServiceOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <Card key={service.id}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">{service.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {service.serviceUser}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingService(service);
                        setIsEditServiceOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDeleteService(service.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Item: </span>
                      <span>{service.serviceItem}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Category: </span>
                      <span>{service.serviceCategory}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Regulations Tab */}
        <TabsContent value="regulations" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setIsAddRegulationOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Regulation
            </Button>
          </div>
          <DataGrid
            columns={regulationColumns}
            data={regulations}
            searchPlaceholder="Search by name..."
          />
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setIsAddDepartmentOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
          <DataGrid
            columns={departmentColumns}
            data={departments}
            searchPlaceholder="Search by name..."
            showColumnSelector
          />
        </TabsContent>

        {/* Organization Chart Tab */}
        <TabsContent value="orgchart" className="space-y-6">
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center">
                {/* CEO */}
                <div className="bg-grc-primary text-white px-6 py-3 rounded-lg text-center">
                  <p className="font-medium">CEO</p>
                  <p className="text-sm">John Doe</p>
                </div>
                {/* Connection line */}
                <div className="w-px h-8 bg-border" />
                {/* Second level */}
                <div className="flex gap-8">
                  <div className="flex flex-col items-center">
                    <div className="bg-grc-bg border px-4 py-2 rounded-lg text-center">
                      <p className="font-medium text-sm">CTO</p>
                      <p className="text-xs text-muted-foreground">Tech Lead</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="bg-grc-bg border px-4 py-2 rounded-lg text-center">
                      <p className="font-medium text-sm">CFO</p>
                      <p className="text-xs text-muted-foreground">Finance Lead</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="bg-grc-bg border px-4 py-2 rounded-lg text-center">
                      <p className="font-medium text-sm">COO</p>
                      <p className="text-xs text-muted-foreground">Operations Lead</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-center text-muted-foreground mt-8">
                Full organization chart visualization coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Department Dialog */}
      <Dialog open={isAddDepartmentOpen} onOpenChange={setIsAddDepartmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="departmentName">Department Name</Label>
            <Input
              id="departmentName"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              placeholder="Enter department name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDepartmentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDepartment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={isEditDepartmentOpen} onOpenChange={setIsEditDepartmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          {editingDepartment && (
            <div className="py-4">
              <Label htmlFor="editDepartmentName">Department Name</Label>
              <Input
                id="editDepartmentName"
                value={editingDepartment.name}
                onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })}
                placeholder="Enter department name"
                className="mt-2"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDepartmentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditDepartment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Service Dialog */}
      <Dialog open={isAddServiceOpen} onOpenChange={setIsAddServiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="serviceTitle">Title</Label>
              <Input
                id="serviceTitle"
                value={newService.title}
                onChange={(e) => setNewService({ ...newService, title: e.target.value })}
                placeholder="Enter service title"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="serviceDescription">Description</Label>
              <Input
                id="serviceDescription"
                value={newService.description}
                onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                placeholder="Enter description"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Service User</Label>
              <div className="flex gap-4 mt-2">
                {["Internal", "External", "Public"].map((userType) => (
                  <div key={userType} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`add-${userType}`}
                      name="addServiceUser"
                      checked={newService.serviceUser === userType}
                      onChange={() =>
                        setNewService({ ...newService, serviceUser: userType })
                      }
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`add-${userType}`} className="font-normal">
                      {userType}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Service Category</Label>
              <div className="flex gap-2 mt-2">
                <Select
                  value={newService.serviceCategory}
                  onValueChange={(value) => setNewService({ ...newService, serviceCategory: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  onClick={() => setIsAddCategoryOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Service Item</Label>
              <div className="flex gap-2 mt-2">
                <Select
                  value={newService.serviceItem}
                  onValueChange={(value) => setNewService({ ...newService, serviceItem: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceItems.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  onClick={() => setIsAddItemOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddServiceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddService}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={isEditServiceOpen} onOpenChange={setIsEditServiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>
          {editingService && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="editServiceTitle">Title</Label>
                <Input
                  id="editServiceTitle"
                  value={editingService.title}
                  onChange={(e) =>
                    setEditingService({ ...editingService, title: e.target.value })
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="editServiceDescription">Description</Label>
                <Input
                  id="editServiceDescription"
                  value={editingService.description || ""}
                  onChange={(e) =>
                    setEditingService({ ...editingService, description: e.target.value })
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Service User</Label>
                <div className="flex gap-4 mt-2">
                  {["Internal", "External", "Public"].map((userType) => (
                    <div key={userType} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`edit-${userType}`}
                        name="editServiceUser"
                        checked={editingService.serviceUser === userType}
                        onChange={() =>
                          setEditingService({ ...editingService, serviceUser: userType })
                        }
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`edit-${userType}`} className="font-normal">
                        {userType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Service Category</Label>
                <div className="flex gap-2 mt-2">
                  <Select
                    value={editingService.serviceCategory}
                    onValueChange={(value) =>
                      setEditingService({ ...editingService, serviceCategory: value })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => setIsAddCategoryOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Service Item</Label>
                <div className="flex gap-2 mt-2">
                  <Select
                    value={editingService.serviceItem}
                    onValueChange={(value) =>
                      setEditingService({ ...editingService, serviceItem: value })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceItems.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => setIsAddItemOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditServiceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditService}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Regulation Dialog */}
      <Dialog open={isAddRegulationOpen} onOpenChange={setIsAddRegulationOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Regulation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="regulationName">Regulation Name *</Label>
                <Input
                  id="regulationName"
                  value={newRegulation.name}
                  onChange={(e) => setNewRegulation({ ...newRegulation, name: e.target.value })}
                  placeholder="Enter regulation name"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="regulationVersion">Version *</Label>
                <Input
                  id="regulationVersion"
                  value={newRegulation.version}
                  onChange={(e) => setNewRegulation({ ...newRegulation, version: e.target.value })}
                  placeholder="Enter version"
                  className="mt-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sa1Date">SA1 Date</Label>
                <Input
                  id="sa1Date"
                  type="date"
                  value={newRegulation.sa1Date}
                  onChange={(e) => setNewRegulation({ ...newRegulation, sa1Date: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="sa2Date">SA2 Date</Label>
                <Input
                  id="sa2Date"
                  type="date"
                  value={newRegulation.sa2Date}
                  onChange={(e) => setNewRegulation({ ...newRegulation, sa2Date: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="scope">Scope</Label>
              <Textarea
                id="scope"
                value={newRegulation.scope}
                onChange={(e) => setNewRegulation({ ...newRegulation, scope: e.target.value })}
                placeholder="Enter scope"
                className="mt-2"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="exclusionJustification">Exclusion and Justification</Label>
              <Textarea
                id="exclusionJustification"
                value={newRegulation.exclusionJustification}
                onChange={(e) => setNewRegulation({ ...newRegulation, exclusionJustification: e.target.value })}
                placeholder="Enter exclusion and justification"
                className="mt-2"
                rows={3}
              />
            </div>
            <div>
              <Label>Document</Label>
              <div className="mt-2 border-2 border-dashed rounded-lg p-4">
                {documentFile ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{documentFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDocumentFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click here, or drop files here to upload</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setDocumentFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <div>
              <Label>Certificate</Label>
              <div className="mt-2 border-2 border-dashed rounded-lg p-4">
                {certificateFile ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{certificateFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setCertificateFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click here, or drop files here to upload</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setCertificateFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRegulationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRegulation}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Regulation Dialog */}
      <Dialog open={isEditRegulationOpen} onOpenChange={setIsEditRegulationOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Regulation</DialogTitle>
          </DialogHeader>
          {editingRegulation && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editRegulationName">Regulation Name *</Label>
                  <Input
                    id="editRegulationName"
                    value={editingRegulation.name}
                    onChange={(e) => setEditingRegulation({ ...editingRegulation, name: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="editRegulationVersion">Version *</Label>
                  <Input
                    id="editRegulationVersion"
                    value={editingRegulation.version}
                    onChange={(e) => setEditingRegulation({ ...editingRegulation, version: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editSa1Date">SA1 Date</Label>
                  <Input
                    id="editSa1Date"
                    type="date"
                    value={editingRegulation.sa1Date}
                    onChange={(e) => setEditingRegulation({ ...editingRegulation, sa1Date: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="editSa2Date">SA2 Date</Label>
                  <Input
                    id="editSa2Date"
                    type="date"
                    value={editingRegulation.sa2Date}
                    onChange={(e) => setEditingRegulation({ ...editingRegulation, sa2Date: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="editScope">Scope</Label>
                <Textarea
                  id="editScope"
                  value={editingRegulation.scope}
                  onChange={(e) => setEditingRegulation({ ...editingRegulation, scope: e.target.value })}
                  className="mt-2"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="editExclusionJustification">Exclusion and Justification</Label>
                <Textarea
                  id="editExclusionJustification"
                  value={editingRegulation.exclusionJustification}
                  onChange={(e) => setEditingRegulation({ ...editingRegulation, exclusionJustification: e.target.value })}
                  className="mt-2"
                  rows={3}
                />
              </div>
              <div>
                <Label>Document</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-4">
                  {editDocumentFile ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{editDocumentFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditDocumentFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : editingRegulation.document ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current: {editingRegulation.document.split("/").pop()}</span>
                      <label className="cursor-pointer text-sm text-primary hover:underline">
                        Replace
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setEditDocumentFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click here, or drop files here to upload</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setEditDocumentFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <Label>Certificate</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-4">
                  {editCertificateFile ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{editCertificateFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditCertificateFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : editingRegulation.certificate ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current: {editingRegulation.certificate.split("/").pop()}</span>
                      <label className="cursor-pointer text-sm text-primary hover:underline">
                        Replace
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setEditCertificateFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click here, or drop files here to upload</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setEditCertificateFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRegulationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRegulation}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Service Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service Category</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="categoryName">Category Name</Label>
            <Input
              id="categoryName"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Enter category name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Service Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service Item</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="itemName">Item Name</Label>
            <Input
              id="itemName"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Enter item name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Wizard */}
      <EditProfileWizard
        open={isEditProfileWizardOpen}
        onOpenChange={setIsEditProfileWizardOpen}
        organization={organization}
        onSave={handleSaveOrganization}
      />

      {/* Delete Department Confirmation */}
      <AlertDialog open={!!deleteDepartmentId} onOpenChange={(open) => !open && setDeleteDepartmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this department? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDepartment}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Service Confirmation */}
      <AlertDialog open={!!deleteServiceId} onOpenChange={(open) => !open && setDeleteServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteService}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsubscribe Regulation Confirmation */}
      <AlertDialog open={!!deleteRegulationId} onOpenChange={(open) => !open && setDeleteRegulationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsubscribe from Regulation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unsubscribe from this regulation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRegulation}>Unsubscribe</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
