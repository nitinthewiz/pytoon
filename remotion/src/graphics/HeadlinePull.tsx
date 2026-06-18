// HeadlinePull — sourcing / a scoop, the "clipped front page" beat.
// Theme-agnostic per visual-component-library §2.5: a bg2 clipping card, outlet kicker in
// accent caps, the display headline types/clips in line by line, paper-fold shadow + a hero
// SOURCE tab (no real-page screenshot = license-safe). Reads ALL colours/fonts/motion from
// useTheme() — imports NO NH/ANTON/INTER. Renders inside <GraphicShell>. Authors the
// IN/BUILD/IDLE envelope only — NO exit (the TransitionSeries owns the out). CSS
// transform/opacity/filter + interpolate()/spring() only — headless-safe.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal } from './GraphicShell';
import type { HeadlinePullData } from './types';

export const HeadlinePull: React.FC<HeadlinePullData> = ({ headline, outlet, date }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  // IN: the whole clipping card pops in with a slight unfold tilt.
  const pop = spring({ frame: frame - 2, fps, config: { damping: 12, mass: 0.7, stiffness: 150 } });
  const cardScale = interpolate(pop, [0, 1], [0.78, 1]);
  const cardTilt = interpolate(pop, [0, 1], [-3, 0]);

  // BUILD: split the headline into ~24-char lines and clip each one in line by line (a
  // left→right wipe via a width-clamped clip — reads as a typewriter without per-char state).
  const lines = wrapWords(headline.toUpperCase(), 22);

  return (
    <GraphicShell wire={false}>
      <div
        style={{
          position: 'relative',
          width: 900,
          background: t.palette.bg2,
          borderRadius: t.motion.cornerRadius,
          padding: '64px 56px 72px',
          transform: `scale(${cardScale}) rotate(${cardTilt}deg)`,
          // paper-fold shadow: a hard drop + a soft ambient, plus an inset fold seam.
          boxShadow: `0 26px 60px rgba(0,0,0,0.55), 0 6px 0 ${t.palette.secondary}`,
          border: `2px solid rgba(255,255,255,0.06)`,
          overflow: 'hidden',
        }}
      >
        {/* paper-fold seam down the card (a faint diagonal sheen) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(105deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0.18) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* hero SOURCE tab, top-right corner */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 44,
            background: t.palette.hero,
            color: t.palette.heroInk,
            fontFamily: t.fonts.display,
            fontWeight: t.fonts.displayWeight,
            fontSize: 34,
            letterSpacing: 3,
            padding: '14px 22px 18px',
            borderBottomLeftRadius: t.motion.cornerRadius / 2,
            borderBottomRightRadius: t.motion.cornerRadius / 2,
            transform: `translateY(${interpolate(buildReveal(frame, 4, 10), [0, 1], [-90, 0])}px)`,
          }}
        >
          SOURCE
        </div>

        {/* outlet kicker — accent caps */}
        {outlet && (
          <div
            style={{
              fontFamily: t.fonts.body,
              fontWeight: 800,
              fontSize: 40,
              textTransform: 'uppercase',
              letterSpacing: 4,
              color: t.palette.accent,
              opacity: buildReveal(frame, 10, 10),
              marginBottom: 22,
            }}
          >
            {outlet}
            {date && (
              <span style={{ color: t.palette.fg, opacity: 0.45, marginLeft: 18 }}>· {date}</span>
            )}
          </div>
        )}

        {/* display headline — each line clips in (L→R width wipe), staggered */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lines.map((line, i) => {
            const lineReveal = buildReveal(frame, 16 + i * 6, 8);
            return (
              <div
                key={i}
                style={{
                  fontFamily: t.fonts.display,
                  fontWeight: t.fonts.displayWeight,
                  fontSize: 78,
                  lineHeight: 1.02,
                  color: t.palette.fg,
                  WebkitTextStroke: `${Math.max(1, t.motion.strokeWeight - 6)}px ${t.palette.heroInk}`,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  // typewriter clip: reveal the line by clamping its visible width 0→100%.
                  clipPath: `inset(0 ${(1 - lineReveal) * 100}% 0 0)`,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </GraphicShell>
  );
};

// Greedy word-wrap to ~maxChars per line so the headline clips line by line.
function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}
