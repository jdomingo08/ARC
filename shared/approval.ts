import { z } from "zod";

/**
 * Fast-Track Approval
 *
 * Lets an admin record which committee members signed off on each review
 * stage, then approve the request in one step (overriding whatever stages are
 * still open). The request is marked approved, its platform is marked approved
 * in the inventory, and the details are kept on `requests.fast_track_approval`
 * so they can be shown in the approval report.
 */

export const FAST_TRACK_LABEL = "Fast-Track Approval";

// Fallback when no workflow steps are configured. Mirrors the seeded defaults
// in server/storage.ts and the fallback rendering in request-detail.tsx.
export const DEFAULT_WORKFLOW_STEPS = [
  { name: "Security Review", reviewerRole: "security", sortOrder: 1, required: true, minApprovals: 1 },
  { name: "Tech/Financial Review", reviewerRole: "technical_financial", sortOrder: 2, required: true, minApprovals: 1 },
  { name: "Chair Sign-off", reviewerRole: "chair", sortOrder: 3, required: true, minApprovals: 2 },
  { name: "Strategic Review", reviewerRole: "strategic", sortOrder: 4, required: false, minApprovals: 1 },
] as const;

export type WorkflowStepLike = {
  name: string;
  reviewerRole: string;
  sortOrder: number;
  required: boolean;
  minApprovals: number;
};

export const fastTrackSignoffInputSchema = z.object({
  reviewerRole: z.string().trim().min(1).max(64),
  reviewerId: z.string().trim().min(1).max(36),
});

export const fastTrackApprovalInputSchema = z.object({
  signoffs: z.array(fastTrackSignoffInputSchema).max(100).default([]),
  comments: z.string().trim().max(5000).nullish(),
  conditions: z.string().trim().max(5000).nullish(),
});
export type FastTrackApprovalInput = z.infer<typeof fastTrackApprovalInputSchema>;

export interface FastTrackSignoffRecord {
  reviewerRole: string;
  stepName: string;
  reviewerId: string;
  reviewerName: string;
  /** The review decision that represents this sign-off. */
  decisionId: string;
  /** false when the person had already passed through the normal workflow. */
  recordedViaFastTrack: boolean;
}

/** Stored as JSON on requests.fast_track_approval. */
export interface FastTrackApprovalRecord {
  approvedById: string;
  approvedByName: string;
  approvedAt: string; // ISO timestamp
  previousStatus: string;
  comments: string | null;
  conditions: string | null;
  signoffs: FastTrackSignoffRecord[];
}

// ─── Approval report (served by GET /api/requests/:id/approval-report) ───────

export type ApprovalReportStepOutcome =
  | "signed_off"     // enough passes to satisfy the stage
  | "partial"        // some passes, fewer than required
  | "bypassed"       // required stage with no passes, approved via fast-track
  | "pending"        // required stage with no passes, not (yet) approved
  | "not_reviewed";  // advisory stage nobody reviewed

export interface ApprovalReportEntry {
  reviewerName: string;
  decision: string; // pass | fail | needs_more_info
  decidedAt: string;
  rationale: string | null;
  conditions: string | null;
  recordedViaFastTrack: boolean;
}

export interface ApprovalReportStep {
  reviewerRole: string;
  name: string;
  required: boolean;
  minApprovals: number;
  outcome: ApprovalReportStepOutcome;
  entries: ApprovalReportEntry[];
}

export interface ApprovalReportCondition {
  source: string;
  text: string;
}

export interface ApprovalReport {
  approved: boolean;
  method: "fast_track" | "workflow" | null;
  request: {
    id: string;
    trackingId: string;
    toolName: string;
    status: string;
    requesterName: string;
    department: string;
    division: string | null;
    primaryGoal: string | null;
    impactLevel: string | null;
    annualCost: string | null;
    costStructure: string | null;
    submittedAt: string;
  };
  platform: {
    id: string;
    toolName: string;
    logoUrl: string | null;
    status: string;
    tierName: string | null;
  } | null;
  approval: {
    approvedAt: string | null;
    approvedByName: string | null;
    comments: string | null;
    conditions: ApprovalReportCondition[];
  };
  steps: ApprovalReportStep[];
  generatedAt: string;
}
