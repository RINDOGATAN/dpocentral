import { createTRPCRouter } from "../trpc";
import { organizationRouter } from "./privacy/organization";
import { dataInventoryRouter } from "./privacy/dataInventory";
import { dsarRouter } from "./privacy/dsar";
import { assessmentRouter } from "./privacy/assessment";
import { incidentRouter } from "./privacy/incident";
import { vendorRouter } from "./privacy/vendor";
import { platformAdminRouter } from "./platformAdmin";
import { vendorCatalogRouter } from "./vendorCatalog";

export const appRouter = createTRPCRouter({
  organization: organizationRouter,
  dataInventory: dataInventoryRouter,
  dsar: dsarRouter,
  assessment: assessmentRouter,
  incident: incidentRouter,
  vendor: vendorRouter,
  platformAdmin: platformAdminRouter,
  vendorCatalog: vendorCatalogRouter,
});

export type AppRouter = typeof appRouter;
