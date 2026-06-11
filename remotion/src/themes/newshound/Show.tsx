import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { Opening } from './Opening';
import { Headlines } from './Headlines';
import { Stories } from './Stories';
import { Closing } from './Closing';
import { NH } from '../newshound';
import { FPS, SCENE_TRANSITION_FRAMES, sceneDurationSec } from '../../production';
import { TRANSITION_FRAMES } from '../../layout';
import { type CompositionProps, type NewsItem } from '../../types';

const isTeaser = (it: NewsItem) => it.imagePath === null && (it.teaserImages?.length ?? 0) > 0;

export const openingFrames = () => Math.round(sceneDurationSec('opening') * FPS);
// Closing length: the [CLOSE] narration drives it when present; else the config default.
export const closingFrames = (override?: number) => override ?? Math.round(sceneDurationSec('closing') * FPS);

// Headlines runs as long as the intro narration — carried on the teaser item's
// duration (build_background derives it from the first [ITEM] marker time).
export const headlinesFrames = (items: NewsItem[]) => {
  const teaser = items.find(isTeaser);
  return teaser?.durationInFrames ?? Math.round(sceneDurationSec('headlines') * FPS);
};

export const storiesFrames = (items: NewsItem[]) => {
  const stories = items.filter((it) => !isTeaser(it));
  return Math.max(1, stories.reduce((s, it) => s + it.durationInFrames, 0) - Math.max(0, stories.length - 1) * TRANSITION_FRAMES);
};

export const showDurationFrames = (items: NewsItem[], closeF?: number) =>
  openingFrames() + headlinesFrames(items) + storiesFrames(items) + closingFrames(closeF) - 3 * SCENE_TRANSITION_FRAMES;

export const NewshoundShow: React.FC<CompositionProps> = ({ items, captions }) => {
  const headlines = items.filter((it) => !isTeaser(it)).map((it) => it.take ?? it.title).filter((t): t is string => Boolean(t));
  const t = () => linearTiming({ durationInFrames: SCENE_TRANSITION_FRAMES });
  const headF = headlinesFrames(items);

  return (
    <AbsoluteFill style={{ backgroundColor: NH.charcoal }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={openingFrames()}>
          <Opening />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={t()} presentation={fade()} />

        <TransitionSeries.Sequence durationInFrames={headF}>
          <Headlines headlines={headlines} durationInFrames={headF} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={t()} presentation={slide({ direction: 'from-bottom' })} />

        <TransitionSeries.Sequence durationInFrames={storiesFrames(items)}>
          <Stories items={items} captions={captions} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={t()} presentation={slide({ direction: 'from-right' })} />

        <TransitionSeries.Sequence durationInFrames={closingFrames()}>
          <Closing />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
