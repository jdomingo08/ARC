import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRoute, useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Save, Loader2, ArrowLeft, X } from "lucide-react";
import type { Platform, Request } from "@shared/schema";
import { RequestFormSections, sections, defaultFormData } from "@/components/request-form-sections";

export default function EditRequestPage() {
  const [, params] = useRoute("/requests/:id/edit");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const id = params?.id;

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(defaultFormData);
  const [hydrated, setHydrated] = useState(false);

  const { data: platforms } = useQuery<Platform[]>({ queryKey: ["/api/platforms"] });

  const { data: request, isLoading } = useQuery<Request>({
    queryKey: ["/api/requests", id],
    enabled: !!id,
  });

  // Admin-only guard
  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation(`/requests/${id}`);
    }
  }, [user, id, setLocation]);

  // Hydrate form from the loaded request (no status gate)
  useEffect(() => {
    if (request && !hydrated) {
      setFormData({
        requesterName: request.requesterName || "",
        department: request.department || "",
        toolName: request.toolName || "",
        primaryGoal: request.primaryGoal || "",
        estimatedUsers: request.estimatedUsers || "individual",
        estimatedUsersCount: request.estimatedUsersCount?.toString() || "",
        division: (request as any).division || "",
        toolCategory: (request as any).toolCategory || [],
        toolCategoryOther: (request as any).toolCategoryOther || "",
        alreadyInUse: (request as any).alreadyInUse || "new_request",
        authorizedRequestor: (request as any).authorizedRequestor || false,
        trainingPlan: (request as any).trainingPlan || "",
        trainingPlanDetails: (request as any).trainingPlanDetails || "",
        aiPolicyAcknowledged: (request as any).aiPolicyAcknowledged || false,
        useCaseType: (request as any).useCaseType || "",
        workflowIntegration: request.workflowIntegration || "",
        alternativesChecked: request.alternativesChecked || false,
        alternativesText: request.alternativesText || "",
        impactLevel: request.impactLevel || "medium",
        compatibility: request.compatibility || [],
        compatibilityNotes: request.compatibilityNotes || "",
        costStructure: request.costStructure || "",
        annualCost: request.annualCost?.toString() || "",
        costNotes: (request as any).costNotes || "",
        budgetOwner: (request as any).budgetOwner || "",
        costCenter: (request as any).costCenter || "",
        tierAssignment: (request as any).tierAssignment || "",
        vendorPacketAcknowledged: (request as any).vendorPacketAcknowledged || false,
      });
      setHydrated(true);
    }
  }, [request, hydrated]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field: string, value: string) => {
    setFormData(prev => {
      const arr = (prev as any)[field] as string[];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        estimatedUsersCount: formData.estimatedUsersCount ? parseInt(formData.estimatedUsersCount) : null,
        annualCost: formData.annualCost || null,
      };
      const res = await apiRequest("PATCH", `/api/requests/${id}/admin-edit`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit", "request", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      setLocation(`/requests/${id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (request?.status === "approved" || request?.status === "rejected") {
      const proceed = window.confirm(
        `This request is already ${request.status}. Editing it will not re-open the review workflow, but the changes will be logged. Save anyway?`
      );
      if (!proceed) return;
    }
    updateMutation.mutate();
  };

  const progress = ((step + 1) / sections.length) * 100;

  if (isLoading || !hydrated) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Request not found</p>
        <Link href="/requests"><Button variant="outline" className="mt-4">Back to Requests</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href={`/requests/${id}`}>
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Request
          </Button>
        </Link>
      </div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-edit-request-title">
              Edit Full Request
            </h1>
            <p className="text-muted-foreground mt-1">
              Admin edit — status will remain <span className="font-medium">{request.status.replace(/_/g, " ")}</span>. Changes are logged to the activity timeline.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
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
          mode="edit"
          existingRequestId={id}
          existingVendorToken={(request as any).vendorQuestionnaireToken}
          existingVendorCompleted={(request as any).vendorQuestionnaireCompleted}
        />

        <div className="flex items-center justify-between gap-2 mt-4">
          <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} data-testid="button-prev-step">
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setLocation(`/requests/${id}`)}
              disabled={updateMutation.isPending}
              data-testid="button-cancel-edit"
            >
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            {step < sections.length - 1 && (
              <Button variant="outline" onClick={() => setStep(s => s + 1)} data-testid="button-next-step">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              <Save className="h-4 w-4 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
