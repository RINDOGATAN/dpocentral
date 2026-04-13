"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Clock, CheckCircle2, Circle, Loader2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DSARStatus, DSARType } from "@prisma/client";

const TIMELINE_STEPS: { key: DSARStatus; label: string }[] = [
  { key: "SUBMITTED", label: "Submitted" },
  { key: "IDENTITY_VERIFIED", label: "Identity Verified" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "DATA_COLLECTED", label: "Data Collected" },
  { key: "COMPLETED", label: "Completed" },
];

const TYPE_LABELS: Record<DSARType, string> = {
  ACCESS: "Data Access Request",
  ERASURE: "Data Erasure Request",
  RECTIFICATION: "Data Rectification Request",
  PORTABILITY: "Data Portability Request",
  OBJECTION: "Data Processing Objection",
  RESTRICTION: "Processing Restriction Request",
  AUTOMATED_DECISION: "Automated Decision Review",
  WITHDRAW_CONSENT: "Consent Withdrawal",
  OTHER: "Data Subject Request",
};

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

function computeProgress(status: DSARStatus): number {
  if (status === "REJECTED" || status === "CANCELLED") return 100;
  const idx = STATUS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STATUS_ORDER.length) * 100);
}

export default function DSARStatusPage() {
  const params = useParams();
  const token = params.token as string;

  const { data: request, isLoading, error } = trpc.dsar.checkStatus.useQuery(
    { publicId: token },
    { retry: false, enabled: !!token }
  );

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
            <CardTitle>Request not found</CardTitle>
            <CardDescription>
              We couldn&apos;t find a request matching this reference number.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Please check the reference number from your confirmation email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = computeProgress(request.status);
  const currentStepIdx = TIMELINE_STEPS.findIndex((s) => s.key === request.status);
  const isFailed = request.status === "REJECTED" || request.status === "CANCELLED";
  const isDone = request.status === "COMPLETED";

  const dueDate = new Date(request.dueDate);
  const now = new Date();
  const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const pastDue = daysRemaining < 0 && !isDone && !isFailed;

  return (
    <div className="min-h-screen bg-muted/50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Request Status</h1>
          <p className="text-muted-foreground mt-1">
            Track the progress of your data subject request
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="font-mono text-base sm:text-lg break-all">{request.publicId}</CardTitle>
                <CardDescription>{TYPE_LABELS[request.type]}</CardDescription>
              </div>
              <Badge variant={isFailed ? "destructive" : "outline"} className="shrink-0 w-fit">
                {request.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {!isFailed && (
              <div className="space-y-4">
                {TIMELINE_STEPS.map((step, index) => {
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
                        {index < TIMELINE_STEPS.length - 1 && (
                          <div className={`w-0.5 h-8 mt-1 ${completed ? "bg-primary/30" : "bg-muted"}`} />
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className={`font-medium ${
                          current ? "text-primary" : completed ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {step.label}
                        </p>
                        {current && (
                          <p className="text-sm text-muted-foreground">
                            We are currently processing your request
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isFailed && (
              <div className="p-4 bg-destructive/10 rounded-lg text-sm text-destructive">
                This request was {request.status === "REJECTED" ? "rejected" : "cancelled"}. Please contact the organization for details.
              </div>
            )}

            <div className={`flex items-center justify-between p-4 rounded-lg ${pastDue ? "bg-destructive/10" : "bg-muted"}`}>
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${pastDue ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-sm">Expected completion</span>
              </div>
              <div className="text-right">
                <p className="font-medium">{dueDate.toLocaleDateString()}</p>
                <p className={`text-xs ${pastDue ? "text-destructive" : "text-muted-foreground"}`}>
                  {isDone
                    ? "Completed"
                    : pastDue
                      ? `${Math.abs(daysRemaining)} days overdue`
                      : `${daysRemaining} days remaining`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Request Received</span>
              <span>{new Date(request.receivedAt).toLocaleDateString()}</span>
            </div>
            {request.acknowledgedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Acknowledged</span>
                <span>{new Date(request.acknowledgedAt).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due Date</span>
              <span>{dueDate.toLocaleDateString()}</span>
            </div>
            {request.completedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span>{new Date(request.completedAt).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
