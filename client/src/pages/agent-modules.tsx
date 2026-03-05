import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  ShieldAlert,
  Sparkles,
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface AgentPrompt {
  id: string;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  userPromptTemplate: string;
  userPromptDescription: string;
  model: string;
  features: string[];
}

function PromptViewer({ label, content }: { label: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayContent = expanded ? content : content.slice(0, 300) + (content.length > 300 ? "..." : "");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2">
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <div className="relative">
        <pre className="bg-muted/50 border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-hidden">
          {displayContent}
        </pre>
        {content.length > 300 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 h-7 text-xs"
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3 mr-1" /> Show Less</>
            ) : (
              <><ChevronDown className="h-3 w-3 mr-1" /> Show Full Prompt</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

const categoryIcons: Record<string, any> = {
  "Security & Compliance": ShieldAlert,
  "Research & Analysis": Sparkles,
};

const categoryColors: Record<string, string> = {
  "Security & Compliance": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "Research & Analysis": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export default function AgentModulesPage() {
  const { data: agents, isLoading } = useQuery<AgentPrompt[]>({
    queryKey: ["/api/agent-prompts"],
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6" />
          Agent Modules
        </h1>
        <p className="text-muted-foreground mt-1">
          View and inspect all AI agent prompts used across the ARC Intelligence platform
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      <div className="grid gap-6">
        {agents?.map((agent) => {
          const IconComponent = categoryIcons[agent.category] || Bot;
          const colorClass = categoryColors[agent.category] || "bg-muted text-muted-foreground";

          return (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription className="mt-0.5">{agent.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    <Code className="h-3 w-3 mr-1" />
                    {agent.model}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-xs text-muted-foreground">Category:</span>
                  <Badge variant="secondary" className="text-xs">{agent.category}</Badge>
                  <span className="text-xs text-muted-foreground ml-2">Features:</span>
                  {agent.features.map((feature) => (
                    <Badge key={feature} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <PromptViewer label="System Prompt" content={agent.systemPrompt} />

                <div className="border-t pt-4">
                  <PromptViewer label="User Prompt Template (Example)" content={agent.userPromptTemplate} />
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {agent.userPromptDescription}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {agents && agents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No Agent Modules</h3>
            <p className="text-sm text-muted-foreground">No AI agents are configured in the platform yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
