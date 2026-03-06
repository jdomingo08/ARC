import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge, ImpactBadge, RiskBadge, ConfidenceBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Shield,
  Key,
  Database,
  Users,
  Target,
  Calendar,
  FileText,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Pencil,
  Save,
  X,
  Plus,
  Mail,
  Bell,
  Upload,
  Download,
  Paperclip,
  UserPlus,
} from "lucide-react";
import type { Platform, Tier, RiskFinding, Request, PlatformAttributeDefinition, PlatformStakeholder, ExpirationAlert, PlatformAttachment } from "@shared/schema";

export default function PlatformDetailPage() {
  const [, params] = useRoute("/platforms/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const id = params?.id;

  const [editingAttrs, setEditingAttrs] = useState(false);
  const [attrValues, setAttrValues] = useState<Record<string, any>>({});

  // Edit platform details state
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailValues, setDetailValues] = useState<Record<string, any>>({});

  // Add attribute dialog state
  const [addAttrOpen, setAddAttrOpen] = useState(false);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("text");
  const [newAttrOptions, setNewAttrOptions] = useState("");
  const [newAttrDefault, setNewAttrDefault] = useState("");
  const [newAttrRequired, setNewAttrRequired] = useState(false);

  const { data: platform, isLoading } = useQuery<Platform>({
    queryKey: ["/api/platforms", id],
    enabled: !!id,
  });

  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/admin/tiers"] });
  const { data: findings } = useQuery<RiskFinding[]>({
    queryKey: ["/api/platforms", id, "findings"],
    enabled: !!id,
  });
  const { data: linkedRequests } = useQuery<Request[]>({
    queryKey: ["/api/platforms", id, "requests"],
    enabled: !!id,
  });
  const { data: attrDefs } = useQuery<PlatformAttributeDefinition[]>({
    queryKey: ["/api/admin/attributes"],
  });
  const { data: stakeholders } = useQuery<PlatformStakeholder[]>({
    queryKey: ["/api/platforms", id, "stakeholders"],
    enabled: !!id,
  });
  const { data: platformAttachments } = useQuery<PlatformAttachment[]>({
    queryKey: ["/api/platforms", id, "attachments"],
    enabled: !!id,
  });
  const { data: alerts } = useQuery<ExpirationAlert[]>({
    queryKey: ["/api/platforms", id, "alerts"],
    enabled: !!id,
  });

  // Stakeholder form state
  const [addStakeholderOpen, setAddStakeholderOpen] = useState(false);
  const [stakeholderName, setStakeholderName] = useState("");
  const [stakeholderEmail, setStakeholderEmail] = useState("");
  const [stakeholderRole, setStakeholderRole] = useState("");

  const updateTierMutation = useMutation({
    mutationFn: async (tierId: string) => {
      const res = await apiRequest("PATCH", `/api/platforms/${id}`, { tierId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Tier Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms", id] });
    },
  });

  const deletePlatformMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/admin/platforms/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Platform Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
      setLocation("/platforms");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateAttrsMutation = useMutation({
    mutationFn: async (dynamicAttributes: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/platforms/${id}`, { dynamicAttributes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Attributes Updated" });
      setEditingAttrs(false);
      queryClient.invalidateQueries({ queryKey: ["/api/platforms", id] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateDetailsMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/platforms/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Platform Updated" });
      setEditingDetails(false);
      queryClient.invalidateQueries({ queryKey: ["/api/platforms", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms"], exact: true });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createAttrMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: newAttrName,
        dataType: newAttrType,
        required: newAttrRequired,
        defaultValue: newAttrDefault || null,
        options: (newAttrType === "dropdown" || newAttrType === "multi_select")
          ? newAttrOptions.split(",").map(s => s.trim()).filter(Boolean)
          : null,
      };
      const res = await apiRequest("POST", "/api/admin/attributes", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Attribute Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attributes"] });
      setAddAttrOpen(false);
      setNewAttrName("");
      setNewAttrType("text");
      setNewAttrOptions("");
      setNewAttrDefault("");
      setNewAttrRequired(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addStakeholderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/platforms/${id}/stakeholders`, {
        name: stakeholderName,
        email: stakeholderEmail,
        role: stakeholderRole || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Stakeholder Added" });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms", id, "stakeholders"] });
      setAddStakeholderOpen(false);
      setStakeholderName("");
      setStakeholderEmail("");
      setStakeholderRole("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeStakeholderMutation = useMutation({
    mutationFn: async (stakeholderId: string) => {
      await apiRequest("DELETE", `/api/platforms/${id}/stakeholders/${stakeholderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platforms", id, "stakeholders"] });
    },
  });

  const uploadPlatformFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/platforms/${id}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "File Uploaded" });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms", id, "attachments"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deletePlatformFileMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiRequest("DELETE", `/api/platform-attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platforms", id, "attachments"] });
    },
  });

  const createAlertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/platforms/${id}/alerts`, { alertDaysBefore: 30 });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Expiration Alert Enabled", description: "An alert will be sent 30 days before the contract expires." });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms", id, "alerts"] });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("DELETE", `/api/alerts/${alertId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platforms", id, "alerts"] });
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatArray = (arr: string[] | null) =>
    arr?.map(s => s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())).join(", ") || "N/A";

  const isAdmin = user?.role === "admin" || user?.role === "chair";

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!platform) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Platform not found</p>
        <Link href="/platforms"><Button variant="outline" className="mt-4">Back to Platforms</Button></Link>
      </div>
    );
  }

  const tierName = tiers?.find(t => t.id === platform.tierId)?.name;
  const dynAttrs = (platform.dynamicAttributes || {}) as Record<string, any>;

  const startEditingAttrs = () => {
    setAttrValues({ ...dynAttrs });
    setEditingAttrs(true);
  };

  const saveAttrs = () => {
    updateAttrsMutation.mutate(attrValues);
  };

  const startEditingDetails = () => {
    setDetailValues({
      department: platform.department || "",
      estimatedUsers: platform.estimatedUsers || "",
      impactLevel: platform.impactLevel || "",
      annualCost: platform.annualCost || "",
      dataTraining: platform.dataTraining || "",
      loginMethod: platform.loginMethod || "",
      primaryGoal: platform.primaryGoal || "",
      status: platform.status || "",
    });
    setEditingDetails(true);
  };

  const saveDetails = () => {
    updateDetailsMutation.mutate({
      department: detailValues.department || null,
      estimatedUsers: detailValues.estimatedUsers || null,
      impactLevel: detailValues.impactLevel || null,
      annualCost: detailValues.annualCost !== "" ? detailValues.annualCost : null,
      dataTraining: detailValues.dataTraining || null,
      loginMethod: detailValues.loginMethod || null,
      primaryGoal: detailValues.primaryGoal || null,
      status: detailValues.status || platform.status,
    });
  };

  const renderAttrInput = (attr: PlatformAttributeDefinition) => {
    const value = attrValues[attr.name] ?? attr.defaultValue ?? "";
    const options = (attr.options || []) as string[];

    switch (attr.dataType) {
      case "boolean":
        return (
          <div className="flex items-center gap-2 mt-1">
            <Checkbox
              checked={value === true || value === "true"}
              onCheckedChange={checked => setAttrValues(v => ({ ...v, [attr.name]: checked }))}
            />
            <span className="text-sm">{value === true || value === "true" ? "Yes" : "No"}</span>
          </div>
        );
      case "dropdown":
        return (
          <Select value={value || ""} onValueChange={v => setAttrValues(vals => ({ ...vals, [attr.name]: v }))}>
            <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "multi_select": {
        const selected = Array.isArray(value) ? value : value ? String(value).split(",").map((s: string) => s.trim()) : [];
        return (
          <div className="flex flex-wrap gap-2 mt-1">
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-1 text-sm">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={checked => {
                    const next = checked ? [...selected, opt] : selected.filter((s: string) => s !== opt);
                    setAttrValues(v => ({ ...v, [attr.name]: next }));
                  }}
                />
                {opt}
              </label>
            ))}
          </div>
        );
      }
      case "number":
        return (
          <Input
            type="number"
            className="h-8 mt-1"
            value={value}
            onChange={e => setAttrValues(v => ({ ...v, [attr.name]: e.target.value }))}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            className="h-8 mt-1"
            value={value}
            onChange={e => setAttrValues(v => ({ ...v, [attr.name]: e.target.value }))}
          />
        );
      default: // text
        return (
          <Input
            type="text"
            className="h-8 mt-1"
            value={value}
            onChange={e => setAttrValues(v => ({ ...v, [attr.name]: e.target.value }))}
          />
        );
    }
  };

  const formatAttrValue = (attr: PlatformAttributeDefinition, value: any) => {
    if (value === undefined || value === null || value === "") return attr.defaultValue || "Not set";
    if (attr.dataType === "boolean") return value === true || value === "true" ? "Yes" : "No";
    if (attr.dataType === "multi_select" && Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/platforms">
        <Button variant="ghost" size="sm" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Platforms
        </Button>
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-platform-title">{platform.toolName}</h1>
            <StatusBadge status={platform.status} />
            {tierName && <Badge variant="outline">{tierName}</Badge>}
          </div>
          <p className="text-muted-foreground mt-1">{platform.primaryGoal || "No description"}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Select value={platform.tierId || ""} onValueChange={v => updateTierMutation.mutate(v)}>
              <SelectTrigger className="w-[200px]" data-testid="select-tier">
                <SelectValue placeholder="Assign Tier" />
              </SelectTrigger>
              <SelectContent>
                {tiers?.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
            </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:border-destructive"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete "${platform.toolName}"? This cannot be undone.`)) {
                  deletePlatformMutation.mutate();
                }
              }}
              disabled={deletePlatformMutation.isPending}
              data-testid="button-delete-platform"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Custom Attributes Card — prominent position */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Custom Attributes</CardTitle>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Dialog open={addAttrOpen} onOpenChange={setAddAttrOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add Attribute
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Custom Attribute</DialogTitle>
                      <DialogDescription>Define a new attribute that will appear on all platforms.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Attribute Name *</Label>
                        <Input value={newAttrName} onChange={e => setNewAttrName(e.target.value)} placeholder="e.g., Vendor, Contract Expiration" />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Type</Label>
                        <Select value={newAttrType} onValueChange={setNewAttrType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="dropdown">Dropdown</SelectItem>
                            <SelectItem value="multi_select">Multi-Select</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(newAttrType === "dropdown" || newAttrType === "multi_select") && (
                        <div className="space-y-2">
                          <Label>Options (comma-separated)</Label>
                          <Input value={newAttrOptions} onChange={e => setNewAttrOptions(e.target.value)} placeholder="Option A, Option B, Option C" />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Default Value</Label>
                        <Input value={newAttrDefault} onChange={e => setNewAttrDefault(e.target.value)} placeholder="Optional default" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={newAttrRequired} onCheckedChange={c => setNewAttrRequired(!!c)} />
                        <Label>Required</Label>
                      </div>
                      <Button onClick={() => createAttrMutation.mutate()} disabled={!newAttrName || createAttrMutation.isPending} className="w-full">
                        {createAttrMutation.isPending ? "Creating..." : "Create Attribute"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {isAdmin && !editingAttrs && attrDefs && attrDefs.length > 0 && (
                <Button variant="ghost" size="sm" onClick={startEditingAttrs}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              )}
              {editingAttrs && (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveAttrs} disabled={updateAttrsMutation.isPending}>
                    <Save className="h-4 w-4 mr-1" /> {updateAttrsMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingAttrs(false)}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {attrDefs && attrDefs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attrDefs.map(attr => (
                <div key={attr.id}>
                  <p className="text-xs text-muted-foreground">{attr.name}</p>
                  {editingAttrs ? (
                    renderAttrInput(attr)
                  ) : (
                    <p className="text-sm font-medium mt-0.5">
                      {formatAttrValue(attr, dynAttrs[attr.name])}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No custom attributes defined yet. {isAdmin ? "Click \"Add Attribute\" to create one." : ""}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Platform Details</CardTitle>
                {isAdmin && !editingDetails && (
                  <Button variant="ghost" size="sm" onClick={startEditingDetails}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
                {editingDetails && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={saveDetails} disabled={updateDetailsMutation.isPending}>
                      <Save className="h-4 w-4 mr-1" /> {updateDetailsMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingDetails(false)}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingDetails ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Description / Primary Goal</Label>
                    <Textarea
                      value={detailValues.primaryGoal}
                      onChange={e => setDetailValues(v => ({ ...v, primaryGoal: e.target.value }))}
                      className="h-20"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={detailValues.status} onValueChange={v => setDetailValues(vals => ({ ...vals, status: v }))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_review">On Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Department</Label>
                    <Input className="h-8" value={detailValues.department} onChange={e => setDetailValues(v => ({ ...v, department: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Estimated Users</Label>
                    <Select value={detailValues.estimatedUsers} onValueChange={v => setDetailValues(vals => ({ ...vals, estimatedUsers: v }))}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Impact Level</Label>
                    <Select value={detailValues.impactLevel} onValueChange={v => setDetailValues(vals => ({ ...vals, impactLevel: v }))}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Annual Cost ($)</Label>
                    <Input type="number" className="h-8" value={detailValues.annualCost} onChange={e => setDetailValues(v => ({ ...v, annualCost: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data Training</Label>
                    <Select value={detailValues.dataTraining} onValueChange={v => setDetailValues(vals => ({ ...vals, dataTraining: v }))}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="unsure">Unsure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Login Method</Label>
                    <Input className="h-8" value={detailValues.loginMethod} onChange={e => setDetailValues(v => ({ ...v, loginMethod: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={Building2} label="Department" value={platform.department || "N/A"} />
                  <InfoRow icon={Users} label="Estimated Users" value={platform.estimatedUsers || "N/A"} />
                  <InfoRow icon={Target} label="Impact Level" value={platform.impactLevel ? <ImpactBadge level={platform.impactLevel} /> : "N/A"} />
                  <InfoRow icon={DollarSign} label="Annual Cost" value={platform.annualCost ? `$${Number(platform.annualCost).toLocaleString()}` : "Free"} />
                  <InfoRow icon={Database} label="Data Categories" value={formatArray(platform.dataInput)} />
                  <InfoRow icon={Shield} label="Data Training" value={platform.dataTraining || "N/A"} />
                  <InfoRow icon={Key} label="Login Method" value={platform.loginMethod || "N/A"} />
                  <InfoRow icon={Calendar} label="Last Reviewed" value={formatDate(platform.lastReviewedAt)} />
                </div>
              )}

              {platform.decisionSummary && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-1">Decision Summary</p>
                    <p className="text-sm text-muted-foreground">{platform.decisionSummary}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {findings && findings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risk Findings
                </CardTitle>
                <CardDescription>{findings.length} finding{findings.length !== 1 ? "s" : ""}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {findings.map(f => (
                  <div key={f.id} className="p-3 rounded-md border space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <RiskBadge classification={f.classification} />
                      <ConfidenceBadge confidence={f.confidence} />
                    </div>
                    <p className="text-sm">{f.summary}</p>
                    {f.recommendedActions && (
                      <p className="text-sm text-muted-foreground">Action: {f.recommendedActions}</p>
                    )}
                    {f.sources && Array.isArray(f.sources) && (
                      <div className="flex flex-wrap gap-1">
                        {(f.sources as any[]).map((s: any, i: number) => (
                          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-muted-foreground">
                            <ExternalLink className="h-3 w-3" /> {s.title}
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{formatDate(f.createdAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Key Stakeholders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Key Stakeholders
                </CardTitle>
                {isAdmin && (
                  <Dialog open={addStakeholderOpen} onOpenChange={setAddStakeholderOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <UserPlus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Stakeholder</DialogTitle>
                        <DialogDescription>Add a key stakeholder who will receive notifications about this platform.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Name *</Label>
                          <Input value={stakeholderName} onChange={e => setStakeholderName(e.target.value)} placeholder="Full name" />
                        </div>
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input type="email" value={stakeholderEmail} onChange={e => setStakeholderEmail(e.target.value)} placeholder="email@company.com" />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={stakeholderRole} onValueChange={setStakeholderRole}>
                            <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="technical_lead">Technical Lead</SelectItem>
                              <SelectItem value="business_sponsor">Business Sponsor</SelectItem>
                              <SelectItem value="procurement">Procurement</SelectItem>
                              <SelectItem value="security">Security</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={() => addStakeholderMutation.mutate()} disabled={!stakeholderName || !stakeholderEmail || addStakeholderMutation.isPending} className="w-full">
                          {addStakeholderMutation.isPending ? "Adding..." : "Add Stakeholder"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {stakeholders && stakeholders.length > 0 ? (
                <div className="space-y-2">
                  {stakeholders.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-md border text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{s.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{s.email}</span>
                        </div>
                        {s.role && (
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            {s.role.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeStakeholderMutation.mutate(s.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No stakeholders added yet.</p>
              )}
              {stakeholders && stakeholders.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-2">Source: manual entry. Google & Slack integrations coming soon.</p>
              )}
            </CardContent>
          </Card>

          {/* Contract Expiration Alert */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Expiration Alert
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const dynAttrs = (platform.dynamicAttributes || {}) as Record<string, any>;
                const contractDate = dynAttrs["Contract Expiration"];
                if (!contractDate) {
                  return <p className="text-sm text-muted-foreground">Set the "Contract Expiration" attribute to enable alerts.</p>;
                }
                const expiry = new Date(contractDate);
                const now = new Date();
                const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const hasAlert = alerts && alerts.length > 0;

                return (
                  <div className="space-y-3">
                    <div className="p-2 rounded-md bg-muted/50 text-sm">
                      <p className="text-xs text-muted-foreground">Contract expires</p>
                      <p className="font-medium">{expiry.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                      <p className={`text-xs mt-1 ${daysLeft <= 30 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining` : "Expired"}
                      </p>
                    </div>
                    {hasAlert ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Bell className="h-3.5 w-3.5 text-primary" />
                          <span>Alert: {alerts[0].alertDaysBefore} days before</span>
                          {alerts[0].alertSent && (
                            <Badge variant="secondary" className="text-[10px]">Sent</Badge>
                          )}
                        </div>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteAlertMutation.mutate(alerts[0].id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : isAdmin ? (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => createAlertMutation.mutate()}>
                        <Bell className="h-3.5 w-3.5 mr-1" /> Enable 30-Day Alert
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">No alert configured.</p>
                    )}
                    {hasAlert && stakeholders && stakeholders.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Notifies: {stakeholders.map(s => s.name).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Documents
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {platformAttachments && platformAttachments.length > 0 ? (
                <div className="space-y-2">
                  {platformAttachments.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-md border text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{a.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(a.fileSize)} &middot; {a.uploaderName} &middot; {formatDate(a.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`/api/platform-attachments/${a.id}/download`, "_blank")}>
                          <Download className="h-3 w-3" />
                        </Button>
                        {(a.uploadedBy === user?.id || isAdmin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deletePlatformFileMutation.mutate(a.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              )}
              <div className="mt-3">
                <label>
                  <input
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) uploadPlatformFileMutation.mutate(file);
                      e.target.value = "";
                    }}
                    disabled={uploadPlatformFileMutation.isPending}
                  />
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <span>
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      {uploadPlatformFileMutation.isPending ? "Uploading..." : "Upload Document"}
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {linkedRequests && linkedRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Linked Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {linkedRequests.map(req => (
                  <Link key={req.id} href={`/requests/${req.id}`}>
                    <div className="p-2 rounded-md hover-elevate active-elevate-2 cursor-pointer">
                      <p className="text-sm font-medium">{req.trackingId}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">{req.requesterName}</p>
                        <StatusBadge status={req.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {platform.approvalDate && (
                <TimelineItem label="Approved" date={formatDate(platform.approvalDate)} />
              )}
              {platform.lastReviewedAt && (
                <TimelineItem label="Last Reviewed" date={formatDate(platform.lastReviewedAt)} />
              )}
              <TimelineItem label="Created" date={formatDate(platform.createdAt)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium">{typeof value === "string" ? value : value}</div>
      </div>
    </div>
  );
}

function TimelineItem({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
    </div>
  );
}
