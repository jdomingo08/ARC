import { describe, it, expect } from "vitest";
import type { Platform, Request, ReviewDecision } from "@shared/schema";
import type { FastTrackApprovalRecord, WorkflowStepLike } from "@shared/approval";
import {
  buildApprovalReport,
  fastTrackDecisionSummary,
  orderSignoffs,
  planFastTrack,
  resolveWorkflowSteps,
  splitConditions,
} from "../fast-track";

const STEPS: WorkflowStepLike[] = [
  { name: "Strategic Review", reviewerRole: "strategic", sortOrder: 4, required: false, minApprovals: 1 },
  { name: "Security Review", reviewerRole: "security", sortOrder: 1, required: true, minApprovals: 1 },
  { name: "Tech/Financial Review", reviewerRole: "technical_financial", sortOrder: 2, required: true, minApprovals: 1 },
  { name: "Chair Sign-off", reviewerRole: "chair", sortOrder: 3, required: true, minApprovals: 2 },
];

const USERS = [
  { id: "u-josh", name: "Josh Silva" },
  { id: "u-jorge", name: "Jorge Domingo" },
  { id: "u-kirun", name: "Kirun Amiri" },
  { id: "u-leaanna", name: "LeaAnna Hernandez" },
];

let seq = 0;
function review(partial: Partial<ReviewDecision> & Pick<ReviewDecision, "reviewerRole" | "reviewerId" | "decision">): ReviewDecision {
  seq += 1;
  return {
    id: `rd-${seq}`,
    requestId: "req-1",
    rationale: "ok",
    riskNotes: null,
    conditions: null,
    routedToRole: null,
    superseded: false,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, seq)),
    ...partial,
  };
}

function makeRequest(partial: Partial<Request> = {}): Request {
  return {
    id: "req-1",
    trackingId: "ARC-TEST01",
    requesterId: "u-requester",
    department: "Marketing",
    toolName: "DaVinci Resolve",
    status: "pending_reviews",
    locked: false,
    requesterName: "Sarah Requester",
    primaryGoal: "Video editing",
    estimatedUsers: "team",
    impactLevel: "medium",
    annualCost: "1200.00",
    costStructure: "per_seat",
    division: "media",
    tierAssignment: null,
    fastTrackApproval: null,
    createdAt: new Date("2026-10-01T12:00:00Z"),
    updatedAt: new Date("2026-10-02T12:00:00Z"),
    ...partial,
  } as Request;
}

describe("resolveWorkflowSteps", () => {
  it("sorts configured steps by sortOrder", () => {
    expect(resolveWorkflowSteps(STEPS).map(s => s.reviewerRole)).toEqual([
      "security", "technical_financial", "chair", "strategic",
    ]);
  });

  it("falls back to the default steps when none are configured", () => {
    const steps = resolveWorkflowSteps([]);
    expect(steps.map(s => s.reviewerRole)).toEqual(["security", "technical_financial", "chair", "strategic"]);
    expect(steps.find(s => s.reviewerRole === "chair")?.minApprovals).toBe(2);
  });
});

describe("planFastTrack", () => {
  it("creates a pass decision for each new sign-off and ignores duplicates", () => {
    const result = planFastTrack({
      signoffs: [
        { reviewerRole: "security", reviewerId: "u-josh" },
        { reviewerRole: "security", reviewerId: "u-josh" },
        { reviewerRole: "technical_financial", reviewerId: "u-jorge" },
      ],
      activeReviews: [],
      workflowSteps: STEPS,
      users: USERS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.create).toEqual([
      { reviewerRole: "security", stepName: "Security Review", reviewerId: "u-josh", reviewerName: "Josh Silva" },
      { reviewerRole: "technical_financial", stepName: "Tech/Financial Review", reviewerId: "u-jorge", reviewerName: "Jorge Domingo" },
    ]);
    expect(result.plan.existing).toEqual([]);
    expect(result.plan.supersedeIds).toEqual([]);
  });

  it("keeps people who already passed instead of recreating their decision", () => {
    const kirunPass = review({ reviewerRole: "chair", reviewerId: "u-kirun", decision: "pass" });
    const result = planFastTrack({
      signoffs: [
        { reviewerRole: "chair", reviewerId: "u-kirun" },
        { reviewerRole: "chair", reviewerId: "u-leaanna" },
      ],
      activeReviews: [kirunPass],
      workflowSteps: STEPS,
      users: USERS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.existing).toEqual([
      expect.objectContaining({ reviewerId: "u-kirun", decisionId: kirunPass.id, recordedViaFastTrack: false }),
    ]);
    expect(result.plan.create.map(c => c.reviewerId)).toEqual(["u-leaanna"]);
    // A pass from another chair must never be superseded (chair needs 2 passes).
    expect(result.plan.supersedeIds).toEqual([]);
  });

  it("supersedes open fail / needs-more-info only on stages being signed off", () => {
    const secInfo = review({ reviewerRole: "security", reviewerId: "u-josh", decision: "needs_more_info" });
    const techFail = review({ reviewerRole: "technical_financial", reviewerId: "u-jorge", decision: "fail" });
    const result = planFastTrack({
      signoffs: [{ reviewerRole: "security", reviewerId: "u-josh" }],
      activeReviews: [secInfo, techFail],
      workflowSteps: STEPS,
      users: USERS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.supersedeIds).toEqual([secInfo.id]);
    expect(result.plan.create.map(c => c.reviewerRole)).toEqual(["security"]);
  });

  it("allows an override with no sign-offs at all", () => {
    const result = planFastTrack({ signoffs: [], activeReviews: [], workflowSteps: STEPS, users: USERS });
    expect(result).toEqual({ ok: true, plan: { supersedeIds: [], create: [], existing: [] } });
  });

  it("rejects unknown stages and unknown reviewers", () => {
    expect(planFastTrack({
      signoffs: [{ reviewerRole: "legal", reviewerId: "u-josh" }],
      activeReviews: [], workflowSteps: STEPS, users: USERS,
    })).toEqual({ ok: false, error: 'Unknown review stage "legal"' });

    expect(planFastTrack({
      signoffs: [{ reviewerRole: "security", reviewerId: "u-ghost" }],
      activeReviews: [], workflowSteps: STEPS, users: USERS,
    })).toEqual({ ok: false, error: 'Unknown reviewer "u-ghost"' });
  });

  it("accepts built-in roles even when workflow steps are customised", () => {
    const result = planFastTrack({
      signoffs: [{ reviewerRole: "strategic", reviewerId: "u-leaanna" }],
      activeReviews: [],
      workflowSteps: STEPS.filter(s => s.reviewerRole !== "strategic"),
      users: USERS,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.create[0].stepName).toBe("Strategic");
  });
});

describe("orderSignoffs", () => {
  it("orders by workflow stage, then by name", () => {
    const base = { stepName: "", decisionId: "d", recordedViaFastTrack: true };
    const ordered = orderSignoffs([
      { ...base, reviewerRole: "strategic", reviewerId: "a", reviewerName: "LeaAnna" },
      { ...base, reviewerRole: "chair", reviewerId: "b", reviewerName: "Kirun" },
      { ...base, reviewerRole: "chair", reviewerId: "c", reviewerName: "Jeff" },
      { ...base, reviewerRole: "security", reviewerId: "d", reviewerName: "Josh" },
    ], STEPS);
    expect(ordered.map(s => s.reviewerName)).toEqual(["Josh", "Jeff", "Kirun", "LeaAnna"]);
  });
});

describe("splitConditions", () => {
  it("returns one condition per non-empty line, without typed bullets", () => {
    expect(splitConditions("- SSO only\r\n\n  2) Re-review in 6 months  \n• No client data\n1. Keep audit logs")).toEqual([
      "SSO only",
      "Re-review in 6 months",
      "No client data",
      "Keep audit logs",
    ]);
  });

  it("keeps hyphenated text that is not a bullet", () => {
    expect(splitConditions("Re-review quarterly")).toEqual(["Re-review quarterly"]);
  });

  it("handles empty input", () => {
    expect(splitConditions(null)).toEqual([]);
    expect(splitConditions("  \n ")).toEqual([]);
  });
});

describe("fastTrackDecisionSummary", () => {
  it("includes the approver, comments, and conditions", () => {
    expect(fastTrackDecisionSummary({
      approvedByName: "Jorge Domingo",
      comments: "Urgent for Q4 launch.",
      conditions: ["SSO required", "Annual review"],
    })).toBe(
      "Approved via Fast-Track Approval by Jorge Domingo. Comments: Urgent for Q4 launch. Conditions: SSO required; Annual review",
    );
  });

  it("omits empty sections", () => {
    expect(fastTrackDecisionSummary({ approvedByName: "Jorge Domingo", comments: null, conditions: [] }))
      .toBe("Approved via Fast-Track Approval by Jorge Domingo.");
  });
});

describe("buildApprovalReport", () => {
  const platform = {
    id: "plat-1",
    toolName: "DaVinci Resolve",
    logoUrl: "https://example.com/logo.png",
    status: "approved",
    tierId: "tier-1",
    approvalDate: new Date("2026-11-01T10:00:00Z"),
  } as Platform;

  it("describes a fast-track approval stage by stage", () => {
    const secPass = review({ reviewerRole: "security", reviewerId: "u-josh", decision: "pass", rationale: "Sign-off recorded via Fast-Track Approval by Jorge Domingo." });
    const chairPass = review({ reviewerRole: "chair", reviewerId: "u-kirun", decision: "pass", conditions: "Annual usage review" });
    const oldFail = review({ reviewerRole: "security", reviewerId: "u-josh", decision: "fail", superseded: true });
    const record: FastTrackApprovalRecord = {
      approvedById: "u-jorge",
      approvedByName: "Jorge Domingo",
      approvedAt: "2026-11-04T15:00:00.000Z",
      previousStatus: "pending_reviews",
      comments: "Needed for the holiday campaign.",
      conditions: "SSO must be enabled",
      signoffs: [
        { reviewerRole: "security", stepName: "Security Review", reviewerId: "u-josh", reviewerName: "Josh Silva", decisionId: secPass.id, recordedViaFastTrack: true },
        { reviewerRole: "chair", stepName: "Chair Sign-off", reviewerId: "u-kirun", reviewerName: "Kirun Amiri", decisionId: chairPass.id, recordedViaFastTrack: false },
      ],
    };

    const report = buildApprovalReport({
      request: makeRequest({ status: "approved", fastTrackApproval: record }),
      platform,
      tierName: "Tier 1 - Approved",
      reviews: [secPass, chairPass, oldFail],
      users: USERS,
      workflowSteps: STEPS,
      approvedLog: null,
      now: new Date("2026-11-04T16:00:00Z"),
    });

    expect(report.approved).toBe(true);
    expect(report.method).toBe("fast_track");
    expect(report.request.trackingId).toBe("ARC-TEST01");
    expect(report.request.toolName).toBe("DaVinci Resolve");
    expect(report.platform).toEqual(expect.objectContaining({ tierName: "Tier 1 - Approved", logoUrl: "https://example.com/logo.png" }));
    expect(report.approval).toEqual({
      approvedAt: "2026-11-04T15:00:00.000Z",
      approvedByName: "Jorge Domingo",
      comments: "Needed for the holiday campaign.",
      conditions: [
        { source: "Fast-Track Approval", text: "SSO must be enabled" },
        { source: "Chair Sign-off · Kirun Amiri", text: "Annual usage review" },
      ],
    });

    const byRole = Object.fromEntries(report.steps.map(s => [s.reviewerRole, s]));
    expect(report.steps.map(s => s.reviewerRole)).toEqual(["security", "technical_financial", "chair", "strategic"]);
    expect(byRole.security.outcome).toBe("signed_off");
    expect(byRole.security.entries).toHaveLength(1); // superseded fail is hidden
    expect(byRole.security.entries[0]).toEqual(expect.objectContaining({ reviewerName: "Josh Silva", recordedViaFastTrack: true }));
    expect(byRole.technical_financial.outcome).toBe("bypassed");
    expect(byRole.chair.outcome).toBe("partial"); // 1 of 2
    expect(byRole.chair.entries[0].recordedViaFastTrack).toBe(false);
    expect(byRole.strategic.outcome).toBe("not_reviewed");
    expect(report.generatedAt).toBe("2026-11-04T16:00:00.000Z");
  });

  it("uses the audit log for a normal workflow approval", () => {
    const report = buildApprovalReport({
      request: makeRequest({ status: "approved" }),
      platform,
      tierName: null,
      reviews: [
        review({ reviewerRole: "security", reviewerId: "u-josh", decision: "pass" }),
        review({ reviewerRole: "technical_financial", reviewerId: "u-jorge", decision: "pass", conditions: "Annual usage review" }),
        review({ reviewerRole: "chair", reviewerId: "u-kirun", decision: "pass", conditions: "annual usage review" }),
        review({ reviewerRole: "chair", reviewerId: "u-leaanna", decision: "pass" }),
      ],
      users: USERS,
      workflowSteps: STEPS,
      approvedLog: { timestamp: new Date("2026-10-20T09:30:00Z"), actorId: "u-leaanna" },
    });
    expect(report.method).toBe("workflow");
    expect(report.approval.approvedAt).toBe("2026-10-20T09:30:00.000Z");
    expect(report.approval.approvedByName).toBe("LeaAnna Hernandez");
    expect(report.approval.comments).toBeNull();
    // Duplicate conditions (case-insensitive) are listed once.
    expect(report.approval.conditions).toEqual([
      { source: "Tech/Financial Review · Jorge Domingo", text: "Annual usage review" },
    ]);
    expect(report.steps.filter(s => s.required).every(s => s.outcome === "signed_off")).toBe(true);
  });

  it("lists each line of the fast-track conditions as its own condition", () => {
    const record: FastTrackApprovalRecord = {
      approvedById: "u-jorge",
      approvedByName: "Jorge Domingo",
      approvedAt: "2026-11-04T15:00:00.000Z",
      previousStatus: "pending_reviews",
      comments: null,
      conditions: "SSO only\n- Re-review in 6 months",
      signoffs: [],
    };
    const report = buildApprovalReport({
      request: makeRequest({ status: "approved", fastTrackApproval: record }),
      platform: null,
      tierName: null,
      reviews: [],
      users: USERS,
      workflowSteps: STEPS,
      approvedLog: null,
    });
    expect(report.approval.conditions).toEqual([
      { source: "Fast-Track Approval", text: "SSO only" },
      { source: "Fast-Track Approval", text: "Re-review in 6 months" },
    ]);
    // Required stages with no sign-offs read as bypassed on a fast-track.
    expect(report.steps.filter(s => s.required).every(s => s.outcome === "bypassed")).toBe(true);
  });

  it("reports an unapproved request without approval details", () => {
    const report = buildApprovalReport({
      request: makeRequest(),
      platform: null,
      tierName: null,
      reviews: [review({ reviewerRole: "legal", reviewerId: "u-josh", decision: "pass" })],
      users: USERS,
      workflowSteps: STEPS,
      approvedLog: null,
    });
    expect(report.approved).toBe(false);
    expect(report.method).toBeNull();
    expect(report.platform).toBeNull();
    expect(report.approval.approvedAt).toBeNull();
    expect(report.steps.find(s => s.reviewerRole === "security")?.outcome).toBe("pending");
    // Decisions for a stage that is no longer configured still appear, as advisory.
    expect(report.steps.at(-1)).toEqual(expect.objectContaining({ reviewerRole: "legal", name: "Legal", required: false, outcome: "signed_off" }));
  });
});
