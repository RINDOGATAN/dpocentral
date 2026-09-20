// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Writes the standard DPIA template's v3.0 text (the framework question, the
// Californian sections and the questions added to the European ones) into the
// message bundles, from its bilingual source src/config/dpia-template-v2.ts.
// Run after editing that file:
//   npx tsx scripts/sync-dpia-messages.ts
// tests/assessment-frameworks.test.ts fails if the bundles are out of date.

import { dpiaFrameworkMessages } from "../src/config/dpia-template-v2";
import { syncTemplateMessages } from "./lib/sync-template-messages";

for (const line of syncTemplateMessages("dpia", dpiaFrameworkMessages)) console.log(line);
