import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gauge,
  DollarSign,
  Coins,
  Activity,
  RefreshCw,
  CalendarClock,
  Save,
  Loader2,
  WifiOff,
  Wifi,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import type { ApiUsageSnapshot, ApiSyncLog, ApiUsageSchedule } from "@shared/schema";

interface UsageSummary {
  provider: string;
  windowDays: number;
  snapshots: ApiUsageSnapshot[];
  totals: { costUsd: number; inputTokens: number; outputTokens: number; totalTokens: number; numRequests: number };
  byModel: Array<{ model: string; inputTokens: number; outputTokens: number; numRequests: number }>;
  yesterday: ApiUsageSnapshot | null;
  today: ApiUsageSnapshot | null;
}

interface OpenAIStatus {
  provider: string;
  adminKeyConfigured: boolean;
  slackConfigured: boolean;
  latestSnapshotDate: string | null;
}

const FREQUENCY_PRESETS: { label: string; cron: string }[] = [
  { label: "Daily (6 AM UTC)", cron: "0 6 * * *" },
  { label: "Daily (midnight UTC)", cron: "0 0 * * *" },
  { label: "Daily (8 AM UTC)", cron: "0 8 * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
];

const usd = (n: number) =>
  `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => (n || 0).toLocaleString("en-US");
const compact = (n: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);

function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ApiCommandCenterPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [windowDays, setWindowDays] = useState("30");

  // Schedule local state
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean | null>(null);
  const [scheduleCron, setScheduleCron] = useState<string>("");
  const [slackDigest, setSlackDigest] = useState<boolean | null>(null);
  const [scheduleModified, setScheduleModified] = useState(false);

  const { data: status } = useQuery<OpenAIStatus>({ queryKey: ["/api/integrations/openai/status"] });

  const { data: summary, isLoading: summaryLoading } = useQuery<UsageSummary>({
    queryKey: ["/api/integrations/openai/summary", windowDays],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/openai/summary?days=${windowDays}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  const { data: logs, isLoading: logsLoading } = useQuery<ApiSyncLog[]>({
    queryKey: ["/api/integrations/openai/logs"],
  });

  const { data: schedule } = useQuery<ApiUsageSchedule>({
    queryKey: ["/api/integrations/usage-schedule"],
    select: (data) => {
      if (scheduleEnabled === null && data) {
        setScheduleEnabled(data.enabled);
        setScheduleCron(data.cronExpression);
        setSlackDigest(data.slackDigestEnabled);
      }
      return data;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/openai/sync", { days: Number(windowDays) });
      return res.json();
    },
    onSuccess: (data: { summary: string }) => {
      toast({ title: "Sync complete", description: data.summary });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/openai/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/openai/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/openai/logs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/integrations/usage-schedule", {
        enabled: scheduleEnabled,
        cronExpression: scheduleCron,
        slackDigestEnabled: slackDigest,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Schedule updated", description: "Automatic usage sync schedule saved." });
      setScheduleModified(false);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/usage-schedule"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const chartData =
    summary?.snapshots.map((s) => ({
      date: s.usageDate.slice(5), // MM-DD
      cost: Number(s.costUsd),
      input: s.inputTokens,
      output: s.outputTokens,
      requests: s.numRequests,
    })) || [];

  const statCards = [
    {
      title: "Yesterday's spend",
      value: usd(Number(summary?.yesterday?.costUsd ?? 0)),
      description: summary?.yesterday ? summary.yesterday.usageDate : "No data yet",
      icon: DollarSign,
    },
    {
      title: `Spend (${windowDays}d)`,
      value: usd(summary?.totals.costUsd ?? 0),
      description: "Total across the window",
      icon: DollarSign,
    },
    {
      title: `Tokens (${windowDays}d)`,
      value: compact(summary?.totals.totalTokens ?? 0),
      description: `${compact(summary?.totals.inputTokens ?? 0)} in / ${compact(summary?.totals.outputTokens ?? 0)} out`,
      icon: Coins,
    },
    {
      title: `Requests (${windowDays}d)`,
      value: compact(summary?.totals.numRequests ?? 0),
      description: "Model API calls",
      icon: Activity,
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-acc-title">
            <Gauge className="h-6 w-6" />
            API Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Central monitoring for the third-party APIs we consume. Showing OpenAI organization usage &amp; spend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={windowDays} onValueChange={setWindowDays}>
            <SelectTrigger className="w-[130px]" data-testid="select-acc-window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !status?.adminKeyConfigured}
              data-testid="button-acc-sync"
            >
              {syncMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Syncing…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1" /> Sync now</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Provider tabs (OpenAI today; extensible to more providers) */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Wifi className="h-3 w-3" /> OpenAI
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">More providers coming soon</Badge>
      </div>

      {/* Not-configured banner */}
      {status && !status.adminKeyConfigured && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <WifiOff className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">OpenAI Admin key not configured</p>
              <p className="text-xs text-muted-foreground">
                Set the <code className="px-1 py-0.5 bg-muted rounded text-[11px]">OPENAI_ADMIN_KEY</code> environment
                variable to an Organization Admin key (<code className="px-1 py-0.5 bg-muted rounded text-[11px]">sk-admin-…</code>)
                to pull org-wide usage and spend. This is separate from the inference key used by the Risk Agent.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1 truncate" data-testid={`stat-${stat.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    {summaryLoading ? <Skeleton className="h-8 w-24" /> : stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{stat.description}</p>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts" data-testid="tab-acc-charts">Usage &amp; Spend</TabsTrigger>
          <TabsTrigger value="models" data-testid="tab-acc-models">By Model</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-acc-logs">
            <Clock className="h-4 w-4 mr-1" /> Sync Logs ({logs?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Charts */}
        <TabsContent value="charts" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily spend (USD)</CardTitle>
              <CardDescription>Cost per day over the selected window</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v}`} />
                    <RechartsTooltip
                      formatter={(value: any) => [usd(Number(value)), "Cost"]}
                      contentStyle={{ background: "hsl(var(--popover, 0 0% 100%))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Token usage</CardTitle>
              <CardDescription>Input vs. output tokens per day</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => compact(Number(v))} />
                    <RechartsTooltip
                      formatter={(value: any, name: any) => [num(Number(value)), name === "input" ? "Input" : "Output"]}
                      contentStyle={{ background: "hsl(var(--popover, 0 0% 100%))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="input" stackId="t" fill="hsl(var(--chart-1))" name="Input" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="output" stackId="t" fill="hsl(var(--chart-2))" name="Output" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By model */}
        <TabsContent value="models" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Token usage by model</CardTitle>
              <CardDescription>Aggregated across the selected window</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : summary && summary.byModel.length > 0 ? (
                <div className="space-y-2">
                  {summary.byModel.map((m) => {
                    const total = m.inputTokens + m.outputTokens;
                    const max = summary.byModel[0].inputTokens + summary.byModel[0].outputTokens || 1;
                    return (
                      <div key={m.model} className="space-y-1" data-testid={`model-row-${m.model}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium font-mono">{m.model}</span>
                          <span className="text-muted-foreground">
                            {num(total)} tokens · {num(m.numRequests)} reqs
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(2, Math.round((total / max) * 100))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync logs */}
        <TabsContent value="logs" className="mt-4 space-y-3">
          {logsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : logs && logs.length > 0 ? (
            logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {log.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : log.status === "failed" ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{log.summary || log.error || log.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {log.trigger === "scheduled" ? <Clock className="h-3 w-3 mr-1" /> : null}
                        {log.trigger}
                      </Badge>
                      {log.slackDigestSent && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <MessageSquare className="h-3 w-3" /> Slack
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                    </div>
                  </div>
                  {(log.rangeStart || log.rangeEnd) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Range {log.rangeStart} → {log.rangeEnd} · {log.daysFetched} day(s)
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No sync runs yet</p>
                {isAdmin && <p className="text-sm text-muted-foreground mt-1">Click "Sync now" to pull recent usage.</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Schedule management (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Daily sync &amp; morning digest
            </CardTitle>
            <CardDescription>
              Automatically pulls the previous day's usage every morning so the dashboard is fresh when you arrive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable daily sync</p>
                <p className="text-xs text-muted-foreground">Runs on the schedule below and refreshes recent days.</p>
              </div>
              <Switch
                checked={scheduleEnabled ?? false}
                onCheckedChange={(c) => {
                  setScheduleEnabled(c);
                  setScheduleModified(true);
                }}
                disabled={!status?.adminKeyConfigured}
                data-testid="switch-acc-enabled"
              />
            </div>

            {scheduleEnabled && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <Select
                    value={scheduleCron}
                    onValueChange={(v) => {
                      setScheduleCron(v);
                      setScheduleModified(true);
                    }}
                  >
                    <SelectTrigger className="w-[250px]" data-testid="select-acc-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_PRESETS.map((p) => (
                        <SelectItem key={p.cron} value={p.cron}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cron: <code className="px-1 py-0.5 bg-muted rounded text-[11px]">{scheduleCron}</code> (UTC)
                  </p>
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4" /> Slack morning digest
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {status?.slackConfigured
                        ? "Posts a usage summary to Slack after each scheduled sync."
                        : "Set SLACK_WEBHOOK_URL (or SLACK_BOT_TOKEN + SLACK_USAGE_CHANNEL) to enable."}
                    </p>
                  </div>
                  <Switch
                    checked={slackDigest ?? false}
                    onCheckedChange={(c) => {
                      setSlackDigest(c);
                      setScheduleModified(true);
                    }}
                    data-testid="switch-acc-slack"
                  />
                </div>

                {schedule?.lastRunAt && (
                  <p className="text-xs text-muted-foreground">
                    Last automatic sync: {formatDateTime(schedule.lastRunAt)}
                    {schedule.lastRunStatus ? ` · ${schedule.lastRunStatus}` : ""}
                    {schedule.lastRunError ? ` · ${schedule.lastRunError}` : ""}
                  </p>
                )}
              </div>
            )}

            {scheduleModified && (
              <Button
                size="sm"
                onClick={() => saveScheduleMutation.mutate()}
                disabled={saveScheduleMutation.isPending}
                data-testid="button-acc-save-schedule"
              >
                {saveScheduleMutation.isPending ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving…</>
                ) : (
                  <><Save className="h-3 w-3 mr-1" /> Save schedule</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Gauge className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
      <p className="text-muted-foreground">No usage data yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        Once the OpenAI Admin key is set, run a sync to populate the dashboard.
      </p>
    </div>
  );
}
