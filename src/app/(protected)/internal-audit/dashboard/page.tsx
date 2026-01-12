"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { toast } from "sonner";
import {
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight,
  Calendar,
  Upload,
  FileWarning,
  Loader2,
} from "lucide-react";

interface DashboardData {
  stats: {
    evidenceRequests: {
      pending: number;
      inProgress: number;
      submitted: number;
      reviewed: number;
      overdue: number;
      total: number;
    };
    capa: {
      open: number;
      inProgress: number;
      closed: number;
      overdue: number;
      total: number;
    };
  };
  recentEvidenceRequests: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    engagement: {
      auditId: string;
      engagementTitle: string;
      department: { name: string } | null;
    };
  }>;
  recentCAPAs: Array<{
    id: string;
    capaId: string;
    title: string;
    status: string;
    targetDate: string | null;
    finding: {
      findingId: string;
      finding: string;
      engagement: { auditId: string; engagementTitle: string };
    };
  }>;
  upcomingDueDates: Array<{
    id: string;
    title: string;
    dueDate: string;
    engagement: { auditId: string; engagementTitle: string };
  }>;
}

const statusColors: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Submitted: "bg-purple-100 text-purple-800",
  Reviewed: "bg-green-100 text-green-800",
  Open: "bg-yellow-100 text-yellow-800",
  Closed: "bg-green-100 text-green-800",
  Overdue: "bg-red-100 text-red-800",
};

export default function InternalAuditDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuditee =
    session?.user?.roles?.includes("Auditee") &&
    !session?.user?.roles?.includes("AuditHead") &&
    !session?.user?.roles?.includes("Auditor");

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/internal-audit/dashboard");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error("Failed to fetch dashboard data");
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntilDue = (dateString: string) => {
    const dueDate = new Date(dateString);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isAuditee ? "My Audit Tasks" : "Internal Audit Dashboard"}
          </h1>
          <p className="text-gray-500 mt-1">
            {isAuditee
              ? "Track your evidence requests and corrective actions"
              : "Overview of audit activities and tasks"}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Evidence Requests Card */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/internal-audit/fieldwork")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Evidence Requests
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats.evidenceRequests.total || 0}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {data?.stats.evidenceRequests.pending || 0} Pending
              </Badge>
              <Badge variant="outline" className="text-xs bg-yellow-50">
                {data?.stats.evidenceRequests.inProgress || 0} In Progress
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions Card */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending Actions
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data?.stats.evidenceRequests.pending || 0) +
                (data?.stats.capa.open || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Items requiring your attention
            </p>
          </CardContent>
        </Card>

        {/* CAPA Card */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/internal-audit/capa-tracking")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Corrective Actions
            </CardTitle>
            <ClipboardCheck className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats.capa.total || 0}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {data?.stats.capa.open || 0} Open
              </Badge>
              <Badge variant="outline" className="text-xs bg-green-50">
                {data?.stats.capa.closed || 0} Closed
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Card */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Overdue Items
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(data?.stats.evidenceRequests.overdue || 0) +
                (data?.stats.capa.overdue || 0)}
            </div>
            <p className="text-xs text-red-500 mt-2">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Evidence Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Evidence Requests</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/internal-audit/fieldwork")}
            >
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {data?.recentEvidenceRequests?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Upload className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No evidence requests assigned yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Audit ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentEvidenceRequests?.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push("/internal-audit/fieldwork")}
                    >
                      <TableCell className="font-medium">
                        {item.engagement.auditId}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {item.title}
                      </TableCell>
                      <TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[item.status] || ""}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent CAPAs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Corrective Actions</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/internal-audit/capa-tracking")}
            >
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {data?.recentCAPAs?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No corrective actions assigned</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CAPA ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Target Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentCAPAs?.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push("/internal-audit/capa-tracking")}
                    >
                      <TableCell className="font-medium">{item.capaId}</TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {item.title}
                      </TableCell>
                      <TableCell>{formatDate(item.targetDate)}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[item.status] || ""}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Due Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Upcoming Due Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.upcomingDueDates?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No upcoming deadlines</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.upcomingDueDates?.map((item) => {
                const daysUntil = getDaysUntilDue(item.dueDate);
                const isUrgent = daysUntil <= 3;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isUrgent ? "border-red-200 bg-red-50" : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isUrgent ? (
                        <FileWarning className="h-5 w-5 text-red-500" />
                      ) : (
                        <FileText className="h-5 w-5 text-blue-500" />
                      )}
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-gray-500">
                          {item.engagement.auditId} - {item.engagement.engagementTitle}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${isUrgent ? "text-red-600" : ""}`}>
                        {formatDate(item.dueDate)}
                      </p>
                      <p
                        className={`text-sm ${
                          isUrgent ? "text-red-500" : "text-gray-500"
                        }`}
                      >
                        {daysUntil === 0
                          ? "Due today"
                          : daysUntil === 1
                          ? "Due tomorrow"
                          : `${daysUntil} days left`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
