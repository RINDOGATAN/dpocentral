-- Incidents recorded in error: kept in the register, left out of every count.
ALTER TABLE "incidents" ADD COLUMN "recordedInErrorAt" TIMESTAMP(3),
ADD COLUMN "recordedInErrorById" TEXT,
ADD COLUMN "recordedInErrorReason" TEXT;
