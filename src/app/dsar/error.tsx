"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { ErrorPage } from "@/components/error-page";

// The public request form: the person is a data subject, not a user of the
// product, so the only way back offered is to try again.
export default function PublicRequestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPage error={error} reset={reset} back={null} />;
}
