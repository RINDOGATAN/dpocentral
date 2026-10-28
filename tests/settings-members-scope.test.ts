// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The Settings "Team members" card: an invitation joins the selected
 * organisation only, so an account that works across several organisations
 * sees the card name that organisation. A business account with one
 * organisation keeps the generic team wording.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { membersCardIsScoped, membersCardKey, type MembersKey } from "@/lib/members-card-copy";

const tEn = createTranslator({ locale: "en", messages: en, namespace: "pages.settings.members" });
const tEs = createTranslator({ locale: "es", messages: es, namespace: "pages.settings.members" });
const KEYS: MembersKey[] = ["title", "descriptionAdmin", "inviteLabel", "inviteHelp"];
const ORG = "Client Co";

const render = (t: typeof tEn, scoped: boolean) =>
  Object.fromEntries(KEYS.map((k) => [k, t(membersCardKey(k, scoped), { organization: ORG })]));

describe("which wording the card uses", () => {
  it("a privacy professional always gets the organisation-named wording", () => {
    expect(membersCardIsScoped("PRIVACY_PROFESSIONAL", 1)).toBe(true);
    expect(membersCardIsScoped("PRIVACY_PROFESSIONAL", 3)).toBe(true);
  });

  it("any account in more than one organisation gets it too", () => {
    expect(membersCardIsScoped("BUSINESS_OWNER", 2)).toBe(true);
    expect(membersCardIsScoped(null, 2)).toBe(true);
  });

  it("a business account with one organisation keeps the team wording", () => {
    expect(membersCardIsScoped("BUSINESS_OWNER", 1)).toBe(false);
    expect(membersCardIsScoped(undefined, 1)).toBe(false);
    expect(membersCardIsScoped(null, 0)).toBe(false);
  });
});

describe("English strings", () => {
  it("scoped: names the selected organisation", () => {
    expect(render(tEn, true)).toEqual({
      title: "People in Client Co",
      descriptionAdmin: "People you add here see and work only in Client Co, not in your other organisations.",
      inviteLabel: "Add someone to Client Co",
      inviteHelp:
        "Enter their e-mail address and choose a role. Someone who has not signed in yet gets an invitation e-mail and joins when they first sign in with that address. To give a client's staff access, add them here while that client is selected.",
    });
  });

  it("single organisation: unchanged team wording", () => {
    const r = render(tEn, false);
    expect(r.title).toBe("Team members");
    expect(r.inviteLabel).toBe("Add a teammate");
    expect(r.descriptionAdmin).toBe("Add teammates to collaborate on your privacy program.");
  });
});

describe("Castilian strings (tú)", () => {
  it("scoped: names the selected organisation", () => {
    expect(render(tEs, true)).toEqual({
      title: "Personas en Client Co",
      descriptionAdmin: "Las personas que añadas aquí solo ven y trabajan en Client Co, no en tus otras organizaciones.",
      inviteLabel: "Añadir a alguien a Client Co",
      inviteHelp:
        "Escribe su dirección de correo y elige un rol. Si aún no ha iniciado sesión, recibe una invitación por correo y se une cuando inicia sesión por primera vez con esa dirección. Para dar acceso al personal de un cliente, añádelo aquí con ese cliente seleccionado.",
    });
  });

  it("single organisation: unchanged team wording", () => {
    const r = render(tEs, false);
    expect(r.title).toBe("Miembros del equipo");
    expect(r.inviteLabel).toBe("Añadir a un compañero");
  });

  it("scoped strings carry no usted forms and no long dashes", () => {
    for (const v of Object.values(render(tEs, true))) {
      expect(v).not.toMatch(/\busted\b|\bsu organizaci|—|–/i);
    }
    for (const v of Object.values(render(tEn, true))) expect(v).not.toMatch(/—|–/);
  });
});

describe("the settings page uses the variant for the four strings", () => {
  const page = readFileSync(
    path.join(process.cwd(), "src/app/(dashboard)/privacy/settings/page.tsx"),
    "utf8",
  );
  it("passes the selected organisation's name and keeps the viewer line", () => {
    expect(page).toContain("membersCardIsScoped(userType, organizations.length)");
    for (const k of KEYS) {
      expect(page).toContain(`tm("${k}")`);
      expect(page).not.toContain(`tMembers("${k}")`);
    }
    expect(page).toContain('tMembers("descriptionViewer")');
  });
});
