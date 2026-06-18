// StatComparison — which of 2-4 magnitudes is bigger (MOTION_GRAPHICS_SPEC §StatComparison).
// Horizontal bars grow L->R staggered 4f, biggest bar = hero colour (others = accent), a
// value count-up rides each bar's tip. Theme-agnostic: ALL colours/fonts/motion come from
// useTheme() — imports NO NH/ANTON/INTER. Renders inside <GraphicShell>. Authors the
// IN/BUILD/IDLE envelope only — NO exit (the TransitionSeries owns the out).
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal, idleOsc } from './GraphicShell';
import type { StatComparisonData } from './types';

export const StatComparison: React.FC<StatComparisonData> = ({ items, caption }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <GraphicShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: 940 }}>
        {items.map((it, i) => {
          const delay = 6 + i * 4;
          // BUILD: bar grows L->R over `dur`, value counts up over the same window.
          const grow = buildReveal(frame, delay, 24); // 0..1 width fraction
          const count = it.value * interpolate(frame, [delay, delay + 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const isBiggest = it.value === max;
          // IDLE: a faint shimmer on the biggest bar once the build has settled.
          const shimmer = isBiggest ? 1 + idleOsc(frame, 90) * 0.02 : 1;
          // bar fills proportional to its value vs the max, scaled by the grow envelope.
          const widthPct = (it.value / max) * 100 * grow;
          const decimals = Number.isInteger(it.value) ? 0 : 1;
          const shown = `${count.toFixed(decimals)}${it.unit ?? ''}`;

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  fontFamily: t.fonts.body,
                  fontWeight: t.fonts.bodyWeight,
                  fontSize: 38,
                  color: t.palette.fg,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  opacity: buildReveal(frame, delay - 2, 10),
                }}
              >
                {it.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div
                  style={{
                    height: 96,
                    minWidth: 4,
                    borderRadius: t.motion.cornerRadius,
                    width: `${widthPct}%`,
                    transform: `scaleX(${shimmer})`,
                    transformOrigin: 'left center',
                    background: isBiggest ? t.palette.hero : t.palette.accent,
                    boxShadow: `0 10px 0 ${t.palette.secondary}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: t.fonts.display,
                    fontWeight: t.fonts.displayWeight,
                    fontSize: 90,
                    lineHeight: 0.9,
                    whiteSpace: 'nowrap',
                    color: isBiggest ? t.palette.hero : t.palette.fg,
                    WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
                    opacity: buildReveal(frame, delay, 10),
                  }}
                >
                  {shown}
                </span>
              </div>
            </div>
          );
        })}
        {caption && (
          <div
            style={{
              marginTop: 8,
              fontFamily: t.fonts.body,
              fontWeight: 800,
              fontSize: 44,
              color: t.palette.fg,
              textTransform: 'uppercase',
              letterSpacing: 1,
              opacity: buildReveal(frame, 6 + items.length * 4 + 6, 12),
            }}
          >
            {caption}
          </div>
        )}
      </div>
    </GraphicShell>
  );
};
