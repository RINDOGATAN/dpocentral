// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Skills Module Index
 *
 * Re-exports all skill-related functionality for convenient importing.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

// Types
export type {
  SkillDefinition,
  SkillMetadata,
  SkillPackageInfo,
  SkillComponents,
  AssessmentTemplate,
  AssessmentTemplateSection,
  AssessmentTemplateQuestion,
  ScoringLogic,
  NewAssessmentFormProps,
  AssessmentFormData,
  AssessmentReportProps,
} from "./types";

// Registry functions
export {
  registerSkill,
  unregisterSkill,
  getSkill,
  getSkillByAssessmentType,
  getAllSkills,
  getSkillMetadata,
  hasSkill,
  getSkillsByPremiumStatus,
  getAllAssessmentTemplates,
  getNewAssessmentFormComponent,
  getAssessmentReportComponent,
} from "./registry";

// Loader functions
export {
  loadSkillsFromPackage,
  loadPremiumSkills,
  loadSkillsFromPackages,
  isPremiumSkillsAvailable,
  getLoadedPackages,
} from "./loader";
