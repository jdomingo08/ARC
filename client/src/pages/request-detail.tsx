import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  const formatArray = (arr: string[] | null) =>
    arr?.map(s => s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())).join(", ") || "N/A";

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
  const canReview = user && (user.role === "reviewer" || user.role === "chair") && request.status === "pending_reviews";

  const securityReview = activeReviews.find(r => r.reviewerRole === "security");
  const techReview = activeReviews.find(r => r.reviewerRole === "technical_financial");
  const strategicReview = activeReviews.find(r => r.reviewerRole === "strategic");
  const chairReviews = activeReviews.filter(r => r.reviewerRole === "chair");
  const canChairApprove = securityReview?.decision === "pass" && techReview?.decision === "pass";

  const isAdmin = user?.role === "admin";
  const isOwner = user?.id === request.requesterId;
  const canEdit = !request.locked ? (isOwner || isAdmin) : isAdmin;

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
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <InfoRow icon={Target} label="Primary Goal" value={request.primaryGoal} />
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
                  <InfoRow icon={Users} label="Estimated Users" value={`${request.estimatedUsers}${request.estimatedUsersCount ? ` (${request.estimatedUsersCount})` : ""}`} />
                )}
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editing ? (
                  <EditField
                    icon={Workflow}
                    label="Workflow Integration"
                    value={editData.workflowIntegration || ""}
                    onChange={v => setEditData(d => ({ ...d, workflowIntegration: v }))}
                  />
                ) : (
                  <InfoRow icon={Workflow} label="Workflow Integration" value={request.workflowIntegration || "N/A"} />
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
                <InfoRow icon={Monitor} label="Compatibility" value={formatArray(request.compatibility)} />
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
                  <InfoRow icon={DollarSign} label="Cost" value={request.annualCost ? `$${Number(request.annualCost).toLocaleString()}/yr (${request.costStructure?.replace(/_/g, " ")})` : "N/A"} />
                )}
              </div>
              <Separator />
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
                  <InfoRow icon={Shield} label="Data Training" value={request.dataTraining || "N/A"} />
                )}
                {editing ? (
                  <EditField
                    icon={Key}
                    label="Login Method"
                    value={editData.loginMethod || ""}
                    onChange={v => setEditData(d => ({ ...d, loginMethod: v }))}
                  />
                ) : (
                  <InfoRow icon={Key} label="Login Method" value={request.loginMethod} />
                )}
                <InfoRow icon={Calendar} label="Submitted" value={formatDate(request.createdAt)} />
              </div>
              {request.alternativesChecked && !editing && (
                <>
                  <Separator />
                  <InfoRow icon={Scale} label="Alternatives Evaluated" value={request.alternativesText || "Yes"} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Vendor Questionnaire Responses */}
          {(request as any).vendorQuestionnaireCompleted && (request as any).vendorQuestionnaireData && (
            <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" /> Vendor Security Responses
                </CardTitle>
                <CardDescription>Completed by the vendor via the secure questionnaire link</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {getFilteredQuestions((request as any).division).map((q, i) => {
                  const answer = ((request as any).vendorQuestionnaireData as Record<string, string>)?.[q.id];
                  return (
                    <div key={q.id} className="space-y-1">
                      <p className="text-sm font-semibold">{i + 1}. {q.title}</p>
                      <p className="text-xs text-muted-foreground">{q.question}</p>
                      {answer ? (
                        <div className="bg-white dark:bg-background rounded border p-2 text-sm whitespace-pre-wrap">{answer}</div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">No response provided</p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Vendor Security Review Matrix — security reviewer and admin only */}
          {(request as any).vendorQuestionnaireCompleted && (request as any).vendorQuestionnaireData &&
           user && (user.reviewerRole === "security" || user.role === "admin") && (
            <Card className="border-indigo-200 bg-indigo-50/30 dark:bg-indigo-950/10 dark:border-indigo-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" /> Security Assessment
                </CardTitle>
                <CardDescription>
                  {(request as any).vendorSecurityReview
                    ? `Reviewed — ${Object.values((request as any).vendorSecurityReview as Record<string, string>).filter(v => v === "pass").length}/${Object.keys((request as any).vendorSecurityReview as Record<string, string>).length} questions passed`
                    : "Review each vendor response with a Pass or Fail"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {getFilteredQuestions((request as any).division).map((q, i) => {
                  const existingReview = (request as any).vendorSecurityReview as Record<string, string> | null;
                  const currentValue = existingReview?.[q.id] || securityAssessments[q.id] || "";
                  const isSubmitted = !!existingReview;
                  return (
                    <div key={q.id} className="flex items-center justify-between gap-3 p-2 border rounded">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{i + 1}. {q.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isSubmitted ? (
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${currentValue === "pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {currentValue === "pass" ? "Pass" : "Fail"}
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
                    </div>
                  );
                })}
                {!(request as any).vendorSecurityReview && (
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
          )}

          {/* Vendor Security Review Summary — visible to all non-security users */}
          {(request as any).vendorSecurityReview && user &&
           user.reviewerRole !== "security" && user.role !== "admin" && (
            <Card className="border-indigo-200 bg-indigo-50/30 dark:bg-indigo-950/10 dark:border-indigo-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-medium">Security Assessment Complete</p>
                    <p className="text-xs text-muted-foreground">
                      {Object.values((request as any).vendorSecurityReview as Record<string, string>).filter(v => v === "pass").length}/
                      {Object.keys((request as any).vendorSecurityReview as Record<string, string>).length} questions passed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
