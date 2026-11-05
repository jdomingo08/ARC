import { reviewerRoleEnum } from "@shared/schema";
import type { Platform, Request, ReviewDecision, User } from "@shared/schema";
import {
  DEFAULT_WORKFLOW_STEPS,
  FAST_TRACK_LABEL,
  type ApprovalReport,
  type ApprovalReportCondition,
  type ApprovalReportStep,
  type ApprovalReportStepOutcome,
  type FastTrackSignoffRecord,
  type WorkflowStepLike,
} from "@shared/approval";

type ReviewLike = Pick<ReviewDecision, "id" | "reviewerRole" | "reviewerId" | "decision">;
type UserLike = Pick<User, "id" | "name">;

export function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Configured workflow steps in order, or the defaults when none are configured. */
export function resolveWorkflowSteps(steps: readonly WorkflowStepLike[]): WorkflowStepLike[] {
  const source: readonly WorkflowStepLike[] = steps.length > 0 ? steps : DEFAULT_WORKFLOW_STEPS;
  return [...source].sort((a, b) => a.sortOrder - b.sortOrder);
}

export interface FastTrackPlannedSignoff {
  reviewerRole: string;
  stepName: string;
  reviewerId: string;
  reviewerName: string;
}

export interface FastTrackPlan {
  /** Active fail / needs-more-info decisions on stages that are now being signed off. */
  supersedeIds: string[];
  /** New "pass" decisions to insert. */
  create: FastTrackPlannedSignoff[];
  /** Selected people who had already passed through the normal workflow (left untouched). */
  existing: FastTrackSignoffRecord[];
}

export type FastTrackPlanResult = { ok: true; plan: FastTrackPlan } | { ok: false; error: string };

/**
 * Work out which review decisions a fast-track approval should write.
 *
 * Real decisions are never removed: a person who already passed keeps their
 * original decision, and stages the admin leaves blank keep whatever is there.
 * Only open fail / needs-more-info decisions on a stage the admin is signing
 * off are superseded, so the stage reads as passed.
 */
export function planFastTrack(params: {
  signoffs: { reviewerRole: string; reviewerId: string }[];
  activeReviews: ReviewLike[];
  workflowSteps: readonly WorkflowStepLike[];
  users: UserLike[];
}): FastTrackPlanResult {
  const steps = resolveWorkflowSteps(params.workflowSteps);
  const validRoles = new Set<string>([...steps.map((s) => s.reviewerRole), ...reviewerRoleEnum.options]);
  const usersById = new Map(params.users.map((u) => [u.id, u]));
  const stepName = (role: string) => steps.find((s) => s.reviewerRole === role)?.name ?? formatRole(role);

  const seen = new Set<string>();
  const create: FastTrackPlannedSignoff[] = [];
  const existing: FastTrackSignoffRecord[] = [];
  const rolesSignedOff = new Set<string>();

  for (const s of params.signoffs) {
    if (!validRoles.has(s.reviewerRole)) {
      return { ok: false, error: `Unknown review stage "${s.reviewerRole}"` };
    }
    const reviewer = usersById.get(s.reviewerId);
    if (!reviewer) {
      return { ok: false, error: `Unknown reviewer "${s.reviewerId}"` };
    }
    const key = `${s.reviewerRole}:${s.reviewerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rolesSignedOff.add(s.reviewerRole);

    const alreadyPassed = params.activeReviews.find(
      (r) => r.reviewerRole === s.reviewerRole && r.reviewerId === s.reviewerId && r.decision === "pass",
    );
    if (alreadyPassed) {
      existing.push({
        reviewerRole: s.reviewerRole,
        stepName: stepName(s.reviewerRole),
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        decisionId: alreadyPassed.id,
        recordedViaFastTrack: false,
      });
    } else {
      create.push({
        reviewerRole: s.reviewerRole,
        stepName: stepName(s.reviewerRole),
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
      });
    }
  }

  const supersedeIds = params.activeReviews
    .filter((r) => rolesSignedOff.has(r.reviewerRole) && r.decision !== "pass")
    .map((r) => r.id);

  return { ok: true, plan: { supersedeIds, create, existing } };
}

/** Sort sign-off records into workflow order so the record reads top to bottom. */
export function orderSignoffs(
  signoffs: FastTrackSignoffRecord[],
  workflowSteps: readonly WorkflowStepLike[],
): FastTrackSignoffRecord[] {
  const order = new Map(resolveWorkflowSteps(workflowSteps).map((s, i) => [s.reviewerRole, i]));
  const rank = (role: string) => order.get(role) ?? Number.MAX_SAFE_INTEGER;
  return [...signoffs].sort(
    (a, b) => rank(a.reviewerRole) - rank(b.reviewerRole) || a.reviewerName.localeCompare(b.reviewerName),
  );
}

/**
 * Split a free-text conditions field into individual conditions: one per
 * non-empty line, with any typed bullet or numbering ("-", "•", "1.") removed.
 */
export function splitConditions(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

/** Platform decision summary shown in the inventory after a fast-track approval. */
export function fastTrackDecisionSummary(params: {
  approvedByName: string;
  comments: string | null;
  conditions: string[];
}): string {
  const parts = [`Approved via ${FAST_TRACK_LABEL} by ${params.approvedByName}.`];
  if (params.comments) parts.push(`Comments: ${params.comments}`);
  if (params.conditions.length > 0) parts.push(`Conditions: ${params.conditions.join("; ")}`);
  return parts.join(" ");
}

const toIso = (d: Date | string | null | undefined): string | null =>
  d == null ? null : new Date(d).toISOString();

/** Assemble everything the approval report page needs in one payload. */
export function buildApprovalReport(params: {
  request: Request;
  platform: Platform | null;
  tierName: string | null;
  reviews: ReviewDecision[];
  users: UserLike[];
  workflowSteps: readonly WorkflowStepLike[];
  /** Most recent "approved" audit log entry, for workflow approvals. */
  approvedLog: { timestamp: Date; actorId: string | null } | null;
  now?: Date;
}): ApprovalReport {
  const { request, platform } = params;
  const active = params.reviews
    .filter((r) => !r.superseded)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const usersById = new Map(params.users.map((u) => [u.id, u]));
  const nameOf = (id: string | null | undefined) => (id && usersById.get(id)?.name) || "Unknown reviewer";

  const ft = request.fastTrackApproval ?? null;
  const approved = request.status === "approved";
  const method: ApprovalReport["method"] = !approved ? null : ft ? "fast_track" : "workflow";
  const fastTrackDecisionIds = new Set(
    (ft?.signoffs ?? []).filter((s) => s.recordedViaFastTrack).map((s) => s.decisionId),
  );

  // Configured stages, plus any role that has decisions but is no longer configured.
  const steps = resolveWorkflowSteps(params.workflowSteps);
  for (const r of active) {
    if (!steps.some((s) => s.reviewerRole === r.reviewerRole)) {
      steps.push({
        name: formatRole(r.reviewerRole),
        reviewerRole: r.reviewerRole,
        sortOrder: Number.MAX_SAFE_INTEGER,
        required: false,
        minApprovals: 1,
      });
    }
  }

  const reportSteps: ApprovalReportStep[] = steps.map((step) => {
    const entries = active
      .filter((r) => r.reviewerRole === step.reviewerRole)
      .map((r) => ({
        reviewerName: nameOf(r.reviewerId),
        decision: r.decision,
        decidedAt: new Date(r.createdAt).toISOString(),
        rationale: r.rationale || null,
        conditions: r.conditions || null,
        recordedViaFastTrack: fastTrackDecisionIds.has(r.id),
      }));
    const passes = entries.filter((e) => e.decision === "pass").length;
    const needed = step.required ? Math.max(1, step.minApprovals) : 1;

    let outcome: ApprovalReportStepOutcome;
    if (passes >= needed) outcome = "signed_off";
    else if (passes > 0) outcome = "partial";
    else if (!step.required) outcome = "not_reviewed";
    else outcome = method === "fast_track" ? "bypassed" : "pending";

    return {
      reviewerRole: step.reviewerRole,
      name: step.name,
      required: step.required,
      minApprovals: step.minApprovals,
      outcome,
      entries,
    };
  });

  const conditions: ApprovalReportCondition[] = [];
  const seenConditions = new Set<string>();
  const addCondition = (source: string, text: string | null | undefined) => {
    for (const item of splitConditions(text)) {
      if (seenConditions.has(item.toLowerCase())) continue;
      seenConditions.add(item.toLowerCase());
      conditions.push({ source, text: item });
    }
  };
  if (ft) addCondition(FAST_TRACK_LABEL, ft.conditions);
  for (const step of reportSteps) {
    for (const e of step.entries) {
      if (e.decision === "pass") addCondition(`${step.name} · ${e.reviewerName}`, e.conditions);
    }
  }

  let approvedAt: string | null = null;
  let approvedByName: string | null = null;
  if (method === "fast_track" && ft) {
    approvedAt = ft.approvedAt;
    approvedByName = ft.approvedByName;
  } else if (method === "workflow") {
    approvedAt =
      toIso(params.approvedLog?.timestamp) ?? toIso(platform?.approvalDate) ?? toIso(request.updatedAt);
    approvedByName = params.approvedLog?.actorId ? nameOf(params.approvedLog.actorId) : null;
  }

  return {
    approved,
    method,
    request: {
      id: request.id,
      trackingId: request.trackingId,
      toolName: request.toolName,
      status: request.status,
      requesterName: request.requesterName,
      department: request.department,
      division: request.division ?? null,
      primaryGoal: request.primaryGoal ?? null,
      impactLevel: request.impactLevel ?? null,
      annualCost: request.annualCost ?? null,
      costStructure: request.costStructure ?? null,
      submittedAt: new Date(request.createdAt).toISOString(),
    },
    platform: platform
      ? {
          id: platform.id,
          toolName: platform.toolName,
          logoUrl: platform.logoUrl ?? null,
          status: platform.status,
          tierName: params.tierName,
        }
      : null,
    approval: {
      approvedAt,
      approvedByName,
      comments: method === "fast_track" ? ft?.comments ?? null : null,
      conditions,
    },
    steps: reportSteps,
    generatedAt: (params.now ?? new Date()).toISOString(),
  };
}
