import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON } from '../../../fonts';
import { NH } from '../../newshound';
import { WireField } from '../Furniture';

type Props = {
  a: string;            // ISO country code, e.g. "in"
  b: string;            // ISO country code, e.g. "cn"
  mode?: 'cooperate' | 'clash';
  labelA?: string;
  labelB?: string;
};

const flag = (iso: string) => `https://flagcdn.com/w320/${iso.toLowerCase()}.png`;

// Motion-graphic beat: two flags slam in from the sides and meet on a 🤝 (cooperate)
// or a ⚡VS (clash). On-brand, zero licensing, the "India + China handshake" idea.
export const FlagClash: React.FC<Props> = ({ a, b, mode = 'cooperate', labelA, labelB }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inA = spring({ frame: frame - 2, fps, config: { mass: 0.7, damping: 11, stiffness: 130 } });
  const inB = spring({ frame: frame - 6, fps, config: { mass: 0.7, damping: 11, stiffness: 130 } });
  const xA = interpolate(inA, [0, 1], [-700, 0]);
  const xB = interpolate(inB, [0, 1], [700, 0]);
  const center = spring({ frame: frame - 16, fps, config: { mass: 0.5, damping: 9, stiffness: 200 } });
  const flash = interpolate(frame, [16, 20, 28], [0, 0.5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const FlagCard: React.FC<{ iso: string; x: number; label?: string }> = ({ iso, x, label }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, transform: `translateX(${x}px)` }}>
      <div style={{ width: 360, height: 240, borderRadius: 18, overflow: 'hidden', border: `8px solid ${NH.white}`, boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}>
        <Img src={flag(iso)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <span style={{ fontFamily: ANTON, fontSize: 56, color: NH.white, letterSpacing: 2 }}>{(label ?? iso).toUpperCase()}</span>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${NH.charcoal2} 0%, ${NH.charcoal} 75%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <WireField />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60 }}>
        <FlagCard iso={a} x={xA} label={labelA} />
        {/* center token */}
        <div style={{ transform: `scale(${interpolate(center, [0, 1], [0, 1])}) rotate(${interpolate(center, [0, 1], [-40, 0])}deg)`, fontSize: 150 }}>
          {mode === 'cooperate' ? '🤝' : (
            <span style={{ fontFamily: ANTON, fontSize: 120, color: NH.red, WebkitTextStroke: `5px ${NH.ink}` }}>VS</span>
          )}
        </div>
        <FlagCard iso={b} x={xB} label={labelB} />
      </div>
      <AbsoluteFill style={{ background: NH.white, opacity: flash, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
