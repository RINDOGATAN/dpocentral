"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Circle,
  User,
  Mail,
  Phone,
  MessageSquare,
  Plus,
  Send,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { DSARStatus, DSARTaskStatus, CommunicationDirection } from "@prisma/client";

const statusColors: Record<string, string> = {
  SUBMITTED: "border-muted-foreground text-muted-foreground",
  IDENTITY_PENDING: "border-muted-foreground text-muted-foreground",
  IDENTITY_VERIFIED: "border-primary text-primary",
  IN_PROGRESS: "border-primary text-primary",
  DATA_COLLECTED: "border-primary text-primary",
  REVIEW_PENDING: "border-muted-foreground text-muted-foreground",
  APPROVED: "border-primary text-primary",
  COMPLETED: "border-primary bg-primary text-primary-foreground",
  REJECTED: "border-destructive text-destructive",
  CANCELLED: "border-muted-foreground text-muted-foreground",
};

const taskStatusColors: Record<string, string> = {
  PENDING: "border-muted-foreground text-muted-foreground",
  IN_PROGRESS: "border-primary text-primary",
  COMPLETED: "border-primary bg-primary text-primary-foreground",
  BLOCKED: "border-destructive text-destructive",
  NOT_APPLICABLE: "border-muted-foreground text-muted-foreground",
};

const statusOrder: DSARStatus[] = [
  "SUBMITTED",
  "IDENTITY_PENDING",
  "IDENTITY_VERIFIED",
  "IN_PROGRESS",
  "DATA_COLLECTED",
  "REVIEW_PENDING",
  "COMPLETED",
];

export default function DSARDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { organization } = useOrganization();
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isSendMessageOpen, setIsSendMessageOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "" });
  const [messageForm, setMessageForm] = useState({ subject: "", content: "" });

  const { data: request, isLoading } = trpc.dsar.getById.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id }
  );

  const utils = trpc.useUtils();

  const updateStatus = trpc.dsar.updateStatus.useMutation({
    onSuccess: () => {
      utils.dsar.getById.invalidate();
      utils.dsar.list.invalidate();
    },
  });

  const createTask = trpc.dsar.createTask.useMutation({
    onSuccess: () => {
      utils.dsar.getById.invalidate();
      setIsAddTaskOpen(false);
      setTaskForm({ title: "", description: "" });
    },
  });

  const updateTask = trpc.dsar.updateTask.useMutation({
    onSuccess: () => {
      utils.dsar.getById.invalidate();
    },
  });

  const generateTasks = trpc.dsar.generateTasks.useMutation({
    onSuccess: () => {
      utils.dsar.getById.invalidate();
    },
  });

  const addCommunication = trpc.dsar.addCommunication.useMutation({
    onSuccess: () => {
      utils.dsar.getById.invalidate();
      setIsSendMessageOpen(false);
      setMessageForm({ subject: "", content: "" });
    },
  });

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !taskForm.title) return;
    createTask.mutate({
      organizationId: organization.id,
      dsarRequestId: id,
      title: taskForm.title,
      description: taskForm.description || undefined,
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !messageForm.content) return;
    addCommunication.mutate({
      organizationId: organization.id,
      dsarRequestId: id,
      direction: CommunicationDirection.OUTBOUND,
      channel: "Email",
      subject: messageForm.subject || undefined,
      content: messageForm.content,
    });
  };

  const handleStatusChange = (newStatus: DSARStatus) => {
    if (!organization?.id) return;
    updateStatus.mutate({
      organizationId: organization.id,
      id,
      status: newStatus,
    });
  };

  const handleTaskStatusChange = (taskId: string, newStatus: DSARTaskStatus) => {
    if (!organization?.id) return;
    updateTask.mutate({
      organizationId: organization.id,
      id: taskId,
      status: newStatus,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Request not found</p>
        <Link href="/privacy/dsar">
          <Button variant="outline" className="mt-4">
            Back to DSAR
          </Button>
        </Link>
      </div>
    );
  }

  const completedTasks = request.tasks?.filter(t => t.status === "COMPLETED").length ?? 0;
  const totalTasks = request.tasks?.length ?? 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const daysRemaining = request.daysUntilDue ?? 0;
  const isCompleted = request.status === "COMPLETED" || request.status === "CANCELLED" || request.status === "REJECTED";
  const isOverdue = !isCompleted && daysRemaining < 0;
  const isAtRisk = !isCompleted && daysRemaining <= 7 && daysRemaining >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/privacy/dsar">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold font-mono">{request.publicId}</h1>
              <Badge variant="outline">{request.type}</Badge>
              <Badge variant="outline" className={statusColors[request.status] || ""}>
                {request.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {request.requesterName} - {request.requesterEmail}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {request.status !== "COMPLETED" && request.status !== "CANCELLED" && (
            <>
              <Select
                value={request.status}
                onValueChange={(value) => handleStatusChange(value as DSARStatus)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOrder.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => handleStatusChange(DSARStatus.COMPLETED)}
                disabled={updateStatus.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress and SLA */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{completedTasks} of {totalTasks} tasks completed</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>

        <Card className={isCompleted ? "border-primary" : isOverdue ? "border-destructive" : isAtRisk ? "border-muted-foreground" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SLA Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isCompleted ? (
                <span className="text-primary flex items-center gap-2">
                  <CheckCircle2 className="w-8 h-8" />
                  {request.status === "COMPLETED" ? "COMPLETED" : request.status}
                </span>
              ) : isOverdue ? (
                <span className="bg-destructive/20 text-foreground px-2 py-1">OVERDUE</span>
              ) : isAtRisk ? (
                <span className="bg-muted-foreground/20 text-foreground px-2 py-1">{daysRemaining} days</span>
              ) : (
                `${daysRemaining} days`
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isCompleted ? "Closed" : "Due"}: {new Date(request.dueDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Requester Info */}
      <Card>
        <CardHeader>
          <CardTitle>Requester Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium truncate">{request.requesterName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium truncate">{request.requesterEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium truncate">{request.requesterPhone || "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Relationship</p>
              <p className="font-medium">{request.relationship || "-"}</p>
            </div>
          </div>
          {request.description && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Request Details</p>
                <p>{request.description}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="tasks" className="text-xs sm:text-sm">
            Tasks ({totalTasks})
          </TabsTrigger>
          <TabsTrigger value="communications" className="text-xs sm:text-sm">
            Communications ({request.communications?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs sm:text-sm">
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Data Collection Tasks</CardTitle>
                <CardDescription>Tasks for each data source</CardDescription>
              </div>
              <div className="flex gap-2">
                {totalTasks === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateTasks.mutate({
                      organizationId: organization?.id ?? "",
                      dsarRequestId: id,
                    })}
                    disabled={generateTasks.isPending}
                  >
                    {generateTasks.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Auto-Generate
                  </Button>
                )}
                <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {request.tasks && request.tasks.length > 0 ? (
                <div className="space-y-3">
                  {request.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {task.status === "COMPLETED" ? (
                          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                        ) : task.status === "IN_PROGRESS" ? (
                          <Circle className="w-5 h-5 text-primary fill-primary/20 shrink-0" />
                        ) : task.status === "BLOCKED" ? (
                          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{task.title}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {task.assignee ? `Assigned to: ${task.assignee.name || task.assignee.email}` : "Unassigned"}
                            {task.dataAsset && ` • ${task.dataAsset.name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={task.status}
                          onValueChange={(value) => handleTaskStatusChange(task.id, value as DSARTaskStatus)}
                        >
                          <SelectTrigger className="h-8 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                            <SelectItem value="BLOCKED">Blocked</SelectItem>
                            <SelectItem value="NOT_APPLICABLE">N/A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks yet</p>
                  <p className="text-sm">Add tasks or auto-generate from data assets</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Communications</CardTitle>
                <CardDescription>Message history with the requester</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsSendMessageOpen(true)}>
                <Send className="w-4 h-4 mr-2" />
                Send Message
              </Button>
            </CardHeader>
            <CardContent>
              {request.communications && request.communications.length > 0 ? (
                <div className="space-y-4">
                  {request.communications.map((comm) => (
                    <div
                      key={comm.id}
                      className={`p-4 ${
                        comm.direction === "OUTBOUND" ? "bg-primary/5 ml-0 sm:ml-8" : "bg-muted mr-0 sm:mr-8"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {comm.direction === "OUTBOUND"
                              ? (comm.sentBy?.name || comm.sentBy?.email || "Privacy Team")
                              : request.requesterName}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {comm.direction === "OUTBOUND" ? "Sent" : "Received"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comm.sentAt).toLocaleString()}
                        </span>
                      </div>
                      {comm.subject && (
                        <p className="text-sm font-medium mb-1">{comm.subject}</p>
                      )}
                      <p className="text-sm">{comm.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No communications yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Complete history of actions taken</CardDescription>
            </CardHeader>
            <CardContent>
              {request.auditLog && request.auditLog.length > 0 ? (
                <div className="space-y-3">
                  {request.auditLog.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 p-3 border">
                      <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{entry.action.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No audit entries</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Task Sheet */}
      <Sheet open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Task</SheetTitle>
            <SheetDescription>Create a new data collection task</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddTask} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task Title *</Label>
              <Input
                id="task-title"
                placeholder="e.g., Search Marketing CRM"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Task details..."
                rows={3}
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              />
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddTaskOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTask.isPending || !taskForm.title}>
                {createTask.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Task
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Send Message Sheet */}
      <Sheet open={isSendMessageOpen} onOpenChange={setIsSendMessageOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Send Message</SheetTitle>
            <SheetDescription>Send a message to {request.requesterName}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSendMessage} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="message-subject">Subject</Label>
              <Input
                id="message-subject"
                placeholder="Message subject"
                value={messageForm.subject}
                onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message-content">Message *</Label>
              <Textarea
                id="message-content"
                placeholder="Write your message..."
                rows={5}
                value={messageForm.content}
                onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                required
              />
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setIsSendMessageOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addCommunication.isPending || !messageForm.content}>
                {addCommunication.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
