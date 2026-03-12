"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ExpertContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expertId: string;
  expertName: string;
}

export function ExpertContactDialog({
  open,
  onOpenChange,
  expertId,
  expertName,
}: ExpertContactDialogProps) {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const contactMutation = trpc.experts.contact.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    contactMutation.mutate({
      expertId,
      requesterName: name,
      requesterEmail: email,
      requesterCompany: company || undefined,
      subject,
      message: message || undefined,
    });
  }

  function handleClose() {
    onOpenChange(false);
    if (submitted) {
      // Reset form after closing success state
      setTimeout(() => {
        setSubject("");
        setMessage("");
        setCompany("");
        setSubmitted(false);
        contactMutation.reset();
      }, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
            <DialogTitle className="text-lg">Request Sent</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Your message has been sent to {expertName}. They&apos;ll respond directly to your email.
            </p>
            <Button variant="outline" onClick={handleClose} className="mt-2">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Contact {expertName}
              </DialogTitle>
              <DialogDescription>
                Send a message to this expert. They&apos;ll respond to your email directly.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name" className="text-xs">Name *</Label>
                  <Input
                    id="contact-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-email" className="text-xs">Email *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-company" className="text-xs">Company</Label>
                <Input
                  id="contact-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-subject" className="text-xs">Subject *</Label>
                <Input
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., GDPR compliance consultation"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-message" className="text-xs">Message</Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Briefly describe what you need help with..."
                  rows={3}
                />
              </div>
              {contactMutation.error && (
                <p className="text-xs text-destructive">
                  {contactMutation.error.message}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={contactMutation.isPending || !name || !email || !subject}
                >
                  {contactMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Send Request
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
