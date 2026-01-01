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
import { Plus } from "lucide-react";

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Control Details</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 py-4">
          <StepIndicator
            number={1}
            label="Control Information"
            active={step === 1}
            completed={step > 1}
          />
          <StepIndicator
            number={2}
            label="Assignments & Details"
            active={step === 2}
            completed={step > 2}
          />
          <StepIndicator
            number={3}
            label="Review informations"
            active={step === 3}
            completed={false}
          />
        </div>

        {/* Step Content */}
        <div className="space-y-4 py-4">
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium">Control domain</label>
                <div className="flex gap-2 mt-1">
                  <Select value={domain} onValueChange={setDomain}>
                    <SelectTrigger className="flex-1">
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

              <div>
                <label className="text-sm font-medium">Control name</label>
                <Input
                  className="mt-1"
                  placeholder="Enter Control Name"
                  value={controlName}
                  onChange={(e) => setControlName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  className="mt-1"
                  placeholder="Enter Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Control question</label>
                <Input
                  className="mt-1"
                  placeholder="Enter Control Question"
                  value={controlQuestion}
                  onChange={(e) => setControlQuestion(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Function Grouping</label>
                <Select value={functionalGrouping} onValueChange={setFunctionalGrouping}>
                  <SelectTrigger className="mt-1">
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
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-medium">Department</label>
                <Input
                  className="mt-1"
                  placeholder="Enter Department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Assigned To</label>
                <Input
                  className="mt-1"
                  placeholder="Enter Assignee"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Effectiveness Target (%)</label>
                <Input
                  className="mt-1"
                  type="number"
                  placeholder="Enter Target Effectiveness"
                  value={effectivenessTarget}
                  onChange={(e) => setEffectivenessTarget(e.target.value)}
                  min={0}
                  max={100}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h4 className="font-medium text-primary">Review Control Information</h4>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Domain</p>
                  <p className="font-medium">{domain || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Function Grouping</p>
                  <p className="font-medium">{functionalGrouping || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Control Name</p>
                  <p className="font-medium">{controlName || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Description</p>
                  <p className="font-medium">{description || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Control Question</p>
                  <p className="font-medium">{controlQuestion || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium">{department || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{assignedTo || "-"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
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

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2",
          active && "bg-primary text-primary-foreground border-primary",
          completed && "bg-primary text-primary-foreground border-primary",
          !active && !completed && "border-gray-300 text-gray-400"
        )}
      >
        {number}
      </div>
      <span
        className={cn(
          "text-sm",
          active && "text-primary font-medium",
          !active && "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}
