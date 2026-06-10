import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { OpeningSplash } from './scenes/OpeningSplash';
import { HeadlinesList } from './scenes/HeadlinesList';
import { Closing } from './scenes/Closing';
import { NewsSlideshow } from './NewsSlideshow';
import { FPS, SCENE_TRANSITION_FRAMES, sceneDurationSec } from './production';
import { TRANSITION_FRAMES } from './layout';
import { type CompositionProps } from './types';

// Frame counts for each scene of the show.
export const openingFrames = () => Math.round(sceneDurationSec('opening') * FPS);
export const headlinesFrames = () => Math.round(sceneDurationSec('headlines') * FPS);
export const closingFrames = () => Math.round(sceneDurationSec('closing') * FPS);
export const storiesFrames = (items: CompositionProps['items']) =>
  Math.max(
    1,
    items.reduce((s, it) => s + it.durationInFrames, 0) -
      Math.max(0, items.length - 1) * TRANSITION_FRAMES,
  );

// Total Production duration — scenes joined by overlapping transitions.
export const productionDurationFrames = (items: CompositionProps['items']) =>
  openingFrames() +
  headlinesFrames() +
  storiesFrames(items) +
  closingFrames() -
  3 * SCENE_TRANSITION_FRAMES;

// The full show: Opening → Headlines → Stories → Closing.
export const Production: React.FC<CompositionProps> = ({ items, captions }) => {
  const headlines = items.map((it) => it.title).filter((t): t is string => Boolean(t));
  const t = () => linearTiming({ durationInFrames: SCENE_TRANSITION_FRAMES });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={openingFrames()}>
          <OpeningSplash />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition timing={t()} presentation={slide({ direction: 'from-right' })} />

        <TransitionSeries.Sequence durationInFrames={headlinesFrames()}>
          <HeadlinesList headlines={headlines} durationInFrames={headlinesFrames()} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition timing={t()} presentation={slide({ direction: 'from-bottom' })} />

        <TransitionSeries.Sequence durationInFrames={storiesFrames(items)}>
          <NewsSlideshow items={items} captions={captions} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition timing={t()} presentation={fade()} />

        <TransitionSeries.Sequence durationInFrames={closingFrames()}>
          <Closing />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
