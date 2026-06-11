import React from 'react';
import { AbsoluteFill, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, INTER } from '../../fonts';
import { NH, BRAND } from '../newshound';
import { WireField } from './Furniture';

// Sign-off card. James plants a smug button; brand wordmark; CTA.
export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 2, fps, config: { mass: 0.6, damping: 10, stiffness: 150 } });
  const jamesScale = interpolate(pop, [0, 1], [0.3, 1]);
  const lineIn = spring({ frame: frame - 12, fps, config: { damping: 14 } });
  const subOpacity = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 60%, ${NH.charcoal2} 0%, ${NH.charcoal} 72%)` }}>
      <WireField />

      <div style={{ position: 'absolute', top: 250, left: 0, right: 0, height: 620, display: 'flex', justifyContent: 'center' }}>
        <Img src={staticFile('james_hip.png')} style={{ height: 620, transform: `scale(${jamesScale})`, filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.55))' }} />
      </div>

      {/* sign-off button */}
      <div style={{ position: 'absolute', top: 940, left: 40, right: 40, textAlign: 'center', transform: `scale(${interpolate(lineIn, [0, 1], [1.25, 1])})`, opacity: lineIn }}>
        <span style={{ fontFamily: ANTON, fontSize: 96, lineHeight: 0.95, color: NH.yellow, WebkitTextStroke: `5px ${NH.ink}`, letterSpacing: 1 }}>STAY SKEPTICAL.</span>
      </div>

      {/* CTA */}
      <div style={{ position: 'absolute', top: 1220, left: 0, right: 0, textAlign: 'center', opacity: subOpacity }}>
        <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 40, color: NH.white }}>Links to every story in the description.</div>
        <div style={{ marginTop: 26, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: ANTON, fontSize: 44, color: NH.yellow, letterSpacing: 1 }}>{BRAND.name}</span>
          <span style={{ fontFamily: ANTON, fontSize: 44, color: NH.cyan, letterSpacing: 4 }}>{BRAND.name2}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
