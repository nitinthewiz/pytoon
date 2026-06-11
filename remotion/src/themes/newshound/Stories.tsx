import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { Story } from './Story';
import { TRANSITION_FRAMES } from '../../layout';
import { NH } from '../newshound';
import { type CompositionProps } from '../../types';

// The stories block — one Story scene per news item, snappy slide transitions.
// (Newshound theme equivalent of the classic NewsSlideshow.)
export const Stories: React.FC<CompositionProps> = ({ items }) => {
  // Skip the classic intro-teaser item (imagePath null + teaserImages): in the
  // newshound cut the intro lives in the Headlines scene, not here.
  const stories = items.filter((it) => !(it.imagePath === null && (it.teaserImages?.length ?? 0) > 0));
  const ticker = stories.map((s) => (s.take ?? s.title ?? '').toUpperCase()).filter(Boolean).join('     •     ');
  return (
    <AbsoluteFill style={{ background: NH.charcoal }}>
      <TransitionSeries>
        {stories.map((item, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={item.durationInFrames}>
              <Story item={item} index={i} total={stories.length} ticker={ticker} />
            </TransitionSeries.Sequence>
            {i < stories.length - 1 && (
              <TransitionSeries.Transition
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
                presentation={slide({ direction: i % 2 ? 'from-right' : 'from-bottom' })}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
