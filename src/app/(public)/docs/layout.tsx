// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { DocsNav } from "./components/DocsNav";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* A sidebar of its own fixed width from tablet up: a fifth of a 768 px
          screen clipped the longer Spanish section names. */}
      <div className="grid grid-cols-1 md:grid-cols-[13rem_minmax(0,1fr)] gap-8 lg:gap-10">
        {/* Sidebar */}
        <aside>
          <div className="sticky top-24">
            <DocsNav />
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
