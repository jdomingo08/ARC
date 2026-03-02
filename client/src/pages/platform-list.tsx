import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, ImpactBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Search, ArrowRight, DollarSign, Calendar } from "lucide-react";
import type { Platform, Tier } from "@shared/schema";

export default function PlatformListPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data: platforms, isLoading } = useQuery<Platform[]>({ queryKey: ["/api/platforms"] });
  const { data: tiers } = useQuery<Tier[]>({ queryKey: ["/api/admin/tiers"] });

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
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">No platforms found</p>
          </CardContent>
        </Card>
      ) : (
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
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
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
      )}
    </div>
  );
}
