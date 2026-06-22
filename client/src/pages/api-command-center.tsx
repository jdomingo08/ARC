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
import { Progress } from "@/components/ui/progress";
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
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  PlugZap,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import type { ApiUsageSnapshot, ApiSyncLog, ApiUsageSchedule } from "@shared/schema";

interface ProviderInfo {
  key: string;
  label: string;
  hasCost: boolean;
  hasRequests: boolean;
  supportsQuota: boolean;
  unitLabel: string;
  configured: boolean;
}

interface ProviderStatus {
  provider: string;
  label: string;
  hasCost: boolean;
  hasRequests: boolean;
  supportsQuota: boolean;
  unitLabel: string;
  envVar: string;
  configured: boolean;
  slackConfigured: boolean;
  latestSnapshotDate: string | null;
}

interface Quota {
  tier?: string | null;
  used: number;
  limit: number | null;
  unitLabel: string;
  resetAt?: string | null;
}

interface UsageSummary {
  provider: string;
  label: string;
  hasCost: boolean;
  hasRequests: boolean;
  supportsQuota: boolean;
  unitLabel: string;
  windowDays: number;
  snapshots: ApiUsageSnapshot[];
  totals: { costUsd: number; units: number; inputTokens: number; outputTokens: number; totalTokens: number; numRequests: number };
  byModel: Array<{ model: string; units: number; inputTokens: number; outputTokens: number; numRequests: number }>;
  quota: Quota | null;
  yesterday: ApiUsageSnapshot | null;
  today: ApiUsageSnapshot | null;
}

const FREQUENCY_PRESETS: { label: string; cron: string }[] = [
  { label: "Daily (6 AM UTC)", cron: "0 6 * * *" },
  { label: "Daily (midnight UTC)", cron: "0 0 * * *" },
  { label: "Daily (8 AM UTC)", cron: "0 8 * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
];

const KEY_HINTS: Record<string, string> = {
  openai: "an Organization Admin key (sk-admin-…), separate from the inference key used by the Risk Agent",
  elevenlabs: "your ElevenLabs API key (ElevenLabs dashboard → Profile → API key)",
};

const usd = (n: number) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => (n || 0).toLocaleString("en-US");
const compact = (n: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ApiCommandCenterPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [provider, setProvider] = useState("openai");
  const [windowDays, setWindowDays] = useState("30");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Schedule local state (module-wide)
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean | null>(null);
  const [scheduleCron, setScheduleCron] = useState<string>("");
  const [slackDigest, setSlackDigest] = useState<boolean | null>(null);
  const [scheduleModified, setScheduleModified] = useState(false);

  const { data: providers } = useQuery<ProviderInfo[]>({ queryKey: ["/api/integrations/providers"] });
  const { data: status } = useQuery<ProviderStatus>({ queryKey: ["/api/integrations", provider, "status"] });

  const { data: summary, isLoading: summaryLoading } = useQuery<UsageSummary>({
    queryKey: ["/api/integrations", provider, "summary", windowDays],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/${provider}/summary?days=${windowDays}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  const { data: logs, isLoading: logsLoading } = useQuery<ApiSyncLog[]>({
    queryKey: ["/api/integrations", provider, "logs"],
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
      const res = await apiRequest("POST", `/api/integrations/${provider}/sync`, { days: Number(windowDays) });
      return res.json();
    },
    onSuccess: (data: { summary: string }) => {
      toast({ title: "Sync complete", description: data.summary });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations", provider] });
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/integrations/${provider}/test`);
      return res.json() as Promise<{ ok: boolean; message: string; status?: number }>;
    },
    onSuccess: (data) => {
      setTestResult({ ok: data.ok, message: data.message });
      toast({
        title: data.ok ? "Connection OK" : "Connection failed",
        description: data.message,
        variant: data.ok ? undefined : "destructive",
      });
      if (data.ok) queryClient.invalidateQueries({ queryKey: ["/api/integrations", provider, "status"] });
    },
    onError: (error: Error) => {
      setTestResult({ ok: false, message: error.message });
      toast({ title: "Connection failed", description: error.message, variant: "destructive" });
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

  const hasCost = summary?.hasCost ?? status?.hasCost ?? false;
  const hasRequests = summary?.hasRequests ?? status?.hasRequests ?? false;
  const supportsQuota = summary?.supportsQuota ?? status?.supportsQuota ?? false;
  const unitLabel = summary?.unitLabel || status?.unitLabel || "units";
  const anyConfigured = providers?.some((p) => p.configured) ?? false;

  const chartData =
    summary?.snapshots.map((s) => ({
      date: s.usageDate.slice(5),
      cost: Number(s.costUsd),
      units: s.units,
    })) || [];

  const yd = summary?.yesterday;
  const quota = summary?.quota;

  const statCards: { title: string; value: React.ReactNode; desc: string; icon: any }[] = [];
  if (hasCost) {
    statCards.push({ title: "Yesterday's spend", value: usd(Number(yd?.costUsd ?? 0)), desc: yd ? yd.usageDate : "No data yet", icon: DollarSign });
    statCards.push({ title: `Spend (${windowDays}d)`, value: usd(summary?.totals.costUsd ?? 0), desc: "Window total", icon: DollarSign });
    statCards.push({ title: `${cap(unitLabel)} (${windowDays}d)`, value: compact(summary?.totals.units ?? 0), desc: `Yesterday: ${compact(Number(yd?.units ?? 0))}`, icon: Coins });
    if (hasRequests) statCards.push({ title: `Requests (${windowDays}d)`, value: compact(summary?.totals.numRequests ?? 0), desc: "Model API calls", icon: Activity });
  } else {
    statCards.push({ title: `Yesterday's ${unitLabel}`, value: compact(Number(yd?.units ?? 0)), desc: yd ? yd.usageDate : "No data yet", icon: Coins });
    statCards.push({ title: `${cap(unitLabel)} (${windowDays}d)`, value: compact(summary?.totals.units ?? 0), desc: "Window total", icon: Coins });
    if (supportsQuota && quota) {
      const pct = quota.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : null;
      statCards.push({
        title: "Plan usage",
        value: pct != null ? `${pct}%` : compact(quota.used),
        desc: `${compact(quota.used)}${quota.limit ? ` / ${compact(quota.limit)}` : ""} ${unitLabel}`,
        icon: Gauge,
      });
      statCards.push({
        title: "Plan resets",
        value: quota.resetAt ? new Date(quota.resetAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
        desc: quota.tier ? `Tier: ${quota.tier}` : "Current billing cycle",
        icon: CalendarClock,
      });
    }
  }

  const quotaPct = quota && quota.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-acc-title">
            <Gauge className="h-6 w-6" />
            API Command Center
          </h1>
          <p className="text-muted-foreground mt-1">Central monitoring for the third-party APIs we consume.</p>
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
            <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending} data-testid="button-acc-test">
              {testMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Testing…</>
              ) : (
                <><PlugZap className="h-4 w-4 mr-1" /> Test connection</>
              )}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || !status?.configured} data-testid="button-acc-sync">
              {syncMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Syncing…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1" /> Sync now</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Provider switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {(providers || [{ key: "openai", label: "OpenAI", configured: false } as ProviderInfo]).map((p) => (
          <Button
            key={p.key}
            variant={provider === p.key ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setProvider(p.key);
              setTestResult(null);
            }}
            data-testid={`provider-${p.key}`}
          >
            {p.label}
            <span
              className={`ml-2 h-2 w-2 rounded-full ${p.configured ? "bg-green-500" : "bg-muted-foreground/40"}`}
              title={p.configured ? "Configured" : "Not configured"}
            />
          </Button>
        ))}
      </div>

      {/* Test connection result */}
      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
            testResult.ok
              ? "border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
          data-testid="acc-test-result"
        >
          {testResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Not-configured banner */}
      {status && !status.configured && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <WifiOff className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{status.label} not configured</p>
              <p className="text-xs text-muted-foreground">
                Set the <code className="px-1 py-0.5 bg-muted rounded text-[11px]">{status.envVar}</code> environment variable to{" "}
                {KEY_HINTS[status.provider] || `enable ${status.label} usage data`}.
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
                  <p className="text-xs text-muted-foreground mt-1 truncate">{stat.desc}</p>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan quota progress (providers with a quota) */}
      {supportsQuota && quota && quotaPct != null && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Plan usage this cycle</span>
              <span className="text-muted-foreground">
                {num(quota.used)} / {num(quota.limit || 0)} {unitLabel} ({quotaPct}%)
              </span>
            </div>
            <Progress value={quotaPct} className="h-2" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts" data-testid="tab-acc-charts">Usage{hasCost ? " & Spend" : ""}</TabsTrigger>
          <TabsTrigger value="models" data-testid="tab-acc-models">By Model</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-acc-logs">
            <Clock className="h-4 w-4 mr-1" /> Sync Logs ({logs?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="mt-4 space-y-4">
          {hasCost && (
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
                  <EmptyState configured={status?.configured} />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily {unitLabel}</CardTitle>
              <CardDescription>{cap(unitLabel)} consumed per day</CardDescription>
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
                      formatter={(value: any) => [num(Number(value)), cap(unitLabel)]}
                      contentStyle={{ background: "hsl(var(--popover, 0 0% 100%))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="units" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState configured={status?.configured} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{cap(unitLabel)} by model</CardTitle>
              <CardDescription>Aggregated across the selected window</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : summary && summary.byModel.length > 0 ? (
                <div className="space-y-2">
                  {summary.byModel.map((m) => {
                    const max = summary.byModel[0].units || 1;
                    return (
                      <div key={m.model} className="space-y-1" data-testid={`model-row-${m.model}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium font-mono truncate">{m.model}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            {num(m.units)} {unitLabel}
                            {hasRequests ? ` · ${num(m.numRequests)} reqs` : ""}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round((m.units / max) * 100))}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState configured={status?.configured} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

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

      {/* Schedule management (admin only, module-wide) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Daily sync &amp; morning digest
            </CardTitle>
            <CardDescription>
              One schedule pulls usage for every configured provider each morning, so the dashboard is fresh when you arrive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable daily sync</p>
                <p className="text-xs text-muted-foreground">Syncs all configured providers on the schedule below.</p>
              </div>
              <Switch
                checked={scheduleEnabled ?? false}
                onCheckedChange={(c) => {
                  setScheduleEnabled(c);
                  setScheduleModified(true);
                }}
                disabled={!anyConfigured}
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
                        ? "Posts one combined usage summary (all providers) to Slack after each scheduled sync."
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
              <Button size="sm" onClick={() => saveScheduleMutation.mutate()} disabled={saveScheduleMutation.isPending} data-testid="button-acc-save-schedule">
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

function EmptyState({ configured }: { configured?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Gauge className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
      <p className="text-muted-foreground">No usage data yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        {configured ? "Run a sync to populate the dashboard." : "Add this provider's API key, then run a sync."}
      </p>
    </div>
  );
}
