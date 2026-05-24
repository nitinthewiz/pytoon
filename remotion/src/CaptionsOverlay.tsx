import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { createTikTokStyleCaptions } from '@remotion/captions';
import { type Props } from './NewsSlideshow';

// Captions sit in the news-image zone, roughly 82% down the 2355 px canvas.
const CAPTION_TOP = 1940;

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
    <AbsoluteFill style={{ backgroundColor: '#00FF00' }}>
      {activePage && (
        <div
          style={{
            position: 'absolute',
            top: CAPTION_TOP,
            left: 0,
            right: 0,
            padding: '0 60px',
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
                  fontSize: 76,
                  fontWeight: 900,
                  lineHeight: 1.25,
                  color: isActive ? '#FFE81A' : '#FFFFFF',
                  textShadow:
                    '-4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000',
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
