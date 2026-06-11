import React from 'react';
import { AbsoluteFill, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, INTER } from '../../fonts';
import { NH, BRAND } from '../newshound';
import { WireField } from './Furniture';

// Cold open — music-only brand splash. James pops in, wordmark slams on.
export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const jamesPop = spring({ frame: frame - 4, fps, config: { mass: 0.6, damping: 9, stiffness: 140 } });
  const jamesScale = interpolate(jamesPop, [0, 1], [0.2, 1]);
  const slam = spring({ frame: frame - 14, fps, config: { mass: 0.5, damping: 11, stiffness: 200 } });
  const wordScale = interpolate(slam, [0, 1], [1.4, 1]);
  const wordOpacity = interpolate(frame, [14, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tagOpacity = interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 32%, ${NH.charcoal2} 0%, ${NH.charcoal} 70%)` }}>
      <WireField />

      {/* LIVE pill */}
      <div style={{ position: 'absolute', top: 150, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 14, background: NH.charcoal, border: `2px solid ${NH.cyan}`, borderRadius: 999, padding: '10px 26px', opacity: wordOpacity }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: NH.cyan, boxShadow: `0 0 16px ${NH.cyan}` }} />
        <span style={{ fontFamily: ANTON, fontSize: 30, color: NH.white, letterSpacing: 6 }}>ON THE WIRE</span>
      </div>

      {/* James mascot — pops then gently bobs */}
      <div style={{ position: 'absolute', top: 300, left: 0, right: 0, height: 720, display: 'flex', justifyContent: 'center' }}>
        <Img src={staticFile('james.png')} style={{ height: 720, transform: `scale(${jamesScale}) translateY(${Math.sin(frame / 10) * 10}px)`, filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.55))' }} />
      </div>

      {/* white slam flash */}
      <AbsoluteFill style={{ background: NH.white, opacity: interpolate(frame, [13, 16, 22], [0, 0.55, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), pointerEvents: 'none' }} />

      {/* Wordmark */}
      <div style={{ position: 'absolute', top: 1040, left: 0, right: 0, textAlign: 'center', transform: `scale(${wordScale})`, opacity: wordOpacity }}>
        <div style={{ fontFamily: ANTON, fontSize: 200, lineHeight: 0.86, color: NH.yellow, WebkitTextStroke: `6px ${NH.ink}`, letterSpacing: 2, textShadow: `0 10px 0 ${NH.orange}` }}>{BRAND.name}</div>
        <div style={{ fontFamily: ANTON, fontSize: 200, lineHeight: 0.9, color: NH.cyan, WebkitTextStroke: `6px ${NH.ink}`, letterSpacing: 14 }}>{BRAND.name2}</div>
      </div>

      {/* Tagline */}
      <div style={{ position: 'absolute', top: 1500, left: 0, right: 0, textAlign: 'center', opacity: tagOpacity }}>
        <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: 46, color: NH.white, letterSpacing: 8, padding: '12px 28px', borderTop: `3px solid ${NH.cyan}`, borderBottom: `3px solid ${NH.cyan}` }}>{BRAND.tagline}</span>
      </div>
    </AbsoluteFill>
  );
};
