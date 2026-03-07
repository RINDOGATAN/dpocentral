export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { loadPremiumSkills } = await import("./lib/skills/loader");
      await loadPremiumSkills();
    } catch {
      // Premium skills not available — core features still work
    }
  }
}
