import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles,
  Target,
  Building2,
  Workflow,
  GitCompare,
  TrendingUp,
  Plug,
  DollarSign,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

interface SimilarTool {
  name: string;
  comparison: string;
}

interface ToolInsights {
  primaryGoal: string;
  description: string;
  entravisionFit: string;
  workflowFit: string;
  similarTools: SimilarTool[];
  workflowImpact: {
    productivityGain: string;
    transformationAreas: string[];
    timeToValue: string;
  };
  integrations: string[];
  costReference: {
    model: string;
    estimatedRange: string;
    notes: string;
  };
  citations?: Array<{ url: string; title: string }>;
}

interface ToolInsightsFeedProps {
  toolName: string;
}

function InsightSection({
  icon: Icon,
  title,
  children,
  color,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  color: string;
}) {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

export function ToolInsightsFeed({ toolName }: ToolInsightsFeedProps) {
  const [insights, setInsights] = useState<ToolInsights | null>(null);
  const [lastSearched, setLastSearched] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSearchedRef = useRef("");

  const mutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/tool-insights", { toolName: name });
      return res.json() as Promise<ToolInsights>;
    },
    onSuccess: (data) => {
      setInsights(data);
    },
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = toolName.trim();
    if (trimmed.length < 3 || trimmed === lastSearchedRef.current) return;

    debounceRef.current = setTimeout(() => {
      lastSearchedRef.current = trimmed;
      setLastSearched(trimmed);
      mutation.mutate(trimmed);
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [toolName]);

  // Empty state - no tool name entered yet
  if (!toolName.trim() || toolName.trim().length < 3) {
    return (
      <div className="min-h-[350px] flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div className="p-3 rounded-full bg-muted">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">AI Tool Insights</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Enter a tool name to get AI-powered research on the tool's purpose, pricing, integrations, and more.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (mutation.isPending) {
    return (
      <div className="min-h-[350px] flex flex-col items-center justify-center text-center p-6 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <h3 className="text-sm font-semibold">Researching {toolName}...</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Our AI agent is searching the web for the latest information about this tool.
          </p>
        </div>
        <div className="flex flex-col gap-1 w-full max-w-[200px]">
          {["Searching the web...", "Analyzing features...", "Comparing alternatives...", "Estimating costs..."].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse" style={{ animationDelay: `${i * 0.5}s` }}>
              <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (mutation.isError) {
    return (
      <div className="min-h-[350px] flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div className="p-3 rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Research Unavailable</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {(mutation.error as Error)?.message || "Could not fetch tool insights. The AI service may not be configured."}
          </p>
        </div>
      </div>
    );
  }

  // No data yet
  if (!insights) {
    return (
      <div className="min-h-[350px] flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div className="p-3 rounded-full bg-muted">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">AI Tool Insights</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Analyzing <span className="font-medium text-foreground">{toolName}</span>...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[350px]">
      {/* Header */}
      <div className="p-3 border-b bg-gradient-to-r from-primary/5 to-primary/10 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">AI Insights: {lastSearched}</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Powered by AI with real-time web research</p>
      </div>

      {/* Scroll indicator */}
      <div className="flex items-center justify-center gap-1 py-1 text-xs text-muted-foreground bg-muted/30 shrink-0">
        <ChevronDown className="h-3 w-3 animate-bounce" />
        Scroll to explore all insights
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        <InsightSection icon={Target} title="Primary Goal" color="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          {insights.primaryGoal}
        </InsightSection>

        <InsightSection icon={Sparkles} title="Description" color="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
          {insights.description}
        </InsightSection>

        <InsightSection icon={Building2} title="How Entravision Could Use This" color="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
          {insights.entravisionFit}
        </InsightSection>

        <InsightSection icon={Workflow} title="How This Tool Fits Your Workflow" color="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          {insights.workflowFit}
        </InsightSection>

        <InsightSection icon={GitCompare} title="Similar Tools to Evaluate" color="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
          <div className="space-y-2">
            {insights.similarTools?.map((tool, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                <span className="font-medium text-foreground text-xs shrink-0">{tool.name}</span>
                <span className="text-xs">{tool.comparison}</span>
              </div>
            ))}
          </div>
        </InsightSection>

        <InsightSection icon={TrendingUp} title="Workflow Impact & Productivity" color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">Productivity Gain:</span>
              <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 rounded-full">
                {insights.workflowImpact?.productivityGain}
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-foreground">Transformation Areas:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {insights.workflowImpact?.transformationAreas?.map((area, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-muted rounded-full">{area}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">Time to Value:</span>
              <span className="text-xs">{insights.workflowImpact?.timeToValue}</span>
            </div>
          </div>
        </InsightSection>

        <InsightSection icon={Plug} title="Platform Integrations" color="bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300">
          <div className="flex flex-wrap gap-1">
            {insights.integrations?.map((platform, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-muted rounded-md border">
                {platform}
              </span>
            ))}
          </div>
        </InsightSection>

        <InsightSection icon={DollarSign} title="Cost Reference" color="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">Pricing Model:</span>
              <span className="text-xs">{insights.costReference?.model}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">Estimated Range:</span>
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded-full font-medium">
                {insights.costReference?.estimatedRange}
              </span>
            </div>
            {insights.costReference?.notes && (
              <p className="text-xs italic">{insights.costReference.notes}</p>
            )}
          </div>
        </InsightSection>

        {/* Citations */}
        {insights.citations && insights.citations.length > 0 && (
          <div className="border rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sources</h4>
            <div className="space-y-1">
              {insights.citations.slice(0, 5).map((citation, i) => (
                <a
                  key={i}
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{citation.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
