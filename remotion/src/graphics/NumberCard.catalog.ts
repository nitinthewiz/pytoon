// NumberCard catalog entry — THE TEMPLATE every <Name>.catalog.ts copies.
// Co-located with the component so schema/examples/approval never drift from the code.
// registry.ts imports `NumberCardCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { NumberCard } from './NumberCard';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
export const NumberCardSchema = z.object({
  value: z.string(),
  label: z.string().optional(),
});

export const NumberCardCatalog: CatalogEntry<z.infer<typeof NumberCardSchema>> = {
  id: 'number-card',
  kind: 'NumberCard', // the registry/Visual key — matches the .tsx export name
  title: 'Number Card',
  category: 'beat',
  Comp: NumberCard,
  schema: NumberCardSchema,
  examples: [
    { name: 'multiplier', data: { value: '20x', label: 'more potent than fentanyl' } },
    { name: 'percent', data: { value: '3.85%', label: 'inflation, year over year' } },
    { name: 'money', data: { value: '$50M', label: 'fine' } },
    {
      name: 'long-label',
      data: { value: '237%', label: 'a deliberately long label to test the 880px clamp wrap behaviour' },
    },
  ],
  tags: ['stat', 'number', 'universal-fallback'],
  description: 'One punchy auto-extracted stat with a count-up. Fits any single headline number.',
  approvedFor: { james: 'approved' },
};
