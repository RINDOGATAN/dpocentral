// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { redirect } from "next/navigation";

/**
 * The root address opens the workspace. A visitor who is not signed in is
 * sent on to the sign-in page by the dashboard layout.
 */
export default function HomePage() {
  redirect("/privacy");
}
