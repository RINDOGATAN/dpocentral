"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, ScrollText, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.platformAdmin.listAuditLogs.useInfiniteQuery(
      {
        search: search || undefined,
        entityType: entityType || undefined,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 50,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const allLogs = data?.pages.flatMap((p) => p.logs) ?? [];
  const filterOptions = data?.pages[0]?.filterOptions;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-muted-foreground">
          Platform-wide activity log
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={entityType} onValueChange={(v) => setEntityType(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Types</SelectItem>
            {filterOptions?.entityTypes.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={(v) => setAction(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Actions</SelectItem>
            {filterOptions?.actions.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="To"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : allLogs.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allLogs.map((log) => (
                <>
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                  >
                    <TableCell>
                      {expandedRow === log.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.user ? (
                        <Link
                          href={`/admin/users/${log.user.id}`}
                          className="text-sm hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {log.user.name || log.user.email}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.organization ? (
                        <Link
                          href={`/admin/organizations/${log.organization.id}`}
                          className="text-sm hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {log.organization.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.entityType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.action === "CREATE"
                            ? "default"
                            : log.action === "DELETE"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{log.entityId}</code>
                    </TableCell>
                  </TableRow>
                  {expandedRow === log.id && (
                    <TableRow key={`${log.id}-detail`}>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <div className="p-4 space-y-3 text-sm">
                          {log.changes && (
                            <div>
                              <p className="font-medium mb-1">Changes</p>
                              <pre className="bg-background p-3 rounded border text-xs overflow-auto max-h-60">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.metadata && (
                            <div>
                              <p className="font-medium mb-1">Metadata</p>
                              <pre className="bg-background p-3 rounded border text-xs overflow-auto max-h-40">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                          <div className="flex gap-6 text-xs text-muted-foreground">
                            {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                            {log.userAgent && (
                              <span className="truncate max-w-md" title={log.userAgent}>
                                UA: {log.userAgent}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ScrollText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium">No audit logs found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filters
            </p>
          </CardContent>
        </Card>
      )}

      {/* Load More */}
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
