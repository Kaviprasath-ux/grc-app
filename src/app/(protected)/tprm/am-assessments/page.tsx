"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Home, Search, PlayCircle, FileText, Loader2 } from "lucide-react";

interface Assessment {
  id: string;
  assessmentCode: string;
  assessmentType: string;
  status: string;
  questionnaireTemplate: string | null;
  createdAt: string;
  updatedAt: string;
  vendorSubmissionDate: string | null;
  vendor: { id: string; name: string; vendorCode: string };
  initiatedBy: { id: string; fullName: string } | null;
  assessor: { id: string; fullName: string } | null;
}

const STATUS_VARIANTS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Returned: "bg-orange-100 text-orange-700",
  Submitted: "bg-purple-100 text-purple-700",
  "Under Review": "bg-indigo-100 text-indigo-700",
  Completed: "bg-green-100 text-green-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
  Reviewed: "bg-teal-100 text-teal-700",
  Cancelled: "bg-gray-200 text-gray-500",
  Expired: "bg-yellow-100 text-yellow-700",
  Offboard_In_Progress: "bg-orange-100 text-orange-700",
  Offboard_Awaiting_Response: "bg-amber-100 text-amber-700",
  Offboard_Approve_Assessor: "bg-purple-100 text-purple-700",
  Offboard_Approve_RM: "bg-indigo-100 text-indigo-700",
  Offboard_Approve_BO: "bg-blue-100 text-blue-700",
  Offboard_Completed: "bg-green-100 text-green-700",
};

export default function AMAssessmentsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("active");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchAssessments = useCallback(async (tab: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab, search });
      const res = await fetch(`/api/tprm/am-assessments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setAssessments(json.data || []);
    } catch {
      toast({ title: t("Error"), description: t("Failed to load assessments"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, toast, t]);

  useEffect(() => {
    fetchAssessments(activeTab);
  }, [activeTab, fetchAssessments]);

  const handleStartAssessment = (assessment: Assessment) => {
    // Route offboard assessments to the offboard questionnaire page
    if (assessment.assessmentType === "Offboard Assessment") {
      router.push(`/tprm/am-assessments/offboard/${assessment.id}`);
      return;
    }
    router.push(`/tprm/am-assessments/${assessment.id}`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <span>/</span>
        <span>{t("TPRM")}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{t("Assessments")}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("Assessments")}</h1>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("Search assessments...")}
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">{t("Active")}</TabsTrigger>
          <TabsTrigger value="submitted">{t("Submitted")}</TabsTrigger>
          <TabsTrigger value="past">{t("Past")}</TabsTrigger>
          <TabsTrigger value="offboard">{t("Offboard")}</TabsTrigger>
        </TabsList>

        {["active", "submitted", "past", "offboard"].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : assessments.length === 0 ? (
                  <div className="text-center p-12 text-muted-foreground">
                    {t("No assessments found")}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Assessment Code")}</TableHead>
                        <TableHead>{t("Vendor")}</TableHead>
                        <TableHead>{t("Type")}</TableHead>
                        <TableHead>{t("Template")}</TableHead>
                        <TableHead>{t("Initiated By")}</TableHead>
                        <TableHead>{t("Status")}</TableHead>
                        <TableHead>{t("Date")}</TableHead>
                        <TableHead>{t("Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assessments.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.assessmentCode}</TableCell>
                          <TableCell>{a.vendor.name}</TableCell>
                          <TableCell>{a.assessmentType}</TableCell>
                          <TableCell>{a.questionnaireTemplate || "-"}</TableCell>
                          <TableCell>{a.initiatedBy?.fullName || "-"}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_VARIANTS[a.status] || "bg-gray-100 text-gray-700"}>
                              {t(a.status.replace(/_/g, " "))}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(a.createdAt)}</TableCell>
                          <TableCell>
                            {tab === "active" || (tab === "offboard" && ["Offboard_In_Progress", "Offboard_Awaiting_Response"].includes(a.status)) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartAssessment(a)}
                              >
                                <PlayCircle className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                                {a.status === "Draft" || a.status === "Offboard_In_Progress" ? t("Start") : t("Resume")}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartAssessment(a)}
                              >
                                <FileText className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                                {t("View")}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
