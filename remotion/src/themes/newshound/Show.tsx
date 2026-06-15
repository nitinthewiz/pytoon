import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { Opening } from './Opening';
import { Headlines } from './Headlines';
import { Stories } from './Stories';
import { Story } from './Story';
import { Closing } from './Closing';
import { NH } from '../newshound';
import { FPS, SCENE_TRANSITION_FRAMES, HOOK_OVERLAP_FRAMES, sceneDurationSec } from '../../production';
import { TRANSITION_FRAMES } from '../../layout';
import { ShowLayout } from './ShowLayout';
import { type CompositionProps, type NewsItem, type SceneTimeline } from '../../types';

const isTeaser = (it: NewsItem) => it.imagePath === null && (it.teaserImages?.length ?? 0) > 0;

export const openingFrames = () => Math.round(sceneDurationSec('opening') * FPS);
// Closing length: the [CLOSE] narration drives it when present; else the config default.
export const closingFrames = (override?: number) => override ?? Math.round(sceneDurationSec('closing') * FPS);

// ---------------------------------------------------------------------------
// LEGACY duration-derived helpers — used ONLY for the fallback path (standalone
// previews / default props that carry no props.timeline). When build_background
// supplies props.timeline (every real render), the absolute-frame layout below
// is used instead and these are bypassed. Kept so the studio previews still
// resolve a sensible length without a full pipeline run.
// ---------------------------------------------------------------------------
export const headlinesFrames = (items: NewsItem[]) => {
  const teaser = items.find(isTeaser);
  if (!teaser) return Math.round(sceneDurationSec('headlines') * FPS);
  const introNarrFrames = Math.max(0, teaser.durationInFrames - TRANSITION_FRAMES);
  return Math.max(1, introNarrFrames + 2 * SCENE_TRANSITION_FRAMES - HOOK_OVERLAP_FRAMES);
};

export const storiesFrames = (items: NewsItem[]) => {
  const stories = items.filter((it) => !isTeaser(it));
  return Math.max(1, stories.reduce((s, it) => s + it.durationInFrames, 0) - Math.max(0, stories.length - 1) * TRANSITION_FRAMES);
};

// Total composition length. With a timeline it's exactly showEndFrame (the
// Closing already absorbed all slack); otherwise the legacy sum.
export const showDurationFrames = (items: NewsItem[], closeF?: number, timeline?: SceneTimeline) => {
  if (timeline) return Math.max(1, timeline.showEndFrame);
  return openingFrames() + headlinesFrames(items) + storiesFrames(items) + closingFrames(closeF) - 3 * SCENE_TRANSITION_FRAMES;
};

// Headlines for the rundown (studio-box theme): the punchy take, else the title.
const studioHeadlines = (items: NewsItem[]) =>
  items.filter((it) => !isTeaser(it)).map((it) => it.take ?? it.title).filter((t): t is string => Boolean(t));

export const NewshoundShow: React.FC<CompositionProps> = ({ items, captions, timeline }) => {
  const stories = items.filter((it) => !isTeaser(it));
  const headlines = studioHeadlines(items);

  // --- Absolute-frame layout (real renders) -------------------------------
  if (timeline) {
    const ticker = stories.map((s) => (s.take ?? s.title ?? '').toUpperCase()).filter(Boolean).join('     •     ');
    return (
      <ShowLayout
        stories={stories}
        timeline={timeline}
        scenes={{
          opening: <Opening />,
          headlines: <Headlines headlines={headlines} durationInFrames={timeline.storyStartFrames[0] - timeline.headlinesStartFrame} />,
          story: (item, i, total) => <Story item={item} index={i} total={total} ticker={ticker} />,
          closing: <Closing />,
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
