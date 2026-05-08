import React, { useMemo } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { createTikTokStyleCaptions, type Caption } from '@remotion/captions';
import { APPROVED_TRANSITIONS } from './transitions';

export type NewsItem = {
  imagePath: string | null;
  durationInFrames: number;
};

export type Props = {
  items: NewsItem[];
  captions?: Caption[];
};

const TRANSITION_FRAMES = 15;

// Top half of the 1792×2688 canvas is reserved for news images.
// Bottom half is left as a solid color — pytoon overlays its avatar there.
const IMAGE_HEIGHT = 1344;
const BACKGROUND_COLOR = '#c8d8e8';
// Captions sit at chest level of the avatar (~4/5 down the canvas = 2150px).
const CAPTION_TOP = 2050;

export const NewsSlideshow: React.FC<Props> = ({ items, captions }) => {
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
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_COLOR }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: IMAGE_HEIGHT,
          overflow: 'hidden',
        }}
      >
        <TransitionSeries>
          {items.map((item, i) => {
            const makeTransition = APPROVED_TRANSITIONS[i % APPROVED_TRANSITIONS.length];
            return (
              <React.Fragment key={i}>
                <TransitionSeries.Sequence durationInFrames={item.durationInFrames}>
                  <AbsoluteFill>
                    {item.imagePath ? (
                      <AbsoluteFill style={{ padding: 28, boxSizing: 'border-box' }}>
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            border: '3px solid rgba(255,255,255,0.8)',
                            borderRadius: 10,
                            overflow: 'hidden',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Img
                            src={staticFile(item.imagePath)}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      </AbsoluteFill>
                    ) : null}
                  </AbsoluteFill>
                </TransitionSeries.Sequence>
                {i < items.length - 1 && (
                  <TransitionSeries.Transition
                    timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
                    presentation={makeTransition()}
                  />
                )}
              </React.Fragment>
            );
          })}
        </TransitionSeries>
      </div>

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
