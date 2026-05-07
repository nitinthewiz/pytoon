// Edit this array to change which transitions are used between images.
// Remotion picks one per image change using the item index as a seed (deterministic).
// Available from @remotion/transitions: fade, slide, wipe, flip, clockWipe, none
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { clockWipe } from '@remotion/transitions/clock-wipe';

export const APPROVED_TRANSITIONS = [
  () => fade(),
  () => slide(),
  () => wipe(),
  () => flip(),
  () => clockWipe(),
];
