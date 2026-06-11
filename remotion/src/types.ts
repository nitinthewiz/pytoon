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
  source?: string;
  category?: string;
  visuals?: Visual[]; // multi-beat enrichment; falls back to a single photo beat
  teaserImages?: string[]; // intro slide: paths to all story images for the hook teaser
};

export type CompositionProps = {
  items: NewsItem[];
  captions?: Caption[];
  captionTop?: number;      // caption Y (theme-dependent)
  closingFrames?: number;   // Closing scene length when the sign-off has its own [CLOSE] segment
};
