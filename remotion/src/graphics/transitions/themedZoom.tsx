// themedZoom — a custom TransitionPresentation (MOTION_GRAPHICS_SPEC §motion 1/4).
//
// A small scale-overshoot + opacity cross used by the transition cycler so cuts read as
// video, not slideshow. Pure CSS transform/opacity — headless-safe, no WebGL, no deps
// beyond @remotion/transitions (already installed). This is the TEMPLATE for any future
// custom transition (whip-pan, etc.): same TransitionPresentation shape.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';

export type ThemedZoomProps = { direction?: 'in' | 'out' };

const ThemedZoomPresentation: React.FC<
  TransitionPresentationComponentProps<ThemedZoomProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const dir = passedProps.direction ?? 'in';
  const entering = presentationDirection === 'entering';

  // entering scales from slightly-off → 1; exiting scales 1 → slightly-off, opposite sign
  // so the two layers feel like one continuous push/pull. A faint blur on the moving half
  // fakes motion-blur on the cut (pure CSS filter).
  const off = dir === 'in' ? 0.94 : 1.06;
  const scale = entering
    ? off + (1 - off) * presentationProgress
    : 1 + (off - 1) * presentationProgress;
  const opacity = entering ? presentationProgress : 1 - presentationProgress;
  const blur = Math.sin(presentationProgress * Math.PI) * 6;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        opacity,
        filter: `blur(${blur.toFixed(2)}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const themedZoom = (
  props?: ThemedZoomProps,
): TransitionPresentation<ThemedZoomProps> => ({
  component: ThemedZoomPresentation,
  props: props ?? {},
});
