"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { OrganizationProvider } from "@/lib/organization-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
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
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <OrganizationProvider>
            {children}
          </OrganizationProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
