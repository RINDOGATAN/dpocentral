"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  Users,
  Database,
  Bell,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  MessageSquare,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const severityColors: Record<string, string> = {
  LOW: "border-primary text-primary",
  MEDIUM: "border-muted-foreground text-muted-foreground",
  HIGH: "border-destructive/50 bg-destructive/20 text-foreground",
  CRITICAL: "border-destructive bg-destructive text-destructive-foreground",
};

const statusColors: Record<string, string> = {
  REPORTED: "border-primary text-primary",
  INVESTIGATING: "border-primary text-primary",
  CONTAINED: "border-muted-foreground text-muted-foreground",
  ERADICATED: "border-primary text-primary",
  RECOVERING: "border-muted-foreground text-muted-foreground",
  CLOSED: "border-primary bg-primary text-primary-foreground",
  FALSE_POSITIVE: "border-muted-foreground text-muted-foreground",
};

const typeLabels: Record<string, string> = {
  DATA_BREACH: "Data Breach",
  UNAUTHORIZED_ACCESS: "Unauthorized Access",
  DATA_LOSS: "Data Loss",
  SYSTEM_COMPROMISE: "System Compromise",
  PHISHING: "Phishing",
  RANSOMWARE: "Ransomware",
  INSIDER_THREAT: "Insider Threat",
  PHYSICAL_SECURITY: "Physical Security",
  VENDOR_INCIDENT: "Vendor Incident",
  OTHER: "Other",
};

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { organization } = useOrganization();

  const { data: incident, isLoading } = trpc.incident.getById.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id }
  );

  const utils = trpc.useUtils();

  const updateStatus = trpc.incident.updateStatus.useMutation({
    onSuccess: () => {
      utils.incident.getById.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Incident not found</p>
        <Link href="/privacy/incidents">
          <Button variant="outline" className="mt-4">
            Back to Incidents
          </Button>
        </Link>
      </div>
    );
  }

  const isHighSeverity = incident.severity === "HIGH" || incident.severity === "CRITICAL";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/incidents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div
            className={`w-12 h-12 border-2 flex items-center justify-center ${
              isHighSeverity
                ? "border-destructive bg-destructive/20"
                : "border-primary"
            }`}
          >
            <AlertTriangle
              className={`w-6 h-6 ${isHighSeverity ? "text-destructive" : "text-primary"}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-primary">{incident.publicId}</span>
              <Badge variant="outline">{typeLabels[incident.type] || incident.type}</Badge>
              <Badge variant="outline" className={severityColors[incident.severity] || ""}>
                {incident.severity}
              </Badge>
              <Badge variant="outline" className={statusColors[incident.status] || ""}>
                {incident.status.replace("_", " ")}
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold mt-1">{incident.title}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          {incident.status !== "CLOSED" && incident.status !== "FALSE_POSITIVE" && (
            <Button
              variant="outline"
              onClick={() =>
                updateStatus.mutate({
                  organizationId: organization?.id ?? "",
                  id,
                  status: "CLOSED",
                })
              }
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Close Incident
            </Button>
          )}
          <Button>Update Status</Button>
        </div>
      </div>

      {/* Notification Banner */}
      {incident.notificationRequired && !incident.notifications?.length && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Bell className="w-6 h-6 text-destructive" />
              <div>
                <p className="font-medium">Regulatory Notification Required</p>
                <p className="text-sm text-muted-foreground">
                  {incident.notificationDeadline && (
                    <>
                      Deadline:{" "}
                      {new Date(incident.notificationDeadline).toLocaleString()}
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button variant="destructive">Create Notification</Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Discovered</span>
            </div>
            <p className="font-medium">
              {new Date(incident.discoveredAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Database className="w-4 h-4" />
              <span className="text-sm">Affected Records</span>
            </div>
            <p className="font-medium text-xl">
              {incident.affectedRecords?.toLocaleString() ?? "Unknown"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-sm">Affected Subjects</span>
            </div>
            <p className="font-medium text-xl">
              {(incident.affectedSubjects as string[])?.length ?? 0} types
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Bell className="w-4 h-4" />
              <span className="text-sm">Notifications</span>
            </div>
            <p className="font-medium text-xl">{incident.notifications?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({incident.timeline?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({incident.tasks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications ({incident.notifications?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {incident.description || "No description provided"}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Discovery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Discovered By:</span>
                  <p className="font-medium">{incident.discoveredBy || "Not specified"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Discovery Method:</span>
                  <p className="font-medium">
                    {incident.discoveryMethod?.replace("_", " ") || "Not specified"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Categories Affected</CardTitle>
              </CardHeader>
              <CardContent>
                {(incident.dataCategories as string[])?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(incident.dataCategories as string[]).map((cat) => (
                      <Badge key={cat} variant="outline">
                        {cat.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No categories specified</p>
                )}
              </CardContent>
            </Card>
          </div>

          {incident.rootCause && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Root Cause</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {incident.rootCause}
                </p>
              </CardContent>
            </Card>
          )}

          {incident.lessonsLearned && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lessons Learned</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {incident.lessonsLearned}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {incident.timeline && incident.timeline.length > 0 ? (
            <div className="space-y-4">
              {incident.timeline.map((entry, index) => (
                <Card key={entry.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 border-2 border-primary flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {entry.entryType.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {entry.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          <Clock className="inline w-3 h-3 mr-1" />
                          {new Date(entry.timestamp).toLocaleString()}
                          {entry.createdBy && ` by ${entry.createdBy.name}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No timeline entries yet</p>
                <Button className="mt-4">Add Entry</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {incident.tasks && incident.tasks.length > 0 ? (
            <div className="space-y-4">
              {incident.tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {task.status === "COMPLETED" ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{task.status}</Badge>
                        <Badge variant="outline">Priority {task.priority}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tasks assigned</p>
                <Button className="mt-4">Add Task</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          {incident.notifications && incident.notifications.length > 0 ? (
            <div className="space-y-4">
              {incident.notifications.map((notification) => (
                <Card key={notification.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-primary" />
                          <span className="font-medium">{notification.recipientType}</span>
                          <Badge variant="outline">{notification.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Due: {new Date(notification.deadline).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">View</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No notifications created</p>
                {incident.notificationRequired && (
                  <Button className="mt-4" variant="destructive">
                    Create DPA Notification
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No documents uploaded</p>
              <Button className="mt-4">Upload Document</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
