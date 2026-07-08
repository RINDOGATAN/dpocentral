// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Licence & source",
  description:
    "DPO Central licensing, warranty disclaimer, and the AGPL corresponding-source offer.",
};

// Appropriate Legal Notices (AGPL-3.0 §5(d)) and the offer of Corresponding
// Source (AGPL-3.0 §13). Static server component — no data fetching, no auth,
// no client hooks.
export default function LicensesPage() {
  const SOURCE =
    process.env.NEXT_PUBLIC_SOURCE_URL ||
    "https://github.com/RINDOGATAN/dpocentral";
  const COMMIT =
    process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  const sourceUrl = COMMIT ? `${SOURCE}/tree/${COMMIT}` : SOURCE;
  // The source repository is not public yet. Until it is, show an
  // at-no-charge offer-on-request instead of a link that would 404. Flip
  // NEXT_PUBLIC_SOURCE_PUBLIC=true once the repo is published.
  const SOURCE_PUBLIC = process.env.NEXT_PUBLIC_SOURCE_PUBLIC === "true";

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Licence &amp; source
        </h1>
        <p className="text-sm text-muted-foreground">
          Legal notices for this program, as required by the GNU Affero General
          Public License.
        </p>
      </header>

      <section className="space-y-3 text-sm leading-relaxed text-foreground">
        <p>DPO Central</p>
        <p>Copyright (C) 2025-2026 Rindogatan LLC</p>
        <p>
          Licensed under the GNU Affero General Public License, version 3 or
          later (AGPL-3.0-or-later).
        </p>
        <p className="font-medium">
          This program comes with ABSOLUTELY NO WARRANTY.
        </p>
        <p className="text-muted-foreground">
          This is free software, and you are welcome to redistribute it under
          the conditions of the AGPL-3.0-or-later. See the full licence text in
          the{" "}
          {SOURCE_PUBLIC ? (
            <a
              href={`${SOURCE}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              LICENSE
            </a>
          ) : (
            <span className="font-medium text-foreground">LICENSE</span>
          )}{" "}
          file distributed with the source.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-foreground">
        <h2 className="text-lg font-semibold">Complete corresponding source code</h2>
        {SOURCE_PUBLIC ? (
          <>
            <p>
              In accordance with AGPL-3.0 section 13, the complete corresponding
              source code for this running instance is available at:
            </p>
            <p>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline break-all hover:text-foreground"
              >
                {sourceUrl}
              </a>
            </p>
          </>
        ) : (
          <p>
            In accordance with AGPL-3.0 section 13, the complete corresponding
            source code for the version running here
            {COMMIT ? ` (commit ${COMMIT})` : ""} is available to you at no
            charge. The public source repository is being finalised; until it is
            published, request the corresponding source by emailing{" "}
            <a
              href="mailto:support@rindogatan.com?subject=AGPL%20corresponding%20source%20request"
              className="underline hover:text-foreground"
            >
              support@rindogatan.com
            </a>{" "}
            and we will provide it.
          </p>
        )}
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">Premium skills</h2>
        <p>
          Certain premium skills and add-ons are separately licensed and are{" "}
          <span className="font-medium text-foreground">not</span> covered by the
          AGPL. They are not part of the corresponding source offered above.
        </p>
      </section>

      <footer className="pt-4 border-t border-border text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to DPO Central
        </Link>
      </footer>
    </main>
  );
}
