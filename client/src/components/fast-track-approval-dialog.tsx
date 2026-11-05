import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import type { Request, ReviewDecision, User, WorkflowStep } from "@shared/schema";
import { DEFAULT_WORKFLOW_STEPS, FAST_TRACK_LABEL, type WorkflowStepLike } from "@shared/approval";

interface FastTrackApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: Request;
  workflowSteps: WorkflowStep[];
  activeReviews: ReviewDecision[];
  users: User[];
}

const formatRole = (role: string) => role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export function FastTrackApprovalDialog({
  open,
  onOpenChange,
  request,
  workflowSteps,
  activeReviews,
  users,
}: FastTrackApprovalDialogProps) {
  const { toast } = useToast();

  const steps: WorkflowStepLike[] = useMemo(() => {
    const source: readonly WorkflowStepLike[] = workflowSteps.length > 0 ? workflowSteps : DEFAULT_WORKFLOW_STEPS;
    return [...source].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [workflowSteps]);

  // People who already passed each stage through the normal workflow. These are
  // kept as-is by the server, so they're shown checked and locked.
  const existingPasses = useMemo(() => {
    const map: Record<string, ReviewDecision[]> = {};
    for (const r of activeReviews) {
      if (r.decision !== "pass") continue;
      (map[r.reviewerRole] ||= []).push(r);
    }
    return map;
  }, [activeReviews]);

  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [extras, setExtras] = useState<Record<string, string[]>>({});
  const [comments, setComments] = useState("");
  const [conditions, setConditions] = useState("");

  // Start from the current review state each time the dialog opens. Keyed on
  // `open` only: the parent rebuilds activeReviews every render, and re-running
  // on that would wipe the admin's selections mid-edit.
  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string[]> = {};
    for (const [role, decisions] of Object.entries(existingPasses)) {
      initial[role] = Array.from(new Set(decisions.map(d => d.reviewerId)));
    }
    setSelected(initial);
    setExtras({});
    setComments("");
    setConditions("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const candidatesFor = (role: string): User[] => {
    const ids = new Set<string>();
    for (const d of existingPasses[role] || []) ids.add(d.reviewerId);
    for (const u of users) {
      if (u.reviewerRole === role || (role === "chair" && u.role === "chair")) ids.add(u.id);
    }
    for (const id of extras[role] || []) ids.add(id);
    return Array.from(ids)
      .map(id => userById.get(id))
      .filter((u): u is User => !!u);
  };

  const isLocked = (role: string, userId: string) =>
    (existingPasses[role] || []).some(d => d.reviewerId === userId);

  const toggle = (role: string, userId: string, checked: boolean) => {
    setSelected(prev => {
      const current = new Set(prev[role] || []);
      if (checked) current.add(userId);
      else current.delete(userId);
      return { ...prev, [role]: Array.from(current) };
    });
  };

  const addPerson = (role: string, userId: string) => {
    setExtras(prev => ({ ...prev, [role]: Array.from(new Set([...(prev[role] || []), userId])) }));
    toggle(role, userId, true);
  };

  const requiredSteps = steps.filter(s => s.required);
  const fullySignedRequired = requiredSteps.filter(
    s => (selected[s.reviewerRole]?.length || 0) >= Math.max(1, s.minApprovals),
  ).length;
  const totalSignoffs = Object.values(selected).reduce((n, ids) => n + ids.length, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const signoffs = Object.entries(selected).flatMap(([reviewerRole, ids]) =>
        ids.map(reviewerId => ({ reviewerRole, reviewerId })),
      );
      const res = await apiRequest("POST", `/api/requests/${request.id}/fast-track-approve`, {
        signoffs,
        comments: comments.trim() || null,
        conditions: conditions.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Fast-Track Approved",
        description: `${request.toolName} is approved and marked Approved in the Platform Inventory.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Fast-Track failed", description: err.message, variant: "destructive" });
    },
  });

  const statusNote =
    request.status === "rejected"
      ? "This request was rejected. Fast-tracking overrides that decision."
      : request.status === "waiting_on_requester"
        ? "This request is waiting on the requester. Fast-tracking closes that out."
        : request.status === "waiting_on_reviewer"
          ? `This request is waiting on ${formatRole(request.waitingOnRole || "a reviewer")}. Fast-tracking closes that out.`
          : null;

  return (
    <Dialog open={open} onOpenChange={o => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-fast-track">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" /> {FAST_TRACK_LABEL}
          </DialogTitle>
          <DialogDescription>
            Record who signed off on each stage, then approve <span className="font-medium text-foreground">{request.toolName}</span>{" "}
            <span className="font-mono">({request.trackingId})</span> in one step. Any stage left open is overridden.
          </DialogDescription>
        </DialogHeader>

        {statusNote && (
          <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">{statusNote}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <Label className="text-sm font-semibold">Committee sign-offs</Label>
            <span className="text-xs text-muted-foreground">
              {fullySignedRequired} of {requiredSteps.length} required stages signed off
            </span>
          </div>

          {steps.map(step => {
            const role = step.reviewerRole;
            const candidates = candidatesFor(role);
            const chosen = selected[role] || [];
            const needed = step.required ? Math.max(1, step.minApprovals) : 1;
            const met = chosen.length >= needed;
            const others = users.filter(u => !candidates.some(c => c.id === u.id));
            const requirement = step.required
              ? step.minApprovals > 1 ? `${step.minApprovals} required` : "Required"
              : "Advisory";

            return (
              <div
                key={role}
                className={`rounded-md border p-3 ${met ? "border-green-300 bg-green-50/60 dark:bg-green-950/10 dark:border-green-800" : ""}`}
                data-testid={`fast-track-step-${role}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium truncate">{step.name}</p>
                    <Badge variant={step.required ? "secondary" : "outline"} className="text-[10px] shrink-0">{requirement}</Badge>
                  </div>
                  <span className={`text-xs font-medium flex items-center gap-1 shrink-0 ${met ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                    {met && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {chosen.length}/{needed}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {candidates.length === 0 && (
                    <p className="text-xs text-muted-foreground">No one has this reviewer role yet. Add someone below.</p>
                  )}
                  {candidates.map(u => {
                    const locked = isLocked(role, u.id);
                    const id = `ft-${role}-${u.id}`;
                    return (
                      <label
                        key={u.id}
                        htmlFor={id}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${locked ? "cursor-default" : "cursor-pointer hover:bg-muted/60"}`}
                      >
                        <Checkbox
                          id={id}
                          checked={chosen.includes(u.id)}
                          disabled={locked || mutation.isPending}
                          onCheckedChange={v => toggle(role, u.id, v === true)}
                        />
                        <span className="min-w-0 flex-1 truncate">{u.name}</span>
                        {locked && <span className="text-[10px] font-medium text-green-700 dark:text-green-400 shrink-0">Already approved</span>}
                      </label>
                    );
                  })}
                </div>

                {others.length > 0 && (
                  <Select value="" onValueChange={v => addPerson(role, v)} disabled={mutation.isPending}>
                    <SelectTrigger className="mt-2 h-8 text-xs w-full sm:w-64" data-testid={`select-add-signoff-${role}`}>
                      <SelectValue placeholder="Add someone else…" />
                    </SelectTrigger>
                    <SelectContent>
                      {others.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Stages you leave incomplete are recorded as bypassed by the fast-track. Existing decisions are never deleted.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ft-comments">Approval comments</Label>
          <Textarea
            id="ft-comments"
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="Why this was fast-tracked, context from the committee discussion…"
            maxLength={5000}
            disabled={mutation.isPending}
            data-testid="input-fast-track-comments"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ft-conditions">Conditions of approval</Label>
          <Textarea
            id="ft-conditions"
            value={conditions}
            onChange={e => setConditions(e.target.value)}
            placeholder='e.g., "SSO must be enabled before rollout. Re-review in 6 months."'
            maxLength={5000}
            disabled={mutation.isPending}
            data-testid="input-fast-track-conditions"
          />
        </div>

        <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Approving will:</p>
          <p>• Mark this request Approved and lock it</p>
          <p>• Mark {request.toolName} Approved in the Platform Inventory</p>
          <p>• Record {totalSignoffs > 0 ? `${totalSignoffs} sign-off${totalSignoffs === 1 ? "" : "s"}` : "the override"}, comments and conditions in the activity log and approval report</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-confirm-fast-track">
            <Zap className="h-4 w-4 mr-1" />
            {mutation.isPending ? "Approving…" : "Fast-Track Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
