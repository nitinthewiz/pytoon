// NumberCard — THE TEMPLATE every other graphic block copies.
// Theme-agnostic re-implementation of themes/newshound/beats/NumberCard.tsx: one punchy
// auto-extracted stat with a count-up + spring pop. Reads ALL colours/fonts/motion from
// useTheme() — imports NO NH/ANTON/INTER. Renders inside <GraphicShell>. Authors the
// IN/BUILD/IDLE envelope only — NO exit (the TransitionSeries owns the out).
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal } from './GraphicShell';
import type { NumberCardData } from './types';

export const NumberCard: React.FC<NumberCardData> = ({ value, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  // split into prefix + numeric + suffix (e.g. "3.85%" -> "" + 3.85 + "%", "$50M" -> "$" + 50 + "M")
  const m = value.match(/^([^\d.-]*)([\d.,]+)(.*)$/);
  const prefix = m ? m[1] : '';
  const num = m ? parseFloat(m[2].replace(/,/g, '')) : NaN;
  const suffix = m ? m[3] : value;
  const decimals = m && m[2].includes('.') ? m[2].split('.')[1].length : 0;

  // BUILD: count-up + spring pop
  const countT = interpolate(frame, [4, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shown = isNaN(num) ? value : `${prefix}${(num * countT).toFixed(decimals)}${suffix}`;
  const pop = spring({ frame: frame - 2, fps, config: { damping: 10, mass: 0.6, stiffness: 160 } });

  return (
    <GraphicShell>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: t.fonts.display,
            fontWeight: t.fonts.displayWeight,
            fontSize: 300,
            lineHeight: 0.9,
            color: t.palette.hero,
            WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
            transform: `scale(${interpolate(pop, [0, 1], [0.4, 1])})`,
            textShadow: `0 12px 0 ${t.palette.secondary}`,
          }}
        >
          {isNaN(num) ? value : shown}
        </div>
        {label && (
          <div
            style={{
              maxWidth: 880,
              textAlign: 'center',
              fontFamily: t.fonts.body,
              fontWeight: 800,
              fontSize: 52,
              color: t.palette.fg,
              textTransform: 'uppercase',
              letterSpacing: 1,
              opacity: buildReveal(frame, 16, 14),
            }}
          >
            {label}
          </div>
        )}
      </div>
    </GraphicShell>
  );
};
