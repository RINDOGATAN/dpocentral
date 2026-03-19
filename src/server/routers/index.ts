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
import { userRouter } from "./privacy/user";
import { expertsRouter } from "./privacy/experts";
import { clientsRouter } from "./privacy/clients";
import { notificationRouter } from "./privacy/notification";
import { reportsRouter } from "./privacy/reports";
import { regulationsRouter } from "./privacy/regulations";
import { aiGovernanceRouter } from "./privacy/aiGovernance";

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
  user: userRouter,
  experts: expertsRouter,
  clients: clientsRouter,
  notification: notificationRouter,
  reports: reportsRouter,
  regulations: regulationsRouter,
  aiGovernance: aiGovernanceRouter,
});

export type AppRouter = typeof appRouter;
