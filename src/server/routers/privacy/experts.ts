import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  searchExperts,
  getExpertById,
  getSpecializations,
  getCountries,
  getLanguages,
  getExpertTypes,
  contactExpert,
  getContactRequest,
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

  contact: protectedProcedure
    .input(
      z.object({
        expertId: z.string(),
        requesterName: z.string().min(1).max(200),
        requesterEmail: z.string().email(),
        requesterCompany: z.string().max(200).optional(),
        subject: z.string().min(1).max(500),
        message: z.string().max(5000).optional(),
        governingLaw: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return contactExpert(input);
    }),

  getContactRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      return getContactRequest(input.requestId);
    }),
});
