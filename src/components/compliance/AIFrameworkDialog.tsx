"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { useFrameworkPolling, formatElapsedTime, formatRemainingTime } from "@/hooks/useFrameworkPolling";
import { useToast } from "@/hooks/use-toast";

interface AIFrameworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFrameworkCreated?: () => void;
}

export function AIFrameworkDialog({ open, onOpenChange, onFrameworkCreated }: AIFrameworkDialogProps) {
  const { toast } = useToast();
  const {
    startPolling,
    stopPolling,
    reset: resetPolling,
    jobId,
    status,
    isPolling,
    isComplete,
    isFailed,
    error,
    timeElapsed,
    estimatedTimeRemaining,
    progress,
  } = useFrameworkPolling({
    onComplete: async (completedJobId) => {
      try {
        // Fetch the framework result
        const response = await fetch(`/api/ai/framework-result/${completedJobId}`);
        if (response.ok) {
          const result = await response.json();
          toast({
            title: "Framework Created Successfully",
            description: `Framework "${result.framework_name || 'Unknown'}" is ready to use!`,
          });

          // Reset and close dialog
          setTimeout(() => {
            resetForm();
            resetPolling();
            onOpenChange(false);
            onFrameworkCreated?.();
          }, 2000);
        }
      } catch (err) {
        console.error("Failed to retrieve framework result:", err);
        toast({
          title: "Warning",
          description: "Framework was created but couldn't retrieve result. Check dashboard.",
        });
      }
    },
    onFailed: (errorMsg) => {
      toast({
        title: "Framework Generation Failed",
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "Framework",
    country: "",
    industry: "",
    code: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      description: "",
      type: "Framework",
      country: "",
      industry: "",
      code: "",
    });
    setIsSubmitting(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Framework name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("framework_name", formData.name);
      fd.append("description", formData.description);
      fd.append("type", formData.type);
      fd.append("country", formData.country);
      fd.append("industry", formData.industry);
      fd.append("code", formData.code);

      const response = await fetch("/api/ai/generate-framework", {
        method: "POST",
        body: fd,
      });

      if (response.status === 409) {
        // Duplicate framework
        const data = await response.json();
        toast({
          title: "Framework Already Exists",
          description: `A framework named "${formData.name}" already exists.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create framework");
      }

      const result = await response.json();

      toast({
        title: "Framework Generation Started",
        description: `Job ID: ${result.job_id}. This will take 15-120 minutes.`,
      });

      // Start polling
      startPolling(result.job_id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isPolling) {
      resetForm();
      resetPolling();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Framework with AI</DialogTitle>
        </DialogHeader>

        {/* POLLING STATE: Show progress instead of form */}
        {isPolling && (
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Framework Generation in Progress</h3>
                <span className="text-sm text-gray-500">{progress.toFixed(0)}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
              {status === "QUEUED" && (
                <>
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="font-semibold text-blue-900">Queued</p>
                    <p className="text-sm text-blue-700">Waiting to start processing...</p>
                  </div>
                </>
              )}

              {status === "PROCESSING" && (
                <>
                  <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                  <div>
                    <p className="font-semibold text-amber-900">Processing</p>
                    <p className="text-sm text-amber-700">AI is generating your framework...</p>
                  </div>
                </>
              )}

              {status === "PENDING_RESULT" && (
                <>
                  <Loader2 className="h-5 w-5 text-green-600 animate-spin" />
                  <div>
                    <p className="font-semibold text-green-900">Saving to Database</p>
                    <p className="text-sm text-green-700">Framework is being persisted...</p>
                  </div>
                </>
              )}

              {isComplete && status === "COMPLETED" && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">Complete!</p>
                    <p className="text-sm text-green-700">Framework is ready. Closing...</p>
                  </div>
                </>
              )}
            </div>

            {/* Timing Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600">Elapsed</p>
                <p className="font-mono font-semibold text-gray-900">
                  {formatElapsedTime(timeElapsed)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600">Est. Remaining</p>
                <p className="font-mono font-semibold text-gray-900">
                  {formatRemainingTime(estimatedTimeRemaining)}
                </p>
              </div>
            </div>

            {/* Job ID */}
            <div className="p-3 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-600">Job ID</p>
              <p className="font-mono text-sm text-gray-900">{jobId}</p>
            </div>

            {/* Note */}
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-700">
                ℹ️ You can navigate away. The framework will be ready when processing completes.
                Check the dashboard in a few moments.
              </p>
            </div>

            {/* Stop Button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  stopPolling();
                  toast({
                    title: "Polling Stopped",
                    description: "You can check the status manually from the dashboard.",
                  });
                  onOpenChange(false);
                }}
              >
                Close and Check Later
              </Button>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {isFailed && (
          <div className="space-y-4 py-6">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Generation Failed</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  resetPolling();
                  onOpenChange(false);
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  resetForm();
                  resetPolling();
                }}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* FORM STATE: Show input form */}
        {!isPolling && !isFailed && (
          <form onSubmit={handleSubmit} className="space-y-6 py-6">
            {/* Framework Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Framework Name *</Label>
              <Input
                id="name"
                placeholder="e.g., ISO/IEC 27001:2022"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                The name of the framework to generate (e.g., ISO 27001, NIST CSF, etc.)
              </p>
            </div>

            {/* Framework Code */}
            <div className="space-y-2">
              <Label htmlFor="code">Framework Code (Optional)</Label>
              <Input
                id="code"
                placeholder="e.g., ISO27001"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">Auto-generated if not provided</p>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Framework">Framework</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Regulation">Regulation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Country & Industry Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country (Optional)</Label>
                <Input
                  id="country"
                  placeholder="e.g., India"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry (Optional)</Label>
                <Input
                  id="industry"
                  placeholder="e.g., Finance"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <textarea
                id="description"
                placeholder="Additional details about the framework..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Framework generation can take 15-120 minutes. You'll receive a notification when ready.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Generate Framework"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
