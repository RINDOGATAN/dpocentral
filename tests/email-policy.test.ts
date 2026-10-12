// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The e-mail policy helper (src/lib/email-policy.ts): the two rules, the
 * accepted examples, the uppercase variants, and the two scopes (accounts:
 * both rules; enquiry forms: rule 1 only).
 */

import { describe, it, expect } from "vitest";
import {
  BLOCKED_EMAIL_MESSAGES,
  blockedEmailMessage,
  isBlockedAccountEmail,
  isBlockedEnquiryEmail,
  isDottedGmail,
} from "@/lib/email-policy";
import { localizeServerMessage } from "@/lib/server-error-messages";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const DOTTED_GMAIL = [
  "b.ake.r.miche.ll.eba.hpc.y.jx@gmail.com",
  "B.AKE.R.MICHE.LL.EBA.HPC.Y.JX@GMAIL.COM",
  "a.b.c.d@googlemail.com",
  "A.B.C.D@GoogleMail.Com",
  "a.b.c.d+x@gmail.com",
];

const BLOCKED_DOMAINS = [
  "someone@hotmail.com",
  "SOMEONE@HOTMAIL.COM",
  "x@hotmail.co.uk",
  "x@hotmail.fr",
  "x@hotmail.com.ar",
  "x@mx.hotmail.com",
  "x@aol.com",
  "X@AOL.CO.UK",
  "x@aol.de",
  " x@hotmail.com. ",
];

const ACCEPTED = [
  "first.last@gmail.com",
  "FIRST.LAST@GMAIL.COM",
  "a.b.c@gmail.com",
  "a.b+c.d.e@gmail.com",
  "a.b.c.d@example.com",
  "x@aol.example.com",
  "x@nothotmail.com",
  "x@hotmailer.com",
  "x@outlook.com",
  "",
  "nonsense",
];

describe("rule 1: dotted Gmail", () => {
  it.each(DOTTED_GMAIL)("refuses %s everywhere", (email) => {
    expect(isDottedGmail(email)).toBe(true);
    expect(isBlockedAccountEmail(email)).toBe(true);
    expect(isBlockedEnquiryEmail(email)).toBe(true);
  });
});

describe("rule 2: hotmail and aol", () => {
  it.each(BLOCKED_DOMAINS)("refuses %s for accounts", (email) => {
    expect(isBlockedAccountEmail(email)).toBe(true);
  });

  it.each(BLOCKED_DOMAINS)("leaves %s open on enquiry forms", (email) => {
    expect(isBlockedEnquiryEmail(email)).toBe(false);
  });
});

describe("accepted addresses", () => {
  it.each(ACCEPTED)("accepts %s", (email) => {
    expect(isBlockedAccountEmail(email)).toBe(false);
    expect(isBlockedEnquiryEmail(email)).toBe(false);
  });

  it("never throws on a missing value", () => {
    expect(isBlockedAccountEmail(null)).toBe(false);
    expect(isBlockedAccountEmail(undefined)).toBe(false);
  });
});

describe("the message", () => {
  it("is the approved sentence in both languages, in the bundles too", () => {
    expect(blockedEmailMessage("en")).toBe(
      "Please use your work e-mail address, or a different personal address. We can't accept this one."
    );
    expect(blockedEmailMessage("es")).toBe(
      "Usa tu correo del trabajo u otra dirección personal. No podemos aceptar esta."
    );
    expect(en.auth.emailNotAccepted).toBe(BLOCKED_EMAIL_MESSAGES.en);
    expect(es.auth.emailNotAccepted).toBe(BLOCKED_EMAIL_MESSAGES.es);
    expect(en.auth.authErrorPage.emailNotAccepted).toBe(BLOCKED_EMAIL_MESSAGES.en);
    expect(es.auth.authErrorPage.emailNotAccepted).toBe(BLOCKED_EMAIL_MESSAGES.es);
  });

  it("is localised when a procedure throws it in English", () => {
    expect(localizeServerMessage(BLOCKED_EMAIL_MESSAGES.en, "es")).toBe(BLOCKED_EMAIL_MESSAGES.es);
  });
});
