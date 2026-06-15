import { type Caption } from '@remotion/captions';

// A single visual "beat" within a story (see VISUAL_ENRICHMENT.md).
export type Visual =
  | { type: 'photo'; src: string }
  | { type: 'entity'; src: string; label?: string }
  | { type: 'flagclash'; a: string; b: string; mode?: 'cooperate' | 'clash'; labelA?: string; labelB?: string }
  | { type: 'number'; value: string; label?: string }
  | { type: 'quote'; text: string; source?: string };

export type NewsItem = {
  imagePath: string | null;
  durationInFrames: number;
  title?: string;
  take?: string; // James's punchy chyron line (falls back to title until the script feeds it)
  teaser?: string; // rundown line for the Headlines scene (LLM-written; top stories only)
  source?: string;
  category?: string;
  // Show section for the 5+3+2 format: 'top' | 'sports' | 'entertainment'.
  // Absent = 'top'. Purely visual (divider card + badge) — never affects timing.
  section?: string;
  visuals?: Visual[]; // multi-beat enrichment; falls back to a single photo beat
  teaserImages?: string[]; // intro slide: paths to all story images for the hook teaser
};

// Absolute-frame scene timeline (THE single source of truth, computed in
// build_background.js and passed through render-props). Every value is a frame
// on the final video timeline. The newshound themes lay plain, contiguous,
// non-overlapping Sequences at these frames; transitions are drawn as OVERLAYS
// centred on the hard cuts. Absent on standalone previews / default props, where
// the themes fall back to the legacy duration-derived layout.
export type SceneTimeline = {
  openingFrames: number;        // opening scene length; headlines hard-cut follows
  headlinesStartFrame: number;  // == openingFrames
  storyStartFrames: number[];   // absolute start frame of each story scene
  closingStartFrame: number | null; // absolute closing start; null when no [CLOSE]
  showEndFrame: number;         // total composition duration (frames)
  wipeFrames: number;           // overlay-wipe length at story->story cuts
};

export type CompositionProps = {
  items: NewsItem[];
  captions?: Caption[];
  captionTop?: number;      // caption Y (theme-dependent)
  closingFrames?: number;   // Closing scene length when the sign-off has its own [CLOSE] segment
  timeline?: SceneTimeline; // absolute scene frames (newshound themes); see above
};
