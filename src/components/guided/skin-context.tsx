"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The layout the dashboard is drawn in, as the server read it from the
 * `dpc_skin` cookie (src/lib/skin.ts). Changing it writes the cookie and asks
 * the server layout to render again, so the switch needs no reload.
 */

import { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SKIN_COOKIE, cookieAssignment, type Skin } from "@/lib/skin";

interface SkinContextValue {
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const SkinContext = createContext<SkinContextValue>({ skin: "guided", setSkin: () => {} });

export function SkinProvider({ skin, children }: { skin: Skin; children: React.ReactNode }) {
  const router = useRouter();
  const setSkin = useCallback(
    (next: Skin) => {
      document.cookie = cookieAssignment(SKIN_COOKIE, next);
      router.refresh();
    },
    [router],
  );
  return <SkinContext.Provider value={{ skin, setSkin }}>{children}</SkinContext.Provider>;
}

export function useSkin(): SkinContextValue {
  return useContext(SkinContext);
}
