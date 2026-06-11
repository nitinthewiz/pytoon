import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, INTER } from '../../fonts';
import { NH, BRAND } from '../newshound';
import { WireField } from './Furniture';

// Closing for the fb theme. No static mascot — the KEYED pytoon avatar (centered
// bottom, composited by compose.js) signs off here while the [CLOSE] narration
// plays. Sign-off graphics sit up top so they clear James + the captions.
export const ClosingFB: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 2, fps, config: { damping: 12, mass: 0.6, stiffness: 150 } });
  const sub = interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${NH.charcoal2} 0%, ${NH.charcoal} 75%)` }}>
      <WireField />
      <div style={{ position: 'absolute', top: 280, left: 40, right: 40, textAlign: 'center', transform: `scale(${interpolate(pop, [0, 1], [1.2, 1])})`, opacity: pop }}>
        <div style={{ fontFamily: ANTON, fontSize: 110, lineHeight: 0.95, color: NH.yellow, WebkitTextStroke: `5px ${NH.ink}`, letterSpacing: 1 }}>STAY SKEPTICAL.</div>
      </div>
      <div style={{ position: 'absolute', top: 470, left: 0, right: 0, textAlign: 'center', opacity: sub }}>
        <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 38, color: NH.white }}>Links to every story in the description.</div>
        <div style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: ANTON, fontSize: 40, color: NH.yellow }}>{BRAND.name}</span>
          <span style={{ fontFamily: ANTON, fontSize: 40, color: NH.cyan, letterSpacing: 3 }}>{BRAND.name2}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
