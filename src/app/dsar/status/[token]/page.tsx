"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Clock, CheckCircle2, Circle, ArrowRight } from "lucide-react";

// Placeholder data
const requestStatuses = [
  { key: "SUBMITTED", label: "Submitted", completed: true },
  { key: "IDENTITY_VERIFIED", label: "Identity Verified", completed: true },
  { key: "IN_PROGRESS", label: "In Progress", completed: true, current: true },
  { key: "DATA_COLLECTED", label: "Data Collected", completed: false },
  { key: "COMPLETED", label: "Completed", completed: false },
];

export default function DSARStatusPage() {
  const params = useParams();
  const token = params.token as string;

  // Placeholder request data
  const request = {
    publicId: token,
    type: "ACCESS",
    status: "IN_PROGRESS",
    requesterName: "John Smith",
    receivedAt: "2024-01-15",
    acknowledgedAt: "2024-01-15",
    dueDate: "2024-02-14",
    progress: 45,
  };

  const daysRemaining = Math.ceil(
    (new Date(request.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-muted/50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Request Status</h1>
          <p className="text-muted-foreground mt-1">
            Track the progress of your data subject request
          </p>
        </div>

        {/* Request Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-mono">{request.publicId}</CardTitle>
                <CardDescription>
                  {request.type === "ACCESS" ? "Data Access Request" :
                   request.type === "ERASURE" ? "Data Erasure Request" :
                   "Data Subject Request"}
                </CardDescription>
              </div>
              <Badge className="bg-blue-100 text-blue-800">
                {request.status.replace("_", " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">{request.progress}%</span>
              </div>
              <Progress value={request.progress} className="h-2" />
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              {requestStatuses.map((status, index) => (
                <div key={status.key} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.completed
                        ? "bg-green-100"
                        : status.current
                          ? "bg-blue-100"
                          : "bg-muted"
                    }`}>
                      {status.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Circle className={`w-4 h-4 ${
                          status.current ? "text-blue-600" : "text-muted-foreground"
                        }`} />
                      )}
                    </div>
                    {index < requestStatuses.length - 1 && (
                      <div className={`w-0.5 h-8 mt-1 ${
                        status.completed ? "bg-green-200" : "bg-muted"
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className={`font-medium ${
                      status.current ? "text-blue-600" :
                      status.completed ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {status.label}
                    </p>
                    {status.current && (
                      <p className="text-sm text-muted-foreground">
                        We are currently processing your request
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Due Date */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Expected completion</span>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  {new Date(request.dueDate).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {daysRemaining} days remaining
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Request Received</span>
              <span>{new Date(request.receivedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Acknowledged</span>
              <span>{new Date(request.acknowledgedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due Date</span>
              <span>{new Date(request.dueDate).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Help */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              Have questions about your request? Contact us at{" "}
              <a href="mailto:privacy@example.com" className="text-primary hover:underline">
                privacy@example.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
