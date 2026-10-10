// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The short videos on the public landing, per language.
 *
 * Each entry names a file under public/videos/<locale>/, which must ship in
 * four parts: <file>.png (the poster), <file>.webm, <file>.mp4 and <file>.vtt
 * (the captions). The card's title and caption come from the landing
 * dictionary, `<locale>.videos.v<n>.title` and `.caption`, where n is the
 * entry's position in the list (1 for the first).
 *
 * `published` says whether the card shows. A card that is not published
 * renders nothing, and when no card of a language is published the whole
 * section is left out. tests/landing-en.test.ts holds `published` to the
 * files on disk: it is true exactly when all four files exist. So when the
 * English recordings land in public/videos/en/, set their entries to true in
 * the same change.
 */

export type LandingLocale = "en" | "es";

export interface LandingVideo {
  file: string;
  published: boolean;
}

export const LANDING_VIDEOS: Record<LandingLocale, readonly LandingVideo[]> = {
  es: [
    { file: "01-inicio-rapido", published: true },
    { file: "02-progreso", published: true },
    { file: "04-informe-ejecutivo", published: true },
  ],
  // Not recorded yet; a separate job records them into public/videos/en/.
  en: [
    { file: "01-inicio-rapido", published: false },
    { file: "02-progreso", published: false },
    { file: "03-documentos", published: false },
    { file: "04-informe-ejecutivo", published: false },
    { file: "05-eipd", published: false },
  ],
};
