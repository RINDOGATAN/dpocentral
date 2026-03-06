"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useRouter } from "next/navigation";

function timeAgo(date: Date | string | null): string {
  if (!date) return "No activity";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ClientsPage() {
  const { data: clients, isLoading } = trpc.clients.listClients.useQuery();
  const { setOrganization } = useOrganization();
  const router = useRouter();

  const totalDsars = clients?.reduce((s, c) => s + c.openDsars, 0) ?? 0;
  const totalAssessments = clients?.reduce((s, c) => s + c.pendingAssessments, 0) ?? 0;
  const totalIncidents = clients?.reduce((s, c) => s + c.openIncidents, 0) ?? 0;
  const attentionCount = clients?.filter((c) => c.needsAttention).length ?? 0;

  const handleClientClick = (client: NonNullable<typeof clients>[number]) => {
    setOrganization({
      id: client.organizationId,
      name: client.organizationName,
      slug: client.organizationSlug,
    });
    router.push("/privacy");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">My Clients</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {clients?.length ?? 0} organization{(clients?.length ?? 0) !== 1 ? "s" : ""} you manage
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{totalDsars}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Open DSARs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{totalAssessments}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Pending Assessments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{totalIncidents}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Open Incidents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className={`text-xl sm:text-2xl font-bold ${attentionCount > 0 ? "text-amber-400" : "text-foreground"}`}>
              {attentionCount}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Need Attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Cards */}
      {clients && clients.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {clients.map((client) => (
            <Card
              key={client.organizationId}
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => handleClientClick(client)}
            >
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="font-semibold text-sm sm:text-base truncate">
                      {client.organizationName}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {client.needsAttention && (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {client.role.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>
                      {client.openDsars} DSARs
                      {client.overdueDsars > 0 && (
                        <span className="text-amber-400 ml-1">({client.overdueDsars} overdue)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ClipboardCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{client.pendingAssessments} Assessments</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{client.openIncidents} Incidents</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{client.activeVendors} Vendors</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t border-border">
                  <Clock className="w-3 h-3" />
                  <span>Last activity: {timeAgo(client.lastActivity)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No client organizations yet</p>
            <p className="text-sm mt-1">Organizations you&apos;re a member of will appear here</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
