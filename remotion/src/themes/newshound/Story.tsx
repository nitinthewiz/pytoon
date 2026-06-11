import React from 'react';
import { AbsoluteFill, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, INTER } from '../../fonts';
import { NH, BRAND } from '../newshound';
import { AVATAR_ZONE_H, BOTTOM_BAR_H } from '../../layout';
import { StudioBackdrop, LiveBug, Ticker } from './Furniture';
import { type NewsItem } from '../../types';

const IMG_TOP = 772;
const LT_TOP = 686; // lower-third top (overlaps avatar zone bottom + image top)

type Props = { item: NewsItem; index?: number; total?: number; ticker?: string };

export const Story: React.FC<Props> = ({ item, index = 0, total = 1, ticker }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const take = item.take ?? item.title ?? '';
  const category = (item.category && item.category !== 'general' ? item.category : 'Top Story').toUpperCase();

  // Ken Burns — slow zoom + drift across the whole slide.
  const kb = frame;
  const scale = 1.06 + kb * 0.00055;
  const panX = Math.sin(kb / 90) * 14;
  const panY = -kb * 0.18;

  const ltIn = spring({ frame: frame - 3, fps, config: { damping: 15, mass: 0.7 } });
  const ltX = interpolate(ltIn, [0, 1], [-760, 0]);
  const catIn = spring({ frame: frame - 9, fps, config: { damping: 13 } });
  // cyan underline sweep beneath the chyron
  const sweep = interpolate(spring({ frame: frame - 12, fps, config: { damping: 18 } }), [0, 1], [0, 100]);

  return (
    <AbsoluteFill style={{ background: NH.charcoal }}>
      {/* News image with Ken Burns */}
      <div style={{ position: 'absolute', top: IMG_TOP, left: 0, right: 0, bottom: BOTTOM_BAR_H, overflow: 'hidden', background: NH.charcoal2 }}>
        {item.imagePath ? (
          <Img src={staticFile(item.imagePath)} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${panX}px, ${panY}px)`, transformOrigin: 'center center' }} />
        ) : null}
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(20,24,31,0) 52%, rgba(20,24,31,0.9) 100%)' }} />
        {/* cyan scanline drifting down the photo */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: 3, top: `${(frame * 1.4) % 100}%`, background: `linear-gradient(90deg, transparent, ${NH.cyan}, transparent)`, opacity: 0.35 }} />
      </div>

      {/* Studio zone for the avatar */}
      <StudioBackdrop height={AVATAR_ZONE_H} />
      <LiveBug label="LIVE" />

      {/* Story counter — segmented progress bar across the very top (how far in we are) */}
      <div style={{ position: 'absolute', top: 12, left: 16, right: 16, display: 'flex', gap: 6 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 7, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.22)' }}>
            <div style={{ height: '100%', width: i < index ? '100%' : i === index ? `${Math.min(100, 12 + (frame % 240) / 2.4)}%` : '0%', background: NH.yellow, boxShadow: i === index ? `0 0 8px ${NH.yellow}` : 'none' }} />
          </div>
        ))}
      </div>

      {/* Category bug — top right, pulsing */}
      <div style={{ position: 'absolute', top: 40, right: 40, background: NH.cyan, padding: '10px 22px', transform: `skewX(-8deg) translateX(${interpolate(catIn, [0, 1], [220, 0])}px) scale(${1 + 0.03 * Math.sin(frame / 7)})`, opacity: catIn, boxShadow: `0 0 ${10 + 8 * (0.5 + 0.5 * Math.sin(frame / 7))}px rgba(25,195,230,0.6)` }}>
        <span style={{ display: 'block', transform: 'skewX(8deg)', fontFamily: ANTON, fontSize: 32, color: NH.ink, letterSpacing: 2 }}>{category}</span>
      </div>

      {/* Lower-third: name plate + take chyron + sweep */}
      <div style={{ position: 'absolute', top: LT_TOP, left: 0, right: 40, transform: `translateX(${ltX}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: NH.yellow, padding: '8px 22px', marginLeft: 40 }}>
          <span style={{ fontFamily: ANTON, fontSize: 34, color: NH.ink, letterSpacing: 1 }}>{BRAND.anchor}</span>
          <span style={{ fontFamily: INTER, fontWeight: 900, fontSize: 24, color: NH.orange, marginLeft: 14, letterSpacing: 2 }}>// THE TAKE</span>
        </div>
        <div style={{ position: 'relative', background: NH.charcoal, borderLeft: `16px solid ${NH.yellow}`, boxShadow: '0 16px 40px rgba(0,0,0,0.55)', padding: '24px 30px 28px', marginTop: -2 }}>
          <span style={{ fontFamily: ANTON, fontSize: 60, lineHeight: 1.04, color: NH.white, letterSpacing: 0.5, textTransform: 'uppercase', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{take}</span>
          {/* animated cyan underline */}
          <div style={{ position: 'absolute', left: 30, bottom: 14, height: 6, width: `${sweep}%`, maxWidth: 'calc(100% - 60px)', background: NH.cyan, boxShadow: `0 0 12px ${NH.cyan}` }} />
        </div>
      </div>

      <Ticker height={BOTTOM_BAR_H} right={`${index + 1} / ${total}`} text={ticker} />
    </AbsoluteFill>
  );
};
