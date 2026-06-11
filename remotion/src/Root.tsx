import React from 'react';
import { Composition } from 'remotion';
import { Production, productionDurationFrames } from './Show';
import { NewsSlideshow } from './NewsSlideshow';
import { CaptionsOverlay } from './CaptionsOverlay';
import { OpeningSplash } from './scenes/OpeningSplash';
import { HeadlinesList } from './scenes/HeadlinesList';
import { Closing as ClassicClosing } from './scenes/Closing';
// Newshound theme
import { NewshoundShow, showDurationFrames } from './themes/newshound/Show';
import { NewshoundShowFB } from './themes/newshound/ShowFB';
import { StoryFullBleed } from './themes/newshound/StoryFullBleed';
import { FlagClash } from './themes/newshound/beats/FlagClash';
import { NumberCard } from './themes/newshound/beats/NumberCard';
import { FxDemo } from './themes/newshound/fx';
import { StingerWipeDemo } from './themes/newshound/StingerWipe';
import { NewshoundCaptions } from './themes/newshound/Captions';
import { Opening as NHOpening } from './themes/newshound/Opening';
import { Headlines as NHHeadlines } from './themes/newshound/Headlines';
import { Story as NHStory } from './themes/newshound/Story';
import { Closing as NHClosing } from './themes/newshound/Closing';
import { type CompositionProps as Props } from './types';
import { CANVAS_W, CANVAS_H, FPS } from './production';
import { TRANSITION_FRAMES } from './layout';

const DEFAULT_PROPS: Props = {
  items: [{ imagePath: 'images/placeholder.jpg', durationInFrames: 90, title: 'Sample headline' }],
  captions: [],
};

const storiesMetadata = async ({ props }: { props: Props }) => {
  const total = props.items.reduce((s, it) => s + it.durationInFrames, 0) - Math.max(0, props.items.length - 1) * TRANSITION_FRAMES;
  return { durationInFrames: Math.max(1, total) };
};

// Captions composition spans the whole narration (last caption end + 1s pad).
const captionsMetadata = async ({ props }: { props: Props }) => {
  const caps = props.captions ?? [];
  const lastMs = caps.length ? Math.max(...caps.map((c) => c.endMs ?? 0)) : 0;
  return { durationInFrames: Math.max(1, Math.ceil((lastMs / 1000) * FPS) + FPS) };
};

const SAMPLE_HEADLINES = ['First top story of the day', 'Second headline goes here', 'Third story making news', 'Fourth on the rundown', 'Fifth and final'];
const SAMPLE_ITEM = { imagePath: 'images/0.jpg', durationInFrames: 120, title: 'Sample punchy take headline that runs a couple of lines', category: 'world', source: 'BBC' };

export const Root: React.FC = () => {
  return (
    <>
      {/* === Newshound theme (active) === */}
      <Composition id="NewshoundShow" component={NewshoundShow} durationInFrames={300} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={DEFAULT_PROPS} calculateMetadata={async ({ props }) => ({ durationInFrames: showDurationFrames(props.items) })} />
      <Composition id="NewshoundShowFB" component={NewshoundShowFB} durationInFrames={300} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={DEFAULT_PROPS} calculateMetadata={async ({ props }) => ({ durationInFrames: showDurationFrames(props.items, props.closingFrames) })} />
      <Composition id="NHStoryFB" component={StoryFullBleed} durationInFrames={150} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ item: SAMPLE_ITEM, index: 1, total: 5 }} />
      <Composition id="NHFlagClash" component={FlagClash} durationInFrames={90} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ a: 'in', b: 'cn', mode: 'cooperate', labelA: 'INDIA', labelB: 'CHINA' }} />
      <Composition id="NHNumberCard" component={NumberCard} durationInFrames={90} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ value: '20x', label: 'more potent than fentanyl' }} />
      <Composition id="NHStingerWipe" component={StingerWipeDemo} durationInFrames={60} fps={FPS} width={CANVAS_W} height={CANVAS_H} />
      {/* FX layers — preview each over a sample photo */}
      <Composition id="NHFxScanline" component={FxDemo} durationInFrames={120} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ fx: 'scanline' }} />
      <Composition id="NHFxMesh" component={FxDemo} durationInFrames={120} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ fx: 'mesh' }} />
      <Composition id="NHFxCrt" component={FxDemo} durationInFrames={120} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ fx: 'crt' }} />
      <Composition id="NHFxLightsweep" component={FxDemo} durationInFrames={120} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ fx: 'lightsweep' }} />
      <Composition id="NHFxDots" component={FxDemo} durationInFrames={120} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ fx: 'dots' }} />
      <Composition id="NewshoundCaptions" component={NewshoundCaptions} durationInFrames={90} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={DEFAULT_PROPS} calculateMetadata={captionsMetadata} />
      <Composition id="NHOpening" component={NHOpening} durationInFrames={120} fps={FPS} width={CANVAS_W} height={CANVAS_H} />
      <Composition id="NHHeadlines" component={NHHeadlines} durationInFrames={300} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ headlines: SAMPLE_HEADLINES, durationInFrames: 300 }} />
      <Composition id="NHStory" component={NHStory} durationInFrames={150} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ item: SAMPLE_ITEM }} />
      <Composition id="NHClosing" component={NHClosing} durationInFrames={120} fps={FPS} width={CANVAS_W} height={CANVAS_H} />

      {/* === Classic theme (kept for fallback) === */}
      <Composition id="Production" component={Production} durationInFrames={300} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={DEFAULT_PROPS} calculateMetadata={async ({ props }) => ({ durationInFrames: productionDurationFrames(props.items) })} />
      <Composition id="OpeningSplash" component={OpeningSplash} durationInFrames={90} fps={FPS} width={CANVAS_W} height={CANVAS_H} />
      <Composition id="HeadlinesList" component={HeadlinesList} durationInFrames={180} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={{ headlines: SAMPLE_HEADLINES, durationInFrames: 180 }} />
      <Composition id="Closing" component={ClassicClosing} durationInFrames={90} fps={FPS} width={CANVAS_W} height={CANVAS_H} />
      <Composition id="NewsSlideshow" component={NewsSlideshow} durationInFrames={90} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={DEFAULT_PROPS} calculateMetadata={storiesMetadata} />
      <Composition id="CaptionsOverlay" component={CaptionsOverlay} durationInFrames={90} fps={FPS} width={CANVAS_W} height={CANVAS_H} defaultProps={DEFAULT_PROPS} calculateMetadata={storiesMetadata} />
    </>
  );
};
