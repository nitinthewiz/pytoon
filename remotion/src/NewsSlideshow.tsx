import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { APPROVED_TRANSITIONS } from './transitions';
import { StorySlide } from './StorySlide';
import { TeaserSlide } from './TeaserSlide';
import { AVATAR_ZONE_H, BADGE_Y, BADGE_H, GREEN, TRANSITION_FRAMES, BOTTOM_BAR_H } from './layout';
import { ROBOTO } from './fonts';
import { META, COLORS } from './production';
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

      {/* Bottom ticker bar — static, always visible. Light bar, muted text. */}
      {(() => {
        const now = new Date();
        const edition = now.getHours() < 12 ? 'am edition' : 'pm edition';
        const dateStr = now
          .toLocaleDateString('en-US', {
            weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
          })
          .toLowerCase()
          .replace(/, (\d{4})$/, ' $1'); // "monday, jan 20 2020"
        return (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: BOTTOM_BAR_H,
              backgroundColor: COLORS.footerBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
            }}
          >
            <span style={{ fontFamily: ROBOTO, fontSize: 28, fontWeight: 700, color: '#555555' }}>
              {META.brandName.toLowerCase()}
            </span>
            <span style={{ color: '#BBBBBB', fontSize: 26 }}>|</span>
            <span style={{ fontFamily: ROBOTO, fontSize: 28, fontWeight: 400, color: '#888888' }}>
              {dateStr}
            </span>
            <span style={{ color: '#BBBBBB', fontSize: 26 }}>|</span>
            <span style={{ fontFamily: ROBOTO, fontSize: 28, fontWeight: 400, color: '#888888' }}>
              {edition}
            </span>
          </div>
        );
      })()}

      {/* "Top News" badge — static, highest z, always visible */}
      <div
        style={{
          position: 'absolute',
          top: BADGE_Y,
          left: 40,
          height: BADGE_H,
          padding: '0 36px',
          boxSizing: 'border-box',
          backgroundColor: GREEN,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: ROBOTO,
            fontSize: 44,
            fontWeight: 700,
            color: '#ffffff',
          }}
        >
          Top News
        </span>
      </div>

    </AbsoluteFill>
  );
};
