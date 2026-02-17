"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Eye, Copy, Home, ChevronRight, FileText, Lock, Upload, FileDown, FileUp,Download, RefreshCw, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isValidName } from "@/lib/validations";

interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  placeholders: string[];
  category: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE_CATEGORIES = [
  { value: "notification", label: "Notification" },
  { value: "reminder", label: "Reminder" },
  { value: "system", label: "System" },
  { value: "custom", label: "Custom" },
];

export default function EmailTemplatesPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importData, setImportData] = useState<string>("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    placeholders: [] as string[],
    category: "custom",
    isActive: true,
  });

  const [newPlaceholder, setNewPlaceholder] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const templatesRes = await fetch("/api/grc/email-templates");
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({
        title: t("Error"),
        description: t("Failed to load email templates"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      subject: "",
      bodyHtml: "",
      bodyText: "",
      placeholders: [],
      category: "custom",
      isActive: true,
    });
    setNewPlaceholder("");
    setIsEditing(false);
    setSelectedTemplate(null);
  };

  const openAddDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setIsEditing(true);
    setFormData({
      code: template.code,
      name: template.name,
      description: template.description || "",
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText || "",
      placeholders: template.placeholders || [],
      category: template.category,
      isActive: template.isActive,
    });
    setShowDialog(true);
  };

  const openPreviewDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setShowPreviewDialog(true);
  };

  const openDeleteDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setShowDeleteDialog(true);
  };

  const handleDuplicateTemplate = (template: EmailTemplate) => {
    setFormData({
      code: `${template.code}_COPY`,
      name: `${template.name} (Copy)`,
      description: template.description || "",
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText || "",
      placeholders: template.placeholders || [],
      category: "custom",
      isActive: true,
    });
    setIsEditing(false);
    setSelectedTemplate(null);
    setShowDialog(true);
  };

  const handleAddPlaceholder = () => {
    if (newPlaceholder && !formData.placeholders.includes(newPlaceholder)) {
      setFormData({
        ...formData,
        placeholders: [...formData.placeholders, newPlaceholder],
      });
      setNewPlaceholder("");
    }
  };

  const handleRemovePlaceholder = (placeholder: string) => {
    setFormData({
      ...formData,
      placeholders: formData.placeholders.filter((p) => p !== placeholder),
    });
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.subject || !formData.bodyHtml) {
      toast({
        title: t("Validation Error"),
        description: t("Please fill in all required fields"),
        variant: "destructive",
      });
      return;
    }

    if (!isValidName(formData.name.trim())) {
      toast({
        title: t("Validation Error"),
        description: t("Only letters, numbers, spaces, and hyphens are allowed"),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const url = isEditing
        ? `/api/grc/email-templates/${selectedTemplate?.id}`
        : "/api/grc/email-templates";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: isEditing
            ? t("Email template updated successfully")
            : t("Email template created successfully"),
        });
        setShowDialog(false);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to save email template"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to save email template"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/grc/email-templates/${selectedTemplate.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Email template deleted successfully"),
        });
        setShowDeleteDialog(false);
        setSelectedTemplate(null);
        fetchData();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to delete email template"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to delete email template"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedTemplates = async () => {
    setSeeding(true);
    try {
      const response = await fetch("/api/grc/email-templates/seed", {
        method: "POST",
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: t("Success"),
          description: result.message || t("Default templates seeded successfully"),
        });
        fetchData();
      } else {
        toast({
          title: t("Error"),
          description: result.error || t("Failed to seed templates"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to seed templates"),
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const response = await fetch("/api/grc/email-templates/delete-all", {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: t("Success"),
          description: result.message || t("All templates deleted successfully"),
        });
        setShowDeleteAllDialog(false);
        fetchData();
      } else {
        toast({
          title: t("Error"),
          description: result.error || t("Failed to delete templates"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to delete templates"),
        variant: "destructive",
      });
    } finally {
      setDeletingAll(false);
    }
  };

  // Helper function to escape XML special characters
  const escapeXml = (str: string | null | undefined): string => {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  // Helper function to encode HTML for XML Content field (Mendix style)
  const encodeHtmlForXml = (html: string | null | undefined): string => {
    if (!html) return "";
    return html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  // Generate code from template name (uppercase, underscores for spaces)
  const generateCodeFromName = (name: string): string => {
    return name.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
  };

  // Export single template as Mendix-style XML
  const handleExportSingle = (template: EmailTemplate) => {
    const now = new Date().toISOString();

    // Extract placeholders from bodyHtml using {placeholder} format and convert to {%placeholder%}
    const placeholderMatches = template.bodyHtml.match(/\{([^}]+)\}/g) || [];
    const placeholders = placeholderMatches.map(p => p.slice(1, -1)); // Remove { }

    let xml = '<?xml version="1.0" encoding="utf-8"?>';
    xml += '<EmailTemplate>';
    xml += `<TemplateName>${escapeXml(template.name)}</TemplateName>`;
    xml += `<CreationDate>${template.createdAt}</CreationDate>`;
    xml += `<Subject>${escapeXml(template.subject)}</Subject>`;
    xml += `<Content>${encodeHtmlForXml(template.bodyHtml)}</Content>`;
    xml += `<UseOnlyPlainText>false</UseOnlyPlainText>`;
    xml += `<hasAttachment>false</hasAttachment>`;
    xml += `<ReplyTo/>`;
    xml += `<PlainBody>${escapeXml(template.bodyText)}</PlainBody>`;
    xml += `<FromDisplayName>GRCSupport</FromDisplayName>`;
    xml += `<Signed>false</Signed>`;
    xml += `<Encrypted>false</Encrypted>`;
    xml += `<RecipientsToggle>false</RecipientsToggle>`;
    xml += `<FromAddress></FromAddress>`;
    xml += `<changedDate>${template.updatedAt}</changedDate>`;
    xml += `<createdDate>${template.createdAt}</createdDate>`;
    xml += '<Tokens>';

    // Add tokens for each placeholder
    placeholders.forEach(placeholder => {
      xml += '<Token>';
      xml += `<Token>${escapeXml(placeholder)}</Token>`;
      xml += `<Prefix>{%</Prefix>`;
      xml += `<Suffix>%}</Suffix>`;
      xml += `<CombinedToken>{%${escapeXml(placeholder)}%}</CombinedToken>`;
      xml += `<Description>${escapeXml(placeholder)}</Description>`;
      xml += `<TokenType>Attribute</TokenType>`;
      xml += `<Status>Valid</Status>`;
      xml += `<IsOptional>false</IsOptional>`;
      xml += `<changedDate>${now}</changedDate>`;
      xml += `<createdDate>${now}</createdDate>`;
      xml += '</Token>';
    });

    xml += '</Tokens>';
    xml += '</EmailTemplate>';

    // Create and download XML file
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];
    link.download = `${template.name.replace(/\s+/g, "_")}_${timestamp}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t("Success"),
      description: t("Template exported successfully"),
    });
  };

  // Export all templates as Mendix-style XML (multiple EmailTemplate elements wrapped)
  const handleExport = () => {
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<EmailTemplates>\n';

    templates.forEach((template) => {
      const placeholderMatches = template.bodyHtml.match(/\{([^}]+)\}/g) || [];
      const placeholders = placeholderMatches.map(p => p.slice(1, -1));

      xml += '<EmailTemplate>\n';
      xml += `  <TemplateName>${escapeXml(template.name)}</TemplateName>\n`;
      xml += `  <TemplateCode>${escapeXml(template.code)}</TemplateCode>\n`;
      xml += `  <Description>${escapeXml(template.description)}</Description>\n`;
      xml += `  <Category>${escapeXml(template.category)}</Category>\n`;
      xml += `  <IsActive>${template.isActive}</IsActive>\n`;
      xml += `  <CreationDate>${template.createdAt}</CreationDate>\n`;
      xml += `  <Subject>${escapeXml(template.subject)}</Subject>\n`;
      xml += `  <Content>${encodeHtmlForXml(template.bodyHtml)}</Content>\n`;
      xml += `  <PlainBody>${escapeXml(template.bodyText)}</PlainBody>\n`;
      xml += '  <Tokens>\n';

      placeholders.forEach(placeholder => {
        xml += '    <Token>\n';
        xml += `      <Token>${escapeXml(placeholder)}</Token>\n`;
        xml += `      <CombinedToken>{%${escapeXml(placeholder)}%}</CombinedToken>\n`;
        xml += '    </Token>\n';
      });

      xml += '  </Tokens>\n';
      xml += '</EmailTemplate>\n';
    });

    xml += '</EmailTemplates>';

    // Create and download XML file
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];
    link.download = `email-templates-export_${timestamp}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t("Success"),
      description: t("Templates exported successfully"),
    });
  };

  // Helper function to get text content from XML element
  const getXmlText = (element: Element, tagName: string): string => {
    const node = element.getElementsByTagName(tagName)[0];
    return node?.textContent || "";
  };

  // Helper function to decode HTML entities
  const decodeHtmlEntities = (str: string): string => {
    if (!str) return "";
    return str
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  };

  // Convert Mendix placeholder format {%...%} to our format {...}
  const convertPlaceholderFormat = (str: string): string => {
    if (!str) return "";
    return str.replace(/\{%([^%]+)%\}/g, "{$1}");
  };

  // Parse XML to templates array (supports both Mendix format and our export format)
  const parseXmlToTemplates = (xmlString: string): Array<{
    code: string;
    name: string;
    description: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    placeholders: string[];
    category: string;
    isActive: boolean;
  }> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    // Check for parsing errors
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      throw new Error("Invalid XML format");
    }

    const templates = [];

    // Check if it's a single EmailTemplate (Mendix single export) or multiple (wrapped in EmailTemplates)
    const rootElement = doc.documentElement;
    let templateNodes: Element[] = [];

    if (rootElement.tagName === "EmailTemplate") {
      // Single template at root (Mendix single export format)
      templateNodes = [rootElement];
    } else if (rootElement.tagName === "EmailTemplates") {
      // Multiple templates wrapped (our export format or batch)
      templateNodes = Array.from(rootElement.getElementsByTagName("EmailTemplate"));
    } else {
      throw new Error("Invalid XML format - expected EmailTemplate or EmailTemplates root element");
    }

    for (let i = 0; i < templateNodes.length; i++) {
      const node = templateNodes[i];

      // Get template name (Mendix uses TemplateName)
      const name = getXmlText(node, "TemplateName") || getXmlText(node, "Name") || "";
      if (!name) continue;

      // Get or generate code
      let code = getXmlText(node, "TemplateCode") || getXmlText(node, "Code") || "";
      if (!code) {
        code = generateCodeFromName(name);
      }

      // Get subject
      const subject = getXmlText(node, "Subject") || "";

      // Get HTML body (Mendix uses Content with encoded HTML)
      let bodyHtml = getXmlText(node, "Content") || getXmlText(node, "BodyHtml") || "";
      // Decode HTML entities if needed (Mendix encodes < > etc)
      bodyHtml = decodeHtmlEntities(bodyHtml);
      // Convert placeholder format from {%...%} to {...}
      bodyHtml = convertPlaceholderFormat(bodyHtml);

      // Get plain text body
      let bodyText = getXmlText(node, "PlainBody") || getXmlText(node, "BodyText") || "";
      bodyText = convertPlaceholderFormat(bodyText);

      // Get description
      const description = getXmlText(node, "Description") || "";

      // Get category
      const category = getXmlText(node, "Category") || "custom";

      // Get isActive
      const isActiveStr = getXmlText(node, "IsActive");
      const isActive = isActiveStr !== "false";

      // Extract placeholders from Tokens
      const placeholders: string[] = [];
      const tokensNode = node.getElementsByTagName("Tokens")[0];
      if (tokensNode) {
        const tokenNodes = tokensNode.getElementsByTagName("Token");
        for (let j = 0; j < tokenNodes.length; j++) {
          const tokenNode = tokenNodes[j];
          // The inner Token element contains the placeholder name
          const innerTokenNodes = tokenNode.getElementsByTagName("Token");
          if (innerTokenNodes.length > 1) {
            // First Token is the container, second is the actual token name
            const tokenName = innerTokenNodes[1]?.textContent || "";
            if (tokenName && !placeholders.includes(tokenName)) {
              placeholders.push(tokenName);
            }
          } else if (tokenNode.childNodes.length > 0) {
            // Try to get text content directly if structure is different
            const tokenText = tokenNode.textContent?.trim() || "";
            if (tokenText && !tokenText.includes("<") && !placeholders.includes(tokenText)) {
              placeholders.push(tokenText);
            }
          }
        }
      }

      // Also extract placeholders from bodyHtml if Tokens section is empty
      if (placeholders.length === 0 && bodyHtml) {
        const matches = bodyHtml.match(/\{([^}]+)\}/g) || [];
        matches.forEach(match => {
          const placeholder = match.slice(1, -1);
          if (!placeholders.includes(placeholder)) {
            placeholders.push(placeholder);
          }
        });
      }

      templates.push({
        code,
        name,
        description,
        subject,
        bodyHtml,
        bodyText,
        placeholders,
        category,
        isActive,
      });
    }

    return templates;
  };

  // Handle file selection for import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // Validate XML by parsing it
        const parsedTemplates = parseXmlToTemplates(content);
        if (parsedTemplates.length === 0) {
          throw new Error("No templates found in XML");
        }
        setImportData(content);
        setShowImportDialog(true);
      } catch (error) {
        toast({
          title: t("Error"),
          description: t("Invalid XML file"),
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Import templates from XML
  const handleImport = async () => {
    if (!importData) return;

    setImporting(true);
    try {
      const parsedTemplates = parseXmlToTemplates(importData);

      const response = await fetch("/api/grc/email-templates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templates: parsedTemplates,
          overwrite: importOverwrite,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: t("Success"),
          description: result.message,
        });
        setShowImportDialog(false);
        setImportData("");
        setImportOverwrite(false);
        fetchData();
      } else {
        toast({
          title: t("Error"),
          description: result.error || t("Failed to import templates"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to import templates"),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    if (filterCategory !== "all" && template.category !== filterCategory) {
      return false;
    }
    return true;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "notification":
        return "bg-blue-50 text-blue-700";
      case "reminder":
        return "bg-amber-50 text-amber-700";
      case "system":
        return "bg-purple-50 text-purple-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Email Templates")}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Email Templates")}</h1>
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
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Email Templates")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Email Templates")}</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedTemplates}
            disabled={seeding}
            title={t("Seed default email templates")}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`h-4 w-4 ltr:mr-2 rtl:ml-2 ${seeding ? 'animate-spin' : ''}`} />
            {seeding ? t("Seeding...") : t("Seed Defaults")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteAllDialog(true)}
            disabled={templates.length === 0}
            title={t("Delete all email templates")}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1 sm:flex-none"
          >
            <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Delete All")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title={t("Import templates from XML file")}
            className="flex-1 sm:flex-none"
          >
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Import")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={templates.length === 0}
            title={t("Export templates to XML file")}
            className="flex-1 sm:flex-none"
          >
            <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Export")}
          </Button>
          <Button onClick={openAddDialog} size="sm" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Add Template")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3 border-b border-slate-100">
          <div className="ms-auto flex items-center gap-3">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px] h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("All Categories")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">{t("All Categories")}</SelectItem>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {t(cat.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Template")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Code")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Category")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTemplates.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5}>
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-6 w-6 text-primary-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      {t("No Email Templates Found")}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {filterCategory !== "all"
                        ? t("No templates match the selected category filter.")
                        : t("Get started by adding your first email template.")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((template) => (
                <TableRow key={template.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 pl-5">
                    <div className="flex items-center gap-2">
                      {template.isSystem && (
                        <span title={t("System template")}>
                          <Lock className="h-3.5 w-3.5 text-slate-400" />
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900">{template.name}</p>
                        {template.description && (
                          <p className="text-xs text-slate-500 truncate max-w-xs">{template.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">{template.code}</code>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(template.category)}`}>
                      {t(template.category.charAt(0).toUpperCase() + template.category.slice(1))}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      template.isActive
                        ? "bg-green-50 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {template.isActive ? t("Active") : t("Inactive")}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-blue-600"
                        onClick={() => openPreviewDialog(template)}
                        title={t("Preview")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => handleDuplicateTemplate(template)}
                        title={t("Duplicate")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-green-600"
                        onClick={() => handleExportSingle(template)}
                        title={t("Export")}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(template)}
                        title={t("Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(template)}
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
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {isEditing ? t("Edit Email Template") : t("Add Email Template")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="content">{t("Content")}</TabsTrigger>
                <TabsTrigger value="settings">{t("Settings")}</TabsTrigger>
                <TabsTrigger value="placeholders">{t("Placeholders")}</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Template Code")} <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, "_") })}
                      placeholder="EVIDENCE_ASSIGNED"
                      disabled={isEditing && selectedTemplate?.isSystem}
                    />
                    <p className="text-xs text-slate-500">{t("Unique identifier for this template")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{t("Template Name")} <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t("Evidence Assigned")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t("Describe when this template is used")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Subject Line")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder={t("Evidence Assigned: {entityName}")}
                  />
                  <p className="text-xs text-slate-500">{t("Use {placeholder} for dynamic content")}</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("HTML Body")} <span className="text-red-500">*</span></Label>
                  <Textarea
                    value={formData.bodyHtml}
                    onChange={(e) => setFormData({ ...formData, bodyHtml: e.target.value })}
                    placeholder="<html>...</html>"
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Plain Text Body")}</Label>
                  <Textarea
                    value={formData.bodyText}
                    onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                    placeholder={t("Plain text version of the email (optional)")}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">{t("Category")}</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {TEMPLATE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {t(cat.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t("Active")}</p>
                    <p className="text-xs text-slate-500">{t("Inactive templates will not be used for sending emails")}</p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="placeholders" className="space-y-4">
                <p className="text-sm text-slate-600">
                  {t("Define placeholders that can be used in the template. Use them as {placeholderName} in subject and body.")}
                </p>

                <div className="flex gap-2">
                  <Input
                    value={newPlaceholder}
                    onChange={(e) => setNewPlaceholder(e.target.value.replace(/\s/g, ""))}
                    placeholder={t("Add placeholder name")}
                    onKeyPress={(e) => e.key === "Enter" && handleAddPlaceholder()}
                  />
                  <Button onClick={handleAddPlaceholder} size="sm">
                    <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Add")}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {formData.placeholders.map((placeholder) => (
                    <Badge key={placeholder} variant="secondary" className="px-3 py-1">
                      {`{${placeholder}}`}
                      <button
                        onClick={() => handleRemovePlaceholder(placeholder)}
                        className="ltr:ml-2 rtl:mr-2 text-slate-400 hover:text-slate-600"
                      >
                        &times;
                      </button>
                    </Badge>
                  ))}
                  {formData.placeholders.length === 0 && (
                    <p className="text-sm text-slate-400 italic">{t("No placeholders defined")}</p>
                  )}
                </div>

                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium text-slate-700 mb-2">{t("Default Placeholders (always available)")}</p>
                  <div className="flex flex-wrap gap-2">
                    {["recipientName", "recipientEmail", "appName", "appUrl", "currentDate", "currentYear"].map((p) => (
                      <Badge key={p} variant="outline" className="px-2 py-0.5 text-xs">
                        {`{${p}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => { setShowDialog(false); resetForm(); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={submitting} size="sm">
              {submitting ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Template Preview")}: {selectedTemplate?.name}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {selectedTemplate && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Subject")}</Label>
                  <p className="mt-1 p-3 bg-slate-50 rounded-lg text-sm">{selectedTemplate.subject}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("HTML Preview")}</Label>
                  <div className="mt-1 p-4 bg-white border border-slate-200 rounded-lg">
                    <iframe
                      srcDoc={selectedTemplate.bodyHtml}
                      className="w-full h-96 border-0"
                      title="Email Preview"
                    />
                  </div>
                </div>

                {selectedTemplate.placeholders && selectedTemplate.placeholders.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Placeholders")}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTemplate.placeholders.map((p: string) => (
                        <Badge key={p} variant="secondary" className="px-2 py-0.5">
                          {`{${p}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setShowPreviewDialog(false)}>
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Email Templates")}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-600">
              {t("Import templates from the selected XML file. Templates with existing codes will be skipped unless overwrite is enabled.")}
            </p>

            {importData && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-700">
                  <strong>{parseXmlToTemplates(importData).length}</strong> {t("templates found in file")}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-sm font-medium text-slate-700">{t("Overwrite Existing")}</p>
                <p className="text-xs text-slate-500">{t("Update templates with matching codes")}</p>
              </div>
              <Switch
                checked={importOverwrite}
                onCheckedChange={setImportOverwrite}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => { setShowImportDialog(false); setImportData(""); setImportOverwrite(false); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleImport} disabled={importing} size="sm">
              <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {importing ? t("Importing...") : t("Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm text-slate-600">
              {t("Are you sure you want to delete the template")} <strong>{selectedTemplate?.name}</strong>?
            </p>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => { setShowDeleteDialog(false); setSelectedTemplate(null); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleDelete} disabled={submitting} size="sm" variant="destructive">
              {submitting ? t("Deleting...") : t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[450px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {t("Delete All Templates")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm text-slate-600">
              {t("Are you sure you want to delete ALL")} <strong>{templates.length}</strong> {t("email templates? This action cannot be undone.")}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {t("You can use the 'Seed Defaults' button to restore the default templates after deletion.")}
            </p>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteAllDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleDeleteAll} disabled={deletingAll} size="sm" variant="destructive">
              {deletingAll ? t("Deleting...") : t("Delete All")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
