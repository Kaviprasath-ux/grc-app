"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Search, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChooseControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onControlSelected?: (control: ExistingControl) => void;
  riskId: string;
  excludeControlIds?: string[];
}

interface ExistingControl {
  id: string;
  controlId: string;
  name: string;
  description: string | null;
  domain?: string;
  functionalGrouping?: string;
}

interface ApiControl {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  status: string;
  functionalGrouping: string | null;
  domain: { id: string; name: string } | null;
}

export function ChooseControlDialog({
  open,
  onOpenChange,
  onControlSelected,
  riskId,
  excludeControlIds = [],
}: ChooseControlDialogProps) {
  const { t } = useLanguage();
  const [domain, setDomain] = useState("");
  const [functionalGrouping, setFunctionalGrouping] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [controls, setControls] = useState<ExistingControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Fetch real controls from the API when dialog opens
  useEffect(() => {
    if (!open) return;

    const fetchControls = async () => {
      setFetching(true);
      try {
        const response = await fetch("/api/controls?limit=500");
        if (response.ok) {
          const data = await response.json();
          const apiControls: ApiControl[] = data.data || [];

          // Filter to only Compliant controls, and exclude already-linked controls
          const filtered = apiControls
            .filter((c) => c.status === "Compliant")
            .filter((c) => !excludeControlIds.includes(c.id))
            .map((c) => ({
              id: c.id,
              controlId: c.controlCode,
              name: c.name,
              description: c.description,
              domain: c.domain?.name || undefined,
              functionalGrouping: c.functionalGrouping || undefined,
            }));

          setControls(filtered);
        }
      } catch (error) {
        console.error("Failed to fetch controls:", error);
      } finally {
        setFetching(false);
      }
    };

    fetchControls();
  }, [open, excludeControlIds]);

  // Derive unique domains and groupings from fetched controls
  const uniqueDomains = useMemo(() => {
    const set = new Set<string>();
    controls.forEach((c) => { if (c.domain) set.add(c.domain); });
    return Array.from(set).sort();
  }, [controls]);

  const uniqueGroupings = useMemo(() => {
    const set = new Set<string>();
    controls.forEach((c) => { if (c.functionalGrouping) set.add(c.functionalGrouping); });
    return Array.from(set).sort();
  }, [controls]);

  // Filter controls based on selections
  const filteredControls = controls.filter((control) => {
    const matchesDomain = !domain || domain === "all" || control.domain === domain;
    const matchesFunctionalGrouping = !functionalGrouping || functionalGrouping === "all" || control.functionalGrouping === functionalGrouping;
    const matchesSearch = !searchQuery ||
      control.controlId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      control.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesDomain && matchesFunctionalGrouping && matchesSearch;
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClose = () => {
    setDomain("");
    setFunctionalGrouping("");
    setSearchQuery("");
    setSelectedIds(new Set());
    onOpenChange(false);
  };

  const handleLinkControls = async () => {
    if (selectedIds.size === 0) return;

    const selectedControls = controls.filter((c) => selectedIds.has(c.id));

    setLoading(true);
    try {
      // Link each selected control as a planned control
      for (const control of selectedControls) {
        const response = await fetch(`/api/risks/${riskId}/planned-controls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            controlId: control.controlId,
            name: control.name,
            description: control.description,
            domain: control.domain,
            functionalGrouping: control.functionalGrouping,
          }),
        });

        if (response.ok) {
          onControlSelected?.(control);
        }
      }
      handleClose();
    } catch (error) {
      console.error("Failed to link controls:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Select Control")}</DialogTitle>
            {selectedIds.size > 0 && (
              <span className="text-sm text-primary-600 font-medium">
                {selectedIds.size} {t("selected")}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Filters */}
        <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 sm:px-6 py-4 border-b border-slate-100">
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder={t("Domain")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Domains")}</SelectItem>
              {uniqueDomains.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={functionalGrouping} onValueChange={setFunctionalGrouping}>
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder={t("Functional Grouping")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Groupings")}</SelectItem>
              {uniqueGroupings.map((fg) => (
                <SelectItem key={fg} value={fg}>
                  {fg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search and List */}
        <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 py-4">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-10 bg-white"
              placeholder={t("Search By Control Code, Name")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Control List */}
          <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden">
            <div className="h-full overflow-y-auto">
              {fetching ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : filteredControls.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  {t("No controls found matching your criteria")}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredControls.map((control) => {
                    const isSelected = selectedIds.has(control.id);
                    return (
                      <div
                        key={control.id}
                        className={cn(
                          "p-3 cursor-pointer hover:bg-slate-50 transition-colors",
                          isSelected && "bg-primary-50/50"
                        )}
                        onClick={() => toggleSelection(control.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(control.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-primary">{control.controlId}</span>
                              <span className="text-slate-400">-</span>
                              <span className="font-medium text-slate-800">{control.name}</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                              {control.description}
                            </p>
                            <div className="flex gap-2 mt-2">
                              {control.domain && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100">
          <Button variant="outline" onClick={handleClose}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleLinkControls}
            disabled={selectedIds.size === 0 || loading}
          >
            {loading ? t("Linking...") : selectedIds.size > 1 ? `${t("Link")} ${selectedIds.size} ${t("Controls")}` : t("Link Control")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
