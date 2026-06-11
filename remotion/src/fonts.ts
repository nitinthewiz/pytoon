// Fonts via @remotion/google-fonts — bundled at render time (headless-safe).
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

// Classic theme
export const { fontFamily: ROBOTO } = loadRoboto('normal', {
  weights: ['400', '500', '700', '900'],
});

// Newshound theme — Anton (heavy condensed display) + Inter (clean body/captions)
export const { fontFamily: ANTON } = loadAnton();
export const { fontFamily: INTER } = loadInter('normal', {
  weights: ['400', '600', '700', '900'],
});
