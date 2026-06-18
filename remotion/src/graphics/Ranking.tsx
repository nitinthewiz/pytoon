// Ranking / Leaderboard — ordered standings, "who is winning".
// Theme-agnostic (reads ALL colours/fonts/motion from useTheme() — imports NO NH/ANTON/
// INTER). Renders inside <GraphicShell>. Authors the IN/BUILD/IDLE envelope only — NO exit
// (the TransitionSeries owns the out).
//
// Animation (MOTION_GRAPHICS_SPEC §Ranking): rows slide in from the right staggered ~3f,
// rank in the display font (hero colour), value count-up, up/down delta chevron
// (accent = up / alert = down). The top row gets the hero plate; the rest sit on bg2.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal } from './GraphicShell';
import type { RankingData } from './types';

export const Ranking: React.FC<RankingData> = ({ title, rows }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  // BUILD: count-up factor each row's value animates to (shared envelope, staggered per row).
  const countFactor = (i: number) =>
    interpolate(frame, [8 + i * 3, 30 + i * 3], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  // a value can carry decimals — preserve them in the count-up
  const fmt = (v: number, f: number) => {
    const decimals = Number.isInteger(v) ? 0 : (String(v).split('.')[1]?.length ?? 0);
    return (v * f).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <GraphicShell wire={false} align="center">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 940 }}>
        {/* title */}
        <div
          style={{
            fontFamily: t.fonts.display,
            fontWeight: t.fonts.displayWeight,
            fontSize: 72,
            lineHeight: 1,
            color: t.palette.hero,
            textTransform: 'uppercase',
            letterSpacing: 1,
            WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
            opacity: buildReveal(frame, 2, 10),
            marginBottom: 6,
          }}
        >
          {title}
        </div>

        {rows.map((r, i) => {
          // IN/BUILD: row slides in from the right + fades, staggered 3f
          const inSpring = spring({
            frame: frame - (4 + i * 3),
            fps,
            config: { damping: 14, mass: 0.7, stiffness: 150 },
          });
          const slideX = interpolate(inSpring, [0, 1], [560, 0]);
          const rowOpacity = buildReveal(frame, 4 + i * 3, 12);
          const isTop = i === 0;
          const count = fmt(r.value, countFactor(i));

          // delta chevron: up=accent, down=alert; none if delta absent/zero
          const hasDelta = r.delta !== undefined && r.delta !== 0;
          const up = (r.delta ?? 0) > 0;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 22,
                padding: '14px 26px',
                borderRadius: t.motion.cornerRadius,
                background: isTop ? t.palette.hero : t.palette.bg2,
                border: isTop ? `0` : `2px solid rgba(255,255,255,0.08)`,
                transform: `translateX(${slideX}px)`,
                opacity: rowOpacity,
              }}
            >
              {/* rank — display font, hero colour (ink on the hero plate for the top row) */}
              <span
                style={{
                  fontFamily: t.fonts.display,
                  fontWeight: t.fonts.displayWeight,
                  fontSize: 78,
                  lineHeight: 0.9,
                  minWidth: 96,
                  textAlign: 'center',
                  color: isTop ? t.palette.heroInk : t.palette.hero,
                  WebkitTextStroke: isTop ? 'unset' : `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
                }}
              >
                {r.rank}
              </span>

              {/* name — body font, fills remaining space, clamps */}
              <span
                style={{
                  flex: 1,
                  fontFamily: t.fonts.body,
                  fontWeight: 800,
                  fontSize: 46,
                  color: isTop ? t.palette.heroInk : t.palette.fg,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {r.name}
              </span>

              {/* delta chevron */}
              {hasDelta && (
                <span
                  style={{
                    fontFamily: t.fonts.display,
                    fontWeight: t.fonts.displayWeight,
                    fontSize: 52,
                    lineHeight: 1,
                    color: up ? t.palette.accent : t.palette.alert,
                    opacity: buildReveal(frame, 14 + i * 3, 8),
                  }}
                >
                  {up ? '▲' : '▼'}
                  {Math.abs(r.delta as number)}
                </span>
              )}

              {/* value — display font, count-up */}
              <span
                style={{
                  fontFamily: t.fonts.display,
                  fontWeight: t.fonts.displayWeight,
                  fontSize: 64,
                  lineHeight: 1,
                  minWidth: 150,
                  textAlign: 'right',
                  color: isTop ? t.palette.heroInk : t.palette.fg,
                }}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </GraphicShell>
  );
};
