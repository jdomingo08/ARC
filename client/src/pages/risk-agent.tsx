import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { RiskBadge, ConfidenceBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  Play,
  Clock,
  AlertTriangle,
  FileSearch,
  ExternalLink,
  Loader2,
  Wifi,
  WifiOff,
  Search,
  CalendarClock,
  Save,
} from "lucide-react";
import type { Platform, RiskFinding, AgentRunLog, ScanSchedule } from "@shared/schema";

interface ScanProgress {
  status: "idle" | "scanning" | "complete" | "error";
  totalPlatforms: number;
  currentIndex: number;
  currentPlatform: string;
  liveFindings: RiskFinding[];
  errorMessage?: string;
}

function parseSSEEvents(buffer: string): { events: Array<{ event: string; data: any }>; remainder: string } {
  const events: Array<{ event: string; data: any }> = [];
  const lines = buffer.split("\n");
  let currentEvent = "";
  let currentData = "";
  let lastProcessedIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7);
    } else if (line.startsWith("data: ")) {
      currentData = line.slice(6);
    } else if (line === "" && currentEvent && currentData) {
      try {
        events.push({ event: currentEvent, data: JSON.parse(currentData) });
      } catch {
        // Skip malformed data
      }
      currentEvent = "";
      currentData = "";
      lastProcessedIndex = i;
    }
  }

  // Return unprocessed remainder for the next chunk
  const processedLines = lines.slice(0, lastProcessedIndex + 1).join("\n");
  const remainder = buffer.slice(processedLines.length);
  return { events, remainder };
}

const FREQUENCY_PRESETS: { label: string; cron: string }[] = [
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "Daily (midnight)", cron: "0 0 * * *" },
  { label: "Daily (6 AM)", cron: "0 6 * * *" },
  { label: "Weekly (Monday)", cron: "0 0 * * 1" },
];

export default function RiskAgentPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [scope, setScope] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    status: "idle",
    totalPlatforms: 0,
    currentIndex: 0,
    currentPlatform: "",
    liveFindings: [],
  });
  const abortRef = useRef<AbortController | null>(null);

  // Schedule management state
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean | null>(null);
  const [scheduleCron, setScheduleCron] = useState<string>("");
  const [scheduleModified, setScheduleModified] = useState(false);

  const { data: platforms } = useQuery<Platform[]>({ queryKey: ["/api/platforms"] });
  const { data: findings, isLoading: findingsLoading } = useQuery<RiskFinding[]>({ queryKey: ["/api/risk/findings"] });
  const { data: logs, isLoading: logsLoading } = useQuery<AgentRunLog[]>({ queryKey: ["/api/risk/logs"] });
  const { data: aiStatus } = useQuery<{ aiConfigured: boolean; provider: string | null }>({
    queryKey: ["/api/risk/status"],
  });
  const { data: schedule } = useQuery<ScanSchedule>({
    queryKey: ["/api/risk/schedule"],
    select: (data) => {
      // Initialize local state from server data on first load
      if (scheduleEnabled === null && data) {
        setScheduleEnabled(data.enabled);
        setScheduleCron(data.cronExpression);
      }
      return data;
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/risk/schedule", {
        enabled: scheduleEnabled,
        cronExpression: scheduleCron,
        scope: "all",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Schedule Updated", description: "Automatic scanning schedule has been saved." });
      setScheduleModified(false);
      queryClient.invalidateQueries({ queryKey: ["/api/risk/schedule"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isAdmin = user?.role === "admin";

  const runStreamingScan = useCallback(async () => {
    const abortController = new AbortController();
    abortRef.current = abortController;

    setScanProgress({
      status: "scanning",
      totalPlatforms: 0,
      currentIndex: 0,
      currentPlatform: "Initializing...",
      liveFindings: [],
    });

    try {
      const payload: any = { scope };
      if (scope === "single") payload.platformId = selectedPlatform;

      const response = await fetch("/api/risk/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg: string;
        try {
          errorMsg = JSON.parse(errorText).message;
        } catch {
          errorMsg = errorText || response.statusText;
        }
        throw new Error(errorMsg);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseSSEEvents(buffer);
        buffer = remainder;

        for (const { event, data } of events) {
          switch (event) {
            case "scan-start":
              setScanProgress(prev => ({
                ...prev,
                totalPlatforms: data.totalPlatforms,
              }));
              break;
            case "platform-start":
              setScanProgress(prev => ({
                ...prev,
                currentIndex: data.index,
                currentPlatform: data.toolName,
              }));
              break;
            case "finding":
              setScanProgress(prev => ({
                ...prev,
                liveFindings: [...prev.liveFindings, data.finding],
              }));
              break;
            case "platform-error":
              toast({
                title: `Error scanning ${data.toolName}`,
                description: data.error,
                variant: "destructive",
              });
              break;
            case "complete":
              setScanProgress(prev => ({
                ...prev,
                status: "complete",
              }));
              toast({
                title: "Risk Scan Complete",
                description: `${data.totalFindings} findings logged.`,
              });
              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ["/api/risk/findings"] });
              queryClient.invalidateQueries({ queryKey: ["/api/risk/logs"] });
              queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
              break;
            case "error":
              setScanProgress(prev => ({
                ...prev,
                status: "error",
                errorMessage: data.message,
              }));
              toast({
                title: "Scan Error",
                description: data.message,
                variant: "destructive",
              });
              break;
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setScanProgress(prev => ({
        ...prev,
        status: "error",
        errorMessage: err.message,
      }));
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      abortRef.current = null;
    }
  }, [scope, selectedPlatform, toast]);

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const activePlatforms = platforms?.filter(p => p.status === "approved" || p.status === "on_review") || [];
  const isScanning = scanProgress.status === "scanning";
  const progressPercent = scanProgress.totalPlatforms > 0
    ? Math.round((scanProgress.currentIndex / scanProgress.totalPlatforms) * 100)
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-risk-title">Risk Monitoring Agent</h1>
        <p className="text-muted-foreground mt-1">Monitor vendor risks, breaches, and security events</p>
      </div>

      {/* AI Status Banner */}
      {aiStatus && !aiStatus.aiConfigured && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">AI Provider Not Configured</p>
              <p className="text-xs text-muted-foreground">
                Set the <code className="px-1 py-0.5 bg-muted rounded text-[11px]">OPENAI_API_KEY</code> environment variable to enable real AI-powered risk scanning.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run Agent Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Run Agent
            {aiStatus?.aiConfigured && (
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                <Wifi className="h-3 w-3 mr-1" /> {aiStatus.provider} + Web Search
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Trigger a manual AI-powered risk assessment sweep</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Scope</label>
              <Select value={scope} onValueChange={setScope} disabled={isScanning}>
                <SelectTrigger className="w-[200px]" data-testid="select-risk-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Active Platforms</SelectItem>
                  <SelectItem value="single">Specific Platform</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "single" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Platform</label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform} disabled={isScanning}>
                  <SelectTrigger className="w-[250px]" data-testid="select-risk-platform">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {activePlatforms.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.toolName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              onClick={isScanning ? () => abortRef.current?.abort() : runStreamingScan}
              disabled={!aiStatus?.aiConfigured || (!isScanning && scope === "single" && !selectedPlatform)}
              variant={isScanning ? "destructive" : "default"}
              data-testid="button-run-agent"
            >
              {isScanning ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Stop Scan</>
              ) : (
                <><ShieldAlert className="h-4 w-4 mr-1" /> Run Now</>
              )}
            </Button>
          </div>

          {/* Live Scanning Progress */}
          {isScanning && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium">
                    Analyzing: {scanProgress.currentPlatform}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {scanProgress.currentIndex} / {scanProgress.totalPlatforms} platforms
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              {scanProgress.liveFindings.length > 0 && (
                <div className="space-y-2 mt-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Live Findings ({scanProgress.liveFindings.length})
                  </p>
                  {scanProgress.liveFindings.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-background border">
                      <RiskBadge classification={f.classification} />
                      <span className="truncate">{f.summary}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scan Complete Summary */}
          {scanProgress.status === "complete" && scanProgress.liveFindings.length > 0 && (
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <p className="text-sm text-green-700 dark:text-green-400">
                Scan complete. {scanProgress.liveFindings.length} findings discovered.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Management Card (Admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Automatic Scanning
            </CardTitle>
            <CardDescription>Configure automatic risk scanning schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Automatic Scans</p>
                <p className="text-xs text-muted-foreground">
                  When enabled, the system automatically scans all active platforms on the configured schedule
                </p>
              </div>
              <Switch
                checked={scheduleEnabled ?? false}
                onCheckedChange={(checked) => {
                  setScheduleEnabled(checked);
                  setScheduleModified(true);
                }}
                disabled={!aiStatus?.aiConfigured}
              />
            </div>

            {scheduleEnabled && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <Select
                    value={scheduleCron}
                    onValueChange={(value) => {
                      setScheduleCron(value);
                      setScheduleModified(true);
                    }}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_PRESETS.map(preset => (
                        <SelectItem key={preset.cron} value={preset.cron}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cron: <code className="px-1 py-0.5 bg-muted rounded text-[11px]">{scheduleCron}</code>
                  </p>
                </div>

                {schedule?.lastRunAt && (
                  <p className="text-xs text-muted-foreground">
                    Last automatic scan: {formatDate(schedule.lastRunAt)}
                  </p>
                )}
              </div>
            )}

            {scheduleModified && (
              <Button
                size="sm"
                onClick={() => saveScheduleMutation.mutate()}
                disabled={saveScheduleMutation.isPending}
              >
                {saveScheduleMutation.isPending ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-3 w-3 mr-1" /> Save Schedule</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="findings">
        <TabsList>
          <TabsTrigger value="findings" data-testid="tab-findings">
            <AlertTriangle className="h-4 w-4 mr-1" /> Findings ({findings?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <Clock className="h-4 w-4 mr-1" /> Run Logs ({logs?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="mt-4 space-y-3">
          {findingsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : findings && findings.length > 0 ? (
            findings.map(f => (
              <Card key={f.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <RiskBadge classification={f.classification} />
                    <div className="flex items-center gap-2">
                      <ConfidenceBadge confidence={f.confidence} />
                      <span className="text-xs text-muted-foreground">{formatDate(f.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-sm">{f.summary}</p>
                  {f.recommendedActions && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                      <FileSearch className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground">{f.recommendedActions}</p>
                    </div>
                  )}
                  {f.sources && Array.isArray(f.sources) && (
                    <div className="flex flex-wrap gap-2">
                      {(f.sources as any[]).map((s: any, i: number) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="h-3 w-3" /> {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No risk findings yet</p>
                <p className="text-sm text-muted-foreground mt-1">Run the agent to scan for vendor risks</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-3">
          {logsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : logs && logs.length > 0 ? (
            logs.map(log => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {log.scope === "all" ? "Full Sweep" : `Single: ${log.scope}`}
                        </p>
                        <p className="text-xs text-muted-foreground">{log.prompt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(log as any).trigger === "scheduled" && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" /> Scheduled
                        </Badge>
                      )}
                      {(log as any).status === "running" && (
                        <Badge variant="secondary" className="text-xs">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running
                        </Badge>
                      )}
                      {(log as any).status === "failed" && (
                        <Badge variant="destructive" className="text-xs">Failed</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <Badge variant="outline">
                      {Array.isArray(log.platformsChecked) ? (log.platformsChecked as string[]).length : 0} platforms
                    </Badge>
                    <Badge variant="secondary">{log.findingsCount || 0} findings</Badge>
                    <span className="text-xs text-muted-foreground">{log.resultsSummary}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No run logs yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
