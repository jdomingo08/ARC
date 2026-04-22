import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  Loader2,
} from "lucide-react";
import type { Platform, Request } from "@shared/schema";
import { RequestFormSections, sections, defaultFormData } from "@/components/request-form-sections";

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
        toolCategory: (existingDraft as any).toolCategory || [],
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
        vendorPacketAcknowledged: (existingDraft as any).vendorPacketAcknowledged || false,
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

  // Save draft and return the ID (for vendor link generation)
  const saveDraftAndReturnId = useCallback(async (): Promise<string | null> => {
    if (draftId) return draftId;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    try {
      const payload = {
        ...formDataRef.current,
        estimatedUsersCount: formDataRef.current.estimatedUsersCount ? parseInt(formDataRef.current.estimatedUsersCount) : null,
        annualCost: formDataRef.current.annualCost || null,
      };
      const res = await apiRequest("POST", "/api/requests/draft", payload);
      const saved = await res.json();
      setDraftId(saved.id);
      window.history.replaceState(null, "", `/requests/new?draft=${saved.id}`);
      setLastSaved(new Date());
      return saved.id;
    } catch {
      return null;
    }
  }, [draftId]);

  // Clean up auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, []);

  const canSubmit = () => {
    return formData.requesterName && formData.department && formData.toolName && formData.primaryGoal
      && formData.division && formData.toolCategory.length > 0
      && (!formData.toolCategory.includes("other") || formData.toolCategoryOther)
      && formData.alreadyInUse && formData.authorizedRequestor
      && formData.trainingPlan && formData.aiPolicyAcknowledged
      && formData.useCaseType && formData.impactLevel
      && formData.vendorPacketAcknowledged;
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

        <RequestFormSections
          formData={formData}
          updateField={updateField}
          toggleArrayField={toggleArrayField}
          step={step}
          setStep={setStep}
          user={user}
          platforms={platforms}
          mode="create"
          existingRequestId={draftId}
          existingVendorToken={(existingDraft as any)?.vendorQuestionnaireToken}
          existingVendorCompleted={(existingDraft as any)?.vendorQuestionnaireCompleted}
          onSaveDraft={saveDraftAndReturnId}
        />

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
  );
}
