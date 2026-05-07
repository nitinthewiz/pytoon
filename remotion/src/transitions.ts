// Edit this array to change which transitions are used between images.
// Remotion picks one per image change using the item index as a seed (deterministic).
// Only CSS-transform-based transitions here — wipe/clockWipe use SVG paths that
// break when the TransitionSeries is rendered inside a constrained div.
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { flip } from '@remotion/transitions/flip';

export const APPROVED_TRANSITIONS = [
  () => fade(),
  () => slide(),
  () => flip(),
];
