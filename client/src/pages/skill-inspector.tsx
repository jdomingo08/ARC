import { type ReactNode, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, HelpCircle, Github, Upload } from "lucide-react";
import { verdictLabel } from "@shared/skill-inspector-types";
import type { SkillScan } from "@shared/schema";

type Mode = "url" | "upload";

const toneStyles: Record<string, string> = {
  safe: "bg-green-100 text-green-800 border-green-200",
  caution: "bg-amber-100 text-amber-900 border-amber-200",
  danger: "bg-red-100 text-red-800 border-red-200",
  unknown: "bg-muted text-muted-foreground",
};
const toneIcon: Record<string, ReactNode> = {
  safe: <ShieldCheck className="h-5 w-5" />,
  caution: <ShieldAlert className="h-5 w-5" />,
  danger: <ShieldX className="h-5 w-5" />,
  unknown: <HelpCircle className="h-5 w-5" />,
};

export default function SkillInspectorPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<SkillScan | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: history, isLoading: historyLoading } = useQuery<SkillScan[]>({
    queryKey: ["/api/skill-inspector/scans"],
  });

  async function runScan() {
    setResult(null);
    setProgress("Starting scan…");
    setScanning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const form = new FormData();
    form.append("inputType", mode);
    if (mode === "url") {
      form.append("target", url.trim());
    } else if (file) {
      form.append("file", file);
    }

    try {
      const resp = await fetch("/api/skill-inspector/scan", {
        method: "POST",
        body: form,
        credentials: "include",
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        // Validation/availability errors come back as JSON before the stream opens.
        const body = await resp.json().catch(() => ({ message: `${resp.status}` }));
        throw new Error(body.message || `Request failed (${resp.status})`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const block of events) {
          const evLine = block.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
          if (!evLine || !dataLine) continue;
          const event = evLine.slice(6).trim();
          const data = JSON.parse(dataLine.slice(5).trim());
          if (event === "progress") setProgress(data.line);
          else if (event === "complete") {
            setResult(data.scan as SkillScan);
            setProgress("");
            queryClient.invalidateQueries({ queryKey: ["/api/skill-inspector/scans"] });
          } else if (event === "error") {
            throw new Error(data.message || "Scan failed");
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Scan failed", description: e.message, variant: "destructive" });
      }
    } finally {
      setScanning(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-skill-inspector-title">
          Skill Inspector
        </h1>
        <p className="text-muted-foreground mt-1">
          Check whether an AI agent skill is safe to install before you add it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan a skill</CardTitle>
          <CardDescription>Paste a public GitHub repo URL, or upload a SKILL.md / .zip.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="url" data-testid="tab-url"><Github className="h-4 w-4 mr-1" /> GitHub URL</TabsTrigger>
              <TabsTrigger value="upload" data-testid="tab-upload"><Upload className="h-4 w-4 mr-1" /> Upload file</TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="pt-3">
              <Input
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                data-testid="input-repo-url"
              />
            </TabsContent>
            <TabsContent value="upload" className="pt-3">
              <Input
                type="file"
                accept=".md,.zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                data-testid="input-skill-file"
              />
            </TabsContent>
          </Tabs>

          <Button
            onClick={runScan}
            disabled={scanning || (mode === "url" ? !url.trim() : !file)}
            data-testid="button-scan"
          >
            {scanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning…</> : "Scan skill"}
          </Button>
          {scanning && progress && <p className="text-sm text-muted-foreground">{progress}</p>}
        </CardContent>
      </Card>

      {result && <VerdictCard scan={result} />}

      <Card>
        <CardHeader>
          <CardTitle>My scans</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !history || history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scans yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setResult(s)}
                  className="w-full text-left flex items-center justify-between rounded-md border p-3 hover-elevate"
                  data-testid={`row-scan-${s.id}`}
                >
                  <span className="truncate">{s.target}</span>
                  <ScanStatusBadge scan={s} />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScanStatusBadge({ scan }: { scan: SkillScan }) {
  if (scan.status === "running") return <Badge variant="secondary">Running…</Badge>;
  if (scan.status === "failed") return <Badge className={toneStyles.danger}>Failed</Badge>;
  const v = verdictLabel((scan.riskLevel as any) ?? "unknown");
  return <Badge className={toneStyles[v.tone]}>{v.label}</Badge>;
}

function VerdictCard({ scan }: { scan: SkillScan }) {
  if (scan.status === "failed") {
    return (
      <Card>
        <CardHeader><CardTitle>Scan failed</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">{scan.error}</p></CardContent>
      </Card>
    );
  }
  const v = verdictLabel((scan.riskLevel as any) ?? "unknown");
  const findings = (scan.findings as any[]) ?? [];
  return (
    <Card>
      <CardHeader>
        <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 ${toneStyles[v.tone]}`}>
          {toneIcon[v.tone]}
          <span className="font-semibold" data-testid="text-verdict">{v.label}</span>
          {typeof scan.riskScore === "number" && <span className="text-sm">· risk {scan.riskScore}/100</span>}
        </div>
        <CardDescription className="pt-2">{scan.target}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {scan.recommendation && <p className="text-sm">{scan.recommendation}</p>}
        {findings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No findings.</p>
        ) : (
          <div className="space-y-2">
            {findings.map((f, i) => (
              <div key={i} className="rounded-md border p-3" data-testid={`finding-${i}`}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="uppercase">{f.severity}</Badge>
                  <span className="font-medium">{f.message}</span>
                </div>
                {f.location && <p className="text-xs text-muted-foreground mt-1">{f.location}</p>}
                {f.finding && <p className="text-sm mt-1">{f.finding}</p>}
              </div>
            ))}
          </div>
        )}
        <a
          href={`data:application/json,${encodeURIComponent(JSON.stringify(scan.rawOutput ?? {}, null, 2))}`}
          download={`skill-scan-${scan.id}.json`}
          className="text-sm underline text-muted-foreground"
          data-testid="link-export-json"
        >
          Download full JSON report
        </a>
      </CardContent>
    </Card>
  );
}
