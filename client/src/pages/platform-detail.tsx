import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "lucide-react";
import type { Platform, Tier, RiskFinding, Request, PlatformAttributeDefinition } from "@shared/schema";

export default function PlatformDetailPage() {
  const [, params] = useRoute("/platforms/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const id = params?.id;

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
        )}
      </div>

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

              {attrDefs && attrDefs.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Custom Attributes</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {attrDefs.map(attr => (
                        <div key={attr.id} className="text-sm">
                          <p className="text-muted-foreground">{attr.name}</p>
                          <p className="font-medium">{dynAttrs[attr.name] || attr.defaultValue || "Not set"}</p>
                        </div>
                      ))}
                    </div>
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
