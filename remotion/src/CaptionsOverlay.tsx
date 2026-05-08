import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { createTikTokStyleCaptions } from '@remotion/captions';
import { type Props } from './NewsSlideshow';

// Captions sit at avatar chest level (~4/5 down the 2688px canvas).
const CAPTION_TOP = 2050;

export const CaptionsOverlay: React.FC<Props> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000;

  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions: captions ?? [],
        combineTokensWithinMilliseconds: 1200,
      }),
    [captions],
  );

  const activePage = pages.findLast((p) => p.startMs <= timeMs) ?? null;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {activePage && (
        <div
          style={{
            position: 'absolute',
            top: CAPTION_TOP,
            left: 0,
            right: 0,
            padding: '0 80px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {activePage.tokens.map((token, i) => {
            const isActive = timeMs >= token.fromMs && timeMs <= token.toMs;
            return (
              <span
                key={i}
                style={{
                  fontFamily: '"Arial Black", Arial, sans-serif',
                  fontSize: 64,
                  fontWeight: 900,
                  lineHeight: 1.3,
                  color: isActive ? '#FFE81A' : '#FFFFFF',
                  textShadow:
                    '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000',
                  whiteSpace: 'pre',
                }}
              >
                {token.text}
              </span>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
