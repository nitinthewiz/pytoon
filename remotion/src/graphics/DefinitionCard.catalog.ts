// DefinitionCard catalog entry — co-located schema/examples/approval (visual-component-library §2.2).
// registry.ts imports `DefinitionCardCatalog` into REGISTRY[] + the GRAPHICS map.
import { z } from 'zod';
import { DefinitionCard } from './DefinitionCard';
import type { CatalogEntry } from './types';

// The zod schema IS the render-time validator (StoryBeats validates `data` against it).
export const DefinitionCardSchema = z.object({
  term: z.string().min(1).max(40),
  definition: z.string().min(1).max(220),
  etymology: z.string().optional(),
});

export const DefinitionCardCatalog: CatalogEntry<z.infer<typeof DefinitionCardSchema>> = {
  id: 'definition-card',
  kind: 'DefinitionCard', // the registry/Visual key — matches the .tsx export name
  title: 'Definition Card',
  category: 'beat',
  Comp: DefinitionCard,
  schema: DefinitionCardSchema,
  examples: [
    {
      name: 'jargon',
      data: {
        term: 'Quantitative Easing',
        definition: 'A central bank buying bonds to pump money into the economy and push rates down.',
      },
    },
    {
      name: 'with-etymology',
      data: {
        term: 'Filibuster',
        definition: 'A delay tactic used to block a vote by talking a bill to death.',
        etymology: 'from the Dutch "vrijbuiter" — pirate',
      },
    },
    {
      name: 'long-definition',
      data: {
        term: 'Tariff',
        definition:
          'A tax a government charges on imported goods, raising their price so domestic products compete more easily and the treasury collects revenue at the border.',
      },
    },
  ],
  tags: ['definition', 'explainer', 'jargon'],
  description:
    'Defines one term for an explainer or "James explains" beat — display term, drawn underline, definition typed in word by word. Use when a piece of jargon needs unpacking.',
  approvedFor: { james: 'approved' },
};
