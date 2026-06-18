// VS catalog entry — co-located with the component so schema/examples/approval never
// drift from the code. registry.ts imports `VSCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { VS } from './VS';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
const Side = z.object({
  name: z.string(),
  sub: z.string().optional(),
  color: z.string().optional(),
});

export const VSSchema = z.object({
  a: Side,
  b: Side,
  topic: z.string().optional(),
});

export const VSCatalog: CatalogEntry<z.infer<typeof VSSchema>> = {
  id: 'vs',
  kind: 'VS', // the registry/Visual key — matches the .tsx export name
  title: 'Versus',
  category: 'beat',
  Comp: VS,
  schema: VSSchema,
  examples: [
    {
      name: 'election',
      data: {
        topic: 'the matchup',
        a: { name: 'Smith', sub: 'incumbent' },
        b: { name: 'Jones', sub: 'challenger' },
      },
    },
    {
      name: 'fixture',
      data: { a: { name: 'India' }, b: { name: 'Australia' }, topic: 'world cup final' },
    },
    {
      name: 'long-label',
      data: {
        topic: 'antitrust showdown',
        a: { name: 'Department of Justice', sub: 'plaintiff in the federal case' },
        b: { name: 'Megacorp Holdings', sub: 'defendant, market leader' },
      },
    },
  ],
  tags: ['vs', 'matchup', 'sports', 'election', 'rivalry'],
  description:
    'Two sides slam in for a head-to-head. Fits elections, fixtures, company rivalries, court cases — any matchup.',
  approvedFor: { james: 'approved' },
};
