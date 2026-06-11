import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, INTER } from '../../../fonts';
import { NH } from '../../newshound';
import { WireField } from '../Furniture';

type Props = { value: string; label?: string };

// Motion-graphic beat: a big animated count-up of a key stat. "20x", "3.85%", "$50M".
export const NumberCard: React.FC<Props> = ({ value, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // split into numeric part + suffix (e.g. "3.85%" -> 3.85 + "%", "20x" -> 20 + "x")
  const m = value.match(/^([^\d.-]*)([\d.,]+)(.*)$/);
  const prefix = m ? m[1] : '';
  const num = m ? parseFloat(m[2].replace(/,/g, '')) : NaN;
  const suffix = m ? m[3] : value;
  const decimals = m && m[2].includes('.') ? (m[2].split('.')[1].length) : 0;

  const t = interpolate(frame, [4, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shown = isNaN(num) ? value : `${prefix}${(num * t).toFixed(decimals)}${suffix}`;
  const pop = spring({ frame: frame - 2, fps, config: { damping: 10, mass: 0.6, stiffness: 160 } });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${NH.charcoal2} 0%, ${NH.charcoal} 75%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <WireField />
      <div style={{ fontFamily: ANTON, fontSize: 300, lineHeight: 0.9, color: NH.yellow, WebkitTextStroke: `8px ${NH.ink}`, transform: `scale(${interpolate(pop, [0, 1], [0.4, 1])})`, textShadow: `0 12px 0 ${NH.orange}` }}>
        {isNaN(num) ? value : shown}
      </div>
      {label && (
        <div style={{ maxWidth: 880, textAlign: 'center', fontFamily: INTER, fontWeight: 800, fontSize: 52, color: NH.white, textTransform: 'uppercase', letterSpacing: 1, opacity: interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          {label}
        </div>
      )}
    </AbsoluteFill>
  );
};
