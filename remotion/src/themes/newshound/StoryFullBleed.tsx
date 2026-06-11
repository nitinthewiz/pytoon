import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, INTER } from '../../fonts';
import { NH, BRAND } from '../newshound';
import { BOTTOM_BAR_H } from '../../layout';
import { Ticker } from './Furniture';
import { StoryBeats } from './StoryBeats';
import { type NewsItem } from '../../types';

type Props = { item: NewsItem; index?: number; total?: number; ticker?: string };

const HEADER_H = 300;    // charcoal header (counter + category + name plate); LIVE removed
const IMG_TOP = HEADER_H;
const IMG_BOTTOM = 1452; // image/beat zone fills the middle

// "Anchor" layout: the TAKE on top (up to 3 lines, 3rd overlaps the image), the
// image/beat zone in the middle, James a centered bottom presenter (compose.js),
// captions below him.
export const StoryFullBleed: React.FC<Props> = ({ item, index = 0, total = 1, ticker }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const take = item.take ?? item.title ?? '';
  const category = (item.category && item.category !== 'general' ? item.category : 'Top Story').toUpperCase();

  const headIn = spring({ frame: frame - 3, fps, config: { damping: 16, mass: 0.7 } });
  const headX = interpolate(headIn, [0, 1], [-700, 0]);
  const catIn = spring({ frame: frame - 8, fps, config: { damping: 13 } });
  const sweep = interpolate(spring({ frame: frame - 12, fps, config: { damping: 18 } }), [0, 1], [0, 100]);

  return (
    <AbsoluteFill style={{ background: NH.charcoal }}>
      {/* ---- IMAGE / BEAT zone (middle) ---- */}
      <div style={{ position: 'absolute', top: IMG_TOP, left: 0, right: 0, height: IMG_BOTTOM - IMG_TOP, overflow: 'hidden', background: NH.charcoal2 }}>
        <StoryBeats item={item} durationInFrames={item.durationInFrames} fxSeed={index} />
        {/* top darkening so the chyron's 3rd line stays legible over the image */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, background: 'linear-gradient(180deg, rgba(20,24,31,0.92) 0%, rgba(20,24,31,0) 100%)' }} />
        {/* bottom darkening so James reads against the photo */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 360, background: 'linear-gradient(0deg, rgba(20,24,31,0.95) 0%, rgba(20,24,31,0) 100%)' }} />
      </div>

      {/* ---- HEADER (top): counter + category + the TAKE ---- */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H, background: NH.charcoal }} />
      <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', gap: 6 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 7, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.22)' }}>
            <div style={{ height: '100%', width: i < index ? '100%' : i === index ? `${Math.min(100, 12 + (frame % 240) / 2.4)}%` : '0%', background: NH.yellow }} />
          </div>
        ))}
      </div>
      {/* category bug (kept — becomes Top Story / Sports / Business … from the LLM tag) */}
      <div style={{ position: 'absolute', top: 40, right: 40, background: NH.cyan, padding: '10px 22px', transform: `skewX(-8deg) translateX(${interpolate(catIn, [0, 1], [220, 0])}px)`, opacity: catIn }}>
        <span style={{ display: 'block', transform: 'skewX(8deg)', fontFamily: ANTON, fontSize: 32, color: NH.ink, letterSpacing: 2 }}>{category}</span>
      </div>

      {/* name plate + take chyron (up to 3 lines; 3rd overlaps the image) */}
      <div style={{ position: 'absolute', top: 96, left: 40, right: 40, transform: `translateX(${headX}px)`, opacity: headIn, zIndex: 5 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: NH.yellow, padding: '6px 18px', marginBottom: 10 }}>
          <span style={{ fontFamily: ANTON, fontSize: 30, color: NH.ink, letterSpacing: 1 }}>{BRAND.anchor}</span>
          <span style={{ fontFamily: INTER, fontWeight: 900, fontSize: 22, color: NH.orange, marginLeft: 12, letterSpacing: 2 }}>// THE TAKE</span>
        </div>
        <div style={{ position: 'relative', borderLeft: `14px solid ${NH.yellow}`, paddingLeft: 22 }}>
          <span style={{ fontFamily: ANTON, fontSize: 64, lineHeight: 1.0, color: NH.white, letterSpacing: 0.5, textTransform: 'uppercase', textShadow: '0 4px 18px rgba(0,0,0,0.85)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{take}</span>
          <div style={{ position: 'absolute', left: 22, bottom: -12, height: 6, width: `${sweep}%`, maxWidth: 'calc(100% - 22px)', background: NH.cyan, boxShadow: `0 0 12px ${NH.cyan}` }} />
        </div>
      </div>

      {/* bottom charcoal zone (James composited here by compose.js) */}
      <div style={{ position: 'absolute', top: IMG_BOTTOM, left: 0, right: 0, bottom: 0, background: NH.charcoal }} />

      <Ticker height={BOTTOM_BAR_H} right={`${index + 1} / ${total}`} text={ticker} />
    </AbsoluteFill>
  );
};
