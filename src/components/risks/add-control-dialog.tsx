"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Check } from "lucide-react";

interface AddControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onControlAdded?: (control: PlannedControl) => void;
  riskId: string;
}

interface PlannedControl {
  id: string;
  controlId: string;
  name: string;
  description: string;
  domain: string;
  functionalGrouping: string;
  department?: string;
  assignedTo?: string;
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

export function AddControlDialog({
  open,
  onOpenChange,
  onControlAdded,
  riskId,
}: AddControlDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [domain, setDomain] = useState("");
  const [controlName, setControlName] = useState("");
  const [description, setDescription] = useState("");
  const [controlQuestion, setControlQuestion] = useState("");
  const [functionalGrouping, setFunctionalGrouping] = useState("");

  // Step 2 fields
  const [department, setDepartment] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [effectivenessTarget, setEffectivenessTarget] = useState("");

  const resetForm = () => {
    setStep(1);
    setDomain("");
    setControlName("");
    setDescription("");
    setControlQuestion("");
    setFunctionalGrouping("");
    setDepartment("");
    setAssignedTo("");
    setEffectivenessTarget("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Generate a control ID
      const controlId = `CTRL-${Date.now().toString(36).toUpperCase()}`;

      const newControl: PlannedControl = {
        id: crypto.randomUUID(),
        controlId,
        name: controlName,
        description,
        domain,
        functionalGrouping,
        department,
        assignedTo,
      };

      // Call the API to save the planned control
      const response = await fetch(`/api/risks/${riskId}/planned-controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newControl),
      });

      if (response.ok) {
        onControlAdded?.(newControl);
        handleClose();
      }
    } catch (error) {
      console.error("Failed to add control:", error);
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = domain && controlName && description && functionalGrouping;
  const isStep2Valid = true; // Optional fields

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
          <DialogTitle className="text-lg font-semibold text-slate-800">Control Details</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex-shrink-0 flex items-start justify-center px-6 py-4 border-b border-slate-100">
          {[
            { id: 1, name: "Control Info" },
            { id: 2, name: "Assignments" },
            { id: 3, name: "Review" },
          ].map((stepItem, index) => (
            <div key={stepItem.id} className="flex items-start">
              <div className="flex flex-col items-center w-28">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    step > stepItem.id
                      ? "bg-success text-white"
                      : step === stepItem.id
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  )}
                >
                  {step > stepItem.id ? <Check className="h-4 w-4" /> : stepItem.id}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium text-center",
                    step >= stepItem.id ? "text-slate-700" : "text-slate-400"
                  )}
                >
                  {stepItem.name}
                </span>
              </div>
              {index < 2 && (
                <div
                  className={cn(
                    "w-12 h-0.5 mt-[18px] -mx-4 transition-colors",
                    step > stepItem.id ? "bg-success" : "bg-slate-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Control domain</label>
                <div className="flex gap-2">
                  <Select value={domain} onValueChange={setDomain}>
                    <SelectTrigger className="flex-1 bg-white">
                      <SelectValue placeholder="Select Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOMAINS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Control name</label>
                <Input
                  className="bg-white"
                  placeholder="Enter Control Name"
                  value={controlName}
                  onChange={(e) => setControlName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <Textarea
                  className="bg-white"
                  placeholder="Enter Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Control question</label>
                <Input
                  className="bg-white"
                  placeholder="Enter Control Question"
                  value={controlQuestion}
                  onChange={(e) => setControlQuestion(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Function Grouping</label>
                <Select value={functionalGrouping} onValueChange={setFunctionalGrouping}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select Functional Grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNCTIONAL_GROUPINGS.map((fg) => (
                      <SelectItem key={fg} value={fg}>
                        {fg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Department</label>
                <Input
                  className="bg-white"
                  placeholder="Enter Department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Assigned To</label>
                <Input
                  className="bg-white"
                  placeholder="Enter Assignee"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Effectiveness Target (%)</label>
                <Input
                  className="bg-white"
                  type="number"
                  placeholder="Enter Target Effectiveness"
                  value={effectivenessTarget}
                  onChange={(e) => setEffectivenessTarget(e.target.value)}
                  min={0}
                  max={100}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h4 className="font-medium text-primary">Review Control Information</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Domain</p>
                  <p className="font-medium text-slate-800">{domain || "-"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Function Grouping</p>
                  <p className="font-medium text-slate-800">{functionalGrouping || "-"}</p>
                </div>
                <div className="col-span-2 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Control Name</p>
                  <p className="font-medium text-slate-800">{controlName || "-"}</p>
                </div>
                <div className="col-span-2 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Description</p>
                  <p className="font-medium text-slate-800">{description || "-"}</p>
                </div>
                <div className="col-span-2 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Control Question</p>
                  <p className="font-medium text-slate-800">{controlQuestion || "-"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Department</p>
                  <p className="font-medium text-slate-800">{department || "-"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Assigned To</p>
                  <p className="font-medium text-slate-800">{assignedTo || "-"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step > 1 && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={step === 1 && !isStep1Valid}
            >
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save Control"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

