"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Shield, Clock, CheckCircle2, Circle, Loader2, AlertTriangle, XCircle, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DSARStatus, DSARType } from "@prisma/client";

const TIMELINE_STEP_KEYS: { key: DSARStatus; tKey: string }[] = [
  { key: "SUBMITTED", tKey: "submitted" },
  { key: "IDENTITY_VERIFIED", tKey: "identityVerified" },
  { key: "IN_PROGRESS", tKey: "inProgress" },
  { key: "DATA_COLLECTED", tKey: "dataCollected" },
  { key: "COMPLETED", tKey: "completed" },
];

const STATUS_ORDER: DSARStatus[] = [
  "SUBMITTED",
  "IDENTITY_PENDING",
  "IDENTITY_VERIFIED",
  "IN_PROGRESS",
  "DATA_COLLECTED",
  "REVIEW_PENDING",
  "APPROVED",
  "COMPLETED",
];

const FINAL_STATES: DSARStatus[] = ["COMPLETED", "REJECTED", "CANCELLED"];

function computeProgress(status: DSARStatus): number {
  if (status === "REJECTED" || status === "CANCELLED") return 100;
  const idx = STATUS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STATUS_ORDER.length) * 100);
}

export default function DSARStatusPage() {
  const params = useParams();
  const token = params.token as string;
  const t = useTranslations("dsarPublic.status");

  const utils = trpc.useUtils();
  const { data: request, isLoading, error } = trpc.dsar.checkStatus.useQuery(
    { publicId: token },
    { retry: false, enabled: !!token }
  );

  const withdraw = trpc.dsar.withdrawPublic.useMutation({
    onSuccess: () => {
      utils.dsar.checkStatus.invalidate({ publicId: token });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>{t("loadingError.title")}</CardTitle>
            <CardDescription>{t("loadingError.description")}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">{t("loadingError.hint")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = computeProgress(request.status);
  const isFailed = request.status === "REJECTED" || request.status === "CANCELLED";
  const isDone = request.status === "COMPLETED";
  const canWithdraw = !FINAL_STATES.includes(request.status);

  const dueDate = new Date(request.dueDate);
  const now = new Date();
  const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const pastDue = daysRemaining < 0 && !isDone && !isFailed;

  return (
    <div className="min-h-screen bg-muted/50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-end mb-2 text-xs text-muted-foreground">
          <LanguageSwitcher />
        </div>
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">{t("header.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {request.organization?.name
              ? t("header.trackingDescription", {
                  requestType: t(`typeLabels.${request.type}`).toLowerCase(),
                  orgName: request.organization.name,
                })
              : t("header.fallbackDescription")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="font-mono text-base sm:text-lg break-all">{request.publicId}</CardTitle>
                <CardDescription>{t(`typeLabels.${request.type}`)}</CardDescription>
              </div>
              <Badge variant={isFailed ? "destructive" : "outline"} className="shrink-0 w-fit">
                {request.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("overallProgress")}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {!isFailed && (
              <div className="space-y-4">
                {TIMELINE_STEP_KEYS.map((step, index) => {
                  const stepIdx = STATUS_ORDER.indexOf(step.key);
                  const currentIdx = STATUS_ORDER.indexOf(request.status);
                  const completed = stepIdx < currentIdx || isDone;
                  const current = step.key === request.status;
                  return (
                    <div key={step.key} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          completed ? "bg-primary/10" : current ? "bg-primary/20" : "bg-muted"
                        }`}>
                          {completed ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : (
                            <Circle className={`w-4 h-4 ${current ? "text-primary" : "text-muted-foreground"}`} />
                          )}
                        </div>
                        {index < TIMELINE_STEP_KEYS.length - 1 && (
                          <div className={`w-0.5 h-8 mt-1 ${completed ? "bg-primary/30" : "bg-muted"}`} />
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className={`font-medium ${
                          current ? "text-primary" : completed ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {t(`timeline.${step.tKey}`)}
                        </p>
                        {current && (
                          <p className="text-sm text-muted-foreground">{t("currentlyProcessing")}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isFailed && (
              <div className="p-4 bg-destructive/10 rounded-lg text-sm text-destructive">
                {request.status === "REJECTED" ? t("rejectedNotice") : t("cancelledNotice")}
              </div>
            )}

            <div className={`flex items-center justify-between p-4 rounded-lg ${pastDue ? "bg-destructive/10" : "bg-muted"}`}>
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${pastDue ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-sm">{t("expectedCompletion")}</span>
              </div>
              <div className="text-right">
                <p className="font-medium">{dueDate.toLocaleDateString()}</p>
                <p className={`text-xs ${pastDue ? "text-destructive" : "text-muted-foreground"}`}>
                  {isDone
                    ? t("completedLabel")
                    : pastDue
                      ? t("daysOverdue", { count: Math.abs(daysRemaining) })
                      : t("daysRemaining", { count: daysRemaining })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isDone && request.responseUrl && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{t("download.title")}</CardTitle>
                  <CardDescription>{t("download.description")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full sm:w-auto">
                <a href={request.responseUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  {t("download.download")}
                </a>
              </Button>
              {request.responseExpiresAt && (
                <p className="text-xs text-muted-foreground">
                  {t("download.expiresOn", {
                    date: new Date(request.responseExpiresAt).toLocaleDateString(),
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("keyDates")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("requestReceived")}</span>
              <span>{new Date(request.receivedAt).toLocaleDateString()}</span>
            </div>
            {request.acknowledgedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("acknowledged")}</span>
                <span>{new Date(request.acknowledgedAt).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("expectedCompletion")}</span>
              <span>{dueDate.toLocaleDateString()}</span>
            </div>
            {request.completedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("completedDate")}</span>
                <span>{new Date(request.completedAt).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {canWithdraw && (
          <div className="flex justify-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <XCircle className="w-4 h-4 mr-2" />
                  {t("withdraw.button")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("withdraw.dialogTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("withdraw.dialogDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("withdraw.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => withdraw.mutate({ publicId: token })}
                    disabled={withdraw.isPending}
                  >
                    {withdraw.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {t("withdraw.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}
