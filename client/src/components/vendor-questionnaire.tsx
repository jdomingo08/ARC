import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Download,
  Link2,
  Check,
  Loader2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { vendorQuestions, formatQuestionsAsText, getFilteredQuestions } from "@shared/vendor-questions";

interface VendorQuestionnaireProps {
  requestId?: string | null;
  vendorToken?: string | null;
  vendorCompleted?: boolean;
  division?: string;
}

export function VendorQuestionnaire({ requestId, vendorToken, vendorCompleted, division }: VendorQuestionnaireProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(vendorToken || "");

  const filtered = getFilteredQuestions(division);

  const handleCopy = async () => {
    const text = formatQuestionsAsText(division);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied!", description: `${filtered.length} questions copied to clipboard.` });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `<!DOCTYPE html>
<html><head><title>Entravision Vendor Security Questionnaire</title>
<style>
  @media print { @page { margin: 1in; } }
  body { font-family: Arial, Helvetica, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; }
  .header { border-bottom: 3px solid #e11d48; padding-bottom: 16px; margin-bottom: 32px; }
  .header h1 { font-size: 22px; margin: 0 0 4px; color: #e11d48; }
  .header p { font-size: 12px; color: #666; margin: 0; }
  .question { margin-bottom: 28px; page-break-inside: avoid; }
  .question h3 { font-size: 13px; font-weight: 700; margin: 0 0 6px; color: #1a1a1a; }
  .question p { font-size: 12px; line-height: 1.5; margin: 0 0 8px; color: #333; }
  .question .note { font-size: 11px; color: #e11d48; font-style: italic; margin-bottom: 8px; }
  .answer-box { border: 1px solid #ccc; border-radius: 4px; min-height: 80px; padding: 8px; font-size: 12px; color: #999; }
  .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 16px; font-size: 11px; color: #888; text-align: center; }
</style></head><body>
<div class="header">
  <h1>ENTRAVISION — VENDOR SECURITY QUESTIONNAIRE</h1>
  <p>Please complete all applicable questions and return this document to the requestor.</p>
</div>
${filtered.map((q, i) => `
<div class="question">
  <h3>${i + 1}. ${q.title}</h3>
  <p>${q.question}</p>
  ${q.conditionalNote ? `<p class="note">${q.conditionalNote}</p>` : ""}
  <div class="answer-box">Vendor response:</div>
</div>`).join("")}
<div class="footer">
  <p>Entravision Communications Corporation — AI Governance &amp; Risk Management</p>
  <p>This questionnaire is confidential and intended solely for the vendor named above.</p>
</div>
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      if (!requestId) throw new Error("Save the request first");
      const res = await apiRequest("POST", `/api/requests/${requestId}/vendor-link`, { division });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedLink(data.token);
      toast({ title: "Vendor Link Generated", description: "Share this link with your vendor." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const vendorFormUrl = generatedLink
    ? `${window.location.origin}/vendor-form/${generatedLink}`
    : null;

  const handleCopyLink = async () => {
    if (vendorFormUrl) {
      await navigator.clipboard.writeText(vendorFormUrl);
      toast({ title: "Link Copied!", description: "Vendor form link copied to clipboard." });
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          Vendor Security Questionnaire
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Send these 17 security questions to your vendor. The vendor — not you — fills in the answers.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "Copied!" : "Copy All Questions"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-1" />
            Download PDF
          </Button>
        </div>

        {/* Secure vendor link */}
        <div className="border rounded-lg p-3 bg-white dark:bg-background space-y-2">
          <p className="text-sm font-medium flex items-center gap-1">
            <Link2 className="h-4 w-4" /> Send Secure Link to Vendor
          </p>
          <p className="text-xs text-muted-foreground">
            Generate a unique link your vendor can use to fill out the questionnaire online. Their responses will be automatically attached to this request.
          </p>

          {vendorCompleted && (
            <Badge variant="default" className="bg-green-600">Vendor has submitted responses</Badge>
          )}

          {!vendorFormUrl ? (
            <Button
              size="sm"
              onClick={() => generateLinkMutation.mutate()}
              disabled={generateLinkMutation.isPending || !requestId}
            >
              {generateLinkMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating...</>
              ) : (
                <><Link2 className="h-4 w-4 mr-1" /> Generate Vendor Link</>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                {vendorFormUrl}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Copy className="h-3 w-3" />
              </Button>
              <a href={vendorFormUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
          )}

          {!requestId && (
            <p className="text-xs text-amber-600">Save as draft first to generate a vendor link.</p>
          )}
        </div>

        {/* Questions preview (collapsed) */}
        <details className="border rounded-lg">
          <summary className="px-3 py-2 text-sm font-medium cursor-pointer hover:bg-muted/50">
            Preview all {filtered.length} questions
          </summary>
          <div className="px-3 pb-3 space-y-3">
            {filtered.map((q, i) => (
              <div key={q.id} className="text-xs space-y-1">
                <p className="font-semibold">{i + 1}. {q.title}</p>
                <p className="text-muted-foreground">{q.question}</p>
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
