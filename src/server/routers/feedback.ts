// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { sendInternalNotice } from "@/server/services/notifications/internal-inbox";

export const feedbackRouter = createTRPCRouter({
  submit: publicProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        page: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Store first, always. The row is the record; the copy below is how a
      // human finds out about it.
      const feedback = await ctx.prisma.feedback.create({
        data: {
          message: input.message,
          page: input.page,
        },
      });

      // Until 2026-09-20 the mutation ended here: every note anyone had ever
      // left sat unread in the feedback table. Send a copy to our inbox. This
      // never throws and never rolls the row back, so a mail failure costs the
      // notice, not the feedback.
      //
      // The sender is not identified beyond whether they were signed in: the
      // control asks for a message, not a name, and the table stores no
      // identity. Nothing more is added here.
      const signedIn = Boolean(ctx.session?.user);
      const receivedAt = feedback.createdAt ?? new Date();

      await sendInternalNotice({
        subject: "New in-app feedback",
        intro: "Someone left feedback through the control in the interface.",
        fields: [
          { label: "Page", value: input.page ?? "not recorded" },
          { label: "Signed in", value: signedIn ? "yes" : "no" },
          { label: "When", value: receivedAt.toISOString() },
        ],
        body: input.message,
        record: { feedbackId: feedback.id, page: input.page ?? null },
      });

      return { success: true };
    }),
});
