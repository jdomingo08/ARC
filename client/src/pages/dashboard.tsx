import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ImpactBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Clock,
  CheckCircle2,
  ShieldAlert,
  FilePlus,
  Server,
  ArrowRight,
} from "lucide-react";
import type { Request } from "@shared/schema";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery<{
    totalRequests: number;
    pendingReviews: number;
    approvedPlatforms: number;
    totalPlatforms: number;
    activeRisks: number;
    recentRequests: Request[];
  }>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Requests",
      value: stats?.totalRequests || 0,
      description: "All intake submissions",
      icon: FileText,
    },
    {
      title: "Pending Reviews",
      value: stats?.pendingReviews || 0,
      description: "Awaiting committee action",
      icon: Clock,
    },
    {
      title: "Approved Platforms",
      value: stats?.approvedPlatforms || 0,
      description: `of ${stats?.totalPlatforms || 0} total platforms`,
      icon: CheckCircle2,
    },
    {
      title: "Active Risks",
      value: stats?.activeRisks || 0,
      description: "High/Critical findings",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with AI tool governance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/requests/new">
            <Button data-testid="button-new-request">
              <FilePlus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </Link>
          <Link href="/platforms">
            <Button variant="outline" data-testid="button-view-platforms">
              <Server className="h-4 w-4 mr-2" />
              View Platforms
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1" data-testid={`stat-${stat.title.toLowerCase().replace(/\s/g, '-')}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1">
          <div>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>Latest AI tool intake submissions</CardDescription>
          </div>
          <Link href="/requests">
            <Button variant="outline" size="sm" data-testid="button-view-all-requests">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {stats?.recentRequests && stats.recentRequests.length > 0 ? (
            <div className="space-y-3">
              {stats.recentRequests.map((req) => (
                <Link key={req.id} href={`/requests/${req.id}`}>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-md hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-request-${req.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-xs font-mono font-medium text-muted-foreground shrink-0">
                        {req.trackingId.slice(-3)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{req.toolName}</p>
                        <p className="text-xs text-muted-foreground">{req.department} - {req.requesterName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ImpactBadge level={req.impactLevel} />
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No requests yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
