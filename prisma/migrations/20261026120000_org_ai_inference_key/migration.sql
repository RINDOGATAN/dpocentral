-- An organisation's own API inference key for the AI features. The key is
-- stored encrypted (AES-256-GCM); only its last four characters are kept in
-- clear, for display. Additive: every column is nullable.
ALTER TABLE "organization_ai_settings" ADD COLUMN "keyProvider" TEXT;
ALTER TABLE "organization_ai_settings" ADD COLUMN "keyBaseUrl" TEXT;
ALTER TABLE "organization_ai_settings" ADD COLUMN "keyModel" TEXT;
ALTER TABLE "organization_ai_settings" ADD COLUMN "keyCiphertext" TEXT;
ALTER TABLE "organization_ai_settings" ADD COLUMN "keyIv" TEXT;
ALTER TABLE "organization_ai_settings" ADD COLUMN "keyLast4" TEXT;
ALTER TABLE "organization_ai_settings" ADD COLUMN "keySetById" TEXT;
ALTER TABLE "organization_ai_settings" ADD COLUMN "keySetAt" TIMESTAMP(3);
