"use client";

import { brand } from "@/config/brand";

/**
 * Injects brand colors as CSS custom properties on :root.
 * Render this in the root layout to override the static CSS defaults.
 */
export function BrandTheme() {
  const c = brand.colors;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root {
  --background: ${c.background};
  --foreground: ${c.foreground};
  --card: ${c.card};
  --card-foreground: ${c.cardForeground};
  --popover: ${c.card};
  --popover-foreground: ${c.cardForeground};
  --primary: ${c.primary};
  --primary-foreground: ${c.primaryForeground};
  --secondary: ${c.card};
  --secondary-foreground: ${c.foreground};
  --muted: ${c.muted};
  --muted-foreground: ${c.mutedForeground};
  --accent: ${c.accent};
  --accent-foreground: ${c.accentForeground};
  --border: ${c.border};
  --input: ${c.card};
  --ring: ${c.primary};
  --lime: ${c.primary};
  --lime-foreground: ${c.primaryForeground};
  --chart-1: ${c.primary};
  --sidebar: ${c.card};
  --sidebar-foreground: ${c.foreground};
  --sidebar-primary: ${c.primary};
  --sidebar-primary-foreground: ${c.primaryForeground};
  --sidebar-accent: ${c.card};
  --sidebar-accent-foreground: ${c.foreground};
  --sidebar-border: ${c.border};
  --sidebar-ring: ${c.primary};
}`,
      }}
    />
  );
}
