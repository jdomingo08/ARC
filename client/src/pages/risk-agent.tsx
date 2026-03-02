import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import type { Platform, RiskFinding, AgentRunLog } from "@shared/schema";

export default function RiskAgentPage() {
  const { toast } = useToast();
  const [scope, setScope] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("");

  const { data: platforms } = useQuery<Platform[]>({ queryKey: ["/api/platforms"] });
  const { data: findings, isLoading: findingsLoading } = useQuery<RiskFinding[]>({ queryKey: ["/api/risk/findings"] });
  const { data: logs, isLoading: logsLoading } = useQuery<AgentRunLog[]>({ queryKey: ["/api/risk/logs"] });

  const runMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { scope };
      if (scope === "single") payload.platformId = selectedPlatform;
      const res = await apiRequest("POST", "/api/risk/run", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Risk Scan Complete", description: `${data.findings?.length || 0} findings logged.` });
      queryClient.invalidateQueries({ queryKey: ["/api/risk/findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/risk/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const activePlatforms = platforms?.filter(p => p.status === "approved" || p.status === "on_review") || [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-risk-title">Risk Monitoring Agent</h1>
        <p className="text-muted-foreground mt-1">Monitor vendor risks, breaches, and security events</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Run Agent
          </CardTitle>
          <CardDescription>Trigger a manual risk assessment sweep</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Scope</label>
              <Select value={scope} onValueChange={setScope}>
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
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
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
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || (scope === "single" && !selectedPlatform)}
              data-testid="button-run-agent"
            >
              {runMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Running...</>
              ) : (
                <><ShieldAlert className="h-4 w-4 mr-1" /> Run Now</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-muted-foreground">
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
                    <div>
                      <p className="text-sm font-medium">
                        {log.scope === "all" ? "Full Sweep" : `Single: ${log.scope}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{log.prompt}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
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
