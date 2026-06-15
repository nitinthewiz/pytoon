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
import { ShowLayout } from './ShowLayout';
import { SectionCard, sectionOf, startsNewSection, rundownMoreLine } from './Sections';
import { type CompositionProps, type NewsItem } from '../../types';

const isTeaser = (it: NewsItem) => it.imagePath === null && (it.teaserImages?.length ?? 0) > 0;

// Rundown headlines for the fb theme: LLM teasers (top section only), max 5.
const fbHeadlines = (stories: NewsItem[]) =>
  stories.filter((it) => sectionOf(it) === 'top').map((it) => it.teaser ?? it.take ?? it.title).filter((t): t is string => Boolean(t));

const storyTicker = (stories: NewsItem[]) =>
  stories.map((s) => (s.take ?? s.title ?? '').toUpperCase()).filter(Boolean).join('     •     ');

// One full-bleed story + (when it opens a new section) the divider card overlay.
// The SectionCard mounts INSIDE the story (frame 0 = story start) and sweeps off
// after SECTION_CARD_FRAMES, revealing the story already running beneath — zero
// timeline impact, exactly as before.
const FBStory: React.FC<{ stories: NewsItem[]; item: NewsItem; index: number; total: number; ticker: string }> = ({ stories, item, index, total, ticker }) => (
  <>
    <StoryFullBleed item={item} index={index} total={total} ticker={ticker} />
    {startsNewSection(stories, index) && <SectionCard section={sectionOf(item)} />}
  </>
);

// Legacy full-bleed stories block (fallback path only — no props.timeline).
const StoriesFB: React.FC<CompositionProps> = ({ items }) => {
  const stories = items.filter((it) => !isTeaser(it));
  const ticker = storyTicker(stories);
  return (
    <AbsoluteFill style={{ background: NH.charcoal }}>
      <TransitionSeries>
        {stories.map((item, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={item.durationInFrames}>
              <FBStory stories={stories} item={item} index={i} total={stories.length} ticker={ticker} />
            </TransitionSeries.Sequence>
            {i < stories.length - 1 && (
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

export const NewshoundShowFB: React.FC<CompositionProps> = ({ items, captions, closingFrames: closeF, timeline }) => {
  const stories = items.filter((it) => !isTeaser(it));
  const headlines = fbHeadlines(stories);
  const moreLine = rundownMoreLine(stories);

  // --- Absolute-frame layout (real renders) -------------------------------
  if (timeline) {
    const ticker = storyTicker(stories);
    const headLen = timeline.storyStartFrames[0] - timeline.headlinesStartFrame;
    return (
      <ShowLayout
        stories={stories}
        timeline={timeline}
        scenes={{
          opening: <Opening />,
          headlines: <Headlines headlines={headlines} durationInFrames={headLen} moreLine={moreLine} />,
          story: (item, i, total) => <FBStory stories={stories} item={item} index={i} total={total} ticker={ticker} />,
          closing: <ClosingFB />,
        }}
      />
    );
  }

  // --- Legacy fallback (no timeline: previews / default props) ------------
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
          <Headlines headlines={headlines} durationInFrames={headF} moreLine={moreLine} />
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
