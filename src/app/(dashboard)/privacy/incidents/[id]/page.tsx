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

const TIMELINE_ENTRY_TYPES = [
  { value: "OBSERVATION", label: "Observation" },
  { value: "ACTION", label: "Action Taken" },
  { value: "EVIDENCE", label: "Evidence" },
  { value: "COMMUNICATION", label: "Communication" },
  { value: "DECISION", label: "Decision" },
  { value: "NOTE", label: "Note" },
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
      toast.success("Incident status updated");
      utils.incident.getById.invalidate();
      setStatusDialogOpen(false);
      setPendingStatus("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const addTimelineEntry = trpc.incident.addTimelineEntry.useMutation({
    onSuccess: () => {
      toast.success("Timeline entry added");
      utils.incident.getById.invalidate();
      setTimelineDialogOpen(false);
      setTimelineTitle("");
      setTimelineDescription("");
      setTimelineEntryType("OBSERVATION");
    },
    onError: (error) => toast.error(error.message || "Failed to add entry"),
  });

  const createTask = trpc.incident.createTask.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      utils.incident.getById.invalidate();
      setTaskDialogOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("MEDIUM");
      setTaskDueDate("");
    },
    onError: (error) => toast.error(error.message || "Failed to create task"),
  });

  const createNotification = trpc.incident.createNotification.useMutation({
    onSuccess: () => {
      toast.success("Notification created");
      utils.incident.getById.invalidate();
      setNotifDialogOpen(false);
      setSelectedJurisdictionId("");
      setSelectedRecipientType("DPA");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create notification");
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
              Close Incident
            </Button>
          )}
          <Button
            onClick={() => {
              setPendingStatus(incident.status as IncidentStatus);
              setStatusDialogOpen(true);
            }}
          >
            Update Status
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
                  <p className="font-medium">Regulatory Notification Required</p>
                  {deadline && (
                    <p className={`text-sm ${pastDue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {pastDue ? "OVERDUE — was due " : "Deadline: "}
                      {deadline.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="destructive" onClick={() => setNotifDialogOpen(true)}>
                Create Notification
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
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setTimelineDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
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
                <Button className="mt-4" onClick={() => setTimelineDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
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
                  Add Task
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
                <Button className="mt-4" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
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
                            {pastDue && <Badge variant="destructive">OVERDUE</Badge>}
                          </div>
                          <p className={`text-sm mt-1 ${pastDue ? "text-destructive" : "text-muted-foreground"}`}>
                            Due: {deadline.toLocaleString()}
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
                <p>No notifications created</p>
                {incident.notificationRequired && (
                  <Button className="mt-4" variant="destructive" onClick={() => setNotifDialogOpen(true)}>
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
              <p>Document uploads coming soon</p>
              <p className="text-sm mt-1">Attach evidence, reports, and communications to incidents.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Update Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Incident Status</DialogTitle>
            <DialogDescription>
              Transition this incident through the response workflow. A timeline entry will be recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>New Status</Label>
            <Select value={pendingStatus} onValueChange={(v) => setPendingStatus(v as IncidentStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
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
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Timeline Entry Dialog */}
      <Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Timeline Entry</DialogTitle>
            <DialogDescription>
              Record an observation, action, or decision taken during the incident response.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Entry Type</Label>
              <Select value={timelineEntryType} onValueChange={setTimelineEntryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_ENTRY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={timelineTitle}
                onChange={(e) => setTimelineTitle(e.target.value)}
                placeholder="Short summary of the entry"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={timelineDescription}
                onChange={(e) => setTimelineDescription(e.target.value)}
                placeholder="Details — what happened, who was involved, what evidence"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimelineDialogOpen(false)}>
              Cancel
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
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Create a response task to track remediation work for this incident.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="What needs to be done"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Optional details"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
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
              Cancel
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
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Notification Dialog */}
      <Dialog open={notifDialogOpen} onOpenChange={setNotifDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Regulatory Notification</DialogTitle>
            <DialogDescription>
              The deadline is computed from the jurisdiction&apos;s breach notification window.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Jurisdiction</Label>
              <Select value={selectedJurisdictionId} onValueChange={setSelectedJurisdictionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  {(jurisdictionsData?.jurisdictions ?? []).map((j) => (
                    <SelectItem key={j.jurisdictionId} value={j.jurisdictionId}>
                      {j.name} ({j.breachNotificationHours}h window)
                    </SelectItem>
                  ))}
                  {jurisdictionsData?.jurisdictions.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">
                      No jurisdictions applied to this organization
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recipient Type</Label>
              <Select value={selectedRecipientType} onValueChange={setSelectedRecipientType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DPA">Data Protection Authority (DPA)</SelectItem>
                  <SelectItem value="DATA_SUBJECT">Affected Data Subjects</SelectItem>
                  <SelectItem value="LAW_ENFORCEMENT">Law Enforcement</SelectItem>
                  <SelectItem value="INTERNAL">Internal Stakeholders</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifDialogOpen(false)}>
              Cancel
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
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
