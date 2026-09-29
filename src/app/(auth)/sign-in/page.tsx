// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { connection } from "next/server";
import { signInMethods } from "@/lib/sign-in-methods";
import { SignInForm } from "./sign-in-form";

// Rendered per request: the sign-in methods depend on the server's own
// environment (a mail key, a Google client), which a self-hosted image sets at
// run time, not at build time.
export default async function SignInPage() {
  await connection();
  return <SignInForm methods={signInMethods()} />;
}
