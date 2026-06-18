// StatComparison catalog entry (co-located with the component so schema/examples/approval
// never drift). registry.ts imports `StatComparisonCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { StatComparison } from './StatComparison';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
export const StatComparisonSchema = z.object({
  items: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
        unit: z.string().optional(),
        color: z.string().optional(),
      }),
    )
    .min(2)
    .max(4),
  caption: z.string().optional(),
});

export const StatComparisonCatalog: CatalogEntry<z.infer<typeof StatComparisonSchema>> = {
  id: 'stat-comparison',
  kind: 'StatComparison', // the registry/Visual key — matches the .tsx export name
  title: 'Stat Comparison',
  category: 'beat',
  Comp: StatComparison,
  schema: StatComparisonSchema,
  examples: [
    {
      name: 'budgets',
      data: {
        items: [
          { label: 'United States', value: 877 },
          { label: 'China', value: 292 },
        ],
        caption: 'defense spending, $bn',
      },
    },
    {
      name: 'three-way',
      data: {
        items: [
          { label: 'A', value: 40, unit: '%' },
          { label: 'B', value: 75, unit: '%' },
          { label: 'C', value: 55, unit: '%' },
        ],
      },
    },
    {
      name: 'long-labels',
      data: {
        items: [
          { label: 'Renewable generation capacity', value: 1.2 },
          { label: 'Coal generation capacity', value: 3.4 },
          { label: 'Nuclear generation capacity', value: 0.9 },
          { label: 'Natural gas generation capacity', value: 2.1 },
        ],
        caption: 'a deliberately long caption to test the 940px column wrap behaviour',
      },
    },
  ],
  tags: ['stat', 'comparison', 'universal-fallback'],
  description:
    'Which of 2-4 magnitudes is bigger. Fits budgets, casualties, market caps, any comparable numbers.',
  approvedFor: { james: 'approved' },
};
