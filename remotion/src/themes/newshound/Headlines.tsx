import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTON, INTER } from '../../fonts';
import { NH } from '../newshound';
import { AVATAR_ZONE_H, BOTTOM_BAR_H } from '../../layout';
import { StudioBackdrop, Ticker } from './Furniture';

// The rundown panel starts here (pulled up from AVATAR_ZONE_H=704 to overlap the
// studio image and kill the dead gap). Tune this single value to move it up/down.
const RUNDOWN_TOP = 480;

type Props = {
  headlines: string[];
  durationInFrames: number;
  // Static final row teasing the non-top sections ("...plus sports and the fun
  // stuff."). Absent on classic 5-story shows — layout is then unchanged.
  moreLine?: string;
};

// "THE RUNDOWN" — James teases the slate (intro narration). Avatar sits in the
// studio zone up top; the rundown reveals beneath, one item at a time.
export const Headlines: React.FC<Props> = ({ headlines, durationInFrames, moreLine }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = headlines.slice(0, 5);
  const rowCount = items.length + (moreLine ? 1 : 0);
  const revealWindow = durationInFrames * 0.62;
  const step = rowCount ? revealWindow / rowCount : 0;

  const titleIn = spring({ frame: frame - 4, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ background: NH.charcoal }}>
      <StudioBackdrop height={AVATAR_ZONE_H} />

      {/* lower panel with the rundown — pulled UP to overlap the studio image
          (RUNDOWN_TOP < AVATAR_ZONE_H); a top scrim keeps the image readable behind. */}
      <div style={{ position: 'absolute', top: RUNDOWN_TOP, left: 0, right: 0, bottom: BOTTOM_BAR_H, background: `linear-gradient(180deg, rgba(20,24,31,0) 0%, ${NH.charcoal} 90px, ${NH.charcoal2} 100%)`, padding: '120px 56px 0' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 44, transform: `translateX(${interpolate(titleIn, [0, 1], [-60, 0])}px)`, opacity: titleIn }}>
          <div style={{ width: 18, height: 86, background: NH.yellow }} />
          <div>
            <div style={{ fontFamily: ANTON, fontSize: 88, color: NH.white, lineHeight: 0.9, letterSpacing: 1 }}>THE RUNDOWN</div>
            <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 26, color: NH.cyan, letterSpacing: 4 }}>WHAT I SNIFFED OUT TODAY</div>
          </div>
        </div>

        {/* items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {items.map((title, i) => {
            const enter = spring({ frame: frame - i * step, fps, config: { damping: 16 } });
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [-80, 0])}px)` }}>
                <div style={{ flexShrink: 0, width: 70, height: 70, background: NH.cyan, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ANTON, fontSize: 42, color: NH.ink, transform: 'skewX(-8deg)' }}>
                  <span style={{ transform: 'skewX(8deg)' }}>{i + 1}</span>
                </div>
                <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: 40, color: NH.white, lineHeight: 1.1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</span>
              </div>
            );
          })}
          {moreLine && (() => {
            // Section tease — same row anatomy as a teaser, yellow "+" chip.
            const enter = spring({ frame: frame - items.length * step, fps, config: { damping: 16 } });
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [-80, 0])}px)` }}>
                <div style={{ flexShrink: 0, width: 70, height: 70, background: NH.yellow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ANTON, fontSize: 42, color: NH.ink, transform: 'skewX(-8deg)' }}>
                  <span style={{ transform: 'skewX(8deg)' }}>+</span>
                </div>
                <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: 40, color: NH.yellow, lineHeight: 1.1 }}>{moreLine}</span>
              </div>
            );
          })()}
        </div>
      </div>

      <Ticker height={BOTTOM_BAR_H} right="UP NEXT" />
    </AbsoluteFill>
  );
};
