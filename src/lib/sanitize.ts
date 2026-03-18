/**
 * Input sanitization stubs
 *
 * When @dpocentral/security is installed, these are replaced with
 * real HTML-stripping sanitizers. Without it, inputs pass through unchanged.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

/** Strip HTML tags from a string (no-op without security package) */
export function stripHtml(input: string): string {
  return input;
}
