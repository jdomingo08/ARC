import { useState } from "react";
import { CheckCircle2, Circle, Loader2, XCircle, ChevronRight, ChevronDown } from "lucide-react";
import type { StepState, ScanPhase } from "@shared/skill-inspector-types";

const GROUPS: { key: string; title: string; phases: ScanPhase[] }[] = [
  { key: "fetch", title: "Fetch", phases: ["fetch"] },
  { key: "analyze", title: "Static & behavioral analysis", phases: ["static", "behavioral", "mcp"] },
  { key: "ai", title: "AI analysis", phases: ["ai"] },
  { key: "finalize", title: "Finalize", phases: ["finalize"] },
];

function StepIcon({ status }: { status: StepState["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-600" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

function fmt(sec?: number) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ScanProgress({ steps, elapsedSec }: { steps: StepState[]; elapsedSec?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="scan-progress">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Scan progress</span>
        {elapsedSec != null && <span className="text-muted-foreground tabular-nums">{fmt(elapsedSec)}</span>}
      </div>
      {GROUPS.map((g) => {
        const groupSteps = steps.filter((s) => g.phases.includes(s.phase));
        if (groupSteps.length === 0) return null;
        const doneN = groupSteps.filter((s) => s.status === "done").length;
        const failed = groupSteps.some((s) => s.status === "failed");
        const running = groupSteps.some((s) => s.status === "running");
        const groupStatus: StepState["status"] = failed ? "failed" : doneN === groupSteps.length ? "done" : running ? "running" : "pending";
        const expandable = groupSteps.length > 1;
        const isOpen = open[g.key];
        return (
          <div key={g.key} className="rounded-md border">
            <button
              type="button"
              className="w-full flex items-center gap-2 p-2 text-left hover-elevate"
              onClick={() => expandable && setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
              data-testid={`group-${g.key}`}
            >
              <StepIcon status={groupStatus} />
              <span className="flex-1">{g.title}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{doneN}/{groupSteps.length}</span>
              {expandable && (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
            </button>
            {expandable && isOpen && (
              <div className="border-t px-3 py-2 space-y-1">
                {groupSteps.map((s) => (
                  <div key={s.node} className="flex items-center gap-2 text-sm" data-testid={`step-${s.node}`}>
                    <StepIcon status={s.status} />
                    <span className={s.status === "pending" ? "text-muted-foreground" : ""}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
