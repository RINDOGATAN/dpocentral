// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers";
import { createTRPCContext } from "@/server/trpc";
import { limitPublicTrpc } from "@/lib/rate-limit-trpc";

const handler = (req: Request) =>
  // The middleware never sees a dotted tRPC path, so the public DSAR limit is
  // applied here, on the decoded procedure name (src/lib/rate-limit-trpc.ts).
  limitPublicTrpc(req) ??
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            );
          }
        : undefined,
  });

export { handler as GET, handler as POST };
