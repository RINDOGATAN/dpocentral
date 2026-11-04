// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getMessages } from "next-intl/server";
import { DOCS_NAMESPACE, pickNamespaces } from "@/i18n/client-messages";
import { ExtraMessages } from "@/components/intl/extra-messages";
import { DocsShell } from "./docs-shell";

/**
 * The user guide's messages ("docs") are left out of the catalogue every
 * page sends to the browser (src/i18n/client-messages.ts); this layout adds
 * them back for the guide's pages only.
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const messages = pickNamespaces(await getMessages(), [DOCS_NAMESPACE]);
  return (
    <ExtraMessages messages={messages}>
      <DocsShell>{children}</DocsShell>
    </ExtraMessages>
  );
}
