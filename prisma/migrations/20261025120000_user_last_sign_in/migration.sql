-- Hosted service: the last sign-in of each account, for the twelve-month
-- inactivity rule of pilot organisations (DPA clause 13). Additive.
ALTER TABLE "users" ADD COLUMN "lastSignInAt" TIMESTAMP(3);
