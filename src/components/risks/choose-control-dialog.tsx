"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Search, Check } from "lucide-react";

interface ChooseControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onControlSelected?: (control: ExistingControl) => void;
  riskId: string;
}

interface ExistingControl {
  id: string;
  controlId: string;
  name: string;
  description: string | null;
  domain?: string;
  functionalGrouping?: string;
}

const DOMAINS = [
  "Compliance",
  "Cybersecurity & Data Protection Governance",
  "Risk Management",
  "Technology Development & Acquisition",
  "Human Resources Security",
  "Asset Management",
  "Incident Response",
  "Vulnerability & Patch Management",
  "Threat Management",
  "Security Awareness & Training",
  "Business Continuity & Disaster Recovery",
  "Continuous Monitoring",
  "Identification & Authentication",
  "Information Assurance",
  "Third-Party Management",
  "Data Classification & Handling",
  "Cloud Security",
  "Network Security",
  "Configuration Management",
  "Data Privacy",
];

const FUNCTIONAL_GROUPINGS = [
  "Govern",
  "Identify",
  "Protect",
  "Detect",
  "Respond",
  "Recover",
];

// Mock controls for demonstration - in production, these would come from an API
const MOCK_CONTROLS: ExistingControl[] = [
  {
    id: "1",
    controlId: "RSK-01.1",
    name: "Risk Framing",
    description: "Mechanisms exist to identify risk assessments, risk response and risk monitoring.",
    domain: "Risk Management",
    functionalGrouping: "Govern",
  },
  {
    id: "2",
    controlId: "DCH-01",
    name: "Data Protection",
    description: "Data protection mechanisms to ensure confidentiality, integrity, and availability.",
    domain: "Data Classification & Handling",
    functionalGrouping: "Protect",
  },
  {
    id: "3",
    controlId: "IAC-05",
    name: "Identification & Authentication for Third Party Systems",
    description: "Mechanisms exist to identify and authenticate third-party systems and services.",
    domain: "Identification & Authentication",
    functionalGrouping: "Protect",
  },
  {
    id: "4",
    controlId: "NET-03.3",
    name: "Prevent Discovery of Internal Information",
    description: "Controls to prevent unauthorized discovery of internal network information.",
    domain: "Network Security",
    functionalGrouping: "Protect",
  },
  {
    id: "5",
    controlId: "IRO-10.1",
    name: "Automated Reporting",
    description: "Automated mechanisms for security incident reporting and escalation.",
    domain: "Incident Response",
    functionalGrouping: "Respond",
  },
  {
    id: "6",
    controlId: "IAO-06",
    name: "Technical Verification",
    description: "Technical verification of security controls and configurations.",
    domain: "Information Assurance",
    functionalGrouping: "Detect",
  },
  {
    id: "7",
    controlId: "BCD-01",
    name: "Business Continuity Planning",
    description: "Business continuity and disaster recovery planning mechanisms.",
    domain: "Business Continuity & Disaster Recovery",
    functionalGrouping: "Recover",
  },
  {
    id: "8",
    controlId: "VPM-02",
    name: "Vulnerability Scanning",
    description: "Regular vulnerability scanning and assessment processes.",
    domain: "Vulnerability & Patch Management",
    functionalGrouping: "Detect",
  },
];

export function ChooseControlDialog({
  open,
  onOpenChange,
  onControlSelected,
  riskId,
}: ChooseControlDialogProps) {
  const [domain, setDomain] = useState("");
  const [functionalGrouping, setFunctionalGrouping] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedControl, setSelectedControl] = useState<ExistingControl | null>(null);
  const [controls, setControls] = useState<ExistingControl[]>(MOCK_CONTROLS);
  const [loading, setLoading] = useState(false);

  // Filter controls based on selections
  const filteredControls = controls.filter((control) => {
    const matchesDomain = !domain || control.domain === domain;
    const matchesFunctionalGrouping = !functionalGrouping || control.functionalGrouping === functionalGrouping;
    const matchesSearch = !searchQuery ||
      control.controlId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      control.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesDomain && matchesFunctionalGrouping && matchesSearch;
  });

  const handleClose = () => {
    setDomain("");
    setFunctionalGrouping("");
    setSearchQuery("");
    setSelectedControl(null);
    onOpenChange(false);
  };

  const handleLinkControl = async () => {
    if (!selectedControl) return;

    setLoading(true);
    try {
      // Call API to link the control to the risk
      const response = await fetch(`/api/risks/${riskId}/planned-controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlId: selectedControl.controlId,
          name: selectedControl.name,
          description: selectedControl.description,
          domain: selectedControl.domain,
          functionalGrouping: selectedControl.functionalGrouping,
        }),
      });

      if (response.ok) {
        onControlSelected?.(selectedControl);
        handleClose();
      }
    } catch (error) {
      console.error("Failed to link control:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Governance</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-4 py-4">
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {DOMAINS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={functionalGrouping} onValueChange={setFunctionalGrouping}>
            <SelectTrigger className="w-48">
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search By Control Code, Name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Control List */}
        <div className="border rounded-lg overflow-hidden mt-4">
          <div className="max-h-64 overflow-y-auto">
            {filteredControls.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No controls found matching your criteria
              </div>
            ) : (
              <div className="divide-y">
                {filteredControls.map((control) => (
                  <div
                    key={control.id}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-gray-50 transition-colors",
                      selectedControl?.id === control.id && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                    onClick={() => setSelectedControl(control)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-primary">{control.controlId}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="font-medium">{control.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {control.description}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {control.domain && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {control.domain}
                            </span>
                          )}
                          {control.functionalGrouping && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                              {control.functionalGrouping}
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedControl?.id === control.id && (
                        <Check className="h-5 w-5 text-primary ml-4" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleLinkControl}
            disabled={!selectedControl || loading}
          >
            {loading ? "Linking..." : "Link Control"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
