"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EscalationConfig {
  id: string;
  responseSubmission: number;
  acknowledgement: number;
  clarification: number;
  issueResolution: number;
}

export default function EscalationConfigPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EscalationConfig | null>(null);
  const [formData, setFormData] = useState({
    responseSubmission: 5,
    acknowledgement: 1,
    clarification: 2,
    issueResolution: 3,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/internal-audit/escalation-config");
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setFormData({
          responseSubmission: data.responseSubmission,
          acknowledgement: data.acknowledgement,
          clarification: data.clarification,
          issueResolution: data.issueResolution,
        });
      }
    } catch (error) {
      console.error("Failed to fetch escalation config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/internal-audit/escalation-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseSubmission: Number(formData.responseSubmission) || 5,
          acknowledgement: Number(formData.acknowledgement) || 1,
          clarification: Number(formData.clarification) || 2,
          issueResolution: Number(formData.issueResolution) || 3,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setConfig(updated);
        toast({
          title: "Success",
          description: "Escalation configuration saved successfully.",
        });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({
        title: "Error",
        description: "Failed to save escalation configuration.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Internal Audit</p>
            <h1 className="text-2xl font-semibold">Audit Settings</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/internal-audit/settings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">Internal Audit</p>
          <h1 className="text-2xl font-semibold">Audit Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-6">Escalation Configuration</h2>

        <div className="space-y-6 max-w-md">
          <div>
            <Label htmlFor="responseSubmission">Response Submission (days)</Label>
            <Input
              id="responseSubmission"
              type="number"
              min={1}
              value={formData.responseSubmission}
              onChange={(e) => setFormData({ ...formData, responseSubmission: parseInt(e.target.value) || 5 })}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Number of days before escalation for response submission
            </p>
          </div>

          <div>
            <Label htmlFor="acknowledgement">Acknowledgement (days)</Label>
            <Input
              id="acknowledgement"
              type="number"
              min={1}
              value={formData.acknowledgement}
              onChange={(e) => setFormData({ ...formData, acknowledgement: parseInt(e.target.value) || 1 })}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Number of days before escalation for acknowledgement
            </p>
          </div>

          <div>
            <Label htmlFor="clarification">Clarification (days)</Label>
            <Input
              id="clarification"
              type="number"
              min={1}
              value={formData.clarification}
              onChange={(e) => setFormData({ ...formData, clarification: parseInt(e.target.value) || 2 })}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Number of days before escalation for clarification
            </p>
          </div>

          <div>
            <Label htmlFor="issueResolution">Issue Resolution (days)</Label>
            <Input
              id="issueResolution"
              type="number"
              min={1}
              value={formData.issueResolution}
              onChange={(e) => setFormData({ ...formData, issueResolution: parseInt(e.target.value) || 3 })}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Number of days before escalation for issue resolution
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/internal-audit/settings")}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
