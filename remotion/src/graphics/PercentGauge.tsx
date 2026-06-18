// PercentGauge — a single metric inside min/max context (MOTION_GRAPHICS_SPEC §PercentGauge).
// A semicircular SVG arc + needle: the needle SPRINGS to its angle then micro-oscillates,
// with a big % count-up in the centre. Theme-agnostic: ALL colours/fonts/motion come from
// useTheme() — imports NO NH/ANTON/INTER. Renders inside <GraphicShell>. Authors the
// IN/BUILD/IDLE envelope only — NO exit (the TransitionSeries owns the out).
//
// SVG is static markup (no canvas-draw, no WebGL) — headless-safe. The needle is a plain
// <line> rotated via a CSS transform; the arc fill uses stroke-dasharray (no JS path math
// beyond a fixed semicircle).
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal, idleOsc } from './GraphicShell';
import type { PercentGaugeData } from './types';

// Geometry of the semicircular dial (viewBox units).
const W = 720;
const H = 420;
const CX = W / 2;
const CY = 380; // pivot sits low so the arc sweeps the upper half
const R = 300;
// A 180° arc from left (180°) to right (0°), top half. Length = π·R.
const ARC_LEN = Math.PI * R;

export const PercentGauge: React.FC<PercentGaugeData> = ({ value, label, max = 100, zones }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  const clamped = Math.max(0, Math.min(value, max));
  const frac = clamped / max; // 0..1 of the dial

  // BUILD: count-up over the same window the needle settles in.
  const countT = interpolate(frame, [6, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shownVal = clamped * countT;
  const decimals = Number.isInteger(clamped) ? 0 : 1;

  // IN/BUILD: needle springs to its angle; IDLE: it micro-oscillates around it.
  const settle = spring({ frame: frame - 4, fps, config: { damping: 12, mass: 0.7, stiffness: 140 } });
  const wobble = idleOsc(frame, 70) * 1.5; // ±1.5° once settled
  // Needle sweeps from -90° (empty, pointing up-left at frac 0) through the dial; it springs
  // in via `settle` and adds a small idle wobble once settled. Baseline -90 = straight up.
  const needleDeg = -90 + settle * (frac * 180) + wobble;

  // Arc fill grows with the same spring so the coloured sweep tracks the needle.
  const dashFilled = ARC_LEN * (1 - frac * settle);

  // Zone background segments (optional). Each zone paints from the previous `to` up to its
  // own `to` (as a fraction of max) along the track.
  const zoneSegments = (zones ?? []).map((z, i) => {
    const from = i === 0 ? 0 : (zones![i - 1].to / max);
    const to = z.to / max;
    return { from, to, color: z.color };
  });

  return (
    <GraphicShell wire={false}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: 'visible', opacity: buildReveal(frame, 2, 8) }}
        >
          {/* track */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke={t.palette.bg2}
            strokeWidth={40}
            strokeLinecap="round"
          />
          {/* optional zone bands painted over the track */}
          {zoneSegments.map((seg, i) => (
            <path
              key={`z${i}`}
              d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
              fill="none"
              stroke={seg.color}
              strokeWidth={40}
              strokeLinecap="butt"
              strokeDasharray={`${ARC_LEN * (seg.to - seg.from)} ${ARC_LEN}`}
              strokeDashoffset={-ARC_LEN * seg.from}
              opacity={0.45}
            />
          ))}
          {/* filled sweep (hero) — grows with the needle spring */}
          {!zones && (
            <path
              d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
              fill="none"
              stroke={t.palette.hero}
              strokeWidth={40}
              strokeLinecap="round"
              strokeDasharray={`${ARC_LEN} ${ARC_LEN}`}
              strokeDashoffset={dashFilled}
            />
          )}
          {/* needle */}
          <g style={{ transform: `rotate(${needleDeg}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
            <line
              x1={CX}
              y1={CY}
              x2={CX}
              y2={CY - R + 24}
              stroke={t.palette.fg}
              strokeWidth={14}
              strokeLinecap="round"
            />
          </g>
          {/* hub */}
          <circle cx={CX} cy={CY} r={26} fill={t.palette.heroInk} stroke={t.palette.fg} strokeWidth={6} />
        </svg>

        {/* big % count-up — overlaps the dial centre */}
        <div
          style={{
            marginTop: -120,
            fontFamily: t.fonts.display,
            fontWeight: t.fonts.displayWeight,
            fontSize: 200,
            lineHeight: 0.9,
            color: t.palette.hero,
            WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
            textShadow: `0 10px 0 ${t.palette.secondary}`,
            transform: `scale(${interpolate(settle, [0, 1], [0.6, 1])})`,
          }}
        >
          {shownVal.toFixed(decimals)}
          {max === 100 ? '%' : ''}
        </div>

        <div
          style={{
            maxWidth: 820,
            textAlign: 'center',
            fontFamily: t.fonts.body,
            fontWeight: 800,
            fontSize: 50,
            color: t.palette.fg,
            textTransform: 'uppercase',
            letterSpacing: 1,
            opacity: buildReveal(frame, 18, 14),
          }}
        >
          {label}
        </div>
      </div>
    </GraphicShell>
  );
};
