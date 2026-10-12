// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { emailNotAcceptedResponse, refusesNewAccountEmail } from "@/lib/email-policy-server";

const handler = NextAuth(authOptions);

/**
 * Sign-in requests that carry an address in the form body: the e-mail link
 * and local sign-in. A refused address (src/lib/email-policy.ts) gets a 400
 * before any e-mail is sent or any account is created. Google is refused in
 * the signIn callback (src/lib/auth.ts), where its address is known.
 */
const ADDRESS_POSTS = [/\/api\/auth\/signin\/email\/?$/, /\/api\/auth\/callback\/dev-credentials\/?$/];

async function guardedPost(request: Request, context: unknown) {
  const path = new URL(request.url).pathname;
  if (ADDRESS_POSTS.some((re) => re.test(path))) {
    let email: unknown = null;
    try {
      const form = await request.clone().formData();
      email = form.get("email");
    } catch {
      email = null;
    }
    if (await refusesNewAccountEmail(prisma, email)) {
      return emailNotAcceptedResponse(request);
    }
  }
  return (handler as (req: Request, ctx: unknown) => Promise<Response>)(request, context);
}

export { handler as GET, guardedPost as POST };
