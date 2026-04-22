import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Target, DollarSign, ShieldCheck } from "lucide-react";
import type { Platform } from "@shared/schema";
import { ToolInsightsFeed } from "@/components/tool-insights-feed";
import { VendorQuestionnaire } from "@/components/vendor-questionnaire";
import { SectionAttachments } from "@/components/section-attachments";
import type { RequestAttachmentSection } from "@shared/schema";

const SECTION_KEYS: RequestAttachmentSection[] = ["basics", "strategic", "technical", "security"];

export const sections = [
  { title: "The Basics", icon: User, description: "Basic information about the tool request" },
  { title: "Strategic Fit & Use Case", icon: Target, description: "How this tool fits your workflow" },
  { title: "Technical & Financial", icon: DollarSign, description: "Compatibility and cost details" },
  { title: "Security & Data Privacy", icon: ShieldCheck, description: "Data handling and security" },
];

export const defaultFormData = {
  requesterName: "",
  department: "",
  toolName: "",
  primaryGoal: "",
  estimatedUsers: "individual",
  estimatedUsersCount: "",
  division: "",
  toolCategory: [] as string[],
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
  vendorPacketAcknowledged: false,
};

export type RequestFormData = typeof defaultFormData;

interface RequestFormSectionsProps {
  formData: RequestFormData;
  updateField: (field: string, value: any) => void;
  toggleArrayField: (field: string, value: string) => void;
  step: number;
  setStep: (s: number) => void;
  user: { role: string } | null | undefined;
  platforms?: Platform[];
  mode: "create" | "edit";
  existingRequestId?: string | null;
  existingVendorToken?: string | null;
  existingVendorCompleted?: boolean;
  onSaveDraft?: () => Promise<string | null>;
}

export function RequestFormSections({
  formData,
  updateField,
  toggleArrayField,
  step,
  setStep,
  user,
  platforms,
  mode,
  existingRequestId,
  existingVendorToken,
  existingVendorCompleted,
  onSaveDraft,
}: RequestFormSectionsProps) {
  const existingToolNames = platforms?.map(p => p.toolName) || [];
  const filteredSuggestions = formData.toolName.length > 1
    ? existingToolNames.filter(n => n.toLowerCase().includes(formData.toolName.toLowerCase()))
    : [];

  return (
    <>
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
        <div className="w-full lg:w-[300px] shrink-0">
          <div className="border rounded-lg bg-card shadow-sm overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)]">
            <ToolInsightsFeed toolName={formData.toolName} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    {(() => { const Icon = sections[step].icon; return <Icon className="h-5 w-5" />; })()}
                    {sections[step].title}
                  </CardTitle>
                  <CardDescription>{sections[step].description}</CardDescription>
                </div>
                <SectionAttachments
                  section={SECTION_KEYS[step]}
                  requestId={existingRequestId}
                  onEnsureRequestId={mode === "create" ? onSaveDraft : undefined}
                />
              </div>
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
                    <Label>Tool Type / Category * <span className="text-xs text-muted-foreground">(select all that apply)</span></Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "productivity", label: "Productivity & Workflow" },
                        { value: "analytics", label: "Analytics & Reporting" },
                        { value: "creative", label: "Creative & Content Generation" },
                        { value: "agentic", label: "Agentic & AI Automation" },
                        { value: "communication", label: "Communication & Collaboration" },
                        { value: "data_management", label: "Data Management & Integration" },
                        { value: "developer_tools", label: "Developer & Engineering Tools" },
                        { value: "security", label: "Security & Compliance" },
                        { value: "customer_experience", label: "Customer Experience" },
                        { value: "hr_people_ops", label: "HR & People Operations" },
                        { value: "marketing_adtech", label: "Marketing & Adtech" },
                        { value: "finance", label: "Finance & Budgeting" },
                        { value: "other", label: "Other" },
                      ].map(({ value, label }) => (
                        <div key={value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`cat-${value}`}
                            checked={formData.toolCategory.includes(value)}
                            onCheckedChange={() => {
                              if (value === "other" && formData.toolCategory.includes("other")) {
                                updateField("toolCategoryOther", "");
                              }
                              toggleArrayField("toolCategory", value);
                            }}
                            data-testid={`checkbox-tool-category-${value}`}
                          />
                          <label htmlFor={`cat-${value}`} className="text-sm cursor-pointer">{label}</label>
                        </div>
                      ))}
                    </div>
                    {formData.toolCategory.includes("other") && (
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
                    <Label>Vendor Security Packet Acknowledgment *</Label>
                    <div className="flex items-start gap-2 p-3 rounded-md border">
                      <Checkbox
                        checked={formData.vendorPacketAcknowledged}
                        onCheckedChange={v => updateField("vendorPacketAcknowledged", v)}
                        id="vendor-packet"
                        data-testid="checkbox-vendor-packet"
                        className="mt-0.5"
                      />
                      <Label htmlFor="vendor-packet" className="text-sm leading-relaxed">
                        I confirm I have sent the Vendor Security Packet to my vendor and will attach their completed responses before this form is submitted
                      </Label>
                    </div>
                  </div>

                  <VendorQuestionnaire
                    requestId={existingRequestId}
                    vendorToken={existingVendorToken}
                    vendorCompleted={existingVendorCompleted}
                    division={formData.division}
                    onSaveDraft={mode === "create" ? onSaveDraft : undefined}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
