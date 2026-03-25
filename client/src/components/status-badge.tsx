import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  pending_reviews: { label: "Pending Reviews", variant: "secondary" },
  waiting_on_requester: { label: "Waiting on Requester", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  on_review: { label: "On Review", variant: "secondary" },
  retired: { label: "Retired", variant: "outline" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusConfig[status] || { label: status, variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={className} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}

const impactConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  high: { label: "High Impact", variant: "destructive" },
  medium: { label: "Medium Impact", variant: "secondary" },
  low: { label: "Low Impact", variant: "outline" },
};

export function ImpactBadge({ level, className }: { level: string; className?: string }) {
  const config = impactConfig[level] || { label: level, variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={className} data-testid={`badge-impact-${level}`}>
      {config.label}
    </Badge>
  );
}

const riskConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Low Risk", variant: "outline" },
  medium: { label: "Medium Risk", variant: "secondary" },
  high: { label: "High Risk", variant: "destructive" },
  critical: { label: "Critical", variant: "destructive" },
};

export function RiskBadge({ classification, className }: { classification: string; className?: string }) {
  const config = riskConfig[classification] || { label: classification, variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={className} data-testid={`badge-risk-${classification}`}>
      {config.label}
    </Badge>
  );
}

const roleConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  requester: { label: "Requester", variant: "outline" },
  reviewer: { label: "Reviewer", variant: "secondary" },
  chair: { label: "Chair", variant: "default" },
  admin: { label: "Admin", variant: "destructive" },
  security: { label: "Security", variant: "destructive" },
  technical_financial: { label: "Tech/Financial", variant: "secondary" },
  strategic: { label: "Strategic", variant: "outline" },
};

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const config = roleConfig[role] || { label: role, variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={className} data-testid={`badge-role-${role}`}>
      {config.label}
    </Badge>
  );
}

export function DecisionBadge({ decision, className }: { decision: string; className?: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pass: { label: "Pass", variant: "default" },
    fail: { label: "Fail", variant: "destructive" },
    needs_more_info: { label: "Needs More Info", variant: "secondary" },
  };
  const c = config[decision] || { label: decision, variant: "outline" as const };
  return (
    <Badge variant={c.variant} className={className} data-testid={`badge-decision-${decision}`}>
      {c.label}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence, className }: { confidence: string; className?: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
    high: { variant: "default" },
    medium: { variant: "secondary" },
    low: { variant: "outline" },
  };
  const c = config[confidence] || { variant: "outline" as const };
  return (
    <Badge variant={c.variant} className={className} data-testid={`badge-confidence-${confidence}`}>
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
    </Badge>
  );
}
