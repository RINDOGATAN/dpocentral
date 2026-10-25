// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { renderExtensionEmail } from "@/server/services/dsar/sendExtensionEmail";

// The e-mail service keeps copies of messages: the requester's name stays out
// of the e-mails sent to the requester.
describe("rights-request e-mails greet without the requester's name", () => {
  it("has no name in the three greetings, in English and Spanish", () => {
    for (const messages of [en, es]) {
      const d = messages.dsarPublic as unknown as Record<string, { greeting: string }>;
      for (const ns of ["email", "communicationEmail", "extensionEmail"]) {
        expect(d[ns].greeting).not.toContain("{name}");
      }
    }
    expect(en.dsarPublic.email.greeting).toBe("Hello,");
    expect(es.dsarPublic.email.greeting).toBe("Hola:");
  });

  it("leaves the name out of the extension e-mail", () => {
    for (const locale of ["en", "es"]) {
      const mail = renderExtensionEmail({
        requesterName: "Zelda Quixote",
        organizationName: "Acme",
        publicId: "PUB-1",
        newDueDate: new Date("2026-12-01T00:00:00Z"),
        locale,
      });
      expect(mail.text).not.toContain("Zelda");
      expect(mail.html).not.toContain("Zelda");
    }
  });
});
