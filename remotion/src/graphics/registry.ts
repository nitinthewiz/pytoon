// Graphic registry (visual-component-library §2.3, MOTION_GRAPHICS_SPEC §self-generating).
//
// ONE source, TWO views:
//   • REGISTRY: CatalogEntry[]            → the Catalog composition + the Airtable mirror
//   • GRAPHICS: Record<kind,{Comp,schema}> → the renderer (StoryBeats' validate-or-Fallback path)
//
// Each block ships a <Name>.catalog.ts exporting `<Name>Catalog`. Add a block by dropping
// in its two files and adding ONE import + ONE array entry below.
import type { CatalogEntry } from './types';

// ── existing / shipped blocks ─────────────────────────────────────────────────────────
import { NumberCardCatalog } from './NumberCard.catalog';

// ── TODO(blocks-phase): uncomment each line as the parallel block-builders land the files.
// Each block = graphics/<Name>.tsx (exports <Name>) + graphics/<Name>.catalog.ts (exports
// <Name>Catalog). Then add the imported name to the CATALOGS array below.
//
import { StatComparisonCatalog } from './StatComparison.catalog';
import { PercentGaugeCatalog } from './PercentGauge.catalog';
import { ProgressMeterCatalog } from './ProgressMeter.catalog';
import { RankingCatalog } from './Ranking.catalog';
import { KeyValueGridCatalog } from './KeyValueGrid.catalog';
import { TimelineCatalog } from './Timeline.catalog';
import { BigQuoteCatalog } from './BigQuote.catalog';
import { HeadlinePullCatalog } from './HeadlinePull.catalog';
import { DefinitionCardCatalog } from './DefinitionCard.catalog';
import { VSCatalog } from './VS.catalog';
import { MapLocatorCatalog } from './MapLocator.catalog';
import { BeforeAfterCatalog } from './BeforeAfter.catalog';
import { MarketTickerCatalog } from './MarketTicker.catalog';

// The full registry array. Append each block's catalog here once its import is uncommented.
const CATALOGS: CatalogEntry[] = [
  NumberCardCatalog,
  StatComparisonCatalog,
  PercentGaugeCatalog,
  ProgressMeterCatalog,
  RankingCatalog,
  KeyValueGridCatalog,
  TimelineCatalog,
  BigQuoteCatalog,
  HeadlinePullCatalog,
  DefinitionCardCatalog,
  VSCatalog,
  MapLocatorCatalog,
  BeforeAfterCatalog,
  MarketTickerCatalog,
];

// View 1 — the catalog array (Catalog composition + Airtable mirror consume this).
export const REGISTRY: CatalogEntry[] = CATALOGS;

// View 2 — the renderer map: kind → { Comp, schema }. StoryBeats' 'graphic' case looks up
// GRAPHICS[kind], zod-validates data against schema, renders Comp (else a FallbackCard).
export const GRAPHICS: Record<string, { Comp: CatalogEntry['Comp']; schema: CatalogEntry['schema'] }> =
  Object.fromEntries(CATALOGS.map((e) => [e.kind, { Comp: e.Comp, schema: e.schema }]));

// Convenience lookups for the Catalog composition's filters.
export const byKind = (kind: string): CatalogEntry | undefined =>
  REGISTRY.find((e) => e.kind === kind);
export const byTag = (tag: string): CatalogEntry[] =>
  REGISTRY.filter((e) => e.tags.includes(tag));
