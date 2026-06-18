// BigQuote catalog entry — co-located schema/examples/approval (visual-component-library §2.2).
// registry.ts imports `BigQuoteCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { BigQuote } from './BigQuote';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
// `text` may wrap one clause in **double-asterisks** to mark the highlighter target.
export const BigQuoteSchema = z.object({
  text: z.string().min(1).max(280),
  source: z.string().optional(),
  role: z.string().optional(),
});

export const BigQuoteCatalog: CatalogEntry<z.infer<typeof BigQuoteSchema>> = {
  id: 'big-quote',
  kind: 'BigQuote', // the registry/Visual key — matches the .tsx export name
  title: 'Big Quote',
  category: 'beat',
  Comp: BigQuote,
  schema: BigQuoteSchema,
  examples: [
    {
      name: 'soundbite',
      data: {
        text: 'This is **the biggest threat** to the bloc since the war.',
        source: 'Ursula von der Leyen',
        role: 'EU Commission President',
      },
    },
    {
      name: 'no-attribution',
      data: { text: 'We will **not back down**.' },
    },
    {
      name: 'long-clause',
      data: {
        text: 'The committee found **a deliberate, sustained pattern of concealment that spanned three administrations** and cost taxpayers billions.',
        source: 'Senate Report',
      },
    },
  ],
  tags: ['quote', 'soundbite', 'universal-fallback'],
  description:
    'A striking soundbite with a highlighter sweep under the key clause (wrap it in **asterisks**). Fits any story built around a strong line.',
  approvedFor: { james: 'approved' },
};
