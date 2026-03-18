export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Load premium skills
    try {
      const { loadPremiumSkills } = await import("./lib/skills/loader");
      await loadPremiumSkills();
    } catch {
      // Premium skills not available — core features still work
    }

    // Load security module
    try {
      const { loadSecurityModule } = await import("./lib/security/loader");
      await loadSecurityModule();
    } catch {
      // Security package not available — open-source defaults apply
    }
  }
}
