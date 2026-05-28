import React from 'react';
import { Composition } from 'remotion';
import { NewsSlideshow } from './NewsSlideshow';
import { CaptionsOverlay } from './CaptionsOverlay';
import { type CompositionProps as Props } from './types';
import { CANVAS_H, TRANSITION_FRAMES } from './layout';

const DEFAULT_PROPS: Props = {
  items: [{ imagePath: 'images/placeholder.jpg', durationInFrames: 90 }],
  captions: [],
};

const calculateMetadata = async ({ props }: { props: Props }) => {
  const total =
    props.items.reduce((sum, item) => sum + item.durationInFrames, 0) -
    Math.max(0, props.items.length - 1) * TRANSITION_FRAMES;
  return { durationInFrames: Math.max(1, total) };
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="NewsSlideshow"
        component={NewsSlideshow}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={CANVAS_H}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="CaptionsOverlay"
        component={CaptionsOverlay}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={CANVAS_H}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
