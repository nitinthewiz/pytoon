import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ROBOTO } from '../fonts';
import { META, COLORS } from '../production';

// PLACEHOLDER opening title card — "Newshound News, your daily source of top news".
// Iterate on the real design later (scene-by-scene).
export const OpeningSplash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rise = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 22 });
  const brandY = interpolate(rise, [0, 1], [60, 0]);
  const brandOpacity = interpolate(rise, [0, 1], [0, 1]);
  const taglineOpacity = interpolate(frame, [16, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const barW = interpolate(frame, [10, 30], [0, 420], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 38%, ${COLORS.accent} 0%, ${COLORS.accentDark} 70%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
      }}
    >
      <div
        style={{
          fontFamily: ROBOTO,
          fontSize: 38,
          fontWeight: 500,
          letterSpacing: 14,
          color: 'rgba(255,255,255,0.75)',
          textTransform: 'uppercase',
          opacity: taglineOpacity,
        }}
      >
        Live
      </div>

      <div
        style={{
          fontFamily: ROBOTO,
          fontSize: 130,
          fontWeight: 900,
          lineHeight: 1.0,
          color: '#ffffff',
          textTransform: 'uppercase',
          textAlign: 'center',
          transform: `translateY(${brandY}px)`,
          opacity: brandOpacity,
          textShadow: '0 8px 40px rgba(0,0,0,0.35)',
        }}
      >
        {META.brandName}
      </div>

      <div style={{ height: 8, width: barW, backgroundColor: '#ffffff', borderRadius: 4 }} />

      <div
        style={{
          fontFamily: ROBOTO,
          fontSize: 44,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.92)',
          textAlign: 'center',
          opacity: taglineOpacity,
        }}
      >
        {META.tagline}
      </div>
    </AbsoluteFill>
  );
};
