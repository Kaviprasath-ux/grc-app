"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  residualRiskRating: number | null;
  inherentRiskRating: number | null;
  dueDate: string | null;
  owner: { fullName: string } | null;
  category: { name: string } | null;
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

const strategyOptions = ["Accept", "Avoid", "Transfer", "Treat"];
const progressOptions = ["Open", "In-Progress", "Completed", "Awaiting Approval"];

export default function RiskResponsePage() {
  const router = useRouter();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [progressFilter, setProgressFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
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
    if (strategyFilter !== "all" && risk.responseStrategy !== strategyFilter) return false;
    if (progressFilter !== "all" && risk.status !== progressFilter) return false;
    if (categoryFilter !== "all" && risk.category?.name !== categoryFilter) return false;
    if (ratingFilter !== "all" && risk.riskRating !== ratingFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!risk.name.toLowerCase().includes(search) &&
          !risk.riskId.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Summary counts for charts
  const totalCount = filteredRisks.length;
  const completedCount = filteredRisks.filter(r => r.status === "Completed").length;
  const openCount = filteredRisks.filter(r => r.status === "Open").length;
  const inProgressCount = filteredRisks.filter(r => r.status === "In-Progress").length;

  // Strategy distribution for chart
  const strategyDistribution = {
    Accept: filteredRisks.filter(r => r.responseStrategy === "Accept").length,
    Avoid: filteredRisks.filter(r => r.responseStrategy === "Avoid").length,
    Transfer: filteredRisks.filter(r => r.responseStrategy === "Transfer").length,
    Treat: filteredRisks.filter(r => r.responseStrategy === "Treat").length,
    "Not Set": filteredRisks.filter(r => !r.responseStrategy).length,
  };

  // Rating distribution for chart
  const ratingDistribution = {
    "Low Risk": filteredRisks.filter(r => r.riskRating === "Low Risk").length,
    "High": filteredRisks.filter(r => r.riskRating === "High").length,
    "very high": filteredRisks.filter(r => r.riskRating === "very high").length,
    "Catastrophic": filteredRisks.filter(r => r.riskRating === "Catastrophic").length,
  };

  const getRatingFromScore = (score: number) => {
    if (score <= 10) return "Low Risk";
    if (score <= 50) return "High";
    if (score <= 99) return "very high";
    return "Catastrophic";
  };

  const handleStatusClick = (status: string) => {
    setProgressFilter(prev => prev === status ? "all" : status);
  };

  const getActionButton = (risk: Risk) => {
    switch (risk.status) {
      case "Open":
        return <Button size="sm" onClick={() => router.push(`/risk-management/response/${risk.id}`)}>Respond</Button>;
      case "In-Progress":
        return <Button size="sm" variant="secondary" onClick={() => router.push(`/risk-management/response/${risk.id}`)}>Resume</Button>;
      case "Completed":
      case "Awaiting Approval":
        return <Button size="sm" variant="outline" onClick={() => router.push(`/risk-management/response/${risk.id}`)}>View</Button>;
      default:
        return <Button size="sm" onClick={() => router.push(`/risk-management/response/${risk.id}`)}>View</Button>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Response Strategy"
        description="Define and track risk response strategies"
      />

      {/* Summary Cards - Clickable */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            progressFilter === "Open" && "ring-2 ring-primary"
          )}
          onClick={() => handleStatusClick("Open")}
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
            progressFilter === "In-Progress" && "ring-2 ring-primary"
          )}
          onClick={() => handleStatusClick("In-Progress")}
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
            progressFilter === "Completed" && "ring-2 ring-primary"
          )}
          onClick={() => handleStatusClick("Completed")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Response Strategy Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(strategyDistribution).map(([strategy, count]) => (
                <div key={strategy} className="flex items-center gap-3">
                  <div className="w-24 text-sm">{strategy}</div>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        strategy === "Accept" && "bg-blue-500",
                        strategy === "Avoid" && "bg-purple-500",
                        strategy === "Transfer" && "bg-orange-500",
                        strategy === "Treat" && "bg-green-500",
                        strategy === "Not Set" && "bg-gray-400",
                      )}
                      style={{ width: `${totalCount > 0 ? (count / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-8 text-sm text-right">{count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Risk Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(ratingDistribution).map(([rating, count]) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="w-24 text-sm">{rating}</div>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        ratingColors[rating]
                      )}
                      style={{ width: `${totalCount > 0 ? (count / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-8 text-sm text-right">{count}</div>
                </div>
              ))}
            </div>
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
            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Response Strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Strategies</SelectItem>
                {strategyOptions.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </div>
        </CardContent>
      </Card>

      {/* Risk Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRisks.map(risk => (
          <Card key={risk.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-sm">{risk.riskId}</CardTitle>
                  <CardDescription className="line-clamp-2">{risk.name}</CardDescription>
                </div>
                {getActionButton(risk)}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Risk Rating</span>
                {risk.riskRating ? (
                  <Badge className={ratingColors[risk.riskRating]}>{risk.riskRating}</Badge>
                ) : (
                  <Badge variant="outline">Not Assessed</Badge>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Strategy</span>
                <span className="text-sm font-medium">{risk.responseStrategy || "Not Set"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Owner</span>
                <span className="text-sm">{risk.owner?.fullName || "-"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Due Date</span>
                <span className="text-sm">{risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : "-"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline">{risk.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredRisks.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No risks found matching the selected filters
          </div>
        )}
      </div>
    </div>
  );
}
