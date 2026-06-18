// ProgressMeter — progress toward a target (MOTION_GRAPHICS_SPEC §ProgressMeter).
// A single horizontal fill bar grows to value/max, a big current/target count-up rides
// above it, with an optional "X to go" + deadline caption. Theme-agnostic: ALL colours/
// fonts/motion come from useTheme() — imports NO NH/ANTON/INTER. Renders inside
// <GraphicShell>. Authors the IN/BUILD/IDLE envelope only — NO exit (the TransitionSeries
// owns the out).
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal, idleOsc } from './GraphicShell';
import type { ProgressMeterData } from './types';

// Format a number with thousands separators, dropping a trailing ".0".
const fmt = (n: number, decimals: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const ProgressMeter: React.FC<ProgressMeterData> = ({ value, max, label, unit, deadline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  const safeMax = max || 1;
  const clamped = Math.max(0, Math.min(value, safeMax));
  const frac = clamped / safeMax; // 0..1

  // BUILD: the fill grows with a spring; the current value counts up over the same window.
  const settle = spring({ frame: frame - 4, fps, config: { damping: 14, mass: 0.8, stiffness: 130 } });
  const countT = interpolate(frame, [6, 32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shownCurrent = clamped * countT;
  // IDLE: a faint shimmer on the fill once settled.
  const shimmer = 1 + idleOsc(frame, 90) * 0.015;
  const fillPct = frac * settle * 100 * shimmer;

  const decimals = Number.isInteger(clamped) && Number.isInteger(safeMax) ? 0 : 1;
  const u = unit ?? '';
  const remaining = Math.max(0, safeMax - clamped);
  const toGo = `${fmt(remaining, decimals)}${u} to go`;

  return (
    <GraphicShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, width: 940 }}>
        {/* label kicker */}
        <div
          style={{
            fontFamily: t.fonts.body,
            fontWeight: t.fonts.bodyWeight,
            fontSize: 44,
            color: t.palette.fg,
            textTransform: 'uppercase',
            letterSpacing: 1,
            opacity: buildReveal(frame, 4, 10),
          }}
        >
          {label}
        </div>

        {/* big current / target */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 18,
            fontFamily: t.fonts.display,
            fontWeight: t.fonts.displayWeight,
            lineHeight: 0.9,
            transform: `scale(${interpolate(settle, [0, 1], [0.7, 1])})`,
            transformOrigin: 'left bottom',
          }}
        >
          <span
            style={{
              fontSize: 160,
              color: t.palette.hero,
              WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
              textShadow: `0 8px 0 ${t.palette.secondary}`,
            }}
          >
            {fmt(shownCurrent, decimals)}
            {u}
          </span>
          <span style={{ fontSize: 80, color: t.palette.fg, opacity: 0.85 }}>
            / {fmt(safeMax, decimals)}
            {u}
          </span>
        </div>

        {/* the fill bar */}
        <div
          style={{
            position: 'relative',
            height: 64,
            width: '100%',
            borderRadius: t.motion.cornerRadius,
            background: t.palette.bg2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${fillPct}%`,
              borderRadius: t.motion.cornerRadius,
              background: t.palette.hero,
              boxShadow: `inset 0 -8px 0 ${t.palette.secondary}`,
            }}
          />
        </div>

        {/* X to go (+ deadline) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: buildReveal(frame, 26, 12),
          }}
        >
          <span
            style={{
              fontFamily: t.fonts.body,
              fontWeight: 800,
              fontSize: 40,
              color: t.palette.accent,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {toGo}
          </span>
          {deadline && (
            <span
              style={{
                fontFamily: t.fonts.body,
                fontWeight: 800,
                fontSize: 40,
                color: t.palette.fg,
                textTransform: 'uppercase',
                letterSpacing: 1,
                opacity: 0.7,
              }}
            >
              by {deadline}
            </span>
          )}
        </div>
      </div>
    </GraphicShell>
  );
};
