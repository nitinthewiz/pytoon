// KeyValueGrid — a set of facts (deal terms, box-score, spec sheet). Universal fallback.
// Theme-agnostic (reads ALL colours/fonts/motion from useTheme() — imports NO NH/ANTON/
// INTER). Renders inside <GraphicShell>. Authors the IN/BUILD/IDLE envelope only — NO exit
// (the TransitionSeries owns the out).
//
// Animation (MOTION_GRAPHICS_SPEC §KeyValueGrid): a 2-col grid of bg2 tiles pop in
// staggered; the key is body-700 accent caps, the value is the display font (count-up if
// numeric). 2 cells → 1 col, 3–6 → 2 cols.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal } from './GraphicShell';
import type { KeyValueGridData } from './types';

// Split a value into prefix + numeric + suffix so a count-up can run on the number part
// (e.g. "$2.4B" → "$" + 2.4 + "B", "12 games" → "" + 12 + " games"). Falls back to the raw
// string when there's no leading number (e.g. "Pending").
const splitNumeric = (value: string) => {
  const m = value.match(/^([^\d.-]*)([\d.,]+)(.*)$/);
  if (!m) return { numeric: false as const, raw: value };
  const num = parseFloat(m[2].replace(/,/g, ''));
  if (Number.isNaN(num)) return { numeric: false as const, raw: value };
  const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0;
  return { numeric: true as const, prefix: m[1], num, suffix: m[3], decimals };
};

export const KeyValueGrid: React.FC<KeyValueGridData> = ({ title, cells }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  const cols = cells.length <= 2 ? 1 : 2;

  return (
    <GraphicShell wire={false} align="center">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, width: 940 }}>
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
            textAlign: 'center',
            WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
            opacity: buildReveal(frame, 2, 10),
          }}
        >
          {title}
        </div>

        {/* tile grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 22,
          }}
        >
          {cells.map((c, i) => {
            // IN/BUILD: each tile pops in (spring scale) + fades, staggered ~4f
            const pop = spring({
              frame: frame - (6 + i * 4),
              fps,
              config: { damping: 12, mass: 0.6, stiffness: 170 },
            });
            const scale = interpolate(pop, [0, 1], [0.6, 1]);
            const tileOpacity = buildReveal(frame, 6 + i * 4, 12);

            // value count-up if numeric
            const v = splitNumeric(c.v);
            const countT = interpolate(frame, [10 + i * 4, 32 + i * 4], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const shownValue = v.numeric
              ? `${v.prefix}${(v.num * countT).toFixed(v.decimals)}${v.suffix}`
              : v.raw;

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '26px 30px',
                  borderRadius: t.motion.cornerRadius,
                  background: t.palette.bg2,
                  border: `2px solid rgba(255,255,255,0.08)`,
                  transform: `scale(${scale})`,
                  opacity: tileOpacity,
                }}
              >
                {/* key — body-700 accent caps */}
                <span
                  style={{
                    fontFamily: t.fonts.body,
                    fontWeight: t.fonts.bodyWeight,
                    fontSize: 34,
                    color: t.palette.accent,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                  }}
                >
                  {c.k}
                </span>
                {/* value — display font, count-up if numeric */}
                <span
                  style={{
                    fontFamily: t.fonts.display,
                    fontWeight: t.fonts.displayWeight,
                    fontSize: 72,
                    lineHeight: 1,
                    color: t.palette.fg,
                  }}
                >
                  {shownValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </GraphicShell>
  );
};
