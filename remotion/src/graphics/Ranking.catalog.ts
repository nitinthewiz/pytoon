// Ranking catalog entry — co-located with the component so schema/examples/approval never
// drift from the code. registry.ts imports `RankingCatalog` into REGISTRY[] + the GRAPHICS
// map. The zod schema IS the render-time validator (StoryBeats validates `data` against it).
import { z } from 'zod';
import { Ranking } from './Ranking';
import type { CatalogEntry } from './types';

export const RankingSchema = z.object({
  title: z.string(),
  rows: z
    .array(
      z.object({
        rank: z.number(),
        name: z.string(),
        value: z.number(),
        delta: z.number().optional(),
      }),
    )
    .min(2)
    .max(6),
});

export const RankingCatalog: CatalogEntry<z.infer<typeof RankingSchema>> = {
  id: 'ranking',
  kind: 'Ranking', // the registry/Visual key — matches the .tsx export name
  title: 'Ranking',
  category: 'beat',
  Comp: Ranking,
  schema: RankingSchema,
  examples: [
    {
      name: 'standings',
      data: {
        title: 'Premier League',
        rows: [
          { rank: 1, name: 'Arsenal', value: 71, delta: 1 },
          { rank: 2, name: 'Liverpool', value: 68, delta: -1 },
          { rank: 3, name: 'Man City', value: 64, delta: 2 },
          { rank: 4, name: 'Chelsea', value: 60 },
        ],
      },
    },
    {
      name: 'rich-list',
      data: {
        title: 'Richest People',
        rows: [
          { rank: 1, name: 'Musk', value: 251 },
          { rank: 2, name: 'Arnault', value: 188 },
          { rank: 3, name: 'Bezos', value: 184 },
        ],
      },
    },
    {
      name: 'long-names',
      data: {
        title: 'Box Office',
        rows: [
          { rank: 1, name: 'A Movie With A Deliberately Long Title To Test Clamp', value: 1.42 },
          { rank: 2, name: 'Another Very Long Film Name Here', value: 0.98 },
        ],
      },
    },
  ],
  tags: ['ranking', 'leaderboard', 'standings', 'sports'],
  description:
    'Ordered standings — who is winning. Fits sports tables, chart positions, rich lists, polls.',
  approvedFor: { james: 'approved' },
};
