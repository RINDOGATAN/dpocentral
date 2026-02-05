/**
 * Skill Registry
 *
 * Central registry for managing skill plugins. Skills can be registered
 * statically (built-in) or loaded dynamically from external packages.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import type { AssessmentType } from "@prisma/client";
import type { SkillDefinition, SkillMetadata } from "./types";

/**
 * Internal skill storage
 */
const skills = new Map<string, SkillDefinition>();

/**
 * Register a skill in the registry
 */
export function registerSkill(skill: SkillDefinition): void {
  if (skills.has(skill.id)) {
    console.warn(`Skill ${skill.id} is already registered. Overwriting.`);
  }
  skills.set(skill.id, skill);
  console.log(`Registered skill: ${skill.id} v${skill.version}`);
}

/**
 * Unregister a skill from the registry
 */
export async function unregisterSkill(skillId: string): Promise<boolean> {
  const skill = skills.get(skillId);
  if (!skill) {
    return false;
  }

  // Call unload hook if defined
  if (skill.onUnload) {
    await skill.onUnload();
  }

  skills.delete(skillId);
  console.log(`Unregistered skill: ${skillId}`);
  return true;
}

/**
 * Get a skill by ID
 */
export function getSkill(skillId: string): SkillDefinition | undefined {
  return skills.get(skillId);
}

/**
 * Get a skill by assessment type
 */
export function getSkillByAssessmentType(
  assessmentType: AssessmentType
): SkillDefinition | undefined {
  for (const skill of skills.values()) {
    if (skill.assessmentType === assessmentType) {
      return skill;
    }
  }
  return undefined;
}

/**
 * Get all registered skills
 */
export function getAllSkills(): SkillDefinition[] {
  return Array.from(skills.values());
}

/**
 * Get skill metadata for all registered skills
 */
export function getSkillMetadata(): SkillMetadata[] {
  return Array.from(skills.values()).map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    assessmentType: skill.assessmentType,
    isPremium: skill.isPremium,
    isLoaded: true,
  }));
}

/**
 * Check if a skill is registered
 */
export function hasSkill(skillId: string): boolean {
  return skills.has(skillId);
}

/**
 * Get skills by premium status
 */
export function getSkillsByPremiumStatus(isPremium: boolean): SkillDefinition[] {
  return Array.from(skills.values()).filter(
    (skill) => skill.isPremium === isPremium
  );
}

/**
 * Get assessment templates from all registered skills
 */
export function getAllAssessmentTemplates() {
  const templates: Array<{
    skillId: string;
    template: NonNullable<SkillDefinition["templates"]>[number];
  }> = [];

  for (const skill of skills.values()) {
    if (skill.templates) {
      for (const template of skill.templates) {
        templates.push({ skillId: skill.id, template });
      }
    }
  }

  return templates;
}

/**
 * Get the component for creating a new assessment
 */
export function getNewAssessmentFormComponent(
  assessmentType: AssessmentType
): SkillDefinition["components"] extends { NewAssessmentForm?: infer T }
  ? T | undefined
  : undefined {
  const skill = getSkillByAssessmentType(assessmentType);
  return skill?.components?.NewAssessmentForm as
    | SkillDefinition["components"] extends { NewAssessmentForm?: infer T }
    ? T | undefined
    : undefined;
}

/**
 * Get the component for rendering an assessment report
 */
export function getAssessmentReportComponent(
  assessmentType: AssessmentType
): SkillDefinition["components"] extends { AssessmentReport?: infer T }
  ? T | undefined
  : undefined {
  const skill = getSkillByAssessmentType(assessmentType);
  return skill?.components?.AssessmentReport as
    | SkillDefinition["components"] extends { AssessmentReport?: infer T }
    ? T | undefined
    : undefined;
}
