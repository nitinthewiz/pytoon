import React from 'react';
import { AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame } from 'remotion';
import { ANTON, INTER } from '../../fonts';
import { NH, BRAND } from '../newshound';

// Studio backdrop for the avatar zone — the photographic news set, pushed to a
// charcoal mood with a vignette so the flat cartoon (James) pops against it.
export const StudioBackdrop: React.FC<{ height: number }> = ({ height }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height, overflow: 'hidden' }}>
    <Img src={staticFile('studio_bg.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    {/* charcoal grade + vignette */}
    <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(20,24,31,0.35) 0%, rgba(20,24,31,0.15) 45%, rgba(20,24,31,0.85) 100%)` }} />
    <AbsoluteFill style={{ boxShadow: 'inset 0 0 220px rgba(0,0,0,0.6)' }} />
  </div>
);

// Pulsing cyan LIVE bug — top-left broadcast marker.
export const LiveBug: React.FC<{ top?: number; label?: string }> = ({ top = 40, label = 'LIVE' }) => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  return (
    <div
      style={{
        position: 'absolute', top, left: 40, display: 'flex', alignItems: 'center', gap: 14,
        background: NH.charcoal, border: `2px solid ${NH.cyan}`, borderRadius: 8,
        padding: '10px 20px', boxShadow: `0 6px 24px rgba(0,0,0,0.4)`,
      }}
    >
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: NH.cyan, opacity: 0.4 + 0.6 * pulse, boxShadow: `0 0 ${10 + 14 * pulse}px ${NH.cyan}` }} />
      <span style={{ fontFamily: ANTON, fontSize: 34, color: NH.white, letterSpacing: 3 }}>{label}</span>
    </div>
  );
};

// Bottom ticker bar — yellow brand tab + a real scrolling headline marquee.
export const Ticker: React.FC<{ height: number; right?: string; text?: string }> = ({ height, right, text }) => {
  const frame = useCurrentFrame();
  const shimmer = 0.5 + 0.5 * Math.sin(frame / 8);
  const marquee = (text && text.trim()) ? text : `${BRAND.tagline}   •   STAY SKEPTICAL   •   ${BRAND.anchor}`;
  const loop = `${marquee}      ★      ${marquee}      ★      `;
  const scroll = -((frame * 3.2) % 1600); // px/sec scroll, wraps via doubled text
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height, background: NH.charcoal, display: 'flex', alignItems: 'stretch', borderTop: `3px solid ${NH.yellow}` }}>
      <div style={{ background: NH.yellow, display: 'flex', alignItems: 'center', padding: '0 24px', zIndex: 2 }}>
        <span style={{ fontFamily: ANTON, fontSize: 30, color: NH.ink, letterSpacing: 1 }}>{BRAND.name}</span>
        <span style={{ fontFamily: ANTON, fontSize: 30, color: NH.orange, letterSpacing: 1, marginLeft: 6 }}>{BRAND.name2}</span>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', whiteSpace: 'nowrap', transform: `translateX(${scroll}px)`, fontFamily: INTER, fontWeight: 700, fontSize: 26, color: 'rgba(255,255,255,0.82)', letterSpacing: 0.5 }}>
          {loop}{loop}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 22px', background: NH.charcoal, zIndex: 2, borderLeft: '2px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: NH.cyan, marginRight: 10, opacity: 0.4 + 0.6 * shimmer, boxShadow: `0 0 ${8 + 8 * shimmer}px ${NH.cyan}` }} />
        <span style={{ fontFamily: INTER, fontWeight: 900, fontSize: 22, color: NH.cyan, letterSpacing: 2 }}>{right ?? 'LIVE'}</span>
      </div>
    </div>
  );
};

// Faint scrolling wire-feed lines for empty charcoal backgrounds (splash scenes).
export const WireField: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: 0.5 }}>
      {Array.from({ length: 14 }).map((_, i) => {
        const y = (i / 14) * 1920;
        const shift = ((frame * (i % 2 ? 1.2 : -1.2)) % 400);
        return (
          <div key={i} style={{ position: 'absolute', top: y, left: -200, right: -200, height: 2, background: i % 4 === 0 ? NH.cyan : 'rgba(255,255,255,0.12)', transform: `translateX(${shift}px)`, opacity: i % 4 === 0 ? 0.5 : 0.25 }} />
        );
      })}
    </AbsoluteFill>
  );
};
