"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ArrowUpDown, Upload, Download, Plus, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";

interface RiskData {
  id: string;
  riskId: string;
  riskName: string;
  department: string;
  category: string;
  control: string;
  impact: string;
  riskScore: string;
  riskRating: string;
  status: string;
}

const dummyData: RiskData[] = [
  { id: "1", riskId: "RID003", riskName: "Ineffe...", department: "Inter...", category: "2025", control: "Com...", impact: "16", riskScore: "20", riskRating: "High", status: "Open" },
  { id: "2", riskId: "RID008", riskName: "Failur...", department: "Reve...", category: "2025", control: "Com...", impact: "12", riskScore: "6", riskRating: "Medium", status: "Open" },
  { id: "3", riskId: "RID002", riskName: "Insu...", department: "Oper...", category: "2025", control: "Oper...", impact: "16", riskScore: "25", riskRating: "Extreme", status: "Open" },
  { id: "4", riskId: "RID009", riskName: "Limit...", department: "Risk ...", category: "2025", control: "Cybe...", impact: "12", riskScore: "9", riskRating: "Medium", status: "Closed" },
  { id: "5", riskId: "RID0...", riskName: "High ...", department: "Hum...", category: "2025", control: "Strat...", impact: "3", riskScore: "1", riskRating: "Low", status: "Closed" },
  { id: "6", riskId: "RID0...", riskName: "Insu...", department: "Risk ...", category: "2025", control: "", impact: "", riskScore: "", riskRating: "", status: "Open" },
  { id: "7", riskId: "RID0...", riskName: "Inade...", department: "Oper...", category: "2025", control: "Oper...", impact: "15", riskScore: "25", riskRating: "Extreme", status: "Closed" },
  { id: "8", riskId: "RID0...", riskName: "Incon...", department: "Hum...", category: "2025", control: "", impact: "", riskScore: "", riskRating: "", status: "Open" },
  { id: "9", riskId: "RID0...", riskName: "Manu...", department: "Hum...", category: "2025", control: "", impact: "", riskScore: "", riskRating: "", status: "Open" },
  { id: "10", riskId: "RID0...", riskName: "Failur...", department: "Hum...", category: "2025", control: "", impact: "", riskScore: "", riskRating: "", status: "Open" },
  { id: "11", riskId: "RID0...", riskName: "Insu...", department: "Hum...", category: "2025", control: "", impact: "", riskScore: "", riskRating: "", status: "Open" },
];

export default function RiskRegisterPage() {
  const router = useRouter();
  const [data] = useState<RiskData[]>(dummyData);
  const [searchFilter, setSearchFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredData = data.filter(item => {
    const matchesSearch = searchFilter === "" ||
      item.riskId.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.riskName.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesYear = yearFilter === "all" || item.category === yearFilter;
    const matchesDept = departmentFilter === "all" || item.department.includes(departmentFilter);
    return matchesSearch && matchesYear && matchesDept;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handleEdit = (id: string) => {
    router.push(`/internal-audit/risk-register/${id}/edit`);
  };

  const handleDelete = (id: string) => {
    alert(`Delete Risk ${id}`);
  };

  const handleExport = () => {
    alert("Export functionality");
  };

  const handleImport = () => {
    alert("Import functionality");
  };

  const handleAIRecommended = () => {
    alert("AI Recommended Audits");
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Risk Register</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Upload className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Download className="h-4 w-4 mr-1" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleAIRecommended}>
            AI Recommended Audits
          </Button>
          <Button size="sm" onClick={() => router.push("/internal-audit/risk-register/add")} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
            <Plus className="h-4 w-4 mr-1" />
            Add Risk Manually
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search By Risk ID, Risk Description"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Select Year</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Department</SelectItem>
            <SelectItem value="Inter">Internal Audit</SelectItem>
            <SelectItem value="Hum">Human Resources</SelectItem>
            <SelectItem value="Oper">Operations</SelectItem>
            <SelectItem value="Reve">Revenue</SelectItem>
            <SelectItem value="Risk">Risk Management</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">R. <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">R. <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">D. <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">C. <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">C. <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">I. <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">R. <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">R. <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">S. <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-white font-semibold">
                <div className="flex items-center gap-1">Actions <Eye className="h-3 w-3" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row) => (
              <TableRow key={row.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">{row.riskId}</TableCell>
                <TableCell className="max-w-[80px] truncate">{row.riskName}</TableCell>
                <TableCell className="max-w-[60px] truncate">{row.department}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell className="max-w-[60px] truncate">{row.control}</TableCell>
                <TableCell>{row.impact}</TableCell>
                <TableCell>{row.riskScore}</TableCell>
                <TableCell>{row.riskRating}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(row.id)}>
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <Button variant="ghost" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
