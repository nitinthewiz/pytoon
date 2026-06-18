// HeadlinePull catalog entry — co-located schema/examples/approval (visual-component-library §2.2).
// registry.ts imports `HeadlinePullCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { HeadlinePull } from './HeadlinePull';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
export const HeadlinePullSchema = z.object({
  headline: z.string().min(1).max(160),
  outlet: z.string().optional(),
  date: z.string().optional(),
});

export const HeadlinePullCatalog: CatalogEntry<z.infer<typeof HeadlinePullSchema>> = {
  id: 'headline-pull',
  kind: 'HeadlinePull', // the registry/Visual key — matches the .tsx export name
  title: 'Headline Pull',
  category: 'beat',
  Comp: HeadlinePull,
  schema: HeadlinePullSchema,
  examples: [
    {
      name: 'scoop',
      data: {
        headline: 'Regulators open probe into chipmaker subsidies',
        outlet: 'Financial Times',
        date: 'Jun 16',
      },
    },
    {
      name: 'no-meta',
      data: { headline: 'Ceasefire holds for a third day' },
    },
    {
      name: 'long-headline',
      data: {
        headline:
          'Internal documents reveal the agency knew about the contamination years before it warned the public',
        outlet: 'ProPublica',
        date: '2026',
      },
    },
  ],
  tags: ['headline', 'source', 'scoop'],
  description:
    'A clipped front-page card for a story built off a single report or scoop (license-safe, no real screenshot). Use when citing one outlet.',
  approvedFor: { james: 'approved' },
};
