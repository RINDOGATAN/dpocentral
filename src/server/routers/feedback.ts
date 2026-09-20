// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

/**
 * In-app feedback.
 *
 * The row is the record, and the row is all this does. The daily digest at
 * 07:00 reads the feedback table of each tool and mails it to the address in
 * CONTACT_EMAIL, which is the inbox the operator already reads, so feedback
 * does reach a person without anything being sent from here.
 *
 * An instant copy was added on 2026-09-20 and removed the same day: it told
 * that inbox the same thing twice. A request for technical help still mails
 * the moment it arrives (see privacy/experts.ts) because a person is waiting
 * for an answer; feedback is a note to read tomorrow.
 */
export const feedbackRouter = createTRPCRouter({
  submit: publicProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        page: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Store the row. The digest reads the table; nothing is mailed here.
      await ctx.prisma.feedback.create({
        data: {
          message: input.message,
          page: input.page,
        },
      });

      return { success: true };
    }),
});
