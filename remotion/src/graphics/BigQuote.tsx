// BigQuote — a strong soundbite, the "Vox highlighter" beat.
// Theme-agnostic per visual-component-library §2.5: oversized display open-quote, body-900
// quote text with a HERO highlighter sweep under the key clause, accent attribution. Reads
// ALL colours/fonts/motion from useTheme() — imports NO NH/ANTON/INTER. Renders inside
// <GraphicShell>. Authors the IN/BUILD/IDLE envelope only — NO exit (the TransitionSeries
// owns the out). CSS transform/opacity/filter + interpolate()/spring() only — headless-safe.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal, idleOsc } from './GraphicShell';
import type { BigQuoteData } from './types';

export const BigQuote: React.FC<BigQuoteData> = ({ text, source, role }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  // IN: the big open-quote springs/pops in.
  const pop = spring({ frame: frame - 2, fps, config: { damping: 11, mass: 0.6, stiffness: 160 } });

  // The "key clause" is the highlighter target: a `**…**` span, else the whole line. The
  // highlighter sweeps L→R under just that clause (the Vox signature).
  const m = text.match(/\*\*(.+?)\*\*/);
  const before = m ? text.slice(0, m.index) : '';
  const key = m ? m[1] : text;
  const after = m ? text.slice((m.index ?? 0) + m[0].length) : '';

  // BUILD: quote text fades up (frames 6–24), highlighter sweeps after it lands (18–40).
  const textReveal = buildReveal(frame, 6, 18);
  const sweep = interpolate(frame, [18, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // IDLE: the highlighter breathes a hair once it has fully drawn.
  const idle = idleOsc(frame, 90, 44) * 0.02;
  const highlightW = `${Math.min(1, sweep + idle) * 100}%`;

  return (
    <GraphicShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, width: 940 }}>
        {/* oversized display open-quote */}
        <div
          style={{
            fontFamily: t.fonts.display,
            fontWeight: t.fonts.displayWeight,
            fontSize: 320,
            lineHeight: 0.6,
            height: 150,
            color: t.palette.hero,
            WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
            transform: `scale(${interpolate(pop, [0, 1], [0.3, 1])})`,
            transformOrigin: 'left top',
          }}
        >
          &ldquo;
        </div>

        {/* body-900 quote text with the highlighter sweep under the key clause */}
        <div
          style={{
            fontFamily: t.fonts.body,
            fontWeight: 900,
            fontSize: 80,
            lineHeight: 1.12,
            color: t.palette.fg,
            opacity: textReveal,
            transform: `translateY(${interpolate(textReveal, [0, 1], [18, 0])}px)`,
          }}
        >
          {before}
          <span style={{ position: 'relative', display: 'inline', whiteSpace: 'pre-wrap' }}>
            {/* highlighter bar drawn BEHIND the key clause (boxDecorationBreak wraps lines) */}
            <span
              style={{
                position: 'absolute',
                left: -6,
                right: 0,
                bottom: 4,
                height: '0.62em',
                width: highlightW,
                background: t.palette.hero,
                opacity: 0.85,
                borderRadius: t.motion.cornerRadius / 3,
                zIndex: 0,
              }}
            />
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                color: t.palette.fg,
                WebkitTextStroke: sweep > 0.05 ? `1px ${t.palette.heroInk}` : undefined,
              }}
            >
              {key}
            </span>
          </span>
          {after}
        </div>

        {/* accent attribution */}
        {source && (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 18,
              opacity: buildReveal(frame, 30, 12),
              transform: `translateX(${interpolate(buildReveal(frame, 30, 12), [0, 1], [-24, 0])}px)`,
            }}
          >
            <span
              style={{
                fontFamily: t.fonts.display,
                fontWeight: t.fonts.displayWeight,
                fontSize: 56,
                letterSpacing: 1,
                color: t.palette.accent,
              }}
            >
              — {source.toUpperCase()}
            </span>
            {role && (
              <span
                style={{
                  fontFamily: t.fonts.body,
                  fontWeight: t.fonts.bodyWeight,
                  fontSize: 38,
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  color: t.palette.fg,
                  opacity: 0.65,
                }}
              >
                {role}
              </span>
            )}
          </div>
        )}
      </div>
    </GraphicShell>
  );
};
