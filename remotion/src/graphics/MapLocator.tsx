// MapLocator — where a story is happening. Theme-agnostic, headless-safe: a styled
// "world card" (graticule grid placeholder, NO map tiles / Mapbox / API) — OR, when an
// `outline` SVG path is supplied, that path drawn inline as a stroked region outline.
// Accent centroid pins DROP IN (spring translateY) with a pulsing ring + display label.
// Reads ALL colours/fonts/motion from useTheme() — imports NO NH/ANTON/INTER. Renders
// inside <GraphicShell> (wire OFF — the grid is the texture). Authors the IN/BUILD/IDLE
// envelope only — NO exit (the TransitionSeries owns the out).
//
// Pin coordinates are PERCENTAGES (x,y in 0..100) of the world card, so they're outline-
// agnostic and never need a projection. The map is presentational, not cartographic.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal } from './GraphicShell';
import type { MapLocatorData } from './types';

const CARD_W = 920;
const CARD_H = 620;

export const MapLocator: React.FC<MapLocatorData> = ({ country, outline, pins, region }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  // IN: the world card pops in.
  const cardPop = spring({ frame: frame - 2, fps, config: { damping: 12, mass: 0.6, stiffness: 150 } });
  // BUILD: when an outline path is supplied, draw it in over ~20f via dashoffset.
  const drawT = buildReveal(frame, 4, 20);

  return (
    <GraphicShell wire={false}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        {region && (
          <div
            style={{
              fontFamily: t.fonts.body,
              fontWeight: t.fonts.bodyWeight,
              fontSize: 38,
              color: t.palette.fg,
              textTransform: 'uppercase',
              letterSpacing: 3,
              opacity: buildReveal(frame, 18, 12),
            }}
          >
            {region}
          </div>
        )}

        <div
          style={{
            position: 'relative',
            width: CARD_W,
            height: CARD_H,
            borderRadius: t.motion.cornerRadius,
            background: t.palette.bg2,
            border: `${Math.max(2, t.motion.strokeWeight - 4)}px solid ${t.palette.accent}`,
            boxShadow: `0 18px 50px rgba(0,0,0,0.55)`,
            overflow: 'hidden',
            transform: `scale(${interpolate(cardPop, [0, 1], [0.85, 1])})`,
          }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            {outline ? (
              // Custom region outline: stroke-draw the supplied path.
              <path
                d={outline}
                fill={t.palette.accent}
                fillOpacity={0.12}
                stroke={t.palette.accent}
                strokeWidth={0.6}
                strokeDasharray={400}
                strokeDashoffset={400 * (1 - drawT)}
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              // Styled rect-world placeholder: a faint graticule grid (lat/long lines).
              <g stroke={t.palette.fg} strokeOpacity={0.14} strokeWidth={0.3}>
                {Array.from({ length: 9 }).map((_, i) => {
                  const p = ((i + 1) / 10) * 100;
                  return <line key={`v${i}`} x1={p} y1={0} x2={p} y2={100} />;
                })}
                {Array.from({ length: 5 }).map((_, i) => {
                  const p = ((i + 1) / 6) * 100;
                  return <line key={`h${i}`} x1={0} y1={p} x2={100} y2={p} />;
                })}
              </g>
            )}
          </svg>

          {/* Pins: drop in (spring translateY) with a pulsing accent ring + label. */}
          {pins.map((pin, i) => {
            const drop = spring({
              frame: frame - (10 + i * 5),
              fps,
              config: { damping: 11, mass: 0.5, stiffness: 170 },
            });
            const dy = interpolate(drop, [0, 1], [-120, 0]);
            const appear = drop;
            // IDLE: the ring pulses outward + fades, continuously.
            const startF = 10 + i * 5 + 8;
            const ringPhase = frame < startF ? 0 : ((frame - startF) % 60) / 60;
            const ringScale = 1 + ringPhase * 1.6;
            const ringOpacity = appear * (1 - ringPhase) * 0.7;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${pin.x}%`,
                  top: `${pin.y}%`,
                  transform: `translate(-50%, calc(-100% + ${dy}px))`,
                  opacity: appear,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {pin.label && (
                  <span
                    style={{
                      marginBottom: 8,
                      padding: '4px 14px',
                      borderRadius: 8,
                      background: t.palette.bg,
                      border: `2px solid ${t.palette.accent}`,
                      fontFamily: t.fonts.display,
                      fontWeight: t.fonts.displayWeight,
                      fontSize: 38,
                      lineHeight: 1.1,
                      color: t.palette.fg,
                      letterSpacing: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pin.label.toUpperCase()}
                  </span>
                )}
                {/* the dot + its pulsing ring */}
                <div style={{ position: 'relative', width: 28, height: 28 }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: `4px solid ${t.palette.accent}`,
                      transform: `scale(${ringScale})`,
                      opacity: ringOpacity,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: t.palette.accent,
                      border: `3px solid ${t.palette.fg}`,
                      boxShadow: `0 4px 14px rgba(0,0,0,0.5)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {country && !region && (
          <div
            style={{
              fontFamily: t.fonts.display,
              fontWeight: t.fonts.displayWeight,
              fontSize: 56,
              color: t.palette.hero,
              WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
              letterSpacing: 1,
              opacity: buildReveal(frame, 20, 12),
            }}
          >
            {country.toUpperCase()}
          </div>
        )}
      </div>
    </GraphicShell>
  );
};
