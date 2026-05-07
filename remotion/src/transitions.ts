// Edit this array to change which transitions are used between images.
// Remotion picks one per image change using the item index as a seed (deterministic).
// Available from @remotion/transitions: fade, slide, wipe, flip, clockWipe, none
import { clockWipe, fade, flip, slide, wipe } from '@remotion/transitions';

export const APPROVED_TRANSITIONS = [
  () => fade(),
  () => slide(),
  () => wipe(),
  () => flip(),
  () => clockWipe(),
];
