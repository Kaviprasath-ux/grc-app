"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, DataGrid } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  status: string;
  assessmentStatus: string;
  category: { name: string } | null;
  owner: { fullName: string } | null;
  riskType: string;
}

interface RiskCategory {
  id: string;
  name: string;
}

const ratingColors: Record<string, string> = {
  "Low Risk": "bg-green-500",
  "High": "bg-orange-500",
  "very high": "bg-yellow-500",
  "Catastrophic": "bg-red-500",
};

const statusButtons: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  "Open": { label: "Initiate", variant: "default" },
  "In-Progress": { label: "Resume", variant: "secondary" },
  "Completed": { label: "Re-assess", variant: "outline" },
  "Awaiting Approval": { label: "View", variant: "outline" },
};

export default function RiskAssessmentPage() {
  const router = useRouter();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [risksRes, categoriesRes] = await Promise.all([
          fetch("/api/risks"),
          fetch("/api/risk-categories"),
        ]);
        setRisks(await risksRes.json());
        setCategories(await categoriesRes.json());
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Filter risks
  const filteredRisks = risks.filter(risk => {
    if (statusFilter !== "all" && risk.status !== statusFilter) return false;
    if (ratingFilter !== "all" && risk.riskRating !== ratingFilter) return false;
    if (categoryFilter !== "all" && risk.category?.name !== categoryFilter) return false;
    if (typeFilter !== "all" && risk.riskType !== typeFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!risk.name.toLowerCase().includes(search) &&
          !risk.riskId.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Status counts
  const totalCount = risks.length;
  const openCount = risks.filter(r => r.status === "Open").length;
  const inProgressCount = risks.filter(r => r.status === "In-Progress").length;
  const completedCount = risks.filter(r => r.status === "Completed").length;
  const awaitingCount = risks.filter(r => r.status === "Awaiting Approval").length;

  const handleStatusCardClick = (status: string) => {
    setStatusFilter(prev => prev === status ? "all" : status);
  };

  const navigateToAssessment = (riskId: string) => {
    router.push(`/risk-management/assessment/${riskId}`);
  };

  const columns: ColumnDef<Risk>[] = [
    { accessorKey: "riskId", header: "Risk ID" },
    { accessorKey: "name", header: "Risk Name" },
    {
      accessorKey: "description",
      header: "Risk Description",
      cell: ({ row }) => (
        <span className="truncate max-w-[150px] block">{row.original.description || "-"}</span>
      ),
    },
    {
      accessorKey: "riskRating",
      header: "Risk Rating",
      cell: ({ row }) => row.original.riskRating ? (
        <Badge className={ratingColors[row.original.riskRating]}>{row.original.riskRating}</Badge>
      ) : (
        <Badge variant="outline">Not Assessed</Badge>
      ),
    },
    {
      accessorKey: "category",
      header: "Risk Category",
      cell: ({ row }) => row.original.category?.name || "-",
    },
    {
      accessorKey: "owner",
      header: "Risk Owner",
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    { accessorKey: "riskType", header: "Risk Type" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => {
        const buttonConfig = statusButtons[row.original.status] || statusButtons["Open"];
        return (
          <Button
            size="sm"
            variant={buttonConfig.variant}
            onClick={() => navigateToAssessment(row.original.id)}
          >
            {buttonConfig.label}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Assessment"
        description="Assess and evaluate organizational risks"
      />

      {/* Status Cards - Clickable */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            statusFilter === "Open" && "ring-2 ring-primary"
          )}
          onClick={() => handleStatusCardClick("Open")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{openCount}</div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            statusFilter === "In-Progress" && "ring-2 ring-primary"
          )}
          onClick={() => handleStatusCardClick("In-Progress")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{inProgressCount}</div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            statusFilter === "Completed" && "ring-2 ring-primary"
          )}
          onClick={() => handleStatusCardClick("Completed")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            statusFilter === "Awaiting Approval" && "ring-2 ring-primary"
          )}
          onClick={() => handleStatusCardClick("Awaiting Approval")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{awaitingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search By ID, Name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Risk Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="Low Risk">Low Risk</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="very high">Very High</SelectItem>
                <SelectItem value="Catastrophic">Catastrophic</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Risk Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Asset Risk">Asset Risk</SelectItem>
                <SelectItem value="Process Risk">Process Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent className="pt-6">
          <DataGrid columns={columns} data={filteredRisks} />
        </CardContent>
      </Card>
    </div>
  );
}
