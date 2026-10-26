// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The "Public website and apps" record and the flows the quick start draws
 * from it to client-side tools (src/config/client-side-collection.ts), in
 * both languages, as a pack for src/lib/system-content/: a stored string that
 * is one of these, in either language, is shown in the reader's language; an
 * edited one is shown as typed.
 */

import type { SystemContentPack } from "@/lib/system-content/localize";
import { VENDOR_QUICKSTART_TEXT } from "@/config/vendor-data-mappings-es";

const en = VENDOR_QUICKSTART_TEXT.en;
const es = VENDOR_QUICKSTART_TEXT.es;

export const PUBLIC_PROPERTIES_CONTENT_PACK: SystemContentPack = {
  id: "public-properties",
  texts: [
    { en: en.publicPropertiesName, es: es.publicPropertiesName },
    { en: en.publicPropertiesDescription, es: es.publicPropertiesDescription },
    { en: en.publicPropertiesHosting, es: es.publicPropertiesHosting },
  ],
  patterns: [
    { en: en.flowFromProperties("{vendor}"), es: es.flowFromProperties("{vendor}") },
    { en: en.flowFromPropertiesDescription("{vendor}"), es: es.flowFromPropertiesDescription("{vendor}") },
  ],
};
