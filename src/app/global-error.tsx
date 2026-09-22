"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Last line: shown when the root layout itself fails, so nothing from it is
 * available (no translations, no theme, no styles). Self-contained, in both
 * product languages, with a way back, a reference and the way to report.
 */

import { useEffect, useState } from "react";
import { newErrorReference } from "@/lib/error-reference";

const box: React.CSSProperties = {
  maxWidth: 520,
  margin: "12vh auto",
  padding: "32px 24px",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  lineHeight: 1.5,
  color: "#e5e5e5",
  background: "#111",
  border: "1px solid #444",
  borderRadius: 12,
  textAlign: "center",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reference] = useState(() => error.digest || newErrorReference());

  useEffect(() => {
    console.error(`[error ref ${reference}]`, error);
  }, [error, reference]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0a", padding: "0 16px" }}>
        <main style={box}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 4px" }}>This page could not be shown. Your saved records are not affected.</p>
          <p lang="es" style={{ margin: "0 0 20px", color: "#a3a3a3" }}>
            No se ha podido mostrar esta página. Tus registros guardados no se ven afectados.
          </p>
          <p style={{ margin: "0 0 20px" }}>
            <button
              type="button"
              onClick={reset}
              style={{ padding: "8px 16px", marginRight: 8, cursor: "pointer" }}
            >
              Try again · Volver a intentarlo
            </button>
            {/* A full page load on purpose: the root layout has failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "#e5e5e5" }}>
              Home · Inicio
            </a>
          </p>
          <p style={{ fontFamily: "monospace", margin: 0, wordBreak: "break-all" }} data-testid="error-reference">
            Reference · Referencia: {reference}
          </p>
          <p style={{ fontSize: 13, color: "#a3a3a3", margin: "4px 0 12px" }}>
            If it happens again, report it and quote this reference. · Si vuelve a ocurrir, notifícalo indicando esta referencia.
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>
            <a href="/docs#support" style={{ color: "#e5e5e5" }}>
              How to report a problem · Cómo notificar un problema
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
