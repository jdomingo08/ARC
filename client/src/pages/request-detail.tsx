import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, ImpactBadge, DecisionBadge, RoleBadge } from "@/components/status-badge";
import { ReviewPanel } from "@/components/review-panel";
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  Target,
  Users,
  Workflow,
  Scale,
  Monitor,
  DollarSign,
  Shield,
  Key,
  Database,
  CheckCircle2,
} from "lucide-react";
import type { Request, ReviewDecision, AuditLog } from "@shared/schema";

export default function RequestDetailPage() {
  const [, params] = useRoute("/requests/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const id = params?.id;

  const { data: request, isLoading } = useQuery<Request>({
    queryKey: ["/api/requests", id],
    enabled: !!id,
  });

  const { data: reviews } = useQuery<ReviewDecision[]>({
    queryKey: ["/api/requests", id, "reviews"],
    enabled: !!id,
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit", "request", id],
    enabled: !!id,
  });

  const resubmitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/requests/${id}`, { status: "pending_reviews" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request Resubmitted", description: "Your request has been sent back for review." });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const formatArray = (arr: string[] | null) =>
    arr?.map(s => s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())).join(", ") || "N/A";

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Request not found</p>
        <Link href="/requests"><Button variant="outline" className="mt-4">Back to Requests</Button></Link>
      </div>
    );
  }

  const activeReviews = reviews?.filter(r => !r.superseded) || [];
  const canReview = user && (user.role === "reviewer" || user.role === "chair") && request.status === "pending_reviews";

  const securityReview = activeReviews.find(r => r.reviewerRole === "security");
  const techReview = activeReviews.find(r => r.reviewerRole === "technical_financial");
  const strategicReview = activeReviews.find(r => r.reviewerRole === "strategic");
  const chairReviews = activeReviews.filter(r => r.reviewerRole === "chair");

  const canChairApprove = securityReview?.decision === "pass" && techReview?.decision === "pass";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/requests">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-request-title">{request.toolName}</h1>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{request.trackingId}</p>
        </div>
        {request.status === "waiting_on_requester" && user?.id === request.requesterId && (
          <Button onClick={() => resubmitMutation.mutate()} disabled={resubmitMutation.isPending} data-testid="button-resubmit">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {resubmitMutation.isPending ? "Resubmitting..." : "Resubmit for Review"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={User} label="Requester" value={request.requesterName} />
                <InfoRow icon={Building2} label="Department" value={request.department} />
                <InfoRow icon={Target} label="Primary Goal" value={request.primaryGoal} />
                <InfoRow icon={Users} label="Estimated Users" value={`${request.estimatedUsers}${request.estimatedUsersCount ? ` (${request.estimatedUsersCount})` : ""}`} />
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={Workflow} label="Workflow Integration" value={request.workflowIntegration || "N/A"} />
                <InfoRow icon={Scale} label="Impact Level" value={<ImpactBadge level={request.impactLevel} />} />
                <InfoRow icon={Monitor} label="Compatibility" value={formatArray(request.compatibility)} />
                <InfoRow icon={DollarSign} label="Cost" value={request.annualCost ? `$${Number(request.annualCost).toLocaleString()}/yr (${request.costStructure?.replace(/_/g, " ")})` : "N/A"} />
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={Database} label="Data Categories" value={formatArray(request.dataInput)} />
                <InfoRow icon={Shield} label="Data Training" value={request.dataTraining || "N/A"} />
                <InfoRow icon={Key} label="Login Method" value={request.loginMethod} />
                <InfoRow icon={Calendar} label="Submitted" value={formatDate(request.createdAt)} />
              </div>
              {request.alternativesChecked && (
                <>
                  <Separator />
                  <InfoRow icon={Scale} label="Alternatives Evaluated" value={request.alternativesText || "Yes"} />
                </>
              )}
            </CardContent>
          </Card>

          {canReview && (
            <ReviewPanel
              requestId={request.id}
              userReviewerRole={user.reviewerRole || ""}
              userRole={user.role}
              canChairApprove={canChairApprove}
              securityPassed={!!securityReview && securityReview.decision === "pass"}
              techPassed={!!techReview && techReview.decision === "pass"}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Review Status</CardTitle>
              <CardDescription>Approval workflow progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReviewStep label="Strategic Review" subtitle="Advisory" review={strategicReview} optional />
              <ReviewStep label="Security Review" subtitle="Required" review={securityReview} />
              <ReviewStep label="Tech/Financial Review" subtitle="Required" review={techReview} />
              <ReviewStep label="Chair Sign-off" subtitle="Both required" reviews={chairReviews} requireCount={2} locked={!canChairApprove && request.status === "pending_reviews"} />
            </CardContent>
          </Card>

          {auditLogs && auditLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditLogs.slice(0, 10).map(log => (
                    <div key={log.id} className="flex items-start gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                      <div>
                        <p className="font-medium">{log.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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

function ReviewStep({ label, subtitle, review, reviews, requireCount, optional, locked }: {
  label: string;
  subtitle: string;
  review?: ReviewDecision;
  reviews?: ReviewDecision[];
  requireCount?: number;
  optional?: boolean;
  locked?: boolean;
}) {
  const items = reviews || (review ? [review] : []);
  const passCount = items.filter(r => r.decision === "pass").length;
  const hasDecision = items.length > 0;
  const allPassed = requireCount ? passCount >= requireCount : items.some(r => r.decision === "pass");
  const hasFail = items.some(r => r.decision === "fail");
  const isPending = hasDecision && !allPassed && !hasFail;

  const getBorderColor = () => {
    if (locked) return "border-border opacity-50";
    if (!hasDecision && !optional) return "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-700";
    if (allPassed) return "border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-700";
    if (hasFail) return "border-gray-700 bg-gray-100 dark:bg-gray-800/50 dark:border-gray-600";
    if (isPending) return "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-700";
    return "border-border";
  };

  return (
    <div className={`p-3 rounded-md border ${getBorderColor()}`}>
      <div className="flex items-center justify-between gap-1">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {locked ? (
          <span className="text-xs text-muted-foreground">Locked</span>
        ) : hasDecision ? (
          <div className="flex gap-1 flex-wrap">
            {items.map((r, i) => <DecisionBadge key={i} decision={r.decision} />)}
          </div>
        ) : optional ? (
          <span className="text-xs text-muted-foreground">Optional</span>
        ) : (
          <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Pending</span>
        )}
      </div>
      {items.map((r, i) => (
        <div key={i} className="mt-2 text-xs text-muted-foreground">
          <p>{r.rationale}</p>
          {r.conditions && <p className="mt-1 font-medium">Conditions: {r.conditions}</p>}
        </div>
      ))}
    </div>
  );
}
