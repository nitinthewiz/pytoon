import React from 'react';
import { AbsoluteFill, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { ANTON, INTER } from '../../fonts';
import { NH } from '../newshound';
import { type NewsItem } from '../../types';

// ---------------------------------------------------------------------------
// Show sections — the 5+3+2 format ("5 top + 3 sports + 2 entertainment").
// news[] items carry an optional `section` ('top' | 'sports' | 'entertainment',
// absent = 'top'), in section order.
//
// HARD RULE: sections have ZERO timeline impact. The narration is one
// continuous track and every story's slide timing is caption-derived, so a
// section break must NOT add a scene (that would desync everything after it).
// Instead the FIRST story of a new section gets a branded full-frame card
// OVERLAYED on its first ~SECTION_CARD_FRAMES frames (StingerWipe aesthetic:
// Newshound-yellow band, ink edges, Anton label), which then sweeps off to
// reveal the story already running beneath. Non-top stories also wear a small
// persistent badge next to the category bug.
// ---------------------------------------------------------------------------

export const sectionOf = (it: NewsItem): string =>
  (it.section ?? 'top').trim().toLowerCase() || 'top';

// Divider-card label per section (unknown sections fall back to UPPERCASE name).
export const SECTION_LABEL: Record<string, string> = {
  top: 'TOP STORIES',
  sports: 'SPORTS',
  entertainment: 'THE FUN STUFF',
};

// Small persistent badge next to the category bug (non-top stories only).
export const SECTION_BADGE: Record<string, string> = {
  sports: 'SPORTS',
  entertainment: 'FUN',
};

// True when story i opens a NEW section vs the story before it (never story 0 —
// the show opens in 'top' and the rundown already introduced it).
export const startsNewSection = (stories: NewsItem[], i: number): boolean =>
  i > 0 && sectionOf(stories[i]) !== sectionOf(stories[i - 1]);

// Rundown footer line when the show carries extra sections ("teasers" stay
// top-only by contract; the rest get one static tease).
export const rundownMoreLine = (stories: NewsItem[]): string | undefined => {
  const has = (s: string) => stories.some((it) => sectionOf(it) === s);
  const sports = has('sports');
  const fun = has('entertainment');
  if (sports && fun) return '...plus sports and the fun stuff.';
  if (sports) return '...plus the sports desk.';
  if (fun) return '...plus the fun stuff.';
  return undefined;
};

// How long the divider card owns the story's opening (frames @30fps ≈ 1.2s).
export const SECTION_CARD_FRAMES = 35;
const CARD_HOLD = 20; // frames of full cover before the sweep-off begins

// Full-frame section divider in the StingerWipe aesthetic. Mounted INSIDE the
// story's sequence (frame 0 = story start), on top of the story content: the
// inter-story stinger band wipes in, "hands off" to this card, the card holds
// with the section label, then sweeps off right revealing the story beneath.
// Band geometry matches StingerWipe (160% wide, skew -12deg ⇒ x:0 covers the
// frame, x:+130% is fully off-screen).
export const SectionCard: React.FC<{ section: string }> = ({ section }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame >= SECTION_CARD_FRAMES) return null;

  const label = SECTION_LABEL[section] ?? section.toUpperCase();
  // Fit the label to the 1080px visible window (Anton ≈ 0.52em/char): short
  // labels ("SPORTS") get the full 170px, long ones ("THE FUN STUFF") shrink.
  const labelSize = Math.min(170, Math.floor(1400 / Math.max(6, label.length)));
  const x = interpolate(frame, [CARD_HOLD, SECTION_CARD_FRAMES - 1], [0, 130], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pop = spring({ frame: frame - 5, fps, config: { damping: 13, mass: 0.6 } });

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', zIndex: 40 }}>
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          height: '120%',
          left: '-30%',
          width: '160%',
          transform: `translateX(${x}%) skewX(-12deg)`,
          // BLUE section divider (distinct from the yellow story stingers).
          background: `linear-gradient(180deg, ${NH.cyan} 0%, #0E76B8 100%)`,
          borderLeft: `12px solid ${NH.ink}`,
          borderRight: `12px solid ${NH.ink}`,
          boxShadow: '0 0 90px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            transform: `skewX(12deg) scale(${0.8 + 0.2 * pop})`, // counter-skew, label pops in
            opacity: Math.min(1, pop * 1.4),
            display: 'flex',
            alignItems: 'center',
            gap: 40,
            whiteSpace: 'nowrap',
          }}
        >
          <Img
            src={staticFile('james.png')}
            style={{ height: 220, transform: 'rotate(-6deg)', filter: 'drop-shadow(0 10px 0 #08324C)' }}
          />
          <div>
            <div style={{ fontFamily: INTER, fontWeight: 900, fontSize: 34, color: NH.white, letterSpacing: 10, opacity: 0.85 }}>
              NEXT UP
            </div>
            <div style={{ fontFamily: ANTON, fontSize: labelSize, lineHeight: 1, color: NH.white, letterSpacing: 5, textShadow: '0 6px 0 #08324C' }}>
              {label}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Small persistent section badge — sits right under the category bug (top-right)
// on every non-top story; same skew language, Newshound yellow.
export const SectionBadge: React.FC<{ item: NewsItem }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const section = sectionOf(item);
  if (section === 'top') return null;
  const badge = SECTION_BADGE[section] ?? section.toUpperCase();
  const inn = spring({ frame: frame - 10, fps, config: { damping: 13 } });
  return (
    <div
      style={{
        position: 'absolute',
        top: 102,
        right: 40,
        background: NH.yellow,
        padding: '6px 16px',
        transform: `skewX(-8deg) translateX(${interpolate(inn, [0, 1], [220, 0])}px)`,
        opacity: inn,
        zIndex: 6,
      }}
    >
      <span style={{ display: 'block', transform: 'skewX(8deg)', fontFamily: ANTON, fontSize: 26, color: NH.ink, letterSpacing: 2 }}>
        {badge}
      </span>
    </div>
  );
};
