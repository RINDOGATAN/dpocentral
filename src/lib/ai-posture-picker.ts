// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What the AI posture picker lets an admin do. An organization that declares
 * a US state cannot use AI (the server refuses every AI call and every
 * posture other than "off"), but it can still switch AI off, so the picker
 * offers "off" alone and the save flow stays reachable for that change.
 */

export interface PickerState {
  isAdmin: boolean;
  pending: boolean;
  usJurisdictionBlocked: boolean;
  /** The posture currently chosen in the picker. */
  posture: string;
  /** Whether the admin has changed the picker since it loaded. */
  dirty: boolean;
}

/** Whether a posture can be chosen in the list. */
export function isPostureSelectable(posture: string, usJurisdictionBlocked: boolean): boolean {
  return !usJurisdictionBlocked || posture === "off";
}

/** Whether the picker itself is disabled. */
export function isPickerDisabled(s: PickerState): boolean {
  if (!s.isAdmin || s.pending) return true;
  // Blocked and already off: there is nothing it could be changed to.
  return s.usJurisdictionBlocked && s.posture === "off" && !s.dirty;
}

/** Whether the acknowledgement and save controls are shown. */
export function showPostureSave(s: PickerState): boolean {
  return s.isAdmin && s.dirty && (!s.usJurisdictionBlocked || s.posture === "off");
}
