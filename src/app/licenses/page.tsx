// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.licenses");
  return {
    title: t("title"),
    description: t("description"),
  };
}

const SUPPORT_EMAIL = "support@rindogatan.com";

// Appropriate Legal Notices (AGPL-3.0 §5(d)) and the offer of Corresponding
// Source (AGPL-3.0 §13). Static server component: no data fetching, no auth,
// no client hooks. The notices are shown in the reader's language; the
// licence itself (the LICENSE file) is the English original.
export default async function LicensesPage() {
  const t = await getTranslations("licenses");
  const SOURCE =
    process.env.NEXT_PUBLIC_SOURCE_URL ||
    "https://github.com/RINDOGATAN/dpocentral";
  const COMMIT =
    process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  const sourceUrl = COMMIT ? `${SOURCE}/tree/${COMMIT}` : SOURCE;
  // The source repository is public, so the §13 corresponding-source link
  // resolves by default. Set NEXT_PUBLIC_SOURCE_PUBLIC=false to fall back to the
  // offer-on-request text (e.g. a white-label build from a private fork).
  const SOURCE_PUBLIC = process.env.NEXT_PUBLIC_SOURCE_PUBLIC !== "false";

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>

      <section className="space-y-3 text-sm leading-relaxed text-foreground">
        <p>DPO Central</p>
        <p>Copyright (C) 2025-2026 Rindogatan LLC</p>
        <p>{t("licensed")}</p>
        <p className="font-medium">{t("noWarranty")}</p>
        <p className="text-muted-foreground">
          {t.rich("freeSoftware", {
            file: (chunks) =>
              SOURCE_PUBLIC ? (
                <a
                  href={`${SOURCE}/blob/main/LICENSE`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {chunks}
                </a>
              ) : (
                <span className="font-medium text-foreground">{chunks}</span>
              ),
          })}
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-foreground">
        <h2 className="text-lg font-semibold">{t("sourceTitle")}</h2>
        {SOURCE_PUBLIC ? (
          <>
            <p>{t("sourcePublic")}</p>
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
            {t.rich("sourceOnRequest", {
              commit: COMMIT ? t("commit", { commit: COMMIT }) : "",
              email: SUPPORT_EMAIL,
              mail: (chunks) => (
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=AGPL%20corresponding%20source%20request`}
                  className="underline hover:text-foreground"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        )}
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">{t("premiumTitle")}</h2>
        <p>
          {t.rich("premiumBody", {
            b: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
          })}
        </p>
      </section>

      <footer className="pt-4 border-t border-border text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <span aria-hidden>&larr; </span>
          {t("back")}
        </Link>
      </footer>
    </main>
  );
}
