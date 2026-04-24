import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Paperclip, Upload, Download, Trash2, Loader2 } from "lucide-react";
import type { RequestAttachment, RequestAttachmentSection } from "@shared/schema";

interface SectionAttachmentsProps {
  section: RequestAttachmentSection;
  requestId?: string | null;
  onEnsureRequestId?: () => Promise<string | null>;
  readOnly?: boolean;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function SectionAttachments({ section, requestId, onEnsureRequestId, readOnly }: SectionAttachmentsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: allAttachments } = useQuery<RequestAttachment[]>({
    queryKey: ["/api/requests", requestId, "attachments"],
    enabled: !!requestId,
  });

  const sectionAttachments = (allAttachments || []).filter(a => a.section === section);
  const count = sectionAttachments.length;

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiRequest("DELETE", `/api/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", requestId, "attachments"] });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleUpload = async (file: File) => {
    let targetId = requestId;
    if (!targetId && onEnsureRequestId) {
      targetId = await onEnsureRequestId();
    }
    if (!targetId) {
      toast({
        title: "Cannot upload yet",
        description: "Fill out at least one field to create the draft first.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("section", section);
      const res = await fetch(`/api/requests/${targetId}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Supporting document uploaded" });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", targetId, "attachments"] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const label = count > 0 ? `Supporting Docs (${count})` : "Supporting Docs";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-7 px-2 text-xs font-medium shrink-0"
          data-testid={`button-section-docs-${section}`}
        >
          <Paperclip className="h-3 w-3 mr-1" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Supporting Documentation</p>
            <p className="text-xs text-muted-foreground">Optional files reviewers can see for this section.</p>
          </div>

          {sectionAttachments.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-auto">
              {sectionAttachments.map(a => (
                <div key={a.id} className="flex items-center justify-between border rounded-md p-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.fileName}</p>
                      <p className="text-muted-foreground">{formatFileSize(a.fileSize)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => window.open(`/api/attachments/${a.id}/download`, "_blank")}
                      data-testid={`button-download-${a.id}`}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteMutation.mutate(a.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${a.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">No files uploaded for this section yet.</p>
          )}

          {!readOnly && (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-testid={`button-upload-section-${section}`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 mr-1" /> Upload File
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
