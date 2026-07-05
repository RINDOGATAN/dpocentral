/**
 * Input sanitization — baseline implementation in the open-source core.
 *
 * `stripHtml` and `sanitizeStrings` provide a real HTML-neutralizing
 * baseline on every build. When the optional @dpocentral/security package
 * is installed it layers stricter, allowlist-based sanitizers on top
 * (see src/server/trpc.ts `sanitizeInput`); without it, these defaults
 * still guarantee that no HTML markup survives into stored user input.
 *
 * Limitations (honest): this is tag-stripping plus angle-bracket escaping,
 * not a full HTML parser. It is designed for plain-text fields (names,
 * descriptions, notes) where markup is never legitimate — which is every
 * field it is applied to. It is NOT suitable for rich-text fields.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

/**
 * Strip HTML tags from a string, then escape any remaining angle brackets.
 *
 * Tag removal loops until stable so nested constructions like
 * `<<script>script>` cannot reassemble into a tag; whatever `<`/`>`
 * characters remain afterwards are entity-escaped so the result can never
 * be parsed as markup by any downstream sink (HTML email, PDF pipeline,
 * dangerouslySetInnerHTML misuse).
 */
export function stripHtml(input: string): string {
  let out = input;
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<[^>]*>/g, "");
  } while (out !== prev);
  return out.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Recursively apply `stripHtml` to every string in a value (objects,
 * arrays, and scalars). Non-string scalars, Dates, and null/undefined
 * pass through untouched. Used as the core fallback for
 * `sanitizeInput` in src/server/trpc.ts.
 */
export function sanitizeStrings<T>(input: T): T {
  if (typeof input === "string") {
    return stripHtml(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeStrings(item)) as unknown as T;
  }
  if (input !== null && typeof input === "object" && !(input instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = sanitizeStrings(value);
    }
    return out as unknown as T;
  }
  return input;
}

/**
 * Sanitize operator-supplied CSS destined for a `<style>` block on the
 * public DSAR portal (rendered via dangerouslySetInnerHTML).
 *
 * The only way CSS text can escape a `<style>` element is by containing
 * markup (`</style>` breaks out; `<` starts it). Legitimate CSS never
 * needs a literal `<`, so every `<` is rewritten to its CSS escape `\3c `
 * — inert in a stylesheet, impossible to parse as a tag. Additionally,
 * `@import` and legacy `expression(` are removed: the first can pull
 * remote stylesheets (exfiltration channel), the second executed script
 * in old engines. Everything else is left alone — colors, fonts, layout
 * all work.
 */
export function sanitizeCss(css: string): string {
  return css
    .replace(/</g, "\\3c ")
    .replace(/@import\b/gi, "/* @import removed */")
    .replace(/expression\s*\(/gi, "/* expression */(");
}
