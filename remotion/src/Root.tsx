import React from 'react';
import { Composition } from 'remotion';
import { Production, productionDurationFrames } from './Show';
import { NewsSlideshow } from './NewsSlideshow';
import { CaptionsOverlay } from './CaptionsOverlay';
import { OpeningSplash } from './scenes/OpeningSplash';
import { HeadlinesList } from './scenes/HeadlinesList';
import { Closing } from './scenes/Closing';
import { type CompositionProps as Props } from './types';
import { CANVAS_W, CANVAS_H, FPS } from './production';
import { TRANSITION_FRAMES } from './layout';

const DEFAULT_PROPS: Props = {
  items: [{ imagePath: 'images/placeholder.jpg', durationInFrames: 90, title: 'Sample headline' }],
  captions: [],
};

// Stories-block duration (NewsSlideshow / CaptionsOverlay) — these two render
// the same length and are composited as overlays onto the Production timeline.
const storiesMetadata = async ({ props }: { props: Props }) => {
  const total =
    props.items.reduce((sum, item) => sum + item.durationInFrames, 0) -
    Math.max(0, props.items.length - 1) * TRANSITION_FRAMES;
  return { durationInFrames: Math.max(1, total) };
};

const SAMPLE_HEADLINES = [
  'First top story of the day',
  'Second headline goes here',
  'Third story making news',
  'Fourth item on the rundown',
];

export const Root: React.FC = () => {
  return (
    <>
      {/* The full assembled show */}
      <Composition
        id="Production"
        component={Production}
        durationInFrames={300}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: productionDurationFrames(props.items),
        })}
      />

      {/* Individual scenes — for isolated design/preview */}
      <Composition
        id="OpeningSplash"
        component={OpeningSplash}
        durationInFrames={90}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
      />
      <Composition
        id="HeadlinesList"
        component={HeadlinesList}
        durationInFrames={180}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={{ headlines: SAMPLE_HEADLINES, durationInFrames: 180 }}
      />
      <Composition
        id="Closing"
        component={Closing}
        durationInFrames={90}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
      />

      {/* Stories block + captions overlay (composited later in ffmpeg) */}
      <Composition
        id="NewsSlideshow"
        component={NewsSlideshow}
        durationInFrames={90}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={storiesMetadata}
      />
      <Composition
        id="CaptionsOverlay"
        component={CaptionsOverlay}
        durationInFrames={90}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={storiesMetadata}
      />
    </>
  );
};
