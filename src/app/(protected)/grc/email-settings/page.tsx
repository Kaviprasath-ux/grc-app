"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Send, Home, ChevronRight, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface EmailSettings {
  id: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
  fromName: string | null;
  replyToAddress: string | null;
  useTLS: boolean;
  useSSL: boolean;
  isActive: boolean;
  isVerified: boolean;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  createdAt: string;
  updatedAt: string;
}

const COMMON_SMTP_PROVIDERS = [
  { label: "Custom", host: "", port: 587 },
  { label: "Gmail", host: "smtp.gmail.com", port: 587 },
  { label: "Office 365", host: "smtp.office365.com", port: 587 },
  { label: "Outlook", host: "smtp-mail.outlook.com", port: 587 },
  { label: "Yahoo", host: "smtp.mail.yahoo.com", port: 587 },
  { label: "SendGrid", host: "smtp.sendgrid.net", port: 587 },
  { label: "Mailgun", host: "smtp.mailgun.org", port: 587 },
  { label: "Amazon SES", host: "email-smtp.us-east-1.amazonaws.com", port: 587 },
];

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("Custom");

  const [formData, setFormData] = useState({
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    fromAddress: "",
    fromName: "",
    replyToAddress: "",
    useTLS: true,
    useSSL: false,
    isActive: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/grc/email-settings");
      if (res.ok) {
        const settings = await res.json();
        if (settings) {
          setEmailSettings(settings);
          setFormData({
            smtpHost: settings.smtpHost,
            smtpPort: settings.smtpPort,
            smtpUser: settings.smtpUser,
            smtpPassword: "", // Don't populate password
            fromAddress: settings.fromAddress,
            fromName: settings.fromName || "",
            replyToAddress: settings.replyToAddress || "",
            useTLS: settings.useTLS,
            useSSL: settings.useSSL,
            isActive: settings.isActive,
          });
          // Try to match provider
          const matchedProvider = COMMON_SMTP_PROVIDERS.find(p => p.host === settings.smtpHost);
          setSelectedProvider(matchedProvider?.label || "Custom");
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast({
        title: t("Error"),
        description: t("Failed to load email settings"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const providerData = COMMON_SMTP_PROVIDERS.find(p => p.label === provider);
    if (providerData) {
      setFormData(prev => ({
        ...prev,
        smtpHost: providerData.host,
        smtpPort: providerData.port,
      }));
    }
  };

  const handleSave = async () => {
    if (!formData.smtpHost || !formData.smtpUser || !formData.fromAddress) {
      toast({
        title: t("Validation Error"),
        description: t("Please fill in all required fields"),
        variant: "destructive",
      });
      return;
    }

    if (!emailSettings && !formData.smtpPassword) {
      toast({
        title: t("Validation Error"),
        description: t("SMTP password is required"),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/grc/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Email settings saved successfully"),
        });
        fetchSettings();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to save email settings"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to save email settings"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/grc/email-settings", { method: "DELETE" });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Email settings deleted successfully"),
        });
        setShowDeleteDialog(false);
        setEmailSettings(null);
        setFormData({
          smtpHost: "",
          smtpPort: 587,
          smtpUser: "",
          smtpPassword: "",
          fromAddress: "",
          fromName: "",
          replyToAddress: "",
          useTLS: true,
          useSSL: false,
          isActive: true,
        });
        setSelectedProvider("Custom");
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to delete email settings"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to delete email settings"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await fetch("/api/grc/email-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testRecipient: testEmail || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: t("Success"),
          description: result.message || t("Email test successful"),
        });
        setShowTestDialog(false);
        fetchSettings(); // Refresh to show updated verification status
      } else {
        toast({
          title: t("Test Failed"),
          description: result.error || t("Failed to test email configuration"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Failed to test email configuration"),
        variant: "destructive",
      });
    } finally {
      setTesting(false);
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
          <span className="text-primary-700 font-medium">{t("Email Settings")}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Email Settings")}</h1>
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
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Email Settings")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Email Settings")}</h1>
          {emailSettings && (
            <Badge className={emailSettings.isVerified
              ? "bg-green-100 text-green-700 hover:bg-green-100"
              : "bg-amber-100 text-amber-700 hover:bg-amber-100"
            }>
              {emailSettings.isVerified ? t("Verified") : t("Not Verified")}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {emailSettings && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowTestDialog(true)} className="flex-1 sm:flex-none">
                <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Test Connection")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-semantic-error hover:text-semantic-error hover:bg-red-50 flex-1 sm:flex-none"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Delete")}
              </Button>
            </>
          )}
          <Button size="sm" onClick={handleSave} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? t("Saving...") : t("Save Settings")}
          </Button>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 space-y-5">
          {/* SMTP Provider */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">{t("SMTP Provider")}</Label>
            <Select value={selectedProvider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                {COMMON_SMTP_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.label} value={provider.label}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">{t("Select a provider to auto-fill server details, or choose Custom")}</p>
          </div>

          {/* SMTP Host + Port */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">{t("SMTP Host")} <span className="text-red-500">*</span></Label>
              <Input
                value={formData.smtpHost}
                onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">{t("Port")} <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={formData.smtpPort}
                onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) || 587 })}
                placeholder="587"
              />
            </div>
          </div>

          {/* SMTP Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">{t("SMTP Username")} <span className="text-red-500">*</span></Label>
              <Input
                value={formData.smtpUser}
                onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                {t("SMTP Password")} {!emailSettings && <span className="text-red-500">*</span>}
              </Label>
              <Input
                type="password"
                value={formData.smtpPassword}
                onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                placeholder={emailSettings ? t("Leave blank to keep current") : t("Enter password")}
              />
            </div>
          </div>

          {/* From Address + From Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">{t("From Address")} <span className="text-red-500">*</span></Label>
              <Input
                value={formData.fromAddress}
                onChange={(e) => setFormData({ ...formData, fromAddress: e.target.value })}
                placeholder="notifications@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">{t("From Name")}</Label>
              <Input
                value={formData.fromName}
                onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                placeholder="GRC Platform"
              />
            </div>
          </div>

          {/* Reply-To */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">{t("Reply-To Address")}</Label>
            <Input
              value={formData.replyToAddress}
              onChange={(e) => setFormData({ ...formData, replyToAddress: e.target.value })}
              placeholder="support@example.com"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Security & Status Toggles */}
          <div className="space-y-1">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">{t("Use TLS")}</p>
                <p className="text-xs text-slate-500">{t("Enable TLS encryption (recommended for port 587)")}</p>
              </div>
              <Switch
                checked={formData.useTLS}
                onCheckedChange={(checked) => setFormData({ ...formData, useTLS: checked, useSSL: checked ? false : formData.useSSL })}
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">{t("Use SSL")}</p>
                <p className="text-xs text-slate-500">{t("Enable SSL encryption (for port 465)")}</p>
              </div>
              <Switch
                checked={formData.useSSL}
                onCheckedChange={(checked) => setFormData({ ...formData, useSSL: checked, useTLS: checked ? false : formData.useTLS })}
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">{t("Active")}</p>
                <p className="text-xs text-slate-500">{t("Enable email sending for this configuration")}</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </div>

          {/* Last tested info */}
          {emailSettings?.lastTestedAt && (
            <>
              <div className="border-t border-slate-100" />
              <p className="text-xs text-slate-500">
                {t("Last tested")}: {new Date(emailSettings.lastTestedAt).toLocaleString()}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Test Email Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Test Email Configuration")}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-600">
              {t("Test the SMTP connection by sending a test email. Leave the email field empty to only verify the connection.")}
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">{t("Test Email Address")}</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder={t("Enter email to receive test (optional)")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setShowTestDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleTest} disabled={testing} size="sm">
              <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {testing ? t("Testing...") : t("Send Test")}
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
              {t("Are you sure you want to delete the email configuration?")}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {t("This will disable all email notifications in the platform.")}
            </p>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleDelete} disabled={submitting} size="sm" variant="destructive">
              {submitting ? t("Deleting...") : t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
