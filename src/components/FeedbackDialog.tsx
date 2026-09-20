"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const pathname = usePathname();
  const t = useTranslations("feedback");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      setMessage("");
      setSent(true);
    },
    onError: () => {
      // keep form visible so user can retry
    },
  });

  function handleClose(value: boolean) {
    if (!value) {
      setSent(false);
      submit.reset();
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-lg font-medium">{t("sentTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("sentBody")}</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
            </DialogHeader>
            {submit.isError && (
              <p className="text-sm text-destructive">{t("error")}</p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate({ message, page: pathname ?? undefined });
              }}
              className="space-y-4"
            >
              <Textarea
                placeholder={t("placeholder")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={!message.trim() || submit.isPending}
                >
                  {submit.isPending ? t("sending") : t("submit")}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
