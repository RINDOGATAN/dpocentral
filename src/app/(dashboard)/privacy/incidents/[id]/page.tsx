"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
} from "lucide-react";
import { IncidentStatus, TaskPriority } from "@prisma/client";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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

const TIMELINE_ENTRY_TYPES: ReadonlyArray<"OBSERVATION" | "ACTION" | "EVIDENCE" | "COMMUNICATION" | "DECISION" | "NOTE"> = [
  "OBSERVATION",
  "ACTION",
  "EVIDENCE",
  "COMMUNICATION",
  "DECISION",
  "NOTE",
];

const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const STATUS_OPTIONS: IncidentStatus[] = [
  "REPORTED",
  "INVESTIGATING",
  "CONTAINED",
  "ERADICATED",
  "RECOVERING",
  "CLOSED",
  "FALSE_POSITIVE",
];

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { organization } = useOrganization();
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.incidentDetail");
  const tList = useTranslations("pages.incidents");
  const tCommon = useTranslations("common");

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<IncidentStatus | "">("");
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState<string>("");
  const [selectedRecipientType, setSelectedRecipientType] = useState<string>("DPA");

  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [timelineTitle, setTimelineTitle] = useState("");
  const [timelineDescription, setTimelineDescription] = useState("");
  const [timelineEntryType, setTimelineEntryType] = useState<string>("OBSERVATION");

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("MEDIUM");
  const [taskDueDate, setTaskDueDate] = useState("");

  const { data: incident, isLoading } = trpc.incident.getById.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id }
  );

  const { data: jurisdictionsData } = trpc.regulations.listApplied.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id && notifDialogOpen }
  );

  const utils = trpc.useUtils();

  const updateStatus = trpc.incident.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(t("incident.statusUpdated"));
      utils.incident.getById.invalidate();
      setStatusDialogOpen(false);
      setPendingStatus("");
    },
    onError: (error) => {
      toast.error(error.message || t("incident.statusUpdateFailed"));
    },
  });

  const addTimelineEntry = trpc.incident.addTimelineEntry.useMutation({
    onSuccess: () => {
      toast.success(t("incident.timelineAdded"));
      utils.incident.getById.invalidate();
      setTimelineDialogOpen(false);
      setTimelineTitle("");
      setTimelineDescription("");
      setTimelineEntryType("OBSERVATION");
    },
    onError: (error) => toast.error(error.message || t("incident.timelineAddFailed")),
  });

  const createTask = trpc.incident.createTask.useMutation({
    onSuccess: () => {
      toast.success(t("incident.taskCreated"));
      utils.incident.getById.invalidate();
      setTaskDialogOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("MEDIUM");
      setTaskDueDate("");
    },
    onError: (error) => toast.error(error.message || t("incident.taskCreateFailed")),
  });

  const createNotification = trpc.incident.createNotification.useMutation({
    onSuccess: () => {
      toast.success(t("incident.notificationCreated"));
      utils.incident.getById.invalidate();
      setNotifDialogOpen(false);
      setSelectedJurisdictionId("");
      setSelectedRecipientType("DPA");
    },
    onError: (error) => {
      toast.error(error.message || t("incident.notificationCreateFailed"));
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
        <p className="text-muted-foreground">{tp("notFound")}</p>
        <Link href="/privacy/incidents">
          <Button variant="outline" className="mt-4">{tp("back")}</Button>
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
            <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
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
              <Badge variant="outline">{tList(`type.${incident.type}` as `type.DATA_BREACH` | `type.UNAUTHORIZED_ACCESS` | `type.DATA_LOSS` | `type.SYSTEM_COMPROMISE` | `type.PHISHING` | `type.RANSOMWARE` | `type.INSIDER_THREAT` | `type.PHYSICAL_SECURITY` | `type.VENDOR_INCIDENT` | `type.OTHER`)}</Badge>
              <Badge variant="outline" className={severityColors[incident.severity] || ""}>
                {tList(`severity.${incident.severity}` as `severity.LOW` | `severity.MEDIUM` | `severity.HIGH` | `severity.CRITICAL`)}
              </Badge>
              <Badge variant="outline" className={statusColors[incident.status] || ""}>
                {tList(`status.${incident.status}` as `status.REPORTED` | `status.INVESTIGATING` | `status.CONTAINED` | `status.ERADICATED` | `status.RECOVERING` | `status.CLOSED` | `status.FALSE_POSITIVE`)}
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold mt-1">{incident.title}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          {incident.status !== "CLOSED" && incident.status !== "FALSE_POSITIVE" && (
            <Button
              variant="outline"
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate({
                  organizationId: organization?.id ?? "",
                  id,
                  status: "CLOSED",
                })
              }
            >
              {updateStatus.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {tp("close")}
            </Button>
          )}
          <Button
            onClick={() => {
              setPendingStatus(incident.status as IncidentStatus);
              setStatusDialogOpen(true);
            }}
          >
            {tp("updateStatus")}
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {incident.notificationRequired && !incident.notifications?.length && (() => {
        const deadline = incident.notificationDeadline ? new Date(incident.notificationDeadline) : null;
        const pastDue = deadline ? deadline.getTime() < Date.now() : false;
        return (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <Bell className="w-6 h-6 text-destructive shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium">{tp("notifBanner.title")}</p>
                  {deadline && (
                    <p className={`text-sm ${pastDue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {pastDue
                        ? tp("notifBanner.overdue", { date: deadline.toLocaleString() })
                        : tp("notifBanner.deadline", { date: deadline.toLocaleString() })}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="destructive" onClick={() => setNotifDialogOpen(true)}>
                {tp("notifBanner.create")}
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{tp("stats.discovered")}</span>
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
              <span className="text-sm">{tp("stats.affectedRecords")}</span>
            </div>
            <p className="font-medium text-xl">
              {incident.affectedRecords?.toLocaleString() ?? tp("stats.unknown")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-sm">{tp("stats.affectedSubjects")}</span>
            </div>
            <p className="font-medium text-xl">
              {tp("stats.subjectTypesCount", { count: (incident.affectedSubjects as string[])?.length ?? 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Bell className="w-4 h-4" />
              <span className="text-sm">{tp("stats.notifications")}</span>
            </div>
            <p className="font-medium text-xl">{incident.notifications?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{tp("tabs.details")}</TabsTrigger>
          <TabsTrigger value="timeline">{tp("tabs.timelineWithCount", { count: incident.timeline?.length ?? 0 })}</TabsTrigger>
          <TabsTrigger value="tasks">{tp("tabs.tasksWithCount", { count: incident.tasks?.length ?? 0 })}</TabsTrigger>
          <TabsTrigger value="notifications">
            {tp("tabs.notificationsWithCount", { count: incident.notifications?.length ?? 0 })}
          </TabsTrigger>
          <TabsTrigger value="documents">{tp("tabs.documents")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tp("details.description")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {incident.description || tp("details.noDescription")}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tp("details.discovery")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">{tp("details.discoveredBy")}</span>
                  <p className="font-medium">{incident.discoveredBy || tp("details.notSpecified")}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">{tp("details.discoveryMethod")}</span>
                  <p className="font-medium">
                    {incident.discoveryMethod?.replace("_", " ") || tp("details.notSpecified")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tp("details.dataCategories")}</CardTitle>
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
                  <p className="text-muted-foreground text-sm">{tp("details.dataCategoriesEmpty")}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {incident.rootCause && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tp("details.rootCause")}</CardTitle>
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
                <CardTitle className="text-base">{tp("details.lessonsLearned")}</CardTitle>
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
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setTimelineDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {tp("timeline.addEntry")}
                </Button>
              </div>
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
                            {tp(`timelineDialog.type.${entry.entryType}` as `timelineDialog.type.OBSERVATION` | `timelineDialog.type.ACTION` | `timelineDialog.type.EVIDENCE` | `timelineDialog.type.COMMUNICATION` | `timelineDialog.type.DECISION` | `timelineDialog.type.NOTE`)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {entry.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          <Clock className="inline w-3 h-3 mr-1" />
                          {new Date(entry.timestamp).toLocaleString()}
                          {entry.createdBy && tp("timeline.createdBy", { name: entry.createdBy.name ?? "" })}
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
                <p>{tp("timeline.empty")}</p>
                <Button className="mt-4" onClick={() => setTimelineDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {tp("timeline.addEntry")}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {incident.tasks && incident.tasks.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {tp("tasks.addTask")}
                </Button>
              </div>
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
                        <Badge variant="outline">{tp("tasks.priority", { value: task.priority })}</Badge>
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
                <p>{tp("tasks.empty")}</p>
                <Button className="mt-4" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {tp("tasks.addTask")}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          {incident.notifications && incident.notifications.length > 0 ? (
            <div className="space-y-4">
              {incident.notifications.map((notification) => {
                const deadline = new Date(notification.deadline);
                const pastDue = deadline.getTime() < Date.now() && notification.status === "PENDING";
                return (
                  <Card key={notification.id} className={pastDue ? "border-destructive/50" : ""}>
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Bell className="w-4 h-4 text-primary" />
                            <span className="font-medium">{notification.recipientType}</span>
                            <Badge variant="outline">{notification.status}</Badge>
                            {pastDue && <Badge variant="destructive">{tp("notifications.overdue")}</Badge>}
                          </div>
                          <p className={`text-sm mt-1 ${pastDue ? "text-destructive" : "text-muted-foreground"}`}>
                            {tp("notifications.due", { date: deadline.toLocaleString() })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tp("notifications.empty")}</p>
                {incident.notificationRequired && (
                  <Button className="mt-4" variant="destructive" onClick={() => setNotifDialogOpen(true)}>
                    {tp("notifications.createDpa")}
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
              <p>{tp("documents.title")}</p>
              <p className="text-sm mt-1">{tp("documents.subtitle")}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Update Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("statusDialog.title")}</DialogTitle>
            <DialogDescription>{tp("statusDialog.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>{tp("statusDialog.newStatus")}</Label>
            <Select value={pendingStatus} onValueChange={(v) => setPendingStatus(v as IncidentStatus)}>
              <SelectTrigger>
                <SelectValue placeholder={tp("statusDialog.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tList(`status.${s}` as `status.REPORTED` | `status.INVESTIGATING` | `status.CONTAINED` | `status.ERADICATED` | `status.RECOVERING` | `status.CLOSED` | `status.FALSE_POSITIVE`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={!pendingStatus || updateStatus.isPending || pendingStatus === incident.status}
              onClick={() =>
                pendingStatus &&
                updateStatus.mutate({
                  organizationId: organization?.id ?? "",
                  id,
                  status: pendingStatus,
                })
              }
            >
              {updateStatus.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tp("statusDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Timeline Entry Dialog */}
      <Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("timelineDialog.title")}</DialogTitle>
            <DialogDescription>{tp("timelineDialog.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tp("timelineDialog.entryType")}</Label>
              <Select value={timelineEntryType} onValueChange={setTimelineEntryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_ENTRY_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tp(`timelineDialog.type.${value}` as `timelineDialog.type.OBSERVATION` | `timelineDialog.type.ACTION` | `timelineDialog.type.EVIDENCE` | `timelineDialog.type.COMMUNICATION` | `timelineDialog.type.DECISION` | `timelineDialog.type.NOTE`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tp("timelineDialog.titleLabel")}</Label>
              <Input
                value={timelineTitle}
                onChange={(e) => setTimelineTitle(e.target.value)}
                placeholder={tp("timelineDialog.titlePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{tp("timelineDialog.descLabel")}</Label>
              <Textarea
                value={timelineDescription}
                onChange={(e) => setTimelineDescription(e.target.value)}
                placeholder={tp("timelineDialog.descPlaceholder")}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimelineDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={!timelineTitle.trim() || addTimelineEntry.isPending}
              onClick={() =>
                addTimelineEntry.mutate({
                  organizationId: organization?.id ?? "",
                  incidentId: id,
                  title: timelineTitle.trim(),
                  description: timelineDescription.trim() || undefined,
                  entryType: timelineEntryType,
                })
              }
            >
              {addTimelineEntry.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tp("timelineDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("taskDialog.title")}</DialogTitle>
            <DialogDescription>{tp("taskDialog.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tp("taskDialog.titleLabel")}</Label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder={tp("taskDialog.titlePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{tp("taskDialog.descLabel")}</Label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder={tp("taskDialog.descPlaceholder")}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tp("taskDialog.priority")}</Label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {tp(`taskDialog.priorities.${p}` as `taskDialog.priorities.LOW` | `taskDialog.priorities.MEDIUM` | `taskDialog.priorities.HIGH` | `taskDialog.priorities.URGENT`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tp("taskDialog.dueDate")}</Label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={!taskTitle.trim() || createTask.isPending}
              onClick={() =>
                createTask.mutate({
                  organizationId: organization?.id ?? "",
                  incidentId: id,
                  title: taskTitle.trim(),
                  description: taskDescription.trim() || undefined,
                  priority: taskPriority,
                  dueDate: taskDueDate ? new Date(taskDueDate) : undefined,
                })
              }
            >
              {createTask.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tp("taskDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Notification Dialog */}
      <Dialog open={notifDialogOpen} onOpenChange={setNotifDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("notifDialog.title")}</DialogTitle>
            <DialogDescription>{tp("notifDialog.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tp("notifDialog.jurisdiction")}</Label>
              <Select value={selectedJurisdictionId} onValueChange={setSelectedJurisdictionId}>
                <SelectTrigger>
                  <SelectValue placeholder={tp("notifDialog.selectJurisdiction")} />
                </SelectTrigger>
                <SelectContent>
                  {(jurisdictionsData?.jurisdictions ?? []).map((j) => (
                    <SelectItem key={j.jurisdictionId} value={j.jurisdictionId}>
                      {tp("notifDialog.jurisdictionWindow", { name: j.name, hours: j.breachNotificationHours })}
                    </SelectItem>
                  ))}
                  {jurisdictionsData?.jurisdictions.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">
                      {tp("notifDialog.noJurisdictions")}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tp("notifDialog.recipient")}</Label>
              <Select value={selectedRecipientType} onValueChange={setSelectedRecipientType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DPA">{tp("notifDialog.recipientType.DPA")}</SelectItem>
                  <SelectItem value="DATA_SUBJECT">{tp("notifDialog.recipientType.DATA_SUBJECT")}</SelectItem>
                  <SelectItem value="LAW_ENFORCEMENT">{tp("notifDialog.recipientType.LAW_ENFORCEMENT")}</SelectItem>
                  <SelectItem value="INTERNAL">{tp("notifDialog.recipientType.INTERNAL")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={!selectedJurisdictionId || createNotification.isPending}
              onClick={() =>
                createNotification.mutate({
                  organizationId: organization?.id ?? "",
                  incidentId: id,
                  jurisdictionId: selectedJurisdictionId,
                  recipientType: selectedRecipientType,
                })
              }
            >
              {createNotification.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tp("notifDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
