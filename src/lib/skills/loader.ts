/**
 * Skill Loader
 *
 * Handles dynamic loading of skill packages from external sources.
 * Premium skills are loaded from the @dpocentral/premium-skills package
 * or other configured skill packages.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import type { SkillDefinition } from "./types";
import { registerSkill, hasSkill } from "./registry";

/**
 * Default premium skills package name
 */
const PREMIUM_SKILLS_PACKAGE = "@dpocentral/premium-skills";

/**
 * Loaded package cache to prevent duplicate loading
 */
const loadedPackages = new Set<string>();

/**
 * Load skills from a package
 *
 * This function attempts to dynamically import a skill package.
 * If the package is not installed, it gracefully returns without error.
 *
 * @param packageName - npm package name to load skills from
 * @returns Array of loaded skill IDs, or empty array if package not found
 */
export async function loadSkillsFromPackage(
  packageName: string = PREMIUM_SKILLS_PACKAGE
): Promise<string[]> {
  // Skip if already loaded
  if (loadedPackages.has(packageName)) {
    console.log(`Package ${packageName} already loaded`);
    return [];
  }

  const loadedSkillIds: string[] = [];

  try {
    // Attempt dynamic import
    // Note: In production, this would use actual dynamic imports
    // For now, we use a try-catch to gracefully handle missing packages
    const skillModule = await import(/* webpackIgnore: true */ packageName);

    // Check if module exports skills
    if (skillModule.skills && Array.isArray(skillModule.skills)) {
      for (const skill of skillModule.skills as SkillDefinition[]) {
        if (!hasSkill(skill.id)) {
          // Call onLoad hook if defined
          if (skill.onLoad) {
            await skill.onLoad();
          }
          registerSkill(skill);
          loadedSkillIds.push(skill.id);
        }
      }
    }

    // Check for default export
    if (skillModule.default) {
      if (Array.isArray(skillModule.default)) {
        for (const skill of skillModule.default as SkillDefinition[]) {
          if (!hasSkill(skill.id)) {
            if (skill.onLoad) {
              await skill.onLoad();
            }
            registerSkill(skill);
            loadedSkillIds.push(skill.id);
          }
        }
      } else if (typeof skillModule.default === "object" && "id" in skillModule.default) {
        // Single skill export
        const skill = skillModule.default as SkillDefinition;
        if (!hasSkill(skill.id)) {
          if (skill.onLoad) {
            await skill.onLoad();
          }
          registerSkill(skill);
          loadedSkillIds.push(skill.id);
        }
      }
    }

    loadedPackages.add(packageName);
    console.log(
      `Loaded ${loadedSkillIds.length} skills from ${packageName}:`,
      loadedSkillIds
    );
  } catch (error) {
    // Package not installed or other import error
    // This is expected when premium skills are not available
    if ((error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") {
      console.log(
        `Package ${packageName} not found. Premium features will not be available.`
      );
    } else {
      console.warn(`Failed to load skills from ${packageName}:`, error);
    }
  }

  return loadedSkillIds;
}

/**
 * Load premium skills
 *
 * Convenience function to load skills from the default premium package.
 */
export async function loadPremiumSkills(): Promise<string[]> {
  return loadSkillsFromPackage(PREMIUM_SKILLS_PACKAGE);
}

/**
 * Load skills from multiple packages
 */
export async function loadSkillsFromPackages(
  packageNames: string[]
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  await Promise.all(
    packageNames.map(async (packageName) => {
      const skillIds = await loadSkillsFromPackage(packageName);
      results.set(packageName, skillIds);
    })
  );

  return results;
}

/**
 * Check if premium skills package is available
 */
export async function isPremiumSkillsAvailable(): Promise<boolean> {
  try {
    await import(/* webpackIgnore: true */ PREMIUM_SKILLS_PACKAGE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of loaded packages
 */
export function getLoadedPackages(): string[] {
  return Array.from(loadedPackages);
}
