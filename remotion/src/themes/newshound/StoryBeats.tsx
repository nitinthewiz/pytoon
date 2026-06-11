import React from 'react';
import { AbsoluteFill, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { ANTON, INTER } from '../../fonts';
import { NH } from '../newshound';
import { StoryFX } from './fx';
import { FlagClash } from './beats/FlagClash';
import { NumberCard } from './beats/NumberCard';
import { type NewsItem, type Visual } from '../../types';

const BEAT_T = 8; // frames of transition between beats

// One photo beat — Ken Burns + a broadcast FX texture (varies by index).
const PhotoBeat: React.FC<{ src: string; fxSeed: number; dir: number }> = ({ src, fxSeed, dir }) => {
  const frame = useCurrentFrame();
  const scale = 1.05 + frame * 0.0006;
  const panX = Math.sin(frame / 80) * 14 * dir;
  const panY = -frame * 0.14;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: NH.charcoal2 }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${panX}px, ${panY}px)` }} />
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

const Beat: React.FC<{ v: Visual; fxSeed: number; dir: number }> = ({ v, fxSeed, dir }) => {
  switch (v.type) {
    case 'flagclash': return <FlagClash a={v.a} b={v.b} mode={v.mode} labelA={v.labelA} labelB={v.labelB} />;
    case 'number': return <NumberCard value={v.value} label={v.label} />;
    case 'entity': return <EntityBeat src={v.src} label={v.label} />;
    case 'quote': return <QuoteBeat text={v.text} source={v.source} />;
    case 'photo':
    default: return <PhotoBeat src={(v as any).src} fxSeed={fxSeed} dir={dir} />;
  }
};

// Lays a story's visuals[] across its duration as quick-cut beats. Falls back to a
// single photo beat when no enrichment is present (current behaviour).
export const StoryBeats: React.FC<{ item: NewsItem; durationInFrames: number; fxSeed?: number }> = ({ item, durationInFrames, fxSeed = 0 }) => {
  const beats: Visual[] = (item.visuals && item.visuals.length)
    ? item.visuals
    : (item.imagePath ? [{ type: 'photo', src: item.imagePath }] : []);
  if (beats.length === 0) return <AbsoluteFill style={{ background: NH.charcoal2 }} />;
  if (beats.length === 1) return <Beat v={beats[0]} fxSeed={fxSeed} dir={1} />;

  const total = durationInFrames + (beats.length - 1) * BEAT_T;
  const per = Math.floor(total / beats.length);
  return (
    <TransitionSeries>
      {beats.map((v, i) => (
        <React.Fragment key={i}>
          <TransitionSeries.Sequence durationInFrames={i === beats.length - 1 ? total - per * (beats.length - 1) : per}>
            <Beat v={v} fxSeed={fxSeed + i} dir={i % 2 ? -1 : 1} />
          </TransitionSeries.Sequence>
          {i < beats.length - 1 && (
            <TransitionSeries.Transition timing={linearTiming({ durationInFrames: BEAT_T })} presentation={slide({ direction: i % 2 ? 'from-right' : 'from-left' })} />
          )}
        </React.Fragment>
      ))}
    </TransitionSeries>
  );
};
