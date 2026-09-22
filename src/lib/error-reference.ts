// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reference ids for failures a person sees.
 *
 * An unexpected failure shows a short reference instead of a stack trace;
 * the same reference is written to the log with the real error, so a
 * report that quotes it leads straight to the cause. Used by the tRPC error
 * formatter (server) and the error pages (browser). See
 * docs/status-and-support.md.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

/** "E-" and eight upper-case hex digits, e.g. "E-3F9A01C2". */
export function newErrorReference(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return `E-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * What a person reads when the server refuses what they entered (input
 * validation), instead of the validator's raw JSON: which fields to fix.
 */
export function invalidInputMessage(locale: "en" | "es", fields: string[]): string {
  const list = fields.length > 0 ? ` (${fields.join(", ")})` : "";
  return locale === "es"
    ? `Parte de la información introducida no es válida${list}. Corrígela y vuelve a intentarlo.`
    : `Some of the information entered is not valid${list}. Please correct it and try again.`;
}

/**
 * What a person reads when a procedure fails unexpectedly: what happened,
 * what to do, and the reference to quote.
 */
export function unexpectedFailureMessage(locale: "en" | "es", reference: string): string {
  return locale === "es"
    ? `Algo ha fallado por nuestra parte y no se ha podido completar. Vuelve a intentarlo en un momento. Si vuelve a ocurrir, avísanos desde «Comentarios» indicando la referencia ${reference}.`
    : `Something went wrong on our side, so this could not be completed. Please try again in a moment. If it happens again, tell us through Feedback and quote the reference ${reference}.`;
}
