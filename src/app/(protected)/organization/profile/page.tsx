"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ColumnDef } from "@tanstack/react-table";

interface Organization {
  id: string;
  name: string;
  establishedDate: string;
  employeeCount: number;
  branchCount: number;
  headOfficeLocation: string;
  headOfficeAddress: string;
  website: string;
  description: string;
  vision: string;
  mission: string;
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

  // Form states
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newService, setNewService] = useState({
    title: "",
    description: "",
    serviceUser: "External",
    serviceCategory: "consulting",
    serviceItem: "Advisory",
  });
  const [newRegulationName, setNewRegulationName] = useState("");

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

      if (orgRes.ok) setOrganization(await orgRes.json());
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

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    try {
      const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDepartments(departments.filter((d) => d.id !== id));
      }
    } catch (error) {
      console.error("Error deleting department:", error);
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
          serviceUser: "External",
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

  const handleDeleteService = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (res.ok) {
        setServices(services.filter((s) => s.id !== id));
      }
    } catch (error) {
      console.error("Error deleting service:", error);
    }
  };

  // Regulation CRUD
  const handleAddRegulation = async () => {
    if (!newRegulationName.trim()) return;
    try {
      const res = await fetch("/api/regulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRegulationName, status: "Subscribed" }),
      });
      if (res.ok) {
        const reg = await res.json();
        setRegulations([...regulations, reg]);
        setNewRegulationName("");
        setIsAddRegulationOpen(false);
      }
    } catch (error) {
      console.error("Error adding regulation:", error);
    }
  };

  const handleDeleteRegulation = async (id: string) => {
    if (!confirm("Are you sure you want to unsubscribe from this regulation?")) return;
    try {
      const res = await fetch(`/api/regulations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRegulations(regulations.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error("Error deleting regulation:", error);
    }
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
          <Button variant="ghost" size="icon">
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
          <Button variant="outline" size="sm">
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => handleDeleteRegulation(row.original.id)}
          >
            Unsubscribe
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
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              {organization && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">Organization Name</Label>
                        <p className="font-medium">{organization.name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Established Date</Label>
                        <p className="font-medium">{organization.establishedDate}</p>
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
                        <Label className="text-muted-foreground">Website</Label>
                        <p className="font-medium text-grc-link">{organization.website}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">Head Office Location</Label>
                        <p className="font-medium">{organization.headOfficeLocation}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Head Office Address</Label>
                        <p className="font-medium">{organization.headOfficeAddress}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="font-medium">{organization.description}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Vision</Label>
                      <p className="font-medium">{organization.vision}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Mission</Label>
                      <p className="font-medium">{organization.mission}</p>
                    </div>
                  </div>
                </>
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
              <Select
                value={newService.serviceUser}
                onValueChange={(value) => setNewService({ ...newService, serviceUser: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Internal">Internal</SelectItem>
                  <SelectItem value="External">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Category</Label>
              <Select
                value={newService.serviceCategory}
                onValueChange={(value) => setNewService({ ...newService, serviceCategory: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="Telecom">Telecom</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Item</Label>
              <Select
                value={newService.serviceItem}
                onValueChange={(value) => setNewService({ ...newService, serviceItem: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Advisory">Advisory</SelectItem>
                  <SelectItem value="Internet">Internet</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                </SelectContent>
              </Select>
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
                <Select
                  value={editingService.serviceUser}
                  onValueChange={(value) =>
                    setEditingService({ ...editingService, serviceUser: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Internal">Internal</SelectItem>
                    <SelectItem value="External">External</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditServiceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditService}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Regulation Dialog */}
      <Dialog open={isAddRegulationOpen} onOpenChange={setIsAddRegulationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Regulation</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="regulationName">Regulation Name</Label>
            <Input
              id="regulationName"
              value={newRegulationName}
              onChange={(e) => setNewRegulationName(e.target.value)}
              placeholder="Enter regulation name (e.g., SOC 2)"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRegulationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRegulation}>Subscribe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
