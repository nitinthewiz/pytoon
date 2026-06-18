// Catalog / registry types (visual-component-library §2.2) + the GraphicData union
// (MOTION_GRAPHICS_SPEC §self-generating).
//
// One CatalogEntry ships next to each block (<Name>.catalog.ts) so schema/examples/
// approval never drift from the code. registry.ts imports them all into REGISTRY[] (the
// Catalog + mirror view) and a GRAPHICS map (the renderer view: kind → {Comp,schema}).
import type React from 'react';
import type { z } from 'zod';

export type CatalogStatus = 'draft' | 'review' | 'approved' | 'deprecated';

// The graphic-kind discriminator used in the Visual union ({type:'graphic'; kind; data}).
// Keep in sync with the block list in registry.ts. String-typed (not a closed union) so a
// new block can be added by dropping in a file without editing this type.
export type GraphicKind = string;

export type CatalogEntry<P = any> = {
  id: string; // slug for the catalog grid + Airtable key: 'number-card', 'stat-comparison'
  kind: GraphicKind; // the registry/Visual key: 'NumberCard', 'StatComparison' — matches the .tsx export
  title: string; // human label for the catalog grid
  category: 'beat' | 'furniture' | 'scene' | 'transition'; // what sort of block it is
  Comp: React.FC<P>;
  schema: z.ZodType<P>; // props contract — ALSO the render-time validator in StoryBeats
  examples: { name: string; data: P }[]; // 1..n dummy datasets ("happy", "long label", "edge")
  tags: string[]; // ['stat','sports','universal-fallback']
  description: string; // "use when" line (doubles as the LLM picker doc)
  previewFrames?: number; // how long to play it in the catalog (default 90)
  // approval is PER PRODUCTION, tracked here (git blame on this field = the audit trail).
  approvedFor: Record<string, CatalogStatus>; // { james: 'approved', 'acme-sports': 'review' }
};

// ── GraphicData union ─────────────────────────────────────────────────────────────────
// One member per planned block kind — the `data` payload each block's schema validates.
// These mirror MOTION_GRAPHICS_SPEC §graphic-library data shapes. The Visual union in
// types.ts carries { type:'graphic'; kind; data:GraphicData }; StoryBeats zod-validates
// data against GRAPHICS[kind].schema before rendering (else a FallbackCard).
export type NumberCardData = { value: string; label?: string };
export type StatComparisonData = {
  items: { label: string; value: number; unit?: string; color?: string }[];
  caption?: string;
};
export type PercentGaugeData = {
  value: number;
  label: string;
  max?: number;
  zones?: { to: number; color: string }[];
};
export type ProgressMeterData = {
  value: number;
  max: number;
  label: string;
  unit?: string;
  deadline?: string;
};
export type RankingData = {
  title: string;
  rows: { rank: number; name: string; value: number; delta?: number }[];
};
export type KeyValueGridData = { title: string; cells: { k: string; v: string }[] };
export type TimelineData = { events: { date: string; label: string }[]; orientation?: 'v' | 'h' };
export type BigQuoteData = { text: string; source?: string; role?: string };
export type HeadlinePullData = { headline: string; outlet?: string; date?: string };
export type DefinitionCardData = { term: string; definition: string; etymology?: string };
export type VSData = {
  a: { name: string; sub?: string; color?: string };
  b: { name: string; sub?: string; color?: string };
  topic?: string;
};
export type MapLocatorData = {
  country?: string;
  outline?: string;
  pins: { x: number; y: number; label?: string }[];
  region?: string;
};
export type BeforeAfterData = {
  before: { label: string; value?: string; src?: string };
  after: { label: string; value?: string; src?: string };
};
export type MarketTickerData = {
  rows: { symbol: string; value: string; changePct: number }[];
  headline?: string;
};

export type GraphicData =
  | NumberCardData
  | StatComparisonData
  | PercentGaugeData
  | ProgressMeterData
  | RankingData
  | KeyValueGridData
  | TimelineData
  | BigQuoteData
  | HeadlinePullData
  | DefinitionCardData
  | VSData
  | MapLocatorData
  | BeforeAfterData
  | MarketTickerData;
