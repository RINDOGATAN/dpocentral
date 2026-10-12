"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one search box in the top bar: record names across the programme
 * (systems, processing activities, vendors, assessments, incidents and rights
 * requests). The server decides what the reader may find (search.names,
 * src/server/routers/privacy/search.ts); this only shows it.
 *
 * On a phone the box opens from a magnifier button as a row under the bar.
 * Keyboard: arrows move through the results, Enter opens one, Escape closes.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { formatIncidentRef } from "@/lib/incident-ref";
import { formatRequestRef } from "@/lib/request-ref";
import { cn } from "@/lib/utils";
import type { SearchHit, SearchKind } from "@/server/routers/privacy/search";

const KIND_ORDER: SearchKind[] = ["system", "activity", "vendor", "assessment", "incident", "request"];

/** The shortest query the server accepts. */
export const SEARCH_MIN_LENGTH = 2;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function GlobalSearch({ className }: { className?: string }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const { organization } = useOrganization();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const term = useDebounced(q.trim(), 250);
  const enabled = !!organization?.id && term.length >= SEARCH_MIN_LENGTH;
  const { data, isFetching } = trpc.search.names.useQuery(
    { organizationId: organization?.id ?? "", q: term },
    { enabled, staleTime: 30_000 }
  );

  // Grouped in a fixed order; `flat` is the keyboard order.
  const groups = useMemo(() => {
    const hits = enabled ? data ?? [] : [];
    return KIND_ORDER.map((kind) => ({ kind, hits: hits.filter((h) => h.kind === kind) })).filter(
      (g) => g.hits.length > 0
    );
  }, [data, enabled]);
  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);

  useEffect(() => setActive(0), [term]);

  // Close on a click outside.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(hit: SearchHit) {
    setOpen(false);
    setPhoneOpen(false);
    setQ("");
    router.push(hit.href);
  }

  function label(hit: SearchHit): string {
    if (hit.kind === "incident" && hit.publicId) return `${formatIncidentRef(hit.publicId)} · ${hit.name}`;
    if (hit.kind === "request" && hit.publicId) return `${formatRequestRef(hit.publicId, locale)} · ${hit.name}`;
    return hit.name;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setPhoneOpen(false);
      return;
    }
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) go(hit);
    }
  }

  const showPanel = open && q.trim().length >= SEARCH_MIN_LENGTH;
  const waiting = q.trim() !== term || isFetching;

  const box = (
    <div ref={boxRef} className="relative w-full" data-testid="global-search">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t("placeholder")}
        aria-label={t("label")}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && flat[active] ? `${listId}-${active}` : undefined}
        maxLength={100}
        className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="global-search-input"
      />
      {waiting && showPanel && (
        <Loader2
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}
      {showPanel && (
        <div
          id={listId}
          role="listbox"
          aria-label={t("results")}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          data-testid="global-search-results"
        >
          {!waiting && flat.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            groups.map((g) => (
              <div key={g.kind} role="group" aria-label={t(`kinds.${g.kind}`)}>
                <p className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t(`kinds.${g.kind}`)}
                </p>
                {g.hits.map((hit) => {
                  const index = flat.indexOf(hit);
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      id={`${listId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(hit)}
                      className={cn(
                        "block w-full truncate rounded px-3 py-2 text-left text-sm min-h-9",
                        index === active ? "bg-muted" : "hover:bg-muted/60"
                      )}
                    >
                      {label(hit)}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          <p className="px-3 pt-1 pb-1.5 text-[11px] text-muted-foreground border-t border-border mt-1">
            {t("namesOnly")}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* From sm up: the box in the bar. */}
      {!phoneOpen && <div className={cn("hidden sm:block w-full max-w-md", className)}>{box}</div>}
      {/* On a phone: a button that opens the box as a row under the bar. */}
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden shrink-0"
        onClick={() => {
          setPhoneOpen((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-expanded={phoneOpen}
        data-testid="global-search-phone"
      >
        {phoneOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
        <span className="sr-only">{t("label")}</span>
      </Button>
      {phoneOpen && (
        <div className="sm:hidden absolute left-0 right-0 top-14 z-50 border-b border-border bg-background px-4 py-2">
          {box}
        </div>
      )}
    </>
  );
}
