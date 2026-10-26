"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { type Session } from "next-auth";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { OrganizationProvider } from "@/lib/organization-context";
import { ThemeProvider } from "@/components/providers/theme-provider";

export function Providers({ children, session }: { children: React.ReactNode; session?: Session | null }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <ThemeProvider>
      {/* No session refetch when the tab becomes visible again: next-auth
          replaces the session with null when that request fails (a tablet
          resuming a backgrounded tab often fails its first request), and
          never asks again while it is null, so the signed-in person lost
          every session-based menu entry until a full reload. The session
          comes from the server on every load, sign-out in another tab still
          arrives through next-auth's storage broadcast, and the server checks
          the session on every request either way. */}
      <SessionProvider session={session} refetchOnWindowFocus={false}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <OrganizationProvider>
              {children}
            </OrganizationProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </SessionProvider>
    </ThemeProvider>
  );
}
