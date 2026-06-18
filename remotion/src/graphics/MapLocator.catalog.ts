// MapLocator catalog entry — co-located with the component so schema/examples/approval
// never drift from the code. registry.ts imports `MapLocatorCatalog` into REGISTRY[] +
// the GRAPHICS map.
import { z } from 'zod';
import { MapLocator } from './MapLocator';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
// Pin x/y are percentages (0..100) of the world card — outline-agnostic, no projection.
export const MapLocatorSchema = z.object({
  country: z.string().optional(),
  outline: z.string().optional(), // optional inline SVG path drawn on a 100×100 viewBox
  region: z.string().optional(),
  pins: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        label: z.string().optional(),
      }),
    )
    .min(1)
    .max(4),
});

export const MapLocatorCatalog: CatalogEntry<z.infer<typeof MapLocatorSchema>> = {
  id: 'map-locator',
  kind: 'MapLocator', // the registry/Visual key — matches the .tsx export name
  title: 'Map Locator',
  category: 'beat',
  Comp: MapLocator,
  schema: MapLocatorSchema,
  examples: [
    {
      name: 'single-pin',
      data: { region: 'Eastern Europe', pins: [{ x: 58, y: 34, label: 'Kyiv' }] },
    },
    {
      name: 'two-pins',
      data: {
        region: 'South Asia',
        pins: [
          { x: 40, y: 52, label: 'New Delhi' },
          { x: 52, y: 60, label: 'Dhaka' },
        ],
      },
    },
    {
      name: 'long-label',
      data: {
        country: 'United States',
        pins: [{ x: 30, y: 44, label: 'Washington, D.C.' }],
      },
    },
  ],
  tags: ['map', 'geo', 'location', 'breaking', 'where'],
  description:
    'Where a story is happening — a styled world card with a dropping, pulsing pin. Fits any geographic or breaking story. License + headless safe (no map tiles).',
  approvedFor: { james: 'approved' },
};
