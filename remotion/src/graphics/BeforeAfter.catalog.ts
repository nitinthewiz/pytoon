// BeforeAfter catalog entry — co-located so schema/examples/approval never drift from the
// code. registry.ts imports `BeforeAfterCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { BeforeAfter } from './BeforeAfter';
import type { CatalogEntry } from './types';

const SideSchema = z.object({
  label: z.string(),
  value: z.string().optional(),
  src: z.string().optional(),
});

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
export const BeforeAfterSchema = z.object({
  before: SideSchema,
  after: SideSchema,
});

export const BeforeAfterCatalog: CatalogEntry<z.infer<typeof BeforeAfterSchema>> = {
  id: 'before-after',
  kind: 'BeforeAfter', // the registry/Visual key — matches the .tsx export name
  title: 'Before / After',
  category: 'beat',
  Comp: BeforeAfter,
  schema: BeforeAfterSchema,
  examples: [
    {
      name: 'price-move',
      data: {
        before: { label: 'gas, per gallon', value: '$3.10' },
        after: { label: 'gas, per gallon', value: '$4.85' },
      },
    },
    {
      name: 'policy-change',
      data: {
        before: { label: 'rate cap' },
        after: { label: 'no cap' },
      },
    },
    {
      name: 'long-label',
      data: {
        before: {
          label: 'a deliberately long before label to test the card wrap at the edge',
          value: '12%',
        },
        after: {
          label: 'an equally long after label so both cards exercise the clamp behaviour',
          value: '47%',
        },
      },
    },
  ],
  tags: ['before-after', 'change', 'comparison', 'stat'],
  description:
    'Change between two states, revealed by a wipe. Fits price moves, policy changes, disasters.',
  approvedFor: { james: 'approved' },
};
