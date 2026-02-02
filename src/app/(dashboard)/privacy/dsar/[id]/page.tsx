"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

// Placeholder data
const request = {
  id: "1",
  publicId: "DSR-2024-001",
  type: "ACCESS",
  status: "IN_PROGRESS",
  requesterName: "John Smith",
  requesterEmail: "john.smith@email.com",
  requesterPhone: "+1 (555) 123-4567",
  relationship: "Customer",
  description: "I would like to receive a copy of all personal data you have about me.",
  receivedAt: "2024-01-15T10:30:00Z",
  acknowledgedAt: "2024-01-15T14:00:00Z",
  dueDate: "2024-02-14",
  progress: 60,
  tasks: [
    { id: "1", title: "Search Customer Database", status: "COMPLETED", assignee: "Alice Brown", completedAt: "2024-01-18" },
    { id: "2", title: "Search Marketing CRM", status: "COMPLETED", assignee: "Bob Wilson", completedAt: "2024-01-19" },
    { id: "3", title: "Search HR System", status: "IN_PROGRESS", assignee: "Alice Brown", completedAt: null },
    { id: "4", title: "Search Analytics Platform", status: "PENDING", assignee: null, completedAt: null },
    { id: "5", title: "Compile and Review Data", status: "PENDING", assignee: null, completedAt: null },
  ],
  communications: [
    { id: "1", direction: "OUTBOUND", subject: "Acknowledgement of your request", sentAt: "2024-01-15T14:00:00Z", sentBy: "Privacy Team" },
    { id: "2", direction: "INBOUND", subject: "Additional information", sentAt: "2024-01-16T09:00:00Z", sentBy: "John Smith" },
    { id: "3", direction: "OUTBOUND", subject: "Identity verification required", sentAt: "2024-01-16T11:00:00Z", sentBy: "Privacy Team" },
  ],
};

const statusColors: Record<string, string> = {
  PENDING: "border-muted-foreground text-muted-foreground",
  IN_PROGRESS: "border-primary text-primary",
  COMPLETED: "border-primary bg-primary text-primary-foreground",
  BLOCKED: "border-destructive text-destructive",
  NOT_APPLICABLE: "border-muted-foreground text-muted-foreground",
};

export default function DSARDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const daysRemaining = Math.ceil(
    (new Date(request.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/dsar">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold font-mono">{request.publicId}</h1>
              <Badge variant="outline">{request.type}</Badge>
              <Badge variant="outline" className="border-primary text-primary">
                {request.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {request.requesterName} - {request.requesterEmail}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Clock className="w-4 h-4 mr-2" />
            Extend Deadline
          </Button>
          <Button>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark Complete
          </Button>
        </div>
      </div>

      {/* Progress and SLA */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{request.tasks.filter(t => t.status === "COMPLETED").length} of {request.tasks.length} tasks completed</span>
              <span className="font-medium">{request.progress}%</span>
            </div>
            <Progress value={request.progress} className="h-3" />
          </CardContent>
        </Card>

        <Card className={daysRemaining <= 7 ? "border-muted-foreground" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SLA Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {daysRemaining < 0 ? (
                <span className="bg-destructive/20 text-foreground px-2 py-1">OVERDUE</span>
              ) : daysRemaining <= 7 ? (
                <span className="bg-muted-foreground/20 text-foreground px-2 py-1">{daysRemaining} days</span>
              ) : (
                `${daysRemaining} days`
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Due: {new Date(request.dueDate).toLocaleDateString()}
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
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{request.requesterName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{request.requesterEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{request.requesterPhone}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Relationship</p>
              <p className="font-medium">{request.relationship}</p>
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
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Data Collection Tasks</CardTitle>
                <CardDescription>Tasks for each data source</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {request.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {task.status === "COMPLETED" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : task.status === "IN_PROGRESS" ? (
                        <Circle className="w-5 h-5 text-blue-600 fill-blue-100" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.assignee ? `Assigned to: ${task.assignee}` : "Unassigned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColors[task.status]}>
                        {task.status.replace("_", " ")}
                      </Badge>
                      {task.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(task.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Communications</CardTitle>
                <CardDescription>Message history with the requester</CardDescription>
              </div>
              <Button size="sm">
                <Send className="w-4 h-4 mr-2" />
                Send Message
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {request.communications.map((comm) => (
                  <div
                    key={comm.id}
                    className={`p-4 rounded-lg ${
                      comm.direction === "OUTBOUND" ? "bg-primary/5 ml-8" : "bg-muted mr-8"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{comm.sentBy}</span>
                        <Badge variant="outline" className="text-xs">
                          {comm.direction === "OUTBOUND" ? "Sent" : "Received"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comm.sentAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{comm.subject}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Complete history of actions taken</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Audit log will display all actions</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
