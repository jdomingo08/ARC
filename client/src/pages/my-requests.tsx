import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ImpactBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FilePlus, ChevronRight, PenLine } from "lucide-react";
import { useState } from "react";
import type { Request, ReviewDecision } from "@shared/schema";

function ReviewProgressBar({ requestId }: { requestId: string }) {
  const { data: reviews } = useQuery<ReviewDecision[]>({
    queryKey: ["/api/requests", requestId, "reviews"],
  });

  const activeReviews = reviews?.filter(r => !r.superseded) || [];
  const securityReview = activeReviews.find(r => r.reviewerRole === "security");
  const techReview = activeReviews.find(r => r.reviewerRole === "technical_financial");
  const chairReviews = activeReviews.filter(r => r.reviewerRole === "chair");
  const chairPassed = chairReviews.some(r => r.decision === "pass");

  type StepStatus = "pass" | "fail" | "pending" | "none";

  const getStatus = (review: ReviewDecision | undefined, isChair?: boolean): StepStatus => {
    if (isChair) {
      if (chairReviews.length === 0) return "none";
      if (chairReviews.some(r => r.decision === "fail")) return "fail";
      if (chairPassed) return "pass";
      return "pending";
    }
    if (!review) return "none";
    if (review.decision === "pass") return "pass";
    if (review.decision === "fail") return "fail";
    return "pending";
  };

  const securityStatus = getStatus(securityReview);
  const techStatus = getStatus(techReview);
  const chairStatus = getStatus(undefined, true);

  const steps: { label: string; status: StepStatus }[] = [
    { label: "Security", status: securityStatus },
    { label: "Financial", status: techStatus },
    { label: "Chair", status: chairStatus },
  ];

  const getStepStyle = (status: StepStatus) => {
    switch (status) {
      case "pass":
        return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700";
      case "fail":
        return "bg-gray-900 text-white border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700";
      case "none":
      default:
        return "bg-muted/40 text-muted-foreground border-border";
    }
  };

  const getArrowColor = (fromStatus: StepStatus) => {
    switch (fromStatus) {
      case "pass":
        return "text-green-500 dark:text-green-400";
      case "fail":
        return "text-gray-700 dark:text-gray-400";
      case "pending":
        return "text-yellow-500 dark:text-yellow-400";
      default:
        return "text-muted-foreground/40";
    }
  };

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          <div
            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStepStyle(step.status)}`}
            title={`${step.label}: ${step.status === "none" ? "Not started" : step.status}`}
          >
            {step.label}
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className={`h-3 w-3 shrink-0 ${getArrowColor(step.status)}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function MyRequestsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: requests, isLoading } = useQuery<Request[]>({
    queryKey: ["/api/requests"],
  });

  const drafts = requests?.filter(r => r.status === "draft") || [];
  const nonDrafts = requests?.filter(r => r.status !== "draft") || [];
  const filtered = nonDrafts.filter(r => statusFilter === "all" || r.status === statusFilter);

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
              <SelectItem value="draft">Drafts</SelectItem>
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

      {/* Draft Requests */}
      {drafts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Drafts</h2>
          {drafts.map(draft => (
            <Link key={draft.id} href={`/requests/new?draft=${draft.id}`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <PenLine className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="font-medium truncate">{draft.toolName || "Untitled Draft"}</p>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{draft.trackingId}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status="draft" />
                      <span className="text-xs text-muted-foreground">{formatDate(draft.updatedAt)}</span>
                      <Button size="sm" variant="outline">Continue</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

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
                  <div className="flex flex-col gap-2">
                    {/* Top row: tool name + tracking ID side by side, status + impact on right */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium truncate" data-testid={`text-tool-${req.id}`}>{req.toolName}</p>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">{req.trackingId}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ImpactBadge level={req.impactLevel} />
                        <StatusBadge status={req.status} />
                      </div>
                    </div>
                    {/* Bottom row: progress bar + meta */}
                    <div className="flex items-center justify-between gap-3">
                      <ReviewProgressBar requestId={req.id} />
                      <p className="text-xs text-muted-foreground shrink-0">{req.department} - {formatDate(req.createdAt)}</p>
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
