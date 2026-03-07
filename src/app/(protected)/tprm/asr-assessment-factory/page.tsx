"use client";

import { useState, useRef, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Home, ChevronRight, Download, Upload, Paperclip, FileBarChart, Check, ArrowRight, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function AsrAssessmentFactoryPage() {
  const { t } = useLanguage();
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [artifactFiles, setArtifactFiles] = useState<File[]>([]);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const artifactInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const openImportDialog = () => {
    setImportStep(1);
    setTemplateFile(null);
    setArtifactFiles([]);
    setImportOpen(true);
  };

  const handleArtifactDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) setArtifactFiles(prev => [...prev, ...files]);
  }, []);

  const removeArtifact = (index: number) => {
    setArtifactFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessment Factory")}</span>
      </nav>

      <h1 className="text-2xl font-bold text-center">{t("Assessment Factory")}</h1>

      {/* 4-step workflow */}
      <div className="flex flex-wrap items-start justify-center gap-4 mt-8">
        {/* Step 1: Download Template */}
        <a href="/templates/Assessment_Factory_Template.xlsx" download="Assessment_Factory_Template.xlsx" className="flex flex-col items-center text-center max-w-[200px] group cursor-pointer hover:opacity-80 transition-opacity no-underline">
          <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center mb-3 group-hover:bg-primary/5">
            <Download className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{t("Download Template")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("Download the template and fill it up with your own questionnaire.")}
          </p>
        </a>

        {/* Arrow */}
        <div className="hidden md:flex items-center pt-8">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Step 2: Upload Template */}
        <button onClick={openImportDialog} className="flex flex-col items-center text-center max-w-[200px] group cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center mb-3 group-hover:bg-primary/5">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{t("Upload the Completed Template")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("Once the template is populated, upload the spreadsheet by clicking here.")}
          </p>
        </button>

        {/* Arrow */}
        <div className="hidden md:flex items-center pt-8">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Step 3: Attach Artifacts */}
        <div className="flex flex-col items-center text-center max-w-[200px]">
          <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-3">
            <Paperclip className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-sm">{t("Attach Supporting Artifacts")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("Attach the necessary artifacts, which may include word documents, PDF's or image files.")}
          </p>
        </div>

        {/* Arrow */}
        <div className="hidden md:flex items-center pt-8">
          <ChevronRight className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Step 4: Generate Report */}
        <div className="flex flex-col items-center text-center max-w-[200px]">
          <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-3">
            <FileBarChart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-sm">{t("Generate Report")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("The results will be displayed on the overview page and downloaded as a spreadsheet.")}
          </p>
        </div>
      </div>

      {/* Import Template Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="!max-w-lg">
          <DialogHeader>
            <DialogTitle>{importStep === 1 ? t("Import Template") : t("Upload Artifacts")}</DialogTitle>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center justify-between px-4 pt-2">
            {/* Step 1 circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                importStep > 1
                  ? "bg-slate-900 text-white"
                  : importStep === 1
                    ? "bg-slate-900 text-white"
                    : "border-2 border-slate-300 text-slate-400"
              }`}>
                {importStep > 1 ? <Check className="h-5 w-5" /> : "1"}
              </div>
              <span className={`text-xs font-medium ${importStep >= 1 ? "text-primary" : "text-muted-foreground"}`}>
                {t("Upload File")}
              </span>
            </div>

            {/* Connector line */}
            <div className="flex-1 h-0.5 bg-slate-200 mx-4 mt-[-20px]" />

            {/* Step 2 circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                importStep === 2
                  ? "bg-slate-900 text-white"
                  : "border-2 border-slate-300 text-slate-400"
              }`}>
                2
              </div>
              <span className={`text-xs font-medium ${importStep === 2 ? "text-primary" : "text-muted-foreground"}`}>
                {t("Upload Artifacts")}
              </span>
            </div>
          </div>

          {/* Step Content */}
          {importStep === 1 ? (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                * {t("Upload your spreadsheet with the populated questionnaire.")}
              </p>
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium shrink-0">{t("File")}</Label>
                <Input
                  readOnly
                  value={templateFile?.name || "..."}
                  className="flex-1 bg-muted/30 cursor-pointer"
                  onClick={() => templateInputRef.current?.click()}
                />
                <Button variant="outline" size="sm" onClick={() => templateInputRef.current?.click()}>
                  {t("Browse...")}
                </Button>
                <input
                  ref={templateInputRef}
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setTemplateFile(file);
                  }}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setImportStep(2)} disabled={!templateFile}>
                  <ArrowRight className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Next")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                * {t("Upload all the respective artifacts as valid file types i.e., word, image, pdf.")}
              </p>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-slate-300 hover:border-slate-400"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleArtifactDrop}
                onClick={() => artifactInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{t("Upload Artifacts")}</p>
              </div>
              <input
                ref={artifactInputRef}
                type="file"
                multiple
                accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.gif,.bmp"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) setArtifactFiles(prev => [...prev, ...files]);
                  e.target.value = "";
                }}
              />

              {/* File list */}
              {artifactFiles.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {artifactFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-1.5">
                      <span className="truncate">{f.name}</span>
                      <button onClick={() => removeArtifact(i)} className="text-muted-foreground hover:text-destructive ml-2">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setImportStep(1)}>
                  <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Previous")}
                </Button>
                <Button>
                  {t("Generate Report")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
