/**
 * Skill Plugin Type Definitions
 *
 * Defines the interface for premium skill plugins that can be loaded
 * dynamically. This allows the core application to remain AGPL-3.0
 * while premium features are provided as separate proprietary packages.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { AssessmentType } from "@prisma/client";
import type { ComponentType } from "react";

/**
 * Assessment template section structure
 */
export interface AssessmentTemplateSection {
  id: string;
  title: string;
  description?: string;
  questions: AssessmentTemplateQuestion[];
}

/**
 * Assessment template question structure
 */
export interface AssessmentTemplateQuestion {
  id: string;
  text: string;
  description?: string;
  type: "text" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "number" | "date";
  options?: { value: string; label: string; riskScore?: number }[];
  required?: boolean;
  riskWeight?: number;
  helpText?: string;
}

/**
 * Assessment template structure
 */
export interface AssessmentTemplate {
  id: string;
  name: string;
  description?: string;
  version: string;
  sections: AssessmentTemplateSection[];
  scoringLogic?: ScoringLogic;
}

/**
 * Scoring logic for risk calculations
 */
export interface ScoringLogic {
  method: "weighted_average" | "max" | "sum" | "custom";
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  customCalculator?: string; // Reference to custom function name
}

/**
 * Props for new assessment form component
 */
export interface NewAssessmentFormProps {
  organizationId: string;
  templateId?: string;
  processingActivityId?: string;
  vendorId?: string;
  onSubmit: (data: AssessmentFormData) => void;
  onCancel: () => void;
}

/**
 * Assessment form data submitted by form component
 */
export interface AssessmentFormData {
  name: string;
  description?: string;
  templateId: string;
  processingActivityId?: string;
  vendorId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Props for assessment report component
 */
export interface AssessmentReportProps {
  assessmentId: string;
  organizationId: string;
}

/**
 * Skill components interface
 */
export interface SkillComponents {
  /**
   * Component for creating new assessments
   */
  NewAssessmentForm?: ComponentType<NewAssessmentFormProps>;

  /**
   * Component for rendering assessment reports
   */
  AssessmentReport?: ComponentType<AssessmentReportProps>;
}

/**
 * Skill definition interface
 *
 * Each premium skill must implement this interface to be loaded
 * by the skill registry.
 */
export interface SkillDefinition {
  /**
   * Unique skill identifier in reverse domain notation
   * e.g., "com.nel.dpocentral.dpia"
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Detailed description of the skill's functionality
   */
  description?: string;

  /**
   * Version of the skill (semver)
   */
  version: string;

  /**
   * Associated assessment type (if this skill provides an assessment)
   */
  assessmentType?: AssessmentType;

  /**
   * Whether this skill requires a premium license
   */
  isPremium: boolean;

  /**
   * UI components provided by this skill
   */
  components?: SkillComponents;

  /**
   * Assessment templates provided by this skill
   */
  templates?: AssessmentTemplate[];

  /**
   * Hook called when skill is loaded
   */
  onLoad?: () => void | Promise<void>;

  /**
   * Hook called when skill is unloaded
   */
  onUnload?: () => void | Promise<void>;
}

/**
 * Skill metadata for registry listing
 */
export interface SkillMetadata {
  id: string;
  name: string;
  description?: string;
  version: string;
  assessmentType?: AssessmentType;
  isPremium: boolean;
  isLoaded: boolean;
}

/**
 * Skill package info from npm/external source
 */
export interface SkillPackageInfo {
  packageName: string;
  skillId: string;
  version: string;
  isInstalled: boolean;
}
