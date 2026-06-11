import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { Opening } from './Opening';
import { Headlines } from './Headlines';
import { ClosingFB } from './ClosingFB';
import { StoryFullBleed } from './StoryFullBleed';
import { NH } from '../newshound';
import { FPS, SCENE_TRANSITION_FRAMES } from '../../production';
import { TRANSITION_FRAMES } from '../../layout';
import { openingFrames, headlinesFrames, storiesFrames, closingFrames } from './Show';
import { stingerWipe } from './StingerWipe';
import { type CompositionProps, type NewsItem } from '../../types';

const isTeaser = (it: NewsItem) => it.imagePath === null && (it.teaserImages?.length ?? 0) > 0;

// Full-bleed stories block (newshound-fb theme).
const StoriesFB: React.FC<CompositionProps> = ({ items }) => {
  const stories = items.filter((it) => !isTeaser(it));
  const ticker = stories.map((s) => (s.take ?? s.title ?? '').toUpperCase()).filter(Boolean).join('     •     ');
  return (
    <AbsoluteFill style={{ background: NH.charcoal }}>
      <TransitionSeries>
        {stories.map((item, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={item.durationInFrames}>
              <StoryFullBleed item={item} index={i} total={stories.length} ticker={ticker} />
            </TransitionSeries.Sequence>
            {i < stories.length - 1 && (
              // Branded stinger wipe between stories (timed with the transition
              // stingers compose.js drops at each storyBoundaries cut). Keep
              // TRANSITION_FRAMES — build_background's slide timing math uses it.
              <TransitionSeries.Transition
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
                presentation={stingerWipe()}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};

export const NewshoundShowFB: React.FC<CompositionProps> = ({ items, captions, closingFrames: closeF }) => {
  // Rundown uses the LLM teasers (≠ the narration); falls back to take/title.
  const headlines = items.filter((it) => !isTeaser(it)).map((it) => it.teaser ?? it.take ?? it.title).filter((t): t is string => Boolean(t));
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
          <StoriesFB items={items} captions={captions} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={t()} presentation={slide({ direction: 'from-right' })} />
        <TransitionSeries.Sequence durationInFrames={closingFrames(closeF)}>
          <ClosingFB />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
