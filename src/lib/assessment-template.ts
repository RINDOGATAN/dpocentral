// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Choosing an assessment template should not be a step when there is nothing to
// choose. Once a (non-premium, unlocked) type is picked, `listTemplates` returns
// the templates that type offers; when it returns exactly one, that one is the
// answer and the picker is skipped. A person's explicit choice always wins.

/**
 * The template id to create the assessment with. An explicit selection wins;
 * otherwise a single available template is chosen automatically; otherwise
 * empty (the picker is shown, or none exists yet).
 */
export function resolveAutoTemplateId(
  selectedTemplateId: string,
  templates: ReadonlyArray<{ id: string }> | undefined | null,
): string {
  if (selectedTemplateId) return selectedTemplateId;
  if (templates && templates.length === 1) return templates[0].id;
  return "";
}
