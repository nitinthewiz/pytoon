// Motion system (MOTION_GRAPHICS_SPEC §motion) — shared, theme-agnostic helpers.
//
// Two index-keyed cyclers so no two adjacent beats / cuts feel the same:
//   1. MOTION    — 6 Ken-Burns presets, resolved over a beat's SLOT length (not raw frame).
//   2. transitionFor — a 3-entry transition cycler [fade, themed zoom, slide].
// Plus the IN/BUILD/IDLE envelope helpers every graphic block uses.
//
// HARD RULE: CSS transform/opacity/filter + interpolate()/spring() only. No WebGL,
// no gl-transitions, no canvas-draw. All transition durations stay == beatTransitionFrames
// so `total = durationInFrames + (beats.length-1)*BEAT_T` and the SYNC ASSERTION hold.
import { Easing, interpolate } from 'remotion';
import { linearTiming, springTiming } from '@remotion/transitions';
import type { TransitionPresentation, TransitionTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { themedZoom } from './transitions/themedZoom';

// ── 6 Ken-Burns presets ──────────────────────────────────────────────────────────────
// Pan ranges (x/y, in % of frame) are kept INSIDE the scale overscan so the moves never
// reveal a black edge: at the minimum scale used here (1.0 only for the start of pull-out,
// which then scales UP) the |pan| stays under the (scale-1)/2 * 100% safe margin. Every
// preset that pans holds scale >= 1.08 (>=4% margin per side) against pans of <=4%.
export type MotionPreset = {
  name: string;
  s: [number, number]; // scale from→to
  x: [number, number]; // translateX % from→to
  y: [number, number]; // translateY % from→to
  easing: (n: number) => number;
};

export const MOTION: MotionPreset[] = [
  { name: 'push-in', s: [1.0, 1.18], x: [0, 0], y: [0, 0], easing: Easing.out(Easing.cubic) },
  { name: 'pull-out', s: [1.22, 1.04], x: [0, 0], y: [0, 0], easing: Easing.out(Easing.cubic) },
  { name: 'pan-right', s: [1.12, 1.12], x: [4, -4], y: [0, 0], easing: Easing.inOut(Easing.sin) },
  { name: 'pan-left', s: [1.12, 1.12], x: [-4, 4], y: [0, 0], easing: Easing.inOut(Easing.sin) },
  { name: 'diag-drift', s: [1.08, 1.16], x: [-3, 3], y: [2, -2], easing: Easing.inOut(Easing.sin) },
  { name: 'slow-rise', s: [1.1, 1.15], x: [0, 0], y: [3, -3], easing: Easing.inOut(Easing.sin) },
];

// Resolve a preset's transform string over a beat's own slot length.
// `frame` is the local frame (0..slotFrames); `slotFrames` the beat's slot duration.
// `amp` scales the pan/zoom intensity (theme.motion.kenBurnsAmplitude).
export const kenBurnsTransform = (
  preset: MotionPreset,
  frame: number,
  slotFrames: number,
  amp = 1,
): string => {
  const span: [number, number] = [0, Math.max(1, slotFrames)];
  const opts = { easing: preset.easing, extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
  // Scale interpolated around 1: keep the floor >=1 even when amp<1 so we never under-scan.
  const s = 1 + (interpolate(frame, span, preset.s, opts) - 1) * amp;
  const x = interpolate(frame, span, preset.x, opts) * amp;
  const y = interpolate(frame, span, preset.y, opts) * amp;
  return `scale(${s}) translate(${x}%, ${y}%)`;
};

// Pick the preset for a beat by index (+ a per-story seed), so adjacent beats differ and
// runs vary. Default cadence when no LLM motion is given still "breathes" (push/pull alternate
// because they're entries 0/1).
export const motionForBeat = (beatIndex: number, seed = 0): MotionPreset =>
  MOTION[(beatIndex + seed) % MOTION.length];

// ── Transition cycler ────────────────────────────────────────────────────────────────
// [fade, themed zoom, slide] — guarantees transition(N) != transition(N-1) across a story.
// whip-pan is deliberately omitted from v1 (a custom TransitionPresentation; see
// transitions/ for the themed-zoom template) to keep bundling bullet-proof. To add it
// later, append it here and verify the bundle.
// The presentations differ in their prop generics, so the cycler returns a single common
// type (props erased to a record) — TransitionSeries.Transition accepts this when spread.
type AnyPresentation = TransitionPresentation<Record<string, unknown>>;
export const transitionFor = (
  index: number,
  beatTransitionFrames: number,
): { presentation: AnyPresentation; timing: TransitionTiming } => {
  const slot = index % 3;
  if (slot === 0) {
    return {
      presentation: fade() as unknown as AnyPresentation,
      timing: linearTiming({ durationInFrames: beatTransitionFrames }),
    };
  }
  if (slot === 1) {
    return {
      presentation: themedZoom({ direction: index % 2 ? 'in' : 'out' }) as unknown as AnyPresentation,
      timing: linearTiming({ durationInFrames: beatTransitionFrames }),
    };
  }
  return {
    presentation: slide({ direction: index % 2 ? 'from-right' : 'from-left' }) as unknown as AnyPresentation,
    timing: springTiming({ config: { damping: 200 }, durationInFrames: beatTransitionFrames }),
  };
};

// ── IN / BUILD / IDLE envelope helpers (MOTION_GRAPHICS_SPEC §motion 5) ───────────────
// A graphic block authors NO exit (slot length is variable; the TransitionSeries owns the
// out). It must be finished AND alive at any slot length. These helpers express the three
// phases against the LOCAL frame.

// IN flash opacity (0..1): a brief white slam at the cut. Peaks ~frame 4, gone by ~14.
export const inFlash = (frame: number): number =>
  interpolate(frame, [0, 4, 14], [0, 0.55, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// BUILD reveal (0..1) for a staggered child: starts at `delay`, completes over `dur`.
export const buildReveal = (frame: number, delay = 0, dur = 14): number =>
  interpolate(frame, [delay, delay + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// IDLE micro-oscillation (−1..1) for needles/shimmer/pulse once BUILD has settled.
// `period` in frames, `from` is when IDLE begins (defaults to after the typical build).
export const idleOsc = (frame: number, period = 80, from = 35): number =>
  frame < from ? 0 : Math.sin(((frame - from) / period) * Math.PI * 2);
