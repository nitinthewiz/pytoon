// VS — a two-side matchup. Theme-agnostic generalization of the newshound FlagClash
// composition to ANY two entities (no flags): two display plates slam in from the sides,
// an ink-stroked "VS" springs + rotates into the center on a white flash. Reads ALL
// colours/fonts/motion from useTheme() — imports NO NH/ANTON/INTER. Renders inside
// <GraphicShell> (flash OFF — this block owns its own flash). Authors the IN/BUILD/IDLE
// envelope only — NO exit (the TransitionSeries owns the out).
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal } from './GraphicShell';
import type { VSData } from './types';

export const VS: React.FC<VSData> = ({ a, b, topic }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  // IN: each plate springs in from its side (B trails A by 4f so the impact reads).
  const inA = spring({ frame: frame - 2, fps, config: { mass: 0.7, damping: 11, stiffness: 130 } });
  const inB = spring({ frame: frame - 6, fps, config: { mass: 0.7, damping: 11, stiffness: 130 } });
  const xA = interpolate(inA, [0, 1], [-760, 0]);
  const xB = interpolate(inB, [0, 1], [760, 0]);

  // The "VS" token springs + rotates into center as the plates meet; its own white flash
  // fires on the meet (frame ~16) — that's why GraphicShell's flash is OFF for this block.
  const center = spring({ frame: frame - 16, fps, config: { mass: 0.5, damping: 9, stiffness: 200 } });
  const meetFlash = interpolate(frame, [16, 20, 28], [0, 0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // IDLE: the VS token breathes once it has settled.
  const idle = frame < 40 ? 0 : Math.sin(((frame - 40) / 70) * Math.PI * 2);

  // Per-side accent: explicit color wins, else A wears the hero, B the accent.
  const colorA = a.color ?? t.palette.hero;
  const colorB = b.color ?? t.palette.accent;

  const Plate: React.FC<{ side: VSData['a']; x: number; tint: string }> = ({ side, x, tint }) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        transform: `translateX(${x}px)`,
        width: 380,
      }}
    >
      <div
        style={{
          width: '100%',
          minHeight: 240,
          padding: '34px 26px',
          borderRadius: t.motion.cornerRadius,
          background: t.palette.bg2,
          border: `${t.motion.strokeWeight}px solid ${tint}`,
          boxShadow: `0 18px 50px rgba(0,0,0,0.6), 0 12px 0 ${t.palette.secondary}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: t.fonts.display,
            fontWeight: t.fonts.displayWeight,
            fontSize: 72,
            lineHeight: 0.95,
            textAlign: 'center',
            color: tint,
            WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
            letterSpacing: 1,
          }}
        >
          {side.name.toUpperCase()}
        </span>
        {side.sub && (
          <span
            style={{
              fontFamily: t.fonts.body,
              fontWeight: t.fonts.bodyWeight,
              fontSize: 34,
              textAlign: 'center',
              color: t.palette.fg,
              opacity: 0.85,
            }}
          >
            {side.sub}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <GraphicShell flash={false}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36 }}>
        {topic && (
          <div
            style={{
              fontFamily: t.fonts.body,
              fontWeight: t.fonts.bodyWeight,
              fontSize: 40,
              color: t.palette.fg,
              textTransform: 'uppercase',
              letterSpacing: 3,
              opacity: buildReveal(frame, 22, 12),
            }}
          >
            {topic}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 56 }}>
          <Plate side={a} x={xA} tint={colorA} />
          <div
            style={{
              transform: `scale(${interpolate(center, [0, 1], [0, 1]) + idle * 0.03}) rotate(${
                interpolate(center, [0, 1], [-42, 0]) + idle * 2
              }deg)`,
              fontFamily: t.fonts.display,
              fontWeight: t.fonts.displayWeight,
              fontSize: 130,
              lineHeight: 1,
              color: t.palette.alert,
              WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
              flexShrink: 0,
            }}
          >
            VS
          </div>
          <Plate side={b} x={xB} tint={colorB} />
        </div>
      </div>
      {/* the block owns its own flash — fires on the plates' meet, not the cut */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: t.palette.fg,
          opacity: meetFlash,
          pointerEvents: 'none',
        }}
      />
    </GraphicShell>
  );
};
