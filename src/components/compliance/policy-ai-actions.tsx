"use client";

import { useState } from "react";
import {
    FileText,
    Upload,
    Sparkles,
    Trash2,
    RefreshCw,
    MessageSquare,
    ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import * as ComplianceService from "@/services/ai-compliance-service";
import { useLanguage } from "@/contexts/LanguageContext";

import { FileInput } from "@/components/shared/file-input";
interface Policy {
    id: string;
    code: string;
    name: string;
    description: string | null;
    type: string;
    // Add other policy fields as needed
}

interface PolicyAIActionsProps {
    policy: Policy;
    onPolicyUpdate: () => void;
}

export function PolicyAIActions({ policy, onPolicyUpdate }: PolicyAIActionsProps) {
    const { t } = useLanguage();
    // State for dialogs
    const [ingestOpen, setIngestOpen] = useState(false);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [regenerateOpen, setRegenerateOpen] = useState(false);
    const [cleanupOpen, setCleanupOpen] = useState(false);
    const [assessmentOpen, setAssessmentOpen] = useState(false);

    // loading states
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [ingestProgress, setIngestProgress] = useState(0);

    // Form states
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [generatePrompt, setGeneratePrompt] = useState("");
    const [assessmentQuery, setAssessmentQuery] = useState("");
    const [assessmentAnswer, setAssessmentAnswer] = useState<string | null>(null);

    // Handlers (to be implemented)
    const handleIngest = async () => {
        // TODO: Implement ingest logic
    };

    const handleGenerate = async () => {
        // TODO: Implement generate logic
    };

    const handleRegenerate = async () => {
        // TODO: Implement regenerate logic
        console.log("Regenerating...");
    };

    const handleCleanup = async () => {
        // TODO: Implement cleanup logic
    };

    const handleAssessment = async () => {
        // TODO: Implement assessment logic
    };

    return (
        <div className="flex flex-wrap gap-2">
            {/* Ingest Dialog */}
            <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <Upload className="h-4 w-4" />
                        {t("Ingest Policy")}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("Ingest Policy Documents")}</DialogTitle>
                        <DialogDescription>
                            {t("Upload policy documents for AI analysis and embedding.")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="files">{t("Select Files")}</Label>
                            <FileInput
                                id="files"
                                multiple
                                onChange={(e) => setSelectedFiles(e.target.files)}
                            />
                        </div>
                        {loading && (
                            <div className="space-y-2">
                                <Progress value={ingestProgress} />
                                <p className="text-sm text-muted-foreground">{statusMessage}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIngestOpen(false)}>{t("Cancel")}</Button>
                        <Button onClick={handleIngest} disabled={loading || !selectedFiles}>
                            {loading ? t("Ingesting...") : t("Start Ingestion")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Generate Dialog */}
            <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        {t("Generate Policy")}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("Generate Policy Content")}</DialogTitle>
                        <DialogDescription>
                            {t("Use AI to generate policy content based on requirements.")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="prompt">{t("Requirements")}</Label>
                            <Textarea
                                id="prompt"
                                placeholder={t("Describe the policy requirements...")}
                                value={generatePrompt}
                                onChange={(e) => setGeneratePrompt(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGenerateOpen(false)}>{t("Cancel")}</Button>
                        <Button onClick={handleGenerate} disabled={loading}>
                            {loading ? t("Generating...") : t("Generate")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Regenerate Button */}
            <Button variant="outline" className="gap-2" onClick={() => setRegenerateOpen(true)}>
                <RefreshCw className="h-4 w-4" />
                {t("Regenerate")}
            </Button>

            {/* Assessment Dialog */}
            <Dialog open={assessmentOpen} onOpenChange={setAssessmentOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        {t("Self-Assessment")}
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t("Policy Self-Assessment")}</DialogTitle>
                        <DialogDescription>
                            {t("Ask questions about this policy to verify compliance coverage.")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="query">{t("Question")}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="query"
                                    placeholder="e.g. Does this policy cover data encryption?"
                                    value={assessmentQuery}
                                    onChange={(e) => setAssessmentQuery(e.target.value)}
                                />
                                <Button onClick={handleAssessment} disabled={loading}>{t("Ask")}</Button>
                            </div>
                        </div>
                        {assessmentAnswer && (
                            <div className="mt-4 p-4 bg-muted rounded-md">
                                <h4 className="font-semibold mb-2">{t("AI Answer")}:</h4>
                                <p className="whitespace-pre-wrap">{assessmentAnswer}</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cleanup Button (Destructive) */}
            <Button variant="destructive" size="icon" onClick={() => setCleanupOpen(true)}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}
