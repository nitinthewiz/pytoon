// DefinitionCard — what a term means, the "James explains" beat.
// Theme-agnostic per visual-component-library §2.5: a display term in the hero colour
// underlined by a DRAWN accent rule, the body definition fades in word-by-word, optional
// etymology line. Reads ALL colours/fonts/motion from useTheme() — imports NO NH/ANTON/INTER.
// Renders inside <GraphicShell>. Authors the IN/BUILD/IDLE envelope only — NO exit (the
// TransitionSeries owns the out). CSS transform/opacity/filter + interpolate()/spring() only.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal } from './GraphicShell';
import type { DefinitionCardData } from './types';

export const DefinitionCard: React.FC<DefinitionCardData> = ({ term, definition, etymology }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  // IN: the term slams in.
  const pop = spring({ frame: frame - 2, fps, config: { damping: 11, mass: 0.6, stiffness: 170 } });
  // BUILD: the accent rule draws L→R under the term once it has landed.
  const rule = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // BUILD: the definition fades in word-by-word, staggered ~2.5f apart, starting at frame 24.
  const words = definition.split(/\s+/).filter(Boolean);

  return (
    <GraphicShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: 920 }}>
        {/* display term + drawn accent rule */}
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span
            style={{
              fontFamily: t.fonts.display,
              fontWeight: t.fonts.displayWeight,
              fontSize: 170,
              lineHeight: 0.95,
              color: t.palette.hero,
              WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
              textShadow: `0 10px 0 ${t.palette.secondary}`,
              transform: `scale(${interpolate(pop, [0, 1], [0.5, 1])})`,
              transformOrigin: 'left center',
            }}
          >
            {term}
          </span>
          {/* drawn accent rule under the term (width sweeps 0→100%) */}
          <div
            style={{
              marginTop: 14,
              height: 12,
              width: `${rule * 100}%`,
              minWidth: rule > 0 ? 60 : 0,
              background: t.palette.accent,
              borderRadius: t.motion.cornerRadius / 3,
            }}
          />
        </div>

        {/* body definition — word-by-word fade-in */}
        <div
          style={{
            fontFamily: t.fonts.body,
            fontWeight: t.fonts.bodyWeight,
            fontSize: 60,
            lineHeight: 1.28,
            color: t.palette.fg,
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.28em',
                opacity: buildReveal(frame, 24 + i * 2.5, 8),
                transform: `translateY(${interpolate(buildReveal(frame, 24 + i * 2.5, 8), [0, 1], [10, 0])}px)`,
              }}
            >
              {w}
            </span>
          ))}
        </div>

        {/* optional etymology line — secondary, fades in last */}
        {etymology && (
          <div
            style={{
              fontFamily: t.fonts.body,
              fontWeight: t.fonts.bodyWeight,
              fontStyle: 'italic',
              fontSize: 40,
              color: t.palette.fg,
              opacity: buildReveal(frame, 24 + words.length * 2.5 + 6, 12) * 0.7,
            }}
          >
            {etymology}
          </div>
        )}
      </div>
    </GraphicShell>
  );
};
