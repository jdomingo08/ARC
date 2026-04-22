import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, ImpactBadge, DecisionBadge, RoleBadge } from "@/components/status-badge";
import { ReviewPanel } from "@/components/review-panel";
import {
  ArrowLeft,
  Calendar,
  User as UserIcon,
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
  ChevronDown,
  Pencil,
  Lock,
  Unlock,
  MessageSquare,
  Paperclip,
  Upload,
  Download,
  Trash2,
  X,
  Save,
  ShieldCheck,
  Clock,
  HelpCircle,
} from "lucide-react";
import { getFilteredQuestions } from "@shared/vendor-questions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Request, ReviewDecision, AuditLog, RequestComment, RequestAttachment, WorkflowStep } from "@shared/schema";

export default function RequestDetailPage() {
  const [, params] = useRoute("/requests/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const id = params?.id;

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Request>>({});
  const [commentText, setCommentText] = useState("");
  const [adminOverrideRole, setAdminOverrideRole] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: comments } = useQuery<RequestComment[]>({
    queryKey: ["/api/requests", id, "comments"],
    enabled: !!id,
  });

  const { data: attachments } = useQuery<RequestAttachment[]>({
    queryKey: ["/api/requests", id, "attachments"],
    enabled: !!id,
  });

  const { data: workflowSteps } = useQuery<WorkflowStep[]>({
    queryKey: ["/api/workflow-steps"],
  });

  // Vendor security review state
  const [securityAssessments, setSecurityAssessments] = useState<Record<string, string>>({});
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);

  const submitSecurityAssessment = async () => {
    if (!id) return;
    setAssessmentSubmitting(true);
    try {
      await apiRequest("POST", `/api/requests/${id}/vendor-security-review`, { assessments: securityAssessments });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      toast({ title: "Security Assessment Submitted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAssessmentSubmitting(false);
    }
  };

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

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Request>) => {
      const res = await apiRequest("PATCH", `/api/requests/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request Updated" });
      setEditing(false);
      setEditData({});
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      const res = await apiRequest("PATCH", `/api/requests/${id}/lock`, { locked });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.locked ? "Request Locked" : "Request Unlocked" });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/requests/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Request Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      setLocation("/requests");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const adminOverrideMutation = useMutation({
    mutationFn: async (targetReviewerRole: string) => {
      const res = await apiRequest("POST", `/api/requests/${id}/admin-clear-waiting`, { targetReviewerRole });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Admin Override Applied", description: "Request returned to pending reviews." });
      setAdminOverrideRole("");
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit", "request", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (err: Error) => {
      toast({ title: "Override Failed", description: err.message, variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/requests/${id}/comments`, { body });
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "comments"] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest("DELETE", `/api/requests/${id}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "comments"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/requests/${id}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "File Uploaded" });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "attachments"] });
    },
    onError: (err: Error) => {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiRequest("DELETE", `/api/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "attachments"] });
    },
  });

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const formatArray = (arr: string[] | string | null | undefined) => {
    if (!arr) return "N/A";
    const list = Array.isArray(arr) ? arr : [arr];
    return list.map(s => String(s).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())).join(", ") || "N/A";
  };

  const formatLabel = (s: string | null | undefined, fallback = "Not provided") =>
    s ? s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : fallback;

  const formatBool = (b: boolean | null | undefined) =>
    b === true ? "Yes" : b === false ? "No" : "Not provided";

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
  const isTargetedReviewer = !!(
    user?.reviewerRole &&
    request.status === "waiting_on_reviewer" &&
    request.waitingOnRole === user.reviewerRole
  );
  const hasReviewerAccess = !!(user && (user.role === "reviewer" || user.role === "chair" || (user.role === "admin" && !!user.reviewerRole)));
  const canReview = hasReviewerAccess && (request.status === "pending_reviews" || isTargetedReviewer);

  const securityReview = activeReviews.find(r => r.reviewerRole === "security");
  const techReview = activeReviews.find(r => r.reviewerRole === "technical_financial");
  const strategicReview = activeReviews.find(r => r.reviewerRole === "strategic");
  const chairReviews = activeReviews.filter(r => r.reviewerRole === "chair");
  const canChairApprove = securityReview?.decision === "pass" && techReview?.decision === "pass";

  const isAdmin = user?.role === "admin";
  const isOwner = user?.id === request.requesterId;
  const canEdit = !request.locked ? (isOwner || isAdmin) : isAdmin;

  // Needs-more-info decisions directed at the current user (requester or targeted reviewer)
  const needsMoreInfoForMe = activeReviews.filter(r =>
    r.decision === "needs_more_info" && (
      (request.status === "waiting_on_requester" && isOwner) ||
      (isTargetedReviewer && r.routedToRole === user?.reviewerRole)
    )
  );

  const startEditing = () => {
    setEditData({
      primaryGoal: request.primaryGoal,
      estimatedUsers: request.estimatedUsers,
      estimatedUsersCount: request.estimatedUsersCount,
      workflowIntegration: request.workflowIntegration,
      impactLevel: request.impactLevel,
      costStructure: request.costStructure,
      annualCost: request.annualCost,
      dataTraining: request.dataTraining,
      loginMethod: request.loginMethod,
      alternativesText: request.alternativesText,
    });
    setEditing(true);
  };

  const saveEdit = () => {
    updateMutation.mutate(editData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
            {request.locked && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{request.trackingId}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => lockMutation.mutate(!request.locked)}
              disabled={lockMutation.isPending}
            >
              {request.locked ? <Unlock className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
              {request.locked ? "Unlock" : "Lock"}
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (window.confirm(`Delete request "${request.toolName}"? This cannot be undone.`)) {
                  deleteRequestMutation.mutate();
                }
              }}
              disabled={deleteRequestMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          {isAdmin && (request.status === "waiting_on_requester" || request.status === "waiting_on_reviewer") && (
            <>
              <Select value={adminOverrideRole} onValueChange={setAdminOverrideRole}>
                <SelectTrigger className="h-8 w-48 text-sm">
                  <SelectValue placeholder="Route to stage..." />
                </SelectTrigger>
                <SelectContent>
                  {(workflowSteps && workflowSteps.length > 0
                    ? workflowSteps.map(s => ({ value: s.reviewerRole, label: s.name }))
                    : [
                        { value: "security", label: "Security" },
                        { value: "technical_financial", label: "Technical / Financial" },
                        { value: "strategic", label: "Strategic" },
                        { value: "chair", label: "Chair" },
                      ]
                  ).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!adminOverrideRole) {
                    toast({ title: "Select a review stage first", variant: "destructive" });
                    return;
                  }
                  if (window.confirm(`Override waiting status and send to ${adminOverrideRole.replace(/_/g, " ")} review?`)) {
                    adminOverrideMutation.mutate(adminOverrideRole);
                  }
                }}
                disabled={adminOverrideMutation.isPending || !adminOverrideRole}
              >
                <ShieldCheck className="h-4 w-4 mr-1" />
                {adminOverrideMutation.isPending ? "Overriding..." : "Override & Send to Review"}
              </Button>
            </>
          )}
          {isAdmin && !editing && (
            <Link href={`/requests/${id}/edit`}>
              <Button variant="outline" size="sm" data-testid="button-admin-full-edit">
                <Pencil className="h-4 w-4 mr-1" /> Edit Full Request
              </Button>
            </Link>
          )}
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="h-4 w-4 mr-1" /> Quick Edit
            </Button>
          )}
          {editing && (
            <>
              <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditData({}); }}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </>
          )}
          {request.status === "waiting_on_requester" && isOwner && (
            <Button onClick={() => resubmitMutation.mutate()} disabled={resubmitMutation.isPending} data-testid="button-resubmit">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {resubmitMutation.isPending ? "Resubmitting..." : "Resubmit for Review"}
            </Button>
          )}
          {isTargetedReviewer && (
            <Button onClick={() => resubmitMutation.mutate()} disabled={resubmitMutation.isPending} data-testid="button-respond">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {resubmitMutation.isPending ? "Sending..." : "Respond to Review"}
            </Button>
          )}
        </div>
      </div>

      {needsMoreInfoForMe.length > 0 && (
        <div className="space-y-3">
          {needsMoreInfoForMe.map(r => {
            const stepName = workflowSteps?.find(s => s.reviewerRole === r.reviewerRole)?.name
              || r.reviewerRole.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
            return (
              <Alert key={r.id} className="border-amber-400 bg-amber-50 dark:bg-amber-950/20">
                <HelpCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-400">
                  Additional Information Requested by {stepName}
                </AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-1">
                  <p>{r.rationale}</p>
                  {r.riskNotes && (
                    <p className="font-medium">Risk Notes: {r.riskNotes}</p>
                  )}
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Details</CardTitle>
              <CardDescription>All four sections of the request form, shown in full to every reviewer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Section 1: The Basics */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">The Basics</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={UserIcon} label="Requester" value={request.requesterName} />
                  <InfoRow icon={Building2} label="Department" value={request.department} />
                  {editing ? (
                    <EditField
                      icon={Target}
                      label="Primary Goal"
                      value={editData.primaryGoal || ""}
                      onChange={v => setEditData(d => ({ ...d, primaryGoal: v }))}
                    />
                  ) : (
                    <InfoRow icon={Target} label="Primary Goal" value={request.primaryGoal || "Not provided"} />
                  )}
                  {editing ? (
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Estimated Users</p>
                        <Select value={editData.estimatedUsers || ""} onValueChange={v => setEditData(d => ({ ...d, estimatedUsers: v }))}>
                          <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual">Individual</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                            <SelectItem value="department">Department</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <InfoRow icon={Users} label="Estimated Users" value={`${formatLabel(request.estimatedUsers)}${request.estimatedUsersCount ? ` (${request.estimatedUsersCount})` : ""}`} />
                  )}
                  <InfoRow icon={Building2} label="Division" value={formatLabel((request as any).division)} />
                  <InfoRow
                    icon={Target}
                    label="Tool Category"
                    value={
                      (request as any).toolCategory && (request as any).toolCategory.length > 0
                        ? `${formatArray((request as any).toolCategory)}${(request as any).toolCategoryOther ? ` — ${(request as any).toolCategoryOther}` : ""}`
                        : "Not provided"
                    }
                  />
                  <InfoRow icon={Workflow} label="Already In Use" value={formatLabel((request as any).alreadyInUse)} />
                  <InfoRow icon={CheckCircle2} label="Authorized Requestor" value={formatBool((request as any).authorizedRequestor)} />
                  <InfoRow
                    icon={CheckCircle2}
                    label="Training Plan"
                    value={
                      (request as any).trainingPlan
                        ? `${formatLabel((request as any).trainingPlan)}${(request as any).trainingPlanDetails ? ` — ${(request as any).trainingPlanDetails}` : ""}`
                        : "Not provided"
                    }
                  />
                  <InfoRow icon={CheckCircle2} label="AI Policy Acknowledged" value={formatBool((request as any).aiPolicyAcknowledged)} />
                </div>
              </div>

              <Separator />

              {/* Section 2: Strategic Fit & Use Case */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Strategic Fit & Use Case</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={Target} label="Use Case Type" value={formatLabel((request as any).useCaseType)} />
                  {editing ? (
                    <EditField
                      icon={Workflow}
                      label="Workflow Integration"
                      value={editData.workflowIntegration || ""}
                      onChange={v => setEditData(d => ({ ...d, workflowIntegration: v }))}
                    />
                  ) : (
                    <InfoRow icon={Workflow} label="Workflow Integration" value={request.workflowIntegration || "Not provided"} />
                  )}
                  {editing ? (
                    <div className="flex items-start gap-2">
                      <Scale className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Impact Level</p>
                        <Select value={editData.impactLevel || ""} onValueChange={v => setEditData(d => ({ ...d, impactLevel: v }))}>
                          <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <InfoRow icon={Scale} label="Impact Level" value={<ImpactBadge level={request.impactLevel} />} />
                  )}
                  <InfoRow
                    icon={Scale}
                    label="Alternatives Evaluated"
                    value={
                      request.alternativesChecked
                        ? (request.alternativesText || "Yes")
                        : "No"
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Section 3: Technical & Financial */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Technical & Financial</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={Monitor} label="Compatibility" value={formatArray(request.compatibility)} />
                  <InfoRow icon={Monitor} label="Integration Requirements" value={request.compatibilityNotes || "Not provided"} />
                  <InfoRow icon={DollarSign} label="Cost Structure" value={formatLabel(request.costStructure)} />
                  {editing ? (
                    <div className="flex items-start gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Annual Cost</p>
                        <Input
                          type="number"
                          className="h-8 mt-1"
                          value={editData.annualCost || ""}
                          onChange={e => setEditData(d => ({ ...d, annualCost: e.target.value }))}
                        />
                      </div>
                    </div>
                  ) : (
                    <InfoRow
                      icon={DollarSign}
                      label="Annual Cost"
                      value={request.annualCost ? `$${Number(request.annualCost).toLocaleString()}/yr` : "Not provided"}
                    />
                  )}
                  <InfoRow icon={DollarSign} label="Cost Notes" value={(request as any).costNotes || "Not provided"} />
                  <InfoRow icon={UserIcon} label="Budget Owner" value={(request as any).budgetOwner || "Not provided"} />
                  <InfoRow icon={Building2} label="Cost Center" value={(request as any).costCenter || "Not provided"} />
                  <InfoRow icon={Target} label="Tier Assignment" value={formatLabel((request as any).tierAssignment, "Not assigned")} />
                </div>
              </div>

              <Separator />

              {/* Section 4: Security & Data Privacy */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Security & Data Privacy</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={Database} label="Data Categories" value={formatArray(request.dataInput)} />
                  {editing ? (
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Data Training</p>
                        <Select value={editData.dataTraining || ""} onValueChange={v => setEditData(d => ({ ...d, dataTraining: v }))}>
                          <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="unsure">Unsure</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <InfoRow icon={Shield} label="Data Training" value={formatLabel(request.dataTraining)} />
                  )}
                  {editing ? (
                    <EditField
                      icon={Key}
                      label="Login Method"
                      value={editData.loginMethod || ""}
                      onChange={v => setEditData(d => ({ ...d, loginMethod: v }))}
                    />
                  ) : (
                    <InfoRow icon={Key} label="Login Method" value={request.loginMethod || "Not provided"} />
                  )}
                  <InfoRow icon={CheckCircle2} label="Vendor Packet Acknowledged" value={formatBool((request as any).vendorPacketAcknowledged)} />
                  <InfoRow icon={Calendar} label="Submitted" value={formatDate(request.createdAt)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Questionnaire Responses */}
          {(request as any).vendorQuestionnaireCompleted && (request as any).vendorQuestionnaireData && (() => {
            const isSecurityReviewer = user && (user.reviewerRole === "security" || user.role === "admin");
            const existingReview = (request as any).vendorSecurityReview as Record<string, string> | null;
            const questions = getFilteredQuestions((request as any).division);
            const passCount = existingReview ? Object.values(existingReview).filter(v => v === "pass").length : 0;
            const totalReviewed = existingReview ? Object.keys(existingReview).length : 0;

            return (
              <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" /> Vendor Security Responses
                  </CardTitle>
                  <CardDescription>
                    Completed by the vendor via the secure questionnaire link
                    {existingReview && (
                      <span className="ml-2 font-medium text-green-700">— Security Assessment: {passCount}/{totalReviewed} passed</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {questions.map((q, i) => {
                    const answer = ((request as any).vendorQuestionnaireData as Record<string, string>)?.[q.id];
                    const reviewValue = existingReview?.[q.id] || securityAssessments[q.id] || "";

                    return (
                      <div key={q.id} className="border rounded-lg p-3 space-y-2 bg-white dark:bg-background">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold">{i + 1}. {q.title}</p>
                          {/* Inline pass/fail — security reviewer and admin only */}
                          {isSecurityReviewer && (
                            <div className="shrink-0">
                              {existingReview ? (
                                <span className={`text-xs font-semibold px-2 py-1 rounded ${reviewValue === "pass" ? "bg-green-100 text-green-700" : reviewValue === "fail" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                                  {reviewValue === "pass" ? "Pass" : reviewValue === "fail" ? "Fail" : "—"}
                                </span>
                              ) : (
                                <RadioGroup
                                  value={securityAssessments[q.id] || ""}
                                  onValueChange={v => setSecurityAssessments(prev => ({ ...prev, [q.id]: v }))}
                                  className="flex gap-2"
                                >
                                  <div className="flex items-center gap-1">
                                    <RadioGroupItem value="pass" id={`sa-pass-${q.id}`} />
                                    <label htmlFor={`sa-pass-${q.id}`} className="text-xs text-green-700 font-medium cursor-pointer">Pass</label>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <RadioGroupItem value="fail" id={`sa-fail-${q.id}`} />
                                    <label htmlFor={`sa-fail-${q.id}`} className="text-xs text-red-700 font-medium cursor-pointer">Fail</label>
                                  </div>
                                </RadioGroup>
                              )}
                            </div>
                          )}
                          {/* Show submitted badge for non-security users */}
                          {!isSecurityReviewer && existingReview && reviewValue && (
                            <span className={`text-xs font-semibold px-2 py-1 rounded shrink-0 ${reviewValue === "pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {reviewValue === "pass" ? "Pass" : "Fail"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{q.question}</p>
                        {answer ? (
                          <div className="rounded border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-2 text-sm whitespace-pre-wrap">{answer}</div>
                        ) : (
                          <p className="text-xs italic text-muted-foreground">No response provided</p>
                        )}
                      </div>
                    );
                  })}
                  {/* Submit button for security reviewer */}
                  {isSecurityReviewer && !existingReview && (
                    <Button
                      onClick={submitSecurityAssessment}
                      disabled={assessmentSubmitting || Object.keys(securityAssessments).length === 0}
                      className="w-full"
                    >
                      {assessmentSubmitting ? "Submitting..." : "Submit Security Assessment"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Vendor Link Pending */}
          {(request as any).vendorQuestionnaireToken && !(request as any).vendorQuestionnaireCompleted && (
            <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium">Vendor Security Questionnaire Pending</p>
                    <p className="text-xs text-muted-foreground">A questionnaire link has been sent to the vendor. Responses will appear here once submitted.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> Comments
              </CardTitle>
              <CardDescription>Discussion and notes about this request</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments && comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className="border rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{c.authorName}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                        </div>
                        {(c.authorId === user?.id || isAdmin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteCommentMutation.mutate(c.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}

              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  className="min-h-[60px]"
                />
                <Button
                  className="shrink-0"
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  onClick={() => addCommentMutation.mutate(commentText)}
                >
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Paperclip className="h-5 w-5" /> Attachments
              </CardTitle>
              <CardDescription>Upload supporting documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {attachments && attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map(a => (
                    <div key={a.id} className="flex items-center justify-between border rounded-md p-2 px-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{a.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(a.fileSize)} &middot; {a.uploaderName} &middot; {formatDate(a.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(`/api/attachments/${a.id}/download`, "_blank")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {(a.uploadedBy === user?.id || isAdmin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteAttachmentMutation.mutate(a.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              )}

              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-1" />
                {uploadMutation.isPending ? "Uploading..." : "Upload File"}
              </Button>
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
              workflowSteps={workflowSteps || []}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Review Status</CardTitle>
              <CardDescription>Approval workflow progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              {workflowSteps && workflowSteps.length > 0 ? (
                <>
                  {workflowSteps.map((step, i) => {
                    const stepReviews = activeReviews.filter(r => r.reviewerRole === step.reviewerRole);
                    const singleReview = stepReviews[0];
                    const subtitle = step.required
                      ? (step.minApprovals > 1 ? `${step.minApprovals} required` : "Required")
                      : "Advisory";

                    // Check if prior required steps are met for locking
                    const priorRequired = workflowSteps.filter(s => s.required && s.sortOrder < step.sortOrder);
                    const priorMet = priorRequired.every(prior => {
                      const priorPasses = activeReviews.filter(r => r.reviewerRole === prior.reviewerRole && r.decision === "pass");
                      return priorPasses.length >= prior.minApprovals;
                    });
                    const isLocked = !priorMet && request.status === "pending_reviews" && step.required;

                    return (
                      <div key={step.id}>
                        {i > 0 && <ProgressArrow status={workflowSteps[i - 1] ? activeReviews.find(r => r.reviewerRole === workflowSteps[i - 1].reviewerRole)?.decision : undefined} />}
                        {!step.required && (
                          <div className="mt-4 pt-3 border-t">
                            <p className="text-xs text-muted-foreground mb-2">Advisory</p>
                          </div>
                        )}
                        <ReviewStep
                          label={step.name}
                          subtitle={subtitle}
                          review={step.minApprovals <= 1 ? singleReview : undefined}
                          reviews={step.minApprovals > 1 ? stepReviews : undefined}
                          requireCount={step.minApprovals > 1 ? step.minApprovals : undefined}
                          locked={isLocked}
                          optional={!step.required}
                        />
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  <ReviewStep label="Security Review" subtitle="Required" review={securityReview} />
                  <ProgressArrow status={securityReview?.decision} />
                  <ReviewStep label="Tech/Financial Review" subtitle="Required" review={techReview} />
                  <ProgressArrow status={techReview?.decision} />
                  <ReviewStep label="Chair Sign-off" subtitle="Both required" reviews={chairReviews} requireCount={2} locked={!canChairApprove && request.status === "pending_reviews"} />
                </>
              )}
            </CardContent>
          </Card>

          {auditLogs && auditLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditLogs.map(log => {
                    const after = log.after as Record<string, any> | null;
                    const fmtRole = (r: string) => r.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                    let title = log.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                    let detail: string | null = null;

                    if (log.action === "routed_to_reviewer" && after) {
                      title = "Routed to Reviewer";
                      detail = `${fmtRole(after.requestedBy ?? "")} requested info from ${fmtRole(after.waitingOnRole ?? "")}`;
                    } else if (log.action === "waiting_on_requester" && after) {
                      title = "Waiting on Requester";
                      detail = `${fmtRole(after.requestedBy ?? "")} requested additional information from the requester`;
                    } else if (log.action === "review_needs_more_info" && after) {
                      const target = after.routedToRole === "requester" ? "Original Requester" : fmtRole(after.routedToRole ?? "requester");
                      detail = `${fmtRole(after.reviewerRole ?? "")} → ${target}: "${after.rationale}"`;
                    } else if (log.action === "review_pass" && after) {
                      detail = `${fmtRole(after.reviewerRole ?? "")} approved`;
                    } else if (log.action === "review_fail" && after) {
                      detail = `${fmtRole(after.reviewerRole ?? "")} rejected: "${after.rationale}"`;
                    } else if (log.action === "approved" && after) {
                      title = "Request Approved";
                      detail = `All required reviews complete — final sign-off by ${fmtRole(after.finalReviewerRole ?? "")}`;
                    } else if (log.action === "resubmitted") {
                      detail = "Returned to pending reviews";
                    } else if (log.action === "admin_override" && after) {
                      title = "Admin Override";
                      const target = after.targetReviewerRole ? fmtRole(after.targetReviewerRole) : "Review";
                      const from = after.from ? fmtRole(after.from) : "waiting";
                      detail = `Admin cleared ${from} → ${target} Review`;
                    } else if (log.action === "admin_edited" && after) {
                      title = "Admin Edited Request";
                      const fields = Object.keys(after).map(k => k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim());
                      detail = fields.length > 0 ? `Fields changed: ${fields.join(", ")}` : "No fields changed";
                    }

                    return (
                      <div key={log.id} className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium">{title}</p>
                          {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
                          <p className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function EditField({ icon: Icon, label, value, onChange }: { icon: any; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Input className="h-8 mt-1" value={value} onChange={e => onChange(e.target.value)} />
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

function ProgressArrow({ status }: { status?: string }) {
  const getColor = () => {
    switch (status) {
      case "pass":
        return "text-green-500 dark:text-green-400";
      case "fail":
        return "text-gray-700 dark:text-gray-400";
      case "needs_more_info":
        return "text-yellow-500 dark:text-yellow-400";
      default:
        return "text-muted-foreground/30";
    }
  };

  return (
    <div className="flex justify-center py-1">
      <ChevronDown className={`h-5 w-5 ${getColor()}`} />
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
