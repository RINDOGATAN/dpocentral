-- Rights-request deadline reminders. Additive only: one enum, two columns
-- with safe defaults and one new table; nothing is rewritten.
--
-- organizations.dsarRemindersEnabled: each organisation can switch the
--   reminder e-mails off; on by default, so existing organisations get them.
-- users.locale: the language a person last used in the app, so an e-mail
--   sent by the daily job (no request in progress) is in that language.
--   Null until the person next uses the app; null reads as English.
-- dsar_reminders: one row per reminder sent, unique per request, kind and
--   due date, so a reminder never goes out twice and an extended deadline is
--   reminded again.

-- CreateEnum
CREATE TYPE "DsarReminderKind" AS ENUM ('DAYS_7', 'DAYS_3', 'DAYS_1', 'OVERDUE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "locale" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "dsarRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "dsar_reminders" (
    "id" TEXT NOT NULL,
    "dsarRequestId" TEXT NOT NULL,
    "kind" "DsarReminderKind" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dsar_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dsar_reminders_dsarRequestId_kind_dueDate_key" ON "dsar_reminders"("dsarRequestId", "kind", "dueDate");

-- AddForeignKey
ALTER TABLE "dsar_reminders" ADD CONSTRAINT "dsar_reminders_dsarRequestId_fkey" FOREIGN KEY ("dsarRequestId") REFERENCES "dsar_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
