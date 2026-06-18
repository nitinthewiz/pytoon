// LayoutBeat catalog entry — the GENERIC self-generating primitive's catalog card.
//
// Unlike every other entry, LayoutBeat is NOT a {type:'graphic'; kind} library block — it
// is the {type:'layout'; spec} Visual member (a flat node list the LLM fills). It is
// therefore registered SEPARATELY (NOT in the GRAPHICS kind→Comp map, which would let the
// picker mis-select it with the wrong props). This catalog entry exists so:
//   • the Catalog composition can preview specs, and
//   • the n8n CONFIG-step prompt can be auto-generated from {description, schema, examples}
//     (MOTION_GRAPHICS_SPEC §self-generating: the prompt is built from the registry).
//
// The Comp takes {spec}; so each example's `data` is { spec: LayoutSpec } and the catalog
// `schema` validates that envelope. The REAL spec validator is LayoutSpecSchema, applied
// inside LayoutBeat at render time (invalid → FallbackCard).
import { z } from 'zod';
import { LayoutBeat } from './LayoutBeat';
import type { CatalogEntry } from './types';

// The catalog schema describes the Comp's props envelope { spec }. `spec` is typed `unknown`
// here to MATCH LayoutBeat's actual props (it accepts an unvalidated spec); the REAL spec
// validation is LayoutSpecSchema, applied INSIDE LayoutBeat at render time (invalid →
// FallbackCard). Keeping it `unknown` is what lets the catalog hold an "invalid-degrades"
// example to prove the fallback path renders.
export const LayoutBeatPropsSchema = z.object({ spec: z.unknown() });

export const LayoutBeatCatalog: CatalogEntry<z.infer<typeof LayoutBeatPropsSchema>> = {
  id: 'layout-beat',
  kind: 'LayoutBeat',
  title: 'Layout Beat (generic)',
  category: 'beat',
  Comp: LayoutBeat,
  schema: LayoutBeatPropsSchema,
  examples: [
    {
      name: 'two-stat-compare',
      data: {
        spec: {
          nodes: [
            { kind: 'text', x: 90, y: 240, w: 900, h: 80, color: 'accent', font: 'body', text: 'BUDGET GAP', anim: 'slideIn', animDelay: 4 },
            { kind: 'number', x: 90, y: 360, w: 440, h: 260, color: 'hero', font: 'display', text: '$50M', anim: 'countUp', animDelay: 8 },
            { kind: 'number', x: 560, y: 360, w: 440, h: 260, color: 'fg', font: 'display', text: '$12M', anim: 'countUp', animDelay: 14 },
            { kind: 'text', x: 90, y: 640, w: 440, h: 70, color: 'fg', font: 'body', text: 'PROPOSED', anim: 'fade', animDelay: 16 },
            { kind: 'text', x: 560, y: 640, w: 440, h: 70, color: 'fg', font: 'body', text: 'APPROVED', anim: 'fade', animDelay: 18 },
          ],
          caption: 'A 4x cut from the table',
        },
      },
    },
    {
      name: 'headline-with-shape',
      data: {
        spec: {
          nodes: [
            { kind: 'box', x: 0, y: 760, w: 1080, h: 12, color: 'hero', anim: 'slideIn', animDelay: 2 },
            { kind: 'text', x: 80, y: 540, w: 920, h: 220, color: 'fg', font: 'display', text: 'RATES HELD STEADY', fontSize: 96, anim: 'slideIn', animDelay: 6 },
            { kind: 'shape', x: 80, y: 820, w: 120, h: 120, color: 'accent', shape: 'circle', anim: 'pop', animDelay: 12 },
          ],
        },
      },
    },
    {
      name: 'image-backed',
      data: {
        spec: {
          nodes: [
            { kind: 'image-ref', x: 0, y: 0, w: 1080, h: 1920, ref: 'james_neutral.png', anim: 'kenburns' },
            { kind: 'box', x: 0, y: 1500, w: 1080, h: 420, color: 'bg', anim: 'fade', animDelay: 0 },
            { kind: 'text', x: 80, y: 1560, w: 920, h: 160, color: 'hero', font: 'display', text: 'BREAKING', fontSize: 120, anim: 'pop', animDelay: 8 },
          ],
        },
      },
    },
    {
      name: 'invalid-degrades',
      // an empty node list violates min(1) → LayoutBeat renders its FallbackCard, never throws.
      data: { spec: { nodes: [] } as any },
    },
  ],
  tags: ['generic', 'self-generating', 'layout', 'universal-fallback'],
  description:
    'Generic on-the-fly beat: a flat list of positioned themed nodes (box/text/number/shape/image-ref) the LLM fills when no library block fits. Colours are palette keys, images are static refs — no arbitrary URLs or codegen. The safety-net layer of the fallback ladder.',
  approvedFor: { james: 'approved' },
};
