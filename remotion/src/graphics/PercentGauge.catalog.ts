// PercentGauge catalog entry (co-located with the component so schema/examples/approval
// never drift). registry.ts imports `PercentGaugeCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { PercentGauge } from './PercentGauge';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
export const PercentGaugeSchema = z.object({
  value: z.number(),
  label: z.string(),
  max: z.number().optional(),
  zones: z
    .array(z.object({ to: z.number(), color: z.string() }))
    .optional(),
});

export const PercentGaugeCatalog: CatalogEntry<z.infer<typeof PercentGaugeSchema>> = {
  id: 'percent-gauge',
  kind: 'PercentGauge', // the registry/Visual key — matches the .tsx export name
  title: 'Percent Gauge',
  category: 'beat',
  Comp: PercentGauge,
  schema: PercentGaugeSchema,
  examples: [
    { name: 'approval', data: { value: 43, label: 'approval rating' } },
    {
      name: 'risk-zones',
      data: {
        value: 78,
        label: 'a long label to test wrap: probability the rate hike lands in March',
        zones: [
          { to: 33, color: '#2ECC71' },
          { to: 66, color: '#F1C40F' },
          { to: 100, color: '#E74C3C' },
        ],
      },
    },
    { name: 'out-of-max', data: { value: 6.2, label: 'magnitude', max: 10 } },
  ],
  tags: ['stat', 'gauge', 'percent', 'rating'],
  description:
    'A single metric inside min/max context. Fits approval ratings, inflation, poll share, risk level.',
  approvedFor: { james: 'approved' },
};
