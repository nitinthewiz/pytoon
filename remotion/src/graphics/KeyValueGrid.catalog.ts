// KeyValueGrid catalog entry — co-located with the component so schema/examples/approval
// never drift from the code. registry.ts imports `KeyValueGridCatalog` into REGISTRY[] +
// the GRAPHICS map. The zod schema IS the render-time validator.
import { z } from 'zod';
import { KeyValueGrid } from './KeyValueGrid';
import type { CatalogEntry } from './types';

export const KeyValueGridSchema = z.object({
  title: z.string(),
  cells: z
    .array(
      z.object({
        k: z.string(),
        v: z.string(),
      }),
    )
    .min(2)
    .max(6),
});

export const KeyValueGridCatalog: CatalogEntry<z.infer<typeof KeyValueGridSchema>> = {
  id: 'key-value-grid',
  kind: 'KeyValueGrid', // the registry/Visual key — matches the .tsx export name
  title: 'Key / Value Grid',
  category: 'beat',
  Comp: KeyValueGrid,
  schema: KeyValueGridSchema,
  examples: [
    {
      name: 'deal-terms',
      data: {
        title: 'The Deal',
        cells: [
          { k: 'Price', v: '$44B' },
          { k: 'Buyer', v: 'Musk' },
          { k: 'Closed', v: '2022' },
          { k: 'Per Share', v: '$54.20' },
        ],
      },
    },
    {
      name: 'box-score',
      data: {
        title: 'Final',
        cells: [
          { k: 'Lakers', v: '112' },
          { k: 'Celtics', v: '108' },
        ],
      },
    },
    {
      name: 'long-values',
      data: {
        title: 'Spec Sheet',
        cells: [
          { k: 'Status', v: 'Pending Review' },
          { k: 'Region', v: 'Asia-Pacific' },
          { k: 'Launch', v: 'Q4 2026' },
        ],
      },
    },
  ],
  tags: ['facts', 'grid', 'spec-sheet', 'box-score', 'universal-fallback'],
  description:
    'A set of 2–6 facts as labeled tiles. Universal fallback for deal terms, box scores, spec sheets.',
  approvedFor: { james: 'approved' },
};
