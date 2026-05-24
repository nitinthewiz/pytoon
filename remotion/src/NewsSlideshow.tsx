import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { APPROVED_TRANSITIONS } from './transitions';
import { StorySlide } from './StorySlide';
import { TeaserSlide } from './TeaserSlide';
import { AVATAR_ZONE_H, BADGE_Y, BADGE_H, GREEN, TRANSITION_FRAMES } from './layout';
import { type CompositionProps } from './types';

// Re-export for backwards compatibility (Root.tsx, CaptionsOverlay.tsx import Props from here)
export type { NewsItem, CompositionProps as Props } from './types';

export const NewsSlideshow: React.FC<CompositionProps> = ({ items }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff' }}>

      {/* Studio background — static, lowest z, behind all slide transitions */}
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

      {/* Per-slide content — transitions with each story */}
      <TransitionSeries>
        {items.map((item, i) => {
          const makeTransition = APPROVED_TRANSITIONS[i % APPROVED_TRANSITIONS.length];
          const isTeaser = item.imagePath === null && (item.teaserImages?.length ?? 0) > 0;

          return (
            <React.Fragment key={i}>
              <TransitionSeries.Sequence durationInFrames={item.durationInFrames}>
                {isTeaser ? (
                  <TeaserSlide
                    images={item.teaserImages!}
                    durationInFrames={item.durationInFrames}
                  />
                ) : (
                  <StorySlide item={item} />
                )}
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

      {/* "TOP NEWS" badge — static, highest z, always visible */}
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
