// Timeline — events over time (conflict escalation, product history, election calendar).
// Theme-agnostic (reads ALL colours/fonts/motion from useTheme() — imports NO NH/ANTON/
// INTER). Renders inside <GraphicShell>. Authors the IN/BUILD/IDLE envelope only — NO exit
// (the TransitionSeries owns the out).
//
// Animation (MOTION_GRAPHICS_SPEC §Timeline): a vertical spine draws top→bottom
// (interpolate height), dots pop in staggered, dates in the display font + labels in body,
// the last ('now') dot in the hero colour. orientation is reserved ('v' only in v1; 'h'
// falls back to the same vertical layout so an 'h' payload still renders).
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal, idleOsc } from './GraphicShell';
import type { TimelineData } from './types';

const ROW_H = 168; // vertical pitch between events
const SPINE_X = 70; // x of the spine within the 940-wide content column

export const Timeline: React.FC<TimelineData> = ({ events }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  const n = events.length;
  const spineH = (n - 1) * ROW_H;

  // BUILD: spine draws top→bottom over ~28 frames, starting at frame 4.
  const drawT = interpolate(frame, [4, 32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <GraphicShell wire={false} align="center">
      <div style={{ position: 'relative', width: 940, height: spineH + 80 }}>
        {/* spine track (faint, full height) */}
        <div
          style={{
            position: 'absolute',
            left: SPINE_X - 3,
            top: 0,
            width: 6,
            height: spineH,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.12)',
          }}
        />
        {/* spine fill (draws top→bottom, accent colour) */}
        <div
          style={{
            position: 'absolute',
            left: SPINE_X - 3,
            top: 0,
            width: 6,
            height: spineH * drawT,
            borderRadius: 3,
            background: t.palette.accent,
          }}
        />

        {events.map((e, i) => {
          const isLast = i === n - 1;
          // each dot pops once the spine fill reaches it, staggered ~5f
          const dotDelay = 6 + i * 5;
          const pop = spring({
            frame: frame - dotDelay,
            fps,
            config: { damping: 11, mass: 0.5, stiffness: 200 },
          });
          const dotScale = interpolate(pop, [0, 1], [0, 1]);
          // IDLE: the 'now' (last) dot pulses gently after build
          const pulse = isLast ? idleOsc(frame, 70, 40) : 0;
          const ringScale = 1 + pulse * 0.12;

          const textOpacity = buildReveal(frame, dotDelay + 2, 12);
          const y = i * ROW_H;

          const dotColor = isLast ? t.palette.hero : t.palette.accent;
          const dotSize = isLast ? 46 : 34;

          return (
            <React.Fragment key={i}>
              {/* pulsing ring behind the 'now' dot */}
              {isLast && (
                <div
                  style={{
                    position: 'absolute',
                    left: SPINE_X - 38,
                    top: y - 38 + dotSize / 2,
                    width: 76,
                    height: 76,
                    borderRadius: '50%',
                    border: `4px solid ${t.palette.hero}`,
                    opacity: 0.5 * dotScale,
                    transform: `scale(${ringScale})`,
                  }}
                />
              )}
              {/* dot */}
              <div
                style={{
                  position: 'absolute',
                  left: SPINE_X - dotSize / 2,
                  top: y + (46 - dotSize) / 2,
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  background: dotColor,
                  border: `${t.motion.strokeWeight / 2}px solid ${t.palette.heroInk}`,
                  transform: `scale(${dotScale})`,
                }}
              />
              {/* date + label, to the right of the spine */}
              <div
                style={{
                  position: 'absolute',
                  left: SPINE_X + 56,
                  top: y - 8,
                  width: 940 - SPINE_X - 56,
                  opacity: textOpacity,
                }}
              >
                <div
                  style={{
                    fontFamily: t.fonts.display,
                    fontWeight: t.fonts.displayWeight,
                    fontSize: 56,
                    lineHeight: 1,
                    color: isLast ? t.palette.hero : t.palette.fg,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {e.date}
                </div>
                <div
                  style={{
                    fontFamily: t.fonts.body,
                    fontWeight: 700,
                    fontSize: 40,
                    lineHeight: 1.1,
                    color: t.palette.fg,
                    opacity: 0.92,
                    marginTop: 4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {e.label}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </GraphicShell>
  );
};
