import React from 'react';
import { Composition } from 'remotion';
import { NewsSlideshow, type Props } from './NewsSlideshow';

const TRANSITION_FRAMES = 15;

const DEFAULT_PROPS: Props = {
  items: [{ imagePath: 'images/placeholder.jpg', durationInFrames: 90 }],
  captions: [],
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="NewsSlideshow"
      component={NewsSlideshow}
      durationInFrames={90}
      fps={30}
      width={1792}
      height={2688}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={async ({ props }) => {
        const total =
          props.items.reduce((sum, item) => sum + item.durationInFrames, 0) -
          Math.max(0, props.items.length - 1) * TRANSITION_FRAMES;
        return { durationInFrames: Math.max(1, total) };
      }}
    />
  );
};
