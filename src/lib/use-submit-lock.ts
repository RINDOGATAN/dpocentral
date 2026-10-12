// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

"use client";

import { useCallback, useRef } from "react";

/**
 * One submission at a time for a create form.
 *
 * A form's submit button is disabled while its mutation is pending, but that
 * state reaches the button only on the next render: a double click sends two
 * submit events before it, and two records were created. The lock is taken
 * synchronously in the submit handler and released when the mutation settles.
 *
 *   const lock = useSubmitLock();
 *   if (!lock.acquire()) return;
 *   create.mutate(input, { onSettled: lock.release });
 */
export function useSubmitLock() {
  const busy = useRef(false);
  const acquire = useCallback(() => {
    if (busy.current) return false;
    busy.current = true;
    return true;
  }, []);
  const release = useCallback(() => {
    busy.current = false;
  }, []);
  return { acquire, release };
}
