import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { APPROVED_TRANSITIONS } from './transitions';

export type NewsItem = {
  imagePath: string;
  durationInFrames: number;
};

export type Props = {
  items: NewsItem[];
};

const TRANSITION_FRAMES = 15;

// Top half of the 1792×2688 canvas is reserved for news images.
// Bottom half is left as a solid color — pytoon overlays its avatar there.
const IMAGE_HEIGHT = 1344;
const BACKGROUND_COLOR = '#c8d8e8';

export const NewsSlideshow: React.FC<Props> = ({ items }) => {
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
                    <Img
                      src={staticFile(item.imagePath)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
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
    </AbsoluteFill>
  );
};
