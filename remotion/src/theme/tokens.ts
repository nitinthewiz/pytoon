// Theme-token system (visual-component-library spec §1.2).
//
// Every color/font/motion-feel a brand-agnostic graphic block needs, pulled out of
// the hard-coded NH/ANTON/INTER literals into a per-production "brand sheet". A block
// reads these via useTheme() instead of importing newshound.ts — so the SAME block
// renders in James's yellow-on-charcoal or any other show's palette with no code change.
//
// Each key is a 1:1 rename of a real inline literal in today's renderer (NH.*,
// the BEAT_T constant, the ENERGY table in StoryBeats). Nothing speculative.
import { z } from 'zod';

export const ThemeTokens = z.object({
  id: z.string(), // 'james' | 'acme-sports' | ...

  palette: z.object({
    hero: z.string(), // was NH.yellow  — primary brand color
    heroInk: z.string(), // was NH.ink     — outline/text-on-hero
    secondary: z.string(), // was NH.orange  — depth/gradients/drop-shadow
    accent: z.string(), // was NH.cyan    — broadcast/live accent
    alert: z.string(), // was NH.red     — reserved "breaking"
    bg: z.string(), // was NH.charcoal — dark base (the set)
    bg2: z.string(), // was NH.charcoal2 — lifted panel charcoal
    fg: z.string(), // was NH.white
  }),

  fonts: z.object({
    display: z.string(), // condensed display family  (was ANTON)
    body: z.string(), // body/caption family        (was INTER)
    displayWeight: z.number().default(400),
    bodyWeight: z.number().default(700),
  }),

  motion: z.object({
    // "motion feel" — multipliers/knobs the beats already want (MOTION_GRAPHICS_SPEC §motion).
    energy: z.number().default(1.0), // global cut-cadence / move-speed multiplier
    beatTransitionFrames: z.number().default(13), // the BEAT_T constant, now per-theme
    kenBurnsAmplitude: z.number().default(1.0), // pan/zoom intensity scalar
    cornerRadius: z.number().default(18),
    strokeWeight: z.number().default(8), // the "ink" outline weight
  }),

  // emotion → energy table (today hard-coded in StoryBeats as ENERGY{}); themeable.
  emotionEnergy: z
    .record(z.string(), z.number())
    .default({
      happy: 1.4,
      angry: 1.4,
      rhetorical: 1.25,
      explain: 1.05,
      confused: 1.05,
      sad: 0.7,
    }),
});

export type Theme = z.infer<typeof ThemeTokens>;

// Parse a raw (e.g. JSON-imported) theme through the schema so defaults fill in and
// shape is guaranteed. Use this anywhere a *.theme.json is loaded.
export const parseTheme = (raw: unknown): Theme => ThemeTokens.parse(raw);
