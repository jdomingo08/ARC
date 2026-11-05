import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, Clock, MinusCircle, Printer, ShieldCheck, XCircle, Zap } from "lucide-react";
import type { ApprovalReport, ApprovalReportEntry, ApprovalReportStep } from "@shared/approval";

// Printable approval certificate for an approved request. Rendered outside the
// app shell (see App.tsx) so it prints as a clean letter-size page.

const SERIF = "'Playfair Display', 'Libre Baskerville', Georgia, serif";
const MONO = "'IBM Plex Mono', 'JetBrains Mono', Menlo, monospace";
const STAMP_INK = "#13724a";

const PRINT_CSS = `
@page { size: letter; margin: 0.35in; }
@media print {
  html, body { background: #fff !important; }
  .no-print { display: none !important; }
  [role="region"][aria-label^="Notifications"] { display: none !important; }
  .report-canvas { padding: 0 !important; background: #fff !important; }
  /* Scale the sheet so a typical report fits on one letter page. */
  .report-sheet { box-shadow: none !important; max-width: none !important; width: 100% !important; zoom: 0.78; }
  .report-sheet, .report-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .avoid-break { break-inside: avoid; }
}
`;

const titleCase = (s: string | null | undefined, fallback = "N/A") =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : fallback;

const longDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "N/A";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const stampDate = (iso: string | null) =>
  iso
    ? new Date(iso)
        .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
        .replace(",", "")
        .toUpperCase()
    : "";

const formatCost = (cost: string | null, structure: string | null) => {
  if (!cost || Number(cost) === 0) return "No cost";
  const amount = `$${Number(cost).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr`;
  return structure ? `${amount} · ${titleCase(structure)}` : amount;
};

export default function ApprovalReportPage() {
  const [, params] = useRoute("/requests/:id/approval-report");
  const id = params?.id;

  const { data: report, isLoading, error } = useQuery<ApprovalReport>({
    queryKey: ["/api/requests", id, "approval-report"],
    enabled: !!id,
    staleTime: 0,
  });

  // A meaningful title doubles as the default file name in "Save as PDF".
  useEffect(() => {
    if (!report) return;
    const previous = document.title;
    document.title = `${report.request.trackingId} ${report.request.toolName} - Approval Report`;
    return () => {
      document.title = previous;
    };
  }, [report]);

  return (
    <div className="report-canvas min-h-screen bg-stone-200/70 dark:bg-neutral-900 pb-10">
      <style>{PRINT_CSS}</style>

      <div className="no-print sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[8.5in] items-center justify-between gap-2 px-4 py-2">
          <Link href={id ? `/requests/${id}` : "/requests"}>
            <Button variant="ghost" size="sm" data-testid="button-report-back">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to request
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-muted-foreground">Choose "Save as PDF" in the print dialog</span>
            <Button size="sm" onClick={() => window.print()} disabled={!report?.approved} data-testid="button-print-report">
              <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      <main className="px-4 pt-8 print:px-0 print:pt-0">
        {isLoading ? (
          <div className="mx-auto max-w-[8.5in] space-y-4 rounded bg-white p-10 shadow-xl">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-14 w-3/4" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error || !report ? (
          <Notice title="Report unavailable" body={(error as Error | null)?.message?.replace(/^\d+:\s*/, "") || "This request could not be loaded."} />
        ) : !report.approved ? (
          <Notice
            title="Not approved yet"
            body={`${report.request.toolName} (${report.request.trackingId}) is currently "${titleCase(report.request.status)}". The approval report is available once the request is approved.`}
          />
        ) : (
          <ReportSheet report={report} />
        )}
      </main>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-[8.5in] rounded bg-white p-10 text-center text-stone-800 shadow-xl">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm text-stone-600">{body}</p>
    </div>
  );
}

function ReportSheet({ report }: { report: ApprovalReport }) {
  const { request, platform, approval, steps, method } = report;
  const fastTracked = method === "fast_track";
  const showComments = fastTracked || !!approval.comments;

  const facts: { label: string; value: string }[] = [
    { label: "Requester", value: request.requesterName },
    { label: "Department", value: request.department || "N/A" },
    { label: "Division", value: titleCase(request.division) },
    { label: "Tier", value: platform?.tierName || "Unassigned" },
    { label: "Annual cost", value: formatCost(request.annualCost, request.costStructure) },
    { label: "Impact", value: titleCase(request.impactLevel) },
    { label: "Approved on", value: longDate(approval.approvedAt) },
    {
      label: fastTracked ? "Approved by" : "Final sign-off",
      value: approval.approvedByName || "AI Review Committee",
    },
  ];

  return (
    <article
      className="report-sheet mx-auto w-full max-w-[8.5in] overflow-hidden bg-white text-stone-900 shadow-xl"
      data-testid="approval-report-sheet"
    >
      <div className="h-2 bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600" />

      <div className="relative m-3 border border-stone-300 px-5 py-7 sm:m-4 sm:px-10 sm:py-9">
        <div className="pointer-events-none absolute inset-1.5 border border-stone-200" />

        <header className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-800 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide">ARC Intelligence</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">AI Review Committee</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Approval record</p>
            <p className="text-sm font-semibold" style={{ fontFamily: MONO }}>{request.trackingId}</p>
          </div>
        </header>

        <div className="relative my-6 h-px bg-stone-200 print:my-4" />

        <section className="relative grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-800">
              Certificate of Approval
            </p>
            <div className="mt-3 flex items-center gap-3">
              <ToolLogo url={platform?.logoUrl ?? null} name={request.toolName} />
              <h1
                className="min-w-0 break-words text-4xl font-bold leading-[1.1] text-stone-900 sm:text-5xl"
                style={{ fontFamily: SERIF }}
                data-testid="text-report-tool"
              >
                {request.toolName}
              </h1>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-300 bg-stone-50 px-3 py-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-stone-500">ARC ID</span>
              <span className="text-sm font-semibold" style={{ fontFamily: MONO }} data-testid="text-report-arc-id">
                {request.trackingId}
              </span>
            </div>
            {fastTracked && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                <Zap className="h-3 w-3" /> Fast-Track
              </span>
            )}
          </div>
          <div className="justify-self-center sm:justify-self-end">
            <ApprovalStamp fastTrack={fastTracked} dateLabel={stampDate(approval.approvedAt)} trackingId={request.trackingId} />
          </div>
        </section>

        <p className="relative mt-6 text-[15px] leading-relaxed text-stone-700">
          This certifies that <strong className="text-stone-900">{request.toolName}</strong>, requested by{" "}
          {request.requesterName} for {request.department || "the organization"}, has been reviewed and{" "}
          <strong className="text-emerald-800">approved</strong>{" "}
          {fastTracked ? (
            <>
              through <strong className="text-stone-900">Fast-Track Approval</strong>
              {approval.approvedByName ? <> by {approval.approvedByName}</> : null}
            </>
          ) : (
            <>by the AI Review Committee</>
          )}{" "}
          on {longDate(approval.approvedAt)}.
        </p>
        {request.primaryGoal && (
          <p className="relative mt-3 border-l-2 border-emerald-700/40 pl-3 text-sm italic text-stone-600">
            Intended use: {request.primaryGoal}
          </p>
        )}

        <dl className="avoid-break relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-4">
          {facts.map(f => (
            <div key={f.label} className="bg-white p-3">
              <dt className="text-[10px] uppercase tracking-[0.15em] text-stone-500">{f.label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-stone-900">{f.value}</dd>
            </div>
          ))}
        </dl>

        <section className="relative mt-8 print:mt-6">
          <SectionTitle>Committee sign-offs</SectionTitle>
          <div className="divide-y divide-stone-200 rounded-lg border border-stone-200">
            {steps.map(step => (
              <StepRow key={step.reviewerRole} step={step} fastTracked={fastTracked} />
            ))}
          </div>
        </section>

        <section className={`relative mt-8 grid grid-cols-1 gap-6 print:mt-6 ${showComments ? "sm:grid-cols-2" : ""}`}>
          {showComments && (
            <div className="avoid-break">
              <SectionTitle>Approval comments</SectionTitle>
              {approval.comments ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700" data-testid="text-report-comments">
                  {approval.comments}
                </p>
              ) : (
                <p className="text-sm text-stone-400">No comments were recorded.</p>
              )}
            </div>
          )}
          <div className="avoid-break">
            <SectionTitle>Conditions of approval</SectionTitle>
            {approval.conditions.length > 0 ? (
              <ol className="space-y-2.5" data-testid="list-report-conditions">
                {approval.conditions.map((c, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-800 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm text-stone-800">{c.text}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-stone-500">{c.source}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-stone-400">No conditions were attached to this approval.</p>
            )}
          </div>
        </section>

        <footer className="relative mt-10 print:mt-6 flex flex-col gap-1 border-t border-stone-200 pt-4 text-[10px] text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Generated {new Date(report.generatedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })} from
            ARC Intelligence. The live record in ARC Intelligence is authoritative.
          </p>
          <p style={{ fontFamily: MONO }}>Record {request.id}</p>
        </footer>
      </div>
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
      {children}
      <span className="h-px flex-1 bg-stone-200" />
    </h2>
  );
}

function ToolLogo({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-stone-200 bg-stone-50 text-xl font-bold text-stone-500"
        style={{ fontFamily: SERIF }}
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-12 w-12 shrink-0 rounded-lg border border-stone-200 bg-white object-contain p-1"
      onError={() => setFailed(true)}
    />
  );
}

const OUTCOME: Record<ApprovalReportStep["outcome"], { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  signed_off: { label: "Signed off", className: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: CheckCircle2 },
  partial: { label: "Partially signed off", className: "bg-amber-50 text-amber-800 ring-amber-200", Icon: Clock },
  bypassed: { label: "Bypassed · Fast-Track", className: "bg-amber-50 text-amber-800 ring-amber-200", Icon: Zap },
  pending: { label: "Pending", className: "bg-stone-100 text-stone-600 ring-stone-200", Icon: Clock },
  not_reviewed: { label: "Not reviewed", className: "bg-stone-100 text-stone-500 ring-stone-200", Icon: MinusCircle },
};

const DECISION: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  pass: { label: "Approved", className: "text-emerald-700", Icon: CheckCircle2 },
  fail: { label: "Rejected", className: "text-red-700", Icon: XCircle },
  needs_more_info: { label: "Needed more info", className: "text-amber-700", Icon: Clock },
};

function StepRow({ step, fastTracked }: { step: ApprovalReportStep; fastTracked: boolean }) {
  const outcome = OUTCOME[step.outcome];
  const requirement = step.required
    ? step.minApprovals > 1 ? `${step.minApprovals} approvals required` : "Required"
    : "Advisory";
  const outcomeLabel = step.outcome === "partial" && fastTracked ? "Partial · Fast-Track" : outcome.label;

  return (
    <div className="avoid-break grid grid-cols-1 items-start gap-2 p-3 sm:grid-cols-[170px_1fr_auto] sm:gap-4 sm:p-4" data-testid={`report-step-${step.reviewerRole}`}>
      <div>
        <p className="text-sm font-semibold text-stone-900">{step.name}</p>
        <p className="text-[11px] text-stone-500">{requirement}</p>
      </div>
      <div className="space-y-2">
        {step.entries.length === 0 ? (
          <p className="text-sm text-stone-400">No sign-off recorded</p>
        ) : (
          step.entries.map((e, i) => <EntryLine key={i} entry={e} fastTracked={fastTracked} />)
        )}
      </div>
      <span className={`inline-flex items-center gap-1 justify-self-start whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset sm:justify-self-end ${outcome.className}`}>
        <outcome.Icon className="h-3 w-3" /> {outcomeLabel}
      </span>
    </div>
  );
}

function EntryLine({ entry, fastTracked }: { entry: ApprovalReportEntry; fastTracked: boolean }) {
  const d = DECISION[entry.decision] ?? { label: titleCase(entry.decision), className: "text-stone-600", Icon: MinusCircle };
  return (
    <div className="flex items-start gap-2">
      <d.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${d.className}`} />
      <div className="min-w-0">
        <p className="text-sm text-stone-900">
          <span className="font-medium">{entry.reviewerName}</span>
          <span className="text-stone-500"> · {d.label} · {shortDate(entry.decidedAt)}</span>
        </p>
        {entry.recordedViaFastTrack ? (
          <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
            <Zap className="h-3 w-3" /> Sign-off recorded via Fast-Track
          </p>
        ) : entry.rationale ? (
          <p className="text-xs leading-relaxed text-stone-500">{entry.rationale}</p>
        ) : null}
        {entry.decision !== "pass" && fastTracked && (
          <p className="text-[11px] font-medium text-stone-500">Overridden by Fast-Track Approval</p>
        )}
      </div>
    </div>
  );
}

function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Rubber-stamp style seal drawn in SVG, with a light ink texture. */
function ApprovalStamp({ fastTrack, dateLabel, trackingId }: { fastTrack: boolean; dateLabel: string; trackingId: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width="190"
      height="190"
      role="img"
      aria-label={`Approved${fastTrack ? " via Fast-Track" : ""}${dateLabel ? `, ${dateLabel}` : ""}, ${trackingId}`}
      className="-rotate-[9deg] select-none"
      style={{ opacity: 0.94 }}
      data-testid="approval-stamp"
    >
      <defs>
        <filter id="arc-stamp-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.2 0 0 0 2" result="mask" />
          <feComposite in="SourceGraphic" in2="mask" operator="in" result="inked" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="9" result="warp" />
          <feDisplacementMap in="inked" in2="warp" scale="2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <mask id="arc-stamp-band-cut">
          <rect width="200" height="200" fill="#fff" />
          <rect x="4" y="80" width="192" height="40" fill="#000" />
        </mask>
        <path id="arc-stamp-top" d="M 33 100 A 67 67 0 0 1 167 100" />
        <path id="arc-stamp-bottom" d="M 25 100 A 75 75 0 0 0 175 100" />
      </defs>

      <g filter="url(#arc-stamp-ink)" fill={STAMP_INK} stroke={STAMP_INK}>
        <g mask="url(#arc-stamp-band-cut)">
          <circle cx="100" cy="100" r="93" fill="none" strokeWidth="5" />
          <circle cx="100" cy="100" r="85" fill="none" strokeWidth="1.3" />
          <circle cx="100" cy="100" r="57" fill="none" strokeWidth="1.3" />
          <text fontSize="10.5" fontWeight="700" letterSpacing="2.2" stroke="none" fontFamily="Poppins, sans-serif">
            <textPath href="#arc-stamp-top" startOffset="50%" textAnchor="middle">ARC INTELLIGENCE</textPath>
          </text>
          <text fontSize="9.5" fontWeight="700" letterSpacing="1.6" stroke="none" fontFamily="Poppins, sans-serif">
            <textPath href="#arc-stamp-bottom" startOffset="50%" textAnchor="middle">AI REVIEW COMMITTEE</textPath>
          </text>
          {fastTrack ? (
            <>
              <polygon points={starPoints(56, 71, 3.2)} stroke="none" />
              <text x="100" y="74" textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="1.4" stroke="none" fontFamily="Poppins, sans-serif">
                FAST-TRACK
              </text>
              <polygon points={starPoints(144, 71, 3.2)} stroke="none" />
            </>
          ) : (
            <>
              <polygon points={starPoints(86, 68, 4)} stroke="none" />
              <polygon points={starPoints(100, 65, 5)} stroke="none" />
              <polygon points={starPoints(114, 68, 4)} stroke="none" />
            </>
          )}
          <text x="100" y="133" textAnchor="middle" fontSize="9.5" fontWeight="700" letterSpacing="1.4" stroke="none" fontFamily="Poppins, sans-serif">
            {dateLabel}
          </text>
          {/* Tracking IDs run ~12 chars; sized to clear the inner ring at this height. */}
          <text x="100" y="145" textAnchor="middle" fontSize="7.5" fontWeight="600" letterSpacing="0.3" stroke="none" fontFamily={MONO}>
            {trackingId}
          </text>
        </g>

        <rect x="4" y="80" width="192" height="40" fill="none" strokeWidth="3" rx="1.5" />
        <rect x="9" y="84.5" width="182" height="31" fill="none" strokeWidth="1" />
        <text x="100" y="109" textAnchor="middle" fontSize="24" fontWeight="800" letterSpacing="3.2" stroke="none" fontFamily="Poppins, sans-serif">
          APPROVED
        </text>
      </g>
    </svg>
  );
}
