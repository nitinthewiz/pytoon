import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ROBOTO } from '../fonts';
import { COLORS } from '../production';

type Props = {
  headlines: string[];
  durationInFrames: number;
};

// PLACEHOLDER "coming up" scene — top headlines revealed one by one.
// Avatar is composited bottom-right in the final pipeline (not shown in Studio).
export const HeadlinesList: React.FC<Props> = ({ headlines, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = headlines.slice(0, 5);
  // Reveal all bullets across the first ~70% of the scene, evenly staggered.
  const revealWindow = durationInFrames * 0.7;
  const step = items.length > 0 ? revealWindow / items.length : 0;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, #15161A 0%, #0B0C0F 100%)`,
        paddingTop: 150,
        paddingLeft: 64,
        paddingRight: 64,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 60 }}>
        <div style={{ width: 16, height: 92, backgroundColor: COLORS.accent, borderRadius: 4 }} />
        <span
          style={{
            fontFamily: ROBOTO,
            fontSize: 76,
            fontWeight: 900,
            color: '#ffffff',
            textTransform: 'uppercase',
            lineHeight: 1.05,
          }}
        >
          Coming Up{'\n'}Today
        </span>
      </div>

      {/* Bullets, revealed one by one */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {items.map((title, i) => {
          const enter = spring({
            frame: frame - i * step,
            fps,
            config: { damping: 200 },
            durationInFrames: 16,
          });
          const x = interpolate(enter, [0, 1], [-70, 0]);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                opacity: enter,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  backgroundColor: COLORS.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: ROBOTO,
                  fontSize: 38,
                  fontWeight: 900,
                  color: '#ffffff',
                }}
              >
                {i + 1}
              </div>
              <span
                style={{
                  fontFamily: ROBOTO,
                  fontSize: 46,
                  fontWeight: 500,
                  color: '#ffffff',
                  lineHeight: 1.15,
                }}
              >
                {title}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
