// Roboto via @remotion/google-fonts — bundled at render time so it works
// headless on the self-hosted Windows runner (no system font dependency).
// Import ROBOTO and set it as fontFamily; pick weight with fontWeight.
import { loadFont } from '@remotion/google-fonts/Roboto';

export const { fontFamily: ROBOTO } = loadFont('normal', {
  weights: ['400', '500', '700', '900'],
});
