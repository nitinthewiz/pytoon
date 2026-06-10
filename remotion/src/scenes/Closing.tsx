import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ROBOTO } from '../fonts';
import { META, COLORS } from '../production';

// PLACEHOLDER closing card — sign-off. Iterate later (scene-by-scene).
export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 20 });
  const scale = interpolate(pop, [0, 1], [0.85, 1]);
  const subOpacity = interpolate(frame, [18, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 45%, ${COLORS.accent} 0%, ${COLORS.accentDark} 72%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <div
        style={{
          fontFamily: ROBOTO,
          fontSize: 96,
          fontWeight: 900,
          color: '#ffffff',
          textTransform: 'uppercase',
          textAlign: 'center',
          transform: `scale(${scale})`,
          textShadow: '0 8px 40px rgba(0,0,0,0.35)',
        }}
      >
        Thanks for{'\n'}watching
      </div>

      <div
        style={{
          fontFamily: ROBOTO,
          fontSize: 40,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.92)',
          textAlign: 'center',
          opacity: subOpacity,
        }}
      >
        All links are in the description.
      </div>

      <div
        style={{
          fontFamily: ROBOTO,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 4,
          color: 'rgba(255,255,255,0.7)',
          textTransform: 'uppercase',
          marginTop: 16,
          opacity: subOpacity,
        }}
      >
        {META.brandName}
      </div>
    </AbsoluteFill>
  );
};
