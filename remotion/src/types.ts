import { type Caption } from '@remotion/captions';

export type NewsItem = {
  imagePath: string | null;
  durationInFrames: number;
  title?: string;
  source?: string;
  category?: string;
  teaserImages?: string[]; // intro slide: paths to all story images for the hook teaser
};

export type CompositionProps = {
  items: NewsItem[];
  captions?: Caption[];
};
