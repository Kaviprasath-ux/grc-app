"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Pencil, Trash2, Upload, X, Building2, Users, MapPin, Globe, Calendar, Target, Eye, Briefcase, Scale, ArrowLeft, Home, ChevronLeft, ChevronRight, Download, FileText, Search } from "lucide-react";
import Link from "next/link";
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
import { EditProfileWizard } from "@/components/profile/edit-profile-wizard";
import { OrgChart } from "@/components/organization/org-chart";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { isValidName } from "@/lib/validations";

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
  const { t, isRTL } = useLanguage();
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
  const [editDepartmentNameError, setEditDepartmentNameError] = useState("");

  // Delete confirmation dialogs
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<string | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [deleteRegulationId, setDeleteRegulationId] = useState<string | null>(null);

  // Service categories and items (derived from existing services)
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [serviceItems, setServiceItems] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [categoryNameError, setCategoryNameError] = useState("");
  const [itemNameError, setItemNameError] = useState("");

  // Search & pagination states
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePage, setServicePage] = useState(1);
  const [regulationSearch, setRegulationSearch] = useState("");
  const [regulationPage, setRegulationPage] = useState(1);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [departmentPage, setDepartmentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Form states
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [departmentNameError, setDepartmentNameError] = useState("");
  const [newService, setNewService] = useState({
    title: "",
    description: "",
    serviceUser: "",
    serviceCategory: "",
    serviceItem: "",
  });
  const [serviceErrors, setServiceErrors] = useState<Record<string, string>>({});
  const [editServiceErrors, setEditServiceErrors] = useState<Record<string, string>>({});
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
  const [regulationErrors, setRegulationErrors] = useState<Record<string, string>>({});
  const [editRegulationErrors, setEditRegulationErrors] = useState<Record<string, string>>({});
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
    if (!newDepartmentName.trim()) { setDepartmentNameError(t("Please enter department name")); return; }
    if (!isValidName(newDepartmentName.trim())) { setDepartmentNameError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setDepartmentNameError("");
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
    if (!editingDepartment || !editingDepartment.name.trim()) { setEditDepartmentNameError(t("Please enter department name")); return; }
    if (!isValidName(editingDepartment.name.trim())) { setEditDepartmentNameError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setEditDepartmentNameError("");
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
    const errors: Record<string, string> = {};
    if (!newService.title.trim()) errors.title = t("Please enter the title");
    else if (!isValidName(newService.title.trim())) errors.title = t("Only letters, numbers, spaces, and hyphens are allowed");
    if (!newService.serviceUser) errors.serviceUser = t("Please select service user");
    if (!newService.serviceCategory) errors.serviceCategory = t("Please select the category");
    if (!newService.serviceItem) errors.serviceItem = t("Please select the service title");
    if (Object.keys(errors).length > 0) {
      setServiceErrors(errors);
      return;
    }
    setServiceErrors({});
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
          serviceUser: "",
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
    const errors: Record<string, string> = {};
    if (!editingService.title.trim()) errors.title = t("Please enter the title");
    else if (!isValidName(editingService.title.trim())) errors.title = t("Only letters, numbers, spaces, and hyphens are allowed");
    if (Object.keys(errors).length > 0) { setEditServiceErrors(errors); return; }
    setEditServiceErrors({});
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
    const errors: Record<string, string> = {};
    if (!newRegulation.name.trim()) errors.name = t("Please enter the name");
    else if (!isValidName(newRegulation.name.trim())) errors.name = t("Only letters, numbers, spaces, and hyphens are allowed");
    if (!newRegulation.version.trim()) errors.version = t("Please enter the version");
    if (Object.keys(errors).length > 0) { setRegulationErrors(errors); return; }
    setRegulationErrors({});
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
    const errors: Record<string, string> = {};
    if (!editingRegulation.name.trim()) errors.name = t("Please enter the name");
    else if (!isValidName(editingRegulation.name.trim())) errors.name = t("Only letters, numbers, spaces, and hyphens are allowed");
    if (!editingRegulation.version.trim()) errors.version = t("Please enter the version");
    if (Object.keys(errors).length > 0) { setEditRegulationErrors(errors); return; }
    setEditRegulationErrors({});
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
    if (!newCategoryName.trim()) { setCategoryNameError(t("Please enter category name")); return; }
    if (!isValidName(newCategoryName.trim())) { setCategoryNameError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setCategoryNameError("");
    if (!serviceCategories.includes(newCategoryName)) {
      setServiceCategories([...serviceCategories, newCategoryName]);
      setNewService({ ...newService, serviceCategory: newCategoryName });
    }
    setNewCategoryName("");
    setIsAddCategoryOpen(false);
  };

  // Add new service item
  const handleAddItem = () => {
    if (!newItemName.trim()) { setItemNameError(t("Please enter item name")); return; }
    if (!isValidName(newItemName.trim())) { setItemNameError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setItemNameError("");
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
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className={`flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
        <div className={`flex items-center gap-1.5 text-slate-500 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Dashboard")}
        </Link>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <span className="text-primary-700 font-medium">{t("Profile")}</span>
      </nav>

      {/* Page Header */}
      <div className={`flex flex-col gap-1 ${isRTL ? "items-end" : ""}`}>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Organization Profile")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className={`overflow-x-auto -mx-1 px-1 ${isRTL ? "flex justify-end" : ""}`}>
          <TabsList className={`w-full sm:w-auto inline-flex ${isRTL ? "flex-row-reverse" : ""}`}>
            <TabsTrigger value="overview" className="text-xs sm:text-sm">{t("Company Info")}</TabsTrigger>
            <TabsTrigger value="services" className="text-xs sm:text-sm">{t("Services")}</TabsTrigger>
            <TabsTrigger value="regulations" className="text-xs sm:text-sm">{t("Regulations")}</TabsTrigger>
            <TabsTrigger value="departments" className="text-xs sm:text-sm">{t("Departments")}</TabsTrigger>
            <TabsTrigger value="orgchart" className="text-xs sm:text-sm">{t("Organization Chart")}</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 sm:mt-6">
          {organization ? (
            <>
              {/* Header - matches other tabs */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
                <h3 className="text-base font-semibold text-slate-800">{t("Organization Information")}</h3>
                <Button size="sm" onClick={openEditOrganization} className={`w-full sm:w-auto ${isRTL ? "flex-row-reverse" : ""}`}>
                  <Pencil className="h-4 w-4 me-2" />
                  {t("Edit Profile")}
                </Button>
              </div>

              <div className="space-y-4 sm:space-y-5">
                {/* Organization Logo & Name Header */}
                {organization.logo && (
                  <div className={`bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex items-center gap-4 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                    <img src={organization.logo} alt={organization.name} className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{organization.name}</h3>
                      {organization.website && (
                        <p className="text-sm text-primary-600">{organization.website}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* General Information Section */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className={`px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 ${isRTL ? "text-right" : ""}`}>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("General Information")}</span>
                  </div>
                  <div className="p-3 sm:p-5">
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 ${isRTL ? "direction-rtl" : ""}`} style={isRTL ? { direction: 'rtl' } : undefined}>
                      <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mt-0.5">
                          <Building2 className="h-4 w-4 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{t("Organization Name")}</p>
                          <p className="text-sm font-medium text-slate-800">{organization.name || "-"}</p>
                        </div>
                      </div>
                      <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mt-0.5">
                          <Calendar className="h-4 w-4 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{t("Established Date")}</p>
                          <p className="text-sm font-medium text-slate-800">{organization.establishedDate || "-"}</p>
                        </div>
                      </div>
                      <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mt-0.5">
                          <Users className="h-4 w-4 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{t("Employee Count")}</p>
                          <p className="text-sm font-medium text-slate-800">{organization.employeeCount?.toLocaleString() || "0"}</p>
                        </div>
                      </div>
                      <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mt-0.5">
                          <MapPin className="h-4 w-4 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{t("Branch Count")}</p>
                          <p className="text-sm font-medium text-slate-800">{organization.branchCount || "0"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location & Contact Section */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className={`px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 ${isRTL ? "text-right" : ""}`}>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Location & Contact")}</span>
                  </div>
                  <div className="p-3 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5" style={isRTL ? { direction: 'rtl' } : undefined}>
                      <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mt-0.5">
                          <MapPin className="h-4 w-4 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{t("Head Office Location")}</p>
                          <p className="text-sm font-medium text-slate-800">{organization.headOfficeLocation || "-"}</p>
                        </div>
                      </div>
                      <div className={`flex items-start gap-3 sm:col-span-2 lg:col-span-1 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mt-0.5">
                          <Home className="h-4 w-4 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{t("Head Office Address")}</p>
                          <p className="text-sm font-medium text-slate-800">{organization.headOfficeAddress || "-"}</p>
                        </div>
                      </div>
                      <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mt-0.5">
                          <Globe className="h-4 w-4 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{t("Website")}</p>
                          <p className="text-sm font-medium text-primary-600 truncate">{organization.website || "-"}</p>
                        </div>
                      </div>
                      <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mt-0.5">
                          <Target className="h-4 w-4 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{t("Email")}</p>
                          <p className="text-sm font-medium text-slate-800 truncate">{organization.email || "-"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* About Section - Description, Vision, Mission */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className={`px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 ${isRTL ? "text-right" : ""}`}>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("About")}</span>
                  </div>
                  <div className={`p-3 sm:p-5 space-y-4 sm:space-y-5 ${isRTL ? "text-right" : ""}`}>
                    {/* Description */}
                    {organization.description && (
                      <div className={isRTL ? "border-r-2 border-primary-200 pr-4" : "border-l-2 border-primary-200 pl-4"}>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{t("Description")}</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{organization.description}</p>
                      </div>
                    )}

                    {/* Vision & Mission */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                      {organization.vision && (
                        <div className={isRTL ? "border-r-2 border-emerald-200 pr-4" : "border-l-2 border-emerald-200 pl-4"}>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{t("Vision")}</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{organization.vision}</p>
                        </div>
                      )}
                      {organization.mission && (
                        <div className={isRTL ? "border-r-2 border-amber-200 pr-4" : "border-l-2 border-amber-200 pl-4"}>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{t("Mission")}</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{organization.mission}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Brochure / Documents Section */}
                {organization.brochure && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className={`px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 ${isRTL ? "text-right" : ""}`}>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Documents")}</span>
                    </div>
                    <div className={`p-3 sm:p-5 ${isRTL ? "flex justify-end" : ""}`}>
                      <div className={`flex items-center gap-3 px-3 sm:px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 w-full sm:w-fit ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{t("Brochure")}</p>
                          <p className="text-sm font-medium text-slate-700">{organization.brochure.split("/").pop()}</p>
                        </div>
                        <div className={`flex items-center gap-0.5 ${isRTL ? "mr-2" : "ml-2"}`}>
                          <a href={organization.brochure} target="_blank" rel="noopener noreferrer">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <a href={organization.brochure} download>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-6 w-6 text-primary-500" />
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
        <TabsContent value="services" className="mt-4 sm:mt-6">
          {/* Header */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <h3 className="text-base font-semibold text-slate-800">{t("Services")}</h3>
              {services.length > 0 && (
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {services.length}
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => { setServiceErrors({}); setIsAddServiceOpen(true); }} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 me-2" />
              {t("Add Service")}
            </Button>
          </div>

          {services.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
              {/* Search */}
              <div className="px-3 sm:px-5 py-3 border-b border-slate-100">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 start-3" />
                  <input
                    type="text"
                    placeholder={t("Search services...")}
                    value={serviceSearch}
                    onChange={(e) => { setServiceSearch(e.target.value); setServicePage(1); }}
                    className="w-full py-2 ps-9 pe-3 text-sm bg-slate-50 border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
              {/* Table header */}
              <div className={`grid grid-cols-[1fr_120px_1fr_1fr_72px] gap-4 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[600px] ${isRTL ? "text-right" : ""}`}>
                <span>{t("Service Name")}</span>
                <span>{t("User Type")}</span>
                <span>{t("Category")}</span>
                <span>{t("Item")}</span>
                <span className={isRTL ? "text-start" : "text-end"}>{t("Actions")}</span>
              </div>
              {/* Table rows */}
              {(() => {
                const filtered = services.filter((s) =>
                  s.title.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                  s.serviceCategory?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                  s.serviceUser?.toLowerCase().includes(serviceSearch.toLowerCase())
                );
                const paginated = filtered.slice(
                  (servicePage - 1) * ITEMS_PER_PAGE,
                  servicePage * ITEMS_PER_PAGE
                );
                return (
                  <>
                    <div className="divide-y divide-slate-100">
                      {paginated.map((service) => (
                        <div
                          key={service.id}
                          className="grid grid-cols-[1fr_120px_1fr_1fr_72px] gap-4 px-3 sm:px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors min-w-[600px]"
                        >
                              {/* Service Name */}
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                                  <Briefcase className="h-4 w-4 text-primary-500" />
                                </div>
                                <span className="text-sm font-medium text-slate-800 truncate">{service.title}</span>
                              </div>

                              {/* User Type Badge */}
                              <div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  service.serviceUser === "Internal"
                                    ? "bg-primary-50 text-primary-700"
                                    : service.serviceUser === "External"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}>
                                  {t(service.serviceUser)}
                                </span>
                              </div>

                              {/* Category */}
                              <span className="text-sm text-slate-600 truncate">{service.serviceCategory || "—"}</span>

                              {/* Item */}
                              <span className="text-sm text-slate-600 truncate">{service.serviceItem || "—"}</span>

                              {/* Actions */}
                              <div className={`flex items-center gap-0.5 ${isRTL ? "justify-start" : "justify-end"}`}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
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
                                  className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                                  onClick={() => handleDeleteService(service.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                        </div>
                      ))}
                      {filtered.length === 0 && (
                        <div className="px-3 sm:px-5 py-8 text-center text-sm text-slate-400 min-w-[600px]">
                          {t("No services match your search.")}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              </div>
              {/* Pagination */}
              {(() => {
                const filtered = services.filter((s) =>
                  s.title.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                  s.serviceCategory?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                  s.serviceUser?.toLowerCase().includes(serviceSearch.toLowerCase())
                );
                return filtered.length > ITEMS_PER_PAGE ? (
                  <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-xs text-slate-500">
                      {(servicePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(servicePage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                        disabled={servicePage === 1}
                        onClick={() => setServicePage(servicePage - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                        disabled={servicePage * ITEMS_PER_PAGE >= filtered.length}
                        onClick={() => setServicePage(servicePage + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Services")}</h3>
              <p className="text-sm text-slate-500 mb-6">
                {t("Add services your organization provides.")}
              </p>
              <Button onClick={() => { setServiceErrors({}); setIsAddServiceOpen(true); }}>
                <Plus className="h-4 w-4 me-2" />
                {t("Add Service")}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Regulations Tab */}
        <TabsContent value="regulations" className="mt-4 sm:mt-6">
          {/* Header */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <h3 className="text-base font-semibold text-slate-800">{t("Regulations")}</h3>
              {regulations.length > 0 && (
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {regulations.length}
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => { setRegulationErrors({}); setIsAddRegulationOpen(true); }} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 me-2" />
              {t("Add Regulation")}
            </Button>
          </div>

          {regulations.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
              {/* Search */}
              <div className="px-3 sm:px-5 py-3 border-b border-slate-100">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 start-3" />
                  <input
                    type="text"
                    placeholder={t("Search regulations...")}
                    value={regulationSearch}
                    onChange={(e) => { setRegulationSearch(e.target.value); setRegulationPage(1); }}
                    className="w-full py-2 ps-9 pe-3 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
              {/* Table header */}
              <div className={`grid grid-cols-[1fr_100px_120px_72px] gap-4 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[500px] ${isRTL ? "text-right" : ""}`}>
                <span>{t("Regulation Name")}</span>
                <span>{t("Version")}</span>
                <span>{t("Status")}</span>
                <span className={isRTL ? "text-start" : "text-end"}>{t("Actions")}</span>
              </div>
              {/* Table rows */}
              {(() => {
                const filtered = regulations.filter((r) =>
                  r.name.toLowerCase().includes(regulationSearch.toLowerCase()) ||
                  r.version?.toLowerCase().includes(regulationSearch.toLowerCase())
                );
                const paginated = filtered.slice(
                  (regulationPage - 1) * ITEMS_PER_PAGE,
                  regulationPage * ITEMS_PER_PAGE
                );
                return (
                  <>
                    <div className="divide-y divide-slate-100">
                      {paginated.map((regulation) => (
                        <div
                          key={regulation.id}
                          className="grid grid-cols-[1fr_100px_120px_72px] gap-4 px-3 sm:px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors min-w-[500px]"
                        >
                          {/* Regulation Name */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                              <Scale className="h-4 w-4 text-primary-500" />
                            </div>
                            <span className="text-sm font-medium text-slate-800 truncate">{regulation.name}</span>
                          </div>

                          {/* Version */}
                          <span className="text-sm text-slate-600">{regulation.version || "—"}</span>

                          {/* Status Badge */}
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-compliance-compliant-bg text-compliance-compliant">
                              {t(regulation.status) || "—"}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className={`flex items-center gap-0.5 ${isRTL ? "justify-start" : "justify-end"}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                              onClick={() => {
                                setEditingRegulation(regulation);
                                setIsEditRegulationOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                              onClick={() => handleDeleteRegulation(regulation.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {filtered.length === 0 && (
                        <div className="px-3 sm:px-5 py-8 text-center text-sm text-slate-400 min-w-[500px]">
                          {t("No regulations match your search.")}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              </div>
              {/* Pagination */}
              {(() => {
                const filtered = regulations.filter((r) =>
                  r.name.toLowerCase().includes(regulationSearch.toLowerCase()) ||
                  r.version?.toLowerCase().includes(regulationSearch.toLowerCase())
                );
                return filtered.length > ITEMS_PER_PAGE ? (
                  <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-xs text-slate-500">
                      {(regulationPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(regulationPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                        disabled={regulationPage === 1}
                        onClick={() => setRegulationPage(regulationPage - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                        disabled={regulationPage * ITEMS_PER_PAGE >= filtered.length}
                        onClick={() => setRegulationPage(regulationPage + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Scale className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Regulations")}</h3>
              <p className="text-sm text-slate-500 mb-6">
                {t("Add regulations that apply to your organization.")}
              </p>
              <Button onClick={() => { setRegulationErrors({}); setIsAddRegulationOpen(true); }}>
                <Plus className="h-4 w-4 me-2" />
                {t("Add Regulation")}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="mt-4 sm:mt-6">
          {/* Header */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <h3 className="text-base font-semibold text-slate-800">{t("Departments")}</h3>
              {departments.length > 0 && (
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {departments.length}
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => { setDepartmentNameError(""); setIsAddDepartmentOpen(true); }} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 me-2" />
              {t("Add Department")}
            </Button>
          </div>

          {departments.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
              {/* Search */}
              <div className="px-3 sm:px-5 py-3 border-b border-slate-100">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 start-3" />
                  <input
                    type="text"
                    placeholder={t("Search departments...")}
                    value={departmentSearch}
                    onChange={(e) => { setDepartmentSearch(e.target.value); setDepartmentPage(1); }}
                    className="w-full py-2 ps-9 pe-3 text-sm bg-slate-50 border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
              </div>
              {/* Table header */}
              <div className={`grid grid-cols-[1fr_72px] gap-4 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider ${isRTL ? "text-right" : ""}`}>
                <span>{t("Department Name")}</span>
                <span className={isRTL ? "text-start" : "text-end"}>{t("Actions")}</span>
              </div>
              {/* Table rows */}
              {(() => {
                const filtered = departments.filter((dept) =>
                  dept.name.toLowerCase().includes(departmentSearch.toLowerCase())
                );
                const paginated = filtered.slice(
                  (departmentPage - 1) * ITEMS_PER_PAGE,
                  departmentPage * ITEMS_PER_PAGE
                );
                return (
                  <>
                    <div className="divide-y divide-slate-100">
                      {paginated.map((dept) => (
                        <div
                          key={dept.id}
                          className="grid grid-cols-[1fr_72px] gap-4 px-3 sm:px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors"
                        >
                          {/* Department Name */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-primary-500" />
                            </div>
                            <span className="text-sm font-medium text-slate-800 truncate">{dept.name}</span>
                          </div>

                          {/* Actions */}
                          <div className={`flex items-center gap-0.5 ${isRTL ? "justify-start" : "justify-end"}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                              onClick={() => {
                                setEditingDepartment(dept);
                                setIsEditDepartmentOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                              onClick={() => handleDeleteDepartment(dept.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {filtered.length === 0 && (
                        <div className="px-3 sm:px-5 py-8 text-center text-sm text-slate-400">
                          {t("No departments match your search.")}
                        </div>
                      )}
                    </div>
                    {/* Pagination */}
                    {filtered.length > ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                        <span className="text-xs text-slate-500">
                          {(departmentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(departmentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-slate-600"
                            disabled={departmentPage === 1}
                            onClick={() => setDepartmentPage(departmentPage - 1)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-slate-600"
                            disabled={departmentPage * ITEMS_PER_PAGE >= filtered.length}
                            onClick={() => setDepartmentPage(departmentPage + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Departments")}</h3>
              <p className="text-sm text-slate-500 mb-6">
                {t("Add departments to organize your team structure.")}
              </p>
              <Button onClick={() => { setDepartmentNameError(""); setIsAddDepartmentOpen(true); }}>
                <Plus className="h-4 w-4 me-2" />
                {t("Add Department")}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Organization Chart Tab */}
        <TabsContent value="orgchart" className="mt-4 sm:mt-6">
          {/* Header - matches other tabs */}
          <div className={`flex items-center justify-between mb-4 sm:mb-5 ${isRTL ? "flex-row-reverse" : ""}`}>
            <h3 className="text-base font-semibold text-slate-800">{t("Organization Structure")}</h3>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <OrgChart />
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Department Dialog */}
      <Dialog open={isAddDepartmentOpen} onOpenChange={(open) => { if (!open) { setIsAddDepartmentOpen(false); setDepartmentNameError(""); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Add Department")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <Label className="text-sm font-medium text-slate-700">{t("Department Name")}</Label>
            <Input
              value={newDepartmentName}
              onChange={(e) => { setNewDepartmentName(e.target.value); if (departmentNameError) setDepartmentNameError(""); }}
              placeholder={t("Enter department name")}
              className={`mt-1.5 ${departmentNameError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {departmentNameError && (
              <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-600">{departmentNameError}</p>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex flex-row justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setIsAddDepartmentOpen(false); setDepartmentNameError(""); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddDepartment}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={isEditDepartmentOpen} onOpenChange={(open) => { if (!open) { setIsEditDepartmentOpen(false); setEditDepartmentNameError(""); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Edit Department")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          {editingDepartment && (
            <div className="px-4 sm:px-6 py-4 sm:py-6">
              <Label className="text-sm font-medium text-slate-700">{t("Department Name")}</Label>
              <Input
                value={editingDepartment.name}
                onChange={(e) => { setEditingDepartment({ ...editingDepartment, name: e.target.value }); if (editDepartmentNameError) setEditDepartmentNameError(""); }}
                placeholder={t("Enter department name")}
                className={`mt-1.5 ${editDepartmentNameError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {editDepartmentNameError && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{editDepartmentNameError}</p>
                </div>
              )}
            </div>
          )}

          {/* Fixed Footer */}
          <div className="flex flex-row justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setIsEditDepartmentOpen(false); setEditDepartmentNameError(""); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditDepartment}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Service Dialog */}
      <Dialog open={isAddServiceOpen} onOpenChange={(open) => { if (!open) { setIsAddServiceOpen(false); setServiceErrors({}); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Add Service")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
            {/* Service Title */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Service Title")}</Label>
              <Input
                value={newService.title}
                onChange={(e) => { setNewService({ ...newService, title: e.target.value }); if (serviceErrors.title) setServiceErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
                placeholder={t("Enter service title")}
                className={`mt-1.5 ${serviceErrors.title ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {serviceErrors.title && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{serviceErrors.title}</p>
                </div>
              )}
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
              <div className="flex flex-wrap gap-4 sm:gap-6 mt-2">
                {["Internal", "External", "Public"].map((userType) => (
                  <label key={userType} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="addServiceUser"
                      checked={newService.serviceUser === userType}
                      onChange={() => { setNewService({ ...newService, serviceUser: userType }); if (serviceErrors.serviceUser) setServiceErrors((prev) => { const { serviceUser, ...rest } = prev; return rest; }); }}
                      className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-600">{t(userType)}</span>
                  </label>
                ))}
              </div>
              {serviceErrors.serviceUser && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{serviceErrors.serviceUser}</p>
                </div>
              )}
            </div>

            {/* Service Category */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Service Category")}</Label>
              <div className="flex gap-2 mt-1.5">
                <Select
                  value={newService.serviceCategory}
                  onValueChange={(value) => { setNewService({ ...newService, serviceCategory: value }); if (serviceErrors.serviceCategory) setServiceErrors((prev) => { const { serviceCategory, ...rest } = prev; return rest; }); }}
                >
                  <SelectTrigger className={`flex-1 ${serviceErrors.serviceCategory ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
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
              {serviceErrors.serviceCategory && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{serviceErrors.serviceCategory}</p>
                </div>
              )}
            </div>

            {/* Service Item */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Service Item")}</Label>
              <div className="flex gap-2 mt-1.5">
                <Select
                  value={newService.serviceItem}
                  onValueChange={(value) => { setNewService({ ...newService, serviceItem: value }); if (serviceErrors.serviceItem) setServiceErrors((prev) => { const { serviceItem, ...rest } = prev; return rest; }); }}
                >
                  <SelectTrigger className={`flex-1 ${serviceErrors.serviceItem ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
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
              {serviceErrors.serviceItem && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{serviceErrors.serviceItem}</p>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex flex-row justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setIsAddServiceOpen(false); setServiceErrors({}); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddService}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={isEditServiceOpen} onOpenChange={(open) => { if (!open) { setIsEditServiceOpen(false); setEditServiceErrors({}); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Edit Service")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          {editingService && (
            <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
              {/* Service Title */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Service Title")}</Label>
                <Input
                  value={editingService.title}
                  onChange={(e) => { setEditingService({ ...editingService, title: e.target.value }); if (editServiceErrors.title) setEditServiceErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
                  placeholder={t("Enter service title")}
                  className={`mt-1.5 ${editServiceErrors.title ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {editServiceErrors.title && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{editServiceErrors.title}</p>
                  </div>
                )}
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
                <div className="flex flex-wrap gap-4 sm:gap-6 mt-2">
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
          <div className="flex flex-row justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setIsEditServiceOpen(false); setEditServiceErrors({}); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditService}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Regulation Dialog */}
      <Dialog open={isAddRegulationOpen} onOpenChange={(open) => { if (!open) { setIsAddRegulationOpen(false); setRegulationErrors({}); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Add Regulation")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-4 sm:space-y-5">
              {/* Name and Version */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Regulation Name")} <span className="text-error">*</span></Label>
                  <Input
                    value={newRegulation.name}
                    onChange={(e) => { setNewRegulation({ ...newRegulation, name: e.target.value }); if (regulationErrors.name) setRegulationErrors((prev) => { const { name, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter regulation name")}
                    className={`mt-1.5 ${regulationErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {regulationErrors.name && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{regulationErrors.name}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Version")} <span className="text-error">*</span></Label>
                  <Input
                    value={newRegulation.version}
                    onChange={(e) => { setNewRegulation({ ...newRegulation, version: e.target.value }); if (regulationErrors.version) setRegulationErrors((prev) => { const { version, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter version")}
                    className={`mt-1.5 ${regulationErrors.version ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {regulationErrors.version && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{regulationErrors.version}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* SA1 and SA2 Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setIsAddRegulationOpen(false); setRegulationErrors({}); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddRegulation}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Regulation Dialog */}
      <Dialog open={isEditRegulationOpen} onOpenChange={(open) => { if (!open) { setIsEditRegulationOpen(false); setEditRegulationErrors({}); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Edit Regulation")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          {editingRegulation && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
              <div className="space-y-4 sm:space-y-5">
                {/* Name and Version */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Regulation Name")} <span className="text-error">*</span></Label>
                    <Input
                      value={editingRegulation.name}
                      onChange={(e) => { setEditingRegulation({ ...editingRegulation, name: e.target.value }); if (editRegulationErrors.name) setEditRegulationErrors((prev) => { const { name, ...rest } = prev; return rest; }); }}
                      className={`mt-1.5 ${editRegulationErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    {editRegulationErrors.name && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{editRegulationErrors.name}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Version")} <span className="text-error">*</span></Label>
                    <Input
                      value={editingRegulation.version}
                      onChange={(e) => { setEditingRegulation({ ...editingRegulation, version: e.target.value }); if (editRegulationErrors.version) setEditRegulationErrors((prev) => { const { version, ...rest } = prev; return rest; }); }}
                      className={`mt-1.5 ${editRegulationErrors.version ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    {editRegulationErrors.version && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{editRegulationErrors.version}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* SA1 and SA2 Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setIsEditRegulationOpen(false); setEditRegulationErrors({}); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditRegulation}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Service Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={(open) => { if (!open) { setIsAddCategoryOpen(false); setCategoryNameError(""); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Add Service Category")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <Label className="text-sm font-medium text-slate-700">{t("Category Name")}</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => { setNewCategoryName(e.target.value); if (categoryNameError) setCategoryNameError(""); }}
              placeholder={t("Enter category name")}
              className={`mt-1.5 ${categoryNameError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {categoryNameError && (
              <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-600">{categoryNameError}</p>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex flex-row justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setIsAddCategoryOpen(false); setCategoryNameError(""); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddCategory}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Service Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={(open) => { if (!open) { setIsAddItemOpen(false); setItemNameError(""); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Add Service Item")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <Label className="text-sm font-medium text-slate-700">{t("Item Name")}</Label>
            <Input
              value={newItemName}
              onChange={(e) => { setNewItemName(e.target.value); if (itemNameError) setItemNameError(""); }}
              placeholder={t("Enter item name")}
              className={`mt-1.5 ${itemNameError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {itemNameError && (
              <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-600">{itemNameError}</p>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex flex-row justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => { setIsAddItemOpen(false); setItemNameError(""); }}>
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
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDepartment} className="bg-red-600 hover:bg-red-700">{t("Delete")}</AlertDialogAction>
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
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteService} className="bg-red-600 hover:bg-red-700">{t("Delete")}</AlertDialogAction>
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
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRegulation} className="bg-red-600 hover:bg-red-700">{t("Unsubscribe")}</AlertDialogAction>
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
