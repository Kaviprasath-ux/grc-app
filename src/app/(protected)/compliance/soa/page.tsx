"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Shield,
} from "lucide-react";

interface SOAEntry {
  id: string;
  code: string;
  name: string;
  description: string | null;
  applicability: string | null;
  justification: string | null;
  implementationStatus: string | null;
  controlCompliance: string | null;
  framework?: { id: string; name: string; code: string } | null;
  controls?: Array<{
    control: {
      id: string;
      controlId: string;
      name: string;
      status: string;
    };
  }>;
}

interface Framework {
  id: string;
  name: string;
  code: string;
}

const applicabilityColors: Record<string, string> = {
  Applicable: "bg-green-100 text-green-800",
  "Not Applicable": "bg-gray-100 text-gray-800",
  "Partially Applicable": "bg-yellow-100 text-yellow-800",
};

const implementationStatusColors: Record<string, string> = {
  Implemented: "bg-green-100 text-green-800",
  "Partially Implemented": "bg-yellow-100 text-yellow-800",
  "Not Implemented": "bg-red-100 text-red-800",
  Planned: "bg-blue-100 text-blue-800",
};

const complianceColors: Record<string, string> = {
  Compliant: "bg-green-100 text-green-800",
  "Partially Compliant": "bg-yellow-100 text-yellow-800",
  "Non-Compliant": "bg-red-100 text-red-800",
  "Not Assessed": "bg-gray-100 text-gray-800",
};

export default function SOAPage() {
  const [entries, setEntries] = useState<SOAEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SOAEntry | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    frameworkId: "",
    applicability: "",
    implementationStatus: "",
  });

  // Reference data
  const [frameworks, setFrameworks] = useState<Framework[]>([]);

  // Edit form
  const [editForm, setEditForm] = useState({
    applicability: "",
    justification: "",
    implementationStatus: "",
    controlCompliance: "",
  });

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.frameworkId) params.append("frameworkId", filters.frameworkId);
      if (filters.applicability)
        params.append("applicability", filters.applicability);
      if (filters.implementationStatus)
        params.append("implementationStatus", filters.implementationStatus);

      const response = await fetch(`/api/soa?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }
    } catch (error) {
      console.error("Error fetching SOA entries:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchFrameworks = useCallback(async () => {
    try {
      const response = await fetch("/api/frameworks");
      if (response.ok) {
        const data = await response.json();
        setFrameworks(data);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchFrameworks();
  }, [fetchEntries, fetchFrameworks]);

  const handleEditClick = (entry: SOAEntry) => {
    setSelectedEntry(entry);
    setEditForm({
      applicability: entry.applicability || "",
      justification: entry.justification || "",
      implementationStatus: entry.implementationStatus || "",
      controlCompliance: entry.controlCompliance || "",
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEntry) return;

    try {
      const response = await fetch("/api/soa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedEntry.id,
          ...editForm,
        }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setSelectedEntry(null);
        fetchEntries();
      }
    } catch (error) {
      console.error("Error updating SOA entry:", error);
    }
  };

  const filteredEntries = entries.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate statistics
  const stats = {
    total: entries.length,
    applicable: entries.filter((e) => e.applicability === "Applicable").length,
    notApplicable: entries.filter((e) => e.applicability === "Not Applicable")
      .length,
    implemented: entries.filter((e) => e.implementationStatus === "Implemented")
      .length,
    compliant: entries.filter((e) => e.controlCompliance === "Compliant").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Statement of Applicability</h1>
          <p className="text-gray-600">
            Manage requirement applicability and implementation status
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export SOA
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Requirements</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {stats.applicable}
              </p>
              <p className="text-sm text-gray-500">Applicable</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-600">
                {stats.notApplicable}
              </p>
              <p className="text-sm text-gray-500">Not Applicable</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {stats.implemented}
              </p>
              <p className="text-sm text-gray-500">Implemented</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {stats.compliant}
              </p>
              <p className="text-sm text-gray-500">Compliant</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search requirements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <Label>Framework</Label>
                <Select
                  value={filters.frameworkId || "all"}
                  onValueChange={(value) =>
                    setFilters({ ...filters, frameworkId: value === "all" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All frameworks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All frameworks</SelectItem>
                    {frameworks.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Applicability</Label>
                <Select
                  value={filters.applicability || "all"}
                  onValueChange={(value) =>
                    setFilters({ ...filters, applicability: value === "all" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Applicable">Applicable</SelectItem>
                    <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                    <SelectItem value="Partially Applicable">
                      Partially Applicable
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Implementation</Label>
                <Select
                  value={filters.implementationStatus || "all"}
                  onValueChange={(value) =>
                    setFilters({ ...filters, implementationStatus: value === "all" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Implemented">Implemented</SelectItem>
                    <SelectItem value="Partially Implemented">
                      Partially Implemented
                    </SelectItem>
                    <SelectItem value="Not Implemented">Not Implemented</SelectItem>
                    <SelectItem value="Planned">Planned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      frameworkId: "",
                      applicability: "",
                      implementationStatus: "",
                    })
                  }
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SOA Table */}
      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Framework</TableHead>
                <TableHead>Applicability</TableHead>
                <TableHead>Implementation</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Controls</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-500">No requirements found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.code}</TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="truncate">{entry.name}</p>
                        {entry.description && (
                          <p className="text-xs text-gray-500 truncate">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.framework?.code || "-"}
                    </TableCell>
                    <TableCell>
                      {entry.applicability ? (
                        <Badge
                          className={
                            applicabilityColors[entry.applicability] ||
                            "bg-gray-100"
                          }
                        >
                          {entry.applicability === "Applicable" ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : entry.applicability === "Not Applicable" ? (
                            <XCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {entry.applicability}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not Set</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.implementationStatus ? (
                        <Badge
                          className={
                            implementationStatusColors[
                              entry.implementationStatus
                            ] || "bg-gray-100"
                          }
                        >
                          {entry.implementationStatus}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not Set</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.controlCompliance ? (
                        <Badge
                          className={
                            complianceColors[entry.controlCompliance] ||
                            "bg-gray-100"
                          }
                        >
                          {entry.controlCompliance}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not Assessed</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entry.controls?.length || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(entry)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit SOA Entry - {selectedEntry?.code}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-500">Requirement</Label>
              <p className="font-medium">{selectedEntry?.name}</p>
            </div>
            <div>
              <Label>Applicability</Label>
              <Select
                value={editForm.applicability}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, applicability: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select applicability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Applicable">Applicable</SelectItem>
                  <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                  <SelectItem value="Partially Applicable">
                    Partially Applicable
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Justification</Label>
              <Textarea
                value={editForm.justification}
                onChange={(e) =>
                  setEditForm({ ...editForm, justification: e.target.value })
                }
                placeholder="Provide justification for applicability decision"
                rows={3}
              />
            </div>
            <div>
              <Label>Implementation Status</Label>
              <Select
                value={editForm.implementationStatus}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, implementationStatus: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Implemented">Implemented</SelectItem>
                  <SelectItem value="Partially Implemented">
                    Partially Implemented
                  </SelectItem>
                  <SelectItem value="Not Implemented">Not Implemented</SelectItem>
                  <SelectItem value="Planned">Planned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Control Compliance</Label>
              <Select
                value={editForm.controlCompliance}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, controlCompliance: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select compliance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Compliant">Compliant</SelectItem>
                  <SelectItem value="Partially Compliant">
                    Partially Compliant
                  </SelectItem>
                  <SelectItem value="Non-Compliant">Non-Compliant</SelectItem>
                  <SelectItem value="Not Assessed">Not Assessed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
