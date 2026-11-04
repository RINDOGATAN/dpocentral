// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createTRPCRouter } from "../trpc";
import { organizationRouter } from "./privacy/organization";
import { organizationDeletionRouter } from "./privacy/organizationDeletion";
import { dataInventoryRouter } from "./privacy/dataInventory";
import { dsarRouter } from "./privacy/dsar";
import { incidentRouter } from "./privacy/incident";
import { vendorRouter } from "./privacy/vendor";
import { userRouter } from "./privacy/user";
import { businessUnitRouter } from "./privacy/businessUnit";
import { savedViewRouter } from "./privacy/savedView";
import { auditRouter } from "./privacy/audit";
import { recordOfProcessingRouter } from "./privacy/recordOfProcessing";
import { regulationsRouter } from "./privacy/regulations";

export const appRouter = createTRPCRouter({
  organization: organizationRouter,
  organizationDeletion: organizationDeletionRouter,
  dataInventory: dataInventoryRouter,
  recordOfProcessing: recordOfProcessingRouter,
  dsar: dsarRouter,
  incident: incidentRouter,
  vendor: vendorRouter,
  user: userRouter,
  businessUnit: businessUnitRouter,
  savedView: savedViewRouter,
  audit: auditRouter,
  regulations: regulationsRouter,
});

export type AppRouter = typeof appRouter;
