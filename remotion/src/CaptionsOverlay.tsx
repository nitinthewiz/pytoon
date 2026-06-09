import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { createTikTokStyleCaptions } from '@remotion/captions';
import { CAPTION_TOP } from './layout';
import { ROBOTO } from './fonts';
import { type CompositionProps } from './types';

export const CaptionsOverlay: React.FC<CompositionProps> = ({ captions }) => {
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
            padding: '0 50px',
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
                  fontFamily: ROBOTO,
                  fontSize: 86,
                  fontWeight: 900,
                  lineHeight: 1.22,
                  color: isActive ? '#FFE81A' : '#FFFFFF',
                  textShadow:
                    '-6px -6px 0 #000, 6px -6px 0 #000, -6px 6px 0 #000, 6px 6px 0 #000, 0 0 12px rgba(0,0,0,0.4)',
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
