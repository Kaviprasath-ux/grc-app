"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Pencil, Trash2, Upload, X, Building2, Users, MapPin, Globe, Calendar, Target, Eye, Briefcase, Scale, ArrowLeft, Home, ChevronRight, Download, FileText } from "lucide-react";
import Link from "next/link";
import { DataGrid } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { OrgChart } from "@/components/organization/org-chart";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";

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

interface RegulationAttachment {
  id: string;
  type: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedAt: string;
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
  attachments?: RegulationAttachment[];
}

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const initialTab = searchParams.get("tab") || "overview";
  const fromDashboard = searchParams.get("from") === "dashboard";
  const [activeTab, setActiveTab] = useState(initialTab);
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

  // Service categories and items (derived from existing services)
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [serviceItems, setServiceItems] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemName, setNewItemName] = useState("");

  // Form states
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newService, setNewService] = useState({
    title: "",
    description: "",
    serviceUser: "Internal",
    serviceCategory: "",
    serviceItem: "",
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
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [certificateFiles, setCertificateFiles] = useState<File[]>([]);
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
      if (servRes.ok) {
        const servicesData = await servRes.json();
        setServices(servicesData);
        const categories = [...new Set(servicesData.map((s: Service) => s.serviceCategory).filter(Boolean))] as string[];
        const items = [...new Set(servicesData.map((s: Service) => s.serviceItem).filter(Boolean))] as string[];
        setServiceCategories(categories);
        setServiceItems(items);
      }
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
          serviceCategory: "",
          serviceItem: "",
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
      return data.file.filePath;
    }
    throw new Error("File upload failed");
  };

  // Upload file as regulation attachment
  const uploadRegulationAttachment = async (regulationId: string, file: File, type: "document" | "certificate") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    const res = await fetch(`/api/regulations/${regulationId}/attachments`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload attachment");
    return res.json();
  };

  // Delete regulation attachment
  const deleteRegulationAttachment = async (regulationId: string, attachmentId: string) => {
    const res = await fetch(`/api/regulations/${regulationId}/attachments?attachmentId=${attachmentId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete attachment");
    // Refresh regulations to get updated attachments
    const regRes = await fetch("/api/regulations");
    if (regRes.ok) setRegulations(await regRes.json());
  };

  // Regulation CRUD
  const handleAddRegulation = async () => {
    if (!newRegulation.name.trim()) return;
    try {
      const res = await fetch("/api/regulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRegulation,
          status: "Subscribed",
        }),
      });
      if (res.ok) {
        const reg = await res.json();

        // Upload document files as attachments
        for (const file of documentFiles) {
          await uploadRegulationAttachment(reg.id, file, "document");
        }
        // Upload certificate files as attachments
        for (const file of certificateFiles) {
          await uploadRegulationAttachment(reg.id, file, "certificate");
        }

        // Refresh regulations to get full data with attachments
        const regRes = await fetch("/api/regulations");
        if (regRes.ok) setRegulations(await regRes.json());

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
        setDocumentFiles([]);
        setCertificateFiles([]);
        setIsAddRegulationOpen(false);
      }
    } catch (error) {
      console.error("Error adding regulation:", error);
    }
  };

  const handleEditRegulation = async () => {
    if (!editingRegulation) return;
    try {
      const res = await fetch(`/api/regulations/${editingRegulation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRegulation),
      });
      if (res.ok) {
        const updated = await res.json();
        setRegulations(regulations.map((r) => (r.id === updated.id ? updated : r)));
        setIsEditRegulationOpen(false);
        setEditingRegulation(null);
      }
    } catch (error) {
      console.error("Error updating regulation:", error);
    }
  };

  // Upload file for editing regulation and refresh
  const handleEditRegulationUpload = async (files: FileList, type: "document" | "certificate") => {
    if (!editingRegulation) return;
    for (let i = 0; i < files.length; i++) {
      await uploadRegulationAttachment(editingRegulation.id, files[i], type);
    }
    // Refresh regulations and update editing regulation
    const regRes = await fetch("/api/regulations");
    if (regRes.ok) {
      const allRegs = await regRes.json();
      setRegulations(allRegs);
      const updated = allRegs.find((r: Regulation) => r.id === editingRegulation.id);
      if (updated) setEditingRegulation(updated);
    }
  };

  // Remove attachment from editing regulation
  const handleEditRegulationRemoveAttachment = async (attachmentId: string) => {
    if (!editingRegulation) return;
    await deleteRegulationAttachment(editingRegulation.id, attachmentId);
    // Refresh editing regulation
    const regRes = await fetch("/api/regulations");
    if (regRes.ok) {
      const allRegs = await regRes.json();
      setRegulations(allRegs);
      const updated = allRegs.find((r: Regulation) => r.id === editingRegulation.id);
      if (updated) setEditingRegulation(updated);
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
      header: t("Department Name"),
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("name")}</span>,
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
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
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
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
      header: t("Regulation Name"),
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "version",
      header: t("Version"),
      cell: ({ row }) => <span className="text-slate-600">{row.getValue("version")}</span>,
    },
    {
      accessorKey: "status",
      header: t("Compliance Status"),
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-compliance-compliant-bg text-semantic-success-dark">
          {row.getValue("status")}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
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
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
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
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading profile...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Profile")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Organization Profile")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{t("Company Info")}</TabsTrigger>
          <TabsTrigger value="services">{t("Services")}</TabsTrigger>
          <TabsTrigger value="regulations">{t("Regulations")}</TabsTrigger>
          <TabsTrigger value="departments">{t("Departments")}</TabsTrigger>
          <TabsTrigger value="orgchart">{t("Organization Chart")}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          {organization ? (
            <div className="bg-white rounded-xl border border-slate-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-800">{t("Organization Information")}</h3>
                <Button variant="outline" size="sm" onClick={openEditOrganization}>
                  <Pencil className="h-4 w-4 me-2" />
                  {t("Edit")}
                </Button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-6">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Organization Name")}</p>
                    <p className="text-sm font-medium text-slate-800">{organization.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Established Date")}</p>
                    <p className="text-sm font-medium text-slate-800">{organization.establishedDate || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Employee Count")}</p>
                    <p className="text-sm font-medium text-slate-800">{organization.employeeCount?.toLocaleString() || "0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Branch Count")}</p>
                    <p className="text-sm font-medium text-slate-800">{organization.branchCount || "0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Head Office Location")}</p>
                    <p className="text-sm font-medium text-slate-800">{organization.headOfficeLocation || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Head Office Address")}</p>
                    <p className="text-sm font-medium text-slate-800">{organization.headOfficeAddress || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Website")}</p>
                    <p className="text-sm font-medium text-primary-600">{organization.website || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Email")}</p>
                    <p className="text-sm font-medium text-slate-800">{organization.email || "-"}</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 my-6"></div>

                {/* Description */}
                <div className="mb-6">
                  <p className="text-xs text-slate-500 mb-1">{t("Description")}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{organization.description || "-"}</p>
                </div>

                {/* Vision & Mission */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Vision")}</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{organization.vision || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t("Mission")}</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{organization.mission || "-"}</p>
                  </div>
                </div>

                {/* Brochure */}
                {organization.brochure && (
                  <>
                    <div className="border-t border-slate-100 my-6"></div>
                    <div>
                      <p className="text-xs text-slate-500 mb-2">{t("Brochure")}</p>
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 w-fit">
                        <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-700">{organization.brochure.split("/").pop()}</span>
                        <a href={organization.brochure} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </a>
                        <a href={organization.brochure} download>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Profile")}</h3>
              <p className="text-sm text-slate-500 mb-6">
                {t("Create your organization profile to get started.")}
              </p>
              <Button onClick={openEditOrganization}>
                <Plus className="h-4 w-4 me-2" />
                {t("Create Profile")}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="mt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">{t("Services")}</h3>
            <Button size="sm" onClick={() => setIsAddServiceOpen(true)}>
              <Plus className="h-4 w-4 me-2" />
              {t("Add Service")}
            </Button>
          </div>

          {services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div key={service.id} className="bg-white rounded-xl border border-slate-200 p-5">
                  {/* Header with actions */}
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-800">{service.title}</h4>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                        onClick={() => {
                          setEditingService(service);
                          setIsEditServiceOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-semantic-error"
                        onClick={() => handleDeleteService(service.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{t("User Type")}</span>
                      <span className="font-medium text-slate-700">{service.serviceUser}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{t("Category")}</span>
                      <span className="font-medium text-slate-700">{service.serviceCategory}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{t("Item")}</span>
                      <span className="font-medium text-slate-700">{service.serviceItem}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Services")}</h3>
              <p className="text-sm text-slate-500 mb-6">
                {t("Add services your organization provides.")}
              </p>
              <Button onClick={() => setIsAddServiceOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("Add Service")}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Regulations Tab */}
        <TabsContent value="regulations" className="mt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">{t("Regulations")}</h3>
            <Button size="sm" onClick={() => setIsAddRegulationOpen(true)}>
              <Plus className="h-4 w-4 me-2" />
              {t("Add Regulation")}
            </Button>
          </div>

          {regulations.length > 0 ? (
            <DataGrid
              columns={regulationColumns}
              data={regulations}
              searchPlaceholder={t("Search regulations...")}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Scale className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Regulations")}</h3>
              <p className="text-sm text-slate-500 mb-6">
                {t("Add regulations that apply to your organization.")}
              </p>
              <Button onClick={() => setIsAddRegulationOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("Add Regulation")}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="mt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">{t("Departments")}</h3>
            <Button size="sm" onClick={() => setIsAddDepartmentOpen(true)}>
              <Plus className="h-4 w-4 me-2" />
              {t("Add Department")}
            </Button>
          </div>

          {departments.length > 0 ? (
            <DataGrid
              columns={departmentColumns}
              data={departments}
              searchPlaceholder={t("Search departments...")}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Departments")}</h3>
              <p className="text-sm text-slate-500 mb-6">
                {t("Add departments to organize your team structure.")}
              </p>
              <Button onClick={() => setIsAddDepartmentOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("Add Department")}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Organization Chart Tab */}
        <TabsContent value="orgchart" className="mt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">{t("Organization Structure")}</h3>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <OrgChart />
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Department Dialog */}
      <Dialog open={isAddDepartmentOpen} onOpenChange={setIsAddDepartmentOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Department")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <Label className="text-sm font-medium text-slate-700">{t("Department Name")}</Label>
            <Input
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              placeholder={t("Enter department name")}
              className="mt-1.5"
            />
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddDepartmentOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddDepartment}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={isEditDepartmentOpen} onOpenChange={setIsEditDepartmentOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Department")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          {editingDepartment && (
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700">{t("Department Name")}</Label>
              <Input
                value={editingDepartment.name}
                onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })}
                placeholder={t("Enter department name")}
                className="mt-1.5"
              />
            </div>
          )}

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditDepartmentOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditDepartment}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Service Dialog */}
      <Dialog open={isAddServiceOpen} onOpenChange={setIsAddServiceOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Service")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            {/* Service Title */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Service Title")}</Label>
              <Input
                value={newService.title}
                onChange={(e) => setNewService({ ...newService, title: e.target.value })}
                placeholder={t("Enter service title")}
                className="mt-1.5"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                value={newService.description}
                onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                placeholder={t("Enter service description")}
                className="mt-1.5"
                rows={3}
              />
            </div>

            {/* Service User */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Service User")}</Label>
              <div className="flex gap-6 mt-2">
                {["Internal", "External", "Public"].map((userType) => (
                  <label key={userType} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="addServiceUser"
                      checked={newService.serviceUser === userType}
                      onChange={() => setNewService({ ...newService, serviceUser: userType })}
                      className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-600">{t(userType)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Service Category */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Service Category")}</Label>
              <div className="flex gap-2 mt-1.5">
                <Select
                  value={newService.serviceCategory}
                  onValueChange={(value) => setNewService({ ...newService, serviceCategory: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("Select category")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {serviceCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Service Item */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Service Item")}</Label>
              <div className="flex gap-2 mt-1.5">
                <Select
                  value={newService.serviceItem}
                  onValueChange={(value) => setNewService({ ...newService, serviceItem: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("Select item")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {serviceItems.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsAddItemOpen(true)}
                  className="flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddServiceOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddService}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={isEditServiceOpen} onOpenChange={setIsEditServiceOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Service")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          {editingService && (
            <div className="px-6 py-6 space-y-5">
              {/* Service Title */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Service Title")}</Label>
                <Input
                  value={editingService.title}
                  onChange={(e) => setEditingService({ ...editingService, title: e.target.value })}
                  placeholder={t("Enter service title")}
                  className="mt-1.5"
                />
              </div>

              {/* Description */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                <Textarea
                  value={editingService.description || ""}
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  placeholder={t("Enter service description")}
                  className="mt-1.5"
                  rows={3}
                />
              </div>

              {/* Service User */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Service User")}</Label>
                <div className="flex gap-6 mt-2">
                  {["Internal", "External", "Public"].map((userType) => (
                    <label key={userType} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editServiceUser"
                        checked={editingService.serviceUser === userType}
                        onChange={() => setEditingService({ ...editingService, serviceUser: userType })}
                        className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
                      />
                      <span className="text-sm text-slate-600">{t(userType)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Service Category */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Service Category")}</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={editingService.serviceCategory}
                    onValueChange={(value) => setEditingService({ ...editingService, serviceCategory: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t("Select category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {serviceCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsAddCategoryOpen(true)}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Service Item */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Service Item")}</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select
                    value={editingService.serviceItem}
                    onValueChange={(value) => setEditingService({ ...editingService, serviceItem: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t("Select item")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {serviceItems.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsAddItemOpen(true)}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditServiceOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditService}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Regulation Dialog */}
      <Dialog open={isAddRegulationOpen} onOpenChange={setIsAddRegulationOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Regulation")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              {/* Name and Version */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Regulation Name")} <span className="text-error">*</span></Label>
                  <Input
                    value={newRegulation.name}
                    onChange={(e) => setNewRegulation({ ...newRegulation, name: e.target.value })}
                    placeholder={t("Enter regulation name")}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Version")} <span className="text-error">*</span></Label>
                  <Input
                    value={newRegulation.version}
                    onChange={(e) => setNewRegulation({ ...newRegulation, version: e.target.value })}
                    placeholder={t("Enter version")}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* SA1 and SA2 Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("SA1 Date")}</Label>
                  <div className="mt-1.5">
                    <DatePicker
                      value={newRegulation.sa1Date}
                      onChange={(date) => setNewRegulation({ ...newRegulation, sa1Date: date ? format(date, "yyyy-MM-dd") : "" })}
                      placeholder={t("Select SA1 date")}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("SA2 Date")}</Label>
                  <div className="mt-1.5">
                    <DatePicker
                      value={newRegulation.sa2Date}
                      onChange={(date) => setNewRegulation({ ...newRegulation, sa2Date: date ? format(date, "yyyy-MM-dd") : "" })}
                      placeholder={t("Select SA2 date")}
                    />
                  </div>
                </div>
              </div>

              {/* Scope */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Scope")}</Label>
                <Textarea
                  value={newRegulation.scope}
                  onChange={(e) => setNewRegulation({ ...newRegulation, scope: e.target.value })}
                  placeholder={t("Enter scope")}
                  className="mt-1.5"
                  rows={3}
                />
              </div>

              {/* Exclusion and Justification */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Exclusion and Justification")}</Label>
                <Textarea
                  value={newRegulation.exclusionJustification}
                  onChange={(e) => setNewRegulation({ ...newRegulation, exclusionJustification: e.target.value })}
                  placeholder={t("Enter exclusion and justification")}
                  className="mt-1.5"
                  rows={3}
                />
              </div>

              {/* Document Upload */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Documents")}</Label>
                <div className="mt-1.5 space-y-2">
                  {documentFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600 flex-1 truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-semantic-error flex-shrink-0"
                        onClick={() => setDocumentFiles(documentFiles.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <label className="flex flex-col items-center cursor-pointer py-3 border border-dashed border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                    <Upload className="h-5 w-5 text-slate-300 mb-1" />
                    <span className="text-sm text-slate-500">{t("Click to upload documents")}</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          setDocumentFiles([...documentFiles, ...Array.from(e.target.files)]);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Certificate Upload */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Certificates")}</Label>
                <div className="mt-1.5 space-y-2">
                  {certificateFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600 flex-1 truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-semantic-error flex-shrink-0"
                        onClick={() => setCertificateFiles(certificateFiles.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <label className="flex flex-col items-center cursor-pointer py-3 border border-dashed border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                    <Upload className="h-5 w-5 text-slate-300 mb-1" />
                    <span className="text-sm text-slate-500">{t("Click to upload certificates")}</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          setCertificateFiles([...certificateFiles, ...Array.from(e.target.files)]);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddRegulationOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddRegulation}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Regulation Dialog */}
      <Dialog open={isEditRegulationOpen} onOpenChange={setIsEditRegulationOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Regulation")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          {editingRegulation && (
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-5">
                {/* Name and Version */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Regulation Name")} <span className="text-error">*</span></Label>
                    <Input
                      value={editingRegulation.name}
                      onChange={(e) => setEditingRegulation({ ...editingRegulation, name: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Version")} <span className="text-error">*</span></Label>
                    <Input
                      value={editingRegulation.version}
                      onChange={(e) => setEditingRegulation({ ...editingRegulation, version: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                {/* SA1 and SA2 Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("SA1 Date")}</Label>
                    <div className="mt-1.5">
                      <DatePicker
                        value={editingRegulation.sa1Date}
                        onChange={(date) => setEditingRegulation({ ...editingRegulation, sa1Date: date ? format(date, "yyyy-MM-dd") : "" })}
                        placeholder={t("Select SA1 date")}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("SA2 Date")}</Label>
                    <div className="mt-1.5">
                      <DatePicker
                        value={editingRegulation.sa2Date}
                        onChange={(date) => setEditingRegulation({ ...editingRegulation, sa2Date: date ? format(date, "yyyy-MM-dd") : "" })}
                        placeholder={t("Select SA2 date")}
                      />
                    </div>
                  </div>
                </div>

                {/* Scope */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Scope")}</Label>
                  <Textarea
                    value={editingRegulation.scope}
                    onChange={(e) => setEditingRegulation({ ...editingRegulation, scope: e.target.value })}
                    placeholder={t("Enter scope")}
                    className="mt-1.5"
                    rows={3}
                  />
                </div>

                {/* Exclusion and Justification */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Exclusion and Justification")}</Label>
                  <Textarea
                    value={editingRegulation.exclusionJustification}
                    onChange={(e) => setEditingRegulation({ ...editingRegulation, exclusionJustification: e.target.value })}
                    placeholder={t("Enter exclusion and justification")}
                    className="mt-1.5"
                    rows={3}
                  />
                </div>

                {/* Document Attachments */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Documents")}</Label>
                  <div className="mt-1.5 space-y-2">
                    {editingRegulation.attachments?.filter(a => a.type === "document").map((att) => (
                      <div key={att.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-600 flex-1 truncate">{att.fileName}</span>
                        <a href={att.filePath} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <a href={att.filePath} download>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-semantic-error flex-shrink-0"
                          onClick={() => handleEditRegulationRemoveAttachment(att.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <label className="flex flex-col items-center cursor-pointer py-3 border border-dashed border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                      <Upload className="h-5 w-5 text-slate-300 mb-1" />
                      <span className="text-sm text-slate-500">{t("Click to upload documents")}</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            handleEditRegulationUpload(e.target.files, "document");
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Certificate Attachments */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Certificates")}</Label>
                  <div className="mt-1.5 space-y-2">
                    {editingRegulation.attachments?.filter(a => a.type === "certificate").map((att) => (
                      <div key={att.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-600 flex-1 truncate">{att.fileName}</span>
                        <a href={att.filePath} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <a href={att.filePath} download>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-semantic-error flex-shrink-0"
                          onClick={() => handleEditRegulationRemoveAttachment(att.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <label className="flex flex-col items-center cursor-pointer py-3 border border-dashed border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                      <Upload className="h-5 w-5 text-slate-300 mb-1" />
                      <span className="text-sm text-slate-500">{t("Click to upload certificates")}</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            handleEditRegulationUpload(e.target.files, "certificate");
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditRegulationOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditRegulation}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Service Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Service Category")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <Label className="text-sm font-medium text-slate-700">{t("Category Name")}</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t("Enter category name")}
              className="mt-1.5"
            />
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddCategory}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Service Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Service Item")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <Label className="text-sm font-medium text-slate-700">{t("Item Name")}</Label>
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={t("Enter item name")}
              className="mt-1.5"
            />
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddItem}>{t("Save")}</Button>
          </div>
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
            <AlertDialogTitle>{t("Delete Department")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this department? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDepartment}>{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Service Confirmation */}
      <AlertDialog open={!!deleteServiceId} onOpenChange={(open) => !open && setDeleteServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Service")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this service? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteService}>{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsubscribe Regulation Confirmation */}
      <AlertDialog open={!!deleteRegulationId} onOpenChange={(open) => !open && setDeleteRegulationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Unsubscribe from Regulation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to unsubscribe from this regulation? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRegulation}>{t("Unsubscribe")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingFallback() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
          <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
        <p className="text-sm text-slate-500 font-medium">{t("Loading profile...")}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProfilePageContent />
    </Suspense>
  );
}
