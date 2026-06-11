// James Newshound brand system — derived from News_Programs/James_Newshound/personality.md §6.
// Spunky tabloid energy: Newshound Yellow hero, Electric Cyan broadcast accent,
// on Studio Charcoal. Anton condensed-caps display, Inter body/captions.

export const NH = {
  yellow: '#FFC01E',   // Newshound Yellow — hero (James's head, brand)
  orange: '#E26A0F',   // Hound Orange — depth, gradients, under-shadow
  ink: '#241710',      // Ink — outlines, text on yellow
  charcoal: '#14181F', // Studio Charcoal — dark base (the set)
  charcoal2: '#1C212B', // slightly lifted charcoal for panels
  cyan: '#19C3E6',     // Electric Cyan — broadcast/live accent, lower-thirds
  red: '#FF3B30',      // Breaking Red — reserved, sparing
  white: '#FFFFFF',
} as const;

export const BRAND = {
  name: 'NEWSHOUND',
  name2: 'NEWS',
  anchor: 'JAMES NEWSHOUND',
  tagline: 'NEWS, SNIFFED OUT.',
  signoff: "AND THAT'S THE PART THEY DIDN'T WANT YOU TO NOTICE.",
} as const;
