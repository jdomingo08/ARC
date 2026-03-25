import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
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
  Save,
  Loader2,
} from "lucide-react";
import type { Platform, Request } from "@shared/schema";
import { ToolInsightsFeed } from "@/components/tool-insights-feed";

const sections = [
  { title: "The Basics", icon: User, description: "Basic information about the tool request" },
  { title: "Strategic Fit & Use Case", icon: Target, description: "How this tool fits your workflow" },
  { title: "Technical & Financial", icon: DollarSign, description: "Compatibility and cost details" },
  { title: "Security & Data Privacy", icon: ShieldCheck, description: "Data handling and security" },
];

const defaultFormData = {
  requesterName: "",
  department: "",
  toolName: "",
  primaryGoal: "",
  estimatedUsers: "individual",
  estimatedUsersCount: "",
  division: "",
  toolCategory: "",
  toolCategoryOther: "",
  alreadyInUse: "new_request",
  authorizedRequestor: false,
  trainingPlan: "",
  trainingPlanDetails: "",
  aiPolicyAcknowledged: false,
  useCaseType: "",
  workflowIntegration: "",
  alternativesChecked: false,
  alternativesText: "",
  impactLevel: "medium",
  compatibility: [] as string[],
  compatibilityNotes: "",
  costStructure: "",
  annualCost: "",
  costNotes: "",
  budgetOwner: "",
  costCenter: "",
  tierAssignment: "",
  dataInput: [] as string[],
  dataInputNotes: "",
  dataTraining: "unsure",
  loginMethod: "SSO",
};

export default function NewRequestPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();
  const formDataRef = useRef(defaultFormData);

  const { data: platforms } = useQuery<Platform[]>({ queryKey: ["/api/platforms"] });

  // Parse draft ID from URL
  const draftParam = new URLSearchParams(search).get("draft");

  // Load existing draft
  const { data: existingDraft, isLoading: isDraftLoading } = useQuery<Request>({
    queryKey: ["/api/requests", draftParam],
    enabled: !!draftParam,
  });

  const [formData, setFormData] = useState({
    ...defaultFormData,
    requesterName: user?.name || "",
    department: user?.department || "",
  });

  // Populate form when draft loads
  useEffect(() => {
    if (existingDraft && existingDraft.status === "draft") {
      setDraftId(existingDraft.id);
      setFormData({
        requesterName: existingDraft.requesterName || user?.name || "",
        department: existingDraft.department || user?.department || "",
        toolName: existingDraft.toolName || "",
        primaryGoal: existingDraft.primaryGoal || "",
        estimatedUsers: existingDraft.estimatedUsers || "individual",
        estimatedUsersCount: existingDraft.estimatedUsersCount?.toString() || "",
        division: (existingDraft as any).division || "",
        toolCategory: (existingDraft as any).toolCategory || "",
        toolCategoryOther: (existingDraft as any).toolCategoryOther || "",
        alreadyInUse: (existingDraft as any).alreadyInUse || "new_request",
        authorizedRequestor: (existingDraft as any).authorizedRequestor || false,
        trainingPlan: (existingDraft as any).trainingPlan || "",
        trainingPlanDetails: (existingDraft as any).trainingPlanDetails || "",
        aiPolicyAcknowledged: (existingDraft as any).aiPolicyAcknowledged || false,
        useCaseType: (existingDraft as any).useCaseType || "",
        workflowIntegration: existingDraft.workflowIntegration || "",
        alternativesChecked: existingDraft.alternativesChecked || false,
        alternativesText: existingDraft.alternativesText || "",
        impactLevel: existingDraft.impactLevel || "medium",
        compatibility: existingDraft.compatibility || [],
        compatibilityNotes: existingDraft.compatibilityNotes || "",
        costStructure: existingDraft.costStructure || "",
        annualCost: existingDraft.annualCost?.toString() || "",
        costNotes: (existingDraft as any).costNotes || "",
        budgetOwner: (existingDraft as any).budgetOwner || "",
        costCenter: (existingDraft as any).costCenter || "",
        tierAssignment: (existingDraft as any).tierAssignment || "",
        dataInput: existingDraft.dataInput || [],
        dataInputNotes: existingDraft.dataInputNotes || "",
        dataTraining: existingDraft.dataTraining || "unsure",
        loginMethod: existingDraft.loginMethod || "SSO",
      });
    }
  }, [existingDraft]);

  // Auto-save draft (debounced 3 seconds after last change)
  const saveDraft = useCallback(async (data: typeof defaultFormData, currentDraftId: string | null) => {
    setIsSaving(true);
    try {
      const payload = {
        ...data,
        draftId: currentDraftId,
        estimatedUsersCount: data.estimatedUsersCount ? parseInt(data.estimatedUsersCount) : null,
        annualCost: data.annualCost || null,
      };
      const res = await apiRequest("POST", "/api/requests/draft", payload);
      const saved = await res.json();
      if (!currentDraftId) {
        setDraftId(saved.id);
        // Update URL without full navigation
        window.history.replaceState(null, "", `/requests/new?draft=${saved.id}`);
      }
      setLastSaved(new Date());
    } catch {
      // Silent fail for auto-save
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateField = (field: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      formDataRef.current = next;

      // Trigger auto-save
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        saveDraft(formDataRef.current, draftId);
      }, 3000);

      return next;
    });
  };

  const toggleArrayField = (field: string, value: string) => {
    setFormData(prev => {
      const arr = (prev as any)[field] as string[];
      const next = { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
      formDataRef.current = next;

      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        saveDraft(formDataRef.current, draftId);
      }, 3000);

      return next;
    });
  };

  // Keep draftId ref in sync for auto-save closure
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Manual save draft
  const handleSaveDraft = () => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    saveDraft(formData, draftId);
  };

  // Clean up auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, []);

  const canSubmit = () => {
    return formData.requesterName && formData.department && formData.toolName && formData.primaryGoal
      && formData.division && formData.toolCategory
      && (formData.toolCategory !== "other" || formData.toolCategoryOther)
      && formData.alreadyInUse && formData.authorizedRequestor
      && formData.trainingPlan && formData.aiPolicyAcknowledged
      && formData.useCaseType && formData.impactLevel
      && formData.dataInput.length > 0 && formData.loginMethod;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      const payload = {
        ...formData,
        draftId,
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

  const progress = ((step + 1) / sections.length) * 100;

  const existingToolNames = platforms?.map(p => p.toolName) || [];
  const filteredSuggestions = formData.toolName.length > 1
    ? existingToolNames.filter(n => n.toLowerCase().includes(formData.toolName.toLowerCase()))
    : [];

  if (draftParam && isDraftLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-new-request-title">
              {draftId ? "Continue Draft Request" : "New AI Tool Request"}
            </h1>
            <p className="text-muted-foreground mt-1">Submit a request for AI tool evaluation and approval</p>
          </div>
          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-muted-foreground">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {isSaving && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSaving} data-testid="button-save-draft">
              <Save className="h-4 w-4 mr-1" /> Save Draft
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Step Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Step {step + 1} of {sections.length}</span>
            <span className="text-muted-foreground">{sections[step].title}</span>
          </div>
          <Progress value={progress} className="h-2" data-testid="progress-form" />
        </div>

        {/* Step Tabs */}
        <div className="flex gap-2 flex-wrap">
          {sections.map((s, i) => (
            <Button
              key={i}
              variant={i === step ? "default" : "outline"}
              size="sm"
              onClick={() => setStep(i)}
              data-testid={`button-step-${i}`}
            >
              <s.icon className="h-3 w-3 mr-1" />
              {s.title}
            </Button>
          ))}
        </div>

        {/* Inline Row: AI Insights + Form Card */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* AI Insights Feed */}
          <div className="w-full lg:w-[300px] shrink-0">
            <div className="border rounded-lg bg-card shadow-sm overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)]">
              <ToolInsightsFeed toolName={formData.toolName} />
            </div>
          </div>

          {/* Form Card */}
          <div className="flex-1 min-w-0">
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

                  <div className="space-y-2">
                    <Label>Division *</Label>
                    <Select value={formData.division} onValueChange={v => updateField("division", v)}>
                      <SelectTrigger data-testid="select-division"><SelectValue placeholder="Select division" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us_markets">US Markets</SelectItem>
                        <SelectItem value="ats_international">ATS International</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tool Type / Category *</Label>
                    <Select value={formData.toolCategory} onValueChange={v => { updateField("toolCategory", v); if (v !== "other") updateField("toolCategoryOther", ""); }}>
                      <SelectTrigger data-testid="select-tool-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="productivity">Productivity</SelectItem>
                        <SelectItem value="creative">Creative</SelectItem>
                        <SelectItem value="analytics">Analytics</SelectItem>
                        <SelectItem value="agentic">Agentic</SelectItem>
                        <SelectItem value="adtech">Adtech</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.toolCategory === "other" && (
                      <Input
                        value={formData.toolCategoryOther}
                        onChange={e => updateField("toolCategoryOther", e.target.value)}
                        placeholder="Describe the tool type or category"
                        data-testid="input-tool-category-other"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Already in use? *</Label>
                    <RadioGroup value={formData.alreadyInUse} onValueChange={v => updateField("alreadyInUse", v)} data-testid="radio-already-in-use">
                      <div className="flex items-center gap-2"><RadioGroupItem value="new_request" id="aiu-new" /><Label htmlFor="aiu-new">New Request</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="amnesty" id="aiu-amnesty" /><Label htmlFor="aiu-amnesty">Already In Use (Amnesty)</Label></div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Authorized Requestor Confirmation *</Label>
                    <div className="flex items-start gap-2 p-3 rounded-md border">
                      <Checkbox
                        checked={formData.authorizedRequestor}
                        onCheckedChange={v => updateField("authorizedRequestor", v)}
                        id="auth-requestor"
                        data-testid="checkbox-authorized-requestor"
                        className="mt-0.5"
                      />
                      <Label htmlFor="auth-requestor" className="text-sm leading-relaxed">
                        I am a designated decision-maker for my department or market
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Training Plan Confirmation *</Label>
                    <p className="text-xs text-muted-foreground">Will employees be trained before rollout? Who provides it?</p>
                    <RadioGroup value={formData.trainingPlan} onValueChange={v => updateField("trainingPlan", v)} data-testid="radio-training-plan">
                      <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="tp-yes" /><Label htmlFor="tp-yes">Yes — training is planned</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="no" id="tp-no" /><Label htmlFor="tp-no">No — not required for this tool type</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="unknown" id="tp-unknown" /><Label htmlFor="tp-unknown">Unknown</Label></div>
                    </RadioGroup>
                    {formData.trainingPlan === "yes" && (
                      <Textarea
                        value={formData.trainingPlanDetails}
                        onChange={e => updateField("trainingPlanDetails", e.target.value)}
                        placeholder="Describe the training plan (e.g., who provides it, timeline, format)"
                        data-testid="input-training-plan-details"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>AI Use Policy Acknowledgment *</Label>
                    <div className="flex items-start gap-2 p-3 rounded-md border">
                      <Checkbox
                        checked={formData.aiPolicyAcknowledged}
                        onCheckedChange={v => updateField("aiPolicyAcknowledged", v)}
                        id="ai-policy"
                        data-testid="checkbox-ai-policy"
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="ai-policy" className="text-sm leading-relaxed">
                          I have read and understand the{" "}
                          <a href="/ai-use-policy.pdf" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                            Entravision AI Use Policy
                          </a>
                        </Label>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label>Use Case Type *</Label>
                    <RadioGroup value={formData.useCaseType} onValueChange={v => updateField("useCaseType", v)} data-testid="radio-use-case-type">
                      <div className="flex items-center gap-2"><RadioGroupItem value="poc" id="uct-poc" /><Label htmlFor="uct-poc">POC (Proof of Concept)</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="pilot" id="uct-pilot" /><Label htmlFor="uct-pilot">Pilot</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="department_wide" id="uct-dept" /><Label htmlFor="uct-dept">Department-Wide</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="enterprise" id="uct-ent" /><Label htmlFor="uct-ent">Enterprise</Label></div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workflowIntegration">Workflow Integration</Label>
                    <Textarea id="workflowIntegration" value={formData.workflowIntegration} onChange={e => updateField("workflowIntegration", e.target.value)} placeholder="How will this tool integrate into your current workflow? Why did you choose this tool, and how will it benefit you and your team?" data-testid="input-workflow" />
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
                    <Label htmlFor="compatibilityNotes">Integration Requirements</Label>
                    <p className="text-xs text-muted-foreground">Does this tool need to work alongside other platforms or systems? Please describe.</p>
                    <Textarea id="compatibilityNotes" value={formData.compatibilityNotes} onChange={e => updateField("compatibilityNotes", e.target.value)} placeholder="Are there any platforms or systems that need to integrate with this tool?" data-testid="input-compat-notes" />
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
                  <div className="space-y-2">
                    <Label htmlFor="costNotes">Additional Cost Details</Label>
                    <Textarea id="costNotes" value={formData.costNotes} onChange={e => updateField("costNotes", e.target.value)} placeholder="Describe any other cost structure or estimates that cannot be captured above (e.g., usage-based pricing, tiered plans, implementation fees)" data-testid="input-cost-notes" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="budgetOwner">Budget Owner</Label>
                      <p className="text-xs text-muted-foreground">Who owns this budget line after approval?</p>
                      <Input id="budgetOwner" value={formData.budgetOwner} onChange={e => updateField("budgetOwner", e.target.value)} placeholder="e.g., John Smith" data-testid="input-budget-owner" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="costCenter">Cost Center</Label>
                      <p className="text-xs text-muted-foreground">Where should this cost be charged/allocated?</p>
                      <Input id="costCenter" value={formData.costCenter} onChange={e => updateField("costCenter", e.target.value)} placeholder="e.g., CC-4500 Marketing" data-testid="input-cost-center" />
                    </div>
                  </div>

                  {/* Reviewer/Admin-only section */}
                  {user && (user.role === "admin" || user.role === "reviewer" || user.role === "chair") && (
                    <>
                      <div className="border-t my-4" />
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Reviewer / Admin Only</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">This section is not visible to requesters</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tierAssignment">Tier Assignment</Label>
                          <Select value={formData.tierAssignment} onValueChange={v => updateField("tierAssignment", v)}>
                            <SelectTrigger data-testid="select-tier-assignment" className="bg-white dark:bg-background"><SelectValue placeholder="Select tier" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tier_0">Tier 0</SelectItem>
                              <SelectItem value="tier_1">Tier 1</SelectItem>
                              <SelectItem value="tier_2">Tier 2</SelectItem>
                              <SelectItem value="tier_3">Tier 3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}
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

          <div className="flex items-center justify-between gap-2 mt-4">
            <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} data-testid="button-prev-step">
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>

            <div className="flex items-center gap-2">
              {step < sections.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} data-testid="button-next-step">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit() || submitMutation.isPending} data-testid="button-submit-request">
                  <Send className="h-4 w-4 mr-1" />
                  {submitMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
