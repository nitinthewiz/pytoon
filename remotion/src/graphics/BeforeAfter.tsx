// BeforeAfter — change between two states (MOTION_GRAPHICS_SPEC §BeforeAfter).
// A vertical wipe line sweeps L→R via an interpolated clipPath, revealing the "after"
// card over the "before" card. Two vector stat cards (license-safe — no stills needed);
// BEFORE / AFTER tabs in the display font. Theme-agnostic: ALL colours/fonts/motion come
// from useTheme(); imports NO NH/ANTON/INTER. Renders inside <GraphicShell>. Authors the
// IN/BUILD/IDLE envelope only — NO exit (the TransitionSeries owns the out).
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal, idleOsc } from './GraphicShell';
import type { BeforeAfterData } from './types';

const CARD_W = 920;
const CARD_H = 560;

export const BeforeAfter: React.FC<BeforeAfterData> = ({ before, after }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  // IN: spring slam of the whole frame.
  const pop = spring({ frame: frame - 2, fps, config: { damping: 12, mass: 0.6, stiffness: 160 } });
  const popScale = interpolate(pop, [0, 1], [0.7, 1]);

  // BUILD: the wipe line sweeps L→R (12→40), the "after" clipPath follows it so the after
  // card is revealed over the before card. 0% = nothing revealed, 100% = fully revealed.
  const wipe = interpolate(frame, [12, 40], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // IDLE: a faint shimmer on the wipe line once it has settled at the far edge.
  const lineGlow = 0.6 + 0.4 * Math.abs(idleOsc(frame, 70, 44));

  // A vector stat card (no images — license-safe). `tone` tints the value/tab.
  const StatCard: React.FC<{
    label: string;
    value?: string;
    tab: string;
    tone: string;
    delay: number;
  }> = ({ label, value, tab, tone, delay }) => (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        background: t.palette.bg2,
        borderRadius: t.motion.cornerRadius,
        border: `${t.motion.strokeWeight}px solid ${tone}`,
        boxShadow: `0 18px 50px rgba(0,0,0,0.55)`,
      }}
    >
      {/* BEFORE / AFTER tab in the display font */}
      <div
        style={{
          fontFamily: t.fonts.display,
          fontWeight: t.fonts.displayWeight,
          fontSize: 46,
          letterSpacing: 4,
          color: t.palette.heroInk,
          background: tone,
          padding: '8px 30px',
          borderRadius: t.motion.cornerRadius,
        }}
      >
        {tab}
      </div>
      {value && (
        <div
          style={{
            fontFamily: t.fonts.display,
            fontWeight: t.fonts.displayWeight,
            fontSize: 200,
            lineHeight: 0.9,
            color: tone,
            WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
            opacity: buildReveal(frame, delay, 14),
            transform: `scale(${interpolate(buildReveal(frame, delay, 16), [0, 1], [0.6, 1])})`,
          }}
        >
          {value}
        </div>
      )}
      <div
        style={{
          maxWidth: CARD_W - 120,
          textAlign: 'center',
          fontFamily: t.fonts.body,
          fontWeight: 800,
          fontSize: 48,
          color: t.palette.fg,
          textTransform: 'uppercase',
          letterSpacing: 1,
          opacity: buildReveal(frame, delay + 4, 12),
        }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <GraphicShell wire={false}>
      <div
        style={{
          position: 'relative',
          width: CARD_W,
          height: CARD_H,
          transform: `scale(${popScale})`,
        }}
      >
        {/* BEFORE card — the base layer, always fully drawn. */}
        <StatCard
          label={before.label}
          value={before.value}
          tab="BEFORE"
          tone={t.palette.accent}
          delay={6}
        />
        {/* AFTER card — clipped to the swept region so the wipe reveals it L→R. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `inset(0 ${100 - wipe}% 0 0)`,
          }}
        >
          <StatCard
            label={after.label}
            value={after.value}
            tab="AFTER"
            tone={t.palette.hero}
            delay={14}
          />
        </div>
        {/* The vertical wipe line, sitting at the leading edge of the reveal. */}
        <div
          style={{
            position: 'absolute',
            top: -14,
            bottom: -14,
            left: `${wipe}%`,
            width: 8,
            marginLeft: -4,
            background: t.palette.fg,
            opacity: lineGlow,
            boxShadow: `0 0 26px ${t.palette.hero}`,
          }}
        />
      </div>
    </GraphicShell>
  );
};
