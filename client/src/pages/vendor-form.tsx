import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { getFilteredQuestions } from "@shared/vendor-questions";

export default function VendorFormPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestInfo, setRequestInfo] = useState<{ toolName: string; requesterName: string; division: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/vendor-form/${token}`)
      .then(res => {
        if (!res.ok) throw new Error("Invalid or expired link");
        return res.json();
      })
      .then(data => {
        if (data.completed) {
          setSubmitted(true);
        }
        setRequestInfo(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/vendor-form/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Submission failed");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredIds = new Set(getFilteredQuestions(requestInfo?.division).map(q => q.id));
  const answeredCount = Object.entries(answers).filter(([id, a]) => filteredIds.has(id) && a.trim()).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !requestInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-lg font-bold">Link Unavailable</h2>
            <p className="text-sm text-gray-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="text-lg font-bold">Thank You!</h2>
            <p className="text-sm text-gray-500">
              Your security questionnaire responses have been submitted successfully and are now attached to the request for <strong>{requestInfo?.toolName}</strong>.
            </p>
            <p className="text-xs text-gray-400">You may close this window.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtered = getFilteredQuestions(requestInfo?.division);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-600 text-white mb-2">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Entravision — Vendor Security Questionnaire</h1>
          <p className="text-sm text-gray-500">
            Requested for: <strong>{requestInfo?.toolName}</strong> by {requestInfo?.requesterName}
          </p>
          <p className="text-xs text-gray-400">
            Please answer each question below with as much detail as possible, then click Submit at the bottom.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Questions */}
        <div className="space-y-4">
          {filtered.map((q, i) => (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {i + 1}. {q.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-gray-600 leading-relaxed">{q.question}</p>
                <Textarea
                  value={answers[q.id] || ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Enter your response..."
                  rows={3}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submit */}
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {answeredCount} of {filtered.length} questions answered
              </p>
              <Button onClick={handleSubmit} disabled={submitting || answeredCount === 0} size="lg">
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Submit Responses</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400">
          Entravision Communications Corporation — AI Governance & Risk Management<br />
          This questionnaire is confidential and intended solely for the named vendor.
        </p>
      </div>
    </div>
  );
}
