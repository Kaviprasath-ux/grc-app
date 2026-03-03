"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Building2,
  ScrollText,
  Plus,
  ChevronDown,
  ChevronRight,
  MapPin,
  Mail,
  Globe,
  Clock,
  Languages,
  Briefcase,
  Users,
  Cpu,
  Building,
  FileText,
  Hash,
  Link as LinkIcon,
  Flag,
  Layers,
  Pencil,
  Trash2,
  Sparkles,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface RegulationEntry {
  id: string;
  regulationName: string;
  frameworkType: string;
  applicability: "Mandatory" | "Recommended" | "Optional";
  justification: string;
  onboardFramework: string;
  masterFrameworkId: string | null;
  isSubscribed: boolean;
}

interface RegulatoryProfile {
  id: string;
  fullLegalEntityName: string;
  registrationNo: string;
  url: string;
  country: string;
  industrySectors: string;
  otherIndustry: string | null;
  organisationType: string;
  countriesOfOperation: string;
  headquarterAddress: string;
  adminContactEmail: string;
  timeZone: string;
  language: string;
  businessModel: string;
  targetAudience: string;
  technologyUsed: string;
  createdAt: string;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function SectionCollapsible({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-md hover:bg-muted/50 transition-colors text-left">
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-9 pb-3 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FieldRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function BadgeList({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="text-xs font-normal">
          {item}
        </Badge>
      ))}
    </div>
  );
}

export default function RegulatoryIntelligenceHubPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<RegulatoryProfile[]>([]);
  const [regulations, setRegulations] = useState<RegulationEntry[]>([]);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/compliance/regulatory-intelligence/profiles");
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.data || []);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/compliance/regulatory-intelligence/profiles/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Profile deleted successfully") });
        fetchProfiles();
      } else {
        throw new Error("Delete failed");
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete profile"), variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const handleSubscribe = async (regulation: RegulationEntry) => {
    if (!regulation.masterFrameworkId || regulation.isSubscribed) return;
    setSubscribingId(regulation.id);
    try {
      const res = await fetch("/api/compliance/regulatory-intelligence/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameworkId: regulation.masterFrameworkId }),
      });
      if (res.ok) {
        setRegulations((prev) =>
          prev.map((r) => r.id === regulation.id ? { ...r, isSubscribed: true } : r)
        );
        toast({ title: t("Success"), description: t("Framework subscribed successfully") });
      } else {
        const data = await res.json();
        throw new Error(data.error || "Subscribe failed");
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: error instanceof Error ? error.message : t("Failed to subscribe framework"),
        variant: "destructive",
      });
    } finally {
      setSubscribingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("Regulatory Intelligence Hub")}</h1>
      </div>

      <Tabs defaultValue="organisation-profile" className="w-full">
        <TabsList>
          <TabsTrigger value="organisation-profile" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t("Organisation Profile")}
          </TabsTrigger>
          <TabsTrigger value="regulation-list" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            {t("Regulation List")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organisation-profile" className="mt-4">
          {/* Add Profile Button */}
          <div className="flex justify-end mb-4">
            <Button onClick={() => router.push("/compliance/regulatory-intelligence/add-profile")}>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Add Profile")}
            </Button>
          </div>

          {/* List View */}
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("Loading...")}
              </CardContent>
            </Card>
          ) : profiles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  {t("No organisation profiles yet. Click 'Add Profile' to create one.")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {profiles.map((profile) => {
                const sectors = parseJsonArray(profile.industrySectors);
                const operationCountries = parseJsonArray(profile.countriesOfOperation);
                const audiences = parseJsonArray(profile.targetAudience);
                const technologies = parseJsonArray(profile.technologyUsed);

                return (
                  <Card key={profile.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Building className="h-5 w-5 text-primary" />
                          {profile.fullLegalEntityName}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              toast({ title: t("Coming Soon"), description: t("AI-powered framework suggestions will be available soon.") });
                            }}
                          >
                            <Sparkles className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                            {t("Suggest Frameworks")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/compliance/regulatory-intelligence/edit-profile/${profile.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(profile.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-1">
                      {/* Legal Identity Section */}
                      <SectionCollapsible title={t("Legal Identity")} icon={FileText} defaultOpen>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                          <FieldRow icon={Hash} label={t("Registration No")} value={profile.registrationNo} />
                          <FieldRow icon={LinkIcon} label={t("URL")} value={profile.url} />
                          <FieldRow icon={Flag} label={t("Country")} value={profile.country} />
                        </div>
                      </SectionCollapsible>

                      {/* Scope and Presence Section */}
                      <SectionCollapsible title={t("Scope and Presence")} icon={Globe}>
                        <div className="space-y-3">
                          <div>
                            <span className="text-xs text-muted-foreground">{t("Industry/Sector")}</span>
                            <BadgeList items={sectors} />
                            {profile.otherIndustry && (
                              <p className="text-sm text-muted-foreground mt-1">{t("Other")}: {profile.otherIndustry}</p>
                            )}
                          </div>
                          <FieldRow icon={Building} label={t("Organisation Type")} value={profile.organisationType} />
                          <div>
                            <span className="text-xs text-muted-foreground">{t("Countries of Operation")}</span>
                            <BadgeList items={operationCountries} />
                          </div>
                        </div>
                      </SectionCollapsible>

                      {/* Physical Presence Section */}
                      <SectionCollapsible title={t("Physical Presence")} icon={MapPin}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                          <FieldRow icon={MapPin} label={t("Headquarter Address")} value={profile.headquarterAddress} />
                          <FieldRow icon={Mail} label={t("Email of Admin Contact")} value={profile.adminContactEmail} />
                        </div>
                      </SectionCollapsible>

                      {/* Regional Preference Section */}
                      <SectionCollapsible title={t("Regional Preference")} icon={Clock}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                          <FieldRow icon={Clock} label={t("Time Zone")} value={profile.timeZone} />
                          <FieldRow icon={Languages} label={t("Language")} value={profile.language} />
                        </div>
                      </SectionCollapsible>

                      {/* Business Context for AI Section */}
                      <SectionCollapsible title={t("Business Context for AI")} icon={Layers}>
                        <div className="space-y-3">
                          <FieldRow icon={Briefcase} label={t("Business Model")} value={profile.businessModel} />
                          <div>
                            <div className="flex items-start gap-3 py-1.5">
                              <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <span className="text-xs text-muted-foreground">{t("Target Audience")}</span>
                                <BadgeList items={audiences} />
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-start gap-3 py-1.5">
                              <Cpu className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <span className="text-xs text-muted-foreground">{t("Technology Used")}</span>
                                <BadgeList items={technologies} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </SectionCollapsible>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="regulation-list" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Regulation Name")}</TableHead>
                    <TableHead>{t("Framework/Regulation/Law/Standard")}</TableHead>
                    <TableHead>{t("Mandatory/Recommended/Optional")}</TableHead>
                    <TableHead>{t("Justification")}</TableHead>
                    <TableHead>{t("Onboard Framework")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regulations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t("No regulations yet. Use 'Suggest Frameworks' on an organisation profile to generate recommendations.")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    regulations.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">{reg.regulationName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{reg.frameworkType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              reg.applicability === "Mandatory"
                                ? "destructive"
                                : reg.applicability === "Recommended"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {t(reg.applicability)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">
                          {reg.justification}
                        </TableCell>
                        <TableCell>
                          {reg.isSubscribed ? (
                            <div className="flex items-center gap-1.5 text-green-600">
                              <Check className="h-4 w-4" />
                              <span className="text-sm font-medium">{t("Subscribed")}</span>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={subscribingId === reg.id || !reg.masterFrameworkId}
                              onClick={() => handleSubscribe(reg)}
                            >
                              {subscribingId === reg.id ? t("Subscribing...") : t("Subscribe")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Profile")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this organisation profile? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
