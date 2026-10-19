// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The words of the rights-request form DPO Central seeds for every new
 * organisation (server/services/dsar/defaultIntakeForm.ts). They are stored
 * in English; while a form still carries them unchanged, the public portal
 * shows them in the visitor's language instead (dsarPublic.form.header.default*,
 * success.defaultThankYou). Text a person has written is always shown as written.
 *
 * Plain strings only, safe in the browser.
 */

export const DEFAULT_INTAKE_TEXT = {
  title: "Data Subject Request",
  description: "Submit a request regarding your personal data",
  thankYouMessage:
    "Thank you for your request. We will process it within the legally required timeframe.",
} as const;

type Translate = (key: "header.defaultTitle" | "header.defaultDescription" | "success.defaultThankYou") => string;

/** The form's public words, with the untouched seeded defaults in the visitor's language. */
export function localizedIntakeText(
  form: { title: string; description: string | null; thankYouMessage: string | null },
  t: Translate
): { title: string; description: string | null; thankYouMessage: string | null } {
  return {
    title: form.title === DEFAULT_INTAKE_TEXT.title ? t("header.defaultTitle") : form.title,
    description:
      form.description === DEFAULT_INTAKE_TEXT.description ? t("header.defaultDescription") : form.description,
    thankYouMessage:
      form.thankYouMessage === DEFAULT_INTAKE_TEXT.thankYouMessage ? t("success.defaultThankYou") : form.thankYouMessage,
  };
}

/**
 * The reverse of `localizedIntakeText`, for the settings page: the seeded
 * defaults are shown there in the member's language, and saving them
 * unchanged stores the English originals again, so the portal keeps showing
 * each visitor their own language and the form still reads as not set up
 * (isIntakeConfigured). Anything else is stored as typed.
 */
export function storedIntakeText(
  values: { title: string; description: string; thankYouMessage: string },
  t: Translate
): { title: string; description: string; thankYouMessage: string } {
  return {
    title: values.title === t("header.defaultTitle") ? DEFAULT_INTAKE_TEXT.title : values.title,
    description:
      values.description === t("header.defaultDescription") ? DEFAULT_INTAKE_TEXT.description : values.description,
    thankYouMessage:
      values.thankYouMessage === t("success.defaultThankYou")
        ? DEFAULT_INTAKE_TEXT.thankYouMessage
        : values.thankYouMessage,
  };
}
