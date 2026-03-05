import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";
import type { Platform, Tier, RiskFinding, Request, PlatformAttributeDefinition } from "@shared/schema";

export default function PlatformDetailPage() {
  const [, params] = useRoute("/platforms/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const id = params?.id;

  const [editingAttrs, setEditingAttrs] = useState(false);
  const [attrValues, setAttrValues] = useState<Record<string, any>>({});

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
      {attrDefs && attrDefs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Custom Attributes</CardTitle>
              {isAdmin && !editingAttrs && (
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
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Platform Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
