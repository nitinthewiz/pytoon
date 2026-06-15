import React from 'react';
import { AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';
import { ANTON } from '../../fonts';
import { NH, BRAND } from '../newshound';

// Branded story-to-story stinger: a Newshound-Yellow diagonal band (ink edges,
// NEWSHOUND wordmark + James head riding it) wipes left -> right across the
// full frame. The scene cut happens at progress 0.5, when the band covers the
// frame completely — designed to read well at TRANSITION_FRAMES (15) @ 30fps.
//
// Implemented as a custom @remotion/transitions presentation:
//   TransitionPresentation = { component, props }, where the component renders
//   both the exiting scene (children, direction='exiting') and the entering one
//   (children, direction='entering', mounted on top).
export type StingerWipeProps = {
  /** Wordmark riding the band; defaults to the brand name. */
  label?: string;
};

// Band geometry (percent of the band's own width for translateX):
// the band is 160% of the frame wide and skewed -12deg; its skew overhang is
// ~204px on a 1920px-tall frame, so at x=0 it covers the whole 1080px width
// with margin. ±130% puts it fully off-screen either side.
const SWEEP = [-130, 130] as const;

const StingerWipePresentation: React.FC<
  TransitionPresentationComponentProps<StingerWipeProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  if (presentationDirection === 'exiting') {
    // Outgoing story holds still; the band + incoming scene render on top.
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  const p = presentationProgress;
  // Ease so the band whips through the middle (fastest while covering the cut).
  const x = interpolate(p, [0, 1], [SWEEP[0], SWEEP[1]], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const covered = p >= 0.5; // band fully covers the frame here — swap scenes

  return (
    <AbsoluteFill>
      {/* Incoming story: hidden until the band covers the frame, then revealed
          behind the band's trailing edge as it sweeps off. */}
      <AbsoluteFill style={{ opacity: covered ? 1 : 0 }}>{children}</AbsoluteFill>

      <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            height: '120%',
            left: '-30%',
            width: '160%',
            transform: `translateX(${x}%) skewX(-12deg)`,
            background: `linear-gradient(180deg, ${NH.yellow} 0%, #F2A816 100%)`,
            borderLeft: `12px solid ${NH.ink}`,
            borderRight: `12px solid ${NH.ink}`,
            boxShadow: '0 0 90px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              transform: 'skewX(12deg)', // counter-skew so the wordmark reads straight
              display: 'flex',
              alignItems: 'center',
              gap: 36,
              whiteSpace: 'nowrap',
            }}
          >
            <Img
              src={staticFile('james.png')}
              style={{ height: 260, transform: 'rotate(-6deg)', filter: `drop-shadow(0 10px 0 ${NH.orange})` }}
            />
            <span
              style={{
                fontFamily: ANTON,
                fontSize: 150,
                color: NH.ink,
                letterSpacing: 8,
                textShadow: `0 6px 0 ${NH.orange}`,
              }}
            >
              {passedProps.label ?? BRAND.name}
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const stingerWipe = (
  props?: StingerWipeProps
): TransitionPresentation<StingerWipeProps> => ({
  component: StingerWipePresentation,
  props: props ?? {},
});

// ---------------------------------------------------------------------------
// OVERLAY form (absolute-frame timeline). The scenes are now plain hard cuts;
// the branded wipe is drawn ON TOP, centred on the boundary, masking the cut as
// the band whips through. Mount in: <Sequence from={boundary - WIPE/2}
// durationInFrames={WIPE}><StingerWipeOverlay/></Sequence>. The band is the same
// Newshound-Yellow skewed band (NEWSHOUND wordmark + James) as the presentation
// above, so the look is unchanged.
// ---------------------------------------------------------------------------

// Tone presets: story wipes are Newshound-Yellow; SECTION changes (top->sports->
// fun) are a distinct BLUE so a new section reads as a bigger beat than a story flip.
const TONE = {
  yellow: { from: NH.yellow, to: '#F2A816', accent: NH.orange },
  blue: { from: NH.cyan, to: '#0E76B8', accent: '#08324C' },
} as const;
type Tone = keyof typeof TONE;

// Shared band visual — `progress` 0..1 sweeps it left->right; covers the whole
// 1080px frame around progress 0.5 (where the hard cut sits beneath it).
const StingerBand: React.FC<{ progress: number; label?: string; tone?: Tone }> = ({ progress, label, tone = 'yellow' }) => {
  const x = interpolate(progress, [0, 1], [SWEEP[0], SWEEP[1]], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const t = TONE[tone];
  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', zIndex: 60 }}>
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          height: '120%',
          left: '-30%',
          width: '160%',
          transform: `translateX(${x}%) skewX(-12deg)`,
          background: `linear-gradient(180deg, ${t.from} 0%, ${t.to} 100%)`,
          borderLeft: `12px solid ${NH.ink}`,
          borderRight: `12px solid ${NH.ink}`,
          boxShadow: '0 0 90px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ transform: 'skewX(12deg)', display: 'flex', alignItems: 'center', gap: 36, whiteSpace: 'nowrap' }}>
          <Img src={staticFile('james.png')} style={{ height: 260, transform: 'rotate(-6deg)', filter: `drop-shadow(0 10px 0 ${t.accent})` }} />
          <span style={{ fontFamily: ANTON, fontSize: 150, color: tone === 'blue' ? NH.white : NH.ink, letterSpacing: 8, textShadow: `0 6px 0 ${t.accent}` }}>
            {label ?? BRAND.name}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Story->story branded wipe overlay. Local frame 0..(duration) drives the band
// across; the cut sits at the middle frame. Keep duration ~= WIPE_FRAMES (15).
export const StingerWipeOverlay: React.FC<{ label?: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  return <StingerBand progress={progress} label={label} />;
};

// SECTION-change stinger (top->sports->fun): the same band motion but BLUE, so a
// section change is unmistakably a different beat than the yellow story wipes. It
// hands off to the (also blue) SectionCard, which carries the section name — so
// the band keeps the NEWSHOUND wordmark to avoid double-labelling.
export const SectionStingerOverlay: React.FC<{ label?: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  return <StingerBand progress={progress} label={label} tone="blue" />;
};

// Scene-boundary overlay (Opening->Headlines, Headlines->Stories, Stories->Closing).
// A quick branded yellow flash + faint band kiss, tasteful and short — the user
// chose "branded wipe" over a cross-dissolve, but the section cuts get a lighter
// touch than the full story stinger so they read as bigger beats, not story flips.
export const SceneFlashOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const mid = (durationInFrames - 1) / 2;
  // Symmetric flash that peaks at the cut (mid frame) and fades out both sides.
  const flash = interpolate(frame, [0, mid, durationInFrames - 1], [0, 0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 55 }}>
      {/* brand-yellow wash kissing the cut */}
      <AbsoluteFill style={{ background: NH.yellow, opacity: flash * 0.5 }} />
      <AbsoluteFill style={{ background: NH.white, opacity: flash * 0.5 }} />
    </AbsoluteFill>
  );
};

// Studio preview (`NHStingerWipe` in Root.tsx): two placeholder "stories" with
// the wipe between them — scrub frames ~22–37 to see the band sweep.
export const StingerWipeDemo: React.FC = () => {
  const Card: React.FC<{ bg: string; label: string }> = ({ bg, label }) => (
    <AbsoluteFill
      style={{
        background: bg,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: ANTON,
        fontSize: 120,
        color: NH.white,
      }}
    >
      {label}
    </AbsoluteFill>
  );
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={37}>
        <Card bg={NH.charcoal} label="STORY A" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={linearTiming({ durationInFrames: 15 })} presentation={stingerWipe()} />
      <TransitionSeries.Sequence durationInFrames={38}>
        <Card bg={NH.cyan} label="STORY B" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
