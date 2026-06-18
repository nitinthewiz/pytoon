// MarketTicker catalog entry — co-located so schema/examples/approval never drift from the
// code. registry.ts imports `MarketTickerCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { MarketTicker } from './MarketTicker';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
export const MarketTickerSchema = z.object({
  rows: z
    .array(
      z.object({
        symbol: z.string(),
        value: z.string(),
        changePct: z.number(),
      }),
    )
    .min(2)
    .max(8),
  headline: z.string().optional(),
});

export const MarketTickerCatalog: CatalogEntry<z.infer<typeof MarketTickerSchema>> = {
  id: 'market-ticker',
  kind: 'MarketTicker', // the registry/Visual key — matches the .tsx export name
  title: 'Market Ticker',
  category: 'beat',
  Comp: MarketTicker,
  schema: MarketTickerSchema,
  examples: [
    {
      name: 'indices',
      data: {
        headline: 'markets today',
        rows: [
          { symbol: 'S&P 500', value: '5,431', changePct: 1.24 },
          { symbol: 'NASDAQ', value: '17,210', changePct: 2.05 },
          { symbol: 'DOW', value: '38,905', changePct: -0.41 },
          { symbol: 'VIX', value: '13.8', changePct: -3.10 },
        ],
      },
    },
    {
      name: 'crypto',
      data: {
        rows: [
          { symbol: 'BTC', value: '$67,420', changePct: -2.8 },
          { symbol: 'ETH', value: '$3,510', changePct: -1.4 },
        ],
      },
    },
    {
      name: 'long-symbols',
      data: {
        headline: 'a deliberately long market headline to test layout',
        rows: [
          { symbol: 'BERKSHIRE-A', value: '$621,300', changePct: 0.12 },
          { symbol: 'ALPHABET-C', value: '$178.40', changePct: 3.77 },
          { symbol: 'TESLA-INC', value: '$184.20', changePct: -5.60 },
        ],
      },
    },
  ],
  tags: ['market', 'ticker', 'finance', 'stat', 'scroll'],
  description:
    'Multiple moving values scrolling with up/down tint + a spark line. Fits markets, crypto, econ.',
  approvedFor: { james: 'approved' },
};
