// Dynamic theme-font loader (visual-component-library spec §1.4).
//
// A theme names its fonts by Google-font *family* string (e.g. "Anton", "BebasNeue").
// This maps those names to the @remotion/google-fonts loaders so any theme can name a
// font without a new static import. The loaders register the @font-face at call time
// and are headless-safe (they manage delayRender/continueRender internally), so the
// rendered family is available on the headless Windows runner.
//
// IMPORTANT: @remotion/google-fonts subpaths are statically resolved by esbuild, so we
// cannot `import('@remotion/google-fonts/' + name)` dynamically and bundle cleanly.
// Instead we keep an explicit static map of the families our themes are allowed to use.
// Add a line here when a new theme names a new family.
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald';
import type { Theme } from './tokens';

// family-name (as written in a *.theme.json) → its google-fonts loader.
const LOADERS: Record<string, () => { fontFamily: string }> = {
  Anton: () => loadAnton(),
  Inter: () => loadInter('normal', { weights: ['400', '600', '700', '900'] }),
  BebasNeue: () => loadBebasNeue(),
  Archivo: () => loadArchivo('normal', { weights: ['400', '600', '700', '900'] }),
  Oswald: () => loadOswald('normal', { weights: ['400', '600', '700'] }),
};

// Load (register) one family by name and return the CSS font-family string Remotion
// expects. Falls back to the raw name so an unmapped family at least renders with a
// system font rather than throwing.
export const loadFamily = (family: string): string => {
  const loader = LOADERS[family];
  if (!loader) {
    if (typeof console !== 'undefined') {
      console.warn(`[theme/fonts] no loader for "${family}" — add it to LOADERS. Using raw name.`);
    }
    return family;
  }
  return loader().fontFamily;
};

// Ensure both of a theme's fonts are registered, returning the resolved CSS family
// strings. Call once where the theme is provided (e.g. inside ThemeProvider) so the
// faces are present before any block paints. Idempotent — the loaders dedupe.
export const loadThemeFonts = (theme: Theme): { display: string; body: string } => ({
  display: loadFamily(theme.fonts.display),
  body: loadFamily(theme.fonts.body),
});
