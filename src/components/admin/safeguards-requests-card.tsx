"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Platform admin: the organisation's requests to talk about a managed server
 * or its own hardware (welcome card options b and c). Closing a request
 * starts its six-month retention; the daily purge deletes it after that.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const CHOICE_LABEL: Record<string, string> = {
  managed: "Managed virtual server",
  own_hardware: "Own hardware",
};

export function SafeguardsRequestsCard({ organizationId }: { organizationId: string }) {
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.platformAdmin.listSafeguardsRequests.useQuery({
    organizationId,
  });
  const close = trpc.platformAdmin.closeSafeguardsRequest.useMutation({
    onSuccess: () => {
      toast.success("Request closed. It will be deleted six months from today.");
      utils.platformAdmin.listSafeguardsRequests.invalidate({ organizationId });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Safeguards requests</CardTitle>
        <CardDescription>
          Requests for a managed server or own hardware. Use them only to answer the request.
          Closed requests are deleted six months after closing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!isLoading && (requests?.length ?? 0) === 0 && (
          <p className="text-muted-foreground">No requests.</p>
        )}
        {requests?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 last:border-0">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{CHOICE_LABEL[r.choice] ?? r.choice}</span>
                <Badge variant={r.status === "open" ? "info" : "neutral"}>{r.status}</Badge>
              </div>
              <p className="break-words">
                {r.name} · {r.email} · {r.organizationName} · {r.country} · {r.userCount}
              </p>
              {r.message && <p className="text-muted-foreground whitespace-pre-wrap break-words">{r.message}</p>}
              <p className="text-xs text-muted-foreground">
                Received {new Date(r.createdAt).toISOString().slice(0, 10)}
                {r.closedAt ? `, closed ${new Date(r.closedAt).toISOString().slice(0, 10)}` : ""}
              </p>
            </div>
            {r.status === "open" && (
              <Button
                size="sm"
                variant="outline"
                disabled={close.isPending}
                onClick={() => close.mutate({ id: r.id })}
              >
                Close
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
