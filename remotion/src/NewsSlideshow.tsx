import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { type Caption } from '@remotion/captions';
import { APPROVED_TRANSITIONS } from './transitions';

export type NewsItem = {
  imagePath: string | null;
  durationInFrames: number;
  title?: string;
  source?: string;
  category?: string;
};

export type Props = {
  items: NewsItem[];
  captions?: Caption[];
};

const TRANSITION_FRAMES = 15;

// ── Layout zones (1080 × 2355 canvas, derived from ToonVertical2.svg) ────────
const AVATAR_ZONE_H = 782;     // studio BG + talking head: y 0–782

const BADGE_Y = 737;           // lower-third badges within avatar zone
const BADGE_H = 70;

// Green accent bar separates the headline card from the news image
const GREEN_BAR_Y = 883;
const GREEN_BAR_H = 113;       // y 883–996

// White headline card sits OVER the green bar, covering its center strip.
// Left (x 0–27) and right (x 1018–1080) edges of the green bar remain visible.
const HEADLINE_CARD_X = 27;
const HEADLINE_CARD_Y = 791;
const HEADLINE_CARD_W = 991;
const HEADLINE_CARD_H = 279;   // y 791–1070

const HEADLINE_Y = 800;        // text top within the card

// News image fills from just below the green bar to canvas bottom
const IMAGE_Y = 985;

const GREEN = '#219653';
const BADGE_BG = '#EBEBEB';

export const NewsSlideshow: React.FC<Props> = ({ items }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff' }}>

      {/* ── Lowest z: studio background fills the avatar zone ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: AVATAR_ZONE_H,
          overflow: 'hidden',
        }}
      >
        <Img
          src={staticFile('studio_bg.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/*
        ── Per-slide content (transitions with each story) ──
        Within each slide, elements are layered bottom→top:
          1. news image
          2. green accent bar (on top of image)
          3. white headline card (covers center of green bar; side strips stay green)
          4. headline text (on white card)
          5. source badge (avatar zone, above studio BG)
      */}
      <TransitionSeries>
        {items.map((item, i) => {
          const makeTransition = APPROVED_TRANSITIONS[i % APPROVED_TRANSITIONS.length];
          return (
            <React.Fragment key={i}>
              <TransitionSeries.Sequence durationInFrames={item.durationInFrames}>
                <AbsoluteFill>

                  {/* 1. News image */}
                  <div
                    style={{
                      position: 'absolute',
                      top: IMAGE_Y,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {item.imagePath ? (
                      <Img
                        src={staticFile(item.imagePath)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e' }} />
                    )}
                  </div>

                  {/* 2. Green accent bar */}
                  <div
                    style={{
                      position: 'absolute',
                      top: GREEN_BAR_Y,
                      left: 0,
                      width: '100%',
                      height: GREEN_BAR_H,
                      backgroundColor: GREEN,
                    }}
                  />

                  {/* 3. White headline card (covers center of green bar) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: HEADLINE_CARD_Y,
                      left: HEADLINE_CARD_X,
                      width: HEADLINE_CARD_W,
                      height: HEADLINE_CARD_H,
                      backgroundColor: '#ffffff',
                    }}
                  />

                  {/* 4. Headline text */}
                  <div
                    style={{
                      position: 'absolute',
                      top: HEADLINE_Y,
                      left: HEADLINE_CARD_X + 16,
                      width: HEADLINE_CARD_W - 32,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Impact, "Arial Black", Arial, sans-serif',
                        fontSize: 58,
                        fontWeight: 900,
                        color: '#111111',
                        lineHeight: 1.15,
                        display: 'block',
                      }}
                    >
                      {item.title ?? ''}
                    </span>
                  </div>

                  {/* 5. Source badge — top-right of avatar zone */}
                  {item.source ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: BADGE_Y,
                        right: 52,
                        width: 226,
                        height: BADGE_H,
                        backgroundColor: BADGE_BG,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: '"Arial Black", Arial, sans-serif',
                          fontSize: 22,
                          fontWeight: 700,
                          color: '#333333',
                        }}
                      >
                        {item.source}
                      </span>
                    </div>
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

      {/* ── Highest z: "Top News" category badge — always visible ── */}
      <div
        style={{
          position: 'absolute',
          top: BADGE_Y,
          left: 52,
          width: 260,
          height: BADGE_H,
          backgroundColor: GREEN,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: '"Arial Black", Arial, sans-serif',
            fontSize: 26,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: 1,
          }}
        >
          TOP NEWS
        </span>
      </div>

    </AbsoluteFill>
  );
};
