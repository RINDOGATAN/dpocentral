// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { UserType } from "@prisma/client";
import { locales } from "@/i18n/config";

/**
 * A business account works for one organisation: its menu leaves out "All
 * clients". Switching to it is refused while the person still belongs to more
 * than one (the settings page says the same before anything is sent).
 */
export const BUSINESS_NEEDS_ONE_ORGANIZATION =
  "To switch to a business account, first delete all your organizations but one.";

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, name: true, email: true, userType: true },
    });
    return user;
  }),

  setUserType: protectedProcedure
    .input(z.object({ userType: z.nativeEnum(UserType) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userType === UserType.BUSINESS_OWNER) {
        const organizations = await ctx.prisma.organizationMember.count({
          where: { userId: ctx.session.user.id },
        });
        if (organizations > 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: BUSINESS_NEEDS_ONE_ORGANIZATION });
        }
      }
      const user = await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { userType: input.userType },
        select: { id: true, userType: true },
      });
      return user;
    }),

  /**
   * The language saved on the account, so a person signing in on a new
   * browser (no language cookie yet) gets the language they chose before.
   */
  getLocale: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { locale: true },
    });
    return { locale: user?.locale ?? null };
  }),

  /** Save the language a person chose on the account (as well as in the browser cookie). */
  setLocale: protectedProcedure
    .input(z.object({ locale: z.enum(locales) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { locale: input.locale },
        select: { id: true },
      });
      return { locale: input.locale };
    }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { name: input.name },
        select: { id: true, name: true },
      });
      return user;
    }),
});
