/**
 * Skill Package ID Mapping
 *
 * Maps assessment types and premium features to their Stripe skill package IDs.
 * Used by upgrade flows to create the correct checkout session.
 */

export const SKILL_PACKAGE_IDS: Record<string, string> = {
  DPIA: "com.nel.dpocentral.dpia",
  PIA: "com.nel.dpocentral.pia",
  TIA: "com.nel.dpocentral.tia",
  VENDOR: "com.nel.dpocentral.vendor",
  VENDOR_CATALOG: "com.nel.dpocentral.vendor-catalog",
};

export const SKILL_DISPLAY_NAMES: Record<string, string> = {
  DPIA: "Data Protection Impact Assessment (DPIA)",
  PIA: "Privacy Impact Assessment (PIA)",
  TIA: "Transfer Impact Assessment (TIA)",
  VENDOR: "Vendor Risk Assessment",
  VENDOR_CATALOG: "Vendor Catalog",
};
