// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { UserType } from "@prisma/client";

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
      const user = await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { userType: input.userType },
        select: { id: true, userType: true },
      });
      return user;
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
