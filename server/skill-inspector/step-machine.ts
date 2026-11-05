import { SKILL_STEP_CATALOG, type StepState } from "@shared/skill-inspector-types";

const FIXED = new Set(["resolve_input", "build_context", "meta_analyzer", "report"]);
const ANALYZER_NODES = SKILL_STEP_CATALOG.map((s) => s.node).filter((n) => !FIXED.has(n));

// Ordered execution stages; analyzers run as one parallel stage.
const STAGES: string[][] = [
  ["resolve_input"],
  ["build_context"],
  ANALYZER_NODES,
  ["meta_analyzer"],
  ["report"],
];

export function initialSteps(): StepState[] {
  return SKILL_STEP_CATALOG.map((s) => ({ ...s, status: "pending" }));
}

export function deriveSteps(done: Set<string>, failed = false): StepState[] {
  // The active stage = first stage not fully complete.
  let activeIdx = STAGES.findIndex((stage) => !stage.every((n) => done.has(n)));
  if (activeIdx === -1) activeIdx = STAGES.length; // everything done

  const stageOf = (node: string) => STAGES.findIndex((stage) => stage.includes(node));

  return SKILL_STEP_CATALOG.map((step) => {
    const idx = stageOf(step.node);
    let status: StepState["status"];
    if (done.has(step.node) || idx < activeIdx) status = "done";
    else if (idx === activeIdx) status = failed ? "failed" : "running";
    else status = "pending";
    return { ...step, status };
  });
}

export function summarizeSteps(steps: StepState[]): {
  current: string | null;
  doneCount: number;
  totalCount: number;
} {
  const running = steps.find((s) => s.status === "running");
  return {
    current: running ? running.node : null,
    doneCount: steps.filter((s) => s.status === "done").length,
    totalCount: steps.length,
  };
}
