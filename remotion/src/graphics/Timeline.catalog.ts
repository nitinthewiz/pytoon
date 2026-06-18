// Timeline catalog entry — co-located with the component so schema/examples/approval never
// drift from the code. registry.ts imports `TimelineCatalog` into REGISTRY[] + the GRAPHICS
// map. The zod schema IS the render-time validator.
import { z } from 'zod';
import { Timeline } from './Timeline';
import type { CatalogEntry } from './types';

export const TimelineSchema = z.object({
  events: z
    .array(
      z.object({
        date: z.string(),
        label: z.string(),
      }),
    )
    .min(2)
    .max(5),
  orientation: z.enum(['v', 'h']).optional(),
});

export const TimelineCatalog: CatalogEntry<z.infer<typeof TimelineSchema>> = {
  id: 'timeline',
  kind: 'Timeline', // the registry/Visual key — matches the .tsx export name
  title: 'Timeline',
  category: 'beat',
  Comp: Timeline,
  schema: TimelineSchema,
  examples: [
    {
      name: 'escalation',
      data: {
        events: [
          { date: 'Jan 2024', label: 'Border clash begins' },
          { date: 'Mar 2024', label: 'Sanctions imposed' },
          { date: 'Jun 2024', label: 'Ceasefire talks' },
          { date: 'Now', label: 'Truce signed' },
        ],
      },
    },
    {
      name: 'product-history',
      data: {
        events: [
          { date: '2007', label: 'iPhone launches' },
          { date: '2010', label: 'iPad arrives' },
          { date: '2024', label: 'Vision Pro ships' },
        ],
      },
    },
    {
      name: 'long-labels',
      data: {
        events: [
          { date: 'Week 1', label: 'A deliberately long event description to test the two-line clamp behaviour on a row' },
          { date: 'Week 4', label: 'Another long label that should wrap to two lines and then ellipsize cleanly' },
        ],
      },
    },
  ],
  tags: ['timeline', 'history', 'escalation', 'calendar'],
  description:
    'Events over time on a vertical spine. Fits conflict escalation, product history, election calendars.',
  approvedFor: { james: 'approved' },
};
