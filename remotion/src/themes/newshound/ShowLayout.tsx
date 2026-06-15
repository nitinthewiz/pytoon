import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { NH } from '../newshound';
import { StingerWipeOverlay, SectionStingerOverlay, SceneFlashOverlay } from './StingerWipe';
import { sectionOf } from './Sections';
import { type NewsItem, type SceneTimeline } from '../../types';

// ---------------------------------------------------------------------------
// Absolute-frame show layout — shared by both newshound themes (studio-box
// `Show` and full-bleed `ShowFB`), so the timeline + transition-overlay logic
// lives in ONE place. Each theme passes the scene COMPONENTS; this file owns
// WHERE every scene sits on the frame timeline.
//
// THE MODEL (single source of truth = build_background.js's computeTimeline,
// delivered in props.timeline):
//   - Every scene is a plain, contiguous, NON-overlapping <Sequence from=…/>.
//     opening [0, openingFrames); headlines [openingFrames, story1);
//     story k [storyK, storyK+1); closing [closingStart, showEnd).
//   - NO TransitionSeries, NO frames consumed by transitions.
//   - Transitions are OVERLAYS drawn on TOP of the hard cuts:
//       * story->story  : branded StingerWipeOverlay centred on the cut.
//       * scene cuts     : a short SceneFlashOverlay centred on the cut.
//   - The Closing scene absorbs all residual slack (its end == showEndFrame),
//     so the video can never under-run the audio.
// ---------------------------------------------------------------------------

export type ShowScenes = {
  opening: React.ReactNode;
  headlines: React.ReactNode;
  // story k, given its on-screen length (frames) so internal animations
  // (Ken Burns, progress pips) match its window exactly.
  story: (item: NewsItem, index: number, total: number, lengthInFrames: number) => React.ReactNode;
  closing: React.ReactNode;
};

// Centre a wipe/flash overlay on a boundary frame: [boundary - len/2, +len).
const Overlay: React.FC<{ boundary: number; len: number; children: React.ReactNode }> = ({ boundary, len, children }) => {
  const from = Math.max(0, Math.round(boundary - len / 2));
  return (
    <Sequence from={from} durationInFrames={len} layout="none">
      {children}
    </Sequence>
  );
};

export const ShowLayout: React.FC<{
  stories: NewsItem[];
  timeline: SceneTimeline;
  scenes: ShowScenes;
}> = ({ stories, timeline, scenes }) => {
  const { openingFrames, headlinesStartFrame, storyStartFrames, closingStartFrame, showEndFrame, wipeFrames } = timeline;
  const total = stories.length;

  // Where the stories block ends = closing start (or show end if no [CLOSE]).
  const afterStories = closingStartFrame ?? showEndFrame;
  // Scene flash length (frames) for the big section cuts — a touch longer than a
  // story wipe so it reads as a beat. Clamped so it never overruns a short scene.
  const flashLen = Math.max(6, wipeFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: NH.charcoal }}>
      {/* opening [0, openingFrames) */}
      <Sequence from={0} durationInFrames={Math.max(1, openingFrames)}>
        {scenes.opening}
      </Sequence>

      {/* headlines [openingFrames, story1) */}
      <Sequence from={headlinesStartFrame} durationInFrames={Math.max(1, (storyStartFrames[0] ?? afterStories) - headlinesStartFrame)}>
        {scenes.headlines}
      </Sequence>

      {/* one plain Sequence per story [storyK, storyK+1) */}
      {stories.map((item, i) => {
        const start = storyStartFrames[i];
        const end = i + 1 < storyStartFrames.length ? storyStartFrames[i + 1] : afterStories;
        const len = Math.max(1, end - start);
        return (
          <Sequence key={i} from={start} durationInFrames={len}>
            {scenes.story(item, i, total, len)}
          </Sequence>
        );
      })}

      {/* closing [closingStart, showEnd) — absorbs residual slack */}
      {closingStartFrame != null && (
        <Sequence from={closingStartFrame} durationInFrames={Math.max(1, showEndFrame - closingStartFrame)}>
          {scenes.closing}
        </Sequence>
      )}

      {/* ---- transition OVERLAYS on top of the hard cuts ---- */}
      {/* scene boundaries: opening->headlines, headlines->stories, stories->closing */}
      <Overlay boundary={headlinesStartFrame} len={flashLen}><SceneFlashOverlay /></Overlay>
      {storyStartFrames[0] != null && (
        <Overlay boundary={storyStartFrames[0]} len={flashLen}><SceneFlashOverlay /></Overlay>
      )}
      {closingStartFrame != null && (
        <Overlay boundary={closingStartFrame} len={flashLen}><SceneFlashOverlay /></Overlay>
      )}
      {/* story->story branded wipes (skip the first story — its entry is the
          headlines->stories scene cut above). A cut that crosses a SECTION
          boundary (top->sports->fun) gets the distinct BLUE section stinger
          instead of the yellow story wipe; it's a touch longer so it reads as a
          bigger beat and hands off to the blue SectionCard on the next story. */}
      {storyStartFrames.slice(1).map((boundary, idx) => {
        const i = idx + 1; // boundary sits between stories[i-1] and stories[i]
        const sectionChange = stories[i] && stories[i - 1] && sectionOf(stories[i]) !== sectionOf(stories[i - 1]);
        return (
          <Overlay key={`wipe-${idx}`} boundary={boundary} len={sectionChange ? Math.max(wipeFrames, flashLen) : wipeFrames}>
            {sectionChange ? <SectionStingerOverlay /> : <StingerWipeOverlay />}
          </Overlay>
        );
      })}
    </AbsoluteFill>
  );
};
