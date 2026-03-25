"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("experts.contact");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(session?.user?.name ?? "");
  const [email, setEmail] = useState(session?.user?.email ?? "");

  // Sync with session when it loads (async)
  useEffect(() => {
    if (session?.user?.name && !name) setName(session.user.name);
    if (session?.user?.email && !email) setEmail(session.user.email);
  }, [session?.user?.name, session?.user?.email]);
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
            <DialogTitle className="text-lg">{t("requestSent")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("requestSentBody", { name: expertName })}
            </p>
            <Button variant="outline" onClick={handleClose} className="mt-2">
              {tCommon("close")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {t("title", { name: expertName })}
              </DialogTitle>
              <DialogDescription>
                {t("description")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name" className="text-xs">{t("nameLabel")}</Label>
                  <Input
                    id="contact-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-email" className="text-xs">{t("emailLabel")}</Label>
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
                <Label htmlFor="contact-company" className="text-xs">{t("companyLabel")}</Label>
                <Input
                  id="contact-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-subject" className="text-xs">{t("subjectLabel")}</Label>
                <Input
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("subjectPlaceholder")}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-message" className="text-xs">{t("messageLabel")}</Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("messagePlaceholder")}
                  rows={3}
                />
              </div>
              {contactMutation.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <p className="text-xs text-destructive">
                    {t("errorMessage")}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={contactMutation.isPending || !name || !email || !subject}
                >
                  {contactMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {t("sendRequest")}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
