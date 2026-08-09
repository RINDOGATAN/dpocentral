// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

export * from "./types";
export { getDpaPack, localize } from "./pack";
export {
  applyFactDefaults,
  missingRequiredFacts,
  buildVariables,
  governingLawDisplay,
  customGoverningLaw,
  formatLongDate,
  NAME_PLACEHOLDER,
} from "./variables";
export {
  interpolateTokens,
  interpolateCurly,
  evalShowIf,
  findUnfilledTokens,
} from "./interpolate";
export { assembleDpa, assembleStandaloneTia, DpaEngineError } from "./assemble";
export { checkFactConsistency } from "./consistency";
export { mapVendorToDpaInputs } from "./mapper";
export type { MapperInput, MappedDpaInputs } from "./mapper";
export { deriveObligations, earliestObligationDue } from "./obligations";
export type { DerivedObligation, ObligationCadence } from "./obligations";
