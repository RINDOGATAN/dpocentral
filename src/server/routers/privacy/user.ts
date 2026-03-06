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
});
