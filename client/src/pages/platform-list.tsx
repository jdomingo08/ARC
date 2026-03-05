import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, ImpactBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Server, Search, ArrowRight, DollarSign, Calendar, LayoutGrid, List, ArrowUpDown, ChevronUp, ChevronDown, Plus, Trash2, Layers } from "lucide-react";
import type { Platform, Tier } from "@shared/schema";

type SortField = "toolName" | "status" | "department" | "tier" | "impactLevel" | "annualCost" | "lastReviewedAt";

export default function PlatformListPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "tier">("grid");
  const [sortField, setSortField] = useState<SortField>("toolName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: platforms, isLoading } = useQuery<Platform[]>({ queryKey: ["/api/platforms"] });
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/admin/tiers"] });

  const isAdmin = user?.role === "admin" || user?.role === "chair";

  // Add Platform dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newToolName, setNewToolName] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newPrimaryGoal, setNewPrimaryGoal] = useState("");
  const [newImpactLevel, setNewImpactLevel] = useState("");
  const [newStatus, setNewStatus] = useState("on_review");

  const createPlatformMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        toolName: newToolName,
        department: newDepartment || null,
        primaryGoal: newPrimaryGoal || null,
        impactLevel: newImpactLevel || null,
        status: newStatus,
      };
      const res = await apiRequest("POST", "/api/admin/platforms", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Platform Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
      setAddOpen(false);
      setNewToolName("");
      setNewDepartment("");
      setNewPrimaryGoal("");
      setNewImpactLevel("");
      setNewStatus("on_review");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deletePlatformMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/platforms/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Platform Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const changeTierMutation = useMutation({
    mutationFn: async ({ platformId, tierId }: { platformId: string; tierId: string | null }) => {
      const res = await apiRequest("PATCH", `/api/platforms/${platformId}`, { tierId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Tier Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Drag state for tier view
  const [dragPlatformId, setDragPlatformId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, platformId: string) => {
    if (!isAdmin) return;
    e.dataTransfer.setData("platformId", platformId);
    setDragPlatformId(platformId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, tierId: string | null) => {
    if (!isAdmin) return;
    e.preventDefault();
    const platformId = e.dataTransfer.getData("platformId");
    if (platformId) {
      const platform = platforms?.find(p => p.id === platformId);
      if (platform && platform.tierId !== tierId) {
        changeTierMutation.mutate({ platformId, tierId });
      }
    }
    setDragPlatformId(null);
  };

  const handleDelete = (e: React.MouseEvent, platformId: string, platformName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${platformName}"? This cannot be undone.`)) {
      deletePlatformMutation.mutate(platformId);
    }
  };

  const getTierName = (tierId: string | null) => {
    if (!tierId) return null;
    return tiers?.find(t => t.id === tierId)?.name || null;
  };

  const filtered = platforms?.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.toolName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatCost = (cost: string | null) => {
    if (!cost || cost === "0") return "Free";
    return `$${Number(cost).toLocaleString()}/yr`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  const sorted = useMemo(() => {
    if (viewMode !== "list") return filtered;
    const items = [...filtered];
    items.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "toolName":
          return dir * a.toolName.localeCompare(b.toolName);
        case "status":
          return dir * (a.status || "").localeCompare(b.status || "");
        case "department":
          return dir * (a.department || "").localeCompare(b.department || "");
        case "tier": {
          const tA = getTierName(a.tierId) || "";
          const tB = getTierName(b.tierId) || "";
          return dir * tA.localeCompare(tB);
        }
        case "impactLevel": {
          const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
          return dir * ((order[a.impactLevel || ""] || 0) - (order[b.impactLevel || ""] || 0));
        }
        case "annualCost":
          return dir * (Number(a.annualCost || 0) - Number(b.annualCost || 0));
        case "lastReviewedAt": {
          const dA = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
          const dB = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
          return dir * (dA - dB);
        }
        default:
          return 0;
      }
    });
    return items;
  }, [filtered, sortField, sortDirection, viewMode, tiers]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-platforms-title">Platform Inventory</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} platform{filtered.length !== 1 ? "s" : ""} in registry</p>
        </div>
        {isAdmin && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-platform">
                <Plus className="h-4 w-4 mr-2" /> Add Platform
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Platform</DialogTitle>
                <DialogDescription>Add a platform directly to the inventory without going through the request form.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tool Name *</Label>
                  <Input value={newToolName} onChange={e => setNewToolName(e.target.value)} placeholder="e.g., Slack, Notion, ChatGPT" data-testid="input-platform-name" />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={newDepartment} onChange={e => setNewDepartment(e.target.value)} placeholder="e.g., Engineering, Marketing" data-testid="input-platform-dept" />
                </div>
                <div className="space-y-2">
                  <Label>Description / Primary Goal</Label>
                  <Textarea value={newPrimaryGoal} onChange={e => setNewPrimaryGoal(e.target.value)} placeholder="What is this platform used for?" data-testid="input-platform-goal" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Impact Level</Label>
                    <Select value={newImpactLevel} onValueChange={setNewImpactLevel}>
                      <SelectTrigger data-testid="select-platform-impact"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger data-testid="select-platform-status-new"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_review">On Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={() => createPlatformMutation.mutate()} disabled={!newToolName || createPlatformMutation.isPending} className="w-full" data-testid="button-save-platform">
                  {createPlatformMutation.isPending ? "Creating..." : "Create Platform"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search platforms..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-platforms"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-platform-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="on_review">On Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "tier" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("tier")}
            aria-label="Group by tier"
          >
            <Layers className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">No platforms found</p>
          </CardContent>
        </Card>
      ) : viewMode === "tier" ? (
        <TierGroupView
          platforms={filtered}
          tiers={tiers || []}
          isAdmin={isAdmin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDelete={handleDelete}
          onChangeTier={(platformId, tierId) => changeTierMutation.mutate({ platformId, tierId })}
          dragPlatformId={dragPlatformId}
          getTierName={getTierName}
          formatCost={formatCost}
          formatDate={formatDate}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(platform => (
            <Link key={platform.id} href={`/platforms/${platform.id}`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate" data-testid={`text-platform-${platform.id}`}>{platform.toolName}</h3>
                        <StatusBadge status={platform.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{platform.primaryGoal || "No description"}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDelete(e, platform.id, platform.toolName)}
                          data-testid={`button-delete-platform-${platform.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {platform.department && (
                      <span className="text-xs text-muted-foreground">{platform.department}</span>
                    )}
                    {getTierName(platform.tierId) && (
                      <Badge variant="outline">{getTierName(platform.tierId)}</Badge>
                    )}
                    {platform.impactLevel && <ImpactBadge level={platform.impactLevel} />}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCost(platform.annualCost)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {platform.lastReviewedAt ? `Reviewed ${formatDate(platform.lastReviewedAt)}` : `Added ${formatDate(platform.createdAt)}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {([
                  { field: "toolName" as SortField, label: "Name" },
                  { field: "status" as SortField, label: "Status" },
                  { field: "department" as SortField, label: "Department" },
                  { field: "tier" as SortField, label: "Tier" },
                  { field: "impactLevel" as SortField, label: "Impact" },
                  { field: "annualCost" as SortField, label: "Annual Cost", align: "right" as const },
                  { field: "lastReviewedAt" as SortField, label: "Last Reviewed" },
                ]).map(col => (
                  <TableHead
                    key={col.field}
                    className={`cursor-pointer select-none ${"align" in col && col.align === "right" ? "text-right" : ""}`}
                    onClick={() => handleSort(col.field)}
                  >
                    <div className={`flex items-center ${"align" in col && col.align === "right" ? "justify-end" : ""}`}>
                      {col.label}
                      <SortIcon field={col.field} />
                    </div>
                  </TableHead>
                ))}
                {isAdmin && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(platform => (
                <TableRow
                  key={platform.id}
                  className="cursor-pointer"
                  onClick={() => setLocation(`/platforms/${platform.id}`)}
                >
                  <TableCell className="font-medium">{platform.toolName}</TableCell>
                  <TableCell><StatusBadge status={platform.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{platform.department || "\u2014"}</TableCell>
                  <TableCell>
                    {getTierName(platform.tierId)
                      ? <Badge variant="outline">{getTierName(platform.tierId)}</Badge>
                      : <span className="text-muted-foreground">{"\u2014"}</span>}
                  </TableCell>
                  <TableCell>
                    {platform.impactLevel
                      ? <ImpactBadge level={platform.impactLevel} />
                      : <span className="text-muted-foreground">{"\u2014"}</span>}
                  </TableCell>
                  <TableCell className="text-right">{formatCost(platform.annualCost)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {platform.lastReviewedAt ? formatDate(platform.lastReviewedAt) : formatDate(platform.createdAt)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, platform.id, platform.toolName)}
                        data-testid={`button-delete-platform-${platform.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TierGroupView({
  platforms,
  tiers,
  isAdmin,
  onDragStart,
  onDragOver,
  onDrop,
  onDelete,
  onChangeTier,
  dragPlatformId,
  getTierName,
  formatCost,
  formatDate,
}: {
  platforms: Platform[];
  tiers: Tier[];
  isAdmin: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, tierId: string | null) => void;
  onDelete: (e: React.MouseEvent, id: string, name: string) => void;
  onChangeTier: (platformId: string, tierId: string | null) => void;
  dragPlatformId: string | null;
  getTierName: (tierId: string | null) => string | null;
  formatCost: (cost: string | null) => string;
  formatDate: (date: string | Date | null) => string;
}) {
  // Group platforms by tier
  const tierGroups: { tier: Tier | null; platforms: Platform[] }[] = [];

  // Add groups for each defined tier
  for (const tier of tiers) {
    tierGroups.push({
      tier,
      platforms: platforms.filter(p => p.tierId === tier.id),
    });
  }

  // Add "Unassigned" group
  const unassigned = platforms.filter(p => !p.tierId || !tiers.find(t => t.id === p.tierId));
  tierGroups.push({ tier: null, platforms: unassigned });

  return (
    <div className="space-y-6">
      {tierGroups.map(group => {
        const tierId = group.tier?.id || null;
        const tierLabel = group.tier?.name || "Unassigned";
        const tierDesc = group.tier?.description;
        const isDragOver = dragPlatformId !== null;

        return (
          <div
            key={tierId || "unassigned"}
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, tierId)}
            className={`rounded-lg border-2 transition-colors ${
              isDragOver ? "border-dashed border-primary/50 bg-primary/5" : "border-transparent"
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-t-lg">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{tierLabel}</h3>
                {tierDesc && <p className="text-xs text-muted-foreground">{tierDesc}</p>}
              </div>
              <Badge variant="secondary">{group.platforms.length}</Badge>
            </div>

            {group.platforms.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                {isAdmin && dragPlatformId ? "Drop here to assign this tier" : "No platforms in this tier"}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                {group.platforms.map(platform => (
                  <Link key={platform.id} href={`/platforms/${platform.id}`}>
                    <Card
                      className={`hover-elevate active-elevate-2 h-full ${
                        isAdmin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                      } ${dragPlatformId === platform.id ? "opacity-50" : ""}`}
                      draggable={isAdmin}
                      onDragStart={e => { e.stopPropagation(); onDragStart(e, platform.id); }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-sm truncate">{platform.toolName}</h4>
                              <StatusBadge status={platform.status} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{platform.primaryGoal || "No description"}</p>
                          </div>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={(e) => onDelete(e, platform.id, platform.toolName)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {platform.department && <span>{platform.department}</span>}
                          <span>{formatCost(platform.annualCost)}</span>
                        </div>
                        {isAdmin && (
                          <div className="mt-2" onClick={e => e.preventDefault()}>
                            <Select
                              value={platform.tierId || "unassigned"}
                              onValueChange={v => {
                                onChangeTier(platform.id, v === "unassigned" ? null : v);
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Assign tier..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {tiers.map(t => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
