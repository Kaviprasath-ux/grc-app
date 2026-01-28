"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ArrowUpDown,
  Eye,
  Search,
  UserCheck,
  Server,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  functionalGrouping: string | null;
  status: string;
  entities: string;
  domain: { id: string; name: string; code?: string } | null;
  department: { id: string; name: string } | null;
  framework: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  owner?: { id: string; name: string } | null;
}

interface Framework {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
}

const FUNCTIONAL_GROUPINGS = [
  "Govern",
  "Identify",
  "Protect",
  "Detect",
  "Respond",
  "Recover",
];

const DONUT_COLORS = [
  "#3b82f6", // blue - Govern
  "#f97316", // orange - Identify
  "#22c55e", // green - Protect
  "#ef4444", // red - Detect
  "#a855f7", // purple - Respond
  "#78716c", // brown - Recover
];

export default function CustomerControlsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const customerId = params.customerId as string;

  const [controls, setControls] = useState<Control[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeView, setActiveView] = useState<"dashboard" | "all">("all");
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [fgFilter, setFgFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [showColumns, setShowColumns] = useState(true);

  useEffect(() => {
    fetchCustomer();
    fetchFrameworks();
    fetchControls();
  }, [customerId]);

  useEffect(() => {
    fetchControls();
  }, [selectedFrameworkId]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch("/api/grc/customers");
      if (response.ok) {
        const data = await response.json();
        const found = data.find((c: Customer) => c.id === customerId);
        setCustomer(found || null);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  };

  const fetchFrameworks = async () => {
    try {
      const response = await fetch(
        `/api/grc/customers/${customerId}/frameworks`
      );
      if (response.ok) {
        const data = await response.json();
        setFrameworks(data);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    }
  };

  const fetchControls = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (selectedFrameworkId && selectedFrameworkId !== "all") {
        queryParams.set("frameworkId", selectedFrameworkId);
      }
      const response = await fetch(
        `/api/grc/customers/${customerId}/controls?${queryParams.toString()}`
      );
      if (response.ok) {
        const data = await response.json();
        setControls(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Controls API error:", response.status, errorData);
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = controls.length;
    const nonCompliant = controls.filter(
      (c) => c.status === "Non Compliant"
    ).length;
    const compliant = controls.filter((c) => c.status === "Compliant").length;
    const notApplicable = controls.filter(
      (c) => c.status === "Not Applicable"
    ).length;
    return { total, nonCompliant, compliant, notApplicable };
  }, [controls]);

  // Functional grouping data for donut chart
  const fgData = useMemo(() => {
    const counts: Record<string, number> = {};
    controls.forEach((c) => {
      const fg = c.functionalGrouping || "Unknown";
      counts[fg] = (counts[fg] || 0) + 1;
    });
    const total = controls.length || 1;
    return FUNCTIONAL_GROUPINGS.filter((fg) => counts[fg]).map((fg, i) => ({
      label: fg,
      count: counts[fg] || 0,
      percentage: (((counts[fg] || 0) / total) * 100).toFixed(1),
      color: DONUT_COLORS[i],
    }));
  }, [controls]);

  // Unique domains for filter
  const domains = useMemo(() => {
    const domainMap = new Map<string, string>();
    controls.forEach((c) => {
      if (c.domain) domainMap.set(c.domain.id, c.domain.name);
    });
    return Array.from(domainMap.entries()).map(([id, name]) => ({ id, name }));
  }, [controls]);

  // Filtered and sorted controls
  const filteredControls = useMemo(() => {
    let result = [...controls];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.controlCode.toLowerCase().includes(q)
      );
    }

    if (domainFilter && domainFilter !== "all") {
      result = result.filter((c) => c.domain?.id === domainFilter);
    }

    if (fgFilter && fgFilter !== "all") {
      result = result.filter((c) => c.functionalGrouping === fgFilter);
    }

    result.sort((a, b) => {
      let valA = "";
      let valB = "";
      switch (sortField) {
        case "name":
          valA = a.name;
          valB = b.name;
          break;
        case "controlCode":
          valA = a.controlCode;
          valB = b.controlCode;
          break;
        case "functionalGrouping":
          valA = a.functionalGrouping || "";
          valB = b.functionalGrouping || "";
          break;
        case "status":
          valA = a.status;
          valB = b.status;
          break;
        case "domain":
          valA = a.domain?.name || "";
          valB = b.domain?.name || "";
          break;
        default:
          valA = a.name;
          valB = b.name;
      }
      return sortAsc
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });

    return result;
  }, [controls, searchQuery, domainFilter, fgFilter, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleBack = () => {
    router.push(`/grc/customers/${customerId}/frameworks`);
  };

  // Donut chart SVG
  const renderDonutChart = () => {
    if (fgData.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          No control data available for chart.
        </div>
      );
    }

    const total = controls.length;
    const size = 280;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = 120;
    const innerR = 70;

    let currentAngle = -90;

    const paths = fgData.map((item) => {
      const angle = (item.count / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1Outer = cx + outerR * Math.cos(startRad);
      const y1Outer = cy + outerR * Math.sin(startRad);
      const x2Outer = cx + outerR * Math.cos(endRad);
      const y2Outer = cy + outerR * Math.sin(endRad);
      const x1Inner = cx + innerR * Math.cos(endRad);
      const y1Inner = cy + innerR * Math.sin(endRad);
      const x2Inner = cx + innerR * Math.cos(startRad);
      const y2Inner = cy + innerR * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;

      const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
      const labelR = (outerR + innerR) / 2;
      const labelX = cx + labelR * Math.cos(midAngle);
      const labelY = cy + labelR * Math.sin(midAngle);

      const d = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
        `L ${x1Inner} ${y1Inner}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
        "Z",
      ].join(" ");

      return { d, color: item.color, label: `${item.percentage}%`, labelX, labelY, angle };
    });

    return (
      <div className="flex items-center gap-12">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths.map((p, i) => (
            <g key={i}>
              <path d={p.d} fill={p.color} stroke="white" strokeWidth="2" />
              {p.angle > 15 && (
                <text
                  x={p.labelX}
                  y={p.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="600"
                >
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        <div className="space-y-2">
          {fgData.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-700">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && controls.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={handleBack}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-blue-700">Controls</h1>
          </div>
          <p className="text-sm text-blue-800 font-medium bg-blue-100 px-2 py-0.5 rounded inline-block">
            {customer?.customerName || "Loading..."}
          </p>
        </div>
      </div>

      {/* Tabs + Framework Dropdown */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0">
          <button
            className={`px-6 py-2.5 text-sm font-semibold transition-colors ${
              activeView === "dashboard"
                ? "bg-blue-800 text-white"
                : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
            }`}
            onClick={() => setActiveView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`px-6 py-2.5 text-sm font-semibold transition-colors ${
              activeView === "all"
                ? "bg-blue-800 text-white"
                : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
            }`}
            onClick={() => setActiveView("all")}
          >
            All Controls
          </button>
        </div>

        <Select
          value={selectedFrameworkId}
          onValueChange={setSelectedFrameworkId}
        >
          <SelectTrigger className="w-[200px] border-gray-300">
            <SelectValue placeholder="Framework" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Frameworks</SelectItem>
            {frameworks.map((fw) => (
              <SelectItem key={fw.id} value={fw.id}>
                {fw.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dashboard View */}
      {activeView === "dashboard" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Functional Grouping
          </h2>
          <div className="flex justify-center py-8">
            {renderDonutChart()}
          </div>
        </div>
      )}

      {/* All Controls View */}
      {activeView === "all" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: "Total Controls",
                value: stats.total,
                icon: <UserCheck className="h-8 w-8 text-white/80" />,
              },
              {
                label: "Non Compliant",
                value: stats.nonCompliant,
                icon: <Server className="h-8 w-8 text-white/80" />,
              },
              {
                label: "Compliant",
                value: stats.compliant,
                icon: <CheckCircle className="h-8 w-8 text-white/80" />,
              },
              {
                label: "Not Applicable",
                value: stats.notApplicable,
                icon: <XCircle className="h-8 w-8 text-white/80" />,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl p-6 text-white text-center"
                style={{
                  background:
                    "linear-gradient(135deg, #0a0a5c 0%, #1a1a8c 50%, #2d1b69 100%)",
                }}
              >
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center">
                    {card.icon}
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1">{card.value}</div>
                <div className="text-sm text-white/80">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search By Control Code , Name"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-[180px] border-gray-300">
                <SelectValue placeholder="Domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fgFilter} onValueChange={setFgFilter}>
              <SelectTrigger className="w-[200px] border-gray-300">
                <SelectValue placeholder="Functional Grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groupings</SelectItem>
                {FUNCTIONAL_GROUPINGS.map((fg) => (
                  <SelectItem key={fg} value={fg}>
                    {fg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Controls Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    background:
                      "linear-gradient(135deg, #0a0a5c 0%, #1a1a8c 50%, #0d0d6b 100%)",
                  }}
                >
                  <th className="text-left p-4 text-white font-semibold">
                    <button
                      className="flex items-center gap-1 hover:text-white/80"
                      onClick={() => handleSort("name")}
                    >
                      Control Name
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-white font-semibold">
                    <button
                      className="flex items-center gap-1 hover:text-white/80"
                      onClick={() => handleSort("controlCode")}
                    >
                      Control Code
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-white font-semibold">
                    <button
                      className="flex items-center gap-1 hover:text-white/80"
                      onClick={() => handleSort("functionalGrouping")}
                    >
                      FunctionGroup...
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-white font-semibold">
                    <button
                      className="flex items-center gap-1 hover:text-white/80"
                      onClick={() => handleSort("status")}
                    >
                      Status
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-white font-semibold">
                    Assignee
                  </th>
                  <th className="text-left p-4 text-white font-semibold">
                    <button
                      className="flex items-center gap-1 hover:text-white/80"
                      onClick={() => handleSort("domain")}
                    >
                      Domain Name
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-center p-4 text-white font-semibold w-12">
                    <button
                      onClick={() => setShowColumns(!showColumns)}
                      className="text-white/80 hover:text-white border border-white/40 rounded p-1"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredControls.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 text-gray-500"
                    >
                      No controls found.
                    </td>
                  </tr>
                ) : (
                  filteredControls.map((control, index) => (
                    <tr
                      key={control.id}
                      className={`border-b hover:bg-blue-50/50 ${
                        index % 2 === 0 ? "bg-white" : "bg-blue-50/30"
                      }`}
                    >
                      <td className="p-4 text-gray-800" title={control.name}>
                        {control.name.length > 25
                          ? control.name.substring(0, 25) + "..."
                          : control.name}
                      </td>
                      <td className="p-4 text-gray-700">
                        {control.controlCode}
                      </td>
                      <td className="p-4 text-gray-700">
                        {control.functionalGrouping || "-"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-sm font-medium ${
                            control.status === "Compliant"
                              ? "text-green-600"
                              : control.status === "Non Compliant"
                              ? "text-red-600"
                              : control.status === "Partial Compliant"
                              ? "text-yellow-600"
                              : "text-gray-500"
                          }`}
                        >
                          {control.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-700">
                        {control.assignee?.name || "-"}
                      </td>
                      <td
                        className="p-4 text-gray-700"
                        title={control.domain?.name || ""}
                      >
                        {control.domain?.name
                          ? control.domain.name.length > 22
                            ? control.domain.name.substring(0, 22) + "..."
                            : control.domain.name
                          : "-"}
                      </td>
                      <td className="p-4 text-center">
                        {showColumns && (
                          <span className="text-xs text-gray-500">
                            {control.entities}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
