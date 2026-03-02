import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  User,
  Target,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import type { Platform } from "@shared/schema";

const sections = [
  { title: "The Basics", icon: User, description: "Basic information about the tool request" },
  { title: "Strategic Fit & Use Case", icon: Target, description: "How this tool fits your workflow" },
  { title: "Technical & Financial", icon: DollarSign, description: "Compatibility and cost details" },
  { title: "Security & Data Privacy", icon: ShieldCheck, description: "Data handling and security" },
];

export default function NewRequestPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  const { data: platforms } = useQuery<Platform[]>({ queryKey: ["/api/platforms"] });

  const [formData, setFormData] = useState({
    requesterName: user?.name || "",
    department: user?.department || "",
    toolName: "",
    primaryGoal: "",
    estimatedUsers: "individual",
    estimatedUsersCount: "",
    workflowIntegration: "",
    alternativesChecked: false,
    alternativesText: "",
    impactLevel: "medium",
    compatibility: [] as string[],
    compatibilityNotes: "",
    costStructure: "",
    annualCost: "",
    dataInput: [] as string[],
    dataInputNotes: "",
    dataTraining: "unsure",
    loginMethod: "SSO",
  });

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field: string, value: string) => {
    setFormData(prev => {
      const arr = (prev as any)[field] as string[];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        estimatedUsersCount: formData.estimatedUsersCount ? parseInt(formData.estimatedUsersCount) : null,
        annualCost: formData.annualCost || null,
      };
      const res = await apiRequest("POST", "/api/requests", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Request Submitted", description: `Your request ${data.trackingId} has been created and is now pending review.` });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setLocation(`/requests/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const canProceed = () => {
    switch (step) {
      case 0: return formData.requesterName && formData.department && formData.toolName && formData.primaryGoal;
      case 1: return formData.impactLevel;
      case 2: return true;
      case 3: return formData.dataInput.length > 0 && formData.loginMethod;
      default: return false;
    }
  };

  const progress = ((step + 1) / sections.length) * 100;

  const existingToolNames = platforms?.map(p => p.toolName) || [];
  const filteredSuggestions = formData.toolName.length > 1
    ? existingToolNames.filter(n => n.toLowerCase().includes(formData.toolName.toLowerCase()))
    : [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-new-request-title">New AI Tool Request</h1>
        <p className="text-muted-foreground mt-1">Submit a request for AI tool evaluation and approval</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Step {step + 1} of {sections.length}</span>
          <span className="text-muted-foreground">{sections[step].title}</span>
        </div>
        <Progress value={progress} className="h-2" data-testid="progress-form" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {sections.map((s, i) => (
          <Button
            key={i}
            variant={i === step ? "default" : i < step ? "secondary" : "outline"}
            size="sm"
            onClick={() => i <= step && setStep(i)}
            disabled={i > step}
            data-testid={`button-step-${i}`}
          >
            <s.icon className="h-3 w-3 mr-1" />
            {s.title}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const Icon = sections[step].icon; return <Icon className="h-5 w-5" />; })()}
            {sections[step].title}
          </CardTitle>
          <CardDescription>{sections[step].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requesterName">Requester Name *</Label>
                  <Input id="requesterName" value={formData.requesterName} onChange={e => updateField("requesterName", e.target.value)} data-testid="input-requester-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input id="department" value={formData.department} onChange={e => updateField("department", e.target.value)} data-testid="input-department" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="toolName">Tool Name *</Label>
                <Input id="toolName" value={formData.toolName} onChange={e => updateField("toolName", e.target.value)} placeholder="e.g., ChatGPT Enterprise, Jasper AI" data-testid="input-tool-name" />
                {filteredSuggestions.length > 0 && (
                  <div className="border rounded-md p-1 mt-1 space-y-1">
                    {filteredSuggestions.map(s => (
                      <button key={s} onClick={() => updateField("toolName", s)} className="w-full text-left px-2 py-1 text-sm rounded hover-elevate" data-testid={`suggestion-${s}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryGoal">Primary Goal *</Label>
                <Textarea id="primaryGoal" value={formData.primaryGoal} onChange={e => updateField("primaryGoal", e.target.value)} placeholder="What do you want to accomplish with this tool?" data-testid="input-primary-goal" />
              </div>
              <div className="space-y-2">
                <Label>Estimated Number of Users *</Label>
                <RadioGroup value={formData.estimatedUsers} onValueChange={v => updateField("estimatedUsers", v)} data-testid="radio-estimated-users">
                  <div className="flex items-center gap-2"><RadioGroupItem value="individual" id="eu-ind" /><Label htmlFor="eu-ind">Individual</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="team" id="eu-team" /><Label htmlFor="eu-team">Team (5-20)</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="department" id="eu-dept" /><Label htmlFor="eu-dept">Department-wide (20+)</Label></div>
                </RadioGroup>
                <Input type="number" placeholder="Optional: exact number" value={formData.estimatedUsersCount} onChange={e => updateField("estimatedUsersCount", e.target.value)} data-testid="input-user-count" />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="workflowIntegration">Workflow Integration</Label>
                <Textarea id="workflowIntegration" value={formData.workflowIntegration} onChange={e => updateField("workflowIntegration", e.target.value)} placeholder="How will this tool integrate into your current workflow?" data-testid="input-workflow" />
              </div>
              <div className="space-y-3">
                <Label>Have you evaluated alternatives?</Label>
                <div className="flex items-center gap-2">
                  <Checkbox checked={formData.alternativesChecked} onCheckedChange={v => updateField("alternativesChecked", v)} id="alt-check" data-testid="checkbox-alternatives" />
                  <Label htmlFor="alt-check">Yes, I've looked at other tools</Label>
                </div>
                {formData.alternativesChecked && (
                  <Textarea value={formData.alternativesText} onChange={e => updateField("alternativesText", e.target.value)} placeholder="Which alternatives did you evaluate?" data-testid="input-alternatives-text" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Impact Level *</Label>
                <RadioGroup value={formData.impactLevel} onValueChange={v => updateField("impactLevel", v)} data-testid="radio-impact">
                  <div className="flex items-start gap-2 p-3 rounded-md border">
                    <RadioGroupItem value="high" id="imp-high" className="mt-0.5" />
                    <div><Label htmlFor="imp-high" className="font-medium">High Impact</Label><p className="text-xs text-muted-foreground">Saves 10+ hours/week or transforms a core workflow</p></div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-md border">
                    <RadioGroupItem value="medium" id="imp-med" className="mt-0.5" />
                    <div><Label htmlFor="imp-med" className="font-medium">Medium Impact</Label><p className="text-xs text-muted-foreground">Moderate productivity gains</p></div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-md border">
                    <RadioGroupItem value="low" id="imp-low" className="mt-0.5" />
                    <div><Label htmlFor="imp-low" className="font-medium">Low Impact</Label><p className="text-xs text-muted-foreground">Nice to have, minor improvements</p></div>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Platform Compatibility</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["outlook", "crm", "internal_dbs", "other"].map(c => (
                    <div key={c} className="flex items-center gap-2">
                      <Checkbox checked={formData.compatibility.includes(c)} onCheckedChange={() => toggleArrayField("compatibility", c)} id={`compat-${c}`} data-testid={`checkbox-compat-${c}`} />
                      <Label htmlFor={`compat-${c}`}>{c === "internal_dbs" ? "Internal DBs" : c === "crm" ? "CRM" : c.charAt(0).toUpperCase() + c.slice(1)}</Label>
                    </div>
                  ))}
                </div>
                <Textarea value={formData.compatibilityNotes} onChange={e => updateField("compatibilityNotes", e.target.value)} placeholder="Additional compatibility notes" data-testid="input-compat-notes" />
              </div>
              <div className="space-y-2">
                <Label>Cost Structure</Label>
                <Select value={formData.costStructure} onValueChange={v => updateField("costStructure", v)}>
                  <SelectTrigger data-testid="select-cost-structure"><SelectValue placeholder="Select cost structure" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly_subscription">Monthly Subscription</SelectItem>
                    <SelectItem value="per_seat">Per Seat</SelectItem>
                    <SelectItem value="one_time">One-time Purchase</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualCost">Total Estimated Annual Cost ($)</Label>
                <Input id="annualCost" type="number" min="0" step="0.01" value={formData.annualCost} onChange={e => updateField("annualCost", e.target.value)} placeholder="0.00" data-testid="input-annual-cost" />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Data Input Categories *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "public", label: "Public Data" },
                    { value: "client_data", label: "Client Data" },
                    { value: "pii", label: "PII" },
                    { value: "internal_financials", label: "Internal Financials" },
                    { value: "other", label: "Other" },
                  ].map(d => (
                    <div key={d.value} className="flex items-center gap-2">
                      <Checkbox checked={formData.dataInput.includes(d.value)} onCheckedChange={() => toggleArrayField("dataInput", d.value)} id={`data-${d.value}`} data-testid={`checkbox-data-${d.value}`} />
                      <Label htmlFor={`data-${d.value}`}>{d.label}</Label>
                    </div>
                  ))}
                </div>
                <Textarea value={formData.dataInputNotes} onChange={e => updateField("dataInputNotes", e.target.value)} placeholder="Additional notes about data handling" data-testid="input-data-notes" />
              </div>
              <div className="space-y-2">
                <Label>Does the vendor use your data for model training?</Label>
                <RadioGroup value={formData.dataTraining} onValueChange={v => updateField("dataTraining", v)} data-testid="radio-data-training">
                  <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="dt-yes" /><Label htmlFor="dt-yes">Yes</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="no" id="dt-no" /><Label htmlFor="dt-no">No</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="unsure" id="dt-unsure" /><Label htmlFor="dt-unsure">Unsure</Label></div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Login Method *</Label>
                <Select value={formData.loginMethod} onValueChange={v => updateField("loginMethod", v)}>
                  <SelectTrigger data-testid="select-login-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSO">SSO (Single Sign-On)</SelectItem>
                    <SelectItem value="email_password">Email + Password</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} data-testid="button-prev-step">
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>

        {step < sections.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} data-testid="button-next-step">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={() => submitMutation.mutate()} disabled={!canProceed() || submitMutation.isPending} data-testid="button-submit-request">
            <Send className="h-4 w-4 mr-1" />
            {submitMutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        )}
      </div>
    </div>
  );
}
