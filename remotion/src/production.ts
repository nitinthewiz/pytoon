// Typed loader for the shared production config (single source of truth,
// also read by main.py and build_background.js). Edit productions/<id>/production.json,
// not these exports.
import productionJson from '../../productions/daily-news/production.json';

export type SceneType = 'opening' | 'headlines' | 'stories' | 'closing';

export type SceneConfig = {
  type: SceneType;
  durationSec?: number; // omitted for 'stories' (derived from audio)
};

export type Production = {
  id: string;
  theme?: 'classic' | 'newshound' | 'newshound-fb';
  meta: { brandName: string; anchor: string; tagline: string };
  canvas: { width: number; height: number; fps: number };
  colors: {
    accent: string;
    accentDark: string;
    headline: string;
    badgeBg: string;
    footerBg: string;
    captionActive: string;
    captionBase: string;
  };
  fonts: { family: string };
  voice: { tts: string; speed: number };
  scenes: SceneConfig[];
  avatar: { widthPct: number; cropHeight: number; presentScenes: SceneType[] };
  sceneTransition: { durationFrames: number };
};

export const PRODUCTION = productionJson as Production;
export const THEME = PRODUCTION.theme ?? 'classic';

export const CANVAS_W = PRODUCTION.canvas.width;
export const CANVAS_H = PRODUCTION.canvas.height;
export const FPS = PRODUCTION.canvas.fps;
export const COLORS = PRODUCTION.colors;
export const META = PRODUCTION.meta;
export const SCENES = PRODUCTION.scenes;
export const SCENE_TRANSITION_FRAMES = PRODUCTION.sceneTransition.durationFrames;

export const sceneDurationSec = (type: SceneType): number =>
  PRODUCTION.scenes.find((s) => s.type === type)?.durationSec ?? 0;
