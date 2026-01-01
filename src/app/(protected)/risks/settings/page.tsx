"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  _count?: { risks: number };
}

interface RiskType {
  id: string;
  name: string;
  description?: string;
}

interface Threat {
  id: string;
  name: string;
  description?: string;
}

interface Vulnerability {
  id: string;
  name: string;
  description?: string;
}

interface Cause {
  id: string;
  name: string;
  description?: string;
}

interface RiskTypeItem {
  id: string;
  name: string;
  description?: string;
  _count?: { risks: number };
}

export default function RiskSettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<RiskTypeItem[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"category" | "type" | "threat" | "vulnerability" | "cause">("category");
  const [editItem, setEditItem] = useState<{ id: string; name: string; description?: string; color?: string } | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", color: "" });
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: string; name: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [catRes, typeRes, threatRes, vulnRes, causeRes] = await Promise.all([
        fetch("/api/risk-categories"),
        fetch("/api/risk-types"),
        fetch("/api/risk-threats"),
        fetch("/api/risk-vulnerabilities"),
        fetch("/api/risk-causes"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (typeRes.ok) setTypes(await typeRes.json());
      if (threatRes.ok) setThreats(await threatRes.json());
      if (vulnRes.ok) setVulnerabilities(await vulnRes.json());
      if (causeRes.ok) setCauses(await causeRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = (type: "category" | "type" | "threat" | "vulnerability" | "cause") => {
    setDialogType(type);
    setEditItem(null);
    setFormData({ name: "", description: "", color: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (
    type: "category" | "type" | "threat" | "vulnerability" | "cause",
    item: { id: string; name: string; description?: string; color?: string }
  ) => {
    setDialogType(type);
    setEditItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      color: item.color || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const apiMap = {
        category: "/api/risk-categories",
        type: "/api/risk-types",
        threat: "/api/risk-threats",
        vulnerability: "/api/risk-vulnerabilities",
        cause: "/api/risk-causes",
      };

      const url = editItem ? `${apiMap[dialogType]}/${editItem.id}` : apiMap[dialogType];
      const method = editItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          ...(dialogType === "category" && { color: formData.color || null }),
        }),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (type: string, id: string, name: string) => {
    setItemToDelete({ id, type, name });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const apiMap: Record<string, string> = {
        category: "/api/risk-categories",
        type: "/api/risk-types",
        threat: "/api/risk-threats",
        vulnerability: "/api/risk-vulnerabilities",
        cause: "/api/risk-causes",
      };

      const response = await fetch(`${apiMap[itemToDelete.type]}/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const getDialogTitle = () => {
    const action = editItem ? "Edit" : "Add";
    const typeLabel = {
      category: "Category",
      type: "Type",
      threat: "Threat",
      vulnerability: "Vulnerability",
      cause: "Cause",
    };
    return `${action} Risk ${typeLabel[dialogType]}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Risk Settings" description="Configure risk management settings" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grc-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Settings"
        description="Configure risk categories, threats, vulnerabilities, and other settings"
      />

      <Tabs defaultValue="categories">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="types">Types</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="causes">Causes</TabsTrigger>
          <TabsTrigger value="scales">Scales</TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Risk Categories</CardTitle>
                <CardDescription>Define categories to classify risks</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("category")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 bg-grc-bg rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {cat.color && (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        {cat.description && (
                          <p className="text-sm text-muted-foreground">{cat.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground mr-4">
                        {cat._count?.risks || 0} risks
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog("category", cat)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog("category", cat.id, cat.name)}
                        disabled={(cat._count?.risks || 0) > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No categories defined. Add your first category.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Types Tab */}
        <TabsContent value="types" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Risk Types</CardTitle>
                <CardDescription>Define types to classify risks</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("type")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Type
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {types.map((riskType) => (
                  <div
                    key={riskType.id}
                    className="flex items-center justify-between p-3 bg-grc-bg rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{riskType.name}</p>
                      {riskType.description && (
                        <p className="text-sm text-muted-foreground">{riskType.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground mr-2">
                        {riskType._count?.risks || 0} risks
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog("type", riskType)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog("type", riskType.id, riskType.name)}
                        disabled={(riskType._count?.risks || 0) > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {types.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No types defined. Add your first type.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Threats Tab */}
        <TabsContent value="threats" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Risk Threats</CardTitle>
                <CardDescription>Define threats that can affect risks</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("threat")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Threat
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {threats.map((threat) => (
                  <div
                    key={threat.id}
                    className="flex items-center justify-between p-3 bg-grc-bg rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{threat.name}</p>
                      {threat.description && (
                        <p className="text-sm text-muted-foreground">{threat.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog("threat", threat)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog("threat", threat.id, threat.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {threats.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No threats defined. Add your first threat.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vulnerabilities Tab */}
        <TabsContent value="vulnerabilities" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Risk Vulnerabilities</CardTitle>
                <CardDescription>Define vulnerabilities that can be exploited</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("vulnerability")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vulnerability
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {vulnerabilities.map((vuln) => (
                  <div
                    key={vuln.id}
                    className="flex items-center justify-between p-3 bg-grc-bg rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{vuln.name}</p>
                      {vuln.description && (
                        <p className="text-sm text-muted-foreground">{vuln.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog("vulnerability", vuln)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog("vulnerability", vuln.id, vuln.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {vulnerabilities.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No vulnerabilities defined. Add your first vulnerability.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Causes Tab */}
        <TabsContent value="causes" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Risk Causes</CardTitle>
                <CardDescription>Define root causes that lead to risks</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("cause")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Cause
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {causes.map((cause) => (
                  <div
                    key={cause.id}
                    className="flex items-center justify-between p-3 bg-grc-bg rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{cause.name}</p>
                      {cause.description && (
                        <p className="text-sm text-muted-foreground">{cause.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog("cause", cause)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog("cause", cause.id, cause.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {causes.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No causes defined. Add your first cause.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scales Tab */}
        <TabsContent value="scales" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Likelihood Scale */}
            <Card>
              <CardHeader>
                <CardTitle>Likelihood Scale</CardTitle>
                <CardDescription>Define likelihood levels (1-5)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { level: 1, label: "Rare", description: "May occur only in exceptional circumstances" },
                    { level: 2, label: "Unlikely", description: "Could occur at some time" },
                    { level: 3, label: "Possible", description: "Might occur at some time" },
                    { level: 4, label: "Likely", description: "Will probably occur in most circumstances" },
                    { level: 5, label: "Almost Certain", description: "Is expected to occur in most circumstances" },
                  ].map((item) => (
                    <div key={item.level} className="flex items-start gap-3 p-3 bg-grc-bg rounded-lg">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-grc-primary text-white font-bold">
                        {item.level}
                      </div>
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Impact Scale */}
            <Card>
              <CardHeader>
                <CardTitle>Impact Scale</CardTitle>
                <CardDescription>Define impact levels (1-5)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { level: 1, label: "Insignificant", description: "No injuries, low financial loss" },
                    { level: 2, label: "Minor", description: "First aid treatment, medium financial loss" },
                    { level: 3, label: "Moderate", description: "Medical treatment required, high financial loss" },
                    { level: 4, label: "Major", description: "Extensive injuries, major financial loss" },
                    { level: 5, label: "Catastrophic", description: "Death, huge financial loss" },
                  ].map((item) => (
                    <div key={item.level} className="flex items-start gap-3 p-3 bg-grc-bg rounded-lg">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-grc-primary text-white font-bold">
                        {item.level}
                      </div>
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Rating Matrix */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Risk Rating Matrix</CardTitle>
                <CardDescription>Risk rating thresholds based on Likelihood × Impact</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { range: "1-9", rating: "Low Risk", color: "bg-green-500" },
                    { range: "10-14", rating: "High", color: "bg-amber-500" },
                    { range: "15-19", rating: "Very high", color: "bg-orange-500" },
                    { range: "20-25", rating: "Catastrophic", color: "bg-red-600" },
                  ].map((item) => (
                    <div
                      key={item.rating}
                      className={cn(
                        "p-4 rounded-lg text-center text-white",
                        item.color
                      )}
                    >
                      <p className="text-lg font-bold">{item.range}</p>
                      <p className="text-sm">{item.rating}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter name"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description (optional)"
                rows={3}
                className="mt-2"
              />
            </div>
            {dialogType === "category" && (
              <div>
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color || "#3b82f6"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemToDelete?.type}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{itemToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
