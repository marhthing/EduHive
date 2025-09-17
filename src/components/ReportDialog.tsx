
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId?: string;
  commentId?: string;
  reportedUserId?: string;
  type: 'post' | 'comment';
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or Bullying' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'violence', label: 'Violence or Threats' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'copyright', label: 'Copyright Violation' },
  { value: 'other', label: 'Other' }
];

export function ReportDialog({ 
  open, 
  onOpenChange, 
  postId, 
  commentId, 
  reportedUserId, 
  type 
}: ReportDialogProps) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason) {
      toast({
        title: "Error",
        description: "Please select a reason for reporting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to report content.",
          variant: "destructive",
        });
        return;
      }

      const reportData = {
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        reason,
        description: description.trim() || null,
        ...(type === 'post' ? { post_id: postId } : { comment_id: commentId })
      };

      const { error } = await supabase
        .from('reports')
        .insert([reportData]);

      if (error) {
        console.error('Error submitting report:', error);
        toast({
          title: "Error",
          description: "Failed to submit report. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Report Submitted",
        description: "Thank you for your report. We'll review it shortly.",
      });

      // Reset form and close dialog
      setReason('');
      setDescription('');
      onOpenChange(false);

    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {type === 'post' ? 'Post' : 'Comment'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Reason for reporting:</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="mt-2">
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="text-sm">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Additional details (optional):
            </Label>
            <Textarea
              id="description"
              placeholder="Provide additional context about your report..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
