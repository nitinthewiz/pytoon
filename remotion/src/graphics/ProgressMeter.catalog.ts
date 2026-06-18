// ProgressMeter catalog entry (co-located with the component so schema/examples/approval
// never drift). registry.ts imports `ProgressMeterCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { ProgressMeter } from './ProgressMeter';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
export const ProgressMeterSchema = z.object({
  value: z.number(),
  max: z.number(),
  label: z.string(),
  unit: z.string().optional(),
  deadline: z.string().optional(),
});

export const ProgressMeterCatalog: CatalogEntry<z.infer<typeof ProgressMeterSchema>> = {
  id: 'progress-meter',
  kind: 'ProgressMeter', // the registry/Visual key — matches the .tsx export name
  title: 'Progress Meter',
  category: 'beat',
  Comp: ProgressMeter,
  schema: ProgressMeterSchema,
  examples: [
    {
      name: 'fundraising',
      data: { value: 1800000, max: 5000000, label: 'raised so far', unit: '$', deadline: 'June 30' },
    },
    { name: 'vote-count', data: { value: 218, max: 435, label: 'votes secured' } },
    {
      name: 'emissions-long-label',
      data: {
        value: 62,
        max: 100,
        label: 'a deliberately long label to test wrap: share of the 2030 net-zero pathway met',
        unit: '%',
        deadline: '2030',
      },
    },
  ],
  tags: ['stat', 'progress', 'target', 'countdown'],
  description:
    'Progress toward a target. Fits fundraising, vote counts, emissions targets, countdowns.',
  approvedFor: { james: 'approved' },
};
