// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Globe, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import DpoCentralLogo from "./DpoCentralLogo";

interface StartupsHeaderProps {
  t: (key: string) => string;
  locale: "en" | "es";
  onLocaleToggle: () => void;
  onSignup: () => void;
}

const MENU_ID = "landing-phone-menu";

const StartupsHeader = ({ t, locale, onLocaleToggle, onSignup }: StartupsHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setIsMenuOpen(false);

  // The phone menu closes on Escape (focus back on its button) and on a tap
  // outside the header.
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [isMenuOpen]);

  const menuLabel = t(isMenuOpen ? "header.menuClose" : "header.menuOpen");

  return (
    <header ref={headerRef} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl">
      {/* Opaque while the phone menu is open, so the hero does not show
          through the menu's links. */}
      <div className={`nav-header px-6 ${isMenuOpen ? "!bg-card !backdrop-blur-none" : ""}`}>
        <div className="flex items-center justify-between h-14">
          <DpoCentralLogo productOf={t("header.productOf")} />

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={onLocaleToggle}
              lang={locale === "en" ? "es" : "en"}
              aria-label={locale === "en" ? "Español" : "English"}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="w-4 h-4" aria-hidden="true" />
              {locale === "en" ? "ES" : "EN"}
            </button>
            <button type="button" onClick={onSignup} className="btn-primary text-sm py-2 px-4">
              {t("header.cta")}
            </button>
          </div>

          <button
            ref={toggleRef}
            type="button"
            className="md:hidden p-2"
            aria-label={menuLabel}
            aria-expanded={isMenuOpen}
            aria-controls={MENU_ID}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>

        {isMenuOpen && (
          <div id={MENU_ID} className="md:hidden py-4 px-2 border-t border-border">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                lang={locale === "en" ? "es" : "en"}
                onClick={() => { onLocaleToggle(); closeMenu(); }}
                className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-2"
              >
                <Globe className="w-4 h-4" aria-hidden="true" />
                {locale === "en" ? "Español" : "English"}
              </button>
              <button
                type="button"
                onClick={() => { onSignup(); closeMenu(); }}
                className="btn-primary text-sm py-2 px-4"
              >
                {t("header.cta")}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default StartupsHeader;
