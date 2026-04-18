/**
 * Font registration for the rebuilt reports' design system.
 *
 * Registers Inter 400/500/600/700. The legacy pdf-styles.tsx also registers Inter
 * — react-pdf's Font.register is idempotent so double-registration is safe.
 */
import path from "node:path";
import { Font } from "@react-pdf/renderer";

const fontsDir = path.join(process.cwd(), "src/server/services/export/fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontsDir, "Inter-Regular.ttf"),  fontWeight: 400 },
    { src: path.join(fontsDir, "Inter-Medium.ttf"),   fontWeight: 500 },
    { src: path.join(fontsDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontsDir, "Inter-Bold.ttf"),     fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((word) => [word]);
