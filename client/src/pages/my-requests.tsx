import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ImpactBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FilePlus, ArrowRight } from "lucide-react";
import { useState } from "react";
import type { Request } from "@shared/schema";

export default function MyRequestsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: requests, isLoading } = useQuery<Request[]>({
    queryKey: ["/api/requests"],
  });

  const filtered = requests?.filter(r => statusFilter === "all" || r.status === statusFilter) || [];

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-my-requests-title">My Requests</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} request{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_reviews">Pending Reviews</SelectItem>
              <SelectItem value="waiting_on_requester">Waiting on Me</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/requests/new">
            <Button data-testid="button-new-request">
              <FilePlus className="h-4 w-4 mr-2" /> New Request
            </Button>
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">No requests found</p>
            <Link href="/requests/new">
              <Button data-testid="button-create-first"><FilePlus className="h-4 w-4 mr-2" /> Create Your First Request</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => (
            <Link key={req.id} href={`/requests/${req.id}`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted text-xs font-mono font-medium text-muted-foreground shrink-0">
                        {req.trackingId}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate" data-testid={`text-tool-${req.id}`}>{req.toolName}</p>
                        <p className="text-sm text-muted-foreground">{req.department} - Submitted {formatDate(req.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ImpactBadge level={req.impactLevel} />
                      <StatusBadge status={req.status} />
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
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
