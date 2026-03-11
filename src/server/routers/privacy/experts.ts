import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  searchExperts,
  getExpertById,
  getSpecializations,
  getCountries,
  getLanguages,
  getExpertTypes,
} from "../../services/dealroom/client";

export const expertsRouter = createTRPCRouter({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        specialization: z.string().optional(),
        country: z.string().optional(),
        language: z.string().optional(),
        expertType: z.enum(["legal", "technical", "deployment"]).optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      return searchExperts(input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getExpertById(input.id);
    }),

  listFilters: protectedProcedure.query(async () => {
    return {
      specializations: getSpecializations(),
      countries: getCountries(),
      languages: getLanguages(),
      expertTypes: getExpertTypes(),
    };
  }),
});
