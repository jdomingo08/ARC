import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, ImpactBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Request, ReviewDecision } from "@shared/schema";

export default function ReviewerInboxPage() {
  const { user } = useAuth();
  const { data: requests, isLoading: reqLoading } = useQuery<Request[]>({ queryKey: ["/api/requests"] });

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const pendingRequests = requests?.filter(r => r.status === "pending_reviews") || [];
  const completedRequests = requests?.filter(r => r.status !== "pending_reviews") || [];

  if (reqLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-inbox-title">Review Inbox</h1>
        <p className="text-muted-foreground mt-1">
          {user?.reviewerRole ? `${user.reviewerRole.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} Reviews` : "All Reviews"} - {pendingRequests.length} pending
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-2 mt-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No pending reviews</p>
                <p className="text-sm text-muted-foreground mt-1">All caught up!</p>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map(req => (
              <Link key={req.id} href={`/requests/${req.id}`}>
                <Card className="hover-elevate active-elevate-2 cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 text-xs font-mono font-medium shrink-0">
                          <Inbox className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate" data-testid={`text-review-tool-${req.id}`}>{req.toolName}</p>
                          <p className="text-sm text-muted-foreground">
                            {req.requesterName} - {req.department} - {formatDate(req.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ImpactBadge level={req.impactLevel} />
                        <StatusBadge status={req.status} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2 ml-13">{req.primaryGoal}</p>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-2 mt-4">
          {completedRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No completed reviews yet</p>
              </CardContent>
            </Card>
          ) : (
            completedRequests.map(req => (
              <Link key={req.id} href={`/requests/${req.id}`}>
                <Card className="hover-elevate active-elevate-2 cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{req.toolName}</p>
                        <p className="text-sm text-muted-foreground">{req.requesterName} - {req.department}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={req.status} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
