// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Writes the "Health data in advertising" template text into the message
// bundles (templates.dpia.{template,section,question}), from its single
// bilingual source src/config/health-adtech-template.ts. Run after editing
// that file:
//   npx tsx scripts/sync-health-adtech-messages.ts
// tests/health-adtech-template.test.ts fails if the bundles are out of date.

import { healthAdtechMessages } from "../src/config/health-adtech-template";
import { syncTemplateMessages } from "./lib/sync-template-messages";

for (const line of syncTemplateMessages("dpia", healthAdtechMessages)) console.log(line);
