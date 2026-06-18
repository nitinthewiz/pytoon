import React from 'react';
import { AbsoluteFill, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries } from '@remotion/transitions';
import { ANTON, INTER } from '../../fonts';
import { NH } from '../newshound';
import { StoryFX } from './fx';
import { FlagClash } from './beats/FlagClash';
import { NumberCard } from './beats/NumberCard';
import { type NewsItem, type Visual } from '../../types';
// Motion system + registry seam (platform-v1)
import { useTheme } from '../../theme/ThemeContext';
import { motionForBeat, kenBurnsTransform, transitionFor } from '../../graphics/motion';
import { GraphicShell } from '../../graphics/GraphicShell';
import { GRAPHICS } from '../../graphics/registry';

// One photo beat — Ken Burns from the 6-preset MOTION table (cycled per beat so adjacent
// beats never match), resolved over the beat's SLOT length (passed in, not raw frame), so
// pans stay inside the scale overscan and never reveal a black edge. + a broadcast FX texture.
const PhotoBeat: React.FC<{ src: string; fxSeed: number; beatIndex: number; slotFrames: number }> = ({ src, fxSeed, beatIndex, slotFrames }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const preset = motionForBeat(beatIndex, fxSeed);
  const transform = kenBurnsTransform(preset, frame, slotFrames, t.motion.kenBurnsAmplitude);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: NH.charcoal2 }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform }} />
      <StoryFX seed={fxSeed} />
    </AbsoluteFill>
  );
};

// Entity portrait card (Wikipedia image + label slides in).
const EntityBeat: React.FC<{ src: string; label?: string }> = ({ src, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inn = spring({ frame, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ background: NH.charcoal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `translateY(${interpolate(inn, [0, 1], [60, 0])}px)`, opacity: inn, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <div style={{ width: 520, height: 620, borderRadius: 18, overflow: 'hidden', border: `8px solid ${NH.yellow}`, boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}>
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {label && <span style={{ fontFamily: ANTON, fontSize: 64, color: NH.white, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>}
      </div>
    </AbsoluteFill>
  );
};

const QuoteBeat: React.FC<{ text: string; source?: string }> = ({ text, source }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [2, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: NH.charcoal, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 70px', gap: 20, opacity: o }}>
      <div style={{ fontFamily: ANTON, fontSize: 160, color: NH.yellow, lineHeight: 0.5 }}>“</div>
      <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 64, color: NH.white, lineHeight: 1.12 }}>{text}</div>
      {source && <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 34, color: NH.cyan, letterSpacing: 2 }}>— {source.toUpperCase()}</div>}
    </AbsoluteFill>
  );
};

// Registry seam: look up GRAPHICS[kind], zod-validate the data, render the Comp inside
// <GraphicShell> — else a themed FallbackCard (Anton headline + the first number/string).
// PURE DATA: a bad spec degrades to a known-good beat, never throws (MOTION_GRAPHICS_SPEC).
const FallbackCard: React.FC<{ data: any }> = ({ data }) => {
  const t = useTheme();
  // pull the first number-ish or string value out of the data for a salvage headline
  const flat = data && typeof data === 'object' ? Object.values(data).flat?.() ?? Object.values(data) : [data];
  const headline = String(
    (Array.isArray(flat) ? flat : [flat]).find((v) => typeof v === 'string' || typeof v === 'number') ?? '—',
  );
  return (
    <GraphicShell>
      <div style={{ fontFamily: t.fonts.display, fontWeight: t.fonts.displayWeight, fontSize: 120, color: t.palette.hero, WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`, textAlign: 'center', maxWidth: 920, lineHeight: 1, textTransform: 'uppercase' }}>
        {headline}
      </div>
    </GraphicShell>
  );
};

const GraphicBeat: React.FC<{ kind: string; data: any }> = ({ kind, data }) => {
  const entry = GRAPHICS[kind];
  if (!entry) return <FallbackCard data={data} />;
  const parsed = entry.schema.safeParse(data);
  if (!parsed.success) return <FallbackCard data={data} />;
  const Comp = entry.Comp as React.FC<any>;
  // The block already renders inside its own GraphicShell (NumberCard does). Render directly.
  return <Comp {...parsed.data} />;
};

const Beat: React.FC<{ v: Visual; fxSeed: number; beatIndex: number; slotFrames: number }> = ({ v, fxSeed, beatIndex, slotFrames }) => {
  switch (v.type) {
    case 'flagclash': return <FlagClash a={v.a} b={v.b} mode={v.mode} labelA={v.labelA} labelB={v.labelB} />;
    case 'number': return <NumberCard value={v.value} label={v.label} />;
    case 'entity': return <EntityBeat src={v.src} label={v.label} />;
    case 'quote': return <QuoteBeat text={v.text} source={v.source} />;
    case 'graphic': return <GraphicBeat kind={v.kind} data={v.data} />;
    case 'photo':
    default: return <PhotoBeat src={(v as any).src} fxSeed={fxSeed} beatIndex={beatIndex} slotFrames={slotFrames} />;
  }
};

// Lays a story's visuals[] across its duration as quick-cut beats. Falls back to a
// single photo beat when no enrichment is present (current behaviour).
//
// The transition between beats is the per-theme BEAT_T (theme.motion.beatTransitionFrames),
// cycled [fade, themed zoom, slide] so no two cuts match. This is INTERNAL subdivision of a
// story's fixed slot — `durationInFrames` (the slot) and the outer timeline are untouched,
// so the SYNC ASSERTION holds. (`total` is only used to share the slot across beats.)
export const StoryBeats: React.FC<{ item: NewsItem; durationInFrames: number; fxSeed?: number }> = ({ item, durationInFrames, fxSeed = 0 }) => {
  const t = useTheme();
  const BEAT_T = t.motion.beatTransitionFrames;
  const beats: Visual[] = (item.visuals && item.visuals.length)
    ? item.visuals
    : (item.imagePath ? [{ type: 'photo', src: item.imagePath }] : []);
  if (beats.length === 0) return <AbsoluteFill style={{ background: NH.charcoal2 }} />;
  if (beats.length === 1) return <Beat v={beats[0]} fxSeed={fxSeed} beatIndex={0} slotFrames={durationInFrames} />;

  const total = durationInFrames + (beats.length - 1) * BEAT_T;
  const per = Math.floor(total / beats.length);
  return (
    <TransitionSeries>
      {beats.map((v, i) => {
        const slot = i === beats.length - 1 ? total - per * (beats.length - 1) : per;
        return (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={slot}>
              <Beat v={v} fxSeed={fxSeed + i} beatIndex={i} slotFrames={slot} />
            </TransitionSeries.Sequence>
            {i < beats.length - 1 && (
              <TransitionSeries.Transition {...transitionFor(i, BEAT_T)} />
            )}
          </React.Fragment>
        );
      })}
    </TransitionSeries>
  );
};
