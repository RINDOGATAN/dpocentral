// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createTRPCRouter } from "../trpc";
import { organizationRouter } from "./privacy/organization";
import { dataInventoryRouter } from "./privacy/dataInventory";
import { dsarRouter } from "./privacy/dsar";
import { assessmentRouter } from "./privacy/assessment";
import { incidentRouter } from "./privacy/incident";
import { vendorRouter } from "./privacy/vendor";
import { platformAdminRouter } from "./platformAdmin";
import { vendorCatalogRouter } from "./vendorCatalog";
import { billingRouter } from "./billing";
import { feedbackRouter } from "./feedback";
import { quickstartRouter } from "./privacy/quickstart";
import { programPathRouter } from "./privacy/programPath";
import { boardReportRouter } from "./privacy/boardReport";
import { draftsRouter } from "./privacy/drafts";
import { userRouter } from "./privacy/user";
import { expertsRouter } from "./privacy/experts";
import { clientsRouter } from "./privacy/clients";
import { clientTemplateRouter } from "./privacy/clientTemplate";
import { notificationRouter } from "./privacy/notification";
import { reportsRouter } from "./privacy/reports";
import { regulationsRouter } from "./privacy/regulations";
import { aiGovernanceRouter } from "./privacy/aiGovernance";
import { aiRouter } from "./privacy/ai";
import { businessUnitRouter } from "./privacy/businessUnit";
import { savedViewRouter } from "./privacy/savedView";
import { viewsRouter } from "./privacy/views";
import { skillsRouter } from "./skills";
import { diagnosticsRouter } from "./diagnostics";

export const appRouter = createTRPCRouter({
  organization: organizationRouter,
  dataInventory: dataInventoryRouter,
  dsar: dsarRouter,
  assessment: assessmentRouter,
  incident: incidentRouter,
  vendor: vendorRouter,
  platformAdmin: platformAdminRouter,
  vendorCatalog: vendorCatalogRouter,
  billing: billingRouter,
  feedback: feedbackRouter,
  quickstart: quickstartRouter,
  programPath: programPathRouter,
  boardReport: boardReportRouter,
  drafts: draftsRouter,
  user: userRouter,
  experts: expertsRouter,
  clients: clientsRouter,
  clientTemplate: clientTemplateRouter,
  notification: notificationRouter,
  reports: reportsRouter,
  regulations: regulationsRouter,
  aiGovernance: aiGovernanceRouter,
  ai: aiRouter,
  businessUnit: businessUnitRouter,
  savedView: savedViewRouter,
  views: viewsRouter,
  skills: skillsRouter,
  diagnostics: diagnosticsRouter,
});

export type AppRouter = typeof appRouter;
