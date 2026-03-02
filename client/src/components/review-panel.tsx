import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from "lucide-react";

interface ReviewPanelProps {
  requestId: string;
  userReviewerRole: string;
  userRole: string;
  canChairApprove: boolean;
  securityPassed: boolean;
  techPassed: boolean;
}

export function ReviewPanel({ requestId, userReviewerRole, userRole, canChairApprove, securityPassed, techPassed }: ReviewPanelProps) {
  const { toast } = useToast();
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [riskNotes, setRiskNotes] = useState("");
  const [conditions, setConditions] = useState("");

  const isChair = userRole === "chair";
  const chairBlocked = isChair && !canChairApprove;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/requests/${requestId}/reviews`, {
        decision,
        rationale,
        riskNotes: riskNotes || null,
        conditions: conditions || null,
        reviewerRole: userReviewerRole,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Review Submitted", description: `Your ${decision.replace(/_/g, " ")} decision has been recorded.` });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", requestId] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", requestId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDecision("");
      setRationale("");
      setRiskNotes("");
      setConditions("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Submit Your Review</CardTitle>
        <CardDescription>
          {isChair ? "Chair Sign-off" : `${userReviewerRole?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} Review`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {chairBlocked && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Chair approval is locked until both Security and Tech/Financial reviews pass.
              {!securityPassed && " Security review is pending."}
              {!techPassed && " Tech/Financial review is pending."}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Decision *</Label>
          <RadioGroup value={decision} onValueChange={setDecision} disabled={chairBlocked} data-testid="radio-decision">
            <div className="flex items-center gap-2 p-3 rounded-md border">
              <RadioGroupItem value="pass" id="dec-pass" />
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <Label htmlFor="dec-pass" className="font-medium">Pass</Label>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-md border">
              <RadioGroupItem value="fail" id="dec-fail" />
              <XCircle className="h-4 w-4 text-red-600" />
              <Label htmlFor="dec-fail" className="font-medium">Fail</Label>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-md border">
              <RadioGroupItem value="needs_more_info" id="dec-info" />
              <HelpCircle className="h-4 w-4 text-amber-600" />
              <Label htmlFor="dec-info" className="font-medium">Needs More Info</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rationale">Rationale *</Label>
          <Textarea id="rationale" value={rationale} onChange={e => setRationale(e.target.value)} placeholder="Provide your reasoning for this decision..." disabled={chairBlocked} data-testid="input-rationale" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="riskNotes">Risk Notes (optional)</Label>
          <Textarea id="riskNotes" value={riskNotes} onChange={e => setRiskNotes(e.target.value)} placeholder="Any risk-related observations..." disabled={chairBlocked} data-testid="input-risk-notes" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="conditions">Conditions (optional)</Label>
          <Textarea id="conditions" value={conditions} onChange={e => setConditions(e.target.value)} placeholder='e.g., "Approved if SSO is enabled"' disabled={chairBlocked} data-testid="input-conditions" />
        </div>

        <Button
          onClick={() => submitMutation.mutate()}
          disabled={!decision || !rationale || chairBlocked || submitMutation.isPending}
          className="w-full"
          data-testid="button-submit-review"
        >
          {submitMutation.isPending ? "Submitting..." : "Submit Review"}
        </Button>
      </CardContent>
    </Card>
  );
}
