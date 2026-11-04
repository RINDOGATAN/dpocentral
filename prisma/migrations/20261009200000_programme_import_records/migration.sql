-- Programme portability (owner's decision, 9 October 2026; the EU Data Act,
-- Chapter VI, switching and export): src/server/services/portability.
--
-- Additive only: one enum value, one new table and its indexes. Nothing is
-- rewritten, dropped or retyped, and no existing row changes.
--
-- Provenance 'IMPORTED': a data asset, processing activity or vendor brought
--   in by an import. It is a draft until a person confirms it (as a template
--   record is), but "Remove all template items" never touches it.
-- programme_import_records: one row per record an import created (a full
--   programme from another DPO Central, or a register from a CSV file), keyed
--   by the register and the record's id at the source. It makes an import
--   idempotent (running it again creates nothing new) and lets references
--   between records be mapped across separate imports. It is never used to
--   overwrite a record. Deleted with the organisation.

-- AlterEnum
ALTER TYPE "Provenance" ADD VALUE 'IMPORTED';

-- CreateTable
CREATE TABLE "programme_import_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programme_import_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programme_import_records_organizationId_importId_idx" ON "programme_import_records"("organizationId", "importId");

-- CreateIndex
CREATE UNIQUE INDEX "programme_import_records_organizationId_kind_sourceKey_key" ON "programme_import_records"("organizationId", "kind", "sourceKey");

-- AddForeignKey
ALTER TABLE "programme_import_records" ADD CONSTRAINT "programme_import_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
