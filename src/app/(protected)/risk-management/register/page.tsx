"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, FileDown, FileUp, History } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface RiskCategory {
  id: string;
  name: string;
}

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskType: string;
  category: RiskCategory | null;
  owner: { fullName: string } | null;
  riskRating: string;
  status: string;
}

const ratingColors: Record<string, string> = {
  "Low Risk": "bg-green-500",
  "High": "bg-orange-500",
  "very high": "bg-yellow-500",
  "Catastrophic": "bg-red-500",
};

export default function RiskRegisterPage() {
  const router = useRouter();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [riskCategories, setRiskCategories] = useState<RiskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Delete dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [risksRes, categoriesRes] = await Promise.all([
        fetch("/api/risks"),
        fetch("/api/risk-categories"),
      ]);
      setRisks(await risksRes.json());
      setRiskCategories(await categoriesRes.json());
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter risks
  const filteredRisks = risks.filter(risk => {
    if (statusFilter !== "all" && risk.status !== statusFilter) return false;
    if (ratingFilter !== "all" && risk.riskRating !== ratingFilter) return false;
    if (categoryFilter !== "all" && risk.category?.id !== categoryFilter) return false;
    if (typeFilter !== "all" && risk.riskType !== typeFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!risk.name.toLowerCase().includes(search) &&
          !risk.riskId.toLowerCase().includes(search) &&
          !risk.riskRating?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Status counts
  const totalCount = risks.length;
  const openCount = risks.filter(r => r.status === "Open").length;
  const inProgressCount = risks.filter(r => r.status === "In-Progress").length;
  const closedCount = risks.filter(r => r.status === "Closed").length;

  const handleDeleteRisk = async () => {
    if (!selectedRisk) return;
    const res = await fetch(`/api/risks/${selectedRisk.id}`, { method: "DELETE" });
    if (res.ok) {
      setRisks(prev => prev.filter(r => r.id !== selectedRisk.id));
      setIsDeleteOpen(false);
      setSelectedRisk(null);
    }
  };

  const handleStatusCardClick = (status: string) => {
    setStatusFilter(prev => prev === status ? "all" : status);
  };

  const columns: ColumnDef<Risk>[] = [
    { accessorKey: "riskId", header: "Risk ID" },
    { accessorKey: "name", header: "Risk Name" },
    {
      accessorKey: "description",
      header: "Risk Description",
      cell: ({ row }) => (
        <span className="truncate max-w-[200px] block">
          {row.original.description || "-"}
        </span>
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
    {
      accessorKey: "riskRating",
      header: "Risk Rating",
      cell: ({ row }) => row.original.riskRating ? (
        <Badge className={ratingColors[row.original.riskRating]}>
          {row.original.riskRating}
        </Badge>
      ) : "-",
    },
    { accessorKey: "riskType", header: "Risk Type" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/risk-management/register/${row.original.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/risk-management/register/${row.original.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSelectedRisk(row.original); setIsDeleteOpen(true); }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Register"
        description="Risk Management"
        actions={[
          {
            label: "New Risk",
            onClick: () => router.push("/risk-management/register/new"),
            variant: "default" as const,
            icon: Plus,
          },
          {
            label: "Export",
            onClick: () => {},
            variant: "outline" as const,
            icon: FileDown,
          },
          {
            label: "Import",
            onClick: () => {},
            variant: "outline" as const,
            icon: FileUp,
          },
          {
            label: "Activity Log",
            onClick: () => {},
            variant: "outline" as const,
            icon: History,
          },
        ]}
      />

      {/* Status Cards - Clickable */}
      <div className="grid grid-cols-4 gap-4">
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
            statusFilter === "Closed" && "ring-2 ring-primary"
          )}
          onClick={() => handleStatusCardClick("Closed")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{closedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search By ID, Name, Risk Rating"
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
                {riskCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Risk type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Asset Risk">Asset Risk</SelectItem>
                <SelectItem value="Process Risk">Process Risk</SelectItem>
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
                <SelectItem value="very high">very high</SelectItem>
                <SelectItem value="Catastrophic">Catastrophic</SelectItem>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete risk {selectedRisk?.riskId}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRisk}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
